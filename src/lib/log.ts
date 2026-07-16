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
 * Fold a shard's content into state, applying complete lines from `start`
 * onward. Returns the char length actually consumed (always at a newline
 * boundary) so the caller can remember exactly the prefix it folded.
 *
 * `start` MUST sit on a line boundary the caller has verified is still intact.
 * It is NOT safe to persist as a cross-session cursor: the shard is a CRDT
 * Y.Text, so a merge with a concurrent writer can insert content *before* a
 * previously-recorded offset, which would make a naive tail-slice skip real
 * events. The store only trusts `start` when the new content still begins with
 * the exact prefix it last folded; otherwise it passes 0 and refolds whole.
 * A full refold is always correct because applyEvent dedupes by event id.
 */
export function foldFrom(state: State, content: string, start: number): number {
  const from = start > 0 && start <= content.length ? start : 0
  const slice = content.slice(from)
  const lastNl = slice.lastIndexOf('\n')
  if (lastNl === -1) return from // no complete new line yet
  const complete = slice.slice(0, lastNl)
  for (const line of complete.split('\n')) {
    const ev = parseEvent(line)
    if (ev) applyEvent(state, ev)
  }
  return from + lastNl + 1
}
