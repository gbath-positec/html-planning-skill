---
name: html-plan
description: "Use when finalizing, presenting, or writing an implementation/project plan — renders the plan as a polished, self-contained HTML document (sticky sidebar nav with scroll-spy, phase roadmap, clickable progress tracker, diagrams, light/dark toggle) saved to Docs/ and opened in Chrome. Trigger after plan mode or brainstorming settles a multi-phase plan, or when the user says 'plan', 'make a plan', 'write up the plan', or wants a plan as HTML / a doc / a link."
---

# HTML Plan

Turn a settled implementation/project plan into a polished, self-contained HTML document and open it in Chrome. This is the standard way to deliver a plan in this workspace: **always render the plan as HTML, then open the link in Chrome.**

## When to use

- A plan has just been finalized (plan mode `ExitPlanMode`, a brainstorming session, or a written spec).
- The user asks to "plan X", "write up the plan", or wants a plan "as HTML / a doc / a link".

This **complements** the plan-mode markdown plan file — it does not replace it. If a markdown plan exists, render its content as HTML. If not, write the plan content directly into the HTML.

## Procedure

1. **Gather the plan content.** Use the agreed plan (from the markdown plan file, the conversation, or what the user asked for). Identify:
   - Title + one-line subtitle.
   - A short list of **build sections** that should be progress-tracked (phases / workstreams). Give each a stable `id` (e.g. `phase0`, `phase2`, `ui`).
   - Reference sections that are NOT tracked (context, critical files, verification, deferred).

2. **Copy the template.** Read `assets/plan-template.html` from this skill directory and use it as the base. It contains the complete CSS + JS (sidebar nav, scroll-spy, phase roadmap, clickable status pills, progress ring, light/dark toggle) — do not rewrite these; only fill in content.

3. **Fill in content**, following the patterns already in the template:
   - Hero: title, subtitle, and a few `.chip` highlights.
   - Sidebar `nav.toc` + the `.roadmap`: one entry per tracked section, each with `data-track="<id>"`.
   - One `<section id="<id>" class="card phase">` per tracked section, each containing a `.sec-head` with a `.status` pill (`data-track="<id>"`).
   - Reference sections use `class="card plain"` (no status pill).
   - **Be generous with diagrams** (see the **Diagrams** section below). Default to a visual for any flow, data model, ordered procedure, decision/comparison, or hierarchy — reach for prose only when a diagram wouldn't add clarity.
   - **Critical:** the script's `ids` array (near the bottom) must list exactly the tracked section ids, so the progress ring and roadmap reflect them. Keep `data-track` ids consistent across sidebar, roadmap, and pills.

4. **Save** to the repo's `Docs/` folder (create it if missing) as `Docs/<kebab-title>-plan.html`. If there is no `Docs/` folder and no obvious docs location, save to the repo root.

5. **Ensure the plan-aware SessionStart hook is installed** (one-time per repo). This makes every future Claude session in this repo — including ones the plan's "⏩ Continue plan" deep link opens — wake up already knowing the newest plan's `#plan-state`. Read `assets/session-start-hook.json` from this skill directory and **merge** its `hooks.SessionStart` entry into the repo's `.claude/settings.json` (create the file if missing; preserve any existing settings; if a SessionStart hook with this same command is already present, do nothing — it's idempotent). The hook is self-contained PowerShell (no `jq`/node), auto-discovers the newest `Docs/*-plan.html`, and **stays silent when that plan is 100% done**, so it never nags on finished work. **First-time caveat:** a hook written into a brand-new `.claude/settings.json` only takes effect after the user opens `/hooks` once or restarts Claude Code — the settings watcher doesn't pick up a `.claude/` directory that had no settings file when the session started. Say so when you install it the first time. See **Plan-aware sessions** below.

6. **Open in Chrome — dedicated "plans" window, new tab — and VERIFY it actually surfaced.** This workspace is Windows. All plans open in a **dedicated Chrome instance** pinned to its own profile directory, so every plan lands in the same window: the first plan of a session opens that window, each later plan opens as a **new tab** in it, and it never mixes into your regular browsing windows. Use the **PowerShell tool** with `Start-Process chrome` + a fixed `--user-data-dir`. Do NOT use `cmd /c start chrome <url>`.
   ```powershell
   $url = "file:///<ABSOLUTE/forward-slash/path>.html"
   $planProfile = "$env:USERPROFILE\.plan-chrome"   # dedicated profile dir for plans (reused across plans)
   Start-Process chrome -ArgumentList "--user-data-dir=$planProfile", $url
   Start-Sleep -Seconds 2
   $p = Get-Process chrome -ErrorAction SilentlyContinue
   "chrome running=$([bool]$p)"
   $p | Where-Object { $_.MainWindowTitle -like '*<DISTINCTIVE WORD FROM <title>>*' } | Select-Object -ExpandProperty MainWindowTitle
   ```
   **Confirm it opened** by checking a window title matching the doc's `<title>` appears. Note: only the **first** plan of a session starts a new chrome process for this profile; later plans open as tabs in that same window, so the process count won't keep rising — that's expected, not a failure. The plans profile is intentionally separate from your normal Chrome (its own extensions/logins/history). If no matching window/process appears at all afterward, report that — don't claim success on exit code alone. (If Chrome isn't installed, fall back to `Start-Process $url` for the default browser. macOS: `open -na "Google Chrome" --args --user-data-dir="$HOME/.plan-chrome" <path>`; Linux: `google-chrome --user-data-dir="$HOME/.plan-chrome" <path>`.)

7. **Tell the user** the file path, that it's been opened (with the verification result), and that it auto-refreshes every ~4s as you update progress.

## Diagrams (use them generously)

A good plan is **mostly visual**. Before writing a paragraph, ask: "is this a flow, a data model, a sequence, a choice, or a hierarchy?" — if so, **draw it**. Aim for at least one diagram in most tracked sections, and never leave a data model, multi-step flow, or A-vs-B decision as prose.

Pick the primitive by what you're showing (all pre-styled in the template — copy the commented example patterns in its body):

| You're explaining… | Use |
|---|---|
| How data/requests move through stages, a lifecycle, a question→answer path | `.flow` — `.node` boxes joined by `.arrow` (→); tint with `.q` / `.hl` / `.ans` |
| A data model, table, record shape, env/config mapping | `.schema` — `.row` > `.col-name` / `.col-type` / `.col-note` |
| An ordered procedure / the steps within one phase | `<ol class="steps">` — numbered, with a connecting rail |
| Before vs after, option A vs B, trade-offs, kept vs dropped | `.compare` — cards `.bad` / `.good` / `.pick`, each with a `.ct` label |
| File layout, module decomposition, any hierarchy | `.tree` — author with `├─ └─ │`; `.dir` / `.nm` / `<small>` |
| A short emphasis, caveat, or acceptance check | `.callout` (`.warn` / `.ok`) |
| Dense factual rows (decisions, files × vars) | `<table>` |

Wrap `.flow` / `.schema` / `.tree` in `<div class="diagram"><div class="dg-title">…</div>…</div>`. `.steps`, `.compare`, `<table>`, and `.callout` stand on their own. Keep each diagram focused — two small diagrams beat one busy one.

## Notes

- Keep it **one self-contained file** — no external CSS/JS/CDN. The template's styles and script are inline by design so the doc works offline and travels well.
- Progress lives **only** in the embedded `#plan-state` block (see below) — the page reads it and renders; there is no per-viewer status state and the pills are display-only (not clickable). Only the theme preference is stored in `localStorage` (keyed `{{KEBAB_TITLE}}-theme`); keep a unique `{{KEBAB_TITLE}}` per plan.
- Match content density to the plan: a short plan can drop the roadmap, but **diagrams earn their place even in short plans** — a single flow or comparison often replaces several paragraphs. Large multi-phase plans benefit from all of it.

## Live progress updates

The embedded state block is the **single source of truth** for progress — you edit it, the
page displays it. There is no clicking, no localStorage status, no reconciliation, no flags:

```html
<script id="plan-state" type="application/json">
{ "status": {} }
</script>
```

- To update progress, **Edit this one block**: set each tracked `id` to `"todo"`, `"doing"`,
  or `"done"`. The `status` keys must exactly match the script's `ids` array / the
  `data-track` ids.
- **The page auto-refreshes every 4s** (the `RELOAD_MS` constant in the script), re-reading
  the file from disk and preserving scroll + theme — so when you edit `#plan-state`, the open
  tab reflects it within a few seconds with no manual refresh. This always runs; there is no
  on/off control. To change the cadence, edit `RELOAD_MS`; to make a delivered plan fully
  static, delete the `setInterval` auto-refresh block.
- **Auto-scroll follows the work:** the page smooth-scrolls to the `"doing"` section once each
  time the in-progress section *changes* (first open, or when one section finishes and the next
  starts). On ordinary refreshes (same section still in progress) it stays put and preserves the
  reader's scroll position.

### Signalling "waiting for your input"

When you pause to ask the user something — an `AskUserQuestion`, or any point you're blocked on
their decision — **set a `waiting` field in `#plan-state` first**, in the same edit or just before
you ask. The open tab then shows a pulsing "⏳ Waiting for your input" banner pinned to the top
(and prefixes the browser-tab title with ⏳), so a user watching the plan on a second monitor knows
you need them:

```json
{
  "status": { "phase2": "doing" },
  "waiting": { "question": "Which embedding model + dimension?", "section": "phase2" }
}
```

- `question` (**required**) — short text shown in the banner.
- `section` (optional) — a tracked `id`; when set, the banner is clickable and scrolls there.
- Shorthand: `"waiting": "your question here"` also works (no section link).
- **Clear it the moment they answer** — set `"waiting": null` or remove the key. Leaving it set
  makes the plan look perpetually blocked.

### Granular progress — optional `#plan-state` fields

All optional and back-compatible; omit any you don't use and the plan renders as normal.

```jsonc
{
  "status": { "phase1": "done", "phase3": "doing" },
  "steps":  { "phase1": 4, "phase3": 2 },                                   // sub-task progress
  "times":  { "phase1": { "start": "09:12", "end": "10:48" } },             // per-phase timing
  "log":    [ { "t": "10:48", "text": "Phase 1 done — auth live" } ]        // activity feed
}
```

- **`steps`** — sub-task progress for a phase. Mark that phase's primary list with
  `data-steps="<id>"` (e.g. `<ol class="steps" data-steps="phase1">`). The value is either a
  **number** (first N `<li>` are done) or an **array of 0-based indices** (`[0,2]`). Done items
  get a ✓ and dim; a `n / total` sub-bar appears in the phase header (`total` = list length).
- **Sidebar sub-steps (automatic).** When a tracked phase contains an `<ol class="steps">`, its
  steps also render as a nested, collapsible sub-list under that phase's sidebar link — labels
  derived from each step's bold lead. Per-step dots turn green from the same `steps` data; the
  `doing` phase's first not-done step shows amber. The active phase auto-expands (on load the
  `doing` phase; on scroll whichever phase you reach — one open at a time), a chevron toggles a
  phase manually, and clicking a sub-step jumps to that exact step in the body. No extra
  authoring — it's driven by the step list you already wrote plus the existing `steps` field.
- **`times`** — optional per-phase `{ start, end }` time strings shown as a muted line under the
  phase title. You supply the strings (the page can't know wall-clock for past events).
- **`log`** — an array of `{ t, text }` entries rendered as a timeline in the `#activity`
  reference section (which **self-hides when the log is empty**). Append an entry as you finish
  notable work. Keep the standard `#activity` section in the body — it's wired automatically.

### Viewer controls (no authoring needed)

The template ships these for whoever opens the plan; they persist across the 4s refresh:
- **🔔 Notify me** (sidebar) — opt-in desktop notification + soft chime when you set `waiting`
  or the plan hits 100%. Requires a one-time permission click; falls back to the banner + tab
  title if the browser blocks notifications (e.g. on the `file://` origin).
- **Collapse** chevrons per phase, a **To do / Doing / Done filter**, and **j / k** keyboard
  jump — all for navigating large plans.

## Deep-link actions (turn the plan into a control surface)

A plan can carry **deep-link buttons** that launch Claude Code straight from the doc — open the
repo, start a phase, continue the plan, or let the user **answer the plan's own question**
by clicking an option. Buttons are **injected by the template's JS from `#plan-state`** — you add
data, not markup. The whole feature is **opt-in: nothing renders unless you add a `deepLinks`
block.** When you do, it's on by default (hero + per-phase buttons appear automatically).

```jsonc
{
  "status": { "phase1": "doing" },
  "deepLinks": {
    "cwd": "C:/Users/you/Desktop/my-repo",        // absolute working dir (forward slashes on Windows)
    "planPath": "Docs/my-plan.html"               // used by the "Continue plan" / answer buttons
  },
  "actions": {
    "phase1": { "start": "Implement Phase 1 …" },
    "phase2": { "start": "Implement Phase 2 …" }
  }
}
```

**What renders:**
- **Hero** — "⚡ Open repo in Claude Code" (uses `cwd`) and, when `planPath` is set, "⏩ Continue
  plan" (prompts Claude to open the plan and execute the next not-done phase).
- **Per phase** — "▶ Start in Claude Code" for any tracked id present in `actions`, injected into
  that phase's header.
- **Waiting banner** — see `waiting.options` below.

**Filling it in:**
- **`cwd`** — the skill runs *inside the repo*, so set the absolute working dir. Prefer it over
  `repo` (a GitHub slug). The template's `ccUrl()` URL-encodes everything; never hand-encode.
  **On Windows, write the path with forward slashes (`C:/Users/you/repo`) or double-escaped
  backslashes (`C:\\Users\\you\\repo`)** — a single-backslash JSON string corrupts the path and the
  launched terminal can't `cd`, so it flashes shut. Avoid raw double-quotes in prompt text (the
  template uses parens) — they can break a shell handoff.
- **Prompts (`actions[id].start`)** — capped at **5,000 chars**. For long work don't inline it —
  point Claude at the plan: *"Open the plan at `planPath` and implement Phase 2."*
- **Select/Answer** open a fresh session whose prompt says "open the plan at `planPath` and
  continue" so context is reloaded from the doc.
- **Reliability** — needs the `claude-cli://` handler registered (Claude Code **v2.1.91+**,
  auto-registers on first interactive run) and a working terminal emulator. One observed quirk: the
  handler reliably opens the **first** session, but if a Claude terminal is already open a
  *subsequent* click may flash-and-close — close the prior one, or use one button at a time.

### Select & Answer — let the user reply from the doc

Extend the `waiting` block (see above) with **`options`**. Each becomes a clickable button that
opens a Claude session with that choice pre-filled; a free-form "✎ Answer in Claude Code" button is
always added too. This is the async counterpart to the ⏳ banner — ideal for a second-monitor user.

```json
{
  "waiting": {
    "question": "Which embedding model?",
    "section": "phase2",
    "options": [ { "label": "OpenAI text-embedding-3-small" }, { "label": "Cohere embed-v3" } ]
  }
}
```

> **What this is (and isn't):** a deep link can only **open a session with the prompt
> pre-filled** — the user still presses Enter. It does **not** answer a live `AskUserQuestion`
> modal in place (a click can't reach into a running turn). The win is the *async* flow: pose the
> question in `waiting.options`, end your turn; the user clicks later and the session continues.

### Caveats (state these honestly in the plan if relevant)

- Requires **Claude Code v2.1.91+**; the `claude-cli://` handler registers on the first
  interactive `claude` run (Windows: `HKCU\Software\Classes\claude-cli`).
- **No fallback by design** — if the scheme isn't registered, a click silently does nothing
  (there is intentionally no copy-to-clipboard backup).
- Schemes work from a **local `file://`** page in Chrome (our case) but are **stripped by GitHub's
  Markdown** — so these buttons are for the opened doc, not for pasting into a README.
- Prompts are **inert until Enter**; a session shows a "Prompt from an external link" warning.

## Plan-aware sessions (SessionStart hook)

The "⏩ Continue plan" deep link opens a **fresh** Claude session, which on its own knows nothing
about the conversation that produced the plan — the `q=` prompt just asks Claude to go read the
file. The SessionStart hook (`assets/session-start-hook.json`, installed in **step 5**) closes that
gap from the other direction: on **every** session start in the repo it finds the newest
`Docs/*-plan.html`, reads its `#plan-state`, and **injects the plan path + current status into the
session as context** (via `hookSpecificOutput.additionalContext`). A resumed session then already
knows which phases are done, which is in progress, and any pending `waiting` question — without
being told. The hook *reads* the plan; the plan's buttons don't reference the hook — they're
**decoupled**, and either works without the other.

- **Read-only & quiet.** It only reads files and prints context; it never writes. It emits
  **nothing** when the newest plan's tracked statuses are all `"done"`, so finished work doesn't
  clutter unrelated sessions. A not-yet-started plan (empty `status`) still surfaces.
- **One install per repo, generic forever.** Written once into `.claude/settings.json`, it
  auto-discovers whatever the current newest plan is — making a new plan needs no hook changes.
- **Windows / PowerShell, dependency-free.** Uses `shell: "powershell"`, no `jq`/node. On
  macOS/Linux, port the one-liner to bash; the surrounding JSON shape is identical.
- **Watcher caveat.** If `.claude/settings.json` didn't exist when the session started, the new
  hook won't fire until the user opens `/hooks` once or restarts. Tell them on first install.
