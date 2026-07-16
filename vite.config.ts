import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { cloudflare } from "@cloudflare/vite-plugin";

// Dev-only: inject window.gt so the app runs standalone against a local
// in-browser workspace (IndexedDB + cross-tab sync over BroadcastChannel).
// In production General Text injects the runtime itself, so this never ships.
function gtRuntime(): Plugin {
  return {
    name: 'gt-runtime',
    apply: 'serve',
    transformIndexHtml: (html) =>
      html.replace(
        '</head>',
        '<script src="https://www.generaltext.org/__gt/runtime.js"></script></head>',
      ),
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), gtRuntime(), cloudflare()],
})