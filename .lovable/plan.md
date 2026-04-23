

# Horizon — rebrand + Backpack, Now marker, gaps, tags, energy blocks, fly-in

A focused iteration on the existing wizard layout. Adds a capture **Backpack**, a strong **Now** anchor, friendly empty/gap states, custom **tags** that drive event color, an **Energy blocks** toggle, depth-fading day columns, and a satisfying **fly-in** animation when an event lands on the calendar.

## What you'll see

**Header / brand**
- Renamed to **Horizon**, tagline **"Think it. It lands on your week."**
- Calendar icon swapped for `Sunrise` (lucide).
- Small **"N unplaced"** chip next to the countdown pill when today's Backpack has unplaced thoughts/tasks.

**Left panel — composer + Backpack**
- Composer wizard stays as the top card.
- Below it, a new **Backpack** card:
  - Label: `BACKPACK · TODAY` (or the day selected in the calendar) with a `see all →` link.
  - Quick-add chips row: **+ thought** (purple), **+ link** (blue), **+ file** (green), **+ ref** (amber/gray), **+ task** (pink). Clicking a chip opens a tiny inline capture (title + optional URL/file name) that drops a card into the Backpack.
  - Scrollable list of capture cards: colored type icon, title, tag pill, timestamp, right-side action — **place →** for thoughts/tasks (loads it into the composer), **open** for links/files.
  - List filters by the day currently focused in the calendar (default = today). Clicking a day column header focuses that day.

**Right panel — week grid**
- Top-right toggle: **Time grid / Energy blocks**.
- **Time grid** (default): existing 7a–10p axis, plus:
  - **Now marker** on today: purple pill `2:17p` to the left of the grid, filled circle `#534AB7` with halo `#CECBF6` on the column edge, full-width 1px purple line across today's column. Updates every minute.
  - **Gap indicators**: any unscheduled stretch ≥ 45 min between two events (or between day-start/end and an event) renders a dashed warm-gray placeholder with text like `2h free — breathe or plan` or `gap · add something?`.
  - **Empty day**: dashed tinted card filling the column. Weekdays neutral: `nothing yet — what do you want to do?`. Sat/Sun soft green: `open day — what restores you?`.
  - **Depth fade**: today = full brightness + 1.5px purple border + purple-tinted header; tomorrow = 1.0; +2 days = 0.85; Sunday = 0.6.
- **Energy blocks**: each day column collapses into three stacked zones — **Morning** 6a–12p, **Afternoon** 12p–5p, **Evening** 5p–10p — with events rendered as stacked cards inside their zone (no time axis).

**Tags drive color**
- New tag step in the wizard after time/duration: pick from default tags **#work** (purple), **#study** (blue), **#personal** (pink), **#social** (amber), **#deepwork** (teal), or **+ new tag** (inline form: name + 8 swatches: purple, teal, coral, pink, blue, green, amber, gray).
- Tag color is the source of truth for bubble color in both the calendar and the Backpack. Existing `category` is migrated to a default tag.
- Legend strip at the bottom of the calendar shows the active tags.

**Fly-in animation**
- On confirm, the composer briefly renders a "ghost" bubble at the input position. Using `framer-motion`'s `layoutId`, that bubble morphs and travels into the destination day/time slot, scaling from ~60% to 100% with a spring (stiffness 260, damping 26) and a subtle shadow lift, then settles. Same `layoutId` is reused for Backpack `place →` placements.

## Technical plan

**State / types**
- Extend `src/types/event.ts`: add `Tag { id, name, color }`, `CaptureItem { id, kind: 'thought'|'link'|'file'|'ref'|'task', title, url?, tagId?, createdAt, dayKey }`, and `CalEvent.tagId` (keep `category` as fallback for migration).
- New `src/lib/tags.ts`: default tags, color tokens, helpers (`getTag`, `tagClasses`).
- New `src/lib/capture-store.ts`: in-memory store + `useCaptures()` hook (today/day-filtered, add, remove, markPlaced).

**Composer (`TaskComposer.tsx`)**
- Insert a **Tag** step after Time. Renders existing tags as numbered pills (1–9) plus `N` for new-tag inline form (name input + swatch grid). Skippable with `S` (defaults to `#work`).
- On confirm, emit the event AND trigger the fly-in by passing a shared `layoutId` (e.g. `commit-${event.id}`) up to `Index.tsx`.

**Backpack (`src/components/Backpack.tsx`, new)**
- Quick-add chip row → opens inline capture row.
- List virtualized with simple `overflow-y-auto`. Card: type icon (lucide: `Lightbulb`, `Link2`, `FileText`, `Bookmark`, `CheckSquare`), title, tag pill, time. Right action button. Filters by `selectedDayKey` from `Index.tsx`.

**Now marker (`src/components/NowMarker.tsx`, new)**
- Computes top offset from `START_HOUR`/`END_HOUR` constants in `DayColumn.tsx`. Re-renders every 60s via `setInterval`. Renders pill (left of grid) + dot + line. Only mounts in today's column when in Time-grid view and current time is within 7a–10p.

**Gap + empty states (`DayColumn.tsx`)**
- After sorting events, walk pairs and emit `GapPlaceholder` between events with ≥ 45 min gap; same for pre-first and post-last gaps within visible window.
- If `events.length === 0`, render `EmptyDayCard` (weekday vs weekend variant).

**Energy blocks (`src/components/EnergyDayColumn.tsx`, new)**
- Three zone cards (Morning/Afternoon/Evening). Bucket events by `start` minute. Each zone shows label, count, and stacked `EventBubble`s (compact). Empty zone shows `open` chip. Same depth-fade rules as time grid.

**View toggle**
- `Index.tsx` gets `viewMode: 'grid' | 'energy'`. Top-right of the calendar panel uses the existing `ViewChip` style. Replaces current `Week / Today / Kanban` stubs with `Time grid / Energy blocks` (Today/Kanban removed for now).

**Depth fade**
- `DayColumn` and `EnergyDayColumn` accept `depth` (0 = today, 1, 2, 3...) and apply: today → ring + purple-tint header; otherwise `opacity-100 / 85 / 60` based on distance.

**Unplaced counter**
- `Index.tsx` derives count from captures where `kind ∈ {thought, task}` and `placed !== true` for today; passes to header chip.

**Fly-in animation**
- `Index.tsx` keeps the most recent `committedEvent`. The composer renders a `motion.div` with `layoutId="fly-${id}"` at confirm; the matching `EventBubble` in `DayColumn` uses the same `layoutId`. `framer-motion`'s shared layout handles the morph (already in deps). Spring `{stiffness: 260, damping: 26}`. Animation is skipped when `prefers-reduced-motion`.

**Files touched**
- Edit: `src/pages/Index.tsx`, `src/components/TaskComposer.tsx`, `src/components/DayColumn.tsx`, `src/components/EventBubble.tsx`, `src/components/CategoryPicker.tsx` (becomes thin wrapper over tags), `src/types/event.ts`, `src/index.css` (new tag color tokens, warm-gray gap token), `tailwind.config.ts` (extend with tag/swatch palette).
- Create: `src/components/Backpack.tsx`, `src/components/NowMarker.tsx`, `src/components/GapPlaceholder.tsx`, `src/components/EmptyDayCard.tsx`, `src/components/EnergyDayColumn.tsx`, `src/lib/tags.ts`, `src/lib/capture-store.ts`.

## Out of scope (call out)

- No persistence yet — Backpack and tags live in memory (lost on refresh). Easy to wire to Lovable Cloud later.
- No drag-to-place from Backpack onto the grid (uses the `place →` button which loads the composer pre-filled).
- Energy blocks is read-only (no click-to-create inside zones in v1).
- Recurring events, multi-day events, and editing existing events remain out of scope.

