import type { App } from 'vue'
import { createApp } from 'vue'
import ArticleAudio from '../../../src/components/ArticleAudio.vue'

// Browser-only fixture: reuse the real router/Fluent providers without adding a
// production route or publishing a fake article/audio asset.
export function mountAudio() {
  const host = document.createElement('div')
  host.className = 'prose m-auto'
  host.dataset.audioFixture = ''
  document.querySelector('main')!.prepend(host)
  const existing = (document.querySelector('#app') as HTMLElement & { __vue_app__: App }).__vue_app__
  const app = createApp(ArticleAudio, {
    audio: { url: '/mobile-fixture.wav', duration: '0:10' },
    articleTitle: 'A deliberately long audio title for narrow screens',
    articleUpdatedAt: '2026-01-01T00:00:00Z',
    articleSlug: 'mobile-fixture',
  })
  app._context.provides = existing._context.provides
  Object.assign(app.config.globalProperties, existing.config.globalProperties)
  app.mount(host)
}
