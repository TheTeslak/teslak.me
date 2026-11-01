import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { catalog } from '../../photos/catalog'

const gallerySize = catalog.length

type TouchEventType = 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel'

async function visit(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('#app')).toHaveAttribute('data-v-app', '')
}

async function expectUnlocked(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    overflow: document.body.style.overflow,
    inert: !!document.querySelector('main')?.closest('[inert]'),
  }))).toEqual({ overflow: '', inert: false })
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dg-art-override', 'none'))
})

test('contents releases the modal on selection, Escape and backdrop dismissal', async ({ page }) => {
  await visit(page, '/en/template')
  const trigger = page.locator('.mobile-action-bar > button')
  await expect(trigger).toBeVisible()
  for (const dismissal of ['selection', 'escape', 'backdrop']) {
    await trigger.click()
    const sheet = page.locator('.mobile-toc-sheet')
    await expect(sheet).toBeFocused()
    await expect(page.locator('#app')).toHaveAttribute('inert', '')
    if (dismissal === 'selection')
      await sheet.locator('.mobile-toc-sheet-item').first().click()
    else if (dismissal === 'escape')
      await page.keyboard.press('Escape')
    else
      await page.locator('.mobile-toc-backdrop').click({ position: { x: 20, y: 100 } })
    await expect(sheet).toHaveCount(0)
    await expectUnlocked(page)
    await expect(trigger).toBeFocused()
  }
})

test('menu pushes content down, keeps the original toggle and resets after rotation', async ({ page }, testInfo) => {
  await visit(page, '/en')
  const trigger = page.locator('.mobile-menu-btn')
  const expander = page.locator('.mobile-menu-expander')
  const main = page.locator('main')
  const initialTop = (await main.boundingBox())!.y
  await trigger.click()
  await expect(trigger).toHaveText('Close')
  await expect(trigger).toBeFocused()
  await expect(expander).toHaveAttribute('aria-hidden', 'false')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expectUnlocked(page)
  const expansion = (await expander.boundingBox())!.height
  expect(expansion).toBeGreaterThan(200)
  expect((await main.boundingBox())!.y).toBeGreaterThan(initialTop)
  await page.screenshot({ path: testInfo.outputPath('inline-menu.png'), fullPage: true })
  await trigger.click()
  await expect(trigger).toHaveText('Menu')
  await trigger.click()
  await page.keyboard.press('Tab')
  await expect(page.locator('.mobile-menu-links a').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(expander).toBeHidden()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expectUnlocked(page)
  await expect(page.locator('.mobile-menu-expander :focus')).toHaveCount(0)
})

test('large-text inline menu uses document scrolling and closes after navigation', async ({ page }) => {
  await visit(page, '/en')
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '24px'
  })
  await page.locator('.mobile-menu-btn').click()
  await expectUnlocked(page)
  const lastControl = page.locator('.mobile-menu-icons button').last()
  await lastControl.scrollIntoViewIfNeeded()
  await expect(lastControl).toBeInViewport()
  await page.locator('.mobile-menu-links a').nth(1).click()
  await expect(page).toHaveURL(/\/en\/notes$/)
  await expect(page.locator('.mobile-menu-btn')).toHaveText('Menu')
  await expect(page.locator('.mobile-menu-expander')).toHaveAttribute('aria-hidden', 'true')
})

test('glossary enters focus, contains keyboard navigation and restores its trigger', async ({ page }) => {
  await visit(page, '/en/robophobia')
  const trigger = page.locator('.glossary-term').first()
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.glossary-sheet')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('.glossary-sheet-close')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('.glossary-sheet-close')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.glossary-sheet')).toHaveCount(0)
  await expectUnlocked(page)
  await expect(trigger).toBeFocused()
})

test('copy actions are available on heading-free articles but not the homepage', async ({ page }) => {
  await visit(page, '/en/robophobia')
  await expect(page.locator('.mobile-action-bar')).toBeVisible()
  await expect(page.locator('.mobile-action-bar > button')).toHaveCount(0)
  await expect(page.locator('.mobile-action-bar button')).toHaveCount(1)
  await visit(page, '/en')
  await expect(page.locator('.mobile-action-bar')).toHaveCount(0)
})

test('gallery has adjacent slides, touch-visible navigation and preserves reading position', async ({ page }) => {
  await visit(page, '/en/photos')
  const trigger = page.locator('.photos [role="button"]').nth(5)
  await trigger.scrollIntoViewIfNeeded()
  await trigger.focus()
  const position = await page.evaluate(() => window.scrollY)
  await page.keyboard.press('Enter')
  await expect(page.locator('.pswp__item')).toHaveCount(3)
  await expect(page.locator('.pswp__button--arrow--next')).toBeVisible()
  await expect(page.locator('.pswp__button--arrow--prev')).toBeVisible()
  await expect(page.locator('.pswp__counter')).toHaveCount(0)
  await expect(page.locator('.pswp__caption')).toHaveCount(0)
  await expect(page.locator('.pswp__button--zoom')).toBeHidden()
  const positionStatus = page.locator('.photo-lightbox-position')
  await expect(positionStatus).toHaveText(`6 / ${gallerySize}`)
  await page.locator('.pswp__button--arrow--next').click()
  await expect(positionStatus).toHaveText(`7 / ${gallerySize}`)
  await page.keyboard.press('Escape')
  await expect(page.locator('.photo-lightbox-overlay')).toHaveCount(0)
  await expectUnlocked(page)
  await expect(trigger).toBeFocused()
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - position)).toBeLessThanOrEqual(2)
})

test('real touch drag tracks incoming content, snaps and resists collection boundaries', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await visit(page, '/en/photos')
  await page.locator('.photos [role="button"]').first().click()
  await expect(page.locator('.pswp__item')).toHaveCount(3)
  await expect(page.locator('.pswp')).toHaveAttribute('data-ready', 'true')
  const session = await page.context().newCDPSession(page)
  const touch = async (type: TouchEventType, x?: number, y = 380) => session.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: x === undefined ? [] : [{ x, y }],
  })
  const track = page.locator('.pswp__container')
  const initialX = (await track.boundingBox())!.x
  await touch('touchStart', 180)
  await touch('touchMove', 200)
  await touch('touchMove', 280)
  await expect.poll(async () => (await track.boundingBox())!.x - initialX).toBeGreaterThan(0)
  const boundaryDelta = (await track.boundingBox())!.x - initialX
  expect(boundaryDelta).toBeLessThan(100)
  await touch('touchEnd')
  await expect(page.locator('.photo-lightbox-position')).toHaveText(`1 / ${gallerySize}`)
  await expect.poll(async () => Math.abs((await track.boundingBox())!.x - initialX)).toBeLessThan(1)
  await touch('touchStart', 300)
  await touch('touchMove', 280)
  await touch('touchMove', 240)
  await expect.poll(async () => (await track.boundingBox())!.x).toBeLessThan(initialX - 30)
  await touch('touchMove', 70)
  await touch('touchEnd')
  await expect(page.locator('.photo-lightbox-position')).toHaveText(`2 / ${gallerySize}`)
  await page.keyboard.press('Escape')
  await expectUnlocked(page)
})

test('desktop viewer fits images and supports zoom', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    hasTouch: false,
    isMobile: false,
    reducedMotion: 'reduce',
  })
  try {
    const page = await context.newPage()
    await visit(page, 'http://127.0.0.1:1112/en/photos')
    const portraitIndex = catalog.findIndex(photo => photo.file === 'high-rise.avif')
    expect(portraitIndex).toBeGreaterThanOrEqual(0)
    await page.locator('.photos [role="button"]').nth(portraitIndex).click()
    const viewer = page.locator('.pswp')
    await expect(viewer).toHaveAttribute('data-ready', 'true')
    await expect(page.locator('.pswp__button--zoom')).toBeVisible()
    await expect(page.locator('.pswp__caption, .pswp__counter')).toHaveCount(0)
    const image = page.locator('.pswp__item[aria-hidden="false"] img:not(.pswp__img--placeholder)')
    await expect(image).toHaveClass(/photo-viewer-loaded/)
    const bounds = (await image.boundingBox())!
    expect(bounds.height).toBeGreaterThan(0)
    expect(bounds.height).toBeLessThanOrEqual(1001)
    expect(bounds.y).toBeGreaterThanOrEqual(-1)
    await page.screenshot({ path: testInfo.outputPath('desktop-viewer.png') })
    await page.locator('.pswp__button--zoom').click()
    await expect(viewer).toHaveClass(/pswp--zoomed-in/)
    await expect(page.locator('.photo-viewer-zoom-out')).toBeVisible()
    await page.keyboard.press('Escape')
    await page.locator('.photos [role="button"]').first().click()
    const landscape = page.locator('.pswp__item[aria-hidden="false"] img:not(.pswp__img--placeholder)')
    await expect(landscape).toHaveClass(/photo-viewer-loaded/)
    const landscapeBounds = (await landscape.boundingBox())!
    expect(Math.max(landscapeBounds.width / 1440, landscapeBounds.height / 1000)).toBeCloseTo(1, 2)
    expect(landscapeBounds.width).toBeLessThanOrEqual(1441)
    expect(landscapeBounds.height).toBeLessThanOrEqual(1001)
  }
  finally {
    await context.close()
  }
})

test('progressive images retain identical geometry on desktop-sized viewports', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`**/photos/${encodeURI(catalog[0].file)}*`, async (route) => {
    if (route.request().resourceType() === 'image')
      await gate
    await route.continue()
  })
  try {
    await visit(page, '/en/photos')
    await page.locator('.photos [role="button"]').first().click()
    const placeholder = page.locator('.pswp__item[aria-hidden="false"] .pswp__img--placeholder')
    await expect(placeholder).toBeVisible()
    const before = await placeholder.boundingBox()
    release()
    const original = page.locator('.pswp__item[aria-hidden="false"] img:not(.pswp__img--placeholder)')
    await expect.poll(() => original.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 800)).toBe(true)
    const after = await original.boundingBox()
    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(Math.abs(before!.width - after!.width)).toBeLessThanOrEqual(2)
    expect(Math.abs(before!.height - after!.height)).toBeLessThanOrEqual(2)
  }
  finally {
    release()
  }
})

test('mobile pages do not overflow across locales', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  for (const locale of ['en', 'ru', 'de', 'es', 'fr', 'pt']) {
    await visit(page, `/${locale}`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('standalone images open with the keyboard and heading-copy feedback stays in view', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.setViewportSize({ width: 320, height: 844 })
  await visit(page, '/en/template')
  const heading = page.locator('article h2').first()
  await heading.click()
  const toast = page.locator('.heading-copy-toast')
  await expect(toast).toBeVisible()
  const box = (await toast.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(320)
  const image = page.locator('article img[role="button"]').first()
  await image.scrollIntoViewIfNeeded()
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
  await image.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.pswp')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('.pswp__button--arrow--next')).toBeHidden()
  await page.keyboard.press('Escape')
  await expectUnlocked(page)
  await expect(image).toBeFocused()
})

test('clipboard denial produces truthful feedback without unhandled rejections', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new DOMException('Denied', 'NotAllowedError') } },
    })
  })
  await visit(page, '/en/template')
  await page.locator('article h2').first().click()
  await expect(page.locator('.heading-copy-toast')).toContainText('Could not copy')
  await page.locator('.mobile-action-bar button').last().click()
  await expect(page.locator('.mobile-action-bar .is-copied')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('double tap, pinch, bounded pan, cancellation and vertical dismissal remain isolated', async ({ page }) => {
  await visit(page, '/en/photos')
  await page.locator('.photos [role="button"]').first().click()
  const viewer = page.locator('.pswp')
  await expect(viewer).toHaveAttribute('data-ready', 'true')
  await page.touchscreen.tap(195, 400)
  await page.touchscreen.tap(195, 400)
  await expect(viewer).toHaveClass(/pswp--zoomed-in/)
  await expect(page.locator('.pswp__button--zoom')).toBeHidden()
  await page.touchscreen.tap(195, 400)
  await page.touchscreen.tap(195, 400)
  await expect(viewer).not.toHaveClass(/pswp--zoomed-in/)
  const session = await page.context().newCDPSession(page)
  const dispatch = (type: TouchEventType, points: { x: number, y: number }[]) => session.send('Input.dispatchTouchEvent', { type, touchPoints: points })
  await dispatch('touchStart', [{ x: 160, y: 400 }, { x: 230, y: 400 }])
  await dispatch('touchMove', [{ x: 120, y: 400 }, { x: 270, y: 400 }])
  await dispatch('touchMove', [{ x: 80, y: 400 }, { x: 310, y: 400 }])
  await dispatch('touchEnd', [])
  await expect(viewer).toHaveClass(/pswp--zoomed-in/)
  await dispatch('touchStart', [{ x: 195, y: 400 }])
  await dispatch('touchMove', [{ x: 150, y: 400 }])
  await dispatch('touchMove', [{ x: 120, y: 400 }])
  await dispatch('touchEnd', [])
  await expect(page.locator('.photo-lightbox-position')).toHaveText(`1 / ${gallerySize}`)
  const image = await page.locator('.pswp__item[aria-hidden="false"] img:not(.pswp__img--placeholder)').boundingBox()
  expect(image!.x + image!.width).toBeGreaterThan(0)
  expect(image!.x).toBeLessThan(390)
  await page.touchscreen.tap(195, 400)
  await page.touchscreen.tap(195, 400)
  await expect(viewer).not.toHaveClass(/pswp--zoomed-in/)
  await dispatch('touchStart', [{ x: 195, y: 400 }])
  await dispatch('touchCancel', [])
  await expect(page.locator('.photo-lightbox-position')).toHaveText(`1 / ${gallerySize}`)
  await dispatch('touchStart', [{ x: 195, y: 320 }])
  await dispatch('touchMove', [{ x: 195, y: 450 }])
  await dispatch('touchMove', [{ x: 195, y: 750 }])
  await dispatch('touchEnd', [])
  await expect(page.locator('.photo-lightbox-overlay')).toHaveCount(0)
  await expectUnlocked(page)
})

test('audio uses real nonoverlapping 44px controls at narrow widths and hides behind modals', async ({ page }) => {
  const samples = 80_000
  const wave = Buffer.alloc(44 + samples)
  wave.write('RIFF', 0)
  wave.writeUInt32LE(36 + samples, 4)
  wave.write('WAVEfmt ', 8)
  wave.writeUInt32LE(16, 16)
  wave.writeUInt16LE(1, 20)
  wave.writeUInt16LE(1, 22)
  wave.writeUInt32LE(8000, 24)
  wave.writeUInt32LE(8000, 28)
  wave.writeUInt16LE(1, 32)
  wave.writeUInt16LE(8, 34)
  wave.write('data', 36)
  wave.writeUInt32LE(samples, 40)
  wave.fill(128, 44)
  await page.route('**/mobile-fixture.wav', route => route.fulfill({ contentType: 'audio/wav', body: wave }))
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await visit(page, '/en/template')
    await page.evaluate(async () => {
      const path = '/tests/mobile/fixtures/audio.ts'
      const fixture = await import(path)
      fixture.mountAudio()
    })
    const inline = page.locator('[data-audio-fixture] .article-audio')
    await inline.locator('.article-audio-play').click()
    await expect(inline.locator('.article-audio-controls')).toHaveClass(/is-visible/)
    const check = async (selector: string) => {
      const rects = await page.locator(selector).evaluate(el => [...el.querySelectorAll<HTMLElement>('button, a')]
        .filter(button => button.getClientRects().length > 0)
        .map(button => button.getBoundingClientRect().toJSON()))
      for (let i = 0; i < rects.length; i++) {
        expect(rects[i].width).toBeGreaterThanOrEqual(44)
        expect(rects[i].height).toBeGreaterThanOrEqual(44)
        expect(rects[i].left).toBeGreaterThanOrEqual(0)
        expect(rects[i].right).toBeLessThanOrEqual(width)
        for (let j = i + 1; j < rects.length; j++) {
          const intersection = Math.min(rects[i].right, rects[j].right) - Math.max(rects[i].left, rects[j].left)
          const vertical = Math.min(rects[i].bottom, rects[j].bottom) - Math.max(rects[i].top, rects[j].top)
          expect(intersection <= 0 || vertical <= 0).toBe(true)
        }
      }
    }
    await check('[data-audio-fixture] .article-audio')
    await page.evaluate(() => window.scrollTo(0, 1500))
    await expect(page.locator('.article-audio-sticky')).toBeVisible()
    await check('.article-audio-sticky')
    await page.locator('.mobile-action-bar > button').click()
    await expect(page.locator('.mobile-toc-sheet')).toBeFocused()
    await expect(page.locator('.article-audio-sticky')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expectUnlocked(page)
  }
})

test('reduced-motion dots redraw after rotation, react to preference changes and pause for modals', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dg-art-override', 'dots')
    const state = window as Window & { drawCalls?: number }
    state.drawCalls = 0
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const original = prototype.drawElements
      prototype.drawElements = function (...args) {
        state.drawCalls = (state.drawCalls ?? 0) + 1
        return original.apply(this, args)
      }
    }
  })
  await visit(page, '/en/projects')
  await expect(page.locator('[data-art] canvas')).toBeVisible()
  const draws = () => page.evaluate(() => (window as Window & { drawCalls?: number }).drawCalls ?? 0)
  await expect.poll(draws).toBeGreaterThan(0)
  const initial = await draws()
  await page.setViewportSize({ width: 430, height: 844 })
  await expect.poll(draws).toBeGreaterThan(initial)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const beforeAnimation = await draws()
  await expect.poll(draws).toBeGreaterThan(beforeAnimation + 2)
  await page.evaluate(async () => {
    const path = '/src/logics/modal-manager.ts'
    const manager = await import(path)
    const layer = document.createElement('div')
    layer.id = 'art-motion-dialog'
    layer.tabIndex = -1
    layer.setAttribute('role', 'dialog')
    document.body.append(layer)
    manager.openModal('art-motion-test', null, () => {
      manager.closeModal('art-motion-test')
      layer.remove()
    })
    manager.setModalElement('art-motion-test', layer)
  })
  await expect(page.locator('#art-motion-dialog')).toBeFocused()
  const paused = await draws()
  await page.waitForTimeout(150)
  expect(await draws()).toBe(paused)
  await page.keyboard.press('Escape')
  await expect.poll(draws).toBeGreaterThan(paused)
})
