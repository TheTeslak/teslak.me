import type { Photo } from '../../photos/data'
import { openLightbox } from './lightbox'

export function openPhoto(photos: Photo[], index: number, event: MouseEvent) {
  openLightbox(photos.map(photo => ({
    url: photo.url,
    thumbnailUrl: photo.thumbnailUrl,
    width: photo.width,
    height: photo.height,
    alt: photo.text || photo.name,
    title: photo.text,
    name: photo.name,
  })), index, event.currentTarget as HTMLElement)
}
