<script setup lang="ts">
import raw from '../../../photos/data'
import { galleryView, toggleGalleryView } from '../../logics'

const props = defineProps<{
  limit?: number
}>()

const photos = computed(() => {
  if (props.limit)
    return raw.slice(0, props.limit)
  return raw
})
</script>

<template>
  <div class="mt--4 md:mt--10 -mx-3 md:mx-0">
    <div class="relative flex items-center justify-between md:justify-center w-full max-w-500 mx-auto mb-6 z-10 slide-enter">
      <button
        class="group flex items-center gap-2 pl-0 pr-4 md:px-4 py-2 rounded-full op40 hover:op80 transition-all duration-300 outline-none select-none cursor-pointer shrink-0 text-lg md:text-xl"
        :aria-label="galleryView === 'cover' ? $t('photos-view-contain') : $t('photos-view-cover')"
        @click="toggleGalleryView"
      >
        <div
          class="text-xl md:text-2xl transition-transform duration-300 ease-out"
          :class="galleryView === 'cover' ? 'i-ri-layout-masonry-line rotate-0' : 'i-ri-grid-line rotate-180'"
        />
        <span class="transition-opacity duration-200">
          {{ galleryView === 'cover' ? $t('photos-view-contain') : $t('photos-view-cover') }}
        </span>
      </button>

      <div class="shrink-0 md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2 flex items-center">
        <Popover
          :trigger="$t('photos-status-trigger')"
          :label="$t('photos-status-label')"
          size="prose"
        >
          <p
            v-for="(paragraph, idx) in $t('photos-status-text').split(/\n\s*\n/)"
            :key="idx"
          >
            {{ paragraph.trim() }}
          </p>
        </Popover>
      </div>
    </div>
    <PhotoGrid :photos="photos" :view="galleryView" />
  </div>
</template>
