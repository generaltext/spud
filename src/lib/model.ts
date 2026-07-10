// SPUD has one entity — the idea. Connections are not their own records: they
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

// Curated tag colors. Kept vivid enough to read on the dark network canvas and as
// small dots in the table/timeline. An idea with several tags shows several colors.
export const TAG_PALETTE = [
  'green',
  'blue',
  'violet',
  'rose',
  'cyan',
  'teal',
  'indigo',
  'amber',
] as const
export type TagColor = (typeof TAG_PALETTE)[number]

export const TAG_HEX: Record<TagColor, string> = {
  green: '#3d9d63',
  blue: '#4f6bed',
  violet: '#7c5bd4',
  rose: '#d24f86',
  cyan: '#188fa7',
  teal: '#159a8a',
  indigo: '#5b5bd6',
  amber: '#c98a2b',
}

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
