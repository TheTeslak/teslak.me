<script setup lang="ts">
import type PhotoSwipe from 'photoswipe'
import { usePreferredReducedMotion } from '@vueuse/core'
import { useFluent } from 'fluent-vue'
import { nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import {
  closeLightbox,
  currentLightboxItem,
  isLightboxOpen,
  lightboxIndex,
  lightboxItems,
  lightboxTriggerEl,
  setPhotoIndex,
} from '~/logics/lightbox'
import { useModal } from '~/logics/modal-manager'
import { loadPhotoViewer } from '~/logics/photo-loading'
import { configurePhotoLoading } from '~/logics/photo-viewer-loading'
import 'photoswipe/style.css'

const fluent = useFluent()
const lightboxEl = useTemplateRef<HTMLElement>('lightboxEl')
const reducedMotion = usePreferredReducedMotion()
const loadFailed = ref(false)
const ready = ref(false)
const route = useRoute()
let gallery: PhotoSwipe | undefined

useModal({
  id: 'lightbox',
  open: isLightboxOpen,
  element: lightboxEl,
  trigger: () => lightboxTriggerEl.value,
  onClose: closeLightbox,
})
watch(() => route.path, closeLightbox)

watch(isLightboxOpen, async (open, _, onCleanup) => {
  let cancelled = false
  let disposeLoading: (() => void) | undefined
  onCleanup(() => {
    cancelled = true
    disposeLoading?.()
  })
  if (!open) {
    gallery?.close()
    gallery = undefined
    return
  }
  loadFailed.value = false
  ready.value = false
  try {
    // Keep the gesture engine out of the initial application bundle.
    const { default: Viewer } = await loadPhotoViewer()
    await nextTick()
    if (cancelled || !lightboxEl.value)
      return
    const viewer = new Viewer({
      appendToEl: lightboxEl.value,
      dataSource: lightboxItems.value.map(item => ({
        src: item.url,
        msrc: item.thumbnailUrl || item.url,
        width: item.width,
        height: item.height,
        alt: item.alt || '',
      })),
      index: lightboxIndex.value,
      loop: false,
      bgOpacity: 0.94,
      counter: false,
      showHideAnimationType: 'fade',
      showAnimationDuration: reducedMotion.value === 'reduce' ? 0 : 180,
      hideAnimationDuration: reducedMotion.value === 'reduce' ? 0 : 180,
      zoomAnimationDuration: reducedMotion.value === 'reduce' ? 0 : 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      // Fit the composition to the viewport; controls overlay rather than
      // reserving space around the image. Portraits can use the full height.
      padding: { top: 0, bottom: 0, left: 0, right: 0 },
      allowPanToNext: true,
      closeOnVerticalDrag: true,
      pinchToClose: true,
      secondaryZoomLevel: levels => levels.fit * 2.2,
      maxZoomLevel: levels => Math.max(1, levels.fit * 3.5),
      preload: [1, 1],
      // One shared owner for focus, Escape, scroll position and isolation.
      trapFocus: false,
      returnFocus: false,
      escKey: false,
      imageClickAction: 'zoom',
      tapAction: false,
      doubleTapAction: 'zoom',
      bgClickAction: 'close',
      closeTitle: fluent.format('nav-close'),
      zoomTitle: fluent.format('image-zoom'),
      arrowPrevTitle: fluent.format('image-previous'),
      arrowNextTitle: fluent.format('image-next'),
      errorMsg: fluent.format('image-load-error'),
      closeSVG: '<span class="photo-viewer-icon i-lucide-x" aria-hidden="true"></span>',
      arrowPrevSVG: '<span class="photo-viewer-icon i-lucide-chevron-left" aria-hidden="true"></span>',
      arrowNextSVG: '<span class="photo-viewer-icon i-lucide-chevron-right" aria-hidden="true"></span>',
      zoomSVG: '<span class="photo-viewer-icon photo-viewer-zoom-in i-lucide-zoom-in" aria-hidden="true"></span><span class="photo-viewer-icon photo-viewer-zoom-out i-lucide-zoom-out" aria-hidden="true"></span>',
    })
    gallery = viewer
    disposeLoading = configurePhotoLoading(viewer)
    // Use cached thumbnails for incoming slides, not only the initial slide.
    viewer.addFilter('placeholderSrc', (_, content) => lightboxItems.value[content.index]?.thumbnailUrl || false)
    viewer.on('contentAppend', ({ content }) => {
      const classes = lightboxItems.value[content.index]?.classes?.split(/\s+/).filter(Boolean) ?? []
      content.element?.classList.add(...classes)
      content.placeholder?.element?.classList.add(...classes)
    })
    viewer.on('loadComplete', ({ content, isError }) => {
      if (!isError)
        content.element?.classList.add('photo-viewer-loaded')
    })
    viewer.on('change', () => setPhotoIndex(viewer.currIndex))
    viewer.on('openingAnimationEnd', () => viewer.element?.setAttribute('data-ready', 'true'))
    viewer.on('close', closeLightbox)
    viewer.on('destroy', () => {
      if (gallery === viewer)
        gallery = undefined
    })
    viewer.init()
    // The Vue shell is the named dialog; PhotoSwipe supplies its carousel.
    viewer.element?.setAttribute('role', 'group')
    ready.value = true
  }
  catch (error) {
    disposeLoading?.()
    if (!cancelled) {
      loadFailed.value = true
      console.error('Unable to open image viewer', error)
    }
  }
})

watch(reducedMotion, (preference) => {
  if (gallery) {
    gallery.options.hideAnimationDuration = preference === 'reduce' ? 0 : 180
    gallery.options.zoomAnimationDuration = preference === 'reduce' ? 0 : 200
  }
})

watch(lightboxIndex, (index) => {
  if (gallery && gallery.currIndex !== index)
    gallery.goTo(index)
})

onBeforeUnmount(() => {
  gallery?.destroy()
  closeLightbox()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="isLightboxOpen"
        ref="lightboxEl"
        class="photo-lightbox-overlay"
        data-modal-layer
        :data-photo-index="lightboxIndex"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('a11y-image-preview')"
        tabindex="-1"
      >
        <span class="photo-lightbox-position sr-only" role="status" aria-live="polite" aria-atomic="true">{{ lightboxIndex + 1 }} / {{ lightboxItems.length }}</span>
        <div v-if="!ready" class="photo-lightbox-loading">
          <a v-if="loadFailed" :href="currentLightboxItem?.url" target="_blank" rel="noopener noreferrer">{{ $t('image-open-original') }}</a>
          <span v-else role="status">{{ $t('image-loading') }}</span>
          <button type="button" @click="closeLightbox">
            {{ $t('nav-close') }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.photo-lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-lightbox, 500);
  overscroll-behavior: contain;
}

.photo-lightbox-loading {
  position: absolute;
  inset: 0;
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--c-bg) 94%, transparent);
  color: inherit;
}

.photo-lightbox-loading button {
  min-width: 44px;
  min-height: 44px;
}

.photo-lightbox-overlay .pswp {
  --pswp-bg: var(--c-bg);
  --pswp-error-text-color: currentColor;
}

.photo-lightbox-overlay .pswp__button {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 50%;
  background: var(--c-bg);
  box-shadow: none;
  color: inherit;
  opacity: 1;
  transition:
    background 0.3s ease,
    color 0.3s ease,
    opacity 0.3s ease;
  -webkit-tap-highlight-color: transparent;
}

.photo-lightbox-overlay .pswp__button:hover,
.photo-lightbox-overlay .pswp__button:active {
  background: #eee;
  color: #18181b;
  opacity: 1;
}

.photo-lightbox-overlay .pswp__button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
  opacity: 1;
}

.photo-lightbox-overlay .photo-viewer-icon {
  position: static;
  display: block;
  width: 24px;
  height: 24px;
  margin: 0;
  transform: none;
  color: inherit;
  pointer-events: none;
}

/* Reset inherited PhotoSwipe arrow offsets instead of clipping its old SVGs. */
.photo-lightbox-overlay .pswp__button--arrow {
  position: absolute;
  top: 50%;
  margin: 0;
  transform: translateY(-50%);
  visibility: visible;
}

.photo-lightbox-overlay .pswp__button--arrow--prev {
  left: max(12px, env(safe-area-inset-left, 0px));
  right: auto;
}

.photo-lightbox-overlay .pswp__button--arrow--next {
  right: max(12px, env(safe-area-inset-right, 0px));
  left: auto;
}

.photo-lightbox-overlay .pswp__button--arrow:disabled {
  display: none;
}

.photo-lightbox-overlay .pswp__top-bar {
  height: auto;
  gap: 8px;
  padding: max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) 0
    max(12px, env(safe-area-inset-left, 0px));
}

.photo-lightbox-overlay .pswp__button--zoom,
.photo-lightbox-overlay .photo-viewer-zoom-out {
  display: none;
}

@media (min-width: 768px) and (hover: hover) and (pointer: fine) {
  .photo-lightbox-overlay .pswp--zoom-allowed .pswp__button--zoom {
    display: grid;
  }
}

.photo-lightbox-overlay .pswp--zoomed-in .photo-viewer-zoom-in {
  display: none;
}

.photo-lightbox-overlay .pswp--zoomed-in .photo-viewer-zoom-out {
  display: block;
}

.photo-lightbox-overlay .pswp__img:not(.pswp__img--placeholder):not(.photo-viewer-loaded) {
  opacity: 0;
}

.photo-lightbox-overlay .photo-viewer-loaded {
  animation: photo-lightbox-reveal 180ms ease-out;
}

@keyframes photo-lightbox-reveal {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .photo-lightbox-overlay .photo-viewer-loaded {
    animation: none;
  }
}
</style>
