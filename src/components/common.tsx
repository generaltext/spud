import type { ReactNode } from 'react'
import type { Actor } from '../lib/events'
import { initials, relativeTime } from '../lib/format'
import { Icon, type IconName } from './Icon'

const AVATAR_COLORS = ['#16a34a', '#2563eb', '#d97706', '#7c3aed', '#e11d48', '#0891b2', '#0d9488']

function colorFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]!
}

export function Avatar({ actor, size = 22 }: { actor: Actor | null; size?: number }) {
  const name = actor?.name ?? '?'
  const bg = colorFor(actor?.id ?? name)
  return (
    <span
      title={name}
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${bg} 18%, transparent)`,
        color: bg,
        fontSize: size * 0.42,
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
    >
      {initials(name)}
    </span>
  )
}

export function ActorStamp({
  actor,
  ts,
  prefix = 'by',
}: {
  actor: Actor | null
  ts: string
  prefix?: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
      <Avatar actor={actor} size={16} />
      <span>
        {prefix} {actor?.name ?? 'unknown'} · {relativeTime(ts)}
      </span>
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: IconName
  title: string
  hint?: string | undefined
  action?: ReactNode | undefined
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: 'var(--hover)', color: 'var(--muted)' }}
      >
        <Icon name={icon} size={22} />
      </div>
      <div className="text-base font-medium">{title}</div>
      {hint && (
        <div className="max-w-sm text-sm" style={{ color: 'var(--muted)' }}>
          {hint}
        </div>
      )}
      {action}
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'default',
  type = 'button',
  title,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'ghost'
  type?: 'button' | 'submit'
  title?: string
  disabled?: boolean
}) {
  const base =
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50'
  const styles: Record<string, string> = {
    default: 'border',
    primary: 'text-white',
    ghost: '',
  }
  const inline: React.CSSProperties =
    variant === 'primary'
      ? { background: 'var(--accent)', color: '#fff' }
      : variant === 'default'
        ? { borderColor: 'var(--border)', background: 'var(--panel)' }
        : {}
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`${base} ${styles[variant]}`}
      style={inline}
    >
      {children}
    </button>
  )
}
