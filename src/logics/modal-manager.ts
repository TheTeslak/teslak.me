import type { Ref } from 'vue'
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'

interface ModalRegistration {
  id: string
  onClose?: () => void
  returnFocusEl: HTMLElement | null
  element?: HTMLElement | null
  layer?: HTMLElement
  originalZIndex?: string
}

const activeModals = ref<string[]>([])
const registrations = new Map<string, ModalRegistration>()
export const isAnyModalOpen = computed(() => activeModals.value.length > 0)
export const topModalId = computed(() => activeModals.value.at(-1) ?? null)
const inertElements = new Map<HTMLElement, boolean>()
let unlockDocument: (() => void) | undefined
let observer: MutationObserver | undefined

function topModal() {
  return registrations.get(topModalId.value ?? '')
}

function focusInside(modal = topModal()) {
  const element = modal?.element
  if (element?.isConnected && !element.contains(document.activeElement))
    element.focus({ preventScroll: true })
}

function focusableElements(element: HTMLElement) {
  return [...element.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter(el => el.tabIndex >= 0 && el.getClientRects().length > 0 && !el.closest('[inert]'))
}

function onKeydown(event: KeyboardEvent) {
  const modal = topModal()
  if (!modal)
    return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopImmediatePropagation()
    // Close the registration even if a consumer forgets to update its binding.
    modal.onClose?.()
    closeModal(modal.id)
  }
  else if (event.key === 'Tab' && modal.element) {
    const elements = focusableElements(modal.element)
    const first = elements[0]
    const last = elements.at(-1)
    const active = document.activeElement
    if (!first) {
      event.preventDefault()
      modal.element.focus({ preventScroll: true })
    }
    else if (event.shiftKey && (active === first || !elements.includes(active as HTMLElement))) {
      event.preventDefault()
      last?.focus({ preventScroll: true })
    }
    else if (!event.shiftKey && (active === last || !elements.includes(active as HTMLElement))) {
      event.preventDefault()
      first.focus({ preventScroll: true })
    }
  }
}

function onFocusin() {
  focusInside()
}

function restoreInert() {
  for (const [element, previous] of inertElements)
    element.inert = previous
  inertElements.clear()
}

function updateIsolation() {
  const element = topModal()?.element
  if (!element?.isConnected)
    return
  restoreInert()
  // Isolate siblings at every ancestor, including the app header and lower
  // teleported dialogs. The active layer includes its clickable backdrop.
  let branch = element.closest<HTMLElement>('[data-modal-layer]') ?? element
  while (branch !== document.body && branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (sibling !== branch && sibling instanceof HTMLElement) {
        inertElements.set(sibling, sibling.inert)
        sibling.inert = true
      }
    }
    branch = branch.parentElement
  }
}

function updateLayers() {
  let previousZIndex = 0
  for (const id of activeModals.value) {
    const modal = registrations.get(id)
    if (!modal?.layer)
      continue
    modal.layer.style.zIndex = modal.originalZIndex ?? ''
    const base = Number.parseInt(getComputedStyle(modal.layer).zIndex) || 400
    previousZIndex = Math.max(base, previousZIndex + 2)
    modal.layer.style.zIndex = String(previousZIndex)
  }
}

function syncDocument() {
  if (typeof document === 'undefined')
    return
  if (isAnyModalOpen.value && !unlockDocument) {
    const html = document.documentElement
    const body = document.body
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const previous = { htmlOverflow: html.style.overflow, bodyOverflow: body.style.overflow, paddingRight: body.style.paddingRight }
    const scrollbarWidth = window.innerWidth - html.clientWidth
    if (scrollbarWidth > 0)
      body.style.paddingRight = `${Number.parseFloat(getComputedStyle(body).paddingRight) + scrollbarWidth}px`
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeydown, true)
    document.addEventListener('focusin', onFocusin, true)
    observer = new MutationObserver(updateIsolation)
    observer.observe(body, { childList: true, subtree: true })
    unlockDocument = () => {
      observer?.disconnect()
      document.removeEventListener('keydown', onKeydown, true)
      document.removeEventListener('focusin', onFocusin, true)
      restoreInert()
      html.style.overflow = previous.htmlOverflow
      body.style.overflow = previous.bodyOverflow
      body.style.paddingRight = previous.paddingRight
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' })
    }
  }
  if (!isAnyModalOpen.value) {
    unlockDocument?.()
    unlockDocument = undefined
  }
  else {
    updateLayers()
    updateIsolation()
  }
}

export function openModal(id: string, triggerEl?: HTMLElement | null, onClose?: () => void) {
  if (isModalOpen(id))
    return
  registrations.set(id, {
    id,
    onClose,
    returnFocusEl: triggerEl ?? (typeof document !== 'undefined' ? document.activeElement as HTMLElement : null),
  })
  activeModals.value.push(id)
  syncDocument()
}

export function setModalElement(id: string, element: HTMLElement | null) {
  const modal = registrations.get(id)
  if (!modal)
    return
  modal.element = element
  const layer = element?.closest<HTMLElement>('[data-modal-layer]') ?? element
  if (layer && modal.layer !== layer) {
    modal.layer = layer
    modal.originalZIndex = layer.style.zIndex
  }
  syncDocument()
  if (id === topModalId.value)
    focusInside(modal)
}

export function closeModal(id: string) {
  const index = activeModals.value.indexOf(id)
  if (index === -1)
    return
  const wasTop = id === topModalId.value
  const modal = registrations.get(id)
  activeModals.value.splice(index, 1)
  registrations.delete(id)
  if (modal?.layer)
    modal.layer.style.zIndex = modal.originalZIndex ?? ''
  syncDocument()
  if (wasTop && typeof document !== 'undefined') {
    nextTick(() => {
      const trigger = modal?.returnFocusEl
      const top = topModal()
      if (trigger?.isConnected && trigger.getClientRects().length > 0 && !trigger.closest('[inert]') && (!top || top.element?.contains(trigger)))
        trigger.focus({ preventScroll: true })
      else if (top)
        focusInside(top)
      else
        document.getElementById('main-content')?.focus({ preventScroll: true })
    })
  }
}

export function unregisterModal(id: string) {
  closeModal(id)
}

export function isModalOpen(id: string) {
  return activeModals.value.includes(id)
}

/** A single visibility binding owns every opening/closing path and cleanup. */
export function useModal(options: {
  id: string
  open: Readonly<Ref<boolean>>
  element: Readonly<Ref<HTMLElement | null | undefined>>
  trigger?: () => HTMLElement | null | undefined
  onClose: () => void
}) {
  watch(options.open, (open) => {
    if (open)
      openModal(options.id, options.trigger?.(), options.onClose)
    else
      closeModal(options.id)
  }, { immediate: true, flush: 'sync' })
  watch([options.open, options.element], ([open, element]) => {
    if (open)
      setModalElement(options.id, element ?? null)
  }, { flush: 'post' })
  onScopeDispose(() => unregisterModal(options.id))
}
