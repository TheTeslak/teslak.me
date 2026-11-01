import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { join } from 'node:path'
// eslint-disable-next-line test/no-import-node-test
import { it } from 'node:test'
import sharp from 'sharp'
import { catalog } from '../photos/catalog'
import { closeModal, isAnyModalOpen, isModalOpen, openModal, topModalId, unregisterModal } from '../src/logics/modal-manager'
import { processPhotos } from './photos-metadata'

it('modal stack is idempotent and closing a lower layer preserves the top', () => {
  assert.equal(isAnyModalOpen.value, false)
  openModal('first')
  openModal('first')
  openModal('second')
  closeModal('first')
  assert.equal(topModalId.value, 'second')
  assert.equal(isModalOpen('first'), false)
  assert.equal(isAnyModalOpen.value, true)
  unregisterModal('second')
  closeModal('second')
  assert.equal(topModalId.value, null)
  assert.equal(isAnyModalOpen.value, false)
})

it('every catalog derivative is valid, bounded, current and reduces total payload', async () => {
  await processPhotos(join(process.cwd(), 'photos'), catalog, true)
  const cache = JSON.parse(await fs.readFile('photos/generated.json', 'utf8'))
  const expected = new Set<string>()
  let originalBytes = 0
  let thumbnailBytes = 0
  for (const entry of catalog) {
    const image = cache.images[entry.file]
    expected.add(image.thumbnailFile)
    const path = join('photos', 'thumbs', image.thumbnailFile)
    const stat = await fs.stat(path)
    const metadata = await sharp(path).metadata()
    assert.equal(metadata.format, 'heif', entry.file)
    assert.ok(metadata.width && metadata.height, entry.file)
    assert.ok(Math.max(metadata.width, metadata.height) <= 800, entry.file)
    assert.ok(stat.size > 0 && stat.size <= 256 * 1024, `${entry.file}: ${stat.size} bytes`)
    const expectedHeight = metadata.width * image.height / image.width
    assert.ok(Math.abs(expectedHeight - metadata.height) <= 2, `Aspect ratio: ${entry.file}`)
    originalBytes += (await fs.stat(join('photos', entry.file))).size
    thumbnailBytes += stat.size
  }
  const actual = new Set((await fs.readdir('photos/thumbs')).filter(file => file.endsWith('.avif')))
  assert.deepEqual(actual, expected)
  assert.ok(thumbnailBytes < originalBytes * 0.2, `Preview payload ${thumbnailBytes}/${originalBytes}`)
})
