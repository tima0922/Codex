export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const defaults = { enabled: true, lessons: true, breaks: true, shifts: true, tasks: true, bills: true, morning: false, evening: false, lesson_minutes: 15, shift_minutes: 60, task_minutes: 15, quiet: false, quiet_start: '00:00', quiet_end: '07:00', study_leave_time: '07:00' };
export const localDate = (date = new Date()) => new Date(+date + 5 * 3600000).toISOString().slice(0, 10);
export const localTime = (date = new Date()) => new Date(+date + 5 * 3600000).toISOString().slice(11, 16);
export const addDays = (date, n) => new Date(Date.parse(date + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const clock = iso => new Intl.DateTimeFormat('ru', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
export const stamp = (date, time) => Date.parse(`${date}T${time}:00+05:00`);
export function applyStudyDeparture(events, leaveTime = '07:00') {
  const studyDays = new Set(events.filter(e => e.kind === 'lesson').map(e => localDate(new Date(e.starts_at))));
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(leaveTime)) return events;
  return events.map(e => {
    if (e.kind !== 'shift') return e;
    const official = e.official_ends_at || e.ends_at;
    const { official_ends_at: _oldOfficial, ...base } = e;
    base.ends_at = official;
    const endDay = localDate(new Date(official));
    const leave = stamp(endDay, leaveTime);
    if (!studyDays.has(endDay) || localDate(new Date(e.starts_at)) === endDay || leave <= Date.parse(e.starts_at) || leave >= Date.parse(official)) return base;
    return {...base, official_ends_at: official, ends_at: new Date(leave).toISOString()};
  });
}
export const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function constantEqual(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
export async function hmac(key, data) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
export const hex = a => Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
export async function validateInitData(raw, env, now = Date.now()) {
  if (!env.OWNER_TELEGRAM_ID || !env.BOT_TOKEN) throw new HttpError(503, 'Бот ещё настраивается');
  if (!raw || raw.length > 16384) throw new HttpError(401, 'Открой приложение через Telegram');
  const p = new URLSearchParams(raw); const keys = [...p.keys()];
  if (new Set(keys).size !== keys.length) throw new HttpError(401, 'Некорректная подпись');
  const hash = p.get('hash'); p.delete('hash');
  const data = [...p.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join('\n');
  if (!constantEqual(hash, hex(await hmac(await hmac('WebAppData', env.BOT_TOKEN), data)))) throw new HttpError(401, 'Некорректная подпись');
  const auth = Number(p.get('auth_date'));
  if (!Number.isInteger(auth) || now / 1000 - auth > 3600 || auth > now / 1000 + 30) throw new HttpError(401, 'Сессия истекла. Переоткрой приложение');
  let user; try { user = JSON.parse(p.get('user')); } catch { throw new HttpError(401, 'Некорректный пользователь'); }
  if (!user || !Number.isSafeInteger(user.id) || String(user.id) !== String(env.OWNER_TELEGRAM_ID)) throw new HttpError(403, 'Личный помощник. Доступ только владельцу');
  return user;
}
export function validateSettings(input) {
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (!(k in defaults)) throw new HttpError(400, 'Неизвестная настройка');
    if (typeof defaults[k] === 'boolean') { if (typeof v !== 'boolean') throw new HttpError(400, 'Ожидается переключатель'); }
    else if (k.endsWith('_minutes')) { if (!Number.isInteger(v) || v < 0 || v > 180) throw new HttpError(400, 'Интервал от 0 до 180 минут'); }
    else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new HttpError(400, 'Некорректное время');
    out[k] = v;
  }
  return out;
}
export function validateRecord(type, b) {
  const text = (k, max = 200, required = true) => { const v = String(b[k] ?? '').trim(); if ((required && !v) || v.length > max) throw new HttpError(400, `Проверь поле ${k}`); return v; };
  const iso = (k, required = true) => { if (!b[k] && !required) return null; const v = text(k, 50); if (!/^\d{4}-\d\d-\d\dT/.test(v) || !Number.isFinite(Date.parse(v))) throw new HttpError(400, 'Некорректная дата'); return new Date(v).toISOString(); };
  if (type === 'events') {
    const kind = text('kind'); if (!['lesson', 'shift', 'event'].includes(kind)) throw new HttpError(400, 'Некорректный тип');
    const starts_at = iso('starts_at'), ends_at = iso('ends_at');
    if (Date.parse(ends_at) <= Date.parse(starts_at) || Date.parse(ends_at) - Date.parse(starts_at) > 86400000) throw new HttpError(400, 'Проверь начало и конец события');
    return { kind, title: text('title'), starts_at, ends_at, room: text('room', 80, false), teacher: text('teacher', 120, false), lesson_type: text('lesson_type', 40, false), notes: text('notes', 1000, false) };
  }
  if (type === 'tasks') {
    if (b.done !== undefined && typeof b.done !== 'boolean') throw new HttpError(400, 'Некорректный статус');
    return { title: text('title'), due_at: iso('due_at', false), done: b.done ?? false, priority: ['normal', 'high'].includes(b.priority) ? b.priority : 'normal' };
  }
  if (type === 'money') {
    const kind = text('kind'); const amount = Number(b.amount);
    if (!['income', 'expense', 'bill'].includes(kind) || !Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw new HttpError(400, 'Проверь сумму и тип');
    if (b.paid !== undefined && typeof b.paid !== 'boolean') throw new HttpError(400, 'Некорректный статус');
    const date = text('date', 10); if (!/^\d{4}-\d\d-\d\d$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new HttpError(400, 'Некорректная дата');
    return { kind, amount: Math.round(amount * 100) / 100, title: text('title'), category: text('category', 60, false), date, paid: b.paid ?? false };
  }
  throw new HttpError(404, 'Раздел не найден');
}
export function quietNow(s, now) { const t = localTime(now); return s.quiet && (s.quiet_start < s.quiet_end ? t >= s.quiet_start && t < s.quiet_end : s.quiet_start > s.quiet_end && (t >= s.quiet_start || t < s.quiet_end)); }
export function notificationPlan(events, tasks, money, settings, now = new Date()) {
  const s = { ...defaults, ...settings }; if (!s.enabled || quietNow(s, now)) return [];
  const out = []; const due = t => +now >= t && +now - t < 5 * 60000;
  const push = (key, time, text) => { if (due(time)) out.push({ key, text }); };
  const lessons = events.filter(e => e.kind === 'lesson').sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  for (const e of events) {
    const start = Date.parse(e.starts_at), end = Date.parse(e.ends_at); const day = localDate(new Date(start));
    if (e.kind === 'shift' && s.shifts) push(`shift:${e.id}:${e.starts_at}:${s.shift_minutes}`, start - s.shift_minutes * 60000, `🌙 Скоро смена\n${e.title}\n${clock(e.starts_at)} → ${clock(e.ends_at)} (следующий день)\nДо начала ${Math.max(0, Math.ceil((start - +now) / 60000))} мин.`);
    if (e.kind === 'lesson' && s.lessons && lessons.find(l => localDate(new Date(l.starts_at)) === day)?.id === e.id) push(`lesson:${e.id}:${e.starts_at}:${s.lesson_minutes}`, start - s.lesson_minutes * 60000, `🎓 Первая пара скоро\n${e.title}\n${clock(e.starts_at)}–${clock(e.ends_at)} · ${e.room || 'Аудитория не указана'}`);
    if (e.kind === 'lesson' && s.breaks) {
      const next = lessons.find(l => Date.parse(l.starts_at) >= end && localDate(new Date(l.starts_at)) === day);
      push(`break:${e.id}:${e.ends_at}:${next?.starts_at ?? 'end'}`, end, next ? `☕ Перемена! Следующая пара:\n${next.title}\n${clock(next.starts_at)}–${clock(next.ends_at)}\n📍 ${next.room || 'Аудитория не указана'}\n${next.teacher || ''}` : '🎉 На сегодня пары закончились!');
    }
  }
  if (s.tasks) for (const t of tasks.filter(t => !t.done && t.due_at)) push(`task:${t.id}:${t.due_at}:${s.task_minutes}`, Date.parse(t.due_at) - s.task_minutes * 60000, `📌 Напоминание\n${t.title}\nСрок: ${clock(t.due_at)}`);
  const day = localDate(now);
  if (s.bills) for (const b of money.filter(b => b.kind === 'bill' && !b.paid)) push(`bill:${b.id}:${b.date}`, stamp(b.date, '10:00'), `💳 Сегодня платёж\n${b.title}\n${Number(b.amount).toLocaleString('ru')} сум`);
  if (s.morning) push(`morning:${day}`, stamp(day, '07:00'), dayText(events, day, '☀️ Твой день'));
  if (s.evening) push(`evening:${day}`, stamp(day, '20:00'), dayText(events, addDays(day, 1), '🌙 План на завтра'));
  return out;
}
export function dayText(events, day, title = '📅 Расписание') {
  const list = events.filter(e => localDate(new Date(e.starts_at)) === day).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  return `${title} · ${day.split('-').reverse().join('.')}\n\n${list.length ? list.map(e => `${e.kind === 'shift' ? '🌙' : e.kind === 'lesson' ? '🎓' : '📍'} ${clock(e.starts_at)}–${clock(e.ends_at)}${localDate(new Date(e.ends_at)) !== day ? ' (+1 день)' : ''}\n${e.title}${e.room ? '\n📍 ' + e.room : ''}`).join('\n\n') : 'Событий нет.'}`;
}
