# Spud

An idea garden, built as a [General Text](https://www.generaltext.org) app.
*See what grows.*

Capture an idea in one keystroke, discuss it with your team, connect ideas to each
other with `@`-mentions, and watch the good ones mature as they climb a version
number. Three ways to browse the same idea space (Timeline, Network, List), with a
shared side panel for any idea and its discussion.

There is **no backend**. Spud is a static frontend that reads and writes plaintext
files in the user's General Text workspace through the platform-injected
`window.gt` runtime. The user owns the data; it syncs across their devices and team
and works offline.

> This is the developer README. The gallery-facing description users see on install
> lives in [`public/gt-readme.md`](public/gt-readme.md).

## Develop

Everything is pnpm.

```bash
pnpm install
pnpm dev         # Vite dev server; a dev-only plugin injects window.gt so the app
                 # runs standalone against a LOCAL in-browser workspace (IndexedDB +
                 # cross-tab sync). Open two tabs to watch edits merge.
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest (the reducer / version-fold / connections logic)
pnpm build       # tsc --noEmit && vite build  → dist/
pnpm preview     # serve the production build
```

You do not need a running General Text to build or run Spud locally: `pnpm dev`
gives you the real sync engine against a throwaway local workspace. To test the
true integration (iframe sandbox, CSP, install), run General Text and install Spud
by URL (`Settings → Apps → Install by URL`).

## How it works

**Event-sourced.** Spud never overwrites records. Every change is one immutable JSON
line appended to a monthly log, and the UI is a projection rebuilt by folding that
log. Append-only is the one structure that merges perfectly under General Text's
character-level CRDT, so two people editing at once can never corrupt each other,
and a full history comes for free.

**The version is a fold.** An idea's `major.minor.patch` is computed from its events,
not stored:

- a **comment** bumps the patch (`v1.2.3` → `v1.2.4`),
- an **edit** to the description bumps the minor (`v1.2` → `v1.3`),
- an edit flagged **a major new approach** bumps the major (`v1` → `v2`).

Ideas start at `v0.0.0`. Maturity is inferred and shown (version badge, node size,
concentric rings in the Network view per major), never a named stage.

**Connections are @mentions.** Descriptions and comments store inline mention tokens
`@[Label](id)`, where `id` is another idea (`spd_…`) or a numbered comment
(`cmt_…`). The Network view's edges and the drawer's "Mentions / Referenced by" are
all derived from these. There is no separate link record and no forking.

**Numbered discussion.** Every comment gets a stable incrementing number (`#1`, `#2`,
…) so you can `@`-reference a specific discussion from another idea.

**Disposable local cache.** The projection is cached in IndexedDB with a per-shard
cursor so a returning session hydrates instantly and only re-folds the new tail of
each log. The plaintext log is always the source of truth; nuke the cache and a full
replay rebuilds identical state.

### File format

Everything is written under the app's own `data/` folder, addressed relative to it:

```
v0/
  spuds/
    2026-07.jsonl   # append-only monthly event log (the source of truth)
    ...
  config.json       # tag palette + settings
```

One event per line, immutable once written:

```jsonc
{
  "id":   "evt_01J…",                 // ULID (sortable, dedupe)
  "ts":   "2026-07-12T18:03:11.482Z", // client clock (display + LWW tiebreak)
  "actor":{ "id":"usr_…", "name":"Ada" }, // from gt.user()
  "type": "spud.plant",               // "<entity>.<verb>"
  "subject":"spd_01J…",
  "data": { "title":"…", "body":"…" }
}
```

Event types: `spud.plant` · `spud.edit` (`{ major?: true }`) · `spud.archive` /
`spud.restore` · `comment.add` / `comment.edit` / `comment.delete` · `tag.add` /
`tag.remove`. Older builds ignore event types they do not recognize, so the format
grows without a hard break.

Because it is plain JSONL you can `grep` it, diff it in git, or hand it to an LLM
("cluster these ideas into themes") without Spud in the loop. The file is the
contract.

## Project layout

```
src/
  lib/            runtime-agnostic engine (no React)
    events.ts       event envelope + (de)serialize
    ids.ts          ULID ids
    log.ts          monthly shards + append/fold helpers
    reducer.ts      fold events → ideas; version fold; connection selectors
    mentions.ts     @[Label](id) parse / serialize
    maturity.ts     version label, activity score, dormancy
    model.ts        tag palette + config (v0/config.json)
    cache.ts        IndexedDB projection cache
    store.tsx       React store: gt subscribe, optimistic dispatch, seeding
    seed.ts         sample garden for the demo
  components/     Drawer, MentionInput/MentionText, ConversationThread, TagChips,
                  OmniInput (new-idea + fuzzy search), Layout, Icon (+ PotatoMark),
                  MissingRuntime (standalone splash), ui (context), common
  views/          TimelineView (default), NetworkView (canvas), ListView (table)
  App.tsx         routes: /timeline · /network · /list  (drawer via ?i=<id>)
  main.tsx        runtime gate: boot when window.gt exists, else the demo splash
public/
  gt.json         manifest (name, icon, tags) served at the site root
  gt-readme.md    the gallery description
  _headers        Access-Control-Allow-Origin: * (required for web URL installs)
```

## Deploy

`pnpm build` produces a static `dist/` with `gt.json` at the root. Host it anywhere
that serves static files and sends `Access-Control-Allow-Origin: *` (the `_headers`
file covers Cloudflare Pages / Workers Assets); web installs fetch the app from the
browser and fail CORS without it. Users install it by URL into a workspace.

Opened directly on its own origin (outside General Text) there is no `window.gt`, so
`main.tsx` shows a splash explaining the app and offering a local, seeded demo,
instead of hanging. See the app guide's "Opened outside General Text" section.

## Stack

React 19, Vite, Tailwind CSS v4, TypeScript (strict), Vitest. Built against the
General Text app guide: <https://www.generaltext.org/llms.txt> (local source:
`projects/generaltext/content/docs/building-apps.md`).
