'use strict';
/*
 * plans-server.js — the live "all my plans" dashboard server.
 *
 * Zero dependencies (Node built-ins only): http, fs, path, url + ./plans-registry.
 * Reads files fresh on every request, so the view is always current.
 *
 *   GET /            → mobile-first dashboard; cards built from each plan's live
 *                      #plan-state, sorted newest-first (by file mtime).
 *   GET /plan/:id    → that plan's HTML straight from disk. Its own 4s self-reload
 *                      re-requests this URL, so the full plan stays live over HTTP.
 *   GET /api/plans   → JSON status feed the dashboard polls to refresh cards.
 *
 * Run:  node plans-server.js          (PLANS_PORT env overrides the default port)
 * Expose privately:  tailscale serve --bg <port>
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const urlmod = require('url');
const reg = require('./plans-registry');

// Port precedence: first CLI arg (used by the auto-start task) → PLANS_PORT env → default.
const PORT = parseInt(process.argv[2], 10) || parseInt(process.env.PLANS_PORT, 10) || 7878;

// ── Read a plan file → status snapshot (no status is stored in the registry) ──
function snapshot(entry) {
  let raw, mtime;
  try {
    mtime = fs.statSync(entry.path).mtimeMs;
    raw = fs.readFileSync(entry.path, 'utf8');
  } catch (e) { return null; }                       // file gone → caller filters out

  let state = {};
  const m = raw.match(/<script id="plan-state"[^>]*>([\s\S]*?)<\/script>/i);
  if (m) { try { state = JSON.parse(m[1]); } catch (e) { state = {}; } }

  const status = (state.status && typeof state.status === 'object') ? state.status : {};
  const ids = Object.keys(status);
  const total = ids.length;
  const done = ids.filter(function (id) { return status[id] === 'done'; }).length;
  const doing = ids.find(function (id) { return status[id] === 'doing'; }) || null;
  const pct = total ? Math.round(done / total * 100) : 0;

  let waiting = null;
  if (state.waiting) waiting = typeof state.waiting === 'string' ? state.waiting : (state.waiting.question || null);

  // Friendly label for the in-progress phase (its <h2> text, sans the muted-tail).
  let doingTitle = null;
  if (doing) {
    const mm = raw.match(new RegExp('id="' + doing + '"[\\s\\S]*?<h2>([^<]+)', 'i'));
    if (mm) doingTitle = mm[1].trim();
  }

  return {
    id: entry.id, title: entry.title, project: entry.project,
    total: total, done: done, pct: pct,
    doing: doing, doingTitle: doingTitle, waiting: waiting,
    allDone: total > 0 && done === total,
    archived: !!entry.archived,
    mtime: Math.round(mtime)
  };
}

function allPlans() {
  return reg.readRegistry()
    .map(snapshot)
    .filter(Boolean)
    .sort(function (a, b) { return b.mtime - a.mtime; });   // newest first
}

// ── Dashboard page (mobile-first). Cards rendered client-side from injected JSON, then live-polled. ──
function dashboardHtml(plans) {
  return '<!DOCTYPE html>\n'
+ '<html lang="en" data-theme="dark">\n'
+ '<head>\n'
+ '<meta charset="UTF-8">\n'
+ '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n'
+ '<title>My Plans</title>\n'
+ '<style>\n'
+ ':root{--bg:#0b0d12;--panel:#14171f;--panel-2:#1a1e28;--border:#272c38;--border-soft:#1f2430;--text:#e8ebf2;--muted:#98a2b6;--faint:#6b7488;--accent:#56b6ff;--accent-2:#8b7bff;--cyan:#34d3c4;--green:#45c463;--amber:#e0a93b;}\n'
+ 'html[data-theme="light"]{--bg:#f5f6f9;--panel:#fff;--panel-2:#f0f2f6;--border:#dde1e9;--border-soft:#e7eaf0;--text:#1a1e28;--muted:#5a6478;--faint:#8b93a4;--accent:#1f7fd6;--accent-2:#6b54e6;--cyan:#129f92;--green:#2e9e4a;--amber:#b9801b;}\n'
+ '*{box-sizing:border-box;}\n'
+ 'body{margin:0;background:var(--bg);color:var(--text);font:15.5px/1.6 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);}\n'
+ '.wrap{max-width:1100px;margin:0 auto;padding:22px 18px 60px;}\n'
+ 'header.top{display:flex;align-items:center;gap:12px;margin:6px 0 18px;}\n'
+ 'header.top h1{font-size:22px;letter-spacing:-.3px;margin:0;font-weight:700;flex:1;min-width:0;}\n'
+ 'header.top .dot{width:9px;height:9px;border-radius:50%;background:var(--cyan);box-shadow:0 0 10px var(--cyan);flex:none;}\n'
+ '.sub{color:var(--faint);font-family:ui-monospace,monospace;font-size:12px;margin:-10px 0 20px 21px;}\n'
+ '.theme-btn{cursor:pointer;font:inherit;font-size:12px;color:var(--muted);background:var(--panel);border:1px solid var(--border-soft);border-radius:8px;padding:8px 12px;flex:none;}\n'
+ '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(290px,100%),1fr));gap:14px;}\n'
+ '.card{display:block;min-width:0;text-decoration:none;color:inherit;background:var(--panel);border:1px solid var(--border-soft);border-left:3px solid var(--accent-2);border-radius:14px;padding:16px 18px;box-shadow:0 1px 2px rgba(0,0,0,.35),0 8px 24px rgba(0,0,0,.18);transition:transform .14s,border-color .14s;}\n'
+ '.card:active{transform:scale(.99);}\n'
+ '@media(hover:hover){.card:hover{transform:translateY(-2px);border-left-color:var(--accent);}}\n'
+ '.card.done{border-left-color:var(--green);}\n'
+ '.card.waiting{border-left-color:var(--amber);}\n'
+ '.cardwrap{position:relative;min-width:0;}\n'
+ '.card.archived{opacity:.6;border-left-color:var(--faint);}\n'
+ '.arch-btn{position:absolute;top:10px;right:10px;z-index:2;cursor:pointer;font:inherit;font-size:11px;line-height:1;color:var(--muted);background:color-mix(in srgb,var(--panel-2) 88%,transparent);border:1px solid var(--border);border-radius:8px;padding:5px 9px;opacity:0;transition:opacity .14s,color .14s,border-color .14s;}\n'
+ '.cardwrap:hover .arch-btn,.arch-btn:focus{opacity:1;}\n'
+ '.arch-btn:hover{color:var(--text);border-color:var(--accent);}\n'
+ '.arch-btn[disabled]{opacity:.5;cursor:default;}\n'
+ '@media(hover:none){.arch-btn{opacity:1;}}\n'
+ '.arch-toggle{display:none;margin:24px 0 2px;cursor:pointer;font:inherit;font-size:13px;color:var(--muted);background:var(--panel);border:1px solid var(--border-soft);border-radius:9px;padding:9px 15px;}\n'
+ '.arch-toggle:hover{color:var(--text);border-color:var(--border);}\n'
+ '.arch-toggle.show{display:inline-block;}\n'
+ '.arch-label{margin:16px 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--faint);font-family:ui-monospace,monospace;}\n'
+ '.proj{display:inline-block;font-family:ui-monospace,monospace;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--cyan);background:color-mix(in srgb,var(--cyan) 12%,transparent);border:1px solid color-mix(in srgb,var(--cyan) 30%,transparent);padding:2px 8px;border-radius:999px;}\n'
+ '.ctitle{font-size:16.5px;font-weight:650;margin:11px 0 12px;line-height:1.3;overflow-wrap:anywhere;word-break:break-word;}\n'
+ '.row{display:flex;align-items:center;gap:12px;}\n'
+ '.ring{--pct:0;position:relative;width:42px;height:42px;border-radius:50%;flex:none;background:conic-gradient(var(--green) calc(var(--pct)*1%),var(--panel-2) 0);display:grid;place-items:center;}\n'
+ '.ring::after{content:"";position:absolute;inset:5px;border-radius:50%;background:var(--panel);}\n'
+ '.ring span{position:relative;z-index:1;font-size:10.5px;font-weight:700;}\n'
+ '.meta{min-width:0;flex:1;}\n'
+ '.state{font-size:13px;font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n'
+ '.state.todo{color:var(--muted);}.state.doing{color:var(--amber);}.state.done{color:var(--green);}.state.waiting{color:var(--amber);}\n'
+ '.count{font-family:ui-monospace,monospace;font-size:11.5px;color:var(--faint);}\n'
+ '.ago{font-family:ui-monospace,monospace;font-size:11px;color:var(--faint);margin-top:10px;display:block;}\n'
+ '.empty{text-align:center;color:var(--muted);padding:60px 20px;}\n'
+ '.empty code{background:var(--panel-2);border:1px solid var(--border-soft);padding:2px 7px;border-radius:6px;font-size:.85em;}\n'
+ '.live{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:700;letter-spacing:.12em;color:var(--green);font-family:ui-monospace,monospace;flex:none;}\n'
+ '.live i{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);}\n'
+ '@media(max-width:560px){.wrap{padding:18px 14px 50px;}.grid{grid-template-columns:1fr;gap:12px;}header.top h1{font-size:20px;}}\n'
+ '</style>\n'
+ '<script>try{var _t=localStorage.getItem("plans-dash-theme");if(_t)document.documentElement.setAttribute("data-theme",_t);}catch(e){}</script>\n'
+ '</head>\n<body>\n'
+ '<div class="wrap">\n'
+ '<header class="top"><span class="dot"></span><h1>My Plans</h1><span class="live"><i></i>LIVE</span>'
+ '<button class="theme-btn" id="theme">◐ Theme</button></header>\n'
+ '<div class="sub" id="sub"></div>\n'
+ '<div class="grid" id="grid"></div>\n'
+ '<button class="arch-toggle" id="archToggle"></button>\n'
+ '<div class="arch-label" id="archLabel" style="display:none">Archived</div>\n'
+ '<div class="grid" id="archGrid" style="display:none"></div>\n'
+ '</div>\n'
+ '<script>\n'
+ 'var BOOT=' + JSON.stringify(plans) + ';\n'
+ 'function ago(ms){var s=(Date.now()-ms)/1000;if(s<45)return"just now";var m=s/60;if(m<60)return Math.floor(m)+"m ago";var h=m/60;if(h<24)return Math.floor(h)+"h ago";return Math.floor(h/24)+"d ago";}\n'
+ 'function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c];});}\n'
+ 'function stateOf(p){if(p.waiting)return{cls:"waiting",label:"⏳ "+p.waiting};if(p.allDone)return{cls:"done",label:"✓ Complete"};if(p.doing)return{cls:"doing",label:"◐ "+(p.doingTitle||p.doing)};if(p.total===0)return{cls:"todo",label:"Not started"};if(p.done>0)return{cls:"doing",label:"In progress"};return{cls:"todo",label:"To do"};}\n'
+ 'function cardHtml(p){var s=stateOf(p);var cardCls="card"+(p.allDone?" done":"")+(p.waiting?" waiting":"")+(p.archived?" archived":"");\n'
+ 'var a=\'<a class="\'+cardCls+\'" href="/plan/\'+encodeURIComponent(p.id)+\'">\'\n'
+ '+\'<span class="proj">\'+esc(p.project)+\'</span>\'\n'
+ '+\'<div class="ctitle">\'+esc(p.title)+\'</div>\'\n'
+ '+\'<div class="row"><div class="ring" style="--pct:\'+p.pct+\'"><span>\'+p.pct+\'%</span></div>\'\n'
+ '+\'<div class="meta"><span class="state \'+s.cls+\'">\'+esc(s.label)+\'</span>\'\n'
+ '+\'<span class="count">\'+p.done+\' / \'+p.total+\' phases</span></div></div>\'\n'
+ '+\'<span class="ago" data-mtime="\'+p.mtime+\'">updated \'+ago(p.mtime)+\'</span></a>\';\n'
+ 'var btn=\'<button class="arch-btn" data-id="\'+encodeURIComponent(p.id)+\'" data-arch="\'+(p.archived?"0":"1")+\'">\'+(p.archived?"↩ Unarchive":"⠿ Archive")+\'</button>\';\n'
+ 'return \'<div class="cardwrap">\'+a+btn+\'</div>\';}\n'
+ 'var LAST=[];var showArch=false;try{showArch=localStorage.getItem("plans-dash-show-archived")==="1";}catch(e){}\n'
+ 'function render(plans){LAST=plans;var active=plans.filter(function(p){return !p.archived;});var arch=plans.filter(function(p){return p.archived;});\n'
+ 'document.getElementById("sub").textContent=active.length+" plan"+(active.length===1?"":"s")+" across your projects · newest first";\n'
+ 'var g=document.getElementById("grid");\n'
+ 'if(!plans.length){g.innerHTML=\'<div class="empty">No plans registered yet.<br><br>Make a plan with the skill, or run <code>node plans-registry.js add &lt;plan.html&gt;</code>.</div>\';}\n'
+ 'else if(!active.length){g.innerHTML=\'<div class="empty">No active plans — all archived.</div>\';}\n'
+ 'else{g.innerHTML=active.map(cardHtml).join("");}\n'
+ 'var t=document.getElementById("archToggle"),lbl=document.getElementById("archLabel"),ag=document.getElementById("archGrid");\n'
+ 'if(arch.length){t.classList.add("show");t.textContent=(showArch?"▾ Hide archived (":"▸ Show archived (")+arch.length+")";\n'
+ 'if(showArch){lbl.style.display="block";ag.style.display="";ag.innerHTML=arch.map(cardHtml).join("");}else{lbl.style.display="none";ag.style.display="none";ag.innerHTML="";}}\n'
+ 'else{t.classList.remove("show");lbl.style.display="none";ag.style.display="none";ag.innerHTML="";}}\n'
+ 'render(BOOT);\n'
+ 'function refresh(){fetch("/api/plans",{cache:"no-store"}).then(function(r){return r.json();}).then(function(d){render(d.plans||[]);}).catch(function(){});}\n'
+ 'setInterval(refresh,5000);\n'
+ 'document.addEventListener("visibilitychange",function(){if(!document.hidden)refresh();});\n'
+ 'document.getElementById("theme").onclick=function(){var n=document.documentElement.getAttribute("data-theme")==="light"?"dark":"light";document.documentElement.setAttribute("data-theme",n);try{localStorage.setItem("plans-dash-theme",n);}catch(e){}};\n'
+ 'document.getElementById("archToggle").onclick=function(){showArch=!showArch;try{localStorage.setItem("plans-dash-show-archived",showArch?"1":"0");}catch(e){}render(LAST);};\n'
+ 'document.addEventListener("click",function(e){var b=e.target.closest?e.target.closest(".arch-btn"):null;if(!b)return;e.preventDefault();e.stopPropagation();\n'
+ 'var id=decodeURIComponent(b.getAttribute("data-id"));var archived=b.getAttribute("data-arch")==="1";b.disabled=true;\n'
+ 'fetch("/api/archive",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:id,archived:archived})}).then(function(r){return r.json();}).then(function(d){if(d&&d.plans){render(d.plans);}else{b.disabled=false;}}).catch(function(){b.disabled=false;});});\n'
+ '</script>\n</body>\n</html>';
}

// ── HTTP ──
function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

// Read a request body (capped) then JSON.parse it. Calls cb(err, obj).
function readJsonBody(req, cb) {
  let data = '';
  let tooBig = false;
  req.on('data', function (chunk) {
    data += chunk;
    if (data.length > 1e5) { tooBig = true; req.destroy(); }   // 100 KB cap
  });
  req.on('end', function () {
    if (tooBig) return cb(new Error('body too large'));
    try { cb(null, JSON.parse(data || '{}')); }
    catch (e) { cb(e); }
  });
  req.on('error', function (e) { cb(e); });
}

const server = http.createServer(function (req, res) {
  const pathname = decodeURIComponent(urlmod.parse(req.url).pathname || '/');

  // ── Write route (the only one): archive / unarchive a plan in the registry ──
  if (pathname === '/api/archive') {
    if (req.method !== 'POST') return send(res, 405, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'method-not-allowed' }));
    return readJsonBody(req, function (err, body) {
      if (err || !body || typeof body.id !== 'string' || typeof body.archived !== 'boolean') {
        return send(res, 400, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'bad-request' }));
      }
      const r = reg.setArchived(body.id, body.archived);
      if (!r.ok) {
        const code = r.reason === 'unknown-id' ? 404 : 409;   // 409 when feature off (registry absent)
        return send(res, code, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: r.reason }));
      }
      return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ ok: true, now: Date.now(), plans: allPlans() }));
    });
  }

  if (pathname === '/' || pathname === '/index.html') {
    return send(res, 200, 'text/html; charset=utf-8', dashboardHtml(allPlans()));
  }

  if (pathname === '/api/plans') {
    return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ now: Date.now(), plans: allPlans() }));
  }

  if (pathname.indexOf('/plan/') === 0) {
    const id = pathname.slice('/plan/'.length);
    const entry = reg.readRegistry().find(function (e) { return e.id === id; });
    if (!entry) return send(res, 404, 'text/html; charset=utf-8', '<h1>404</h1><p>Unknown plan.</p><p><a href="/">← all plans</a></p>');
    let html;
    try { html = fs.readFileSync(entry.path, 'utf8'); }
    catch (e) { return send(res, 410, 'text/html; charset=utf-8', '<h1>410</h1><p>Plan file is gone.</p><p><a href="/">← all plans</a></p>'); }
    return send(res, 200, 'text/html; charset=utf-8', html);
  }

  send(res, 404, 'text/plain; charset=utf-8', 'Not found');
});

server.listen(PORT, function () {
  console.log('Plans dashboard server on http://localhost:' + PORT);
  console.log('Expose privately:  tailscale serve --bg ' + PORT);
});
