import { useStore } from '../lib/store'
import { useUi } from './ui'
import { parseBody, idKind } from '../lib/mentions'

// Render stored text: plain runs plus `@[Label](id)` mentions as live chips. An
// idea mention resolves to the idea's current title; a comment mention resolves to
// its number (#N). Clicking a chip opens the target idea in the drawer.
export function MentionText({ body, className }: { body: string; className?: string }) {
  const { state } = useStore()
  const { openIdea } = useUi()
  const segments = parseBody(body)
  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{seg.text}</span>
        const kind = idKind(seg.id)
        let label = seg.label
        let target: string | null = null
        let alive = false
        if (kind === 'spd') {
          const s = state.spuds[seg.id]
          alive = !!s && !s.archived
          if (s) { label = s.title; target = s.id }
        } else if (kind === 'cmt') {
          const c = state.comments[seg.id]
          alive = !!c && !c.deleted
          if (c) { label = '#' + c.seq; target = c.spud }
        }
        return (
          <span
            key={i}
            className="mention"
            role="link"
            tabIndex={0}
            onClick={() => target && openIdea(target)}
            onKeyDown={(e) => { if (e.key === 'Enter' && target) openIdea(target) }}
            title={alive ? 'Open' : 'No longer exists'}
            style={alive ? undefined : { opacity: 0.6, textDecoration: 'line-through' }}
          >
            {kind === 'cmt' ? label : '@' + label}
          </span>
        )
      })}
    </span>
  )
}
