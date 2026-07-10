import { PotatoMark, Icon } from './Icon'

// Shown when SPUD is opened outside General Text — no injected `window.gt` runtime
// (visiting the deployed site directly). A General Text app has no backend of its
// own, so on its own there's nothing to read or write; point the visitor at how to
// use it, and let them try a local sample-data demo right here.
export function MissingRuntime({ onTryDemo }: { onTryDemo: () => void }) {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://spud.generaltext.org'

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <div className="w-full max-w-md space-y-5 rounded-2xl border p-7 shadow-sm" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <PotatoMark size={22} />
          </span>
          <div className="leading-tight">
            <h1 className="text-lg font-semibold" style={{ fontFamily: 'Georgia, serif', letterSpacing: '0.04em' }}>SPUD</h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>A General Text app · see what grows</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          SPUD runs <span style={{ color: 'var(--fg)', fontWeight: 500 }}>inside General Text</span>, a workspace
          for plaintext files that sync across your devices and team. Opened on its own like this, it has no
          workspace to read or write, so there's nothing to show yet.
        </p>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>To use SPUD</p>
          <ol className="space-y-1.5 text-sm" style={{ color: 'var(--muted)' }}>
            <Step n={1}>Open <Link href="https://www.generaltext.org">General Text</Link> and open a workspace.</Step>
            <Step n={2}>Go to <span style={{ color: 'var(--fg)' }}>Settings → Apps → Install by URL</span>.</Step>
            <Step n={3}>
              Paste this app's address:
              <code className="mt-1 block rounded px-2 py-1 font-mono text-xs" style={{ background: 'var(--hover)', color: 'var(--fg)' }}>{appUrl}</code>
            </Step>
            <Step n={4}>Launch SPUD from your workspace.</Step>
          </ol>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a href="https://www.generaltext.org" className="inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium" style={{ background: 'var(--accent)', color: '#fff' }}>
            Open General Text
          </a>
          <button
            type="button"
            onClick={onTryDemo}
            className="inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-sm font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--fg)' }}
          >
            <Icon name="Clock" size={14} /> Try the demo
          </button>
        </div>
        <p className="-mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          The demo loads a sample garden locally in your browser. Nothing is saved to an account, and changes
          stay on this device.
        </p>

        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Building your own app? <Link href="https://www.generaltext.org/docs/building-apps">Read the developer guide</Link>.
        </p>
      </div>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium" style={{ background: 'var(--hover)', color: 'var(--fg)' }}>{n}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  )
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="underline underline-offset-2" style={{ color: 'var(--accent)', textDecorationColor: 'color-mix(in srgb, var(--accent) 40%, transparent)' }}>
      {children}
    </a>
  )
}
