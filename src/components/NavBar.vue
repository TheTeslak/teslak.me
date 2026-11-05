<script setup lang="ts">
import { useMediaQuery, useWindowScroll } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFeedName, supportedLocales } from '~/locales/config'
import { copyText } from '~/logics/clipboard'
import { getLocaleFromPath, isSupportedLocale, setPathLocale } from '~/logics/i18n-path'
import { setLocaleCookie } from '~/logics/locale-cookie'
import { isAnyModalOpen } from '~/logics/modal-manager'
import { getCanonicalUrl } from '~/logics/site'
import Logo from './Logo.vue'

const router = useRouter()

const route = useRoute()
const logo = useTemplateRef<InstanceType<typeof Logo>>('logo')
const mobileMenuBtnRef = useTemplateRef<HTMLButtonElement>('mobileMenuBtnRef')
const mobileMenuPanelRef = useTemplateRef<HTMLDivElement>('mobileMenuPanelRef')

function onLogoPointerEnter(event: PointerEvent) {
  if (event.pointerType !== 'touch')
    logo.value?.replay()
}

function onLogoFocus(event: FocusEvent) {
  if ((event.currentTarget as HTMLElement).matches(':focus-visible'))
    logo.value?.replay()
}

const currentLocale = computed(() => getLocaleFromPath(route.path))
const currentFeedHref = computed(() => `/${getFeedName(currentLocale.value)}.xml`)

function localePath(path = '') {
  return {
    path: `/${currentLocale.value}${path}`,
    query: route.query,
    hash: route.hash,
  }
}

function toTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

const { y: scroll } = useWindowScroll()

const copied = ref(false)
let copiedTimeout: ReturnType<typeof setTimeout> | undefined

const isPostPage = computed(() => {
  return route.meta.isArticle === true || /\/(?:finds|notes)\//.test(route.path)
})

async function copyLink() {
  const url = getCanonicalUrl(route.path)
  if (!await copyText(url))
    return
  copied.value = true
  if (copiedTimeout)
    clearTimeout(copiedTimeout)
  copiedTimeout = setTimeout(() => {
    copied.value = false
  }, 2000)
}

const mobileMenuOpen = ref(false)

const isDesktop = useMediaQuery('(min-width: 768px)')
watch(isDesktop, (desktop) => {
  if (desktop && mobileMenuOpen.value) {
    const restoreFocus = document.activeElement === mobileMenuBtnRef.value
      || mobileMenuPanelRef.value?.contains(document.activeElement)
    closeMobileMenu()
    if (restoreFocus) {
      nextTick(() => {
        mobileMenuBtnRef.value?.closest('header')?.querySelector<HTMLElement>('.logo-link')?.focus({ preventScroll: true })
      })
    }
  }
})

watch(() => route.path, () => {
  mobileMenuOpen.value = false
})

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

function onHeaderKeydown(event: KeyboardEvent) {
  if (!mobileMenuOpen.value)
    return
  // A disclosure, not a modal: retain normal Tab navigation and page scrolling.
  // Do not let the site's global arrow shortcuts navigate behind the menu.
  event.stopPropagation()
  if (event.key === 'Escape') {
    event.preventDefault()
    closeMobileMenu()
    mobileMenuBtnRef.value?.focus({ preventScroll: true })
  }
}

async function changeMobileLang(lang: string) {
  if (!isSupportedLocale(lang))
    return

  setLocaleCookie(lang)
  closeMobileMenu()

  const newPath = setPathLocale(route.path, lang)
  const target = {
    path: newPath,
    query: route.query,
    hash: route.hash,
  }

  if (newPath === route.path)
    return

  await router.push(target)

  if (route.path !== newPath && typeof window !== 'undefined') {
    const href = router.resolve(target).href
    window.location.assign(href)
  }
}

onBeforeUnmount(() => {
  if (copiedTimeout)
    clearTimeout(copiedTimeout)
})
</script>

<template>
  <header class="header z-40" @keydown="onHeaderKeydown">
    <RouterLink
      class="logo-link w-12 h-12 absolute lg:fixed m-5 select-none"
      :to="localePath()"
      :aria-label="$t('a11y-home')"
      @pointerenter="onLogoPointerEnter"
      @focus="onLogoFocus"
    >
      <Logo ref="logo" />
    </RouterLink>

    <button
      ref="mobileMenuBtnRef"
      type="button"
      class="mobile-menu-btn md:hidden"
      :aria-expanded="mobileMenuOpen"
      aria-controls="mobile-menu-panel"
      :aria-label="mobileMenuOpen ? $t('nav-close') : $t('nav-menu')"
      @click="toggleMobileMenu"
    >
      {{ mobileMenuOpen ? $t('nav-close') : $t('nav-menu') }}
    </button>
    <!-- Desktop action buttons -->
    <div
      class="fixed right-3 bottom-3 z-100 flex items-center gap-2 transition duration-300 print:hidden"
      :class="scroll > 300 && !isAnyModalOpen ? 'op75 hover:op100' : 'op0! pointer-events-none'"
      :inert="isAnyModalOpen"
    >
      <!-- Post link copy -->
      <button
        v-if="isPostPage"
        class="flex items-center justify-center min-w-10 h-10 bg-base hover:bg-[#e7e7e7] dark:hover:bg-[#1b1b1b] rounded-full transition-all duration-300 overflow-hidden"
        :class="copied ? 'pl-3 pr-4' : 'px-0'"
        :title="copied ? $t('state-link-copied') : $t('action-copy-link')"
        @click="copyLink()"
      >
        <div :class="copied ? 'i-ri-check-line' : 'i-ri-links-line'" class="shrink-0" />
        <span
          class="text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300"
          :class="copied ? 'ml-2 max-w-40 opacity-100' : 'ml-0 max-w-0 opacity-0'"
        >
          {{ $t('state-link-copied') }}
        </span>
      </button>

      <!-- Scroll top -->
      <button
        class="flex items-center justify-center w-10 h-10 bg-base hover:bg-[#e7e7e7] dark:hover:bg-[#1b1b1b] rounded-full transition duration-300"
        :title="$t('action-to-top')"
        :aria-label="$t('action-to-top')"
        @click="toTop()"
      >
        <div i-ri-arrow-up-line />
      </button>
    </div>
    <nav class="nav" role="navigation" :aria-label="$t('a11y-main-navigation')">
      <div class="spacer" />
      <div class="right" print:op0>
        <RouterLink :to="localePath('/notes')" :title="$t('nav-blog')" class="lt-md:hidden">
          <span>{{ $t('nav-blog') }}</span>
        </RouterLink>
        <RouterLink :to="localePath('/now')" :title="$t('nav-now')" class="lt-md:hidden">
          {{ $t('nav-now') }}
        </RouterLink>
        <RouterLink :to="localePath('/projects')" :title="$t('nav-projects')" class="lt-md:hidden">
          <span>{{ $t('nav-projects') }}</span>
        </RouterLink>
        <RouterLink :to="localePath('/photos')" :title="$t('nav-photos')" class="lt-md:hidden">
          {{ $t('nav-photos') }}
        </RouterLink>

        <a href="https://t.me/" target="_blank" title="Telegram" class="lt-md:hidden">
          <div i-ri-telegram-2-line class="scale-110" />
        </a>
        <a :href="currentFeedHref" target="_blank" title="RSS" class="lt-md:hidden">
          <div i-ri-rss-line />
        </a>

        <ToggleTheme class="lt-md:hidden" />
        <LanguageSelector class="lt-md:hidden" />
      </div>
    </nav>

    <div
      class="mobile-menu-expander md:hidden"
      :class="{ 'is-open': mobileMenuOpen }"
      :inert="!mobileMenuOpen"
      :aria-hidden="!mobileMenuOpen"
    >
      <div class="mobile-menu-clip">
        <div id="mobile-menu-panel" ref="mobileMenuPanelRef" class="mobile-menu-panel">
          <nav class="mobile-menu-links">
            <RouterLink :to="localePath()" @click="closeMobileMenu">
              Teslak.Me
            </RouterLink>
            <RouterLink :to="localePath('/notes')" @click="closeMobileMenu">
              {{ $t('nav-blog') }}
            </RouterLink>
            <RouterLink :to="localePath('/now')" @click="closeMobileMenu">
              {{ $t('nav-now') }}
            </RouterLink>
            <RouterLink :to="localePath('/projects')" @click="closeMobileMenu">
              {{ $t('nav-projects') }}
            </RouterLink>
            <RouterLink :to="localePath('/photos')" @click="closeMobileMenu">
              {{ $t('nav-photos') }}
            </RouterLink>
          </nav>
          <div class="mobile-lang-row">
            <button
              v-for="lang in supportedLocales"
              :key="lang"
              class="mobile-lang-btn"
              :class="{ 'mobile-lang-btn-active': currentLocale === lang }"
              :aria-current="currentLocale === lang ? 'true' : undefined"
              @click="changeMobileLang(lang)"
            >
              {{ lang.toUpperCase() }}
            </button>
          </div>
          <div class="mobile-menu-icons">
            <a href="https://t.me/" target="_blank" title="Telegram" aria-label="Telegram">
              <div i-ri-telegram-2-line class="scale-110" />
            </a>
            <a :href="currentFeedHref" target="_blank" title="RSS" aria-label="RSS">
              <div i-ri-rss-line />
            </a>
            <ToggleTheme />
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header h1 {
  margin-bottom: 0;
}

.logo-link:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 4px;
  border-radius: 0.25rem;
}

.nav {
  padding: 2rem;
  width: 100%;
  display: grid;
  grid-template-columns: auto max-content;
  box-sizing: border-box;
}

.nav > * {
  margin: auto;
}

.nav img {
  margin-bottom: 0;
}

.nav a,
.nav button {
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: opacity 0.2s ease;
  opacity: 0.75;
  outline: none;
}

.nav a:focus-visible,
.nav button:focus-visible {
  outline: 2px solid rgba(125, 125, 125, 0.4);
  outline-offset: 4px;
}

.nav a:hover,
.nav button:hover {
  opacity: 1;
  text-decoration-color: inherit;
}

.nav .right {
  display: grid;
  grid-gap: 1.2rem;
  grid-auto-flow: column;
}

.nav .right > * {
  margin: auto;
}

/* Mobile navigation overrides */
@media (max-width: 1023px) {
  .fixed.right-3.bottom-3 {
    display: none !important;
  }
}

.mobile-menu-btn {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  height: 3rem;
  padding: 0 1.25rem;
  border: 0;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1;
  color: inherit;
  cursor: pointer;
  touch-action: manipulation;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(125, 125, 125, 0.11);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition:
    background 200ms ease,
    transform 180ms ease;
  z-index: 201;
}

@media (min-width: 768px) {
  .mobile-menu-btn {
    display: none !important;
  }
}

.mobile-menu-btn:hover {
  background: rgba(125, 125, 125, 0.18);
  transform: scale(1.07);
}

.mobile-menu-btn:active {
  background: rgba(125, 125, 125, 0.18);
  transform: scale(0.93);
  transition-duration: 80ms;
}

.mobile-menu-expander {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 280ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 200ms ease;
  overflow-anchor: none;
}

.mobile-menu-expander.is-open {
  grid-template-rows: 1fr;
  opacity: 1;
}

.mobile-menu-clip {
  min-height: 0;
  overflow: hidden;
}

.mobile-menu-panel {
  padding: 1.5rem 2.1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.mobile-menu-links {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.mobile-menu-links a {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0.35rem 0;
  font-size: 2.3rem;
  font-weight: 500;
  color: inherit;
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 200ms ease;
}

.mobile-menu-links a:hover,
.mobile-menu-links a.router-link-active {
  opacity: 1;
}

.mobile-lang-row {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  padding-top: 2.3rem;
  border-top: 1px solid rgba(125, 125, 125, 0.12);
}

.mobile-lang-btn {
  display: inline-flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 44px;
  padding: 0 clamp(0px, 1.5vw, 14px);
  white-space: nowrap;
  border: 0;
  border-radius: 999px;
  background: rgba(125, 125, 125, 0.11);
  color: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

@media (hover: hover) {
  .mobile-lang-btn:not(.mobile-lang-btn-active):hover {
    background: rgba(125, 125, 125, 0.18);
  }
}

.mobile-lang-btn-active {
  font-weight: 700;
  background: rgba(125, 125, 125, 0.26);
}

.mobile-lang-btn:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

.mobile-menu-icons {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding-top: 0.75rem;
}

.mobile-menu-icons a,
.mobile-menu-icons button,
.mobile-menu-icons :deep(button) {
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  opacity: 0.55;
  transition: opacity 200ms ease;
  background: none;
  border: none;
  min-width: 44px;
  min-height: 44px;
  padding: 0.5rem;
  font-size: 1.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.mobile-menu-icons a:hover,
.mobile-menu-icons button:hover,
.mobile-menu-icons :deep(button:hover) {
  opacity: 1;
}

@media (min-width: 768px) {
  .mobile-menu-expander {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-menu-expander {
    transition: none;
  }
}
</style>
