// Daily To-Do — 24H clock + future tasks + calendar + log + midnight auto-reset
const KEY_DATE = 'dailyTodo_currentDate';
const KEY_TASKS = 'dailyTodo_tasks';
const KEY_LOG = 'dailyTodo_history';
const KEY_CAL = 'dailyTodo_calView';
const KEY_SHARES = 'dailyTodo_shares';
const KEY_IMPORTED = 'dailyTodo_importedSids';

const $ = (id) => document.getElementById(id);
const taskForm = $('taskForm'), taskInput = $('taskInput'), timeInput = $('timeInput'), dateInput = $('dateInput');
const taskList = $('taskList'), emptyMsg = $('emptyMsg');
const progressBar = $('progressBar'), progressText = $('progressText');
const logList = $('logList'), calendarEl = $('calendar'), calTitle = $('calTitle');
const futureList = $('futureList'), futureEmpty = $('futureEmpty'), futureCount = $('futureCount');

// ---- Calendar view (month) persistence: refresh par month reset/“vanish” na lage ----
function loadCalView() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY_CAL));
    if (o && Number.isInteger(o.y) && Number.isInteger(o.m) && o.m >= 0 && o.m <= 11) {
      return new Date(o.y, o.m, 1);
    }
  } catch { /* ignore -> current month */ }
  const d = new Date();
  d.setDate(1);
  return d;
}
function saveCalView() {
  try { localStorage.setItem(KEY_CAL, JSON.stringify({ y: calView.getFullYear(), m: calView.getMonth() })); } catch { /* ignore */ }
}
let calView = loadCalView();

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
    saveCalView();
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
  let tasks = loadTasks();
  // purane tasks jinki date < today reh gayi ho (tab khula hi nahi) — turant archive karo.
  // (Recursion nahi: archive ke baad fresh load karke aage badho, taaki calendar kabhi skip na ho.)
  if (tasks.some(t => t.date < today)) {
    archivePastDates(today);
    tasks = loadTasks();
  }
  const todays = tasks.filter(t => t.date === today);

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
  try {
    // corrupt calView kabhi calendar ko khaali na chhode — hamesha valid month par lao
    if (!(calView instanceof Date) || isNaN(calView.getTime())) {
      calView = new Date();
      calView.setDate(1);
    }
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
  } catch (err) {
    // Calendar kabhi vanish na ho: error par fallback message dikhao, grid khaali mat chhodo
    console.error('renderCalendar failed:', err);
    try {
      calView = new Date();
      calView.setDate(1);
      saveCalView();
      calendarEl.innerHTML = '<p class="log-empty">Calendar load nahi hua — page refresh karo. Tasks safe hain.</p>';
    } catch { /* ignore */ }
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

// ---- Share: Unique Share ID + Encoder/Decoder (A person -> B person) ----
// Problem: localStorage sirf usi browser me hota hai. GitHub Pages par file public
// hone se sirf code share hota hai, data nahi. Isliye B ko khaali list dikhti hai
// ya purana data overwrite/remove jaisa lagta hai.
// Solution: tasks ko Base64URL me encode karke link me bhejo (?s=... / #s=...).
// Har share ke saath ek Unique Share ID (jaise TD-X1AB9Q) banta hai.
// B ke kholte hi link se decode hokar tasks MERGE honge — kuch remove nahi hoga.
// Same Share ID dobara kholne/paste karne par duplicate add nahi hoga.
function encodeJson(value) {
  const json = JSON.stringify(value);
  // Hindi/emoji safe (UTF-8 -> base64)
  const b64 = btoa(unescape(encodeURIComponent(json)));
  // URL-safe: + -> -, / -> _, = padding hatao
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decodeJson(code) {
  if (!code || typeof code !== 'string') return null;
  let b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const json = decodeURIComponent(escape(atob(b64)));
  return JSON.parse(json);
}
// purana helper naam bhi rakha (backward compat) — ab koi bhi JSON value encode karta hai
function encodeData(value) { return encodeJson(value); }
function sanitizeTasks(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(x => x && typeof x.text === 'string' && typeof x.date === 'string')
    .map(x => ({ id: x.id, text: String(x.text).slice(0, 200), time: typeof x.time === 'string' ? x.time : '', date: x.date, done: !!x.done }));
}
function decodeData(code) {
  // Legacy: code seedha tasks array tha. Ab object {v,sid,tasks} bhi support.
  // Return hamesha { sid, tasks } ya null.
  try {
    const val = decodeJson(code);
    if (Array.isArray(val)) return { sid: null, tasks: sanitizeTasks(val) };
    if (val && Array.isArray(val.tasks)) {
      return { sid: typeof val.sid === 'string' ? val.sid : null, tasks: sanitizeTasks(val.tasks) };
    }
    return null;
  } catch { return null; }
}
function genShareId() {
  const existing = new Set(Object.keys(loadShares()));
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 50; attempt++) {
    const t = Date.now().toString(36).toUpperCase().slice(-3);
    let r = '';
    for (let i = 0; i < 3; i++) r += chars[Math.floor(Math.random() * chars.length)];
    const sid = `TD-${t}${r}`;
    if (!existing.has(sid) && !getImportedSids().includes(sid)) return sid;
  }
  return `TD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`;
}
function loadShares() { try { return JSON.parse(localStorage.getItem(KEY_SHARES)) || {}; } catch { return {}; } }
function saveShares(o) { try { localStorage.setItem(KEY_SHARES, JSON.stringify(o)); } catch { /* ignore */ } }
function getImportedSids() { try { return JSON.parse(localStorage.getItem(KEY_IMPORTED)) || []; } catch { return []; } }
function markSidImported(sid) {
  if (!sid) return;
  try {
    const arr = getImportedSids();
    if (!arr.includes(sid)) { arr.push(sid); localStorage.setItem(KEY_IMPORTED, JSON.stringify(arr.slice(-100))); }
  } catch { /* ignore */ }
}
function createShare() {
  const tasks = loadTasks();
  const sid = genShareId();
  const payload = { v: 1, sid, createdAt: new Date().toISOString(), count: tasks.length, tasks };
  const code = encodeJson(payload);
  const base = location.href.split('?')[0].split('#')[0];
  const link = `${base}#s=${code}`;
  const shares = loadShares();
  shares[sid] = { createdAt: payload.createdAt, count: tasks.length };
  saveShares(shares);
  try { localStorage.setItem('dailyTodo_lastShare', sid); } catch { /* ignore */ }
  return { sid, link, code, count: tasks.length };
}
function getLastShareSid() { try { return localStorage.getItem('dailyTodo_lastShare') || ''; } catch { return ''; } }
function getShareLink() { return createShare().link; } // backward-compat wrapper
// MERGE ONLY — kabhi overwrite/delete nahi. Returns added count.
function importSharedTasks(sharedArr) {
  if (!sharedArr || !sharedArr.length) return 0;
  const tasks = loadTasks();
  const ids = new Set(tasks.map(t => String(t.id)));
  // same text+date+time wala task pehle se ho to skip (share-refresh safe)
  const sigs = new Set(tasks.map(t => `${t.date}||${t.time || ''}||${t.text}`));
  let added = 0;
  sharedArr.forEach(t => {
    const sig = `${t.date}||${t.time || ''}||${t.text}`;
    if (sigs.has(sig)) return; // duplicate task — skip, taaki list “hatti” ya double na lage
    // id na ho ya clash ho to nayi id do — taaki purana task remove/overwrite na ho
    if (!t.id || ids.has(String(t.id))) {
      t.id = Date.now() + Math.floor(Math.random() * 1000000) + added;
    }
    if (typeof t.done !== 'boolean') t.done = false;
    if (!t.time) t.time = '';
    tasks.push(t);
    ids.add(String(t.id));
    sigs.add(sig);
    added++;
  });
  saveTasks(tasks);
  return added;
}
function importSharedPayload(payload) {
  if (!payload || !Array.isArray(payload.tasks)) return { status: 'invalid' };
  if (payload.sid && getImportedSids().includes(payload.sid)) {
    return { status: 'duplicate', sid: payload.sid, added: 0 };
  }
  const added = importSharedTasks(payload.tasks);
  if (payload.sid) markSidImported(payload.sid);
  return { status: added ? 'added' : 'empty', sid: payload.sid, added };
}
function getIncomingShareCode() {
  try {
    const q = new URLSearchParams(location.search);
    const fromQuery = q.get('s') || q.get('share');
    if (fromQuery) return fromQuery;
  } catch { /* ignore */ }
  const h = location.hash || '';
  const m = h.match(/[#&?](s|share)=([^&]+)/);
  if (m) { try { return decodeURIComponent(m[2]); } catch { return m[2]; } }
  return null;
}
// Sirf share wala param hatao — poora path mat badlo (taaki refresh par calendar/state safe rahe)
function cleanShareUrl() {
  try {
    const url = new URL(location.href);
    url.searchParams.delete('s');
    url.searchParams.delete('share');
    if (url.hash) {
      let nh = url.hash.replace(/[#&?](s|share)=[^&]*/g, '');
      nh = nh.replace(/^#&/, '#').replace(/^#\?/, '#');
      url.hash = (nh === '#' || nh === '') ? '' : nh;
    }
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch {
    // Fallback (bahut purana browser): kam se kam share code to URL se hatao
    try {
      const rawHash = String(location.hash || '').replace(/[#&?](s|share)=[^&]*/g, '');
      const cleanHash = (rawHash === '#' || rawHash === '#&' || rawHash === '#?') ? '' : rawHash.replace(/^#&/, '#');
      const rawSearch = String(location.search || '').replace(/([?&])(s|share)=[^&]*/g, '$1').replace(/[?&]$/, '').replace(/\?&/, '?');
      const cleanSearch = (rawSearch === '?' || rawSearch === '') ? '' : rawSearch;
      history.replaceState(null, '', location.pathname + cleanSearch + cleanHash);
    } catch { /* ignore */ }
  }
}
// Paste kiye gaye text se code nikalo: full link (?s= / #s=) ya raw code. Sirf ID (TD-XXX) me data nahi hota.
function extractShareCode(input) {
  const s = String(input || '').trim();
  if (!s) return { code: null };
  const qm = s.match(/[?#&](s|share)=([^&\s]+)/);
  if (qm) { try { return { code: decodeURIComponent(qm[2]) }; } catch { return { code: qm[2] }; } }
  if (/^TD-[A-Z0-9]{3,}$/i.test(s)) return { onlyId: s.toUpperCase() };
  if (/^[A-Za-z0-9\-_]{8,}={0,2}$/.test(s)) return { code: s };
  return { code: null };
}
function checkShareImport() {
  const code = getIncomingShareCode();
  if (!code) return;
  const payload = decodeData(code);
  cleanShareUrl(); // refresh par dobara import na ho — pehle hi URL saaf karo
  if (payload && payload.tasks.length) {
    const res = importSharedPayload(payload);
    renderAll();
    if (res.status === 'duplicate') {
      showShareMsg(`ℹ️ Share ID ${payload.sid} pehle hi add ho chuka hai — duplicate add nahi kiya. Purana data safe hai.`, false);
      alert(`ℹ️ Share ID ${payload.sid} already imported hai — kuch duplicate add nahi hua.`);
    } else {
      showShareMsg(`✅ Share ID ${payload.sid || '(legacy)'}: ${res.added} task(s) add ho gaye. Purana data safe hai.`, true);
      alert(`🔗 Share ID ${payload.sid || '(legacy)'}: ${res.added} shared task(s) add ho gaye!\nAapka purana data safe hai — kuch remove nahi hua.`);
    }
    refreshLastShareInfo();
  } else if (payload && !payload.tasks.length) {
    renderAll(); // khaali share — kuch mat karo
  } else {
    showShareMsg('⚠️ Share link kharab hai — decode nahi hua. Kuch remove/change nahi kiya.', false);
    alert('⚠️ Share link kharab hai — decode nahi hua. Kuch remove/change nahi kiya.');
  }
}

function renderAll() {
  // Har section independent try/catch me — ek fail ho to bhi calendar/log kabhi vanish na ho
  try { renderTasks(); } catch (e) { console.error('renderTasks failed:', e); }
  try { renderFuture(); } catch (e) { console.error('renderFuture failed:', e); }
  try { renderCalendar(); } catch (e) { console.error('renderCalendar failed:', e); }
  try { renderLog(); } catch (e) { console.error('renderLog failed:', e); }
}

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
$('prevMonth').onclick = () => { calView.setMonth(calView.getMonth() - 1); saveCalView(); renderCalendar(); };
$('nextMonth').onclick = () => { calView.setMonth(calView.getMonth() + 1); saveCalView(); renderCalendar(); };

// ---- Share panel (Unique Share ID) ----
function showShareMsg(text, ok) {
  const el = $('shareMsg');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('ok', !!ok);
  el.classList.toggle('err', !ok);
}
function openSharePanel(withFreshShare) {
  const panel = $('sharePanel');
  if (!panel) return;
  panel.hidden = false;
  if (withFreshShare) {
    const { sid, link, count } = createShare();
    $('shareIdBadge').textContent = sid;
    $('shareIdText').textContent = sid;
    $('shareLinkText').value = link;
    showShareMsg(`✅ Naya Share ID ${sid} bana (${count} tasks). Link auto-copy karne ki koshish ho rahi hai...`, true);
    copyText(link, `🔗 Share ID ${sid} ka link copy ho gaya! B ko bhejo.`);
    refreshLastShareInfo();
  } else {
    const last = getLastShareSid();
    if (last) {
      $('shareIdBadge').textContent = last;
      $('shareIdText').textContent = last;
      const shares = loadShares();
      showShareMsg(`Pichhla Share ID: ${last}${shares[last] ? ` (${shares[last].count} tasks)` : ''}. Naya link chahiye to “Share Link” dabao.`, true);
    } else {
      showShareMsg('B ka link/code neeche paste karke Import dabao. Naya link banane ke liye “Share Link” dabao.', true);
    }
  }
  $('sharePanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function refreshLastShareInfo() {
  const el = $('lastShareInfo');
  if (!el) return;
  const last = getLastShareSid();
  const shares = loadShares();
  if (last && shares[last]) {
    el.textContent = `Last Share ID: ${last} • ${shares[last].count} tasks • ${new Date(shares[last].createdAt).toLocaleString()}`;
  } else if (last) {
    el.textContent = `Last Share ID: ${last}`;
  } else {
    el.textContent = '';
  }
}
async function copyText(text, okAlert) {
  try {
    await navigator.clipboard.writeText(text);
    if (okAlert) alert(okAlert + '\n\nLink kholte hi tasks auto-add honge, purana data remove nahi hoga.');
    return true;
  } catch {
    prompt('Copy karke B ko bhejo:', text);
    return false;
  }
}
$('shareBtn').onclick = () => openSharePanel(true);
$('importOpenBtn').onclick = () => openSharePanel(false);
$('shareCloseBtn').onclick = () => { $('sharePanel').hidden = true; };
$('copyIdBtn').onclick = () => {
  const sid = $('shareIdText').textContent;
  if (!sid || sid === '—') { showShareMsg('Pehle “Share Link” dabakar ID banao.', false); return; }
  copyText(sid, `Share ID ${sid} copy ho gaya! (Note: sirf ID se import nahi hoga — poora link/code bhejo.)`);
};
$('copyLinkBtn').onclick = () => {
  const link = $('shareLinkText').value;
  if (!link) { showShareMsg('Pehle “Share Link” dabakar link banao.', false); return; }
  copyText(link, '🔗 Share link copy ho gaya! B ko bhejo.');
};
$('importBtn').onclick = () => {
  const raw = $('importInput').value;
  const found = extractShareCode(raw);
  if (found.onlyId) {
    showShareMsg(`⚠️ "${found.onlyId}" sirf Share ID hai — usme task data nahi hota. B se poora share link/code maango aur yahan paste karo.`, false);
    return;
  }
  if (!found.code) {
    showShareMsg('⚠️ Koi valid share link/code nahi mila. Poora link paste karo (usme #s= ya ?s= hota hai). Kuch remove nahi kiya.', false);
    return;
  }
  const payload = decodeData(found.code);
  if (!payload) {
    showShareMsg('⚠️ Ye code decode nahi hua — link adhura/galat hai. Kuch remove/change nahi kiya.', false);
    return;
  }
  if (!payload.tasks.length) {
    showShareMsg('ℹ️ Is share me 0 tasks hain — add karne ko kuch nahi. Purana data untouched hai.', true);
    return;
  }
  const res = importSharedPayload(payload);
  if (res.status === 'duplicate') {
    showShareMsg(`ℹ️ Share ID ${payload.sid} pehle hi import ho chuka hai — duplicate add nahi kiya.`, false);
  } else {
    $('importInput').value = '';
    renderAll();
    refreshLastShareInfo();
    showShareMsg(`✅ Share ID ${payload.sid || '(legacy)'}: ${res.added} task(s) add ho gaye. Purana data safe hai — kuch remove nahi hua.`, true);
  }
};

initDateInput();
tickClock();
checkMidnightReset();
checkShareImport();
refreshLastShareInfo();
renderAll();
