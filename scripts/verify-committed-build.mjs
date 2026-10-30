// Baut den COMMITTETEN Stand (HEAD) in einem leeren Verzeichnis.
//
// Warum: `npm run build` baut den Ordner, wie er auf der Platte liegt — samt
// Dateien, die nie committet wurden. Genau so scheiterte Vercel an
// "./screens/Strategy": lokal lag die Datei da, im Commit fehlte sie. Dieser
// Check sieht nur, was Vercel auch sieht. Aufruf vor dem Push: `npm run verify`.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: root, stdio: 'pipe', ...opts })

// Neue Dateien, die HEAD importieren könnte, die aber nicht im Commit stehen.
const missing = run('git', ['ls-files', '--others', '--exclude-standard'])
  .toString()
  .split('\n')
  .filter((f) => /^(src|public|api|scripts)\//.test(f))
if (missing.length) {
  console.warn(`Nicht versioniert:\n  ${missing.join('\n  ')}\n`)
}

const dir = mkdtempSync(join(tmpdir(), 'kniffel-verify-'))
try {
  // git archive packt genau den Stand von HEAD, ohne Arbeitsverzeichnis.
  const tar = run('git', ['archive', 'HEAD'], { maxBuffer: 1 << 28 })
  execFileSync('tar', ['-x', '-C', dir], { input: tar })
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'))
  execFileSync('npx', ['vite', 'build'], { cwd: dir, stdio: 'pipe' })
  console.log('OK: HEAD baut sauber.')
} catch (e) {
  const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim()
  console.error(`FEHLER: HEAD lässt sich nicht bauen.\n\n${out}`)
  process.exitCode = 1
} finally {
  rmSync(dir, { recursive: true, force: true })
}
