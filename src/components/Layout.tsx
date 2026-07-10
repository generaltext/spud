import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { allTags } from '../lib/reducer'
import { tagHex } from '../lib/model'
import { newId } from '../lib/ids'
import { UiContext, type Ui } from './ui'
import { Drawer } from './Drawer'
import { Icon, PotatoMark, type IconName } from './Icon'

const VIEWS: { to: string; label: string; icon: IconName }[] = [
  { to: '/timeline', label: 'Timeline', icon: 'History' },
  { to: '/network', label: 'Network', icon: 'Share2' },
  { to: '/list', label: 'List', icon: 'Table2' },
]

export function Layout() {
  const { connected, me, state, config, dispatch } = useStore()
  const [params, setParams] = useSearchParams()
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedId = params.get('i')
  const ui: Ui = useMemo(() => ({
    selectedId,
    openIdea: (id) => setParams((p) => { const n = new URLSearchParams(p); n.set('i', id); return n }, { replace: false }),
    closeIdea: () => setParams((p) => { const n = new URLSearchParams(p); n.delete('i'); return n }, { replace: false }),
    activeTags,
    toggleTag: (label) => setActiveTags((t) => (t.includes(label) ? t.filter((x) => x !== label) : [...t, label])),
    focusNewIdea: () => inputRef.current?.focus(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [selectedId, activeTags, setParams])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (e.key === 'Escape' && selectedId) { ui.closeIdea(); return }
      if (!typing && (e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault(); inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, ui])

  const tags = allTags(state)

  const plant = () => {
    const clean = title.trim()
    if (!clean) return
    const id = newId('spd')
    void dispatch({ type: 'spud.plant', subject: id, data: { title: clean } })
    setTitle('')
    ui.openIdea(id)
  }

  return (
    <UiContext.Provider value={ui}>
      <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
        {/* top bar */}
        <header className="flex flex-wrap items-center gap-4 border-b px-4 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          <div className="flex items-center gap-2.5 select-none">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <PotatoMark size={19} />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[17px] font-semibold tracking-wide" style={{ fontFamily: 'Georgia, serif' }}>SPUD</span>
              <span className="mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>see what grows</span>
            </span>
          </div>

          <form
            className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border px-2.5 py-1.5 md:max-w-[380px]"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
            onSubmit={(e) => { e.preventDefault(); plant() }}
          >
            <Icon name="Plus" size={15} style={{ color: 'var(--muted)' }} />
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New idea…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              aria-label="New idea"
            />
            {title.trim() ? (
              <button type="submit" className="rounded-md px-2.5 py-1 text-xs font-semibold" style={{ background: 'var(--accent)', color: '#fff' }}>Add</button>
            ) : (
              <kbd
                className="rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none"
                style={{ borderColor: 'var(--border)', background: 'var(--hover)', color: 'var(--muted)' }}
                title="Press n to start a new idea"
              >
                n
              </kbd>
            )}
          </form>

          <nav className="ml-auto flex items-center gap-1 rounded-lg border p-0.5" style={{ borderColor: 'var(--border)' }}>
            {VIEWS.map((v) => (
              <NavLink key={v.to} to={v.to + (selectedId ? `?i=${selectedId}` : '')} className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium" style={({ isActive }) => ({ background: isActive ? 'var(--accent-soft)' : 'transparent', color: isActive ? 'var(--accent)' : 'var(--muted)' })}>
                <Icon name={v.icon} size={15} />
                <span className="hidden sm:inline">{v.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
            <Icon name={connected ? 'Wifi' : 'WifiOff'} size={13} />
            {me && <span className="hidden truncate md:inline">{me.name}</span>}
          </div>
        </header>

        {/* tag filter strip */}
        {tags.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto border-b px-4 py-2" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Filter</span>
            {tags.map((t) => {
              const on = activeTags.includes(t.label)
              const c = tagHex(t.label, config)
              return (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => ui.toggleTag(t.label)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs"
                  style={{ borderColor: on ? c : 'var(--border)', color: on ? c : 'var(--muted)', background: on ? `color-mix(in srgb, ${c} 12%, transparent)` : 'transparent' }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: c }} />
                  {t.label} <span style={{ opacity: 0.6 }}>{t.count}</span>
                </button>
              )
            })}
            {activeTags.length > 0 && (
              <button type="button" onClick={() => setActiveTags([])} className="text-xs" style={{ color: 'var(--accent)' }}>clear</button>
            )}
          </div>
        )}

        {/* the idea space */}
        <main className="relative min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>

        <Drawer />
      </div>
    </UiContext.Provider>
  )
}
