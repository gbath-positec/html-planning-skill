# Quantitative plan primitives — design

**Date:** 2026-06-19
**Skill:** `rich-html-plans`
**Source of truth:** `rich-html-plans/` in `gbath-positec/html-planning-skill`
(installed copy under `~/.claude/skills/rich-html-plans/` and the `Quadshift/ai-library`
mirror both need the same change — see Rollout.)

## Problem

The template's diagram primitives (`.flow`, `.schema`, `.tree`, `.steps`, `.compare`,
`.callout`) cover **qualitative** structure — flows, models, hierarchies, choices. They cannot
express **quantitative** plan content:

- *time*: which phases overlap, what sequences after what, the critical path
- *magnitude*: relative effort/size per phase, or a before/after metric the plan aims to move
- *composition*: how a whole splits into parts ("60% of the effort is the migration")

Today that content is forced into prose or tables, which bury the shape of the numbers.

## Solution

Add **three static primitives** to the template, authored the same way as the existing ones:
pure CSS / inline-SVG with **author-baked numbers**, themed via the existing CSS variables.
No runtime JS, no external libraries, no data-driven rendering.

| Primitive | Shows | Built from |
|---|---|---|
| `.gantt` | phases across time — overlap, sequencing, critical path | CSS grid; bars span columns via inline `grid-column` |
| `.hbar` | labelled bars — per-phase effort/size **or** before/after metric | `<div class="bar" style="width:62%">` rows |
| `.stack` | a 100% bar split into tinted segments — proportion / breakdown | flexbox row, each segment `style="flex:60"` + legend |

### Why static, not data-driven

The page does a **hard `location.reload()` every 4s** (`plan-template.html:1187`). Anything
that computes layout in JS *after* first paint re-flows on every reload and flickers — the
template already fights this for scroll-spy, entrance stagger, and step bars. Baking the
numbers into the markup at authoring time sidesteps the whole class of problem: the bars are
plain styled elements that repaint instantly. The author (Claude) computes the percentages /
column spans at write time — arithmetic it does reliably.

### Explicitly out of scope (YAGNI)

Considered and **cut** during design:

- **`.spark` (burndown sparkline)** — needs an accumulated time-series most plans never have;
  the existing progress ring already answers "how far along are we."
- **`.matrix` (2×2 impact×effort)** — only useful when a plan *is* a prioritization exercise;
  most plans are "here's what we're building." Revisit if prioritization planning becomes common.
- **`.dag` (dependency graph)** — a true non-linear DAG is rare in plans; `.flow` covers linear
  dependency, `.gantt` covers dependency-over-time (the actionable part), `.tree` covers
  hierarchy. A runtime layout lib (dagre) would also be the only primitive carrying a ~100 KB
  inline lib and the only one needing a flicker workaround against the 4s reload — a bad trade
  for a rare need. If a real multi-dependency graph appears, author it as static inline SVG then.

## Component design

Each primitive is a self-contained block of CSS added to the template `<style>`, plus a
markup convention. All colors come from existing variables (`--accent`, `--accent-2`,
`--green`, `--amber`, `--cyan`, `--muted`, `--border`, `--code-bg`) so light/dark works for free.

### `.gantt`

- Wrapped in the standard `<div class="diagram"><div class="dg-title">…</div>…</div>`.
- A CSS grid with a fixed number of time columns (weeks/days) plus a leading label column.
- A header row of column labels; one row per task with a `.gbar` whose `grid-column`
  start/end is written inline to place and size it. Optional `data-accent` tint per bar to
  mark the critical path.
- Bars carry a short inline duration label. Horizontal scroll on narrow widths via an
  `overflow-x:auto` wrapper, consistent with how wide content is handled elsewhere.

### `.hbar`

- Standalone (no `.diagram` wrapper required), like `.compare`.
- A list of rows: each row a `.lbl` (left), a track, and a `.bar` sized by inline `width:%`,
  with an inline value label at the bar end.
- **Single series** = effort/size per phase. **Two series** = before/after: two bars per row
  (e.g. `.bar.before` muted, `.bar.after` accent), so the shrink/growth is visible at a glance.
- Author computes widths as a percentage of the row's max value.

### `.stack`

- Standalone. One horizontal bar; children are `.seg` elements each with inline `flex:<n>`
  (the raw values — flexbox normalizes to proportions, so the author needn't compute percentages).
- Each segment tinted from the accent palette; a `.legend` below maps color → label → value.
- Degrades gracefully with 2–6 segments; more than that should use a table instead (note in docs).

## Documentation changes

1. **Template top-of-file cheatsheet comment** (`plan-template.html:21-32`): add a
   "Quantitative" group listing the three with one-line "use when" each.
2. **Commented example patterns in the body** (near the existing examples at
   `plan-template.html:515-560`): one copy-paste-ready commented block per primitive, with
   realistic baked numbers, so the authoring model is obvious.
3. **SKILL.md Diagrams table** (`SKILL.md:58-66`): add the three rows under a quantitative
   heading, each with a one-line *when to use* and the honest *when not to* (the YAGNI filter),
   so plans don't sprout charts gratuitously.

## Testing / verification

This is presentation markup, so verification is visual:

1. Build a throwaway plan exercising all three primitives (single- and two-series `.hbar`,
   a 5-task `.gantt` with one overlap, a 3-segment `.stack`).
2. Open it in the plans Chrome instance per the skill's normal open-and-verify step.
3. Confirm: renders correctly in **both light and dark** (toggle); **no flicker** across at
   least two 4s reloads; **no horizontal page scroll** (wide gantt scrolls within its own box);
   layout holds at a narrow viewport.
4. Confirm the existing primitives and tracker are unaffected (pure addition).

## Rollout

- Edit source of truth: `rich-html-plans/plan-template.html` + `rich-html-plans/SKILL.md`.
- Sync the installed copy at `~/.claude/skills/rich-html-plans/` and the `Quadshift/ai-library`
  mirror (per `rich-html-plans-mirror` memory).
- Pure addition — no migration; existing plans are unaffected.
