import { LOCALE_COOKIE_NAME } from '../src/locales/config.ts'
import { negotiateLocale } from '../src/locales/negotiation.ts'

interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const cookieHeader = request.headers.get('Cookie') || ''
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE_NAME}=([^;]*)`))
      const cookieLocale = match ? decodeURIComponent(match[1]) : undefined
      const acceptLang = request.headers.get('Accept-Language')

      const targetLocale = negotiateLocale(cookieLocale, acceptLang)
      url.pathname = `/${targetLocale}`

      return new Response(null, {
        status: 307,
        headers: {
          'Location': url.toString(),
          'Cache-Control': 'private, no-cache',
          'Vary': 'Accept-Language, Cookie',
        },
      })
    }

    return env.ASSETS.fetch(request)
  },
}
