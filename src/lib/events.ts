// The event envelope. One JSON object per line in the log; immutable once
// written. Every change to SPUD is an event of the form "<entity>.<verb>".

export interface Actor {
  id: string
  name: string
}

export interface SpudEvent {
  /** evt_<ulid> — unique, sortable, used for dedupe/idempotency */
  id: string
  /** ISO timestamp from the writing client (display + LWW tiebreak) */
  ts: string
  /** who did it, from gt.user() (or a local fallback); null if unknown */
  actor: Actor | null
  /** "<entity>.<verb>", e.g. spud.plant, spud.recast, link.add */
  type: string
  /** the id of the record this event is about */
  subject: string
  /** verb-specific payload */
  data?: Record<string, unknown>
}

/** A change to append, before the envelope is stamped (id/ts/actor added by the store). */
export interface Draft {
  type: string
  subject: string
  data?: Record<string, unknown>
}

export function serializeEvent(ev: SpudEvent): string {
  return JSON.stringify(ev)
}

export function parseEvent(line: string): SpudEvent | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    const obj = JSON.parse(trimmed) as SpudEvent
    if (typeof obj.id === 'string' && typeof obj.type === 'string' && typeof obj.subject === 'string') {
      return obj
    }
  } catch {
    // A malformed line (a half-synced write, a hand-edit) is skipped, not fatal.
  }
  return null
}
