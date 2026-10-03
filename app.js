// Daily To-Do — 24H clock + future tasks + calendar + log + midnight auto-reset
const KEY_DATE = 'dailyTodo_currentDate';
const KEY_TASKS = 'dailyTodo_tasks';
const KEY_LOG = 'dailyTodo_history';

const $ = (id) => document.getElementById(id);
const taskForm = $('taskForm'), taskInput = $('taskInput'), timeInput = $('timeInput'), dateInput = $('dateInput');
const taskList = $('taskList'), emptyMsg = $('emptyMsg');
const progressBar = $('progressBar'), progressText = $('progressText');
const logList = $('logList'), calendarEl = $('calendar'), calTitle = $('calTitle');
const futureList = $('futureList'), futureEmpty = $('futureEmpty'), futureCount = $('futureCount');

let calView = new Date();
calView.setDate(1);

function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function prettyDate(d = new Date()) {
  return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function prettyShort(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}
function daysLeft(dateKey) {
  const t = new Date(todayStr() + 'T00:00:00');
  const f = new Date(dateKey + 'T00:00:00');
  return Math.round((f - t) / 86400000);
}
function daysLeftLabel(dateKey) {
  const n = daysLeft(dateKey);
  if (n <= 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
}

// ---- Storage with migration (old tasks without date => today) ----
function loadTasks() {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY_TASKS)) || [];
    const t = todayStr();
    let changed = false;
    arr.forEach(x => { if (!x.date) { x.date = t; changed = true; } });
    if (changed) saveTasks(arr);
    return arr;
  } catch { return []; }
}
function saveTasks(t) { localStorage.setItem(KEY_TASKS, JSON.stringify(t)); }
function loadLog() { try { return JSON.parse(localStorage.getItem(KEY_LOG)) || {}; } catch { return {}; } }
function saveLog(l) { localStorage.setItem(KEY_LOG, JSON.stringify(l)); }

// ---- 24H live clock ----
function tickClock() {
  const n = new Date();
  const h = String(n.getHours()).padStart(2, '0');
  const m = String(n.getMinutes()).padStart(2, '0');
  const s = String(n.getSeconds()).padStart(2, '0');
  $('clock').textContent = `${h}:${m}:${s}`;
  $('dateLine').textContent = prettyDate(n);
  $('todayLabel').textContent = `• ${todayStr(n)}`;
  checkMidnightReset();
}
setInterval(tickClock, 1000);

// ---- Auto reset at midnight ----
// Rule: jo bhi task apni date se pehle/uss din tak pada hai (date <= today-bit?) —
// Actually: jab date badalti hai, to beeti hui dates (date < today) ke saare tasks
// (chahe done ho ya na ho) log me save hokar list se हट जाते हैं.
// Future tasks (date >= today) bane rehte hain, aur apne din aane par auto "Today" me dikhte hain.
// Isliye ✔ kiya hua future task uski date ke baad hi checkout list se हटता है.
function checkMidnightReset() {
  const today = todayStr();
  const saved = localStorage.getItem(KEY_DATE);
  if (!saved) { localStorage.setItem(KEY_DATE, today); archivePastDates(today); return; }
  if (saved !== today) {
    archivePastDates(today);
    localStorage.setItem(KEY_DATE, today);
    calView = new Date();
    calView.setDate(1);
    renderAll();
  }
}
function archivePastDates(today) {
  const tasks = loadTasks();
  const past = tasks.filter(t => t.date < today);
  if (!past.length) return;
  const log = loadLog();
  // group by date
  const byDate = {};
  past.forEach(t => { (byDate[t.date] = byDate[t.date] || []).push({ text: t.text, time: t.time || '', done: !!t.done }); });
  Object.keys(byDate).forEach(k => { log[k] = (log[k] || []).concat(byDate[k]); });
  saveLog(log);
  saveTasks(tasks.filter(t => t.date >= today)); // future + today bache rahenge
}

// ---- Render today's tasks ----
function renderTasks() {
  const today = todayStr();
  const tasks = loadTasks();
  const todays = tasks.filter(t => t.date === today);
  // purane tasks jinki date < today reh gayi ho (tab khula hi nahi) — turant archive karo
  if (tasks.some(t => t.date < today)) { archivePastDates(today); return renderAll(); }

  taskList.innerHTML = '';
  emptyMsg.style.display = todays.length ? 'none' : 'block';
  todays.forEach(t => {
    const li = document.createElement('li');
    if (t.done) li.classList.add('done');
    li.innerHTML = `
      <button class="check">${t.done ? '✔' : ''}</button>
      <span class="txt"></span>
      ${t.time ? `<span class="time-badge">⏰ ${t.time}</span>` : ''}`;
    const del = document.createElement('button');
    del.className = 'del'; del.title = 'Delete'; del.textContent = '🗑';
    li.querySelector('.txt').textContent = t.text;
    li.querySelector('.check').onclick = () => {
      t.done = !t.done;
      saveTasks(tasks); renderAll();
    };
    del.onclick = () => { saveTasks(tasks.filter(x => x.id !== t.id)); renderAll(); };
    li.appendChild(del);
    taskList.appendChild(li);
  });
  const done = todays.filter(t => t.done).length;
  progressText.textContent = `${done} / ${todays.length} done`;
  progressBar.style.width = todays.length ? (done / todays.length * 100) + '%' : '0%';
}

// ---- Render future tasks (date > today), grouped by date ----
function renderFuture() {
  const today = todayStr();
  const tasks = loadTasks();
  const future = tasks.filter(t => t.date > today).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const groups = {};
  future.forEach(t => { (groups[t.date] = groups[t.date] || []).push(t); });
  const dates = Object.keys(groups).sort();

  futureList.innerHTML = '';
  futureEmpty.style.display = dates.length ? 'none' : 'block';
  const totalDone = future.filter(t => t.done).length;
  futureCount.textContent = dates.length ? `• ${future.length} tasks (${totalDone} ✔) — ✔ wale bhi date tak rahenge` : '';

  dates.forEach(k => {
    const arr = groups[k];
    const done = arr.filter(x => x.done).length;
    const box = document.createElement('div');
    box.className = 'future-day';
    const head = document.createElement('h4');
    head.innerHTML = '';
    const title = document.createElement('span');
    title.textContent = `📅 ${k} • ${prettyShort(k)}`;
    const badge = document.createElement('span');
    badge.className = 'f-badge';
    badge.textContent = `${daysLeftLabel(k)} • ${done}/${arr.length} done`;
    head.appendChild(title); head.appendChild(badge);
    box.appendChild(head);

    const ul = document.createElement('ul');
    ul.className = 'task-list';
    arr.forEach(t => {
      const li = document.createElement('li');
      if (t.done) li.classList.add('done');
      const check = document.createElement('button');
      check.className = 'check'; check.textContent = t.done ? '✔' : '';
      check.title = 'Complete hone par bhi date tak yahi rahega';
      const txt = document.createElement('span');
      txt.className = 'txt'; txt.textContent = t.text;
      li.appendChild(check); li.appendChild(txt);
      if (t.time) {
        const tb = document.createElement('span');
        tb.className = 'time-badge'; tb.textContent = `⏰ ${t.time}`;
        li.appendChild(tb);
      }
      const todayBtn = document.createElement('button');
      todayBtn.className = 'mini-btn'; todayBtn.title = 'Aaj me lao'; todayBtn.textContent = '⇦ today';
      const del = document.createElement('button');
      del.className = 'del'; del.title = 'Delete'; del.textContent = '🗑';
      check.onclick = () => { t.done = !t.done; saveTasks(tasks); renderAll(); };
      del.onclick = () => { saveTasks(tasks.filter(x => x.id !== t.id)); renderAll(); };
      todayBtn.onclick = () => { t.date = todayStr(); saveTasks(tasks); renderAll(); };
      li.appendChild(todayBtn); li.appendChild(del);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    futureList.appendChild(box);
  });
}

// ---- Render calendar (log dots + future dots + click to pick date) ----
function renderCalendar() {
  const log = loadLog();
  const tasks = loadTasks();
  const futureDates = new Set(tasks.filter(t => t.date > todayStr()).map(t => t.date));
  const y = calView.getFullYear(), m = calView.getMonth();
  calTitle.textContent = calView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = todayStr();
  calendarEl.innerHTML = '';
  for (let i = 0; i < firstDay; i++) {
    const d = document.createElement('div'); d.className = 'dim'; d.textContent = ''; calendarEl.appendChild(d);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    el.innerHTML = `<span>${d}</span>`;
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (key === today) el.classList.add('today');
    if (log[key] && log[key].length) { el.classList.add('has-log'); el.title = `${log[key].filter(x => x.done).length}/${log[key].length} done (log)`; }
    if (futureDates.has(key)) {
      el.classList.add('has-future');
      const c = tasks.filter(t => t.date === key).length;
      el.title = (el.title ? el.title + ' | ' : '') + `${c} future task(s) — click karo`;
    }
    if (key >= today) {
      el.classList.add('pickable');
      el.onclick = () => {
        dateInput.value = key;
        taskInput.focus();
        taskInput.placeholder = `Task for ${key}...`;
      };
    }
    calendarEl.appendChild(el);
  }
}

// ---- Render log ----
function renderLog() {
  const log = loadLog();
  const keys = Object.keys(log).sort().reverse();
  logList.innerHTML = '';
  if (!keys.length) { logList.innerHTML = '<p class="log-empty">No logs yet. Tasks will be saved here every night at 12 AM.</p>'; return; }
  keys.slice(0, 30).forEach(k => {
    const arr = log[k];
    const done = arr.filter(x => x.done).length;
    const box = document.createElement('div');
    box.className = 'log-day';
    const ul = arr.map(x => `<li class="${x.done ? 'ok' : 'no'}">${x.time ? x.time + ' • ' : ''}${escapeHtml(x.text)}</li>`).join('');
    box.innerHTML = `<h4>📅 ${k} <span>${done}/${arr.length} done</span></h4><ul>${ul}</ul>`;
    logList.appendChild(box);
  });
}
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function renderAll() { renderTasks(); renderFuture(); renderCalendar(); renderLog(); }

// ---- Events ----
function initDateInput() {
  const t = todayStr();
  dateInput.value = t;
  dateInput.min = t; // beete din me add nahi
}

taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  const today = todayStr();
  let date = dateInput.value || today;
  if (date < today) date = today; // safety: past me nahi
  const tasks = loadTasks();
  tasks.push({ id: Date.now(), text, time: timeInput.value, date, done: false });
  saveTasks(tasks);
  taskInput.value = ''; timeInput.value = '';
  initDateInput();
  taskInput.placeholder = 'Write your task... e.g. Gym at 7 AM';
  taskInput.focus();
  renderAll();
  if (date > today) alert(`Future task saved for ${date} (${daysLeftLabel(date)})! ✔ hone par bhi date tak list me rahega.`);
});

$('clearDoneBtn').onclick = () => {
  // sirf AAJ ke completed हटाओ — future ✔ wale apni date tak rahenge
  const today = todayStr();
  saveTasks(loadTasks().filter(t => !(t.date === today && t.done)));
  renderAll();
};
$('clearFutureDoneBtn').onclick = () => {
  // beeti date ka kuch bacha ho to archive karo, future ✔ ko haath mat lagao
  archivePastDates(todayStr());
  renderAll();
};
$('checkoutBtn').onclick = () => {
  // Day Checkout = aaj ke saare tasks done + aaj ka log save (future ko touch nahi)
  const today = todayStr();
  const tasks = loadTasks().map(t => (t.date === today ? { ...t, done: true } : t));
  saveTasks(tasks);
  const todays = tasks.filter(t => t.date === today);
  const log = loadLog();
  log[today] = todays.map(t => ({ text: t.text, time: t.time || '', done: true }));
  saveLog(log);
  renderAll();
  alert('Day Checkout complete! Aaj ka log saved. Future tasks apni date tak bane rahenge.');
};
$('clearLogBtn').onclick = () => {
  if (!confirm('Delete the entire history log?')) return;
  saveLog({}); renderAll();
};
$('prevMonth').onclick = () => { calView.setMonth(calView.getMonth() - 1); renderCalendar(); };
$('nextMonth').onclick = () => { calView.setMonth(calView.getMonth() + 1); renderCalendar(); };

initDateInput();
tickClock();
checkMidnightReset();
renderAll();
