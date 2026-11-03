<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { localeConfig, supportedLocales } from '~/locales/config'
import { getLocaleFromPath, isSupportedLocale, setPathLocale } from '~/logics/i18n-path'
import { setLocaleCookie } from '~/logics/locale-cookie'
import { isPostVisible } from '~/logics/post-visibility'

const router = useRouter()
const route = useRoute()

const currentLocale = computed(() => getLocaleFromPath(route.path))

async function changeLocale(locale: string) {
  if (!isSupportedLocale(locale) || locale === currentLocale.value)
    return

  setLocaleCookie(locale)
  const targetPath = setPathLocale(route.path, locale)
  await router.push({
    path: targetPath,
    query: route.query,
    hash: route.hash,
  })
}

const stats = computed(() => {
  const routes = router.getRoutes()
  const seen = new Set<string>()
  const physicalArticles: Array<{ slug: string, locale: string }> = []

  for (const r of routes) {
    if (r.meta.isArticle !== true)
      continue

    const frontmatter = (r.meta.frontmatter || {}) as Record<string, any>
    if (!isPostVisible(frontmatter))
      continue

    const slug = r.meta.articleSlug as string
    const sourceLocale = r.meta.articleLocale as string
    if (!slug || !sourceLocale)
      continue

    // Skip auto-generated fallback route aliases to ensure stats represent actual physical translations.
    const urlLocale = getLocaleFromPath(r.path)
    if (urlLocale !== sourceLocale)
      continue

    const key = `${sourceLocale}/${slug}`
    if (!seen.has(key)) {
      seen.add(key)
      physicalArticles.push({ slug, locale: sourceLocale })
    }
  }

  const uniqueSlugs = new Set(physicalArticles.map(a => a.slug))
  const totalArticles = uniqueSlugs.size

  if (totalArticles === 0)
    return []

  return supportedLocales.map((locale) => {
    const count = physicalArticles.filter(a => a.locale === locale).length
    return {
      locale,
      name: localeConfig[locale].nativeName,
      count,
      total: totalArticles,
      percentage: Math.round((count / totalArticles) * 100),
    }
  }).sort((a, b) => b.percentage - a.percentage)
})

const CIRCUMFERENCE = 2 * Math.PI * 16

const localeGreetings: Record<string, { flag: string, greeting: string }> = {
  en: { flag: '🇬🇧', greeting: 'Hello!' },
  ru: { flag: '🇷🇺', greeting: 'Привет!' },
  es: { flag: '🇪🇸', greeting: '¡Hola!' },
  pt: { flag: '🇧🇷', greeting: 'Olá!' },
  de: { flag: '🇩🇪', greeting: 'Hallo!' },
  fr: { flag: '🇫🇷', greeting: 'Bonjour!' },
}
</script>

<template>
  <div
    v-if="stats.length"
    class="translation-stats grid grid-cols-1 md:grid-cols-3 gap-[2px] my-6"
    role="region"
    aria-label="Translation completeness"
  >
    <button
      v-for="item in stats"
      :key="item.locale"
      type="button"
      class="translation-stats-item group relative pl-4 pr-5 py-3 flex items-center justify-between text-left border-none outline-none font-inherit select-none"
      :class="[
        item.locale === currentLocale
          ? 'is-current cursor-default'
          : 'is-clickable cursor-pointer',
      ]"
      :aria-current="item.locale === currentLocale ? 'true' : undefined"
      :aria-label="`${item.name} (${item.percentage}%)`"
      @click="changeLocale(item.locale)"
    >
      <div class="translation-stage min-w-0">
        <span
          class="translation-name font-sans font-medium whitespace-nowrap"
          :class="{ 'is-hoverable': item.locale !== currentLocale }"
        >
          {{ item.name }}
        </span>
        <span
          v-if="item.locale !== currentLocale && localeGreetings[item.locale]"
          class="translation-greeting font-sans font-medium whitespace-nowrap flex items-center gap-1.5"
          aria-hidden="true"
        >
          <span class="text-base leading-none">{{ localeGreetings[item.locale].flag }}</span>
          <span>{{ localeGreetings[item.locale].greeting }}</span>
        </span>
      </div>

      <div class="flex items-center gap-3">
        <span class="font-sans text-right opacity-70 group-hover:opacity-100 transition-opacity">
          {{ item.percentage }}%
        </span>

        <div class="w-5 h-5 flex-shrink-0 flex items-center justify-center">
          <svg
            class="w-5 h-5 flex-shrink-0"
            viewBox="0 0 36 36"
            style="transform: rotate(-90deg)"
          >
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="currentColor"
              stroke-width="3.5"
              opacity="0.15"
            />
            <circle
              class="transition-all duration-300 ease-out"
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="currentColor"
              stroke-width="3.5"
              stroke-linecap="round"
              :stroke-dasharray="CIRCUMFERENCE"
              :stroke-dashoffset="CIRCUMFERENCE - (CIRCUMFERENCE * item.percentage) / 100"
            />
            <circle
              v-if="item.locale !== currentLocale"
              cx="18"
              cy="18"
              r="4.5"
              fill="currentColor"
              class="opacity-0 group-hover:opacity-80 transition-opacity duration-200 pointer-events-none"
            />
          </svg>
        </div>
      </div>
    </button>
  </div>
</template>

<style scoped>
.translation-stats {
  border-radius: 0.5rem;
  overflow: hidden;
}
.translation-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
}
.translation-name,
.translation-greeting {
  grid-area: 1 / 1;
  transition:
    opacity 180ms ease,
    transform 200ms ease;
}
.translation-greeting {
  opacity: 0;
  transform: translateY(4px);
  pointer-events: none;
}
.translation-stats-item:hover .translation-name.is-hoverable {
  opacity: 0;
  transform: translateY(-4px);
}
.translation-stats-item:hover .translation-greeting {
  opacity: 1;
  transform: translateY(0);
}
.translation-stats-item {
  background: rgba(125, 125, 125, 0.08);
  color: inherit;
  transition: background-color 180ms ease;
}
.translation-stats-item.is-current {
  background: rgba(125, 125, 125, 0.16);
  font-weight: 600;
}
.translation-stats-item.is-clickable:hover {
  background: rgba(125, 125, 125, 0.14);
}
.translation-stats-item:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: -2px;
  z-index: 1;
}
</style>
