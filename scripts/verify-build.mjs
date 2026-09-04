import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Trava de segurança do build de produção.
 *
 * O Vite carrega `.env.local` em qualquer modo, inclusive no `build`. Se um
 * arquivo de teste com VITE_USE_FIREBASE_EMULATOR=true sobrar na pasta, o site
 * publicado tenta falar com 127.0.0.1 na máquina de quem abrir a página — e
 * todo login morre com "auth/network-request-failed", sem nenhum sinal no
 * build. Já aconteceu; por isso o build agora falha alto em vez de publicar.
 */
const EMULATOR_MARKERS = ['127.0.0.1:9099', '127.0.0.1:8080', 'connectAuthEmulator', 'demo-shadowlords']

const assetsDir = join('dist', 'assets')
let files
try {
  files = readdirSync(assetsDir).filter((f) => f.endsWith('.js'))
} catch {
  console.error('✗ verify-build: pasta dist/assets não encontrada — o build não gerou saída.')
  process.exit(1)
}

const problems = []
for (const file of files) {
  const content = readFileSync(join(assetsDir, file), 'utf8')
  for (const marker of EMULATOR_MARKERS) {
    if (content.includes(marker)) problems.push(`${file}: contém "${marker}"`)
  }
}

if (problems.length) {
  console.error('\n✗ Build de produção contaminado com configuração de emulador:')
  for (const p of problems) console.error(`   - ${p}`)
  console.error('\n  Provável causa: um arquivo .env.local com VITE_USE_FIREBASE_EMULATOR=true.')
  console.error('  Apague o .env.local e rode o build de novo antes de publicar.\n')
  process.exit(1)
}

console.log('✓ verify-build: bundle limpo, apontando para o Firebase de produção.')
