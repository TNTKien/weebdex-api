import { Hono } from "hono";
import { cors } from "hono/cors";

const TARGET_BASE = "https://api.weebdex.org";
const WEEBDEX_ORIGIN = "https://weebdex.org";
const WEEBDEX_REFERER = "https://weebdex.org/";
const WEEBDEX_COVER_ORIGIN = "https://srv.weebdex.net";

// Node cache: chapterid -> { node, expiresAt }
const NODE_CACHE_TTL_MS = 1800000; // 30 minutes
const nodeCache = new Map<string, { node: string; expiresAt: number }>();

const PASSTHROUGH_HEADERS = [
  "authorization",
  "cookie",
  "content-type",
  "accept",
  "accept-language",
];

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "Cookie"],
    exposeHeaders: ["Content-Length", "Content-Type"],
    maxAge: 86400,
  }),
);

// Cover images
app.get("/covers/:mangaid/:filename", async (c) => {
  const { mangaid, filename } = c.req.param();
  const targetUrl = `${WEEBDEX_COVER_ORIGIN}/covers/${mangaid}/${filename}`;

  const headers = new Headers({
    origin: WEEBDEX_ORIGIN,
    referer: WEEBDEX_REFERER,
  });

  const response = await fetch(targetUrl, {
    method: "GET",
    headers,
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
});

// Chapter Page Image
app.get("/data/:chapterid/:filename", async (c) => {
  const { chapterid, filename } = c.req.param();

  // Resolve node from cache or fetch from API
  let node: string | undefined;
  const cached = nodeCache.get(chapterid);
  if (cached && cached.expiresAt > Date.now()) {
    node = cached.node;
  } else {
    const chapterRes = await fetch(`${TARGET_BASE}/chapter/${chapterid}`, {
      headers: {
        Origin: WEEBDEX_ORIGIN,
        Referer: WEEBDEX_REFERER,
      },
    });
    if (!chapterRes.ok) {
      return c.json({ error: "Failed to fetch chapter info" }, 502);
    }

    const chapter = (await chapterRes.json()) as { node?: string };
    node = chapter?.node;

    if (!node) {
      return c.json({ error: "Node not found in chapter data" }, 404);
    }

    nodeCache.set(chapterid, {
      node,
      expiresAt: Date.now() + NODE_CACHE_TTL_MS,
    });
  }
  const targetUrl = `${node}/data/${chapterid}/${filename}`;

  const response = await fetch(targetUrl, {
    headers: {
      Origin: WEEBDEX_ORIGIN,
      Referer: WEEBDEX_REFERER,
    },
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
});

// Other API endpoints
app.all("*", async (c) => {
  const url = new URL(c.req.url);
  const targetUrl = `${TARGET_BASE}${url.pathname}${url.search}`;

  const headers = new Headers({
    origin: WEEBDEX_ORIGIN,
    referer: WEEBDEX_REFERER,
  });

  for (const name of PASSTHROUGH_HEADERS) {
    const value = c.req.header(name);
    if (value) headers.set(name, value);
  }

  const body =
    c.req.method === "GET" || c.req.method === "HEAD"
      ? undefined
      : await c.req.arrayBuffer();

  const response = await fetch(targetUrl, {
    method: c.req.method,
    headers,
    body,
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
});

export default app;
