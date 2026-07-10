import { useState } from 'react'
import { useStore } from '../lib/store'
import { allTags } from '../lib/reducer'
import { tagHex } from '../lib/model'
import { Icon } from './Icon'

// A tag as a colored pill.
export function TagChip({
  label,
  onRemove,
  onClick,
}: {
  label: string
  onRemove?: () => void
  onClick?: () => void
}) {
  const { config } = useStore()
  const c = tagHex(label, config)
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs"
      style={{ color: c, background: `color-mix(in srgb, ${c} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 30%, transparent)` }}
    >
      <button type="button" onClick={onClick} className={onClick ? 'hover:underline' : ''} style={{ color: 'inherit' }}>
        {label}
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} title="Remove tag" className="opacity-60 hover:opacity-100">
          <Icon name="X" size={11} />
        </button>
      )}
    </span>
  )
}

// A compact row of colored dots — one per tag — for dense table/timeline rows.
export function TagDots({ tags, size = 8 }: { tags: string[]; size?: number }) {
  const { config } = useStore()
  if (tags.length === 0) return null
  return (
    <span className="inline-flex items-center gap-1" title={tags.join(', ')}>
      {tags.map((t) => (
        <span key={t} style={{ width: size, height: size, borderRadius: 999, background: tagHex(t, config), display: 'inline-block' }} />
      ))}
    </span>
  )
}

// Editable tag list for the drawer.
export function TagEditor({ spudId, tags }: { spudId: string; tags: string[] }) {
  const { state, dispatch } = useStore()
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')
  const suggestions = allTags(state)
    .filter((t) => !tags.includes(t.label) && (value === '' || t.label.includes(value.toLowerCase())))
    .slice(0, 6)

  function add(label: string) {
    const clean = label.trim().toLowerCase()
    setValue('')
    setAdding(false)
    if (!clean || tags.includes(clean)) return
    void dispatch({ type: 'tag.add', subject: spudId, data: { label: clean } })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <TagChip key={t} label={t} onRemove={() => void dispatch({ type: 'tag.remove', subject: spudId, data: { label: t } })} />
      ))}
      {adding ? (
        <div className="relative">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add(value)
              if (e.key === 'Escape') { setValue(''); setAdding(false) }
            }}
            onBlur={() => setTimeout(() => setAdding(false), 150)}
            placeholder="tag"
            className="w-24 rounded-full border px-2.5 py-0.5 text-xs outline-none focus:ring-2"
            style={{ borderColor: 'var(--border)', background: 'var(--panel)', '--tw-ring-color': 'color-mix(in srgb, var(--accent) 40%, transparent)' } as React.CSSProperties}
          />
          {suggestions.length > 0 && (
            <ul className="absolute left-0 top-7 z-[60] w-40 overflow-hidden rounded-md border py-1 shadow-lg" style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}>
              {suggestions.map((s) => (
                <li key={s.label}>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); add(s.label) }} className="flex w-full items-center justify-between px-2.5 py-1 text-left text-xs hover:bg-[var(--hover)]">
                    <span>{s.label}</span>
                    <span style={{ color: 'var(--muted)' }}>{s.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
          <Icon name="Plus" size={11} /> Tag
        </button>
      )}
    </div>
  )
}
