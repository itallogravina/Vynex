import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function flatten(obj, prefix = '') {
  const out = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatten(v, key))
    } else {
      out.push(key)
    }
  }
  return out
}

const base = process.cwd()
const ptBR = JSON.parse(readFileSync(join(base, 'src/locales/pt-BR.json'), 'utf8'))
const enUS = JSON.parse(readFileSync(join(base, 'src/locales/en-US.json'), 'utf8'))

const ptKeys = new Set(flatten(ptBR))
const enKeys = new Set(flatten(enUS))

const onlyInPt = [...ptKeys].filter(k => !enKeys.has(k))
const onlyInEn = [...enKeys].filter(k => !ptKeys.has(k))

let ok = true

if (onlyInPt.length > 0) {
  console.error('Keys in pt-BR.json but missing from en-US.json:')
  onlyInPt.forEach(k => console.error(`  - ${k}`))
  ok = false
}

if (onlyInEn.length > 0) {
  console.error('Keys in en-US.json but missing from pt-BR.json:')
  onlyInEn.forEach(k => console.error(`  - ${k}`))
  ok = false
}

if (ok) {
  console.log(`✓ pt-BR and en-US are in parity (${ptKeys.size} keys each)`)
  process.exit(0)
} else {
  process.exit(1)
}
