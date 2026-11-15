import { describe, expect, it } from 'vitest'
import headersFile from '../../public/_headers?raw'

/** Parses Cloudflare's `_headers` syntax: a path line, then indented headers. */
function parse(text: string): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>()
  let current: Map<string, string> | undefined
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    if (!/^\s/.test(line)) {
      current = new Map()
      rules.set(line.trim(), current)
    } else if (current) {
      const colon = line.indexOf(':')
      current.set(
        line.slice(0, colon).trim().toLowerCase(),
        line.slice(colon + 1).trim(),
      )
    }
  }
  return rules
}

const rules = parse(headersFile)
const header = (path: string, name: string) =>
  rules.get(path)?.get(name.toLowerCase())

describe('public/_headers cache rules', () => {
  it.each([
    '/',
    '/index.html',
    '/sw.js',
    '/registerSW.js',
    '/manifest.webmanifest',
  ])('never caches %s, so a new release is seen on the next launch', (path) => {
    expect(header(path, 'Cache-Control')).toBe('no-cache')
  })

  it('caches hashed build assets for a year, immutable', () => {
    expect(header('/assets/*', 'Cache-Control')).toBe(
      'public, max-age=31536000, immutable',
    )
  })

  it('sets no Cache-Control on /*, because Cloudflare joins duplicate headers with a comma', () => {
    expect(rules.get('/*')?.has('cache-control')).toBe(false)
  })
})

describe('public/_headers security headers', () => {
  it('applies the security headers to every path', () => {
    expect(header('/*', 'X-Content-Type-Options')).toBe('nosniff')
    expect(header('/*', 'Referrer-Policy')).toBe('no-referrer')
    expect(header('/*', 'Content-Security-Policy')).toBeTruthy()
  })
})

describe('Content-Security-Policy', () => {
  const policy = header('/*', 'Content-Security-Policy') ?? ''
  const directives = new Map(
    policy
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name!, sources] as const),
  )

  it('restricts every fetch type to this origin, and plugins to nothing', () => {
    for (const name of [
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'font-src',
      'connect-src',
      'manifest-src',
      'worker-src',
    ]) {
      expect(directives.get(name), name).toEqual(["'self'"])
    }
    expect(directives.get('object-src')).toEqual(["'none'"])
  })

  it('also locks down base URIs, form targets and framing', () => {
    expect(directives.get('base-uri')).toEqual(["'self'"])
    expect(directives.get('form-action')).toEqual(["'self'"])
    expect(directives.get('frame-ancestors')).toEqual(["'none'"])
  })

  it('allows nothing but this origin or none, anywhere', () => {
    for (const [name, sources] of directives) {
      for (const source of sources) {
        expect(["'self'", "'none'"], `${name} ${source}`).toContain(source)
      }
    }
    expect(policy).not.toMatch(/unsafe-|\*|https?:|data:|blob:/)
  })
})

describe('Cloudflare Pages limits', () => {
  it('stays within 100 rules and 2000 characters per line', () => {
    expect(rules.size).toBeLessThanOrEqual(100)
    for (const line of headersFile.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(2000)
    }
  })
})
