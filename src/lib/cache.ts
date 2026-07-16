// A disposable local materialization cache in IndexedDB. The plaintext log is
// always the source of truth; this only lets a returning session hydrate the UI
// instantly and re-parse just the new tail of each shard instead of every line.
// Nuke it (or bump CACHE_VERSION) and a full replay rebuilds identical state.

import { emptyState, type State } from './reducer'
import type { SpudEvent } from './events'

const DB_NAME = 'spud'
const STORE = 'projection'
// v2 dropped the persisted `consumed` cursor: a saved char offset is not a
// valid resume point over a CRDT shard (a concurrent write can reorder content
// before the offset, silently skipping events). The fold cursor now lives in
// memory and is revalidated each session. Bumping the version discards any v1
// cache that may hold state built by the old, offset-skipping fold.
const CACHE_VERSION = 2

export interface CachedProjection {
  version: number
  workspaceId: string
  state: SerializedState
}

interface SerializedState {
  spuds: State['spuds']
  comments: State['comments']
  events: SpudEvent[]
  applied: string[]
  commentSeq: number
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function cacheKey(workspaceId: string): string {
  return `proj:${workspaceId}`
}

export async function loadCache(workspaceId: string): Promise<{ state: State } | null> {
  try {
    const db = await open()
    const cached = await idbGet<CachedProjection>(db, cacheKey(workspaceId))
    if (!cached || cached.version !== CACHE_VERSION || cached.workspaceId !== workspaceId) return null
    const s = emptyState()
    s.spuds = cached.state.spuds
    s.comments = cached.state.comments
    s.events = cached.state.events
    s.applied = new Set(cached.state.applied)
    s.commentSeq = cached.state.commentSeq ?? 0
    return { state: s }
  } catch {
    return null // cache is best-effort; a miss just means a full fold
  }
}

export async function saveCache(workspaceId: string, state: State): Promise<void> {
  try {
    const db = await open()
    const payload: CachedProjection = {
      version: CACHE_VERSION,
      workspaceId,
      state: {
        spuds: state.spuds,
        comments: state.comments,
        events: state.events,
        applied: [...state.applied],
        commentSeq: state.commentSeq,
      },
    }
    await idbPut(db, cacheKey(workspaceId), payload)
  } catch {
    // ignore — losing the cache only costs a re-parse next boot
  }
}
