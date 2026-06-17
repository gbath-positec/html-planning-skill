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

5. **Open in Chrome — and VERIFY it actually surfaced.** This workspace is Windows. Do NOT use `cmd /c start chrome <url>` — when Chrome is already running it hands the URL to the existing instance and often lands as an **unfocused background tab** (looks like nothing happened). Use the **PowerShell tool** with `Start-Process` + `--new-window`, which spawns a fresh, surfaced window and is verifiable:
   ```powershell
   $url = "file:///<ABSOLUTE/forward-slash/path>.html"
   $before = (Get-Process chrome -ErrorAction SilentlyContinue).Count
   Start-Process chrome -ArgumentList '--new-window', $url
   Start-Sleep -Seconds 2
   $p = Get-Process chrome -ErrorAction SilentlyContinue
   "procs before=$before after=$($p.Count)"
   $p | Where-Object { $_.MainWindowTitle -like '*<DISTINCTIVE WORD FROM <title>>*' } | Select-Object -ExpandProperty MainWindowTitle
   ```
   **Confirm it opened** by checking the process count went up AND/OR a window title matching the doc's `<title>` appears. If neither, report that — don't claim success on exit code alone. (If Chrome isn't installed, fall back to `Start-Process $url` for the default browser. macOS: `open -a "Google Chrome" <path>`; Linux: `google-chrome --new-window <path>`.)

6. **Tell the user** the file path, that it's been opened (with the verification result), and that it auto-refreshes every ~4s as you update progress.

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
- **On first open** (and the first time a section is in progress) the page smooth-scrolls once to
  the `"doing"` section so the reader lands on the current work; after that it preserves their
  scroll position on every refresh.

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
