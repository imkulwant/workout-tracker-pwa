import { describe, expect, it } from 'vitest'
import { CONTENT_SECURITY_POLICY } from '../../csp.ts'

const directives = new Map(
  CONTENT_SECURITY_POLICY.split(';')
    .map((part) => part.trim().split(/\s+/))
    .filter(([name]) => name)
    .map(([name, ...sources]) => [name!, sources] as const),
)

describe('Content-Security-Policy', () => {
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

  it('also locks down base URIs and form targets', () => {
    expect(directives.get('base-uri')).toEqual(["'self'"])
    expect(directives.get('form-action')).toEqual(["'self'"])
  })

  it('allows nothing but this origin or none, anywhere', () => {
    for (const [name, sources] of directives) {
      for (const source of sources) {
        expect(["'self'", "'none'"], `${name} ${source}`).toContain(source)
      }
    }
    expect(CONTENT_SECURITY_POLICY).not.toMatch(
      /unsafe-|\*|https?:|data:|blob:/,
    )
  })

  it('leaves out directives a <meta> policy cannot carry', () => {
    // Browsers ignore these in a <meta> tag and log a console error.
    for (const name of ['frame-ancestors', 'report-uri', 'sandbox']) {
      expect(directives.has(name), name).toBe(false)
    }
  })
})
