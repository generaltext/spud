import { describe, expect, it } from 'vitest'
import {
  applyEvent,
  backlinks,
  commentBySeq,
  commentsForSpud,
  emptyState,
  mentionEdges,
  outgoingMentions,
  timelineLinks,
  versionString,
  type State,
} from './reducer'
import { serializeEvent, type SpudEvent } from './events'
import { foldFrom } from './log'
import { mentionToken, mentionedSpudIds, parseBody } from './mentions'

let seq = 0
function ev(type: string, subject: string, data?: Record<string, unknown>): SpudEvent {
  seq += 1
  return {
    id: `evt_${String(seq).padStart(6, '0')}`,
    ts: new Date(2026, 0, 1, 0, 0, seq).toISOString(),
    actor: { id: 'u1', name: 'Ada' },
    type,
    subject,
    ...(data ? { data } : {}),
  }
}
function fold(events: SpudEvent[]): State {
  const s = emptyState()
  for (const e of events) applyEvent(s, e)
  return s
}

describe('version fold', () => {
  it('plants at 0.0.0', () => {
    const s = fold([ev('spud.plant', 'spd_a', { title: 'Idea' })])
    expect(versionString(s.spuds['spd_a']!.version)).toBe('0.0.0')
  })

  it('comment→patch, edit→minor, major edit→major', () => {
    const s = fold([
      ev('spud.plant', 'spd_a', { title: 'Idea' }),
      ev('comment.add', 'cmt_1', { spud: 'spd_a', body: 'hi' }),
      ev('comment.add', 'cmt_2', { spud: 'spd_a', body: 'again' }),
      ev('spud.edit', 'spd_a', { body: 'refined' }),
      ev('spud.edit', 'spd_a', { body: 'reframed', major: true }),
    ])
    // 0.0.0 → +2 patch 0.0.2 → minor edit 0.1.0 → major edit 1.0.0
    expect(versionString(s.spuds['spd_a']!.version)).toBe('1.0.0')
    expect(s.spuds['spd_a']!.commentCount).toBe(2)
    expect(s.spuds['spd_a']!.revisions.map((r) => `${r.kind}@${r.v}`)).toEqual([
      'plant@0.0', 'edit@0.1', 'major@1.0',
    ])
  })

  it('is idempotent', () => {
    const plant = ev('spud.plant', 'spd_a', { title: 'Idea' })
    const c = ev('comment.add', 'cmt_1', { spud: 'spd_a', body: 'hi' })
    const s = fold([plant, c, c, plant])
    expect(versionString(s.spuds['spd_a']!.version)).toBe('0.0.1')
    expect(s.spuds['spd_a']!.commentCount).toBe(1)
  })
})

describe('numbered comments', () => {
  it('assigns incrementing seq and looks up by number', () => {
    const s = fold([
      ev('spud.plant', 'spd_a', { title: 'A' }),
      ev('spud.plant', 'spd_b', { title: 'B' }),
      ev('comment.add', 'cmt_1', { spud: 'spd_a', body: 'one' }),
      ev('comment.add', 'cmt_2', { spud: 'spd_b', body: 'two' }),
    ])
    expect(commentsForSpud(s, 'spd_a')[0]!.seq).toBe(1)
    expect(commentsForSpud(s, 'spd_b')[0]!.seq).toBe(2)
    expect(commentBySeq(s, 2)!.id).toBe('cmt_2')
  })
})

describe('mentions form connections', () => {
  it('outgoing + backlinks from a description mention', () => {
    const s = fold([
      ev('spud.plant', 'spd_a', { title: 'Target' }),
      ev('spud.plant', 'spd_b', { title: 'Source', body: `inspired by ${mentionToken('spd_a', 'Target')}` }),
    ])
    expect(outgoingMentions(s, 'spd_b').map((x) => x.id)).toEqual(['spd_a'])
    expect(backlinks(s, 'spd_a').map((x) => x.id)).toEqual(['spd_b'])
    expect(mentionEdges(s)).toEqual([{ from: 'spd_b', to: 'spd_a' }])
  })

  it('a comment mention also creates a backlink to the commenting idea', () => {
    const s = fold([
      ev('spud.plant', 'spd_a', { title: 'Target' }),
      ev('spud.plant', 'spd_b', { title: 'Other' }),
      ev('comment.add', 'cmt_1', { spud: 'spd_b', body: `see ${mentionToken('spd_a', 'Target')}` }),
    ])
    expect(backlinks(s, 'spd_a').map((x) => x.id)).toEqual(['spd_b'])
  })
})

describe('timeline links', () => {
  it('pins the connecting event and the target version at that moment', () => {
    // B plants and gets edited; later A's edit mentions B → link at A's edit ts,
    // targeting B's most recent change at/before then (B's edit, not its plant).
    const s = fold([
      ev('spud.plant', 'spd_b', { title: 'B' }), // ts …:01
      ev('spud.plant', 'spd_a', { title: 'A' }), // ts …:02
      ev('spud.edit', 'spd_b', { body: 'b v0.1' }), // ts …:03  (B advances)
      ev('spud.edit', 'spd_a', { body: `inspired by ${mentionToken('spd_b', 'B')}` }), // ts …:04
    ])
    const links = timelineLinks(s)
    expect(links).toHaveLength(1)
    const l = links[0]!
    expect([l.from, l.to]).toEqual(['spd_a', 'spd_b'])
    // atTs = A's edit; targetTs = B's edit (its latest change at/before atTs)
    const aEdit = s.events.find((e) => e.type === 'spud.edit' && e.subject === 'spd_a')!
    const bEdit = s.events.find((e) => e.type === 'spud.edit' && e.subject === 'spd_b')!
    expect(l.atTs).toBe(aEdit.ts)
    expect(l.targetTs).toBe(bEdit.ts)
  })
})

describe('mention token round-trip', () => {
  it('parses ideas and comments', () => {
    const body = `a ${mentionToken('spd_x', 'X')} b ${mentionToken('cmt_9', '#3')}`
    expect(mentionedSpudIds(body)).toEqual(['spd_x'])
    expect(parseBody(body).filter((s) => s.type === 'mention')).toHaveLength(2)
  })
})

describe('shard fold cursor', () => {
  const line = (e: SpudEvent) => serializeEvent(e) + '\n'

  it('folds only the appended tail when content is a pure extension', () => {
    const a = ev('spud.plant', 'spd_a', { title: 'A' })
    const b = ev('spud.plant', 'spd_b', { title: 'B' })
    const s = emptyState()

    const first = line(a)
    const consumed = foldFrom(s, first, 0)
    expect(consumed).toBe(first.length)
    expect(Object.keys(s.spuds)).toEqual(['spd_a'])

    // append b; caller resumes from the remembered prefix length
    const full = first + line(b)
    const consumed2 = foldFrom(s, full, consumed)
    expect(consumed2).toBe(full.length)
    expect(Object.keys(s.spuds).sort()).toEqual(['spd_a', 'spd_b'])
  })

  it('leaves a half-synced trailing line for the next fold', () => {
    const a = ev('spud.plant', 'spd_a', { title: 'A' })
    const b = ev('spud.plant', 'spd_b', { title: 'B' })
    const s = emptyState()
    const partial = line(a) + serializeEvent(b) // no trailing newline yet
    const consumed = foldFrom(s, partial, 0)
    expect(consumed).toBe(line(a).length) // only the complete line
    expect(Object.keys(s.spuds)).toEqual(['spd_a'])
    // the newline arrives → b now folds
    foldFrom(s, partial + '\n', consumed)
    expect(Object.keys(s.spuds).sort()).toEqual(['spd_a', 'spd_b'])
  })

  it('a full refold picks up events a CRDT merge inserted before the old offset', () => {
    // Regression: a concurrent writer\'s events can land *before* a previously
    // recorded char offset. A naive tail-slice from that offset skips them; the
    // store guards this by only trusting the offset when the content still
    // starts with the exact prefix it folded, else refolding from 0.
    const local = ev('spud.plant', 'spd_local', { title: 'Local' })
    const remote = ev('spud.plant', 'spd_remote', { title: 'Remote' })
    const s = emptyState()

    // we fold our own line and remember the prefix + offset
    const mine = line(local)
    const offset = foldFrom(s, mine, 0)
    expect(Object.keys(s.spuds)).toEqual(['spd_local'])

    // merge reorders: the remote event is now ordered *before* ours
    const merged = line(remote) + line(local)
    // the store\'s guard: mine is no longer a prefix of merged → refold from 0
    expect(merged.startsWith(mine)).toBe(false)
    foldFrom(s, merged, 0)
    expect(Object.keys(s.spuds).sort()).toEqual(['spd_local', 'spd_remote'])

    // and a naive tail-slice from the stale offset would indeed have missed it
    const naive = emptyState()
    applyEvent(naive, local)
    foldFrom(naive, merged, offset)
    expect(naive.spuds['spd_remote']).toBeUndefined()
  })
})

describe('tags', () => {
  it('adds, dedupes, and lowercases', () => {
    const s = fold([
      ev('spud.plant', 'spd_a', { title: 'A' }),
      ev('tag.add', 'spd_a', { label: 'Product' }),
      ev('tag.add', 'spd_a', { label: 'product' }),
      ev('tag.add', 'spd_a', { label: 'wild' }),
    ])
    expect(s.spuds['spd_a']!.tags).toEqual(['product', 'wild'])
  })
})
