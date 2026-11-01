<script setup lang="ts">
import { useHead } from '@unhead/vue'
import PhotoLightbox from '~/components/photos/PhotoLightbox.vue'
import { getFeedName, getLanguageTag, localeConfig } from '~/locales/config'
import { getLocaleFromPath } from '~/logics/i18n-path'
import { useKeyboardNav } from '~/logics/keyboard-nav'
import { openLightbox } from '~/logics/lightbox'
import { useSEO } from '~/logics/seo'
import { siteOrigin } from '~/logics/site'

const route = useRoute()

useKeyboardNav()
useSEO(computed(() => (route.meta.frontmatter as Record<string, any>) || {}))

const currentLocale = computed(() => getLocaleFromPath(route.path))
// The document shell follows the URL; fallback article content declares its own language.
const currentLanguageTag = computed(() => getLanguageTag(currentLocale.value))
const currentFeedName = computed(() => getFeedName(currentLocale.value))
const currentFeedTitle = computed(() => localeConfig[currentLocale.value].feedTitle)

function getFeedHref(extension: 'atom' | 'json' | 'xml') {
  return `${siteOrigin}/${currentFeedName.value}.${extension}`
}

useHead(() => ({
  htmlAttrs: {
    lang: currentLanguageTag.value,
  },
  link: [
    {
      rel: 'alternate',
      type: 'application/atom+xml',
      title: `${currentFeedTitle.value} Atom`,
      href: getFeedHref('atom'),
    },
    {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: `${currentFeedTitle.value} RSS`,
      href: getFeedHref('xml'),
    },
    {
      rel: 'alternate',
      type: 'application/feed+json',
      title: `${currentFeedTitle.value} JSON Feed`,
      href: getFeedHref('json'),
    },
  ],
}))

watch(currentLocale, (locale) => {
  if (typeof document !== 'undefined')
    document.documentElement.lang = getLanguageTag(locale)
}, { immediate: true })

function getRectCenter(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }
}

useEventListener('click', async (e) => {
  const path = Array.from(e.composedPath())
  const first = path[0] as HTMLImageElement
  if (!(first instanceof HTMLElement))
    return
  if (first.tagName !== 'IMG')
    return
  if (first.classList.contains('no-preview'))
    return
  if (path.some(el => el instanceof HTMLElement && ['A', 'BUTTON'].includes(el.tagName)))
    return
  if (path.some(el => el instanceof HTMLElement && el.closest('.photos')))
    return
  if (!path.some(el => el instanceof HTMLElement && el.classList.contains('prose')))
    return

  // Do not open image when they are moving. Mainly for mobile to avoid conflict with hovering behavior.
  const pos = getRectCenter(first)
  await new Promise(resolve => setTimeout(resolve, 50))
  const newPos = getRectCenter(first)
  if (!first.isConnected || !first.naturalWidth || Math.abs(pos.x - newPos.x) > 1 || Math.abs(pos.y - newPos.y) > 1)
    return

  const figure = first.closest('figure')
  const caption = figure?.querySelector('figcaption')?.textContent || first.alt || ''
  openLightbox([{
    url: first.currentSrc || first.src,
    width: first.naturalWidth,
    height: first.naturalHeight,
    alt: first.alt,
    title: caption,
    classes: first.className.split(/\s+/).filter(cls => cls.includes('filter')).join(' '),
  }], 0, first)
})

function prepareImageTriggers() {
  for (const image of document.querySelectorAll<HTMLImageElement>('main .prose img:not(.no-preview)')) {
    if (image.closest('a, button, .photos'))
      continue
    image.tabIndex = 0
    image.setAttribute('role', 'button')
    image.setAttribute('aria-haspopup', 'dialog')
    image.setAttribute('aria-label', image.alt || 'View image')
  }
}

useEventListener('keydown', (event: KeyboardEvent) => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLImageElement && event.target.getAttribute('role') === 'button') {
    event.preventDefault()
    event.target.click()
  }
})

onMounted(() => {
  watch(() => route.path, () => nextTick(prepareImageTriggers), { immediate: true })
  // eslint-disable-next-line no-console
  console.log(
    '%c👁 if you gaze long into an abyss, the abyss also gazes at you',
    'color: #888; font-size: 14px; font-family: monospace;',
  )
})
</script>

<template>
  <a href="#main-content" class="skip-link">{{ $t('a11y-skip-to-content') }}</a>
  <NavBar />
  <main id="main-content" class="px-7 py-10 of-x-hidden" tabindex="-1" role="main">
    <RouterView />
    <Footer :key="route.path" />
  </main>
  <PhotoLightbox />
</template>

<style scoped>
.skip-link {
  position: absolute;
  top: -100px;
  left: 1.5rem;
  z-index: 1000;
  padding: 0.5rem 1rem;
  background-color: var(--c-bg);
  color: inherit;
  border: 1px solid rgba(125, 125, 125, 0.4);
  border-radius: 0.25rem;
  font-weight: bold;
  text-decoration: none;
  transition: top 0.2s ease;
}

.skip-link:focus {
  top: 1.5rem;
  outline: 2px solid rgba(125, 125, 125, 0.6);
  outline-offset: 4px;
}
</style>
