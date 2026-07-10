# SPUD

*See what grows.*

Capture an idea in one keystroke. Flesh it out, discuss it with your team, and
connect it to other ideas by @mentioning them. An idea that gets discussed and
refined climbs a version number, so its maturity is something you can see and point
at. An idea nobody touches just sits there, honestly, instead of pretending to be a
task.

Used once, it is a clean inbox. Used for a year, it is a dense, interlinked record
of your (or your team's) thinking, that you can browse three ways.

## Three ways to see the ideas

- **Timeline** the default. Each idea is a line through time, with a dot for every
  edit and comment, so long-running, well-discussed ideas read as long, busy lines.
- **Network** ideas connected by the @mentions between their descriptions.
- **List** a dense, sortable table.

Click any idea, in any view, to open it in a side panel with its full description
and discussion.

## Versioning, without the ceremony

- A **comment** bumps the patch. `v1.2.3` → `v1.2.4`
- An **edit** to the description bumps the minor. `v1.2` → `v1.3`
- Marking an edit **a major new approach** bumps the major. `v1` → `v2`

Every comment is numbered (`#1`, `#2`, …) so you can @-reference a specific
discussion from another idea.

## How your data is stored

SPUD is **event-sourced**: instead of overwriting records, it appends one JSON line
per change to a monthly log and rebuilds the current state by replaying it. Clean
merges when your team edits at once, a full version history for free, and a dataset
any other tool (or your AI) can read.

Files it writes, under this app's `data/` folder:

- `v0/spuds/YYYY-MM.jsonl` the append-only event log (the source of truth).
- `v0/config.json` your tag palette and settings.

Because the store is plain JSONL, you can `grep` it, diff it in git, or hand it to
an LLM without SPUD in the loop. The file is the contract.
