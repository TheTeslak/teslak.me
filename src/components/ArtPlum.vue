<script setup lang='ts'>
import type { Fn } from '@vueuse/core'
import { useArtMotion } from '~/logics/art-motion'
import { useArtResize } from '~/logics/art-resize'

const r180 = Math.PI
const r90 = Math.PI / 2
const r15 = Math.PI / 12
const color = '#88888825'

const el = ref<HTMLCanvasElement | null>(null)

const { random } = Math
const size = reactive(useWindowSize())

const start = ref<Fn>(() => {})
const MIN_BRANCH = 30
const len = ref(6)
const stopped = ref(false)

type VendorCanvasRenderingContext2D = CanvasRenderingContext2D & {
  backingStorePixelRatio?: number
  mozBackingStorePixelRatio?: number
  msBackingStorePixelRatio?: number
  oBackingStorePixelRatio?: number
  webkitBackingStorePixelRatio?: number
}

function initCanvas(canvas: HTMLCanvasElement, width = 400, height = 400, _dpi?: number) {
  const ctx = canvas.getContext('2d')! as VendorCanvasRenderingContext2D

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const bsr = ctx.webkitBackingStorePixelRatio || ctx.mozBackingStorePixelRatio || ctx.msBackingStorePixelRatio || ctx.oBackingStorePixelRatio || ctx.backingStorePixelRatio || 1

  const dpi = _dpi || dpr / bsr

  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  canvas.width = dpi * width
  canvas.height = dpi * height
  ctx.scale(dpi, dpi)

  return { ctx, dpi }
}

function polar2cart(x = 0, y = 0, r = 0, theta = 0) {
  const dx = r * Math.cos(theta)
  const dy = r * Math.sin(theta)
  return [x + dx, y + dy]
}

onMounted(async () => {
  const canvas = el.value!
  const { ctx } = initCanvas(canvas, size.width, size.height)
  interface Branch {
    dx: number
    dy: number
    right: boolean
    bottom: boolean
    segments: [number, number, number, number][]
  }
  const branches: Branch[] = []
  let oldWidth = size.width
  let oldHeight = size.height
  let segmentCount = 0
  const MAX_SEGMENTS = 20000

  let steps: Fn[] = []
  let prevSteps: Fn[] = []

  const step = (branch: Branch, x: number, y: number, rad: number, counter: { value: number } = { value: 0 }) => {
    const length = random() * len.value
    counter.value += 1

    const [nx, ny] = polar2cart(x, y, length, rad)

    ctx.beginPath()
    ctx.moveTo(x + branch.dx, y + branch.dy)
    ctx.lineTo(nx + branch.dx, ny + branch.dy)
    ctx.stroke()
    branch.segments.push([x, y, nx, ny])
    segmentCount++

    const rad1 = rad + random() * r15
    const rad2 = rad - random() * r15

    // out of bounds
    if (segmentCount >= MAX_SEGMENTS || nx + branch.dx < -100 || nx + branch.dx > size.width + 100 || ny + branch.dy < -100 || ny + branch.dy > size.height + 100)
      return

    const rate = counter.value <= MIN_BRANCH
      ? 0.8
      : 0.5

    // left branch
    if (random() < rate)
      steps.push(() => step(branch, nx, ny, rad1, counter))

    // right branch
    if (random() < rate)
      steps.push(() => step(branch, nx, ny, rad2, counter))
  }

  let lastTime = performance.now()
  const interval = 1000 / 40 // 50fps

  let controls: ReturnType<typeof useRafFn>

  const frame = () => {
    if (performance.now() - lastTime < interval)
      return

    prevSteps = steps
    steps = []
    lastTime = performance.now()

    if (!prevSteps.length) {
      controls.pause()
      stopped.value = true
    }

    // Execute all the steps from the previous frame
    prevSteps.forEach((i) => {
      // 50% chance to keep the step for the next frame, to create a more organic look
      if (random() < 0.5)
        steps.push(i)
      else
        i()
    })
  }

  controls = useRafFn(frame, { immediate: false })

  /**
   * 0.2 - 0.8
   */
  const randomMiddle = () => random() * 0.6 + 0.2

  function renderStatic() {
    // Bound actual draw calls, not generations of a branching work queue.
    let remaining = 4000
    while (steps.length && remaining > 0) {
      const nextSteps = steps
      steps = []
      for (const fn of nextSteps) {
        if (remaining-- <= 0)
          break
        fn()
      }
    }
    steps = []
    stopped.value = true
  }
  const motion = useArtMotion(controls, renderStatic, stopped)

  start.value = () => {
    controls.pause()
    ctx.clearRect(0, 0, size.width, size.height)
    ctx.lineWidth = 1
    ctx.strokeStyle = color
    prevSteps = []
    branches.length = 0
    segmentCount = 0
    const roots = [
      { x: randomMiddle() * size.width, y: -5, rad: r90, edge: 'top' },
      { x: randomMiddle() * size.width, y: size.height + 5, rad: -r90, edge: 'bottom' },
      { x: -5, y: randomMiddle() * size.height, rad: 0, edge: 'left' },
      { x: size.width + 5, y: randomMiddle() * size.height, rad: r180, edge: 'right' },
    ]
    if (size.width < 500)
      roots.length = 2
    steps = roots.map(({ x, y, rad, edge }) => {
      const branch: Branch = { dx: 0, dy: 0, right: edge === 'right' || (edge !== 'left' && x >= size.width / 2), bottom: edge === 'bottom' || (edge !== 'top' && y >= size.height / 2), segments: [] }
      branches.push(branch)
      return () => step(branch, x, y, rad)
    })

    if (motion.reducedMotion.value) {
      renderStatic()
    }
    else {
      stopped.value = false
      if (motion.shouldAnimate.value)
        controls.resume()
    }
  }

  let snapshot: HTMLCanvasElement | undefined
  useArtResize(() => {
    snapshot?.remove()
    snapshot = undefined
    if (!motion.reducedMotion.value && canvas.parentElement) {
      const previous = document.createElement('canvas')
      previous.width = canvas.width
      previous.height = canvas.height
      previous.style.cssText = `position:absolute;left:0;top:0;width:${oldWidth}px;height:${oldHeight}px;pointer-events:none`
      previous.getContext('2d')?.drawImage(canvas, 0, 0)
      canvas.parentElement.appendChild(previous)
      snapshot = previous
      const fade = previous.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out' })
      fade.onfinish = () => previous.remove()
    }
    const dw = size.width - oldWidth
    const dh = size.height - oldHeight
    oldWidth = size.width
    oldHeight = size.height
    for (const branch of branches) {
      if (branch.right)
        branch.dx += dw
      if (branch.bottom)
        branch.dy += dh
    }
    initCanvas(canvas, size.width, size.height)
    ctx.lineWidth = 1
    ctx.strokeStyle = color
    for (const branch of branches) {
      for (const [x, y, nx, ny] of branch.segments) {
        ctx.beginPath()
        ctx.moveTo(x + branch.dx, y + branch.dy)
        ctx.lineTo(nx + branch.dx, ny + branch.dy)
        ctx.stroke()
      }
    }
  })
  start.value()
})
const mask = computed(() => 'radial-gradient(circle, transparent, black);')
</script>

<template>
  <div
    class="fixed top-0 bottom-0 left-0 right-0 pointer-events-none print:hidden"
    style="z-index: -1"
    :style="`mask-image: ${mask};--webkit-mask-image: ${mask};`"
  >
    <canvas ref="el" width="400" height="400" aria-hidden="true" />
  </div>
</template>
