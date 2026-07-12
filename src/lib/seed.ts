// Sample content for the gallery "Try it live" demo, so it opens with a garden
// that already has some history and connections instead of an empty screen. Only
// runs in demo mode against a throwaway workspace (see store).

import type { Draft } from './events'
import { newId } from './ids'
import { mentionToken } from './mentions'

export async function seedDemo(dispatch: (d: Draft[]) => Promise<void>): Promise<void> {
  const studios = newId('spd')
  const offline = newId('spd')
  const capture = newId('spd')
  const semver = newId('spd')
  const mapview = newId('spd')
  const pricing = newId('spd')
  const weekly = newId('spd')

  const drafts: Draft[] = [
    { type: 'spud.plant', subject: studios, data: { title: 'A conversation-first CRM for design studios', body: 'Not a project tracker. Capture who you talked to and what was said, in seconds, and let the pipeline fall out of that.' } },
    { type: 'spud.plant', subject: offline, data: { title: 'Offline-first shared notebooks for research labs', body: 'Sync across the bench and the office, and keep working with no wifi.' } },
    { type: 'spud.plant', subject: capture, data: { title: 'One-keystroke capture from anywhere', body: 'A global hotkey drops an idea in without leaving what you were doing.' } },
    { type: 'spud.plant', subject: semver, data: { title: 'Version ideas the way software is versioned', body: 'Comments bump the patch, edits the minor, a deliberate rewrite the major. Maturity you can point at.' } },
    { type: 'spud.plant', subject: mapview, data: { title: 'See the ideas as a space, not a list', body: '' } },
    { type: 'spud.plant', subject: pricing, data: { title: 'A nonprofit pricing tier', body: 'A discounted tier for grant-funded orgs.' } },
    { type: 'spud.plant', subject: weekly, data: { title: 'A weekly review ritual', body: 'Fifteen minutes on Friday: what moved, what went quiet.' } },

    // connections form via @mentions in descriptions
    { type: 'spud.edit', subject: studios, data: { body: `Not a project tracker. Capture who you talked to and what was said, in seconds, and let the pipeline fall out of that. Shares the sync story with ${mentionToken(offline, 'Offline-first notebooks')}.` } },
    { type: 'spud.edit', subject: mapview, data: { body: `See ideas by how they connect and how far along they are, instead of a flat list. Leans on ${mentionToken(semver, 'versioning ideas')} for the maturity read.` } },

    // discussion (numbered comments; each bumps the patch)
    { type: 'comment.add', subject: newId('cmt'), data: { spud: studios, body: 'Studios already live in Figma and Notion. What is the wedge?' } },
    { type: 'comment.add', subject: newId('cmt'), data: { spud: studios, body: 'Client conversations, not project files. Nobody does that well for a 5-person shop.' } },
    { type: 'comment.add', subject: newId('cmt'), data: { spud: semver, body: `This is what makes ${mentionToken(mapview, 'the map view')} legible.` } },
    { type: 'comment.add', subject: newId('cmt'), data: { spud: offline, body: 'Local-first via y-indexeddb gets us most of the way.' } },

    // deliberate major re-approaches on one idea → v3 (shows nested rings in Network)
    { type: 'spud.edit', subject: studios, data: { major: true, note: 'Reframed around conversations after the discussion.', body: `A conversation-first CRM for small studios. Capture who you talked to and what was said; the pipeline falls out of that. Syncs offline like ${mentionToken(offline, 'the notebooks idea')}.` } },
    { type: 'spud.edit', subject: studios, data: { major: true, note: 'Pivot: lead with a shared client timeline, not contact records.', body: `A shared client timeline for small studios. One thread per client of calls, notes, and decisions, that the whole team can see. Syncs offline like ${mentionToken(offline, 'the notebooks idea')}.` } },
    { type: 'spud.edit', subject: studios, data: { major: true, note: 'Reframed again around handoffs between designers and PMs.', body: `A client memory for studios: every conversation and decision on one timeline, so a handoff between designers or PMs loses nothing. Not a pipeline, not a task tracker.` } },

    // tags (some ideas carry several colors)
    { type: 'tag.add', subject: studios, data: { label: 'product' } },
    { type: 'tag.add', subject: studios, data: { label: 'crm' } },
    { type: 'tag.add', subject: offline, data: { label: 'product' } },
    { type: 'tag.add', subject: offline, data: { label: 'research' } },
    { type: 'tag.add', subject: semver, data: { label: 'wild' } },
    { type: 'tag.add', subject: mapview, data: { label: 'product' } },
    { type: 'tag.add', subject: mapview, data: { label: 'wild' } },
    { type: 'tag.add', subject: pricing, data: { label: 'gtm' } },
    { type: 'tag.add', subject: weekly, data: { label: 'ops' } },
  ]

  await dispatch(drafts)
}
