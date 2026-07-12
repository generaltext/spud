// Descriptions and comments are stored as portable plaintext with inline mention
// tokens: `@[Label](id)`. The label is a snapshot (so a deleted target still reads
// sensibly) and the id is the durable link. An id is an idea (`spd_…`) or a
// numbered discussion comment (`cmt_…`). Mentions are how connections form: an
// idea whose description says "inspired by @Other idea" is linked to it, and the
// network is the graph of those mentions. Everything stays greppable and readable
// outside Spud.

export interface TextSegment {
  type: 'text'
  text: string
}
export interface MentionSegment {
  type: 'mention'
  id: string
  label: string
}
export type Segment = TextSegment | MentionSegment

const MENTION_RE = /@\[([^\]\n]+)\]\(([a-z]+_[0-9A-Za-z]+)\)/g

export function idKind(id: string): string {
  const i = id.indexOf('_')
  return i === -1 ? '' : id.slice(0, i)
}

export function parseBody(body: string): Segment[] {
  const segments: Segment[] = []
  let last = 0
  MENTION_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MENTION_RE.exec(body)) !== null) {
    if (m.index > last) segments.push({ type: 'text', text: body.slice(last, m.index) })
    segments.push({ type: 'mention', label: m[1]!, id: m[2]! })
    last = m.index + m[0].length
  }
  if (last < body.length) segments.push({ type: 'text', text: body.slice(last) })
  return segments
}

export function mentionToken(id: string, label: string): string {
  const clean = label.replace(/[[\]\n]/g, ' ').replace(/\s+/g, ' ').trim() || id
  return `@[${clean}](${id})`
}

/** All mentioned ids in a body. */
export function mentionedIds(body: string): string[] {
  const ids: string[] = []
  for (const seg of parseBody(body)) if (seg.type === 'mention') ids.push(seg.id)
  return ids
}

/** Just the idea (`spd_`) ids a body mentions. */
export function mentionedSpudIds(body: string): string[] {
  return mentionedIds(body).filter((id) => idKind(id) === 'spd')
}

/** Plain text with mentions flattened to labels (search / previews). */
export function bodyToPlain(body: string): string {
  return parseBody(body)
    .map((s) => (s.type === 'text' ? s.text : s.label))
    .join('')
}
