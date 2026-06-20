'use strict';
/*
 * plans-registry.js — central registry of rich-html-plans across all your projects.
 *
 * Stores ONLY locations: { id, title, project, path }. Status is never stored here —
 * the server reads each file's live #plan-state at request time, so the dashboard is
 * never stale. The registry FILE's existence is the feature switch: when
 * ~/.claude/plans-index.json is absent, `add` is a harmless no-op and the skill behaves
 * exactly as it did before anyone opted in.
 *
 * Zero dependencies (Node built-ins only). Usable two ways:
 *   • as a module  — require('./plans-registry') for the server's reads/prune
 *   • as a CLI     — node plans-registry.js init | add <plan.html> | prune | list
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const REGISTRY = path.join(os.homedir(), '.claude', 'plans-index.json');

function registryExists() { return fs.existsSync(REGISTRY); }

function readRegistry() {
  try {
    const j = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
    return Array.isArray(j) ? j.filter(function (e) { return e && e.path; }) : [];
  } catch (e) { return []; }
}

function writeRegistry(list) {
  fs.mkdirSync(path.dirname(REGISTRY), { recursive: true });
  fs.writeFileSync(REGISTRY, JSON.stringify(list, null, 2) + '\n');
}

// Derive { id, title, project, path } from a plan file path.
//   id      = file basename without the -plan.html suffix
//   title   = the <title> of the HTML (falls back to id)
//   project = the repo folder that contains Plans/ (i.e. the parent of the Plans dir)
function deriveMeta(planPath) {
  const abs = path.resolve(planPath);
  const id = path.basename(abs).replace(/-plan\.html$/i, '').replace(/\.html$/i, '');
  const plansDir = path.dirname(abs);                       // .../<repo>/Plans
  const project = path.basename(path.dirname(plansDir)) || path.basename(plansDir);
  let title = id;
  try {
    const m = fs.readFileSync(abs, 'utf8').match(/<title>([^<]*)<\/title>/i);
    if (m && m[1].trim()) title = m[1].trim();
  } catch (e) { /* keep id as title */ }
  return { id: id, title: title, project: project, path: abs };
}

// Upsert by absolute path. GATED: no-op when the registry file is absent (feature off).
function add(planPath) {
  if (!registryExists()) return { ok: false, reason: 'registry-absent' };
  const meta = deriveMeta(planPath);
  const list = readRegistry();
  const i = list.findIndex(function (e) { return path.resolve(e.path) === meta.path; });
  if (i >= 0) list[i] = Object.assign({}, list[i], meta);
  else list.push(meta);
  writeRegistry(list);
  return { ok: true, entry: meta, count: list.length };
}

// Set/clear the `archived` flag on a plan by id. GATED like add(); no-op when the
// registry is absent. Returns { ok, entry } or { ok:false, reason }.
function setArchived(id, archived) {
  if (!registryExists()) return { ok: false, reason: 'registry-absent' };
  const list = readRegistry();
  const i = list.findIndex(function (e) { return e.id === id; });
  if (i < 0) return { ok: false, reason: 'unknown-id' };
  if (archived) list[i].archived = true;
  else delete list[i].archived;           // absent === active; keep entries clean
  writeRegistry(list);
  return { ok: true, entry: list[i] };
}

// Drop entries whose file no longer exists. Returns the surviving list.
function prune() {
  if (!registryExists()) return [];
  const list = readRegistry().filter(function (e) { return fs.existsSync(e.path); });
  writeRegistry(list);
  return list;
}

module.exports = { REGISTRY, registryExists, readRegistry, writeRegistry, deriveMeta, add, setArchived, prune };

// ── CLI ──
if (require.main === module) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const arg = argv[1];
  if (cmd === 'init') {
    if (registryExists()) console.log('already enabled: ' + REGISTRY);
    else { writeRegistry([]); console.log('created (feature enabled): ' + REGISTRY); }
  } else if (cmd === 'add') {
    if (!arg) { console.error('usage: node plans-registry.js add <plan.html>'); process.exit(2); }
    const r = add(arg);
    if (!r.ok && r.reason === 'registry-absent') {
      console.log('plans-index.json not found — dashboard feature is off; skipping register.');
      process.exit(0);
    }
    console.log('registered: ' + r.entry.title + '  [' + r.entry.project + ']  (' + r.count + ' total)');
  } else if (cmd === 'archive' || cmd === 'unarchive') {
    if (!arg) { console.error('usage: node plans-registry.js ' + cmd + ' <id>'); process.exit(2); }
    const r = setArchived(arg, cmd === 'archive');
    if (!r.ok && r.reason === 'registry-absent') {
      console.log('plans-index.json not found — dashboard feature is off; nothing to do.');
      process.exit(0);
    }
    if (!r.ok && r.reason === 'unknown-id') { console.error('no plan with id: ' + arg); process.exit(1); }
    console.log((cmd === 'archive' ? 'archived: ' : 'unarchived: ') + r.entry.title);
  } else if (cmd === 'prune') {
    console.log('pruned; ' + prune().length + ' live entries');
  } else if (cmd === 'list') {
    console.log(readRegistry().map(function (e) {
      return (e.archived ? '[archived] ' : '           ') + e.id + '  —  ' + e.title;
    }).join('\n') || '(empty)');
  } else {
    console.error('commands: init | add <plan.html> | archive <id> | unarchive <id> | prune | list');
    process.exit(2);
  }
}
