import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import { test } from 'node:test'
import { queuePhotoPrefetch } from '../src/logics/photo-loading'

class FakeImage extends EventTarget {
  fetchPriority = ''
  decoding = ''
  complete = false
  src = ''

  getAttribute(name: string) {
    return name === 'src' ? this.src : null
  }
}

test('prefetch keeps a URL active until all consumers finish and cancels queued work', async () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { hidden: false } })
  const flush = async () => {
    await new Promise<void>(resolve => setImmediate(resolve))
  }
  const started: string[] = []
  const enqueue = (url: string, label: string) => {
    const image = new FakeImage()
    const cancel = queuePhotoPrefetch(url, image as unknown as HTMLImageElement, () => {
      started.push(label)
      image.src = url
    })
    return { image, cancel }
  }
  try {
    const first = enqueue('a', 'first')
    const second = enqueue('a', 'second')
    const other = enqueue('b', 'other')
    await flush()
    const late = enqueue('a', 'late')
    const waiting = enqueue('c', 'waiting')
    const cancelled = enqueue('d', 'cancelled')
    cancelled.cancel()
    first.image.dispatchEvent(new Event('load'))
    await flush()
    assert.deepEqual(started, ['first', 'second', 'other', 'late'])
    second.image.dispatchEvent(new Event('error'))
    await flush()
    assert.deepEqual(started, ['first', 'second', 'other', 'late'])
    late.image.dispatchEvent(new Event('load'))
    await flush()
    assert.deepEqual(started, ['first', 'second', 'other', 'late', 'waiting'])
    other.image.dispatchEvent(new Event('load'))
    waiting.image.dispatchEvent(new Event('load'))
    await flush()
  }
  finally {
    if (previousDocument)
      Object.defineProperty(globalThis, 'document', previousDocument)
    else
      Reflect.deleteProperty(globalThis, 'document')
  }
})
