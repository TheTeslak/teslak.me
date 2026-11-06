import { nextTick, watch } from 'vue'
import { isDark, isThemeTransitioning } from './theme'

type OptionalViewTransitionDocument = Document & {
  startViewTransition?: Document['startViewTransition']
}

let activeTransition: ViewTransition | undefined
let desiredDark: boolean | undefined
let running = false
let applyingTheme = false
let origin = { x: 0, y: 0 }

// System and other-tab changes must not leave the transition's direction stale.
watch(isDark, (dark) => {
  if (!applyingTheme && running) {
    desiredDark = dark
    activeTransition?.skipTransition()
  }
}, { flush: 'sync' })

function applyTheme(dark: boolean) {
  applyingTheme = true
  try {
    isDark.value = dark
  }
  finally {
    applyingTheme = false
  }
}

async function runTransitions() {
  running = true
  try {
    // desiredDark can change while asynchronous transitions are running.
    // eslint-disable-next-line no-unmodified-loop-condition
    while (desiredDark !== undefined && desiredDark !== isDark.value) {
      const target = desiredDark
      const start = (document as OptionalViewTransitionDocument).startViewTransition?.bind(document)
      if (!start || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        applyTheme(target)
        await nextTick()
        continue
      }

      const { x, y } = origin
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
      const root = document.documentElement
      isThemeTransitioning.value = true
      root.dataset.themeTransition = target ? 'dark' : 'light'
      try {
        // Let the decorative canvas pause before the old view is captured.
        await nextTick()
        if (desiredDark !== target)
          continue
        const transition = start(async () => {
          // A skipped transition can still run its update callback.
          if (desiredDark === target)
            applyTheme(target)
          await nextTick()
        })
        activeTransition = transition
        try {
          await transition.ready
          const circles = [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]
          root.animate({ clipPath: target ? circles.reverse() : circles }, {
            duration: 400,
            easing: target ? 'cubic-bezier(0.2, 0.8, 0.2, 1)' : 'ease-in-out',
            fill: 'forwards',
            pseudoElement: target ? '::view-transition-old(root)' : '::view-transition-new(root)',
          })
        }
        catch (error) {
          if (!(error instanceof DOMException && error.name === 'AbortError'))
            console.error('Unable to animate theme change', error)
        }
        await transition.finished.catch(() => {})
      }
      catch (error) {
        console.error('Unable to start theme change', error)
        if (desiredDark === target)
          applyTheme(target)
      }
      finally {
        activeTransition = undefined
        delete root.dataset.themeTransition
        isThemeTransitioning.value = false
      }
    }
  }
  finally {
    running = false
    desiredDark = undefined
  }
}

export function toggleDark(event: MouseEvent) {
  const button = event.currentTarget as HTMLElement | null
  const bounds = event.detail === 0 ? button?.getBoundingClientRect() : undefined
  origin = {
    x: bounds ? bounds.left + bounds.width / 2 : event.clientX,
    y: bounds ? bounds.top + bounds.height / 2 : event.clientY,
  }
  desiredDark = !(desiredDark ?? isDark.value)
  if (running)
    activeTransition?.skipTransition()
  else
    void runTransitions()
}
