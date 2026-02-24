import { Hono } from 'hono'
import { cors } from 'hono/cors'

const API_BASE = 'https://api.weebdex.org'

const PASSTHROUGH_HEADERS = [
  'authorization',
  'cookie',
  'content-type',
  'accept',
  'accept-language',
]

const app = new Hono()

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'Cookie'],
    exposeHeaders: ['Content-Length', 'Content-Type'],
    maxAge: 86400,
  })
)

app.all('*', async (c) => {
  const url = new URL(c.req.url)
  const targetUrl = `${API_BASE}${url.pathname}${url.search}`

  const headers = new Headers({
    origin: 'https://weebdex.org',
    referer: 'https://weebdex.org/',
  })

  for (const name of PASSTHROUGH_HEADERS) {
    const value = c.req.header(name)
    if (value) headers.set(name, value)
  }

  const body =
    c.req.method === 'GET' || c.req.method === 'HEAD'
      ? undefined
      : await c.req.arrayBuffer()

  const response = await fetch(targetUrl, {
    method: c.req.method,
    headers,
    body,
  })

  const responseHeaders = new Headers(response.headers)
  responseHeaders.delete('content-encoding')

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  })
})

export default app
