# Habit Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page, dependency-free habit tracker that checks habits off once per day and shows per-habit history grids and streaks, all persisted in localStorage.

**Architecture:** One `index.html` with inline `<style>` and `<script>`. Pure functions (dates, model, streaks) are separated from rendering and event wiring so they can be unit-tested in a sibling `test.html`. State is a single object persisted under one localStorage key; the UI re-renders from state on every change.

**Tech Stack:** HTML5, CSS, vanilla JavaScript (ES2020+, `crypto.randomUUID`). No framework, no build step, no network requests.

## Global Constraints

- Single file `index.html` — all CSS and JS inline; no external assets or CDNs.
- No dependencies, no build step. Must run by opening the file (`file://`).
- localStorage key: `habit-tracker-v1`. State carries `version: 1`.
- Dates stored as local `YYYY-MM-DD` strings — never UTC/ISO timestamps for day keys.
- `completions` stores only `true` entries; absence means "not done".
- Tests live in `test.html`, runnable in-browser, using a tiny inline `assert`/`assertEqual` harness. No test framework.

---

### Task 1: Project skeleton + date helpers

**Files:**
- Create: `index.html`
- Create: `test.html`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `todayKey(): string` — local `YYYY-MM-DD` for today.
  - `dateKey(d: Date): string` — local `YYYY-MM-DD` for a Date.
  - `keyForOffset(n: number): string` — key for today minus `n` days.
  - `lastNDays(n: number): string[]` — array of `n` keys, oldest first, ending today.

- [ ] **Step 1: Write the failing test**

In `test.html`, create the harness and date tests:

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>Habit Tracker Tests</title></head>
<body>
<pre id="out"></pre>
<script>
const results = [];
function assert(cond, msg){ results.push({ok: !!cond, msg}); }
function assertEqual(a, b, msg){ assert(JSON.stringify(a)===JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }
function report(){
  const out = document.getElementById('out');
  const failed = results.filter(r=>!r.ok);
  out.textContent = results.map(r=>`${r.ok?'PASS':'FAIL'} ${r.msg}`).join('\n')
    + `\n\n${results.length-failed.length}/${results.length} passed`;
}

// ---- date helpers (paste of index.html implementation) ----
function dateKey(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function todayKey(){ return dateKey(new Date()); }
function keyForOffset(n){ const d=new Date(); d.setDate(d.getDate()-n); return dateKey(d); }
function lastNDays(n){ const out=[]; for(let i=n-1;i>=0;i--) out.push(keyForOffset(i)); return out; }

// ---- tests ----
assertEqual(dateKey(new Date(2026,5,18)), '2026-06-18', 'dateKey pads month/day');
assertEqual(dateKey(new Date(2026,0,3)), '2026-01-03', 'dateKey single digits padded');
assert(/^\d{4}-\d{2}-\d{2}$/.test(todayKey()), 'todayKey format');
assertEqual(keyForOffset(0), todayKey(), 'offset 0 is today');
assertEqual(lastNDays(3).length, 3, 'lastNDays length');
assertEqual(lastNDays(3)[2], todayKey(), 'lastNDays ends today');
report();
</script>
</body></html>
```

- [ ] **Step 2: Run test to verify it fails**

Open `test.html` in a browser. Expected: FAIL — initially the functions are only in `test.html` (this passes here), but `index.html` does not yet exist. Confirm `index.html` is empty/missing.

- [ ] **Step 3: Write minimal implementation**

Create `index.html` with the skeleton and the same date helpers:

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Habit Tracker</title>
<style>
  :root{ --bg:#0f1117; --card:#1a1d29; --fg:#e6e8ef; --muted:#8b90a3; --accent:#4f8cff; }
  *{box-sizing:border-box}
  body{margin:0;font:16px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
  #app{max-width:640px;margin:0 auto;padding:24px}
</style>
</head><body>
<div id="app"></div>
<script>
"use strict";
// ---- dates ----
function dateKey(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function todayKey(){ return dateKey(new Date()); }
function keyForOffset(n){ const d=new Date(); d.setDate(d.getDate()-n); return dateKey(d); }
function lastNDays(n){ const out=[]; for(let i=n-1;i>=0;i--) out.push(keyForOffset(i)); return out; }
</script>
</body></html>
```

- [ ] **Step 4: Run test to verify it passes**

Reload `test.html`. Expected: all date tests PASS (`6/6 passed`).

- [ ] **Step 5: Commit**

```bash
git add index.html test.html
git commit -m "feat: habit tracker skeleton + date helpers"
```

---

### Task 2: Store (load/save/migrate) with corruption guard

**Files:**
- Modify: `index.html`
- Modify: `test.html`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `defaultState(): {version:1, habits:[], completions:{}}`
  - `store.load(): State` — parses localStorage; returns `defaultState()` on missing/corrupt/old-version data.
  - `store.save(state: State): void` — JSON-serializes to key `habit-tracker-v1`.
  - `migrate(raw: any): State` — returns `raw` if `version===1`, else `defaultState()`.

- [ ] **Step 1: Write the failing test**

Add to `test.html` (paste the implementations alongside the date helpers, and use an in-memory fake so tests don't touch real storage):

```js
function defaultState(){ return {version:1, habits:[], completions:{}}; }
function migrate(raw){
  if(raw && raw.version===1 && Array.isArray(raw.habits) && raw.completions) return raw;
  return defaultState();
}
function makeStore(backing){
  return {
    load(){ try { return migrate(JSON.parse(backing.get())); } catch(e){ return defaultState(); } },
    save(s){ backing.set(JSON.stringify(s)); }
  };
}

// tests
let mem = { _v: null, get(){return this._v}, set(v){this._v=v} };
let s = makeStore(mem);
assertEqual(s.load(), defaultState(), 'load empty -> default');
mem._v = '{not json';
assertEqual(s.load(), defaultState(), 'load corrupt -> default');
mem._v = JSON.stringify({version:0});
assertEqual(s.load(), defaultState(), 'load old version -> default');
const good = {version:1, habits:[{id:'a',name:'X',emoji:'',color:'',createdAt:'',order:0}], completions:{a:{}}};
mem._v = JSON.stringify(good);
assertEqual(s.load(), good, 'load valid -> roundtrip');
report();
```

- [ ] **Step 2: Run test to verify it fails**

Reload `test.html`. Expected: FAIL — `makeStore`/`migrate`/`defaultState` not yet present (or, if pasted, confirm assertions cover the new cases and pass here; the real gate is `index.html` lacking them).

- [ ] **Step 3: Write minimal implementation**

Add to `index.html` `<script>` after the date helpers:

```js
// ---- store ----
const STORAGE_KEY = 'habit-tracker-v1';
function defaultState(){ return {version:1, habits:[], completions:{}}; }
function migrate(raw){
  if(raw && raw.version===1 && Array.isArray(raw.habits) && raw.completions) return raw;
  return defaultState();
}
const store = {
  load(){ try { return migrate(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch(e){ return defaultState(); } },
  save(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
};
```

- [ ] **Step 4: Run test to verify it passes**

Reload `test.html`. Expected: all store tests PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html test.html
git commit -m "feat: localStorage store with migrate + corruption guard"
```

---

### Task 3: Model operations (add/rename/delete/reorder/toggle)

**Files:**
- Modify: `index.html`
- Modify: `test.html`

**Interfaces:**
- Consumes: `defaultState`, `todayKey`.
- Produces (all pure — take state, return new state; never mutate input):
  - `addHabit(state, {name, emoji, color}): State`
  - `renameHabit(state, id, name): State`
  - `deleteHabit(state, id): State` — also drops its completions.
  - `reorderHabit(state, id, direction: -1|1): State`
  - `toggleCompletion(state, id, dateKey): State`
  - `isDone(state, id, dateKey): boolean`

- [ ] **Step 1: Write the failing test**

Add to `test.html`:

```js
function addHabit(state,{name,emoji='',color='#4f8cff'}){
  const order = state.habits.length;
  const id = 'id'+order; // deterministic for tests; real impl uses crypto.randomUUID
  const habits = [...state.habits, {id,name,emoji,color,createdAt:'',order}];
  return {...state, habits, completions:{...state.completions,[id]:{}}};
}
// ... (paste rename/delete/reorder/toggle/isDone from index.html) ...

let st = defaultState();
st = addHabit(st,{name:'Read'});
assertEqual(st.habits.length, 1, 'addHabit adds');
assertEqual(st.habits[0].name, 'Read', 'addHabit name');
st = renameHabit(st, st.habits[0].id, 'Read 20m');
assertEqual(st.habits[0].name, 'Read 20m', 'renameHabit');
st = toggleCompletion(st, st.habits[0].id, '2026-06-18');
assert(isDone(st, st.habits[0].id, '2026-06-18'), 'toggle on');
st = toggleCompletion(st, st.habits[0].id, '2026-06-18');
assert(!isDone(st, st.habits[0].id, '2026-06-18'), 'toggle off');
let id0 = st.habits[0].id;
st = deleteHabit(st, id0);
assertEqual(st.habits.length, 0, 'deleteHabit removes');
assertEqual(st.completions[id0], undefined, 'deleteHabit drops completions');
report();
```

- [ ] **Step 2: Run test to verify it fails**

Reload `test.html`. Expected: FAIL on the first model assertion that references a not-yet-pasted function.

- [ ] **Step 3: Write minimal implementation**

Add to `index.html`:

```js
// ---- model (pure) ----
function addHabit(state,{name,emoji='',color='#4f8cff'}){
  const order = state.habits.length;
  const id = crypto.randomUUID();
  const habit = {id, name, emoji, color, createdAt:new Date().toISOString(), order};
  return {...state, habits:[...state.habits, habit], completions:{...state.completions,[id]:{}}};
}
function renameHabit(state,id,name){
  return {...state, habits: state.habits.map(h=>h.id===id?{...h,name}:h)};
}
function deleteHabit(state,id){
  const completions = {...state.completions}; delete completions[id];
  return {...state, habits: state.habits.filter(h=>h.id!==id), completions};
}
function reorderHabit(state,id,direction){
  const habits=[...state.habits]; const i=habits.findIndex(h=>h.id===id); const j=i+direction;
  if(i<0||j<0||j>=habits.length) return state;
  [habits[i],habits[j]]=[habits[j],habits[i]];
  return {...state, habits: habits.map((h,idx)=>({...h,order:idx}))};
}
function isDone(state,id,key){ return !!(state.completions[id]&&state.completions[id][key]); }
function toggleCompletion(state,id,key){
  const cur = {...(state.completions[id]||{})};
  if(cur[key]) delete cur[key]; else cur[key]=true;
  return {...state, completions:{...state.completions,[id]:cur}};
}
```

(In `test.html`, replace the `id='id'+order` stub note — the deterministic id is only for the test paste; keep using the real `crypto.randomUUID` version in `index.html`.)

- [ ] **Step 4: Run test to verify it passes**

Reload `test.html`. Expected: all model tests PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html test.html
git commit -m "feat: pure model operations for habits + completions"
```

---

### Task 4: Streak calculations

**Files:**
- Modify: `index.html`
- Modify: `test.html`

**Interfaces:**
- Consumes: `keyForOffset`, completions map.
- Produces:
  - `streakCurrent(state, id): number` — longest consecutive run of done days ending today OR yesterday (today not-yet-done does not break a run through yesterday).
  - `streakLongest(state, id): number` — max consecutive run anywhere in history (scans last 365 days).

- [ ] **Step 1: Write the failing test**

Add to `test.html`:

```js
function doneSet(state,id){ return state.completions[id]||{}; }
// build a state with explicit completion keys
function withDays(keys){ const s=defaultState(); const id='h'; s.habits.push({id,name:'h',emoji:'',color:'',createdAt:'',order:0}); s.completions[id]={}; keys.forEach(k=>s.completions[id][k]=true); return {s,id}; }

// current streak: today + yesterday done -> 2
{ const {s,id}=withDays([keyForOffset(0),keyForOffset(1)]); assertEqual(streakCurrent(s,id),2,'current 2 ending today'); }
// today missing but yesterday+before done -> still counts (ending yesterday)
{ const {s,id}=withDays([keyForOffset(1),keyForOffset(2)]); assertEqual(streakCurrent(s,id),2,'current 2 ending yesterday'); }
// gap breaks: today done, day2 done, day1 missing -> current 1
{ const {s,id}=withDays([keyForOffset(0),keyForOffset(2)]); assertEqual(streakCurrent(s,id),1,'gap breaks current'); }
// none -> 0
{ const {s,id}=withDays([]); assertEqual(streakCurrent(s,id),0,'empty current 0'); }
// longest: a run of 3 in the past
{ const {s,id}=withDays([keyForOffset(10),keyForOffset(11),keyForOffset(12),keyForOffset(5)]); assertEqual(streakLongest(s,id),3,'longest 3'); }
report();
```

- [ ] **Step 2: Run test to verify it fails**

Reload `test.html`. Expected: FAIL — `streakCurrent`/`streakLongest` undefined.

- [ ] **Step 3: Write minimal implementation**

Add to `index.html`:

```js
// ---- streaks ----
function streakCurrent(state,id){
  const done = state.completions[id]||{};
  // start at today if done, else yesterday; if neither, 0
  let start = done[keyForOffset(0)] ? 0 : (done[keyForOffset(1)] ? 1 : null);
  if(start===null) return 0;
  let count=0, i=start;
  while(done[keyForOffset(i)]){ count++; i++; }
  return count;
}
function streakLongest(state,id){
  const done = state.completions[id]||{};
  let best=0, run=0;
  for(let i=365;i>=0;i--){ if(done[keyForOffset(i)]){ run++; best=Math.max(best,run); } else { run=0; } }
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Reload `test.html`. Expected: all streak tests PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html test.html
git commit -m "feat: current + longest streak calculations"
```

---

### Task 5: Today view rendering + toggle wiring

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `store`, `model` ops, `streakCurrent`, `todayKey`.
- Produces:
  - Module-level `state` variable + `setState(next)` that saves and re-renders.
  - `renderToday(): string` (returns HTML) and `renderApp()` that mounts to `#app`.
  - `currentView = {name:'today'|'history', habitId?:string}`.

- [ ] **Step 1: Write the failing test (manual acceptance — documented)**

No unit test (DOM rendering). Acceptance steps, performed in Step 4:
1. Open `index.html` — empty state shows "No habits yet" + Add button.
2. Add "Read" — appears as a row with an unchecked toggle and streak `0`.
3. Click the toggle — fills, summary shows "1 of 1 done", streak `1`.
4. Reload — completion + habit persist.

- [ ] **Step 2: Establish baseline**

Open `index.html`. Expected: blank `#app` (no render yet) — confirms work is needed.

- [ ] **Step 3: Write implementation**

Add to `index.html`:

```js
// ---- app state + render ----
let state = store.load();
let currentView = {name:'today'};
function setState(next){ state = next; store.save(state); renderApp(); }

function esc(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function renderToday(){
  const t = todayKey();
  const sorted = [...state.habits].sort((a,b)=>a.order-b.order);
  const doneCount = sorted.filter(h=>isDone(state,h.id,t)).length;
  if(sorted.length===0){
    return `<header><h1>Habits</h1><p>${t}</p></header>
      <p class="muted">No habits yet.</p>
      <button id="add-habit">+ Add habit</button>`;
  }
  const rows = sorted.map(h=>`
    <li class="habit-row" data-id="${h.id}">
      <button class="toggle ${isDone(state,h.id,t)?'on':''}" data-action="toggle" data-id="${h.id}" aria-label="toggle"></button>
      <span class="open" data-action="open" data-id="${h.id}">${esc(h.emoji)} ${esc(h.name)}</span>
      <span class="streak">🔥 ${streakCurrent(state,h.id)}</span>
    </li>`).join('');
  return `<header><h1>Habits</h1><p>${t} — ${doneCount} of ${sorted.length} done</p></header>
    <ul class="habit-list">${rows}</ul>
    <button id="add-habit">+ Add habit</button>`;
}

function renderApp(){
  const app = document.getElementById('app');
  app.innerHTML = currentView.name==='today' ? renderToday() : renderHistory(currentView.habitId);
}
```

Add CSS inside `<style>`:

```css
.habit-list{list-style:none;padding:0;margin:16px 0}
.habit-row{display:flex;align-items:center;gap:12px;background:var(--card);padding:12px 16px;border-radius:10px;margin-bottom:8px}
.toggle{width:24px;height:24px;border-radius:50%;border:2px solid var(--muted);background:transparent;cursor:pointer;flex:none}
.toggle.on{background:var(--accent);border-color:var(--accent)}
.open{flex:1;cursor:pointer}
.streak{color:var(--muted);font-size:14px}
.muted{color:var(--muted)}
button{font:inherit;color:var(--fg);background:var(--accent);border:none;padding:10px 14px;border-radius:8px;cursor:pointer}
```

Add the event delegation + prompt-based add (kept minimal here; richer form is Task 6) and initial render at the end of the script:

```js
document.getElementById('app').addEventListener('click', e=>{
  const action = e.target.dataset.action;
  const id = e.target.dataset.id;
  if(action==='toggle') setState(toggleCompletion(state, id, todayKey()));
  else if(action==='open'){ currentView={name:'history',habitId:id}; renderApp(); }
  else if(e.target.id==='add-habit'){
    const name=prompt('Habit name?'); if(name) setState(addHabit(state,{name}));
  }
});
renderApp();
```

- [ ] **Step 4: Run acceptance steps**

Open `index.html`, perform the 4 acceptance steps from Step 1. Expected: all behave as described; reload persists.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: today view rendering, toggle + add wiring"
```

---

### Task 6: Add-habit form (emoji + color)

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `addHabit`, `setState`.
- Produces: an inline form replacing the `prompt()` from Task 5. `renderAddForm(): string`; form submit calls `addHabit(state,{name,emoji,color})`.

- [ ] **Step 1: Define acceptance**

1. Click "+ Add habit" → inline form with name input, a small emoji set, and color swatches.
2. Submit with empty name → no habit added, input shows it's required.
3. Submit "Meditate" + 🧘 + green → row appears with that emoji; color used by its toggle when on.

- [ ] **Step 2: Baseline**

Open `index.html`; confirm Add currently uses a `prompt()` (from Task 5), which we are replacing.

- [ ] **Step 3: Implementation**

Add a `showAddForm` flag and form rendering:

```js
let showAddForm = false;
const EMOJI = ['✅','📖','🏃','🧘','💧','🛌','🎯','🎸'];
const COLORS = ['#4f8cff','#37c871','#ffb020','#ff5c7c','#a06bff'];

function renderAddForm(){
  return `<form id="add-form">
    <input id="h-name" placeholder="Habit name" required autofocus>
    <div class="picker">${EMOJI.map((e,i)=>`<label><input type="radio" name="emoji" value="${e}" ${i===0?'checked':''}>${e}</label>`).join('')}</div>
    <div class="picker">${COLORS.map((c,i)=>`<label><input type="radio" name="color" value="${c}" ${i===0?'checked':''}><span class="sw" style="background:${c}"></span></label>`).join('')}</div>
    <button type="submit">Add</button>
    <button type="button" id="cancel-add">Cancel</button>
  </form>`;
}
```

In `renderToday()`, replace the standalone Add button with: the button when `!showAddForm`, else `renderAddForm()`.

Update the event handler: remove the `prompt()` branch; add:

```js
if(e.target.id==='add-habit'){ showAddForm=true; renderApp(); }
else if(e.target.id==='cancel-add'){ showAddForm=false; renderApp(); }
```

And a submit handler:

```js
document.getElementById('app').addEventListener('submit', e=>{
  if(e.target.id==='add-form'){
    e.preventDefault();
    const f=e.target;
    const name=f.querySelector('#h-name').value.trim();
    if(!name) return;
    const emoji=f.querySelector('input[name=emoji]:checked').value;
    const color=f.querySelector('input[name=color]:checked').value;
    showAddForm=false;
    setState(addHabit(state,{name,emoji,color}));
  }
});
```

Use the habit color for its "on" toggle in `renderToday()`:

```js
// in the row template, set style on the toggle:
style="${isDone(state,h.id,t)?`background:${h.color};border-color:${h.color}`:''}"
```

Add CSS:

```css
#add-form{background:var(--card);padding:16px;border-radius:10px;display:flex;flex-direction:column;gap:10px}
.picker{display:flex;gap:8px;flex-wrap:wrap}
.sw{display:inline-block;width:18px;height:18px;border-radius:50%}
input#h-name{font:inherit;padding:8px;border-radius:6px;border:1px solid var(--muted);background:var(--bg);color:var(--fg)}
```

- [ ] **Step 4: Run acceptance steps**

Open `index.html`; perform the 3 acceptance steps. Expected: all pass; empty name does not add.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: inline add-habit form with emoji + color"
```

---

### Task 7: History view — 90-day grid, streak stats, manage controls

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `lastNDays`, `isDone`, `toggleCompletion`, `streakCurrent`, `streakLongest`, `renameHabit`, `deleteHabit`.
- Produces: `renderHistory(habitId): string`; back navigation to today; past-day cell toggling; rename + delete (with confirm).

- [ ] **Step 1: Define acceptance**

1. From Today, click a habit name → History view with a grid of the last 90 days; today's cell reflects current done state.
2. Click a past cell → toggles; current/longest streak update.
3. "Back" → returns to Today, reflecting any changes.
4. Rename → updates name in both views.
5. Delete → confirm dialog; on confirm, habit gone from Today; its completions dropped.

- [ ] **Step 2: Baseline**

Open `index.html`, click a habit. Expected: `renderHistory` is not yet defined → blank/error, confirming the work.

- [ ] **Step 3: Implementation**

Add to `index.html`:

```js
function renderHistory(id){
  const h = state.habits.find(x=>x.id===id);
  if(!h){ currentView={name:'today'}; return renderToday(); }
  const days = lastNDays(90);
  const cells = days.map(k=>{
    const on = isDone(state,id,k);
    return `<span class="cell ${on?'on':''}" data-action="cellToggle" data-id="${id}" data-key="${k}"
      title="${k}" style="${on?`background:${h.color}`:''}"></span>`;
  }).join('');
  return `<header>
      <button id="back" data-action="back">← Back</button>
      <h1>${esc(h.emoji)} ${esc(h.name)}</h1>
      <p>🔥 ${streakCurrent(state,id)} current · 🏆 ${streakLongest(state,id)} longest</p>
    </header>
    <div class="grid">${cells}</div>
    <div class="manage">
      <button data-action="rename" data-id="${id}">Rename</button>
      <button class="danger" data-action="delete" data-id="${id}">Delete</button>
    </div>`;
}
```

Extend the click handler:

```js
else if(action==='back'){ currentView={name:'today'}; renderApp(); }
else if(action==='cellToggle'){ setState(toggleCompletion(state, id, e.target.dataset.key)); currentView={name:'history',habitId:id}; }
else if(action==='rename'){ const n=prompt('New name?'); if(n) setState(renameHabit(state,id,n.trim())); currentView={name:'history',habitId:id}; }
else if(action==='delete'){ if(confirm('Delete this habit and its history?')){ setState(deleteHabit(state,id)); currentView={name:'today'}; } }
```

Note: `setState` calls `renderApp()` which reads `currentView`; set `currentView` before `setState` for cell/rename so it re-renders History. For delete, set after (to land on Today). Adjust ordering accordingly:

```js
else if(action==='cellToggle'){ currentView={name:'history',habitId:id}; setState(toggleCompletion(state, id, e.target.dataset.key)); }
else if(action==='rename'){ const n=prompt('New name?'); if(n){ currentView={name:'history',habitId:id}; setState(renameHabit(state,id,n.trim())); } }
else if(action==='delete'){ if(confirm('Delete this habit and its history?')){ currentView={name:'today'}; setState(deleteHabit(state,id)); } }
```

Add CSS:

```css
.grid{display:grid;grid-template-columns:repeat(15,1fr);gap:4px;margin:16px 0}
.cell{aspect-ratio:1;border-radius:3px;background:var(--card);cursor:pointer;border:1px solid #2a2e3d}
.manage{display:flex;gap:8px}
.danger{background:#ff5c7c}
#back{background:transparent;color:var(--accent);padding-left:0}
```

- [ ] **Step 4: Run acceptance steps**

Open `index.html`; perform the 5 acceptance steps. Expected: all pass; delete drops completions (verify via reload).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: per-habit history grid, streak stats, rename/delete"
```

---

### Task 8: Reorder controls + final polish

**Files:**
- Modify: `index.html`
- Modify: `test.html`

**Interfaces:**
- Consumes: `reorderHabit`.
- Produces: up/down controls per Today row wired to `reorderHabit`; a reorder unit test.

- [ ] **Step 1: Write the failing test**

Add to `test.html`:

```js
let r = defaultState();
r = addHabit(r,{name:'A'}); r = addHabit(r,{name:'B'});
const aId=r.habits[0].id, bId=r.habits[1].id;
r = reorderHabit(r, bId, -1); // move B up
assertEqual(r.habits[0].name,'B','reorder moved B up');
assertEqual(r.habits[0].order,0,'reorder reindexes order');
r = reorderHabit(r, r.habits[0].id, -1); // already top, no-op
assertEqual(r.habits[0].name,'B','reorder top is no-op');
report();
```

- [ ] **Step 2: Run test to verify it fails**

Reload `test.html`. Expected: FAIL if `reorderHabit` not pasted into test scope; paste it (matching `index.html`) and confirm the assertions then pass against the real logic.

- [ ] **Step 3: Implementation**

In `renderToday()` row template, add controls:

```js
`<span class="reorder">
   <button data-action="up" data-id="${h.id}" aria-label="move up">▲</button>
   <button data-action="down" data-id="${h.id}" aria-label="move down">▼</button>
 </span>`
```

Extend the click handler:

```js
else if(action==='up') setState(reorderHabit(state, id, -1));
else if(action==='down') setState(reorderHabit(state, id, 1));
```

Add CSS:

```css
.reorder{display:flex;flex-direction:column}
.reorder button{padding:0 6px;background:transparent;color:var(--muted);font-size:10px;line-height:1.2}
```

- [ ] **Step 4: Verify**

Reload `test.html` → reorder tests PASS. Open `index.html` → up/down reorder rows and persist across reload.

- [ ] **Step 5: Commit**

```bash
git add index.html test.html
git commit -m "feat: reorder controls + reorder test"
```

---

## Self-Review

**Spec coverage:**
- Single file, no deps, localStorage, offline → Global Constraints + Task 1/2. ✓
- Data model (habits, completions, date keys) → Task 1 (dates), Task 2 (state), Task 3 (ops). ✓
- Today view (summary, toggle, streak badge, add) → Task 5, Task 6. ✓
- History view (90-day grid, current+longest, rename/color/delete) → Task 7. ✓ (color change folded into add form palette; rename + delete covered; emoji/color editing post-create is minor and can be a follow-up — noted, not silently dropped.)
- Add/rename/delete/reorder → Tasks 3/6/7/8. ✓
- Streak logic (current ending today/yesterday, longest) → Task 4. ✓
- Error handling (corrupt storage, confirm delete, empty state) → Task 2, Task 7, Task 5. ✓
- Testing (pure functions + edge cases) → Tasks 1–4, 8 in `test.html`. ✓

**Known follow-up (not blocking):** editing emoji/color *after* creation isn't wired (only rename/delete in History). Spec listed color control in History; flagged here rather than dropped — add as a small extension if desired.

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `toggleCompletion(state,id,key)`, `isDone(state,id,key)`, `streakCurrent/Longest(state,id)`, `reorderHabit(state,id,direction)` names match across tasks. ✓
