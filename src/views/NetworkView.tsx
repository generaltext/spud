import { useEffect, useRef } from 'react'
import { useStore } from '../lib/store'
import { useUi } from '../components/ui'
import { mentionEdges, type SpudRecord, type State } from '../lib/reducer'
import { activityScore, isDormant } from '../lib/maturity'
import { tagHex, type Config } from '../lib/model'

// Ideas as a network. Edges are the @mentions between descriptions, so the graph
// literally shows how ideas reference each other. A node's size grows with
// activity, its colour(s) are its tag(s), and quiet ideas dim. Drag to rearrange,
// scroll to zoom, click to open.

interface NodeState { x: number; y: number; vx: number; vy: number; rNow: number; phase: number }
interface Env { state: State; config: Config; activeTags: string[]; open: (id: string) => void }

function reduceMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches }

function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '')
  const f = s.length === 3 ? s.split('').map((c) => c + c).join('') : s
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)]
}
function rgba(rgb: [number, number, number], a: number) { return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(1, a))})` }
function blend(hexes: string[]): [number, number, number] {
  if (hexes.length === 0) return [150, 150, 140]
  const acc = [0, 0, 0]
  for (const h of hexes) { const [r, g, b] = hexToRgb(h); acc[0]! += r; acc[1]! += g; acc[2]! += b }
  return [acc[0]! / hexes.length, acc[1]! / hexes.length, acc[2]! / hexes.length]
}

export function NetworkView() {
  const store = useStore()
  const { openIdea, activeTags } = useUi()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const envRef = useRef<Env>({ state: store.state, config: store.config, activeTags, open: openIdea })
  const nodesRef = useRef<Map<string, NodeState>>(new Map())

  // keep the loop reading the latest data / callbacks
  envRef.current = { state: store.state, config: store.config, activeTags, open: openIdea }

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const tip = tipRef.current!
    const cam = { x: 0, y: 0, scale: 0.85 }
    let DPR = 1, CW = 0, CH = 0
    const nodes = nodesRef.current

    function resize() {
      DPR = Math.min(devicePixelRatio || 1, 2)
      const r = canvas.getBoundingClientRect(); CW = r.width; CH = r.height
      canvas.width = CW * DPR; canvas.height = CH * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(canvas)
    const scr = (wx: number, wy: number): [number, number] => [(wx - cam.x) * cam.scale + CW / 2, (wy - cam.y) * cam.scale + CH / 2]
    const wld = (sx: number, sy: number): [number, number] => [(sx - CW / 2) / cam.scale + cam.x, (sy - CH / 2) / cam.scale + cam.y]

    const radius = (s: SpudRecord) => Math.min(46, 12 + Math.sqrt(activityScore(s)) * 3.2)
    function live(): SpudRecord[] {
      const st = envRef.current.state
      const list = Object.values(st.spuds).filter((s) => !s.archived)
      const ids = new Set(list.map((s) => s.id))
      for (const id of [...nodes.keys()]) if (!ids.has(id)) nodes.delete(id)
      for (const s of list) if (!nodes.has(s.id)) nodes.set(s.id, { x: (Math.random() - 0.5) * 360, y: (Math.random() - 0.5) * 300, vx: 0, vy: -6, rNow: 0, phase: Math.random() * 6.28 })
      return list
    }

    let hover: string | null = null, drag: string | null = null, moved = false, pan = false, lx = 0, ly = 0
    function nodeAt(sx: number, sy: number): string | null {
      const list = live()
      for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i]!; const n = nodes.get(s.id)!; const [nx, ny] = scr(n.x, n.y); const r = n.rNow * cam.scale
        if ((sx - nx) ** 2 + (sy - ny) ** 2 <= (r + 6) ** 2) return s.id
      }
      return null
    }
    function matches(s: SpudRecord) { const at = envRef.current.activeTags; return at.length === 0 || at.every((t) => s.tags.includes(t)) }

    function onMove(e: MouseEvent) {
      const r = canvas.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top
      if (drag) { const n = nodes.get(drag); if (n) { const [wx, wy] = wld(sx, sy); n.x = wx; n.y = wy; n.vx = 0; n.vy = 0; moved = true } return }
      if (pan) { cam.x -= (e.clientX - lx) / cam.scale; cam.y -= (e.clientY - ly) / cam.scale; lx = e.clientX; ly = e.clientY; return }
      const id = nodeAt(sx, sy); hover = id; canvas.style.cursor = id ? 'pointer' : 'grab'
      const s = id ? envRef.current.state.spuds[id] : null
      if (s) { tip.textContent = s.title; tip.style.left = Math.min(e.clientX + 14, innerWidth - 240) + 'px'; tip.style.top = (e.clientY + 16) + 'px'; tip.style.opacity = '1' }
      else tip.style.opacity = '0'
    }
    function onDown(e: MouseEvent) { const r = canvas.getBoundingClientRect(); lx = e.clientX; ly = e.clientY; const id = nodeAt(e.clientX - r.left, e.clientY - r.top); if (id) { drag = id; moved = false } else { pan = true; canvas.style.cursor = 'grabbing' } }
    function onUp(e: MouseEvent) { if (drag && !moved) envRef.current.open(drag); drag = null; if (pan && Math.abs(e.clientX - lx) < 3 && Math.abs(e.clientY - ly) < 3) { /* background click */ } pan = false; canvas.style.cursor = hover ? 'pointer' : 'grab' }
    function onWheel(e: WheelEvent) { e.preventDefault(); const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; const [wx, wy] = wld(mx, my); cam.scale = Math.max(0.35, Math.min(2.4, cam.scale * Math.exp(-e.deltaY * 0.0014))); cam.x = wx - (mx - CW / 2) / cam.scale; cam.y = wy - (my - CH / 2) / cam.scale }
    function onLeave() { tip.style.opacity = '0' }
    canvas.addEventListener('mousemove', onMove); canvas.addEventListener('mousedown', onDown); window.addEventListener('mouseup', onUp); canvas.addEventListener('wheel', onWheel, { passive: false }); canvas.addEventListener('mouseleave', onLeave)

    const t0 = performance.now(); let raf = 0; const rm = reduceMotion()
    function frame(now: number) {
      const t = (now - t0) / 1000
      const env = envRef.current
      const list = live()
      const cfg = env.config
      const edges = mentionEdges(env.state)

      // physics
      const kRep = 5000, kC = 0.006, damp = 0.86
      for (let i = 0; i < list.length; i++) {
        const a = nodes.get(list[i]!.id)!; if (list[i]!.id === drag) continue
        for (let j = i + 1; j < list.length; j++) {
          const b = nodes.get(list[j]!.id)!; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy; if (d2 < 1) d2 = 1
          const d = Math.sqrt(d2), f = kRep / d2, fx = dx / d * f, fy = dy / d * f; a.vx += fx; a.vy += fy; if (list[j]!.id !== drag) { b.vx -= fx; b.vy -= fy }
        }
      }
      for (const e of edges) {
        const a = nodes.get(e.from), b = nodes.get(e.to); if (!a || !b) continue
        const ra = radius(env.state.spuds[e.from]!), rb = radius(env.state.spuds[e.to]!)
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, f = (d - (ra + rb + 90)) * 0.012, fx = dx / d * f, fy = dy / d * f
        if (e.from !== drag) { a.vx += fx; a.vy += fy } if (e.to !== drag) { b.vx -= fx; b.vy -= fy }
      }
      for (const s of list) { const n = nodes.get(s.id)!; if (s.id === drag) continue; n.vx += -n.x * kC; n.vy += -n.y * kC; n.vx *= damp; n.vy *= damp; n.x += n.vx; n.y += n.vy }

      const css = getComputedStyle(document.documentElement)
      const bg = css.getPropertyValue('--bg').trim() || '#faf9f7'
      const fg = css.getPropertyValue('--fg').trim() || '#1b1b18'
      ctx.clearRect(0, 0, CW, CH); ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH)

      // edges
      ctx.lineCap = 'round'
      for (const e of edges) {
        const a = nodes.get(e.from)!, b = nodes.get(e.to)!; const [ax, ay] = scr(a.x, a.y), [bx, by] = scr(b.x, b.y)
        const inc = hover === e.from || hover === e.to
        const vis = matches(env.state.spuds[e.from]!) || matches(env.state.spuds[e.to]!)
        ctx.strokeStyle = rgba(hexToRgb(fg.length >= 4 ? fg : '#888888'), (inc ? 0.5 : 0.18) * (vis ? 1 : 0.4))
        ctx.lineWidth = inc ? 2 : 1.2
        const mx = (ax + bx) / 2, my = (ay + by) / 2, nx = -(by - ay), ny = (bx - ax), nl = Math.hypot(nx, ny) || 1, bow = 12 * cam.scale
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx + nx / nl * bow, my + ny / nl * bow, bx, by); ctx.stroke()
      }

      // nodes
      for (const s of list) {
        const n = nodes.get(s.id)!; n.rNow += (radius(s) - n.rNow) * 0.14
        const [sx, sy] = scr(n.x, n.y); const breath = rm ? 1 : 1 + Math.sin(t * 1.1 + n.phase) * 0.025; const r = n.rNow * cam.scale * breath
        const a = matches(s) ? 1 : 0.16; const q = isDormant(s, cfg); const hov = hover === s.id
        const hexes = s.tags.length ? s.tags.map((tg) => tagHex(tg, cfg)) : [css.getPropertyValue('--accent').trim() || '#c98a2b']
        const mix = blend(hexes)
        const rec = q ? 0.1 : Math.max(0, 1 - (Date.now() - new Date(s.lastActivityAt).getTime()) / (22 * 86400000))
        const glow = (0.06 + rec * 0.32 + (hov ? 0.3 : 0)) * a
        if (glow > 0.02) { const hg = ctx.createRadialGradient(sx, sy, r * 0.4, sx, sy, r * 2.5); hg.addColorStop(0, rgba(mix, glow)); hg.addColorStop(1, rgba(mix, 0)); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(sx, sy, r * 2.5, 0, 6.29); ctx.fill() }

        // multi-tag fill: a conic sweep through each tag colour
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.29)
        if (hexes.length > 1 && typeof (ctx as unknown as { createConicGradient?: unknown }).createConicGradient === 'function') {
          const cg = ctx.createConicGradient(-Math.PI / 2, sx, sy)
          const step = 1 / hexes.length
          hexes.forEach((h, i) => { const rgb = hexToRgb(h); cg.addColorStop(i * step, rgba(rgb, (q ? 0.16 : 0.3) * a)); cg.addColorStop((i + 1) * step - 0.001, rgba(rgb, (q ? 0.16 : 0.3) * a)) })
          ctx.fillStyle = cg
        } else {
          ctx.fillStyle = rgba(hexToRgb(hexes[0]!), (q ? 0.16 : 0.28) * a)
        }
        ctx.fill()
        ctx.lineWidth = hov ? 1.9 : 1.2; ctx.strokeStyle = rgba(mix, (q ? 0.5 : 0.92) * a); ctx.stroke()

        // concentric inner rings — one per major version beyond the first (v3 → 2
        // inner rings inside the outer edge), capped so it never gets too dense.
        const innerRings = Math.min(4, Math.max(0, s.version.major - 1))
        for (let k = 1; k <= innerRings; k++) {
          const rr = r * (0.4 + 0.5 * (k / (innerRings + 0.5)))
          ctx.beginPath(); ctx.arc(sx, sy, rr, 0, 6.29)
          ctx.strokeStyle = rgba(mix, (q ? 0.34 : 0.6) * a); ctx.lineWidth = 1
          ctx.stroke()
        }

        ctx.beginPath(); ctx.arc(sx, sy, Math.max(2, r * 0.16), 0, 6.29); ctx.fillStyle = rgba(mix, (q ? 0.55 : 1) * a); ctx.fill()

        const showL = hov || (r > 20 && matches(s))
        if (showL && a > 0.3) {
          ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
          let label = s.title; if (ctx.measureText(label).width > 170) { while (label.length > 3 && ctx.measureText(label + '…').width > 170) label = label.slice(0, -1); label += '…' }
          ctx.fillStyle = rgba(hexToRgb(fg.length >= 4 ? fg : '#111111'), 0.9 * a); ctx.fillText(label, sx, sy + r + 6)
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect()
      canvas.removeEventListener('mousemove', onMove); canvas.removeEventListener('mousedown', onDown); window.removeEventListener('mouseup', onUp); canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('mouseleave', onLeave)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="block h-full w-full" style={{ cursor: 'grab' }} />
      <div ref={tipRef} className="pointer-events-none fixed z-50 max-w-[240px] rounded-md border px-2.5 py-1.5 text-sm shadow-lg" style={{ opacity: 0, transition: 'opacity .12s', background: 'var(--panel)', borderColor: 'var(--border)', fontFamily: 'Georgia, serif' }} />
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-xs" style={{ color: 'var(--muted)' }}>drag to rearrange · scroll to zoom · lines are @mentions</div>
    </div>
  )
}
