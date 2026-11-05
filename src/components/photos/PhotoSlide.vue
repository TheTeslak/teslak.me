<script setup lang="ts">
import type { Photo } from '../../../photos/data'
import { useTemplateRef } from 'vue'
import { openPhoto } from '~/logics/open-photo'
import { usePhotoPrefetch } from '~/logics/photo-prefetch'

const props = defineProps<{
  photos: Photo[]
}>()

const container = useTemplateRef<HTMLDivElement>('container')

function handleWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.deltaX !== 0)
    return
  if (!container.value)
    return
  if (container.value.scrollLeft <= 0 && e.deltaY <= 0)
    return
  if (container.value.scrollLeft >= container.value.scrollWidth - container.value.clientWidth && e.deltaY > 0)
    return
  const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? container.value.clientWidth : 1)
  container.value?.scrollTo({
    left: container.value.scrollLeft + delta,
  })
  e.preventDefault()
}

const { onPointerEnter, onPointerLeave, onFocus } = usePhotoPrefetch()
</script>

<template>
  <div
    ref="container"
    class="photos flex gap-4 pt3 pb1" w-screen of-x-auto
    style="margin-left: calc(var(--prose-margin) * -1); padding-left: var(--prose-margin); padding-right: var(--prose-margin);"
    @wheel="handleWheel"
  >
    <div v-for="photo, idx in photos" :key="photo.name" :lang="photo.lang">
      <button
        type="button"
        aria-haspopup="dialog"
        :aria-label="photo.text || photo.name || 'View photo'"
        class="photo-hover block p-0 border-0 bg-transparent cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-current rounded-sm"
        @click="openPhoto(props.photos, idx, $event)"
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
      </button>
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
