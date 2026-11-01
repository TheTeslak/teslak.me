# Photos

`catalog.ts` is the manually edited list. Its array order is gallery order; ratings
never change that order. Only listed files appear in the gallery. Add an image to
this directory, add its exact relative filename to the catalog, then run
`pnpm photos`. Commit the image, catalog and `generated.json` together.

Supported formats: JPEG (`jpg`/`jpeg`), PNG, WebP and AVIF, with case-insensitive
extensions. Spaces, Unicode filenames and subdirectories are supported. Original
files are never renamed, recompressed or deleted by the metadata command.
`thumbs/` is reserved for generated derivatives, not catalog inputs.

```ts
const photo = { file: 'osaka-night.jpg', text: '大阪 Osaka', lang: 'ja', rating: 5 }
```

Only `file` is required. `rating` is an integer from 1 to 10; absence means unrated.
`text` is the caption and accessible image text. When omitted, images receive an
empty alt attribute. `lang` is a language tag for that text, independent of the
page locale. Captions appear below slides and in the lightbox.

Article IDs default to the relative filename without its extension. Changing
`osaka-night.jpg` to `osaka-night.avif` preserves its ID. To rename the basename,
set `id: 'osaka-night'` before changing `file`. IDs must be unique. Two entries
with the same basename and different extensions need explicit distinct IDs.

```html
<PhotoShowcase ids="tower,mountains" mode="slide" />
<PhotoShowcase :limit="4" />
```

Explicit selections follow `ids` order. Without `ids`, catalog order applies.
Missing IDs fail rendering rather than silently omitting requested photos.

`generated.json` is a committed machine-generated cache, keyed by the complete
filename. Metadata v2 records oriented original dimensions, source SHA-256,
Blurhash, derivative filename and derivative SHA-256. Bump `photoCacheVersion`
in `model.ts` when changing the generation algorithm/settings.

The generator decodes each original into an oriented, sRGB raw intermediate with
an 800 px maximum edge (no enlargement). Independent AVIF (quality 60, effort 5)
and 32 px Blurhash pipelines use those pixels. Four bounded asynchronous jobs
limit native encoder memory. Logical IDs never become paths: flat SHA-256
filenames incorporate the cache version, ID and source hash.

- `pnpm photos`: regenerate missing/stale/corrupt derivatives and metadata; prune
  unused previews after successful publication. Derivatives are ignored by Git.
- `pnpm dev` / `pnpm build`: generate derivatives automatically before use, so a
  checkout without `thumbs/` works. Commit updated metadata with catalog changes.
- `pnpm check:photos`: read-only source/cache/derivative-integrity validation.
- `pnpm test:photos`: isolated fixtures, including JPEG/PNG/WebP/AVIF, nested paths,
  path-like IDs, original preservation, missing/corrupt previews and cache versions.
- `pnpm test:mobile`: complete catalog preview checks plus browser regressions;
  install Chromium first with `pnpm exec playwright install chromium`.

Vite discovers originals recursively excluding `thumbs/`, imports previews
separately and hashes production asset URLs. Production assembly rejects missing
preview imports instead of silently downloading originals as grid thumbnails.
PhotoSwipe uses original dimensions to keep preview/original display geometry
stable. See `../MOBILE_AUDIT.md` for implementation decisions and device checks.

Unlisted image files produce warnings and are not added automatically. The
metadata file is replaced atomically only when its contents change. Reordering
the catalog does not rewrite this cache. Keep originals/backups outside this
folder: Vite discovers image assets here even when they are not listed.

## Planned AVIF conversion command (not implemented)

1. Accept explicit source files or a separate originals directory and an output
   directory. Default to a dry run showing dimensions, sizes and target paths.
2. Use the existing Sharp dependency; apply EXIF orientation and convert colour
   consistently before stripping private metadata. Preserve transparency. Reject
   animated inputs unless animation handling is explicitly designed.
3. Expose quality, effort and maximum dimensions; do not upscale. Choose defaults
   after comparing representative night shots, gradients, foliage and fine detail
   at full size, rather than relying on one universal quality value.
4. Bound concurrency and write each result to a temporary file. Decode and verify
   the resulting AVIF before its atomic final rename. Never overwrite an existing
   output or delete an original by default. Skip existing AVIF inputs.
5. Report size savings per image, including larger outputs and encoding failures.
   Do not replace sources when the output is larger without explicit intent.
6. Store source hashes plus encoder/settings versions in a separate conversion
   manifest so reruns skip unchanged work and changed settings regenerate output.
7. Keep conversion separate from publication: review results first, then change
   only `file` in the photo catalog, preserving IDs, order and manual fields.
   Run `pnpm photos`, `pnpm check:photos` and the build after switching files.
8. Decide separately whether older-client fallbacks and responsive image variants
   are needed; that requires a different asset model rather than silently adding
   a second gallery entry for the same photograph.
