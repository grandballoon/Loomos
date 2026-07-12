import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works at any mount path (GitHub Pages serves
  // project sites from /<repo>/, not the domain root).
  base: './',
  plugins: [react()],
})
