import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { useUi } from './ui'
import { backlinks, outgoingMentions, type Revision, type SpudRecord } from '../lib/reducer'
import { versionFull, versionShort } from '../lib/maturity'
import { relativeTime } from '../lib/format'
import { MentionText } from './MentionText'
import { MentionInput } from './MentionInput'
import { ConversationThread } from './ConversationThread'
import { TagEditor } from './TagChips'
import { Avatar, Button } from './common'
import { Icon } from './Icon'

function VersionHistory({ revisions, viewing, onView }: { revisions: Revision[]; viewing: number | null; onView: (i: number | null) => void }) {
  const [open, setOpen] = useState(false)
  const current = revisions.length - 1
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium"
        style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        title="Version history"
      >
        <Icon name="History" size={13} /> {revisions.length} {revisions.length === 1 ? 'version' : 'versions'} <Icon name="ChevronDown" size={11} />
      </button>
      {open && (
        <ul className="absolute right-0 top-8 z-40 max-h-72 w-64 overflow-auto rounded-lg border py-1 shadow-lg" style={{ background: 'var(--panel)', borderColor: 'var(--border)' }}>
          {[...revisions].reverse().map((rev, ri) => {
            const idx = revisions.length - 1 - ri
            const isCurrent = idx === current
            const selected = viewing === null ? isCurrent : viewing === idx
            return (
              <li key={idx}>
                <button type="button" onClick={() => { onView(isCurrent ? null : idx); setOpen(false) }} className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs" style={{ background: selected ? 'var(--hover)' : 'transparent' }}>
                  <span className="font-mono" style={{ color: 'var(--accent)' }}>v{rev.v}</span>
                  <span className="min-w-0 flex-1">
                    <span className="capitalize">{rev.kind === 'major' ? 'major approach' : rev.kind}</span>{isCurrent && ' · current'}
                    <span className="block" style={{ color: 'var(--muted)' }}>{rev.by?.name ?? 'unknown'} · {relativeTime(rev.ts)}</span>
                    {rev.note && <span className="mt-0.5 block italic" style={{ color: 'var(--muted)' }}>“{rev.note}”</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Description({ spud }: { spud: SpudRecord }) {
  const { dispatch } = useStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(spud.body)
  const [major, setMajor] = useState(false)
  const [note, setNote] = useState('')

  const start = () => { setDraft(spud.body); setMajor(false); setNote(''); setEditing(true) }
  const save = () => {
    if (draft !== spud.body) {
      const data: Record<string, unknown> = { body: draft }
      if (major) { data.major = true; if (note.trim()) data.note = note.trim() }
      void dispatch({ type: 'spud.edit', subject: spud.id, data })
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <MentionInput key="desc-edit" value={spud.body} onChange={setDraft} autoFocus minHeight={120} excludeId={spud.id} placeholder="Describe the idea… (@ to link another idea)" />
        <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" checked={major} onChange={(e) => setMajor(e.target.checked)} />
          This is a major new approach (bumps the major version)
        </label>
        {major && (
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What changed, and why? (optional)"
            className="w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2"
            style={{ borderColor: 'var(--border)', background: 'var(--panel)', '--tw-ring-color': 'color-mix(in srgb, var(--accent) 40%, transparent)' } as React.CSSProperties}
          />
        )}
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={save}><Icon name="Check" size={14} /> Save</Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{major ? 'saves as a major version' : 'saves as a minor edit'}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={start}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') start() }}
      title="Click to edit"
      className="-mx-2 cursor-text rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--hover)]"
    >
      {spud.body.trim()
        ? <MentionText body={spud.body} className="text-sm leading-relaxed" />
        : <span className="text-sm italic" style={{ color: 'var(--muted)' }}>Add a description…</span>}
    </div>
  )
}

function Title({ spud }: { spud: SpudRecord }) {
  const { dispatch } = useStore()
  const ref = useRef<HTMLTextAreaElement>(null)
  const commit = (next: string) => {
    const clean = next.trim()
    if (clean && clean !== spud.title) void dispatch({ type: 'spud.edit', subject: spud.id, data: { title: clean } })
  }
  return (
    <textarea
      ref={ref}
      defaultValue={spud.title}
      key={spud.id + spud.title}
      rows={1}
      onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
      className="w-full resize-none bg-transparent font-serif text-2xl font-semibold leading-tight outline-none"
      style={{ fontFamily: 'Georgia, serif', opacity: spud.archived ? 0.6 : 1 }}
    />
  )
}

function ConnList({ title, spuds }: { title: string; spuds: SpudRecord[] }) {
  const { openIdea } = useUi()
  if (spuds.length === 0) return null
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{title}</div>
      <div className="space-y-0.5">
        {spuds.map((s) => (
          <button key={s.id} type="button" onClick={() => openIdea(s.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--hover)]">
            <Icon name="AtSign" size={12} style={{ color: 'var(--muted)' }} />
            <span className="min-w-0 flex-1 truncate">{s.title}</span>
            <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{versionShort(s.version)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function Drawer() {
  const { state, dispatch } = useStore()
  const { selectedId, closeIdea } = useUi()
  const [viewingRev, setViewingRev] = useState<number | null>(null)

  const spud = selectedId ? state.spuds[selectedId] : null
  // reset the version-viewer when switching ideas
  useEffect(() => { setViewingRev(null) }, [selectedId])

  const mentions = spud ? outgoingMentions(state, spud.id) : []
  const refs = spud ? backlinks(state, spud.id) : []
  const viewingBody = spud && viewingRev !== null ? spud.revisions[viewingRev] : null

  return (
    <>
      {spud && <div className="fixed inset-0 z-30" onClick={closeIdea} />}
      <aside className={`fixed right-0 top-0 bottom-0 z-40 flex w-[420px] max-w-[92vw] flex-col border-l shadow-2xl transition-transform duration-300 ${spud ? 'translate-x-0' : 'translate-x-[103%]'}`} style={{ background: 'var(--panel)', borderColor: 'var(--border)' }} aria-hidden={!spud}>
        {spud && (
          <>
            <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--border)' }}>
              <span className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                <span className="font-mono" style={{ color: 'var(--accent)' }}>{versionFull(spud.version)}</span>
                <VersionHistory revisions={spud.revisions} viewing={viewingRev} onView={setViewingRev} />
              </span>
              <div className="flex items-center gap-1">
                {!spud.archived ? (
                  <button type="button" title="Archive" onClick={() => void dispatch({ type: 'spud.archive', subject: spud.id })} className="rounded-md p-1.5 opacity-50 hover:opacity-100"><Icon name="Archive" size={15} /></button>
                ) : (
                  <button type="button" title="Restore" onClick={() => void dispatch({ type: 'spud.restore', subject: spud.id })} className="rounded-md p-1.5 opacity-60 hover:opacity-100"><Icon name="RotateCcw" size={15} /></button>
                )}
                <button type="button" title="Close" onClick={closeIdea} className="rounded-md p-1.5 opacity-60 hover:opacity-100"><Icon name="X" size={16} /></button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <Title spud={spud} />

              {spud.archived && (
                <div className="mt-2 rounded-md border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                  Archived. Hidden from the views by default, kept in history.
                </div>
              )}

              <div className="mt-3">
                {viewingBody ? (
                  <div>
                    <div className="mb-2 flex items-center gap-2 rounded-md px-2 py-1 text-xs" style={{ background: 'var(--hover)', color: 'var(--muted)' }}>
                      <Icon name="History" size={12} /> Viewing v{viewingBody.v}. Older version.
                      <button type="button" onClick={() => setViewingRev(null)} className="ml-auto font-medium" style={{ color: 'var(--accent)' }}>Back to current</button>
                    </div>
                    {viewingBody.body.trim() ? <MentionText body={viewingBody.body} className="text-sm leading-relaxed" /> : <span className="text-sm italic" style={{ color: 'var(--muted)' }}>Empty at this version.</span>}
                  </div>
                ) : (
                  <Description spud={spud} />
                )}
              </div>

              <div className="mt-4">
                <TagEditor spudId={spud.id} tags={spud.tags} />
              </div>

              {(mentions.length > 0 || refs.length > 0) && (
                <div className="mt-5 space-y-4">
                  <ConnList title="Mentions" spuds={mentions} />
                  <ConnList title="Referenced by" spuds={refs} />
                </div>
              )}

              <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  <Icon name="MessageSquare" size={12} /> Discussion{spud.commentCount > 0 ? ` (${spud.commentCount})` : ''}
                </div>
                <ConversationThread spudId={spud.id} />
              </div>

              <div className="mt-6 flex items-center gap-1.5 border-t pt-3 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                <Avatar actor={spud.createdBy} size={16} /> added by {spud.createdBy?.name ?? 'unknown'} · {relativeTime(spud.createdAt)}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
