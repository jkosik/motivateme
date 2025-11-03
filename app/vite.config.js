import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src/static', // Source files in app/src/static/
  build: {
    outDir: '../../dist', // Output to app/dist/
    emptyOutDir: true,
  },
})

