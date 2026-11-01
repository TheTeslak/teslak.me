<script setup lang="ts">
import type { Photo } from '../../../photos/data'
import { useTemplateRef } from 'vue'
import { openLightbox } from '~/logics/lightbox'
import { usePhotoPrefetch } from '~/logics/photo-prefetch'

const props = defineProps<{
  photos: Photo[]
}>()

const container = useTemplateRef<HTMLDivElement>('container')
let hasHorizontalScroll = false

function handleWheel(e: WheelEvent) {
  if (hasHorizontalScroll)
    return
  if (e.deltaX !== 0) {
    hasHorizontalScroll = true
    return
  }
  if (!container.value)
    return
  if (container.value.scrollLeft <= 0 && e.deltaY <= 0)
    return
  if (container.value.scrollLeft >= container.value.scrollWidth - container.value.clientWidth && e.deltaY > 0)
    return
  // change vertical scroll to horizontal scroll
  container.value?.scrollTo({
    left: container.value.scrollLeft + e.deltaY,
  })
  e.preventDefault()
}

const { onPointerEnter, onPointerLeave, onFocus } = usePhotoPrefetch()

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
</script>

<template>
  <div
    ref="container"
    class="photos flex gap-4 pt3 pb1" w-screen of-x-auto
    style="margin-left: calc(var(--prose-margin) * -1); padding-left: var(--prose-margin); padding-right: var(--prose-margin);"
    @wheel="handleWheel"
  >
    <div v-for="photo, idx in photos" :key="photo.name" :lang="photo.lang">
      <div
        role="button"
        tabindex="0"
        aria-haspopup="dialog"
        :aria-label="photo.text || photo.name || 'View photo'"
        class="photo-hover cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-current rounded-sm"
        @click="onPhotoTrigger(idx, $event)"
        @keydown.enter="onPhotoTrigger(idx, $event)"
        @keydown.space.prevent="onPhotoTrigger(idx, $event)"
        @pointerenter="onPointerEnter(photo, $event)"
        @pointerleave="onPointerLeave"
        @focus="onFocus(photo, $event)"
        @blur="onPointerLeave"
      >
        <img
          :src="photo.thumbnailUrl || photo.url"
          :alt="photo.text ?? ''"
          :data-photo-index="idx"
          :loading="idx < 4 ? 'eager' : 'lazy'"
          :fetchpriority="idx === 0 ? 'high' : 'auto'"
          decoding="async"
          w-full aspect-square object-cover
          class="photo-slide-image"
        >
      </div>
      <div v-if="photo.text" text-sm op75 mt2>
        {{ photo.text }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.photo-slide-image {
  width: min(20rem, calc(100vw - 3.5rem));
  height: auto;
  aspect-ratio: 1;
  object-fit: cover;
}
</style>

<style scoped>
.photos::-webkit-scrollbar {
  display: none;
}
.photos {
  scrollbar-width: none;
}
</style>
