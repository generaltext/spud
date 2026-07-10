// The append-only log: monthly JSONL shards under v0/spuds/. Helpers here are
// pure; the store owns the window.gt reads/writes and the freshest-content
// bookkeeping that makes appends safe.

import { applyEvent, type State } from './reducer'
import { parseEvent } from './events'

export const DATA_VERSION = 'v0'
export const EVENTS_DIR = `${DATA_VERSION}/spuds`
export const CONFIG_PATH = `${DATA_VERSION}/config.json`

const SHARD_RE = new RegExp(`^${DATA_VERSION}/spuds/\\d{4}-\\d{2}\\.jsonl$`)

export function shardForDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${EVENTS_DIR}/${y}-${m}.jsonl`
}

export function currentShardPath(): string {
  return shardForDate(new Date())
}

export function isShardPath(path: string): boolean {
  return SHARD_RE.test(path)
}

/** Append a serialized event line onto a shard's current content. */
export function appendLine(current: string, line: string): string {
  const base = current.length === 0 || current.endsWith('\n') ? current : current + '\n'
  return base + line + '\n'
}

/**
 * Fold the not-yet-consumed tail of a shard into state. Returns the new
 * consumed length (always at a newline boundary). Only complete lines are
 * applied, so a half-synced trailing write is left for the next change.
 */
export function foldTail(state: State, content: string, prevLen: number): number {
  let start = prevLen
  if (content.length < start) start = 0 // shard unexpectedly shrank → refold (dedupe keeps it safe)
  const slice = content.slice(start)
  const lastNl = slice.lastIndexOf('\n')
  if (lastNl === -1) return start // no complete new line yet
  const complete = slice.slice(0, lastNl)
  for (const line of complete.split('\n')) {
    const ev = parseEvent(line)
    if (ev) applyEvent(state, ev)
  }
  return start + lastNl + 1
}
