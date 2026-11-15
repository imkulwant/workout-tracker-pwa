// Fails when the gzipped JavaScript of a production build is over the plan's
// 250 KB target. Run after `npm run build`.
import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const LIMIT_BYTES = 250 * 1024
const dir = new URL('../dist/assets/', import.meta.url)

const files = readdirSync(dir).filter((name) => name.endsWith('.js'))
if (files.length === 0) {
  console.error('No JavaScript found in dist/assets. Run npm run build first.')
  process.exit(1)
}

let total = 0
for (const name of files) {
  const gzipped = gzipSync(readFileSync(new URL(name, dir)), { level: 9 }).length
  total += gzipped
  console.log(`${name}: ${(gzipped / 1024).toFixed(1)} KB gzipped`)
}
console.log(
  `Total: ${(total / 1024).toFixed(1)} KB gzipped, limit ${LIMIT_BYTES / 1024} KB`,
)
if (total > LIMIT_BYTES) {
  console.error('The JavaScript bundle is over its size limit.')
  process.exit(1)
}
