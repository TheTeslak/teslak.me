<script setup lang="ts">
import type { RouteRecordNormalized } from 'vue-router'
import type { Post } from '~/types'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatDate, formatReadingDuration, isDraftPost, isPostVisible, isRecentPost, onlyLanguage } from '~/logics'
import { getLocaleFromPath } from '~/logics/i18n-path'

const props = defineProps<{
  type?: string
  posts?: Post[]
  extra?: Post[]
}>()

const router = useRouter()
const route = useRoute()

const locale = computed(() => {
  return getLocaleFromPath(route.path)
})

const routes = computed<Post[]>(() => {
  // Locale aliases keep untranslated articles discoverable without switching the site language.
  return router.getRoutes()
    .filter((r: RouteRecordNormalized) =>
      r.meta.isArticle === true
      && getLocaleFromPath(r.path) === locale.value
      && isPostVisible(r.meta.frontmatter || {}),
    )
    .filter((r: RouteRecordNormalized) =>
      !r.path.endsWith('.html')
      && (r.meta.frontmatter?.type || 'blog').split('+').includes(props.type),
    )
    .map((r: RouteRecordNormalized) => ({
      path: r.meta.frontmatter?.redirect || r.path,
      title: r.meta.frontmatter?.title,
      date: r.meta.frontmatter?.date,
      updated: r.meta.frontmatter?.updated,
      lang: r.meta.frontmatter?.lang,
      duration: r.meta.frontmatter?.duration,
      redirect: r.meta.frontmatter?.redirect,
      place: r.meta.frontmatter?.place,
      type: r.meta.frontmatter?.type,
    }))
})

const posts = computed<Post[]>(() => {
  const list = [...(props.posts || routes.value), ...props.extra || []]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))

  if (onlyLanguage.value) {
    return list.filter((i) => {
      const articleLang = i.lang
      if (articleLang && articleLang !== locale.value)
        return false
      return true
    })
  }
  return list
})

const getYear = (a: Date | string | number) => new Date(a).getFullYear()
const groups = computed(() => {
  const result: { year: number, startIndex: number, posts: Post[] }[] = []
  posts.value.forEach((post, index) => {
    const year = getYear(post.date)
    const last = result[result.length - 1]
    if (last && last.year === year)
      last.posts.push(post)
    else
      result.push({ year, startIndex: index, posts: [post] })
  })
  return result
})

function getPostLangTag(post: Post) {
  const articleLang = post.lang
  if (articleLang && articleLang !== locale.value) {
    return articleLang.toUpperCase()
  }
  return null
}

function getDurationLabel(duration?: Post['duration']) {
  return formatReadingDuration(duration, locale.value)
}
</script>

<template>
  <div class="post-groups" style="contain: layout;">
    <div v-if="!posts.length" py2 op50>
      {{ $t('state-empty') }}
    </div>
    <section v-for="group in groups" :key="group.startIndex" :aria-label="String(group.year)">
      <div
        aria-hidden="true"
        select-none relative h20 pointer-events-none slide-enter
        :style="{
          '--enter-stage': Math.min(group.startIndex, 10) - 2,
          '--enter-step': '60ms',
        }"
      >
        <span text-8em color-transparent absolute left--3rem top--2rem font-bold text-stroke-2 text-stroke-hex-aaa op10>{{ group.year }}</span>
      </div>
      <ul class="post-list" role="list">
        <li
          v-for="(item, index) in group.posts"
          :key="item.path"
          class="slide-enter"
          :style="{
            '--enter-stage': Math.min(group.startIndex + index, 10),
            '--enter-step': '60ms',
          }"
        >
          <PostListLink :to="item.path" class="item post-link block font-normal no-underline">
            <div
              class="no-underline"
              flex="~ col md:row gap-2 md:items-center"
            >
              <div class="title text-lg md:text-xl leading-1.3em" flex="~ gap-2 wrap">
                <span
                  v-if="getPostLangTag(item)"
                  align-middle flex-none
                  class="text-xs bg-zinc:15 text-[#91919b] rounded px-1 py-0.5 ml--10 mr2 my-auto hidden md:block"
                >{{ getPostLangTag(item) }}</span>
                <span align-middle>{{ item.title }}</span>
                <span
                  v-if="item.redirect"
                  align-middle op50 flex-none text-xs ml--1.5
                  i-carbon-arrow-up-right
                  :title="$t('tooltip-external-link')"
                  aria-hidden="true"
                />
              </div>

              <div flex="~ gap-2 items-center" class="text-[0.9375rem] md:text-base">
                <span op60 ws-nowrap>
                  <span v-if="isDraftPost(item.type)" role="img" aria-label="Draft">🚧 </span>
                  <span v-if="isRecentPost(item.date, item.updated) && !isDraftPost(item.type)" role="img" aria-label="Recent">🌱 </span>{{ formatDate(item.date, true, locale) }}
                </span>
                <span v-if="getDurationLabel(item.duration)" op60 ws-nowrap>· {{ getDurationLabel(item.duration) }}</span>
                <span v-if="item.place" op60 ws-nowrap md:hidden>· {{ item.place }}</span>
                <span
                  v-if="getPostLangTag(item)"
                  align-middle flex-none
                  class="text-xs bg-zinc:15 text-[#91919b] rounded px-1 py-0.5 my-auto md:hidden"
                >{{ getPostLangTag(item) }}</span>
              </div>
            </div>
            <div v-if="item.place" class="text-[0.9375rem] md:text-base opacity-45 hidden mt--1 md:block">
              {{ item.place }}
            </div>
          </PostListLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.post-groups {
  margin-block: var(--list-my, 1.25em);
}

.post-list.post-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.post-list.post-list > li {
  margin: 0;
  padding: 0;
}

.post-list.post-list > li::before {
  content: none;
}

.post-link {
  margin-top: 4px;
  margin-bottom: 20px;
  padding-block: 4px;
}
</style>
