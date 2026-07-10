import { describe, expect, it } from 'vitest'
import {
  applyEvent,
  backlinks,
  commentBySeq,
  commentsForSpud,
  emptyState,
  mentionEdges,
  outgoingMentions,
  versionString,
  type State,
} from './reducer'
import type { SpudEvent } from './events'
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
  it('plants at 0.1.0', () => {
    const s = fold([ev('spud.plant', 'spd_a', { title: 'Idea' })])
    expect(versionString(s.spuds['spd_a']!.version)).toBe('0.1.0')
  })

  it('comment→patch, edit→minor, major edit→major', () => {
    const s = fold([
      ev('spud.plant', 'spd_a', { title: 'Idea' }),
      ev('comment.add', 'cmt_1', { spud: 'spd_a', body: 'hi' }),
      ev('comment.add', 'cmt_2', { spud: 'spd_a', body: 'again' }),
      ev('spud.edit', 'spd_a', { body: 'refined' }),
      ev('spud.edit', 'spd_a', { body: 'reframed', major: true }),
    ])
    // 0.1.0 → +2 patch 0.1.2 → minor edit 0.2.0 → major edit 1.0.0
    expect(versionString(s.spuds['spd_a']!.version)).toBe('1.0.0')
    expect(s.spuds['spd_a']!.commentCount).toBe(2)
    expect(s.spuds['spd_a']!.revisions.map((r) => `${r.kind}@${r.v}`)).toEqual([
      'plant@0.1', 'edit@0.2', 'major@1.0',
    ])
  })

  it('is idempotent', () => {
    const plant = ev('spud.plant', 'spd_a', { title: 'Idea' })
    const c = ev('comment.add', 'cmt_1', { spud: 'spd_a', body: 'hi' })
    const s = fold([plant, c, c, plant])
    expect(versionString(s.spuds['spd_a']!.version)).toBe('0.1.1')
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

describe('mention token round-trip', () => {
  it('parses ideas and comments', () => {
    const body = `a ${mentionToken('spd_x', 'X')} b ${mentionToken('cmt_9', '#3')}`
    expect(mentionedSpudIds(body)).toEqual(['spd_x'])
    expect(parseBody(body).filter((s) => s.type === 'mention')).toHaveLength(2)
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
