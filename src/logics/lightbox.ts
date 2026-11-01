import { computed, ref } from 'vue'

export interface LightboxItem {
  url: string
  thumbnailUrl?: string
  width: number
  height: number
  alt?: string
  title?: string
  name?: string
  classes?: string
}

export const lightboxItems = ref<LightboxItem[]>([])
export const lightboxIndex = ref(0)
export const isLightboxOpen = ref(false)
export const lightboxTriggerEl = ref<HTMLElement | null>(null)

export const currentLightboxItem = computed<LightboxItem | null>(() => {
  if (!isLightboxOpen.value || !lightboxItems.value.length)
    return null
  return lightboxItems.value[lightboxIndex.value] ?? null
})

export const canNextPhoto = computed(() => {
  return lightboxIndex.value < lightboxItems.value.length - 1
})

export const canPrevPhoto = computed(() => {
  return lightboxIndex.value > 0
})

export function openLightbox(
  items: LightboxItem[],
  initialIndex = 0,
  triggerEl: HTMLElement | null = null,
) {
  if (!items.length)
    return
  lightboxItems.value = items
  lightboxIndex.value = Math.max(0, Math.min(initialIndex, items.length - 1))
  lightboxTriggerEl.value = triggerEl
  isLightboxOpen.value = true
}

export function closeLightbox() {
  if (!isLightboxOpen.value)
    return
  isLightboxOpen.value = false
}

export function nextPhoto() {
  if (canNextPhoto.value) {
    lightboxIndex.value++
  }
}

export function prevPhoto() {
  if (canPrevPhoto.value) {
    lightboxIndex.value--
  }
}

export function setPhotoIndex(index: number) {
  if (index >= 0 && index < lightboxItems.value.length) {
    lightboxIndex.value = index
  }
}
