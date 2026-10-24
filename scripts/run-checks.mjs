// Roda as checagens das regras puras (src/**/*.check.ts).
//
// Cada arquivo de checagem é empacotado com o rolldown (que já vem com o
// Vite) num módulo só e executado no Node. A checagem falha jogando um erro;
// o processo sai com código 1 se qualquer uma falhar.
import { readdirSync } from 'node:fs'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'rolldown'

function find(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? find(join(dir, d.name)) : d.name.endsWith('.check.ts') ? [join(dir, d.name)] : [],
  )
}

const files = find('src')
const out = mkdtempSync(join(tmpdir(), 'checks-'))
let failed = 0
try {
  for (const file of files) {
    const target = join(out, file.replace(/[\\/]/g, '_') + '.mjs')
    await build({ input: file, output: { file: target, format: 'esm' }, logLevel: 'silent' })
    try {
      await import(pathToFileURL(target).href)
      console.log(`✓ ${file}`)
    } catch (err) {
      failed++
      console.error(`✗ ${file}\n  ${err instanceof Error ? err.message : err}`)
    }
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}
if (failed) process.exit(1)
