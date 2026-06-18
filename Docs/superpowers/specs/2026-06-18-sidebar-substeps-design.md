# Sidebar sub-steps for html-plan — design

**Date:** 2026-06-18
**Component:** `html-plan` skill — `assets/plan-template.html`
**Status:** Approved design, ready for implementation plan

## Problem

The html-plan sidebar nav is flat: one link per tracked phase. A phase's sub-steps
(the numbered `<ol class="steps">` inside the phase card) are visible only in the body,
and progress is tracked only at the phase level (the `.mk` dot goes grey → amber → green
per phase). There is no at-a-glance, in-sidebar view of *where inside a phase* the work is.

## Goal

Under each phase link in the sidebar, render its sub-steps as an indented sub-list:

- **Collapsed by default**, with the active phase auto-expanded.
- **Per-sub-step dot** that turns green as each step completes.
- **Clickable** sub-steps that jump to the exact step in the body and flash it.

This is purely additive in the template's CSS/JS. **Authors add no new markup** and write
plans exactly as before.

## Approved decisions

| Decision | Choice |
|---|---|
| Auto-expand trigger | **Both combined** — the `doing` phase is expanded on load; as you scroll, scroll-spy expands the phase you reach instead (one open at a time). |
| Sub-step clicks | **Jump to the exact step** — scroll to that `<li>` in the phase card and briefly highlight it (requires a generated per-step anchor id). |
| Collapse model | **Accordion + manual override** — one phase open at a time, auto-driven; a chevron lets the user manually toggle and *pin* a phase open until the active phase changes. |
| Label source | **Auto-derive** from each step `<li>`'s leading `<b>…</b>`; fall back to truncated text content when there is no bold lead. |

## Implementation approach

Extend the template's existing granular-progress JS block (the one that already scans
`[data-steps]` lists and reads `#plan-state.steps`). That block is the natural home — it
already has the per-phase step data in hand. No new markup contract for authors; no separate
component.

Rejected alternatives: author-declared sidebar markup (duplicative, drifts from the body
list); a separate standalone script (more surface area for no benefit).

## Behavior detail

### 1. Inputs & data flow (no new authoring)

For each tracked phase id, find that `<section>`'s `<ol class="steps">`.

- **If present** → build a sidebar sub-list for that phase.
- **If absent** → the phase link stays flat (current behavior), no chevron.

- **Labels** derive from each `<li>`'s leading `<b>…</b>` text (e.g. `Tick loop`), stripped of
  a trailing period. Fallback: the `<li>`'s text content, truncated (~32 chars, CSS ellipsis).
- **Dot state** derives from `#plan-state.steps` for that phase — the *same* data that drives
  the body checklist, so sidebar and body cannot disagree. Value is either a number (first N
  done) or an array of 0-based done indices (matching the existing `data-steps` semantics).

### 2. Rendering & dot states

Inject `<ul class="toc-sub">` immediately after each phase's `nav.toc a`, one `<li>` per step:
a status dot + the label. Per-step dot states:

- **done** → green, filled (or ✓); label dimmed.
- **current** → the first not-done step *of the `doing` phase only* → amber. Shows where work
  actually is, independent of scroll position. (Scrolled-to phases that aren't `doing` show only
  done/todo dots — no amber.)
- **todo** → grey.

Reference (non-tracked) sidebar links are untouched.

### 3. Expand / collapse (accordion + manual override)

- **On load:** the `doing` phase's sub-list is expanded. If no phase is `doing`, all collapsed.
- **On scroll:** the existing scroll-spy `IntersectionObserver` drives which phase is "active";
  the active phase expands and the others collapse — **one open at a time**.
- **Manual:** a chevron on each phase link toggles that phase. A manual open **pins** the phase
  (overrides the auto-accordion) until the active phase changes (scroll into another / another
  phase becomes `doing`), at which point auto-control resumes.
- **Sub-step click:** scrolls to that exact step's `<li>` in the body and applies a brief
  highlight flash. Each body step `<li>` gets a generated anchor id of the form
  `<phaseId>-step-<n>` (1-based) so the sidebar link can target it.

### 4. State persistence & motion

The page hard-reloads every `RELOAD_MS` (4 s). The currently-expanded/pinned phase id persists
in `sessionStorage` (same pattern as the existing collapse and filter controls) so the sidebar
does not flicker or reset on each reload. The click-to-step highlight flash and any expand
animation respect `prefers-reduced-motion` (no animation when reduced motion is requested).

### 5. Scope / non-goals

- **In scope:** sidebar nav sub-lists, per-step dots, accordion + manual toggle, click-to-step
  with body highlight, generated per-step anchor ids, sessionStorage persistence.
- **Out of scope:** changes to how authors write plans; changes to the body step rendering
  beyond adding anchor ids; reference-section behavior; the roadmap; deep-link buttons.

## Edge cases

- **Phase with no steps list** → flat link, no chevron, no sub-list.
- **`steps` data absent for a phase that has a steps list** → labels still render; all dots grey
  (no completion shown); no "current" amber dot.
- **Long labels** → truncated with CSS ellipsis; full text via `title` attribute.
- **Step `<li>` without a `<b>` lead** → fall back to truncated text content.
- **More `<li>`s than the `steps` number/array covers** → uncovered steps are `todo` (grey).

## Acceptance criteria

1. A phase with an `<ol class="steps">` shows an indented sub-list under its sidebar link;
   a phase without one stays flat.
2. Sub-step labels match the bold lead of each body step.
3. Setting `#plan-state.steps` for a phase turns the corresponding sidebar dots green; the count
   matches the body checklist exactly.
4. On load, the `doing` phase is expanded; scrolling through phases expands each in turn with
   only one open at a time.
5. Clicking a sub-step scrolls to that exact step in the body and flashes it.
6. Manually toggling a phase via its chevron pins it open until the active phase changes.
7. The expanded/pinned state survives the 4 s auto-reload without flicker.
8. With `prefers-reduced-motion`, no flash/expand animation plays.
9. Authors write plans exactly as before — no new required markup or `#plan-state` fields.

## Touched files

- `html-plan/assets/plan-template.html` — CSS (`.toc-sub`, dots, chevron, flash) + JS (build
  sub-lists, anchor ids, accordion/scroll-spy hookup, persistence). Mirror to the installed copy
  at `~/.claude/skills/html-plan/assets/plan-template.html`.
- `html-plan/SKILL.md` — short note documenting that sidebar sub-steps render automatically from
  a phase's `steps` list + `#plan-state.steps`. Mirror to installed copy.
