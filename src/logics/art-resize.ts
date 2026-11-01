import { useEventListener } from '@vueuse/core'
import { onScopeDispose } from 'vue'

/** Coalesce resize events and also notice pixel density changes between displays. */
export function useArtResize(callback: () => void) {
  let frame = 0
  let query: MediaQueryList | undefined
  let width = window.innerWidth
  let height = window.innerHeight
  let density = window.devicePixelRatio
  const schedule = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const nextWidth = window.innerWidth
      const nextHeight = window.innerHeight
      const nextDensity = window.devicePixelRatio
      if (width === nextWidth && height === nextHeight && density === nextDensity)
        return
      width = nextWidth
      height = nextHeight
      density = nextDensity
      callback()
    })
  }
  const densityChanged = () => {
    watchDensity()
    schedule()
  }
  function watchDensity() {
    query?.removeEventListener('change', densityChanged)
    query = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    query.addEventListener('change', densityChanged)
  }
  watchDensity()
  useEventListener(window, 'resize', schedule)
  onScopeDispose(() => {
    cancelAnimationFrame(frame)
    query?.removeEventListener('change', densityChanged)
  })
}
