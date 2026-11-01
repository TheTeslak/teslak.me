<script setup lang="ts">
import type { Photo } from '../../../photos/data'
import { blurhashToGradientCssObject } from '@unpic/placeholder'
import { nextTick, onMounted, reactive, useTemplateRef } from 'vue'
import { openLightbox } from '~/logics/lightbox'
import { usePhotoPrefetch } from '~/logics/photo-prefetch'

const props = withDefaults(defineProps<{
  photos: Photo[]
  view?: 'cover' | 'contain'
}>(), {
  view: 'cover',
})

const loadedPhotos = reactive<Record<string, boolean>>({})
const { onPointerEnter, onPointerLeave, onFocus } = usePhotoPrefetch()

function updateCoverScale(el: HTMLImageElement) {
  if (!el || !el.naturalWidth || !el.naturalHeight)
    return
  const aspect = el.naturalWidth / el.naturalHeight
  if (Number.isFinite(aspect) && aspect > 0) {
    const scale = aspect >= 1 ? aspect : 1 / aspect
    el.style.setProperty('--cover-scale', String(Math.round(scale * 10000) / 10000))
  }
}

function onImageLoad(e: Event, name: string) {
  const img = e.target as HTMLImageElement
  updateCoverScale(img)
  loadedPhotos[name] = true
}

function onPhotoTrigger(idx: number, event: MouseEvent | KeyboardEvent) {
  openLightbox(
    props.photos.map(p => ({
      url: p.url,
      thumbnailUrl: p.thumbnailUrl,
      width: p.width,
      height: p.height,
      alt: p.text || p.name,
      title: p.text,
      name: p.name,
    })),
    idx,
    event.currentTarget as HTMLElement,
  )
}

const gridRef = useTemplateRef<HTMLElement>('gridRef')

onMounted(() => {
  nextTick(() => {
    if (!gridRef.value)
      return
    const images = gridRef.value.querySelectorAll<HTMLImageElement>('img.photo-img')
    images.forEach((img) => {
      const name = img.dataset.photoName
      if (img.complete && img.naturalWidth) {
        updateCoverScale(img)
        if (name)
          loadedPhotos[name] = true
      }
    })
  })
})
</script>

<template>
  <div
    ref="gridRef"
    class="photos grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    max-w-500 mx-auto
  >
    <div v-for="photo, idx in photos" :key="photo.name" :lang="photo.lang">
      <div
        role="button"
        tabindex="0"
        aria-haspopup="dialog"
        :aria-label="photo.text || photo.name || 'View photo'"
        class="photo-hover relative aspect-square overflow-hidden flex items-center justify-center bg-hex-8881 select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-current rounded-sm"
        @click="onPhotoTrigger(idx, $event)"
        @keydown.enter="onPhotoTrigger(idx, $event)"
        @keydown.space.prevent="onPhotoTrigger(idx, $event)"
        @pointerenter="onPointerEnter(photo, $event)"
        @pointerleave="onPointerLeave"
        @focus="onFocus(photo, $event)"
        @blur="onPointerLeave"
      >
        <div
          v-if="photo.blurhash && !loadedPhotos[photo.name]"
          class="photo-blurhash absolute inset-0 pointer-events-none z-0 transition-opacity duration-300 ease-out"
          :style="blurhashToGradientCssObject(photo.blurhash) as any"
        />
        <img
          :src="photo.thumbnailUrl || photo.url"
          :alt="photo.text ?? ''"
          :data-photo-index="idx"
          :data-photo-name="photo.name"
          :loading="idx < 4 ? 'eager' : 'lazy'"
          :fetchpriority="idx === 0 ? 'high' : 'auto'"
          decoding="async"
          class="photo-img block max-w-full max-h-full object-contain z-1"
          :class="[
            view === 'cover' ? 'photo-view-cover' : 'photo-view-contain',
            loadedPhotos[photo.name] ? 'is-loaded' : '',
          ]"
          @load="onImageLoad($event, photo.name)"
        >
      </div>
    </div>
  </div>
</template>
