import type { LightboxItem } from './lightbox'

// PhotoSwipe expects the full image rectangle and, for cropped thumbnails,
// the visible rectangle with its offset relative to the full image.
export function getPhotoThumbBounds(trigger: HTMLElement | null, index: number, item: LightboxItem, minVisibleFraction?: number) {
  if (!trigger?.isConnected)
    return

  const gallery = trigger.closest('.photos')
  const image = gallery
    ? gallery.querySelector<HTMLImageElement>(`img[data-photo-index="${index}"]`)
    : trigger instanceof HTMLImageElement ? trigger : null
  if (!image?.isConnected || !image.complete || !image.naturalWidth || !image.naturalHeight)
    return

  // An updated gallery can reuse the same index for a different image.
  const expectedSrc = new URL(item.thumbnailUrl || item.url, document.baseURI).href
  if (image.currentSrc !== expectedSrc && image.src !== expectedSrc)
    return

  const style = getComputedStyle(image)
  if (style.visibility !== 'visible' || Number(style.opacity) === 0)
    return
  const box = image.getBoundingClientRect()
  if (!box.width || !box.height || !item.width || !item.height)
    return

  const ratio = item.width / item.height
  let width = box.width
  let height = box.height
  if (style.objectFit === 'cover' || style.objectFit === 'contain') {
    const scale = style.objectFit === 'cover'
      ? Math.max(box.width / item.width, box.height / item.height)
      : Math.min(box.width / item.width, box.height / item.height)
    width = item.width * scale
    height = item.height * scale
    // Non-centred object positioning needs a different calculation.
    if (style.objectPosition !== '50% 50%' && (Math.abs(width - box.width) > 1 || Math.abs(height - box.height) > 1))
      return
  }
  else if (Math.abs(box.width / box.height - ratio) > 0.02) {
    return
  }

  const left = box.left + (box.width - width) / 2
  const top = box.top + (box.height - height) / 2
  let visibleLeft = Math.max(left, box.left)
  let visibleTop = Math.max(top, box.top)
  let visibleRight = Math.min(left + width, box.right)
  let visibleBottom = Math.min(top + height, box.bottom)
  let referenceArea = (visibleRight - visibleLeft) * (visibleBottom - visibleTop)

  // Include clipping by the square grid cell and the horizontal photo strip.
  for (let parent = image.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const parentStyle = getComputedStyle(parent)
    const rect = parent.getBoundingClientRect()
    if (/^(?:hidden|clip|auto|scroll)$/.test(parentStyle.overflowX)) {
      visibleLeft = Math.max(visibleLeft, rect.left)
      visibleRight = Math.min(visibleRight, rect.right)
    }
    if (/^(?:hidden|clip|auto|scroll)$/.test(parentStyle.overflowY)) {
      visibleTop = Math.max(visibleTop, rect.top)
      visibleBottom = Math.min(visibleBottom, rect.bottom)
    }
    // The gallery button defines the intended crop; only clipping beyond it
    // counts against how much of the thumbnail is visible.
    if (gallery && parent === image.parentElement)
      referenceArea = Math.max(0, visibleRight - visibleLeft) * Math.max(0, visibleBottom - visibleTop)
  }

  if (minVisibleFraction === undefined) {
    // Keep the existing opening behavior for partly offscreen thumbnails.
    if (visibleLeft < 0 || visibleTop < 0 || visibleRight > window.innerWidth || visibleBottom > window.innerHeight)
      return
  }
  else {
    visibleLeft = Math.max(0, visibleLeft)
    visibleTop = Math.max(0, visibleTop)
    visibleRight = Math.min(window.innerWidth, visibleRight)
    visibleBottom = Math.min(window.innerHeight, visibleBottom)
  }
  const visibleArea = Math.max(0, visibleRight - visibleLeft) * Math.max(0, visibleBottom - visibleTop)
  if (!visibleArea || !referenceArea || (minVisibleFraction !== undefined && visibleArea / referenceArea < minVisibleFraction)) {
    return
  }

  const bounds = { x: left, y: top, w: width }
  if (Math.abs(visibleLeft - left) < 1 && Math.abs(visibleTop - top) < 1
    && Math.abs(visibleRight - left - width) < 1 && Math.abs(visibleBottom - top - height) < 1) {
    return bounds
  }

  return {
    ...bounds,
    innerRect: {
      x: left - visibleLeft,
      y: top - visibleTop,
      w: visibleRight - visibleLeft,
      h: visibleBottom - visibleTop,
    },
  }
}
