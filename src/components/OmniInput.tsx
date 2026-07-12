import { useMemo, useRef, useState, type RefObject } from 'react'
import { useStore } from '../lib/store'
import { useUi } from './ui'
import { allSpuds } from '../lib/reducer'
import { bodyToPlain } from '../lib/mentions'
import { versionShort } from '../lib/maturity'
import { newId } from '../lib/ids'
import { TagDots } from './TagChips'
import { Icon } from './Icon'

// A light fuzzy score: substring wins (earlier = better), else subsequence with a
// gap penalty. null = no match.
function fuzzy(text: string, q: string): number | null {
  const t = text.toLowerCase()
  const idx = t.indexOf(q)
  if (idx >= 0) return 100 - Math.min(idx, 60)
  let ti = 0, qi = 0, gaps = 0
  while (ti < t.length && qi < q.length) {
    if (t[ti] === q[qi]) qi++
    else if (qi > 0) gaps++
    ti++
  }
  return qi === q.length ? 40 - Math.min(gaps, 39) : null
}

type Row = { kind: 'create' } | { kind: 'idea'; id: string; title: string; version: string; tags: string[] }

// Dual-purpose top input: type to fuzzy-search ideas, or press Enter to plant a
// new one with what you typed. It IS the `n` shortcut target.
export function OmniInput({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const { state, dispatch } = useStore()
  const { openIdea } = useUi()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const q = query.trim()
  const results = useMemo(() => {
    if (!q) return []
    const ql = q.toLowerCase()
    return allSpuds(state)
      .map((s) => {
        const title = fuzzy(s.title, ql)
        const desc = s.body ? fuzzy(bodyToPlain(s.body), ql) : null
        const score = Math.max(title ?? -1, desc != null ? desc * 0.5 : -1)
        return { s, score, hit: title != null || desc != null }
      })
      .filter((r) => r.hit)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map((r) => ({ kind: 'idea' as const, id: r.s.id, title: r.s.title, version: versionShort(r.s.version), tags: r.s.tags }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, state.events.length, q])

  // create row first (default action = capture), matches then follow
  const rows: Row[] = q ? [{ kind: 'create' }, ...results] : []
  const showList = focused && q.length > 0

  const reset = () => { setQuery(''); setActive(0) }
  const create = () => {
    if (!q) return
    const id = newId('spd')
    void dispatch({ type: 'spud.plant', subject: id, data: { title: q } })
    reset()
    openIdea(id)
  }
  const activate = (i: number) => {
    const row = rows[i]
    if (!row) return
    if (row.kind === 'create') create()
    else { openIdea(row.id); reset(); inputRef.current?.blur() }
  }

  return (
    <div className="relative min-w-[240px] flex-1 md:max-w-[400px]">
      <form
        className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5"
        style={{ borderColor: focused ? 'var(--accent)' : 'var(--border)', background: 'var(--bg)', boxShadow: focused ? '0 0 0 3px var(--accent-soft)' : 'none' }}
        onSubmit={(e) => { e.preventDefault(); activate(active) }}
      >
        <Icon name="Search" size={15} style={{ color: 'var(--muted)' }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0) }}
          onFocus={() => setFocused(true)}
          onBlur={() => { if (blurTimer.current) clearTimeout(blurTimer.current); blurTimer.current = setTimeout(() => setFocused(false), 150) }}
          onKeyDown={(e) => {
            if (!showList) return
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
            else if (e.key === 'Escape') { e.preventDefault(); reset(); inputRef.current?.blur() }
          }}
          placeholder="New idea or search…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          aria-label="New idea or search"
        />
        {q ? (
          <button type="submit" className="rounded-md px-2.5 py-1 text-xs font-semibold" style={{ background: 'var(--accent)', color: '#fff' }}>
            {active === 0 ? 'Add' : 'Open'}
          </button>
        ) : (
          <kbd className="rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none" style={{ borderColor: 'var(--border)', background: 'var(--hover)', color: 'var(--muted)' }} title="Press n to start a new idea">n</kbd>
        )}
      </form>

      {showList && (
        <ul className="absolute left-0 right-0 top-full z-[70] mt-1 max-h-80 overflow-auto rounded-lg border py-1 shadow-xl" style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}>
          {rows.map((row, i) => (
            <li key={row.kind === 'create' ? 'create' : row.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); activate(i) }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm"
                style={{ background: i === active ? 'var(--hover)' : 'transparent' }}
              >
                {row.kind === 'create' ? (
                  <>
                    <Icon name="Plus" size={15} style={{ color: 'var(--accent)' }} />
                    <span>Add idea <span className="font-medium">“{q}”</span></span>
                  </>
                ) : (
                  <>
                    <TagDots tags={row.tags} size={7} />
                    <span className="min-w-0 flex-1 truncate">{row.title}</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{row.version}</span>
                  </>
                )}
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 pb-1 pt-0.5 text-xs" style={{ color: 'var(--muted)' }}>No matching ideas — press Enter to add it.</li>
          )}
        </ul>
      )}
    </div>
  )
}
