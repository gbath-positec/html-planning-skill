// Todo app — vanilla JS. Built phase by phase per Plans/todo-app-plan.html.
'use strict';

const $list = document.getElementById('list');
const $form = document.getElementById('new-form');
const $input = document.getElementById('new-input');
const $count = document.getElementById('count');
const $filters = document.getElementById('filters');

const STORAGE_KEY = 'todos';

// Phase 2 — data model + storage. One in-memory array is the source of truth; localStorage mirrors it.
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

let todos = load();   // [{ id, text, done }]
let filter = 'all';   // 'all' | 'active' | 'completed' (used from Phase 5)

// Phase 5 — filter predicate.
function matches(todo) {
  if (filter === 'active') return !todo.done;
  if (filter === 'completed') return todo.done;
  return true;
}

// Phase 3 — render + add. (Phase 5 adds filtering + count + empty state.)
function render() {
  $list.innerHTML = '';
  const visible = todos.filter(matches);
  for (const todo of visible) {
    const li = document.createElement('li');
    li.className = 'item' + (todo.done ? ' done' : '');
    li.dataset.id = todo.id;
    li.innerHTML =
      '<input type="checkbox" class="toggle"' + (todo.done ? ' checked' : '') + ' aria-label="Toggle complete">' +
      '<span class="text"></span>' +
      '<button class="del" aria-label="Delete">✕</button>';
    li.querySelector('.text').textContent = todo.text;   // textContent = XSS-safe
    $list.appendChild(li);
  }
  if (!visible.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = todos.length ? 'Nothing here for this filter.' : 'No todos yet — add one above.';
    $list.appendChild(empty);
  }
  const left = todos.filter(function (t) { return !t.done; }).length;
  $count.textContent = left + (left === 1 ? ' item left' : ' items left');
}

// Phase 5 — filter buttons.
$filters.addEventListener('click', function (e) {
  const btn = e.target.closest('.filter');
  if (!btn) return;
  filter = btn.dataset.filter;
  for (const b of $filters.querySelectorAll('.filter')) b.classList.toggle('active', b === btn);
  render();
});

function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  todos.push({ id: String(Date.now()) + Math.random().toString(16).slice(2, 6), text: trimmed, done: false });
  save();
  render();
}

$form.addEventListener('submit', function (e) {
  e.preventDefault();
  addTodo($input.value);
  $input.value = '';
  $input.focus();
});

// Phase 4 — toggle + delete via one delegated listener (survives re-renders).
$list.addEventListener('click', function (e) {
  const li = e.target.closest('.item');
  if (!li) return;
  const id = li.dataset.id;
  if (e.target.classList.contains('toggle')) {
    const t = todos.find(function (x) { return x.id === id; });
    if (t) { t.done = !t.done; save(); render(); }
  } else if (e.target.classList.contains('del')) {
    todos = todos.filter(function (x) { return x.id !== id; });
    save(); render();
  }
});

render();   // initial paint
