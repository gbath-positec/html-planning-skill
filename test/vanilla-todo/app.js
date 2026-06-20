'use strict';
(function () {
  // ── State & persistence ──────────────────────────────────────────────
  var STORAGE_KEY = 'vanilla-todos';
  var todos = load();           // [{ id, text, done }]
  var currentFilter = 'all';    // 'all' | 'active' | 'done'
  var idCounter = 0;

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (e) { /* storage full / unavailable — keep running in-memory */ }
  }

  // Unique id without Date.now(): monotonic counter + a base36 suffix.
  function nextId() {
    idCounter += 1;
    return 't' + idCounter.toString(36) + '-' + (todos.length).toString(36);
  }

  // ── Mutators (each persists + re-renders) ────────────────────────────
  function addTodo(text) {
    todos.push({ id: nextId(), text: text, done: false });
    save();
    render();
  }

  function toggle(id) {
    var t = todos.find(function (x) { return x.id === id; });
    if (t) { t.done = !t.done; save(); render(); }
  }

  function remove(id) {
    todos = todos.filter(function (x) { return x.id !== id; });
    save();
    render();
  }

  function clearDone() {
    todos = todos.filter(function (x) { return !x.done; });
    save();
    render();
  }

  // ── DOM refs ─────────────────────────────────────────────────────────
  var form = document.getElementById('add-form');
  var input = document.getElementById('add-input');
  var list = document.getElementById('list');
  var empty = document.getElementById('empty');
  var count = document.getElementById('count');
  var clearBtn = document.getElementById('clear-done');
  var filterBtns = [].slice.call(document.querySelectorAll('.filter'));

  // ── Render: rebuild the list from state ──────────────────────────────
  function visible() {
    if (currentFilter === 'active') return todos.filter(function (t) { return !t.done; });
    if (currentFilter === 'done') return todos.filter(function (t) { return t.done; });
    return todos;
  }

  function render() {
    list.innerHTML = '';
    var rows = visible();

    rows.forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'item' + (t.done ? ' done' : '');
      li.dataset.id = t.id;

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = t.done;
      cb.setAttribute('aria-label', 'Toggle ' + t.text);

      var span = document.createElement('span');
      span.className = 'text';
      span.textContent = t.text;

      var del = document.createElement('button');
      del.className = 'del';
      del.type = 'button';
      del.textContent = '×';
      del.setAttribute('aria-label', 'Delete ' + t.text);

      li.appendChild(cb);
      li.appendChild(span);
      li.appendChild(del);
      list.appendChild(li);
    });

    // Empty state: only when there are no todos at all.
    empty.hidden = todos.length !== 0;

    var left = todos.filter(function (t) { return !t.done; }).length;
    count.textContent = left + (left === 1 ? ' item left' : ' items left');
  }

  // ── Events ───────────────────────────────────────────────────────────
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    addTodo(text);
    input.value = '';
    input.focus();
  });

  // One delegated listener handles toggle + delete.
  list.addEventListener('click', function (e) {
    var li = e.target.closest('.item');
    if (!li) return;
    var id = li.dataset.id;
    if (e.target.matches('input[type="checkbox"]')) toggle(id);
    else if (e.target.matches('.del')) remove(id);
  });

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentFilter = btn.dataset.filter;
      filterBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
      render();
    });
  });

  clearBtn.addEventListener('click', clearDone);

  // ── Init ─────────────────────────────────────────────────────────────
  render();
})();
