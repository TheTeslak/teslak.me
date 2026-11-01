export interface Post {
  path: string
  title: string
  backlink?: string | string[]
  place?: string
  date: string
  updated?: string
  lang?: string
  desc?: string
  duration?: number | string
  redirect?: string
  type?: string
  audio?: ArticleAudio
}

export interface ArticleAudio {
  url: string
  sourceTextUpdatedAt?: string
  duration?: string
  title?: string
  artist?: string
  downloadUrl?: string
}
