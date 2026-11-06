declare module 'markdown-it-table-of-contents' {
  const plugin: (md: any, options?: Record<string, unknown>) => void
  export default plugin
}

declare module '*.svg?component' {
  const component: import('vue').DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  twttr?: {
    widgets?: {
      load: (element?: Element | null) => Promise<unknown> | void
    }
  }
}
