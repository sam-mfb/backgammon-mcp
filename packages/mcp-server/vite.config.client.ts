import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  root: 'src/client',
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'esnext',
    outDir: '../../dist/client',
    emptyOutDir: true
  }
})
