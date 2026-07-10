import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { useUi } from '../components/ui'
import { allSpuds, backlinks, commentsForSpud, outgoingMentions } from '../lib/reducer'
import { activityScore, versionShort } from '../lib/maturity'
import { relativeTime } from '../lib/format'
import { TagDots } from '../components/TagChips'
import { EmptyState } from '../components/common'
import { Icon } from '../components/Icon'

// A dense, sortable table. The most direct read of the idea space: click a column
// header to sort, click a row to open it.

type Col = 'title' | 'version' | 'comments' | 'connections' | 'active'

export function ListView() {
  const { state } = useStore()
  const { openIdea, activeTags } = useUi()
  const [sort, setSort] = useState<Col>('active')
  const [dir, setDir] = useState<1 | -1>(1) // 1 = default (desc-ish) per column

  const rows = useMemo(() => {
    let list = allSpuds(state, true).filter((s) => !s.archived)
    if (activeTags.length) list = list.filter((s) => activeTags.every((t) => s.tags.includes(t)))
    const conns = (s: (typeof list)[number]) => outgoingMentions(state, s.id).length + backlinks(state, s.id).length
    const cmp: Record<Col, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      title: (a, b) => a.title.localeCompare(b.title),
      version: (a, b) => activityScore(b) - activityScore(a),
      comments: (a, b) => commentsForSpud(state, b.id).length - commentsForSpud(state, a.id).length,
      connections: (a, b) => conns(b) - conns(a),
      active: (a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1),
    }
    const sorted = [...list].sort(cmp[sort])
    return dir === 1 ? sorted : sorted.reverse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, state.events.length, activeTags, sort, dir])

  const head = (col: Col, label: string, align: 'left' | 'right' = 'left') => (
    <th
      className={`cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wide ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ color: sort === col ? 'var(--fg)' : 'var(--muted)' }}
      onClick={() => { if (sort === col) setDir((d) => (d === 1 ? -1 : 1)); else { setSort(col); setDir(1) } }}
    >
      <span className="inline-flex items-center gap-1">
        {align === 'right' && sort === col && <span style={{ fontSize: 9 }}>{dir === 1 ? '▼' : '▲'}</span>}
        {label}
        {align === 'left' && sort === col && <span style={{ fontSize: 9 }}>{dir === 1 ? '▼' : '▲'}</span>}
      </span>
    </th>
  )

  if (rows.length === 0) {
    return (
      <div className="px-6 py-4">
        <EmptyState icon="Table2" title={state.events.length === 0 ? 'No ideas yet' : 'Nothing matches this filter'} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-4">
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--panel)' }}>
              {head('title', 'Idea')}
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Tags</th>
              {head('version', 'Version', 'right')}
              {head('comments', 'Comments', 'right')}
              {head('connections', 'Links', 'right')}
              {head('active', 'Last active', 'right')}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const comments = commentsForSpud(state, s.id).length
              const conns = outgoingMentions(state, s.id).length + backlinks(state, s.id).length
              return (
                <tr
                  key={s.id}
                  onClick={() => openIdea(s.id)}
                  className="cursor-pointer"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-3 py-2.5">
                    <span className="font-medium" style={{ fontFamily: 'Georgia, serif' }}>{s.title}</span>
                  </td>
                  <td className="px-3 py-2.5"><TagDots tags={s.tags} /></td>
                  <td className="px-3 py-2.5 text-right font-mono" style={{ color: 'var(--accent)' }}>{versionShort(s.version)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: comments ? 'var(--fg)' : 'var(--muted)' }}>{comments || '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: conns ? 'var(--fg)' : 'var(--muted)' }}>{conns || '—'}</td>
                  <td className="px-3 py-2.5 text-right text-xs" style={{ color: 'var(--muted)' }}>{relativeTime(s.lastActivityAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
        <Icon name="Table2" size={12} /> {rows.length} {rows.length === 1 ? 'idea' : 'ideas'}
      </div>
    </div>
  )
}
