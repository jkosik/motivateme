import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src/static',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
})

