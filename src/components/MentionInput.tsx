import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { mentionToken, parseBody, idKind, bodyToPlain } from '../lib/mentions'
import { Icon } from './Icon'

// A WYSIWYG-ish text editor: plain typing, plus mentions that link.
//   @  → autocomplete ideas (by title) and discussions (by #number/snippet)
//   #  → autocomplete discussions only, with a preview of the comment text
// Choosing one drops a chip that serializes to `@[Label](id)`. Seeded once from
// the incoming value, uncontrolled thereafter (parent resets via a new `key`).

interface Match {
  id: string
  label: string // token label
  kind: 'spd' | 'cmt'
  preview?: string
}

interface Popup {
  items: Match[]
  active: number
  start: number
  end: number
  node: Text
  query: string
}

function chipDisplay(id: string, label: string): string {
  return idKind(id) === 'cmt' ? label : '@' + label
}

function buildInitialDom(el: HTMLElement, value: string) {
  el.replaceChildren()
  for (const seg of parseBody(value)) {
    if (seg.type === 'mention') {
      el.appendChild(makeChip(seg.id, seg.label))
    } else {
      const lines = seg.text.split('\n')
      lines.forEach((line, i) => {
        if (i > 0) el.appendChild(document.createElement('br'))
        if (line) el.appendChild(document.createTextNode(line))
      })
    }
  }
}

function makeChip(id: string, label: string): HTMLElement {
  const span = document.createElement('span')
  span.className = 'mention'
  span.contentEditable = 'false'
  span.dataset.id = id
  span.dataset.label = label
  span.textContent = chipDisplay(id, label)
  return span
}

function serialize(root: HTMLElement): string {
  let out = ''
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        out += (child as Text).data
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement
        if (el.classList.contains('mention')) {
          out += mentionToken(el.dataset.id ?? '', el.dataset.label ?? '')
        } else if (el.tagName === 'BR') {
          out += '\n'
        } else {
          if (/^(DIV|P)$/.test(el.tagName) && out && !out.endsWith('\n')) out += '\n'
          walk(el)
        }
      }
    })
  }
  walk(root)
  return out.replace(/\n+$/, '')
}

export function MentionInput({
  value,
  onChange,
  placeholder,
  submitOnEnter = false,
  onSubmit,
  autoFocus = false,
  minHeight = 40,
  excludeId,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  submitOnEnter?: boolean
  onSubmit?: () => void
  autoFocus?: boolean
  minHeight?: number
  excludeId?: string
}) {
  const { state } = useStore()
  const ref = useRef<HTMLDivElement>(null)
  const [popup, setPopup] = useState<Popup | null>(null)

  useEffect(() => {
    if (ref.current) {
      buildInitialDom(ref.current, value)
      if (autoFocus) {
        ref.current.focus()
        const r = document.createRange()
        r.selectNodeContents(ref.current)
        r.collapse(false)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(r)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function searchIdeas(q: string): Match[] {
    return Object.values(state.spuds)
      .filter((s) => !s.archived && s.id !== excludeId)
      .filter((s) => q === '' || s.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 5)
      .map((s) => ({ id: s.id, label: s.title, kind: 'spd' as const }))
  }

  function searchComments(q: string, limit: number): Match[] {
    return Object.values(state.comments)
      .filter((c) => !c.deleted)
      .filter((c) => q === '' || String(c.seq).includes(q) || bodyToPlain(c.body).toLowerCase().includes(q))
      .sort((a, b) => b.seq - a.seq)
      .slice(0, limit)
      .map((c) => ({ id: c.id, label: '#' + c.seq, kind: 'cmt' as const, preview: bodyToPlain(c.body).slice(0, 52) }))
  }

  function detectTrigger() {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return setPopup(null)
    const node = sel.anchorNode
    if (!node || node.nodeType !== Node.TEXT_NODE || !ref.current?.contains(node)) return setPopup(null)
    const before = (node as Text).data.slice(0, sel.anchorOffset)

    const atM = /(?:^|\s)@([^\s@#]*)$/.exec(before)
    const hashM = /(?:^|\s)#(\d*)$/.exec(before)

    let trigger: '@' | '#' | null = null
    let query = ''
    if (hashM) { trigger = '#'; query = hashM[1] ?? '' }
    else if (atM) { trigger = '@'; query = atM[1] ?? '' }
    if (!trigger) return setPopup(null)

    const q = query.trim().toLowerCase()
    const items = trigger === '#' ? searchComments(q, 6) : [...searchIdeas(q), ...(q ? searchComments(q, 3) : [])].slice(0, 6)

    setPopup((prev) => ({
      items,
      active: prev && prev.query === trigger + query ? Math.min(prev.active, Math.max(0, items.length - 1)) : 0,
      start: sel.anchorOffset - query.length - 1, // the trigger char
      end: sel.anchorOffset,
      node: node as Text,
      query: trigger + query,
    }))
  }

  function choose(match: Match) {
    if (!popup) return
    const { node, start, end } = popup
    const range = document.createRange()
    range.setStart(node, start)
    range.setEnd(node, end)
    range.deleteContents()
    const chip = makeChip(match.id, match.label)
    range.insertNode(chip)
    const space = document.createTextNode(' ')
    chip.after(space)
    const after = document.createRange()
    after.setStartAfter(space)
    after.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(after)
    setPopup(null)
    if (ref.current) onChange(serialize(ref.current))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (popup && popup.items.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setPopup({ ...popup, active: (popup.active + 1) % popup.items.length }); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setPopup({ ...popup, active: (popup.active - 1 + popup.items.length) % popup.items.length }); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(popup.items[popup.active]!); return }
      if (e.key === 'Escape') { e.preventDefault(); setPopup(null); return }
    }
    if (submitOnEnter && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit?.() }
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={() => { if (ref.current) onChange(serialize(ref.current)); detectTrigger() }}
        onKeyUp={detectTrigger}
        onClick={detectTrigger}
        onBlur={() => setTimeout(() => setPopup(null), 150)}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2"
        style={{
          minHeight,
          borderColor: 'var(--border)',
          background: 'var(--panel)',
          '--tw-ring-color': 'color-mix(in srgb, var(--accent) 40%, transparent)',
        } as React.CSSProperties}
      />
      {popup && (
        <ul
          className="absolute left-0 top-full z-[70] mt-1 max-h-64 w-full max-w-sm overflow-auto rounded-lg border py-1 shadow-xl"
          style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}
        >
          {popup.items.length === 0 && (
            <li className="px-3 py-2 text-sm" style={{ color: 'var(--muted)' }}>
              {popup.query.startsWith('#') ? 'No matching comments' : 'No matches'}
            </li>
          )}
          {popup.items.map((m, i) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); choose(m) }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
                style={{ background: i === popup.active ? 'var(--hover)' : 'transparent' }}
              >
                <Icon name={m.kind === 'cmt' ? 'MessageSquare' : 'Lightbulb'} size={13} style={{ color: 'var(--muted)' }} />
                {m.kind === 'cmt' ? (
                  <>
                    <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>{m.label}</span>
                    <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--muted)' }}>{m.preview}</span>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate">{m.label}</span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>idea</span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
