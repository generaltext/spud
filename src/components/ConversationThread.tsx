import { useState } from 'react'
import { useStore } from '../lib/store'
import { commentsForSpud } from '../lib/reducer'
import { newId } from '../lib/ids'
import { relativeTime } from '../lib/format'
import { MentionInput } from './MentionInput'
import { MentionText } from './MentionText'
import { Avatar, Button } from './common'
import { Icon } from './Icon'

// Numbered discussion. Each comment gets a stable #N you can @-reference from
// another idea or from an edit note. Every comment bumps the idea's patch version.
export function ConversationThread({ spudId }: { spudId: string }) {
  const { state, dispatch, me } = useStore()
  const comments = commentsForSpud(state, spudId)
  const [body, setBody] = useState('')
  const [k, setK] = useState(0)

  const save = () => {
    if (!body.trim()) return
    void dispatch({ type: 'comment.add', subject: newId('cmt'), data: { spud: spudId, body } })
    setBody('')
    setK((v) => v + 1)
  }

  return (
    <div className="space-y-4">
      {comments.length > 0 && (
        <div className="space-y-3.5">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar actor={c.createdBy} size={24} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>#{c.seq}</span>
                  <span className="text-sm font-medium">{c.createdBy?.name ?? 'unknown'}</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{relativeTime(c.createdAt)}</span>
                  {c.createdBy?.id === me?.id && (
                    <button
                      type="button"
                      title="Delete comment"
                      onClick={() => void dispatch({ type: 'comment.delete', subject: c.id })}
                      className="ml-auto opacity-40 hover:opacity-100"
                    >
                      <Icon name="Trash2" size={13} />
                    </button>
                  )}
                </div>
                <MentionText body={c.body} className="text-sm leading-relaxed" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <MentionInput
          key={k}
          value=""
          onChange={setBody}
          placeholder="Add to the discussion… (@ to link an idea or #comment)"
          submitOnEnter
          onSubmit={save}
          minHeight={44}
          excludeId={spudId}
        />
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={save} disabled={!body.trim()}>
            <Icon name="CornerDownLeft" size={14} /> Comment
          </Button>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Enter to send · Shift+Enter for a new line</span>
        </div>
      </div>
    </div>
  )
}
