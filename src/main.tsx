import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { StoreProvider } from './lib/store'
import { App } from './App'
import './global.css'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <HashRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </HashRouter>,
  )
}
