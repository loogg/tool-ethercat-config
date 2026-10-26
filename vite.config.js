import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import process from 'node:process'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const repository = process.env.GITHUB_REPOSITORY?.split('/').at(-1)
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS === 'true' && repository ? `/${repository}/` : './',
  define: { 'import.meta.env.APP_VERSION': JSON.stringify(pkg.version) },
  build: { rollupOptions: { output: { manualChunks(id) {
    if (id.replaceAll('\\', '/').endsWith('/src/data/learning.js')) return 'learning-content'
    if (id.includes('node_modules')) {
      if (/@xyflow|d3-|zustand/.test(id)) return 'graph-vendor'
      if (/react-dom|\/react\//.test(id.replaceAll('\\', '/'))) return 'react-vendor'
    }
  } } } },
})
