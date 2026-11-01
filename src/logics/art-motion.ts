import type { Ref } from 'vue'
import { useDocumentVisibility, usePreferredReducedMotion } from '@vueuse/core'
import { computed, onScopeDispose, watch } from 'vue'
import { isAnyModalOpen } from './modal-manager'

/** Apply policy immediately, including art mounted behind an already-open modal. */
export function useArtMotion(
  controls: { pause: () => void, resume: () => void },
  renderStatic: () => void,
  finished?: Readonly<Ref<boolean>>,
) {
  const preference = usePreferredReducedMotion()
  const visibility = useDocumentVisibility()
  const reducedMotion = computed(() => preference.value === 'reduce')
  const shouldAnimate = computed(() => !reducedMotion.value && visibility.value === 'visible' && !isAnyModalOpen.value && !finished?.value)
  watch(shouldAnimate, (animate) => {
    if (animate)
      controls.resume()
    else
      controls.pause()
  }, { immediate: true })
  watch(reducedMotion, (reduced) => {
    if (reduced)
      renderStatic()
  }, { immediate: true })
  onScopeDispose(() => controls.pause())
  return { reducedMotion, shouldAnimate }
}
