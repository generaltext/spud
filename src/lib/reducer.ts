// The projection: fold the event log into current-state ideas. Idempotent (each
// event id applied at most once), so re-folding a shard tail or seeing our own
// optimistic write echoed back is always safe.
//
// The version is COMPUTED as we fold: a comment bumps the patch, a description
// edit bumps the minor, and an edit the author marks as a major new approach bumps
// the major. Connections are not stored — they are derived from the @mentions in
// each idea's description (see the selectors at the bottom).

import type { Actor, SpudEvent } from './events'
import { mentionedIds, mentionedSpudIds } from './mentions'

export interface Version {
  major: number
  minor: number
  patch: number
}

/** A snapshot of the idea's text at each edit, for the version history. */
export interface Revision {
  v: string // "major.minor" at the snapshot
  kind: 'plant' | 'edit' | 'major'
  title: string
  body: string
  note?: string
  ts: string
  by: Actor | null
}

export interface SpudRecord {
  id: string
  title: string
  body: string
  version: Version
  revisions: Revision[]
  tags: string[]
  commentCount: number
  archived: boolean
  createdBy: Actor | null
  createdAt: string
  updatedBy: Actor | null
  updatedAt: string
  lastActivityAt: string
}

export interface CommentRecord {
  id: string
  spud: string
  /** stable display number, assigned in fold order (#1, #2, …) */
  seq: number
  body: string
  deleted: boolean
  createdBy: Actor | null
  createdAt: string
}

export interface State {
  spuds: Record<string, SpudRecord>
  comments: Record<string, CommentRecord>
  events: SpudEvent[]
  applied: Set<string>
  commentSeq: number
}

export function emptyState(): State {
  return { spuds: {}, comments: {}, events: [], applied: new Set(), commentSeq: 0 }
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function versionString(v: Version): string {
  return `${v.major}.${v.minor}.${v.patch}`
}

export function applyEvent(state: State, ev: SpudEvent): void {
  if (state.applied.has(ev.id)) return
  state.applied.add(ev.id)
  state.events.push(ev)

  const [entity, verb] = ev.type.split('.')
  const data = ev.data ?? {}

  if (entity === 'spud') applySpud(state, ev, verb ?? '', data)
  else if (entity === 'comment') applyComment(state, ev, verb ?? '', data)
  else if (entity === 'tag') applyTag(state, ev, verb ?? '', data)
  // Unknown types are recorded in events (for the timeline) and otherwise ignored,
  // so a newer build's events never break an older one.
}

function touch(rec: SpudRecord, ev: SpudEvent): void {
  rec.updatedAt = ev.ts
  rec.updatedBy = ev.actor
  rec.lastActivityAt = ev.ts
}

function applySpud(state: State, ev: SpudEvent, verb: string, data: Record<string, unknown>): void {
  if (verb === 'plant') {
    if (state.spuds[ev.subject]) return
    const title = asString(data.title).trim() || 'Untitled idea'
    const body = asString(data.body)
    state.spuds[ev.subject] = {
      id: ev.subject,
      title,
      body,
      version: { major: 0, minor: 0, patch: 0 },
      revisions: [{ v: '0.0', kind: 'plant', title, body, ts: ev.ts, by: ev.actor }],
      tags: [],
      commentCount: 0,
      archived: false,
      createdBy: ev.actor,
      createdAt: ev.ts,
      updatedBy: ev.actor,
      updatedAt: ev.ts,
      lastActivityAt: ev.ts,
    }
    return
  }

  const rec = state.spuds[ev.subject]
  if (!rec) return

  if (verb === 'edit') {
    if (typeof data.title === 'string') rec.title = data.title.trim() || rec.title
    if (typeof data.body === 'string') rec.body = data.body
    const major = data.major === true
    rec.version = major
      ? { major: rec.version.major + 1, minor: 0, patch: 0 }
      : { major: rec.version.major, minor: rec.version.minor + 1, patch: 0 }
    const note = asString(data.note).trim()
    rec.revisions.push({
      v: `${rec.version.major}.${rec.version.minor}`,
      kind: major ? 'major' : 'edit',
      title: rec.title,
      body: rec.body,
      ...(note ? { note } : {}),
      ts: ev.ts,
      by: ev.actor,
    })
    touch(rec, ev)
  } else if (verb === 'archive') {
    rec.archived = true
    touch(rec, ev)
  } else if (verb === 'restore') {
    rec.archived = false
    touch(rec, ev)
  }
}

function applyComment(state: State, ev: SpudEvent, verb: string, data: Record<string, unknown>): void {
  if (verb === 'add') {
    if (state.comments[ev.subject]) return
    const spudId = asString(data.spud)
    state.comments[ev.subject] = {
      id: ev.subject,
      spud: spudId,
      seq: ++state.commentSeq,
      body: asString(data.body),
      deleted: false,
      createdBy: ev.actor,
      createdAt: ev.ts,
    }
    const rec = state.spuds[spudId]
    if (rec) {
      // a comment bumps the idea's patch (discussion accreting)
      rec.version = { ...rec.version, patch: rec.version.patch + 1 }
      rec.commentCount += 1
      rec.lastActivityAt = ev.ts
    }
    return
  }
  const rec = state.comments[ev.subject]
  if (!rec) return
  if (verb === 'edit') {
    if (typeof data.body === 'string') rec.body = data.body
  } else if (verb === 'delete') {
    if (!rec.deleted) {
      rec.deleted = true
      const spud = state.spuds[rec.spud]
      if (spud && spud.commentCount > 0) spud.commentCount -= 1
    }
  }
}

function applyTag(state: State, ev: SpudEvent, verb: string, data: Record<string, unknown>): void {
  const rec = state.spuds[ev.subject]
  if (!rec) return
  const label = asString(data.label).trim().toLowerCase()
  if (!label) return
  if (verb === 'add') {
    if (!rec.tags.includes(label)) {
      rec.tags.push(label)
      rec.tags.sort()
      rec.lastActivityAt = ev.ts
    }
  } else if (verb === 'remove') {
    rec.tags = rec.tags.filter((t) => t !== label)
  }
}

// ── selectors ────────────────────────────────────────────────────────────────

export function allSpuds(state: State, includeArchived = false): SpudRecord[] {
  return Object.values(state.spuds)
    .filter((s) => includeArchived || !s.archived)
    .sort((a, b) => (b.lastActivityAt < a.lastActivityAt ? -1 : 1)) // most recently active first
}

export function commentsForSpud(state: State, spudId: string): CommentRecord[] {
  return Object.values(state.comments)
    .filter((c) => c.spud === spudId && !c.deleted)
    .sort((a, b) => a.seq - b.seq)
}

export function commentBySeq(state: State, seq: number): CommentRecord | null {
  for (const c of Object.values(state.comments)) if (c.seq === seq && !c.deleted) return c
  return null
}

/** A per-idea event stream for the timeline: plant, edits (minor/major), comments. */
export interface IdeaEvent {
  kind: 'plant' | 'minor' | 'major' | 'comment'
  ts: string
  by: Actor | null
  ref?: string // comment id, for comment events
}
export function eventsForSpud(state: State, spudId: string): IdeaEvent[] {
  const out: IdeaEvent[] = []
  for (const ev of state.events) {
    const data = ev.data ?? {}
    if (ev.type === 'spud.plant' && ev.subject === spudId) out.push({ kind: 'plant', ts: ev.ts, by: ev.actor })
    else if (ev.type === 'spud.edit' && ev.subject === spudId)
      out.push({ kind: data.major === true ? 'major' : 'minor', ts: ev.ts, by: ev.actor })
    else if (ev.type === 'comment.add' && data.spud === spudId)
      out.push({ kind: 'comment', ts: ev.ts, by: ev.actor, ref: ev.subject })
  }
  return out.sort((a, b) => (a.ts < b.ts ? -1 : 1))
}

/** Ideas this idea's description points at (the outgoing connections). */
export function outgoingMentions(state: State, spudId: string): SpudRecord[] {
  const rec = state.spuds[spudId]
  if (!rec) return []
  const seen = new Set<string>()
  const out: SpudRecord[] = []
  for (const id of mentionedSpudIds(rec.body)) {
    if (id === spudId || seen.has(id)) continue
    const other = state.spuds[id]
    if (other) { seen.add(id); out.push(other) }
  }
  return out
}

/** Ideas that mention this one, in their description or a comment. */
export function backlinks(state: State, spudId: string): SpudRecord[] {
  const ids = new Set<string>()
  for (const s of Object.values(state.spuds)) {
    if (s.id === spudId || s.archived) continue
    if (mentionedSpudIds(s.body).includes(spudId)) ids.add(s.id)
  }
  for (const c of Object.values(state.comments)) {
    if (c.deleted || c.spud === spudId) continue
    if (mentionedIds(c.body).includes(spudId)) ids.add(c.spud)
  }
  return [...ids].map((id) => state.spuds[id]).filter((s): s is SpudRecord => !!s && !s.archived)
}

/**
 * When did idea A first reference idea B, and what was B's version at that moment?
 * Because the log is append-only, we can pinpoint the exact edit or comment that
 * introduced each @mention (its `atTs`) and the latest change to B at or before
 * then (`targetTs`) — enough to draw a connector on the timeline from the moment
 * the link was made to the version of the target it pointed at.
 */
export interface TimelineLink {
  from: string
  to: string
  atTs: string
  targetTs: string
}
export function timelineLinks(state: State): TimelineLink[] {
  // per-idea sorted change timestamps (plant/edit on the idea, comments on it) —
  // any of these advance the idea's version.
  const byIdea = new Map<string, string[]>()
  const pushTs = (id: string, ts: string) => { const a = byIdea.get(id) ?? []; a.push(ts); byIdea.set(id, a) }
  for (const ev of state.events) {
    if (ev.type === 'spud.plant' || ev.type === 'spud.edit') pushTs(ev.subject, ev.ts)
    else if (ev.type === 'comment.add') { const s = asString((ev.data ?? {}).spud); if (s) pushTs(s, ev.ts) }
  }
  for (const a of byIdea.values()) a.sort()

  // earliest moment each ordered (from → to) reference was introduced
  const first = new Map<string, { from: string; to: string; atTs: string }>()
  const note = (from: string, to: string, atTs: string) => {
    if (from === to || !state.spuds[to] || !state.spuds[from]) return
    const key = from + '|' + to
    const cur = first.get(key)
    if (!cur || atTs < cur.atTs) first.set(key, { from, to, atTs })
  }
  const bodyEvents = state.events
    .filter((e) => e.type === 'spud.plant' || e.type === 'spud.edit')
    .slice()
    .sort((a, b) => (a.ts < b.ts ? -1 : 1))
  for (const e of bodyEvents) {
    const body = asString((e.data ?? {}).body)
    if (!body) continue
    for (const to of mentionedSpudIds(body)) note(e.subject, to, e.ts)
  }
  for (const c of Object.values(state.comments)) {
    if (c.deleted) continue
    for (const to of mentionedSpudIds(c.body)) note(c.spud, to, c.createdAt)
  }

  const out: TimelineLink[] = []
  for (const { from, to, atTs } of first.values()) {
    const times = byIdea.get(to) ?? []
    let targetTs = state.spuds[to]!.createdAt
    for (const ts of times) { if (ts <= atTs) targetTs = ts; else break }
    out.push({ from, to, atTs, targetTs })
  }
  return out
}

/** Directed edges (from → to) for the network view, from description @mentions. */
export function mentionEdges(state: State): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = []
  const seen = new Set<string>()
  for (const s of Object.values(state.spuds)) {
    if (s.archived) continue
    for (const to of mentionedSpudIds(s.body)) {
      if (to === s.id || !state.spuds[to] || state.spuds[to]!.archived) continue
      const key = s.id < to ? s.id + '|' + to : to + '|' + s.id
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ from: s.id, to })
    }
  }
  return out
}

// Tags in first-seen order (the order their `tag.add` events appear in the log),
// so color assignment is stable: a new tag takes the next hue and never reshuffles
// the ones before it. Any tag present but somehow without a tag.add event is
// appended after, for safety.
export function orderedTags(state: State): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const ev of state.events) {
    if (ev.type !== 'tag.add') continue
    const label = String((ev.data as { label?: unknown } | undefined)?.label ?? '')
    if (label && !seen.has(label)) {
      seen.add(label)
      out.push(label)
    }
  }
  for (const s of Object.values(state.spuds)) {
    for (const t of s.tags) if (!seen.has(t)) { seen.add(t); out.push(t) }
  }
  return out
}

export function allTags(state: State): { label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const s of Object.values(state.spuds)) {
    if (s.archived) continue
    for (const t of s.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}
