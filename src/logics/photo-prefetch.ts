import { useMediaQuery } from '@vueuse/core'
import { onMounted, onScopeDispose, watch } from 'vue'
import { isLightboxOpen } from './lightbox'
import { canPrefetchPhotos, getPhotoConnection, loadPhotoViewer, queuePhotoPrefetch } from './photo-loading'

/** Intentional mouse hover or keyboard focus; never speculate on restricted networks. */
export function usePhotoPrefetch() {
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)')
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancelQueued: (() => void) | undefined
  let connection: ReturnType<typeof getPhotoConnection>

  function onPointerLeave() {
    clearTimeout(timer)
    cancelQueued?.()
    cancelQueued = undefined
  }

  function prepare(photo: { url: string }) {
    onPointerLeave()
    if (!canPrefetchPhotos() || isLightboxOpen.value)
      return
    timer = setTimeout(() => {
      if (!canPrefetchPhotos() || isLightboxOpen.value)
        return
      // Warm the gesture engine in parallel; actual opening reports any failure.
      void loadPhotoViewer().catch(() => {})
      const image = new Image()
      cancelQueued = queuePhotoPrefetch(photo.url, image, () => {
        image.src = photo.url
      })
    }, 120)
  }

  function onPointerEnter(photo: { url: string }, event: PointerEvent) {
    onPointerLeave()
    if (event.pointerType === 'mouse' && canHover.value)
      prepare(photo)
  }

  function onFocus(photo: { url: string }, event: FocusEvent) {
    if ((event.currentTarget as HTMLElement).matches(':focus-visible'))
      prepare(photo)
  }

  watch(isLightboxOpen, (open) => {
    if (open)
      onPointerLeave()
  })
  onMounted(() => {
    connection = getPhotoConnection()
    connection?.addEventListener?.('change', onPointerLeave)
    document.addEventListener('visibilitychange', onPointerLeave)
  })
  onScopeDispose(() => {
    onPointerLeave()
    connection?.removeEventListener?.('change', onPointerLeave)
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', onPointerLeave)
  })
  return { onPointerEnter, onPointerLeave, onFocus }
}
