interface PhotoConnection extends EventTarget {
  saveData?: boolean
  effectiveType?: string
  downlink?: number
}

export function getPhotoConnection() {
  return typeof navigator === 'undefined'
    ? undefined
    : (navigator as Navigator & { connection?: PhotoConnection }).connection
}

export function canPrefetchPhotos() {
  if (typeof document === 'undefined' || document.hidden)
    return false
  const connection = getPhotoConnection()
  return !connection?.saveData
    && !['slow-2g', '2g'].includes(connection?.effectiveType ?? '')
    && !(connection?.downlink && connection.downlink < 1)
}

let viewerModule: Promise<typeof import('photoswipe')> | undefined

/** Shared by intentional hover/focus warmup and actual opening; failures can retry. */
export function loadPhotoViewer() {
  viewerModule ??= import('photoswipe').catch((error) => {
    viewerModule = undefined
    throw error
  })
  return viewerModule
}

interface PhotoTask {
  image: HTMLImageElement
  start: () => void
  started: boolean
  cleanup: () => void
}

interface PhotoJob {
  url: string
  tasks: Set<PhotoTask>
  active: boolean
}

// Share the budget across galleries and PhotoSwipe. Cache bytes in the browser,
// not in a second Blob cache. Concurrent consumers of a URL share one queue job.
const jobs = new Map<string, PhotoJob>()
const maxSpeculativeLoads = 2
let activeLoads = 0

function finishJob(job: PhotoJob) {
  if (jobs.get(job.url) !== job)
    return
  // A consumer may have joined just before the existing image finished.
  for (const task of job.tasks) {
    if (!task.started)
      startTask(job, task)
    task.cleanup()
  }
  jobs.delete(job.url)
  activeLoads--
  queueMicrotask(drainQueue)
}

function startTask(job: PhotoJob, task: PhotoTask) {
  if (task.started || !job.tasks.has(task))
    return
  task.started = true
  task.image.fetchPriority = 'low'
  task.image.decoding = 'async'
  const complete = () => queueMicrotask(() => finishJob(job))
  task.image.addEventListener('load', complete, { once: true })
  task.image.addEventListener('error', complete, { once: true })
  task.cleanup = () => {
    task.image.removeEventListener('load', complete)
    task.image.removeEventListener('error', complete)
  }
  try {
    task.start()
    if (!task.image.getAttribute('src') || task.image.complete)
      complete()
  }
  catch (error) {
    complete()
    console.error('Unable to preload photo', error)
  }
}

function drainQueue() {
  if (!canPrefetchPhotos())
    return
  for (const job of jobs.values()) {
    if (!job.active) {
      if (activeLoads >= maxSpeculativeLoads)
        continue
      job.active = true
      activeLoads++
    }
    for (const task of job.tasks)
      startTask(job, task)
  }
}

/** Only queued work is cancellable; already-started image requests may finish. */
export function queuePhotoPrefetch(url: string, image: HTMLImageElement, start: () => void) {
  if (!canPrefetchPhotos())
    return () => {}
  const job = jobs.get(url) ?? { url, tasks: new Set<PhotoTask>(), active: false }
  jobs.set(url, job)
  const task: PhotoTask = { image, start, started: false, cleanup: () => {} }
  job.tasks.add(task)
  // Never start synchronously: consumers must finish registering their state.
  queueMicrotask(drainQueue)
  return () => {
    if (!task.started) {
      job.tasks.delete(task)
      if (!job.active && !job.tasks.size && jobs.get(url) === job)
        jobs.delete(url)
    }
  }
}

/** Explicit navigation bypasses the speculative queue and upgrades in-flight work. */
export function prioritizePhoto(url: string) {
  const job = jobs.get(url)
  if (!job)
    return
  for (const task of job.tasks) {
    if (task.started)
      task.image.fetchPriority = 'high'
    else
      job.tasks.delete(task)
  }
  if (!job.active)
    jobs.delete(url)
}
