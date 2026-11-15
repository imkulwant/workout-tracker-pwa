// Serves dist/ the way GitHub Pages serves a project site, so the e2e suite
// meets the same hosting behaviour as production:
//   - the site lives under a path prefix, and the bare prefix redirects to it
//   - an unknown path is a real 404 that returns 404.html (no index fallback)
//   - every response carries `cache-control: max-age=600` and no other policy
// `vite preview` cannot show any of this, because it falls back to index.html.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT ?? 4173)
const BASE = process.env.BASE_PATH ?? '/workout-tracker-pwa/'
const ROOT = fileURLToPath(new URL('../dist/', import.meta.url))

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

async function send(res, status, file, method) {
  const body = await readFile(file)
  res.writeHead(status, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'max-age=600',
  })
  res.end(method === 'HEAD' ? undefined : body)
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`)

  if (pathname === BASE.slice(0, -1)) {
    res.writeHead(301, { location: BASE })
    return res.end()
  }

  if (pathname.startsWith(BASE)) {
    let relative = decodeURIComponent(pathname.slice(BASE.length))
    if (relative === '' || relative.endsWith('/')) relative += 'index.html'
    const file = normalize(join(ROOT, relative))
    if (file.startsWith(ROOT)) {
      try {
        if ((await stat(file)).isFile())
          return await send(res, 200, file, req.method)
      } catch {
        // Falls through to the 404 below.
      }
    }
    return await send(res, 404, join(ROOT, '404.html'), req.method)
  }

  res.writeHead(404, { 'content-type': 'text/plain' })
  res.end('Not found')
}).listen(PORT, () => {
  console.log(
    `Serving dist/ like GitHub Pages at http://localhost:${PORT}${BASE}`,
  )
})
