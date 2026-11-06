import { useColorMode } from '@vueuse/core'
import { computed, ref } from 'vue'

// Keep the bootstrap script in index.html in sync with this storage key and modes.
const mode = useColorMode({ modes: { light: '', dark: 'dark' } })

export const isDark = computed({
  get: () => mode.value === 'dark',
  // useDark() writes "auto" when the choice matches the system. A manual
  // selection should instead remain stable when the system setting changes.
  set: (dark: boolean) => { mode.store.value = dark ? 'dark' : 'light' },
})

export const isThemeTransitioning = ref(false)
