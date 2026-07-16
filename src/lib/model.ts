// Spud has one entity — the idea. Connections are not their own records: they
// emerge from @mentions between ideas (see mentions.ts + reducer selectors). This
// file holds the shared tag vocabulary and the garden config in v0/config.json.

export interface Config {
  /** tag label → palette color key */
  tagColors: Record<string, string>
  /** an idea with no activity for this many days reads as quiet (dimmed) */
  dormancyDays: number
}

export const DEFAULT_CONFIG: Config = {
  tagColors: {},
  dormancyDays: 45,
}

// Curated tag colors: eight hues spread around the wheel so no two read alike,
// vivid enough for the dark network canvas and for small dots in the table and
// timeline. Ordered so the first few assigned are maximally distinct (the common
// small-N case), which the order-based assignment below relies on.
export const TAG_PALETTE = [
  'green',
  'rose',
  'amber',
  'blue',
  'lime',
  'violet',
  'cyan',
  'red',
] as const
export type TagColor = (typeof TAG_PALETTE)[number]

export const TAG_HEX: Record<TagColor, string> = {
  green: '#3d9d63',
  rose: '#d24f86',
  amber: '#cf8a2c',
  blue: '#3b82f6',
  lime: '#7fa62e',
  violet: '#8257d6',
  cyan: '#1f9bb3',
  red: '#d0483e',
}

// Fallback only: a stable hash → palette, for a label with no place in the
// ordering yet (e.g. a tag being typed before its event exists).
export function tagColorKey(label: string, config: Config): TagColor {
  const explicit = config.tagColors[label]
  if (explicit && (TAG_PALETTE as readonly string[]).includes(explicit)) return explicit as TagColor
  let h = 0
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length]!
}

export function tagHex(label: string, config: Config): string {
  return TAG_HEX[tagColorKey(label, config)]
}

// Assign colors by first-seen order rather than by hash, so a small number of
// tags is guaranteed a set of distinct colors (each new tag takes the next
// palette hue not yet in use). Explicit config.tagColors win and hold their hue.
// Wraps (reuses hues) only past the eighth tag, where overlap is unavoidable.
export function assignTagColors(ordered: string[], config: Config): Record<string, TagColor> {
  const out: Record<string, TagColor> = {}
  const used = new Set<TagColor>()
  for (const label of ordered) {
    const ex = config.tagColors[label]
    if (ex && (TAG_PALETTE as readonly string[]).includes(ex)) {
      out[label] = ex as TagColor
      used.add(ex as TagColor)
    }
  }
  let next = 0
  for (const label of ordered) {
    if (out[label]) continue
    let tries = 0
    while (used.has(TAG_PALETTE[next % TAG_PALETTE.length]!) && tries < TAG_PALETTE.length) {
      next++
      tries++
    }
    const c = TAG_PALETTE[next % TAG_PALETTE.length]!
    out[label] = c
    used.add(c)
    next++
  }
  return out
}

// A hex resolver over the ordered assignment, with the hash as a last resort for
// labels not present in `ordered`.
export function tagHexResolver(ordered: string[], config: Config): (label: string) => string {
  const keys = assignTagColors(ordered, config)
  return (label: string) => TAG_HEX[keys[label] ?? tagColorKey(label, config)]
}
