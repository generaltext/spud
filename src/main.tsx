import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { StoreProvider } from './lib/store'
import { App } from './App'
import { MissingRuntime } from './components/MissingRuntime'
import './global.css'

// The platform injects `window.gt` (a classic script) before this deferred module
// runs — inside General Text, and in `pnpm dev` where a vite plugin injects it. So a
// real runtime is present iff window.gt exists right now. Opened standalone on the
// deployed site there's none, so we show a splash and let the visitor load a LOCAL
// in-browser workspace (via `window.__gtConfig = { local: true }`) to try the demo.

const HAS_REAL_RUNTIME = typeof window !== 'undefined' && !!window.gt
const RUNTIME_URL = 'https://www.generaltext.org/__gt/runtime.js'
const root = createRoot(document.getElementById('root')!)

function loadRuntime(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.gt) return resolve()
    // Must be set BEFORE the script loads — the runtime reads it at construction.
    window.__gtConfig = { local: true }
    window.__spudDemo = true
    const s = document.createElement('script')
    s.src = RUNTIME_URL
    s.onload = () => (window.gt ? resolve() : reject(new Error('runtime loaded but window.gt missing')))
    s.onerror = () => reject(new Error('failed to load the General Text runtime'))
    document.head.appendChild(s)
  })
}

function bootApp() {
  root.render(
    <HashRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </HashRouter>,
  )
}

function renderMissing() {
  root.render(<MissingRuntime onTryDemo={() => loadRuntime().then(bootApp).catch(renderMissing)} />)
}

if (HAS_REAL_RUNTIME) bootApp()
else renderMissing()
