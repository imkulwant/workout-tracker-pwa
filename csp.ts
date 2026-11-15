/**
 * The Content-Security-Policy of the built app: every source is this origin,
 * or nothing. It is injected into index.html as a <meta> tag at build time
 * (see vite.config.ts), because GitHub Pages cannot send custom headers.
 *
 * A <meta> policy cannot carry `frame-ancestors`, which browsers ignore there,
 * so it is left out. It also cannot replace `X-Content-Type-Options`.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')
