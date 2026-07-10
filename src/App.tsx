import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './lib/store'
import { Layout } from './components/Layout'
import { TimelineView } from './views/TimelineView'
import { NetworkView } from './views/NetworkView'
import { ListView } from './views/ListView'
import { PotatoMark } from './components/Icon'

function Splash() {
  return (
    <div className="flex h-full items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
      <div className="flex items-center gap-2 text-sm">
        <PotatoMark size={18} /> Loading SPUD…
      </div>
    </div>
  )
}

export function App() {
  const { ready } = useStore()
  if (!ready) return <Splash />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/timeline" replace />} />
        <Route path="/timeline" element={<TimelineView />} />
        <Route path="/network" element={<NetworkView />} />
        <Route path="/list" element={<ListView />} />
        <Route path="*" element={<Navigate to="/timeline" replace />} />
      </Route>
    </Routes>
  )
}
