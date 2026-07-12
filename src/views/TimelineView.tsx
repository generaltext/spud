import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { useUi } from '../components/ui'
import { allSpuds, eventsForSpud, timelineLinks, type IdeaEvent } from '../lib/reducer'
import { versionShort } from '../lib/maturity'
import { tagHex } from '../lib/model'
import { TagDots } from '../components/TagChips'
import { EmptyState } from '../components/common'

// The default view. One lane per idea, most recently active at the top. A lane
// runs from creation to last activity with a dot for each change — major edits as
// large filled dots, minor edits as small filled, comments (patches) as small
// outlines. Curves connect the exact edit/comment that first linked two ideas to
// the version the target was at then (append-only log → we know which event it was).
//
// The timeline scrolls horizontally; titles stay pinned at the left. On narrow
// screens each lane stacks into two rows: title, then a full-width track.

const LABEL_W = 200
const ROW_H = 32 // desktop lane height
const M_TITLE_H = 26 // mobile: title row
const M_TRACK_H = 30 // mobile: track row
const AXIS_H = 20
const MIN_TRACK = 560 // track never narrower than this → scrolls on small screens

function EventDot({ e, x }: { e: IdeaEvent; x: number }) {
  const cls = e.kind === 'plant' ? 'plant' : e.kind === 'major' ? 'major' : e.kind === 'comment' ? 'comment' : 'minor'
  const title = e.kind === 'plant' ? 'created' : e.kind === 'major' ? 'major new approach' : e.kind === 'comment' ? 'comment' : 'edit'
  return <span className={`tl-dot ${cls}`} style={{ left: `${x}%` }} title={title} />
}

export function TimelineView() {
  const { state, config } = useStore()
  const { openIdea, activeTags } = useUi()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [vw, setVw] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setVw(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
    const span = Math.max(nowT - min, 86400000)
    return { minTs: min - span * 0.04, now: nowT + span * 0.02 }
  }, [spuds])

  const isMobile = vw > 0 && vw < 640
  const laneH = isMobile ? M_TITLE_H + M_TRACK_H : ROW_H
  const trackStart = isMobile ? 0 : LABEL_W
  const trackW = Math.max(MIN_TRACK, (vw || 800) - trackStart)
  const contentW = trackStart + trackW

  const pct = (ts: string) => Math.max(0, Math.min(100, ((new Date(ts).getTime() - minTs) / (now - minTs)) * 100))
  const xPx = (ts: string) => trackStart + (pct(ts) / 100) * trackW
  const trackCenterY = (i: number) => (isMobile ? i * laneH + M_TITLE_H + M_TRACK_H / 2 : i * laneH + ROW_H / 2)

  const ticks = useMemo(() => {
    const out: { x: number; label: string }[] = []
    for (let f = 0; f <= 1.0001; f += 0.25) {
      const t = minTs + f * (now - minTs)
      const daysAgo = Math.round((Date.now() - t) / 86400000)
      out.push({ x: trackStart + f * trackW, label: daysAgo <= 0 ? 'now' : daysAgo < 14 ? `${daysAgo}d` : `${Math.round(daysAgo / 7)}w` })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minTs, now, trackStart, trackW])

  const rowIndex = useMemo(() => new Map(spuds.map((s, i) => [s.id, i])), [spuds])
  const links = useMemo(
    () => timelineLinks(state).filter((l) => rowIndex.has(l.from) && rowIndex.has(l.to)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, state.events.length, rowIndex],
  )

  if (spuds.length === 0) {
    return (
      <div className="px-6 py-4">
        <EmptyState icon="Clock" title={state.events.length === 0 ? 'No ideas yet' : 'Nothing matches this filter'} hint={state.events.length === 0 ? 'Add your first idea up top, or press n.' : undefined} />
      </div>
    )
  }

  const lanesH = spuds.length * laneH

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-4 sm:px-6">
      <div ref={scrollRef} className="tl-scroll">
        <div style={{ width: contentW, position: 'relative' }}>
          {/* axis */}
          <div style={{ position: 'relative', height: AXIS_H }}>
            {ticks.map((t, i) => (
              <span key={i} className="tl-tick" style={{ left: t.x }}>{t.label}</span>
            ))}
          </div>

          {/* lanes + connector overlay */}
          <div style={{ position: 'relative', height: lanesH }}>
            {vw > 0 && (
              <svg className="pointer-events-none absolute inset-0" width={contentW} height={lanesH} style={{ overflow: 'visible' }}>
                {links.map((l, i) => {
                  const ax = xPx(l.atTs), ay = trackCenterY(rowIndex.get(l.from)!)
                  const bx = xPx(l.targetTs), by = trackCenterY(rowIndex.get(l.to)!)
                  const col = tagHex(state.spuds[l.to]!.tags[0] ?? '', config)
                  const hot = hovered === l.from || hovered === l.to
                  const bend = Math.max(20, Math.min(120, Math.abs(ay - by) * 0.28))
                  return (
                    <g key={i} opacity={hovered && !hot ? 0.07 : hot ? 0.9 : 0.22}>
                      <path d={`M ${ax} ${ay} C ${ax + bend} ${ay}, ${bx + bend} ${by}, ${bx} ${by}`} fill="none" stroke={col} strokeWidth={hot ? 1.5 : 1.1} />
                      <circle cx={bx} cy={by} r={hot ? 3 : 2.2} fill={col} />
                    </g>
                  )
                })}
              </svg>
            )}

            {spuds.map((s) => {
              const evs = eventsForSpud(state, s.id)
              const left = pct(s.createdAt)
              const right = pct(s.lastActivityAt)
              const title = (
                <div className="tl-title" style={isMobile ? { width: vw, height: M_TITLE_H } : undefined}>
                  <span className="min-w-0 truncate">{s.title}</span>
                  <TagDots tags={s.tags} />
                </div>
              )
              const track = (
                <div className="tl-track" style={isMobile ? { height: M_TRACK_H } : undefined}>
                  {ticks.map((t, j) => <span key={j} className="tl-grid" style={{ left: `${((t.x - trackStart) / trackW) * 100}%` }} />)}
                  <span className="tl-bar" style={{ left: `${left}%`, width: `${Math.max(0.6, right - left)}%` }} />
                  {evs.map((e, j) => <EventDot key={j} e={e} x={pct(e.ts)} />)}
                  <span className="tl-ver" style={{ left: `${right}%` }}>{versionShort(s.version)}</span>
                </div>
              )
              return isMobile ? (
                <div key={s.id} className="tl-lane-m" style={{ height: laneH }} onClick={() => openIdea(s.id)} onMouseEnter={() => setHovered(s.id)} onMouseLeave={() => setHovered(null)}>
                  {title}
                  {track}
                </div>
              ) : (
                <div key={s.id} className="tl-lane" style={{ gridTemplateColumns: `${LABEL_W}px 1fr`, height: laneH }} onClick={() => openIdea(s.id)} onMouseEnter={() => setHovered(s.id)} onMouseLeave={() => setHovered(null)}>
                  {title}
                  {track}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
