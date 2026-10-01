import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
await mkdir(new URL('../lib/', import.meta.url), { recursive: true })
await build({
  entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true,
  platform: 'node', format: 'esm', target: 'node22', sourcemap: false,
  external: ['@deepseek-ai/*'],
})
await build({
  entryPoints: ['src/client/index.ts'], outfile: 'lib/client.js', bundle: true,
  platform: 'browser', format: 'cjs', target: 'es2022', sourcemap: false,
  external: ['react', 'react-dom', 'react/jsx-runtime', '@deepseek-ai/*'],
  banner: { js: 'window.__ModuleLoader__.load({id:"dsh-agent-desktop",factory:(require)=>{var module={exports:{}};var exports=module.exports;' },
  footer: { js: 'return module.exports;}});' },
})
console.log('Built DSH Host and sidebar bundles.')
