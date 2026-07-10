import { useMemo } from 'react'
import { useStore } from '../lib/store'
import { useUi } from '../components/ui'
import { allSpuds, eventsForSpud, type IdeaEvent } from '../lib/reducer'
import { versionShort } from '../lib/maturity'
import { TagDots } from '../components/TagChips'
import { EmptyState } from '../components/common'

// The default view. One lane per idea, most recently active at the top. A lane
// runs from when the idea was created to its last activity, with a dot for each
// change — so an idea that has been discussed and revised for months reads as a
// long, busy line, and a fresh thought reads as a short one. Reach back through
// time to see which ideas are still alive.

const LABEL_W = 220

function EventDot({ e, x }: { e: IdeaEvent; x: number }) {
  const style: React.CSSProperties = { left: `${x}%` }
  if (e.kind === 'plant') return <span className="tl-dot plant" style={style} title="created" />
  if (e.kind === 'major') return <span className="tl-dot major" style={style} title="major new approach" />
  if (e.kind === 'comment') return <span className="tl-dot comment" style={style} title="comment" />
  return <span className="tl-dot minor" style={style} title="edit" />
}

export function TimelineView() {
  const { state } = useStore()
  const { openIdea, activeTags } = useUi()

  const spuds = useMemo(() => {
    let list = allSpuds(state)
    if (activeTags.length) list = list.filter((s) => activeTags.every((t) => s.tags.includes(t)))
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, state.events.length, activeTags])

  const { minTs, now } = useMemo(() => {
    const created = spuds.map((s) => new Date(s.createdAt).getTime()).filter((n) => !Number.isNaN(n))
    const nowT = Date.now()
    const min = created.length ? Math.min(...created) : nowT - 7 * 86400000
    // pad the left a touch so the earliest dot isn't flush to the edge
    const span = Math.max(nowT - min, 86400000)
    return { minTs: min - span * 0.04, now: nowT + span * 0.02 }
  }, [spuds])

  const xOf = (ts: string) => {
    const t = new Date(ts).getTime()
    return Math.max(0, Math.min(100, ((t - minTs) / (now - minTs)) * 100))
  }

  const ticks = useMemo(() => {
    const out: { x: number; label: string }[] = []
    for (let f = 0; f <= 1.0001; f += 0.25) {
      const t = minTs + f * (now - minTs)
      const daysAgo = Math.round((Date.now() - t) / 86400000)
      out.push({ x: f * 100, label: daysAgo <= 0 ? 'now' : daysAgo < 14 ? `${daysAgo}d` : `${Math.round(daysAgo / 7)}w` })
    }
    return out
  }, [minTs, now])

  if (spuds.length === 0) {
    return (
      <div className="px-6 py-4">
        <EmptyState icon="Clock" title={state.events.length === 0 ? 'No ideas yet' : 'Nothing matches this filter'} hint={state.events.length === 0 ? 'Add your first idea up top, or press n.' : undefined} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-4">
      <div className="tl-axis" style={{ gridTemplateColumns: `${LABEL_W}px 1fr` }}>
        <div />
        <div className="tl-ticks">
          {ticks.map((t, i) => (
            <span key={i} style={{ left: `${t.x}%` }}>{t.label}</span>
          ))}
        </div>
      </div>

      <div>
        {spuds.map((s) => {
          const evs = eventsForSpud(state, s.id)
          const left = xOf(s.createdAt)
          const right = xOf(s.lastActivityAt)
          return (
            <div key={s.id} className="tl-row" onClick={() => openIdea(s.id)} style={{ gridTemplateColumns: `${LABEL_W}px 1fr` }}>
              <div className="tl-label">
                <TagDots tags={s.tags} />
                <span className="truncate">{s.title}</span>
              </div>
              <div className="tl-track">
                {ticks.map((t, i) => <span key={i} className="tl-grid" style={{ left: `${t.x}%` }} />)}
                <span className="tl-bar" style={{ left: `${left}%`, width: `${Math.max(0.6, right - left)}%` }} />
                {evs.map((e, i) => <EventDot key={i} e={e} x={xOf(e.ts)} />)}
                <span className="tl-ver" style={{ left: `${right}%` }}>{versionShort(s.version)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
