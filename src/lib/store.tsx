import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { type Actor, type Draft, type SpudEvent, serializeEvent } from './events'
import { applyEvent, emptyState, type State } from './reducer'
import { appendLine, CONFIG_PATH, currentShardPath, foldFrom, isShardPath } from './log'
import { loadCache, saveCache } from './cache'
import { DEFAULT_CONFIG, type Config } from './model'
import { newId, ulid } from './ids'
import { seedDemo } from './seed'

interface StoreValue {
  ready: boolean
  connected: boolean
  me: Actor | null
  state: State
  version: number
  config: Config
  dispatch: (drafts: Draft | Draft[]) => Promise<void>
  saveConfig: (next: Config) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

async function resolveMe(): Promise<Actor> {
  try {
    const u = await window.gt.user()
    if (u) return { id: u.id, name: u.name }
  } catch {
    // fall through to local identity
  }
  let id = localStorage.getItem('spud.actor.id')
  if (!id) {
    id = `local_${ulid()}`
    localStorage.setItem('spud.actor.id', id)
  }
  const name = localStorage.getItem('spud.actor.name') || 'You'
  return { id, name }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const stateRef = useRef<State>(emptyState())
  // Per-shard: the exact newline-terminated prefix we have already folded, kept
  // in memory only. A fold takes the fast tail path when new content still
  // begins with this prefix, and otherwise refolds from 0 (dedupe-safe). This
  // is deliberately NOT persisted — a char offset saved across sessions is not
  // a valid cursor over a CRDT shard that can be reordered by a concurrent
  // writer while the tab is closed. See foldFrom in log.ts.
  const foldedRef = useRef<Map<string, string>>(new Map())
  const meRef = useRef<Actor | null>(null)
  const workspaceRef = useRef<string>('local')
  const subscribed = useRef<Set<string>>(new Set())
  const stops = useRef<Array<() => void>>([])
  const writeQueue = useRef<Promise<unknown>>(Promise.resolve())
  const bumpScheduled = useRef(false)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [version, setVersion] = useState(0)
  const [ready, setReady] = useState(false)
  const [connected, setConnected] = useState(true)
  const [me, setMe] = useState<Actor | null>(null)
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)

  function bump() {
    if (bumpScheduled.current) return
    bumpScheduled.current = true
    queueMicrotask(() => {
      bumpScheduled.current = false
      setVersion((v) => v + 1)
    })
  }

  function schedulePersist() {
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      void saveCache(workspaceRef.current, stateRef.current)
    }, 1000)
  }

  function subscribeShard(path: string) {
    if (subscribed.current.has(path)) return
    subscribed.current.add(path)
    const stop = window.gt.watch(path, (content) => {
      // Trust the remembered prefix only if the new content still starts with
      // it (a pure extension); otherwise a merge reordered the shard, so refold
      // the whole thing from 0. applyEvent dedupes by id, so this is always safe.
      const prev = foldedRef.current.get(path) ?? ''
      const start = content.startsWith(prev) ? prev.length : 0
      const consumed = foldFrom(stateRef.current, content, start)
      foldedRef.current.set(path, content.slice(0, consumed))
      bump()
      schedulePersist()
    })
    stops.current.push(stop)
  }

  useEffect(() => {
    let disposed = false
    const localStops = stops.current

    async function boot() {
      await window.gt.ready
      if (disposed) return

      workspaceRef.current = window.gt.workspaceId || 'local'
      const actor = await resolveMe()
      meRef.current = actor
      setMe(actor)
      setConnected(window.gt.connected)

      // Load the cached projection for an instant first paint. We deliberately
      // do NOT seed a fold cursor from it: foldedRef starts empty, so the first
      // watch fire per shard refolds the whole content and reconciles anything
      // the cache missed (dedupe by event id makes that a no-op for the rest).
      const cached = await loadCache(workspaceRef.current)
      if (cached && !disposed) {
        stateRef.current = cached.state
      }

      // Config: read, or seed the default once.
      try {
        const raw = await window.gt.readFile(CONFIG_PATH)
        if (raw.trim()) setConfig({ ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Config) })
      } catch {
        void window.gt.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2))
      }
      window.gt.watch(CONFIG_PATH, (raw) => {
        if (raw.trim()) {
          try {
            setConfig({ ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Config) })
          } catch {
            /* keep last good config */
          }
        }
      })

      // Subscribe existing shards, and watch for new ones (a new month, or the
      // very first event) to appear. dispatch subscribes the current shard right
      // after it writes, and watchFiles catches shards created remotely.
      for (const p of window.gt.files()) if (isShardPath(p)) subscribeShard(p)
      window.gt.watchFiles((paths) => {
        for (const p of paths) if (isShardPath(p)) subscribeShard(p)
      })

      window.gt.on('connected', () => setConnected(true))
      window.gt.on('disconnected', () => setConnected(false))

      setReady(true)

      // Seed sample content once, only when truly empty: in the gallery "try it
      // live" demo (mode 'demo') and in the standalone deployed demo (__spudDemo).
      if (window.gt.mode === 'demo' || window.__spudDemo) {
        const files = await window.gt.listFiles()
        if (files.length === 0 && stateRef.current.events.length === 0) {
          await seedDemo((drafts) => dispatchImpl(drafts))
        }
      }
    }

    void boot()
    return () => {
      disposed = true
      for (const stop of localStops) stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function dispatchImpl(drafts: Draft | Draft[]): Promise<void> {
    const list = Array.isArray(drafts) ? drafts : [drafts]
    if (list.length === 0) return
    const now = new Date().toISOString()
    const events: SpudEvent[] = list.map((d) => ({
      id: newId('evt'),
      ts: now,
      actor: meRef.current,
      type: d.type,
      subject: d.subject,
      ...(d.data ? { data: d.data } : {}),
    }))

    // Optimistic apply for instant UI; the watch echo re-folds idempotently.
    for (const ev of events) applyEvent(stateRef.current, ev)
    bump()

    const path = currentShardPath()
    // Serialize writes and always base the append on the freshest content, so
    // the runtime's diff is a pure end-insertion (never a delete of a concurrent
    // remote line).
    const run = writeQueue.current.then(async () => {
      const exists = window.gt.files().includes(path)
      const base = exists ? await window.gt.readFile(path) : ''
      let content = base
      for (const ev of events) content = appendLine(content, serializeEvent(ev))
      await window.gt.writeFile(path, content)
      subscribeShard(path)
    })
    writeQueue.current = run.catch(() => undefined)
    await run
  }

  async function saveConfigImpl(next: Config): Promise<void> {
    setConfig(next)
    await window.gt.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2))
  }

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      connected,
      me,
      state: stateRef.current,
      version,
      config,
      dispatch: dispatchImpl,
      saveConfig: saveConfigImpl,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, connected, me, version, config],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
