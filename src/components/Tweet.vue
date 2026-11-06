<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { isDark, isThemeTransitioning } from '../logics/theme'

defineProps<{
  conversation?: 'none'
}>()

interface TwitterWidgetsWindow extends Window {
  __twitterWidgetsPromise?: Promise<void>
}

const TWITTER_SCRIPT_ID = 'twitter-widgets-script'
const TWITTER_SCRIPT_URL = 'https://platform.twitter.com/widgets.js'

function loadTwitterWidgets() {
  if (typeof window === 'undefined')
    return Promise.resolve()

  const twitterWindow = window as TwitterWidgetsWindow
  if (twitterWindow.twttr?.widgets)
    return Promise.resolve()
  if (twitterWindow.__twitterWidgetsPromise)
    return twitterWindow.__twitterWidgetsPromise

  twitterWindow.__twitterWidgetsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(TWITTER_SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Twitter widgets')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = TWITTER_SCRIPT_ID
    script.async = true
    script.src = TWITTER_SCRIPT_URL
    script.charset = 'utf-8'
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    }, { once: true })
    script.addEventListener('error', () => {
      twitterWindow.__twitterWidgetsPromise = undefined
      script.remove()
      reject(new Error('Failed to load Twitter widgets'))
    }, { once: true })

    document.head.appendChild(script)
  })

  return twitterWindow.__twitterWidgetsPromise
}

const tweet = ref<HTMLElement>()
const widgetVersion = ref(0)
const reservedHeight = ref(0)
let mounted = false
let requestedTheme = isDark.value
let generation = 0

async function renderWidget() {
  const current = ++generation
  try {
    await loadTwitterWidgets()
    if (!mounted || current !== generation)
      return
    await window.twttr?.widgets?.load(tweet.value)
    if (mounted && current === generation)
      reservedHeight.value = 0
  }
  catch (error) {
    if (current === generation)
      reservedHeight.value = 0
    console.error('[Tweet] Failed to load Twitter widgets:', error)
  }
}

onMounted(() => {
  mounted = true
  void renderWidget()
})

watch([isDark, isThemeTransitioning], async ([dark, transitioning]) => {
  if (!mounted || transitioning || dark === requestedTheme)
    return
  requestedTheme = dark
  reservedHeight.value = tweet.value?.getBoundingClientRect().height ?? 0
  widgetVersion.value++
  await nextTick()
  if (mounted)
    void renderWidget()
})

onBeforeUnmount(() => {
  mounted = false
  generation++
})
</script>

<template>
  <div ref="tweet" class="flex items-center justify-center" :style="{ minHeight: reservedHeight ? `${reservedHeight}px` : undefined }">
    <div :key="widgetVersion">
      <blockquote
        class="twitter-tweet"
        :data-theme="isDark ? 'dark' : 'light'"
        :data-conversation="conversation ? conversation : undefined"
      >
        <slot />
      </blockquote>
    </div>
  </div>
</template>

<style>
.twitter-tweet,
.twitter-tweet-rendered,
.twitter-tweet iframe,
iframe.twitter-tweet {
  background-color: transparent !important;
  color-scheme: normal;
}

.twitter-tweet iframe,
iframe.twitter-tweet {
  border-radius: 13px !important;
}
</style>
