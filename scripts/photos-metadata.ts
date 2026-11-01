import type { PhotoCache, PhotoEntry, PhotoMetadata } from '../photos/model'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import { encode, isBlurhashValid } from 'blurhash'
import fg from 'fast-glob'
import sharp from 'sharp'
import { photoCacheVersion, photoExtension, photoId, validateCatalog } from '../photos/model'

function hash(buffer: Buffer | string) {
  return createHash('sha256').update(buffer).digest('hex')
}

function validMetadata(value: unknown): value is PhotoMetadata {
  if (!value || typeof value !== 'object')
    return false
  const entry = value as Partial<PhotoMetadata>
  return typeof entry.sourceHash === 'string' && /^[a-f\d]{64}$/.test(entry.sourceHash)
    && typeof entry.blurhash === 'string' && isBlurhashValid(entry.blurhash).result
    && Number.isInteger(entry.width) && entry.width! > 0
    && Number.isInteger(entry.height) && entry.height! > 0
    && typeof entry.thumbnailFile === 'string' && /^[a-f\d]{64}\.avif$/.test(entry.thumbnailFile)
    && typeof entry.thumbnailHash === 'string' && /^[a-f\d]{64}$/.test(entry.thumbnailHash)
}

async function atomicWrite(path: string, content: Buffer | string) {
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await fs.writeFile(temporary, content, { flag: 'wx' })
    await fs.rename(temporary, path)
  }
  finally {
    await fs.rm(temporary, { force: true })
  }
}

export async function processPhotos(folder: string, entries: PhotoEntry[], check = false) {
  validateCatalog(entries)
  const cachePath = join(folder, 'generated.json')
  const thumbsFolder = join(folder, 'thumbs')
  let previous = ''
  try {
    previous = await fs.readFile(cachePath, 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error
  }
  let cache: PhotoCache = { version: photoCacheVersion, images: {} }
  try {
    const parsed = JSON.parse(previous)
    if (parsed?.version === photoCacheVersion && parsed.images && typeof parsed.images === 'object' && !Array.isArray(parsed.images))
      cache = parsed
  }
  catch {
    // Generation repairs an absent/broken cache; read-only checking rejects it.
  }

  const listed = new Set(entries.map(entry => entry.file))
  const files = new Set((await fg('**/*', {
    cwd: folder,
    onlyFiles: true,
    ignore: ['thumbs/**', '.*/**', 'node_modules/**'],
  })).filter(file => photoExtension.test(file)))
  for (const file of files) {
    if (!listed.has(file))
      console.warn(`[photos] Not in catalog (not displayed): ${file}`)
  }
  // Fail before starting any writes if a catalog input is absent.
  for (const file of listed) {
    if (!files.has(file))
      throw new Error(`[photos] Missing image: ${file}`)
  }
  if (!check)
    await fs.mkdir(thumbsFolder, { recursive: true })

  const images: Record<string, PhotoMetadata> = Object.create(null)
  const sortedEntries = [...entries].sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0)
  // Bound native encoder memory as well as JS concurrency; not 12 OS workers.
  const concurrency = Math.min(4, Math.max(1, entries.length))
  let index = 0
  let generated = 0
  async function worker() {
    while (index < sortedEntries.length) {
      const entry = sortedEntries[index++]
      const buffer = await fs.readFile(join(folder, entry.file))
      const sourceHash = hash(buffer)
      // IDs never become paths. Include source/settings versions in the name so
      // failed or concurrent rebuilds cannot corrupt the last published cache.
      const thumbnailFile = `${hash(`${photoCacheVersion}\0${photoId(entry)}\0${sourceHash}`)}.avif`
      const thumbPath = join(thumbsFolder, thumbnailFile)
      const cached = Object.hasOwn(cache.images, entry.file) ? cache.images[entry.file] : undefined
      let thumbnailHash: string | undefined
      try {
        thumbnailHash = hash(await fs.readFile(thumbPath))
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
          throw error
      }
      if (validMetadata(cached) && cached.sourceHash === sourceHash
        && cached.thumbnailFile === thumbnailFile && thumbnailHash === cached.thumbnailHash) {
        images[entry.file] = cached
        continue
      }
      if (check)
        throw new Error(`[photos] Missing or stale metadata or thumbnail: ${entry.file}. Run pnpm photos.`)

      const metadata = await sharp(buffer).metadata()
      const { width, height } = metadata.autoOrient
      // Decode the master once into a bounded, oriented sRGB raw intermediate.
      // Subsequent independent pipelines read pixels, not the encoded master.
      const pixels = await sharp(buffer).rotate().resize(800, 800, { fit: 'inside', withoutEnlargement: true }).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const resized = sharp(pixels.data, { raw: pixels.info })
      const [thumbBuffer, blur] = await Promise.all([
        resized.clone().avif({ quality: 60, effort: 5 }).toBuffer(),
        resized.clone().resize(32, 32, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true }),
      ])
      await atomicWrite(thumbPath, thumbBuffer)
      images[entry.file] = {
        sourceHash,
        width,
        height,
        thumbnailFile,
        thumbnailHash: hash(thumbBuffer),
        blurhash: encode(new Uint8ClampedArray(blur.data), blur.info.width, blur.info.height, 4, 4),
      }
      generated++
    }
  }
  // Wait for all workers before reporting errors (no writes continuing after a
  // rejected call or racing fixture cleanup).
  const results = await Promise.allSettled(Array.from({ length: concurrency }, worker))
  const failure = results.find(result => result.status === 'rejected')
  if (failure?.status === 'rejected')
    throw failure.reason

  const sortedImages = Object.fromEntries(sortedEntries.map(entry => [entry.file, images[entry.file]]))
  const output = `${JSON.stringify({ version: photoCacheVersion, images: sortedImages }, null, 2)}\n`
  const changed = output !== previous
  if (check && changed)
    throw new Error('[photos] Metadata cache is outdated. Run pnpm photos.')
  if (!check) {
    if (changed)
      await atomicWrite(cachePath, output)
    // Only prune after successful publication. Never follow arbitrary ID paths.
    const validFiles = new Set(Object.values(images).map(image => image.thumbnailFile))
    for (const file of await fg('*.avif', { cwd: thumbsFolder, onlyFiles: true })) {
      if (!validFiles.has(file))
        await fs.rm(join(thumbsFolder, file))
    }
  }
  return { count: entries.length, generated, changed }
}
