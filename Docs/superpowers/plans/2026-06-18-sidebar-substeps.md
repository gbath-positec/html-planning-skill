# Sidebar Sub-steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render each html-plan phase's sub-steps as a nested, auto-expanding sub-list in the sidebar, with per-step completion dots and click-to-step navigation.

**Architecture:** Purely additive CSS + JS in the self-contained `plan-template.html`. New JS blocks (placed just before the existing scroll-spy block) build the sub-lists from each phase's `<ol class="steps">`, drive dot state from `#plan-state.steps`, generate per-step anchor ids, and run an accordion that follows the `doing` phase and scroll-spy with a manual pin. No new authoring contract — plans render the feature automatically.

**Tech Stack:** Vanilla HTML/CSS/JS (no build, no deps). PowerShell for structural checks; Chrome (dedicated `--user-data-dir` plans profile) for visual verification.

## Global Constraints

- **One self-contained file** — no external CSS/JS/CDN; all additions go inline in `plan-template.html`.
- **No new author markup or required `#plan-state` fields** — the feature is automatic and back-compatible; a plan with no `steps` data still renders (all dots grey, nothing expanded unless a phase is `doing`).
- **Two copies must stay byte-identical:** source `html-plan/assets/plan-template.html` and installed `C:/Users/gbath.SURREY/.claude/skills/html-plan/assets/plan-template.html`. Source is edited during dev; the installed copy is mirrored in the final task.
- **Test surface:** `Docs/focusflow-plan.html` (six phases, each with an `<ol class="steps">`). It is a static copy of the template, so each task applies the **same** CSS/JS insertion to BOTH `plan-template.html` and `Docs/focusflow-plan.html`. The open Chrome tab auto-refreshes every 4 s, so reloading is automatic.
- **Respect `prefers-reduced-motion`** — no flash/expand animation when reduced motion is requested.
- **Existing wiring is sacred:** do not rewrite the scroll-spy, collapse, filter, or granular-progress blocks except the single documented one-line addition to the scroll-spy callback in Task 3.

## File structure

| File | Responsibility | Tasks |
|---|---|---|
| `html-plan/assets/plan-template.html` | Source template — CSS + JS additions | 1–4 |
| `Docs/focusflow-plan.html` | Live visual test surface (same insertions) | 1–4 |
| `C:/Users/.../.claude/skills/html-plan/assets/plan-template.html` | Installed copy — mirrored from source | 5 |
| `html-plan/SKILL.md` (+ installed copy) | One-paragraph doc note | 5 |

**Insertion anchors** (verified against the current template):
- CSS goes immediately **after** the `.toc-label { … }` rule and **before** `.theme-btn {`.
- JS blocks go immediately **before** the `// ── Scroll-spy ──` comment line.
- Task 3 modifies the scroll-spy `IntersectionObserver` callback (the `if (en.isIntersecting) { … }` branch).

---

### Task 1: CSS for sub-lists, dots, chevron, and step flash

**Files:**
- Modify: `html-plan/assets/plan-template.html` (insert CSS after the `.toc-label` rule, before `.theme-btn {`)
- Modify: `Docs/focusflow-plan.html` (same insertion, same location)

**Interfaces:**
- Produces (CSS contract consumed by later tasks):
  - `ul.toc-sub` (collapsed by default) and `ul.toc-sub.open` (expanded)
  - `.toc-sub a[data-sst="done"|"current"|"todo"]` with a child `.sdot` and `.slabel`
  - `nav.toc a .toc-chev`, toggled by `nav.toc a.sub-open`
  - `.steps li.flash` one-shot highlight (reduced-motion safe)

- [ ] **Step 1: Insert the CSS block** at the anchor (after `.toc-label`, before `.theme-btn`), in BOTH files identically:

```css
  /* ── Sidebar sub-steps (nested under each phase link) ── */
  nav.toc .toc-sub { list-style: none; margin: 0 0 2px; padding: 0 0 0 17px; overflow: hidden;
    max-height: 0; opacity: 0; transition: max-height .28s cubic-bezier(.2,.7,.2,1), opacity .18s; }
  nav.toc .toc-sub.open { max-height: 420px; opacity: 1; }
  nav.toc .toc-sub a { font-size: 12px; padding: 4px 10px 4px 6px; color: var(--faint);
    border-left: 2px solid transparent; gap: 8px; }
  nav.toc .toc-sub a:hover { color: var(--text); background: var(--panel); text-decoration: none; }
  nav.toc .toc-sub a .sdot { width: 6px; height: 6px; border-radius: 50%; background: var(--border);
    flex: none; transition: background .2s, box-shadow .2s; }
  nav.toc .toc-sub a[data-sst="done"] { color: var(--muted); }
  nav.toc .toc-sub a[data-sst="done"] .sdot { background: var(--green); box-shadow: 0 0 6px var(--green); }
  nav.toc .toc-sub a[data-sst="current"] .sdot { background: var(--amber); box-shadow: 0 0 6px var(--amber); }
  nav.toc .toc-sub a .slabel { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  nav.toc a .toc-chev { margin-left: auto; flex: none; font-size: 9px; color: var(--faint);
    cursor: pointer; padding: 2px 5px; transition: transform .2s; }
  nav.toc a.sub-open .toc-chev { transform: rotate(90deg); }
  @keyframes step-flash { 0% { background: color-mix(in srgb, var(--accent) 32%, transparent); }
    100% { background: transparent; } }
  .steps li.flash { animation: step-flash 1.4s ease-out; border-radius: 6px; }
  @media (prefers-reduced-motion: reduce) { .steps li.flash { animation: none; } nav.toc .toc-sub { transition: none; } }
```

- [ ] **Step 2: Structural check** — confirm the classes exist exactly once per file:

Run:
```bash
cd "c:/Users/gbath.SURREY/Desktop/html-plan-skill"
grep -c "toc-sub.open" html-plan/assets/plan-template.html Docs/focusflow-plan.html
```
Expected: each path reports `1`.

- [ ] **Step 3: Commit**

```bash
git add html-plan/assets/plan-template.html Docs/focusflow-plan.html
git commit -m "html-plan: CSS for sidebar sub-steps (sub-list, dots, chevron, flash)"
```

---

### Task 2: Build sub-lists — labels, dots, anchor ids, chevron

**Files:**
- Modify: `html-plan/assets/plan-template.html` (new JS IIFE immediately before `// ── Scroll-spy ──`)
- Modify: `Docs/focusflow-plan.html` (same insertion)

**Interfaces:**
- Consumes: globals already in scope inside the main IIFE — `emb`, `ids`, `st(id)`, `status`.
- Produces:
  - One `<ul class="toc-sub" data-sub="<id>">` inserted after each phase's `nav.toc a[data-track="<id>"]`, with one `<a href="#<id>-step-<n>">` per step (1-based `n`).
  - A generated `id="<id>-step-<n>"` on each body `<li>` of that phase's `<ol class="steps">`.
  - A `<span class="toc-chev">▸</span>` appended to each phase link that has steps.
  - Dot state attribute `data-sst` = `done` | `current` | `todo` (current = first not-done step of the `doing` phase only).

- [ ] **Step 1: Insert the builder block** before `// ── Scroll-spy ──`, in BOTH files identically:

```javascript
  // ── Sidebar sub-steps: build nested sub-lists under each phase link ──
  (function () {
    var steps = (emb && emb.steps && typeof emb.steps === 'object') ? emb.steps : {};
    function doneSet(spec, total) {
      var d = {};
      if (typeof spec === 'number') { for (var i = 0; i < spec && i < total; i++) d[i] = 1; }
      else if (Array.isArray(spec)) spec.forEach(function (i) { d[i] = 1; });
      return d;
    }
    function labelFor(li) {
      var b = li.querySelector('b');
      var t = ((b ? b.textContent : li.textContent) || '').trim().replace(/[.:]\s*$/, '');
      return t.length > 60 ? t.slice(0, 59) + '…' : t;
    }
    ids.forEach(function (id) {
      var link = document.querySelector('nav.toc a[data-track="' + id + '"]');
      var section = document.getElementById(id);
      if (!link || !section) return;
      var list = section.querySelector('ol.steps');
      if (!list) return;
      var items = [].filter.call(list.children, function (n) { return n.tagName === 'LI'; });
      if (!items.length) return;
      var total = items.length, done = doneSet(steps[id], total), phaseDoing = (st(id) === 'doing');
      var firstUndone = -1; for (var i = 0; i < total; i++) { if (!done[i]) { firstUndone = i; break; } }
      var sub = document.createElement('ul'); sub.className = 'toc-sub'; sub.setAttribute('data-sub', id);
      items.forEach(function (li, i) {
        var stepId = id + '-step-' + (i + 1);
        li.id = stepId;
        var a = document.createElement('a'); a.href = '#' + stepId;
        a.setAttribute('data-sst', done[i] ? 'done' : (phaseDoing && i === firstUndone ? 'current' : 'todo'));
        a.innerHTML = '<span class="sdot"></span><span class="slabel"></span>';
        var lab = labelFor(li); a.querySelector('.slabel').textContent = lab; a.title = lab;
        sub.appendChild(a);
      });
      if (!link.querySelector('.toc-chev')) {
        var chev = document.createElement('span'); chev.className = 'toc-chev'; chev.textContent = '▸';
        link.appendChild(chev);
      }
      link.parentNode.insertBefore(sub, link.nextSibling);
    });
  })();
```

- [ ] **Step 2: Set up the test fixture** — give the FocusFlow plan some step data so dots show. Edit ONLY `Docs/focusflow-plan.html`'s `#plan-state` block: set `phase0` done and `phase1` doing, and add a `steps` map. Replace the `"status": { … }` line and add a `steps` line so the block reads:

```json
  "status": { "phase0": "done", "phase1": "doing", "phase2": "todo", "phase3": "todo", "phase4": "todo", "phase5": "todo" },
  "steps": { "phase0": 4, "phase1": 2 },
```
(Also add `data-steps="phase1"` to Phase 1's `<ol class="steps">` and `data-steps="phase0"` to Phase 0's, so the body sub-bar lines up with the sidebar — find `<ol class="steps">` inside `<section id="phase0"` and `<section id="phase1"` and add the attribute.)

- [ ] **Step 3: Verify in browser.** Ensure the tab is open (it auto-refreshes every 4 s):

```bash
# (only if not already open)
powershell -Command "Start-Process chrome -ArgumentList '--user-data-dir=$env:USERPROFILE\.plan-chrome','file:///c:/Users/gbath.SURREY/Desktop/html-plan-skill/Docs/focusflow-plan.html'"
```
Expected, in the sidebar:
- Phase 0 and Phase 1 links now show a `▸` chevron and an indented sub-list beneath them.
- Phase 0's four sub-step dots are **green**; its label text is dimmed.
- Phase 1's first two dots are **green**, the third is **amber** (current), the fourth grey.
- Sub-step labels read as the bold leads ("State machine", "Tick loop", …).

- [ ] **Step 4: Structural check** — anchor ids were generated on the body steps:

Run:
```bash
grep -o 'id="phase1-step-[0-9]"' Docs/focusflow-plan.html | sort -u
```
Expected: `id="phase1-step-1"` … `id="phase1-step-4"`.

- [ ] **Step 5: Commit**

```bash
git add html-plan/assets/plan-template.html Docs/focusflow-plan.html
git commit -m "html-plan: build sidebar sub-step lists with dots and anchors"
```

---

### Task 3: Accordion — auto-expand (doing + scroll), manual pin, persistence

**Files:**
- Modify: `html-plan/assets/plan-template.html` (new JS IIFE before `// ── Scroll-spy ──`, AFTER the Task 2 block; plus a one-line addition inside the scroll-spy callback)
- Modify: `Docs/focusflow-plan.html` (same)

**Interfaces:**
- Consumes: the `ul.toc-sub[data-sub]` elements + `.toc-chev` from Task 2; globals `ids`, `st`, `TKEY`.
- Produces: global `window.__subStepOnActive(id)` — called by scroll-spy when a section becomes active; opens that phase's sub-list unless another is manually pinned. Adds/removes `.open` on `ul.toc-sub` and `.sub-open` on the phase link. Persists the pinned id in `sessionStorage` under `<TKEY base>-subpin`.

- [ ] **Step 1: Insert the accordion controller** before `// ── Scroll-spy ──`, after the Task 2 block, in BOTH files:

```javascript
  // ── Sub-step accordion: one open at a time (doing on load, scroll override, manual pin) ──
  (function () {
    var subs = {};
    [].slice.call(document.querySelectorAll('nav.toc .toc-sub')).forEach(function (ul) { subs[ul.getAttribute('data-sub')] = ul; });
    if (!Object.keys(subs).length) return;
    var PINKEY = TKEY.replace('-theme', '-subpin');
    var pinned = null; try { pinned = sessionStorage.getItem(PINKEY) || null; } catch (e) {}
    function linkFor(id) { return document.querySelector('nav.toc a[data-track="' + id + '"]'); }
    function setOpen(id) {
      Object.keys(subs).forEach(function (k) {
        var on = (k === id);
        subs[k].classList.toggle('open', on);
        var l = linkFor(k); if (l) l.classList.toggle('sub-open', on);
      });
    }
    var doingId = null; for (var i = 0; i < ids.length; i++) { if (st(ids[i]) === 'doing') { doingId = ids[i]; break; } }
    var initial = (pinned && subs[pinned]) ? pinned : doingId;
    if (initial) setOpen(initial);
    Object.keys(subs).forEach(function (id) {
      var l = linkFor(id); if (!l) return;
      var chev = l.querySelector('.toc-chev'); if (!chev) return;
      chev.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var willOpen = !subs[id].classList.contains('open');
        setOpen(willOpen ? id : null);
        pinned = willOpen ? id : null;
        try { if (pinned) sessionStorage.setItem(PINKEY, pinned); else sessionStorage.removeItem(PINKEY); } catch (e2) {}
      });
    });
    window.__subStepOnActive = function (id) {
      if (!subs[id]) return;
      if (pinned && pinned !== id) { pinned = null; try { sessionStorage.removeItem(PINKEY); } catch (e) {} }
      if (!pinned) setOpen(id);
    };
  })();
```

- [ ] **Step 2: Hook scroll-spy.** In the scroll-spy `IntersectionObserver` callback, inside the `if (en.isIntersecting) { … }` branch, add the call right after the line that sets the active link. The branch should read (BOTH files):

```javascript
      if (en.isIntersecting) {
        Object.values(links).forEach(function (a) { a.classList.remove('active'); });
        var a = links[en.target.id]; if (a) a.classList.add('active');
        if (window.__subStepOnActive) window.__subStepOnActive(en.target.id);
      }
```

- [ ] **Step 3: Verify in browser** (tab auto-refreshes). Expected:
- On load, **Phase 1** (the `doing` phase) is expanded; all other sub-lists collapsed.
- Scrolling down so Phase 3 is in view expands Phase 3 and collapses Phase 1 — only one open at a time.
- Clicking the `▸` chevron on Phase 5 expands it and it **stays** open while you scroll a little (pinned); scrolling far enough that another phase becomes active releases the pin.

- [ ] **Step 4: Persistence check.** Click Phase 5's chevron to pin it, then wait ~4 s for the auto-refresh. Expected: Phase 5 remains expanded after the reload (pin restored from `sessionStorage`).

- [ ] **Step 5: Commit**

```bash
git add html-plan/assets/plan-template.html Docs/focusflow-plan.html
git commit -m "html-plan: sub-step accordion (doing + scroll-spy + manual pin, persisted)"
```

---

### Task 4: Click-to-step — scroll to the exact body step and flash it

**Files:**
- Modify: `html-plan/assets/plan-template.html` (new JS IIFE before `// ── Scroll-spy ──`, AFTER the Task 3 block)
- Modify: `Docs/focusflow-plan.html` (same)

**Interfaces:**
- Consumes: the sub-list anchors `nav.toc .toc-sub a[href="#<id>-step-<n>"]` and the body `<li id="<id>-step-<n>">` from Task 2; the `.steps li.flash` CSS from Task 1.
- Produces: click handler that expands the target's body card if collapsed, smooth-scrolls the `<li>` into view (centered), and applies a one-shot `.flash`.

- [ ] **Step 1: Insert the click-to-step block** before `// ── Scroll-spy ──`, after the Task 3 block, in BOTH files:

```javascript
  // ── Click-to-step: scroll to the exact body step and flash it ──
  (function () {
    var reduceMo = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    [].slice.call(document.querySelectorAll('nav.toc .toc-sub a')).forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href').slice(1);
        var li = document.getElementById(id); if (!li) return;
        e.preventDefault();
        var card = li.closest('section.card'); if (card) card.classList.remove('collapsed');
        li.scrollIntoView({ behavior: reduceMo ? 'auto' : 'smooth', block: 'center' });
        li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash');
        setTimeout(function () { li.classList.remove('flash'); }, 1500);
        try { history.replaceState(null, '', '#' + id); } catch (e2) {}
      });
    });
  })();
```

- [ ] **Step 2: Verify in browser** (tab auto-refreshes). Expected:
- Click "Tick loop" under Phase 1 in the sidebar → the page scrolls to the "Tick loop" line inside the Phase 1 card and that line briefly flashes (accent highlight fading out).
- If Phase 1's card was collapsed (via its body chevron), clicking the sub-step first expands the card, then scrolls/flashes.

- [ ] **Step 3: Reduced-motion check.** In Chrome DevTools (⋮ → More tools → Rendering → "Emulate CSS prefers-reduced-motion: reduce"), click a sub-step. Expected: it still scrolls to the step, but with no flash animation.

- [ ] **Step 4: Commit**

```bash
git add html-plan/assets/plan-template.html Docs/focusflow-plan.html
git commit -m "html-plan: click sidebar sub-step to jump to body step + flash"
```

---

### Task 5: Mirror to installed copy, document, full-plan regression

**Files:**
- Overwrite: `C:/Users/gbath.SURREY/.claude/skills/html-plan/assets/plan-template.html` (mirror from source)
- Modify: `html-plan/SKILL.md` and mirror to `C:/Users/gbath.SURREY/.claude/skills/html-plan/SKILL.md`

**Interfaces:**
- Consumes: the finished source template from Tasks 1–4.
- Produces: byte-identical installed template; a SKILL.md note describing the feature.

- [ ] **Step 1: Mirror the template** to the installed skill dir:

```bash
cp "c:/Users/gbath.SURREY/Desktop/html-plan-skill/html-plan/assets/plan-template.html" \
   "C:/Users/gbath.SURREY/.claude/skills/html-plan/assets/plan-template.html"
```

- [ ] **Step 2: Verify the two template copies are identical:**

Run:
```bash
diff -q "c:/Users/gbath.SURREY/Desktop/html-plan-skill/html-plan/assets/plan-template.html" \
        "C:/Users/gbath.SURREY/.claude/skills/html-plan/assets/plan-template.html" && echo IDENTICAL
```
Expected: `IDENTICAL`.

- [ ] **Step 3: Add a SKILL.md note.** In `html-plan/SKILL.md`, inside the existing "Granular progress — optional `#plan-state` fields" subsection, append this bullet after the `steps` bullet:

```markdown
- **Sidebar sub-steps (automatic).** When a tracked phase contains an `<ol class="steps">`, its
  steps also render as a nested, collapsible sub-list under that phase's sidebar link — labels
  derived from each step's bold lead. Per-step dots turn green from the same `steps` data; the
  `doing` phase's first not-done step shows amber. The active phase auto-expands (on load the
  `doing` phase; on scroll whichever phase you reach — one open at a time), a chevron toggles a
  phase manually, and clicking a sub-step jumps to that exact step in the body. No extra
  authoring — it's driven by the step list you already wrote plus the existing `steps` field.
```

- [ ] **Step 4: Mirror SKILL.md:**

```bash
cp "c:/Users/gbath.SURREY/Desktop/html-plan-skill/html-plan/SKILL.md" \
   "C:/Users/gbath.SURREY/.claude/skills/html-plan/SKILL.md"
```

- [ ] **Step 5: Regression — render a FRESH plan from the installed template** to prove the feature works on a newly generated doc (not just the hand-edited fixture). Copy the installed template to a scratch file and confirm the new JS is present and parseable:

Run:
```bash
cp "C:/Users/gbath.SURREY/.claude/skills/html-plan/assets/plan-template.html" \
   "c:/Users/gbath.SURREY/Desktop/html-plan-skill/Docs/_substep-smoke.html"
grep -c "__subStepOnActive\|toc-sub\|Click-to-step" "c:/Users/gbath.SURREY/Desktop/html-plan-skill/Docs/_substep-smoke.html"
```
Expected: count `>= 3` (the three feature markers present). Then delete the scratch file:
```bash
rm "c:/Users/gbath.SURREY/Desktop/html-plan-skill/Docs/_substep-smoke.html"
```

- [ ] **Step 6: Confirm acceptance criteria 1–9** from the spec against the open FocusFlow tab (sub-lists appear only where steps exist; labels match bold leads; dots match `steps`; doing-expand + scroll accordion; click-to-step + flash; manual pin; survives reload; reduced-motion; no new authoring). Note any failures.

- [ ] **Step 7: Commit**

```bash
git add html-plan/SKILL.md
git commit -m "html-plan: document sidebar sub-steps; mirror template to installed skill"
```

---

## Self-review

**Spec coverage:**
- Inputs/auto-derive labels → Task 2 (labelFor). ✓
- Dot states done/current/todo → Task 2 (`data-sst`). ✓
- Auto-expand doing-on-load + scroll override → Task 3. ✓
- Accordion + manual pin → Task 3. ✓
- Click-to-step + flash + per-step anchors → Task 2 (anchors) + Task 4 (scroll/flash). ✓
- sessionStorage persistence → Task 3 (PINKEY). ✓
- prefers-reduced-motion → Task 1 (CSS) + Task 4 (scroll behavior). ✓
- Phase-without-steps stays flat → Task 2 (`if (!list) return`). ✓
- No new authoring; mirror copies; SKILL.md note → Task 5. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete literal code; verification commands have expected output.

**Type/name consistency:** `toc-sub` / `data-sub` / `data-sst` / `.sdot` / `.slabel` / `.toc-chev` / `sub-open` / `__subStepOnActive` / `PINKEY = <base>-subpin` / anchor id `"<id>-step-<n>"` used consistently across Tasks 1–4. The Task 3 scroll-spy hook matches the existing callback's real variable names (`en`, `links`).
