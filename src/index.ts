import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

const TARGET_BASE = 'https://api.weebdex.org'
const WEEBDEX_ORIGIN = 'https://weebdex.org'
const WEEBDEX_REFERER = 'https://weebdex.org/'
const WEEBDEX_COVER_ORIGIN = 'https://srv.weebdex.net'

app.use('*', cors())

// Cover images
app.get('/covers/:mangaid/:filename', async (c) => {
  const { mangaid, filename } = c.req.param()
  const targetUrl = `${WEEBDEX_COVER_ORIGIN}/covers/${mangaid}/${filename}`

  const response = await fetch(targetUrl, {
    headers: {
      Origin: WEEBDEX_ORIGIN,
      Referer: WEEBDEX_REFERER,
    },
  })

  const responseHeaders = new Headers(response.headers)
  for (const key of [
    'access-control-allow-origin',
    'access-control-allow-credentials',
    'access-control-allow-headers',
    'access-control-allow-methods',
    'access-control-max-age',
    'access-control-expose-headers',
    'content-encoding',
    'content-length',
  ]) {
    responseHeaders.delete(key)
  }

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  })
})

// Other API endpoints
app.all('*', async (c) => {
  const url = new URL(c.req.url)
  const targetUrl = TARGET_BASE + url.pathname + url.search

  const HOP_BY_HOP = new Set([
    'host',
    'connection',
    'keep-alive',
    'transfer-encoding',
    'te',
    'trailer',
    'proxy-authorization',
    'proxy-authenticate',
    'upgrade',
  ])

  const headers = new Headers()
  for (const [key, value] of c.req.raw.headers.entries()) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value)
    }
  }
  headers.set('Origin', WEEBDEX_ORIGIN)
  headers.set('Referer', WEEBDEX_REFERER)

  const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
  const response = await fetch(targetUrl, {
    method: c.req.method,
    headers,
    body: BODY_METHODS.has(c.req.method) ? await c.req.raw.arrayBuffer() : undefined,
  })

  const responseHeaders = new Headers(response.headers)
  for (const key of [
    'access-control-allow-origin',
    'access-control-allow-credentials',
    'access-control-allow-headers',
    'access-control-allow-methods',
    'access-control-max-age',
    'access-control-expose-headers',
    // Node.js fetch auto-decompresses the body; remove these so the browser
    // does not attempt to decompress an already-decoded response.
    'content-encoding',
    'content-length',
  ]) {
    responseHeaders.delete(key)
  }

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  })
})

serve({
  fetch: app.fetch,
  port: 3637,
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
