import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './lib/store'
import { Layout } from './components/Layout'
import { TimelineView } from './views/TimelineView'
import { NetworkView } from './views/NetworkView'
import { ListView } from './views/ListView'
import { AppSkeleton } from './components/Skeleton'

export function App() {
  const { ready } = useStore()
  if (!ready) return <AppSkeleton />

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
