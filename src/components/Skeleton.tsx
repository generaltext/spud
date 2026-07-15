// Loading skeleton shaped like the real app chrome (top header + timeline lanes),
// shown while the store hydrates. Uses --hover as a theme-adaptive placeholder
// fill so it reads the same in light and dark.

function Bar({ w, h = 12, className = '', style }: { w: number | string; h?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ width: typeof w === 'number' ? `${w}px` : w, height: h, background: 'var(--hover)', ...style }}
    />
  )
}

const LANES = 9

export function AppSkeleton() {
  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }} aria-hidden>
      <header
        className="flex flex-wrap items-center gap-4 border-b px-4 py-2.5"
        style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
      >
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg" style={{ background: 'var(--accent-soft)' }} />
          <Bar w={56} h={16} />
        </div>
        <div className="h-8 min-w-[180px] max-w-md flex-1 animate-pulse rounded-md" style={{ background: 'var(--hover)' }} />
        <div className="ml-auto h-8 w-40 animate-pulse rounded-lg" style={{ background: 'var(--hover)' }} />
      </header>

      <main className="relative min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1100px] px-4 py-4 sm:px-6">
          {/* axis strip */}
          <div className="mb-2 flex items-center gap-10 pl-[200px]">
            {Array.from({ length: 5 }).map((_, i) => (
              <Bar key={i} w={34} h={10} style={{ opacity: 0.6 }} />
            ))}
          </div>
          {Array.from({ length: LANES }).map((_, i) => (
            <div key={i} className="grid items-center" style={{ gridTemplateColumns: '200px 1fr', height: 32 }}>
              <div className="flex items-center gap-2 pr-3">
                <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full" style={{ background: 'var(--hover)' }} />
                <Bar w={`${62 - (i % 4) * 9}%`} h={12} />
              </div>
              <div className="relative h-full">
                <div
                  className="absolute top-1/2 h-[3px] -translate-y-1/2 animate-pulse rounded"
                  style={{ background: 'var(--hover)', left: `${(i % 3) * 6}%`, right: `${8 + (i % 4) * 12}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
