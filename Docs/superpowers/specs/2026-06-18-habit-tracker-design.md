# Habit Tracker — Design

**Date:** 2026-06-18
**Status:** Approved

## Summary

A single-page habit tracker: one `index.html` file with inline CSS and vanilla
JS, no build step and no dependencies. Habits are checked off once per day
(done / not done). The main screen shows today's habits as a checklist; clicking
a habit opens a per-habit history view with a 90-day contribution grid and streak
stats. All state persists in `localStorage`. The app works offline by opening the
file directly.

## Goals

- Track simple yes/no habits, one check-off per habit per day.
- See today's progress at a glance ("X of Y done") with per-habit current streak.
- Drill into any habit to see its history grid and streaks.
- Manage habits: add (name + emoji + color), rename, delete, reorder.
- Zero infrastructure — open the HTML file, it works.

## Non-Goals (YAGNI)

- Count-based / target-based habits (yes/no only).
- Multi-device sync, accounts, or backend.
- Reminders / notifications.
- Per-day notes, archiving.

## Stack & Shape

- Single `index.html` containing `<style>` and `<script>` inline.
- Vanilla JS, no framework, no build, no external requests.
- All state in `localStorage` under one key: `habit-tracker-v1`.

## Data Model

```js
{
  version: 1,
  habits: [
    { id: string, name: string, emoji: string, color: string,
      createdAt: string /* ISO */, order: number }
  ],
  // completions keyed for O(1) toggle/lookup
  completions: {
    "<habitId>": { "2026-06-18": true, "2026-06-17": true /* ... */ }
  }
}
```

- Dates are local `YYYY-MM-DD` strings to avoid timezone drift.
- `completions` only stores `true` entries; absence means "not done".
- `id` generated via `crypto.randomUUID()`.

## Views

No router — a single `currentView` state value with show/hide rendering.

1. **Today (default)**
   - Header: today's date + "X of Y done" summary.
   - List of habit rows: emoji, name, current-streak badge, check-off toggle.
   - Tapping a row (or its checkbox) toggles today's completion.
   - Tapping the habit name/emoji opens its History view.
   - "Add habit" button → inline form (name, emoji picker, color swatches).

2. **History (per habit)**
   - Back button to Today.
   - Contribution grid of the last 90 days; filled cells = completed days,
     colored with the habit's color. Cells are tappable to toggle past days.
   - Current streak + longest streak.
   - Controls: rename, change color/emoji, delete (with confirm).

## Modules (functions within the single file, clearly separated)

- `store` — `load()`, `save(state)`, `migrate(raw)`. Wraps localStorage with
  try/catch; returns a fresh default state on corrupt/missing data.
- `model` — pure data operations: `addHabit`, `renameHabit`, `deleteHabit`,
  `reorderHabit`, `toggleCompletion`, `streakCurrent`, `streakLongest`.
- `dates` — `todayKey()`, `keyForOffset(n)`, `lastNDays(n)`.
- `render` — `renderToday()`, `renderHistory(habitId)`, `renderApp()`.
- `events` — delegated click/submit handlers on a root container.

## Streak Logic

- **Current streak:** count back from today while consecutive days are completed.
  (Today not-yet-done does not break a streak that ran through yesterday — define:
  current streak counts the longest consecutive run ending at today or yesterday.)
- **Longest streak:** maximum consecutive run anywhere in the habit's history.

## Error Handling

- Corrupt or missing `localStorage` → `store.load()` returns fresh default state
  (try/catch around `JSON.parse`).
- Unknown/older `version` → `migrate()` upgrades or resets safely.
- Delete habit requires a confirm step.
- Empty state (no habits) → friendly empty message + prominent "Add habit".

## Testing

- Pure functions are the test surface: `streakCurrent`, `streakLongest`,
  `toggleCompletion`, and the `dates` helpers.
- A small inline assertion harness (or sibling `test.html`) exercises edge cases:
  empty history, single day, gap-breaks-streak, streak ending yesterday, longest
  vs current divergence, timezone-boundary date keys.

## Open Questions

None — scope is locked to the above.
