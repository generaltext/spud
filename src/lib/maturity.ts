// Maturity is inferred and shown directly, never labelled. The version number is
// the maturity, and the timeline/network let length and connection speak for it —
// so there is no progress bar. We keep an activity score only to SIZE things (a
// node's radius, a timeline's weight) and a dormancy check to dim quiet ideas.

import type { Config } from './model'
import type { SpudRecord, Version } from './reducer'

export function activityScore(s: SpudRecord): number {
  return s.version.major * 6 + s.version.minor * 2 + s.commentCount
}

export function isDormant(s: SpudRecord, config: Config): boolean {
  return Date.now() - new Date(s.lastActivityAt).getTime() > config.dormancyDays * 86400000
}

export function versionShort(v: Version): string {
  return `v${v.major}.${v.minor}`
}

export function versionFull(v: Version): string {
  return `${v.major}.${v.minor}.${v.patch}`
}
