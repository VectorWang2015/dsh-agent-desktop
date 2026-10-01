import assert from 'node:assert/strict'
import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFile(resolve(root, path), 'utf8')
const manifest = JSON.parse(await read('package.json'))
assert.equal(manifest.name, 'dsh-agent-desktop')
assert.equal(manifest.type, 'module')
assert.equal(manifest.engines.dsh, '0.1.7-rc.2')
assert.equal(manifest.dsh.engines, undefined, 'Compatibility belongs under top-level engines')
assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
assert.equal(manifest.dsh.client.platform, 'web')
assert.equal(manifest.exports['./client'], './lib/client.js')
assert.equal(manifest.exports['./locale/*.json'], './locale/*.json')
assert.equal(manifest.exports['./package.json'], './package.json')
for (const hook of ['prepare', 'preinstall', 'install', 'postinstall']) assert.equal(manifest.scripts[hook], undefined, `Installation must not run ${hook}`)
for (const [name, version] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })) {
  assert(!/^(?:link|file|workspace):/.test(version), `Non-portable dependency: ${name}`)
}
assert(!/(?:^|[\s'"])(?:link|file):|\/home\/|deepseek-harness-0\.1\.7-rc\.2\//m.test(await read('pnpm-lock.yaml')), 'Lockfile depends on local paths')

const expected = [
  'lib/index.js', 'lib/client.js', 'lib/client.css', 'runtime/desktop_worker.py',
  'scripts/setup-native.py', 'scripts/setup-native.sh', 'assets/icon.svg',
  'locale/en.json', 'locale/zh.json', 'cordis.patch.yml', 'README.md', 'USAGE.md',
  'LICENSE', 'THIRD_PARTY_NOTICES.md', 'docs/architecture.md', 'docs/validation.md',
  'docs/plugin-compliance.md', 'examples/first-task.zh.md', 'examples/desktop-demo.py',
]
assert.deepEqual([...manifest.files].sort(), expected.sort(), 'Publication files must be explicitly reviewed')
for (const path of manifest.files) assert((await stat(resolve(root, path))).isFile(), `Missing package file: ${path}`)
assert.match(await read('cordis.patch.yml'), /name:\s*dsh-agent-desktop/)
for (const language of ['en', 'zh']) {
  const dictionary = JSON.parse(await read(`locale/${language}.json`))
  assert(dictionary.meta.title && dictionary.meta.description)
}
assert.equal(manifest.icon, './assets/icon.svg')
assert((await stat(resolve(root, manifest.icon))).size < 256 * 1024)
const icon = await read(manifest.icon)
assert(!/<script\b|\bon\w+=|(?:href|src)=/i.test(icon), 'Icon must be self-contained, without active content')

const client = await read('lib/client.js')
const baseline = new Set(['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-primitives'])
for (const match of client.matchAll(/\brequire\(["']([^"']+)["']\)/g)) assert(baseline.has(match[1]), `Unexpected browser external: ${match[1]}`)
let row
runInNewContext(client, { window: { __ModuleLoader__: { load(value) { assert.equal(row, undefined); row = value } } } }, { timeout: 1000 })
assert.equal(row?.id, manifest.name)
assert.equal(typeof row?.factory, 'function')
const host = await import(new URL('../lib/index.js', import.meta.url))
for (const key of ['name', 'inject', 'Config', 'apply']) assert(key in host, `Missing Host export: ${key}`)
assert(!('default' in host), 'Do not mix named function plugin with default export')

async function publicFiles(directory) {
  const result = []
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    if (entry.name === '__pycache__') continue
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) result.push(...await publicFiles(path))
    else if (/\.(?:ts|tsx|css|md|py|mjs|sh|json|svg)$/.test(entry.name)) result.push(path)
  }
  return result
}
const publicPaths = new Set(['README.md', 'USAGE.md', 'THIRD_PARTY_NOTICES.md', 'package.json', 'pnpm-lock.yaml', 'cordis.patch.yml', ...manifest.files])
for (const dir of ['src', 'tests', 'runtime', 'scripts', 'docs', 'examples', 'locale', 'assets']) for (const path of await publicFiles(dir)) publicPaths.add(path)
for (const path of publicPaths) {
  const text = await read(path)
  assert(!/\/home\/[a-z][^\s"'<>]*/i.test(text), `Machine-specific home path in ${path}`)
  assert(!/session-[0-9a-f]{8}-[0-9a-f-]{27,}/i.test(text), `Private session identity in ${path}`)
  assert(!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text), `Private key material in ${path}`)
  assert(!new RegExp('source' + 'MappingURL=').test(text), `Source-map trailer in ${path}`)
  if (!path.endsWith('.md')) continue
  for (const match of text.matchAll(/\]\(<?([^\s)>]+)>?\)/g)) {
    const target = match[1].split('#')[0]
    if (!target || /^[a-z][a-z\d+.-]*:/i.test(target)) continue
    const full = resolve(root, dirname(path), decodeURIComponent(target))
    assert(!relative(root, full).startsWith('..'), `Documentation link escapes repository: ${path}`)
    assert((await stat(full)).isFile(), `Broken document link: ${path} -> ${target}`)
  }
}
console.log(`Package checks passed: ${manifest.files.length} explicit payload files; ${publicPaths.size} public text files; DSH ${manifest.engines.dsh}.`)
