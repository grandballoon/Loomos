import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { uiFeedbackPlugin } from './feedback/plugin'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works at any mount path (GitHub Pages serves
  // project sites from /<repo>/, not the domain root).
  base: './',
  // uiFeedbackPlugin is dev-only (apply: 'serve'); see feedback/plugin.ts.
  plugins: [react(), uiFeedbackPlugin()],
})
