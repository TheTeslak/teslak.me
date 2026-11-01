import type PhotoSwipe from 'photoswipe'
import type { PhotoSwipeEventsMap } from 'photoswipe'
import { canPrefetchPhotos, getPhotoConnection, prioritizePhoto, queuePhotoPrefetch } from './photo-loading'

type Content = PhotoSwipeEventsMap['contentLoadImage']['content']

/** Gate native image requests too: preload: [0, 0] alone does not stop holder loads. */
export function configurePhotoLoading(viewer: PhotoSwipe) {
  const deferred = new Map<Content, () => void>()
  const permitted = new WeakSet<Content>()
  const connection = getPhotoConnection()
  let closed = false

  function load(content: Content, priority: 'high' | 'low') {
    const image = content.element
    if (closed || !(image instanceof HTMLImageElement))
      return
    deferred.get(content)?.()
    deferred.delete(content)
    image.fetchPriority = priority
    image.decoding = 'async'
    permitted.add(content)
    try {
      content.loadImage(priority === 'low')
    }
    finally {
      permitted.delete(content)
    }
  }

  function enqueue(content: Content) {
    deferred.get(content)?.()
    deferred.set(content, () => {})
    const image = content.element
    if (closed || !canPrefetchPhotos() || !(image instanceof HTMLImageElement)
      || Math.abs(content.index - viewer.currIndex) !== 1 || !content.data.src) {
      return
    }
    deferred.set(content, queuePhotoPrefetch(content.data.src, image, () => load(content, 'low')))
  }

  function refresh() {
    for (const content of deferred.keys()) {
      if (content.index === viewer.currIndex) {
        if (content.data.src)
          prioritizePhoto(content.data.src)
        load(content, 'high')
      }
      else {
        // Rebuild only the adjacent window; leave obsolete queued work cancelled.
        enqueue(content)
      }
    }
  }

  viewer.on('contentLoadImage', (event) => {
    const { content } = event
    const image = content.element
    if (!(image instanceof HTMLImageElement) || permitted.has(content))
      return
    if (content.index === viewer.currIndex) {
      deferred.get(content)?.()
      deferred.delete(content)
      if (content.data.src)
        prioritizePhoto(content.data.src)
      image.fetchPriority = 'high'
      image.decoding = 'async'
      return
    }
    event.preventDefault()
    if (!deferred.has(content))
      enqueue(content)
  })

  // Keep previews/spinner truthful while an original is waiting for permission.
  viewer.addFilter('isContentLoading', (loading, content) => loading || deferred.has(content))
  viewer.on('contentActivate', ({ content }) => {
    const image = content.element
    if (content.data.src)
      prioritizePhoto(content.data.src)
    if (image instanceof HTMLImageElement) {
      image.fetchPriority = 'high'
      if (deferred.has(content))
        load(content, 'high')
    }
  })
  viewer.on('contentDeactivate', ({ content }) => {
    if (content.element instanceof HTMLImageElement)
      content.element.fetchPriority = 'low'
  })
  viewer.on('contentDestroy', ({ content }) => {
    deferred.get(content)?.()
    deferred.delete(content)
  })
  viewer.on('change', refresh)

  function dispose() {
    if (closed)
      return
    closed = true
    for (const cancel of deferred.values())
      cancel()
    deferred.clear()
    connection?.removeEventListener?.('change', refresh)
    document.removeEventListener('visibilitychange', refresh)
  }

  connection?.addEventListener?.('change', refresh)
  document.addEventListener('visibilitychange', refresh)
  viewer.on('close', dispose)
  viewer.on('destroy', dispose)
  return dispose
}
