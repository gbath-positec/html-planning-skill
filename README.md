# html-plan skill

A Claude Code skill that turns any implementation or project plan into a polished,
**self-contained HTML document** — sticky sidebar nav with scroll-spy, a phase
roadmap, a live progress tracker, rich diagrams, and a light/dark toggle — then
saves it to `Docs/` and opens it in your browser.

It triggers automatically when you ask Claude to "plan", "make a plan", "write up
the plan", or otherwise finalize a multi-phase plan.

![A plan rendered by the skill — roadmap, progress ring, and phase cards](screenshots/02-roadmap-progress.png)

---

## Why use it

Markdown plans scroll off the screen and go stale the moment work starts. This
skill gives every plan a single, shareable artifact that **tracks itself as the
work progresses** and reads like a product spec instead of a wall of text.

### 📊 Live progress tracking
Every build phase gets a status pill (To do / In progress / Done). The sidebar
**progress ring**, the **roadmap**, and the pills all stay in sync from one source
of truth — and the page **auto-refreshes every few seconds**, so as Claude works
through the plan you watch the ring fill and phases flip to green in real time
(complete with a confetti finale). No manual editing, no stale checkboxes.

### 🧭 Built to navigate
A sticky sidebar with **scroll-spy** highlights where you are, the roadmap lets you
jump to any phase, and the hero summarizes the whole effort in a few chips. Long
plans stop being a scroll-fest.

### 🎨 Diagrams instead of walls of text
The skill reaches for a **visual** wherever one helps — data flows, data models,
ordered procedures, A-vs-B trade-offs, and file trees all render as clean,
pre-styled diagrams. A plan ends up mostly pictures, which is far easier to review.

![Flow diagrams, comparison cards, and a second flow](screenshots/03-diagrams.png)

### 🗂️ Reference sections that travel with the plan
File maps, verification steps, tech-stack tables, and deferred work live right
alongside the phases — so the "how do I prove this works?" answer is never more
than a click away.

![File-tree diagram and a verification checklist](screenshots/04-tree-verification.png)

### 📦 One file, zero dependencies
The output is a **single HTML file** with all CSS and JS inlined — no CDN, no build
step. It works offline, opens in any browser, and you can drop it in Slack, attach
it to a ticket, or commit it to the repo. Light/dark toggle is built in and
remembered per plan.

### ⏳ Tells you when it needs you
When Claude pauses to ask a question mid-build, the plan pops a pulsing **"Waiting
for your input"** banner at the top and flags the browser tab with a ⏳. If you're
watching progress on a second screen, you know the instant it's blocked on a
decision — and clicking the banner jumps you to the section in question.

![The "Waiting for your input" banner pinned to the top of a plan](screenshots/05-waiting-banner.png)

---

## What's in this package

```
html-plan-skill/
├── README.md                 # this file
├── screenshots/              # the images used above
└── html-plan/                # ← the skill itself (this is what you install)
    ├── SKILL.md              # the skill definition Claude reads
    └── assets/
        └── plan-template.html # the HTML template the skill fills in
```

You only install the **`html-plan/`** folder. The README and screenshots are just
documentation.

---

## Install

Pick **one** of the two locations below, then restart Claude Code.

### Option A — Personal (available in all your projects)

Copy the `html-plan/` folder into your user skills directory:

| OS | Destination |
|----|-------------|
| **Windows** | `C:\Users\<you>\.claude\skills\html-plan\` |
| **macOS / Linux** | `~/.claude/skills/html-plan/` |

PowerShell (Windows):

```powershell
Copy-Item -Recurse -Force .\html-plan "$env:USERPROFILE\.claude\skills\html-plan"
```

bash (macOS / Linux):

```bash
mkdir -p ~/.claude/skills && cp -R ./html-plan ~/.claude/skills/html-plan
```

### Option B — Project / team (committed to a repo, shared via git)

Copy the `html-plan/` folder into the repo so everyone who clones it gets the skill:

```
<your-repo>/.claude/skills/html-plan/
```

```bash
mkdir -p .claude/skills && cp -R ./html-plan .claude/skills/html-plan
git add .claude/skills/html-plan && git commit -m "Add html-plan skill"
```

---

## Verify it's installed

1. Restart Claude Code (or open the `/hooks` menu, which reloads config).
2. Run `/html-plan` — if it's recognized, the skill loaded.
3. Or just ask Claude to "write up a plan" for something; it should produce an
   HTML file in `Docs/` and open it.

The final HTML is written to a `Docs/` folder in your current project, so make
sure you're running Claude Code from a project directory.

---

## Optional: make plans *always* render as HTML

The skill triggers on its own, but if you want a hard guarantee that every plan
request produces HTML, add a `UserPromptSubmit` hook that reminds Claude. This is
**separate from the skill** and is configured per-machine (or per-repo) in
`settings.json`.

Add this under the top-level object in either `~/.claude/settings.json`
(personal) or `<repo>/.claude/settings.json` (team):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "shell": "bash",
            "command": "grep -iqE \"\\bplan(s|ning|ned)?\\b\" && printf \"%s\" \"{\\\"hookSpecificOutput\\\":{\\\"hookEventName\\\":\\\"UserPromptSubmit\\\",\\\"additionalContext\\\":\\\"REMINDER: This request involves a plan. When you finalize or present any implementation/project plan this turn, you MUST render it using the html-plan skill (Skill tool, skill=html-plan) — do not output the plan as plain markdown.\\\"}}\" || true",
            "statusMessage": "Checking for plan request..."
          }
        ]
      }
    ]
  }
}
```

> This hook uses `grep` (no extra dependencies). On Windows it relies on the Git
> Bash that ships with Claude Code. If you already have a `hooks` key in your
> settings, merge the `UserPromptSubmit` entry in rather than replacing the whole
> block. It matches the word "plan" anywhere in your message, so it can fire on the
> occasional false positive (e.g. "explain the plan skill") — the reminder is
> harmless when it does.

After editing settings, open `/hooks` once or restart Claude Code so the new hook
loads.

---

## Updating later

This is a one-off copy. If the skill is improved, re-copy the updated `html-plan/`
folder over the installed one. For automatic updates, package it as a Claude Code
plugin/marketplace instead.
