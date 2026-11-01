import { routeBot } from './bot-ui.js';
import { HttpError, defaults, localDate, addDays, clock, validateInitData, constantEqual, validateRecord, validateSettings, notificationPlan, dayText, quietNow, applyStudyDeparture } from './core.js';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' https://telegram.org; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors https://web.telegram.org https://*.telegram.org https://t.me;",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};
const json = (data, status = 200) => Response.json(data, { status, headers: { ...securityHeaders, 'Cache-Control': 'no-store' } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function ready(env) { return ['BOT_TOKEN', 'OWNER_TELEGRAM_ID', 'SUPABASE_SECRET_KEY', 'SUPABASE_URL', 'WEBHOOK_SECRET'].every(k => !!env[k]); }
export async function db(env, path, method = 'GET', body, prefer = 'return=representation') {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new HttpError(503, 'База ещё подключается');
  const key = env.SUPABASE_SECRET_KEY;
  const headers = { 'Content-Type': 'application/json', apikey: key, Prefer: prefer };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new HttpError(502, 'Не удалось обратиться к базе. Попробуй ещё раз');
  const text = await res.text(); return text ? JSON.parse(text) : null;
}
export async function telegram(env, method, data) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(12000) });
  const result = await r.json(); if (!result.ok && result.description?.includes('message is not modified')) return null; if (!result.ok) throw new HttpError(502, 'Telegram временно не ответил'); return result.result;
}
export async function snapshot(env, day = localDate()) {
  const all = async path => {
    const rows = [];
    for (let offset = 0; offset < 10000; offset += 500) {
      const page = await db(env, `${path}&limit=500&offset=${offset}`); rows.push(...page);
      if (page.length < 500) return rows;
    }
    throw new HttpError(413, 'Слишком много записей. Нужен архив старых данных');
  };
  const [events, tasks, money, settings] = await Promise.all([
    all('tima_events?order=starts_at,id'),
    all('tima_tasks?order=created_at.desc,id'),
    all('tima_money?order=date.desc,id'),
    db(env, 'tima_settings?id=eq.1&select=value')
  ]);
  const preferences = { ...defaults, ...settings[0]?.value };
  return { events: applyStudyDeparture(events, preferences.study_leave_time), tasks, money, settings: preferences, day, timezone: 'Asia/Tashkent' };
}
const openButton = env => ({ inline_keyboard: [[{ text: 'Открыть Tima Assistant ↗', web_app: { url: env.APP_URL } }]] });
const send = (env, text, reply_markup = openButton(env)) => telegram(env, 'sendMessage', { chat_id: env.OWNER_TELEGRAM_ID, text, reply_markup });
async function bodyJson(request) {
  if (Number(request.headers.get('content-length')) > 32768) throw new HttpError(413, 'Слишком много данных');
  const raw = await request.text(); if (raw.length > 32768) throw new HttpError(413, 'Слишком много данных');
  let data; try { data = JSON.parse(raw); } catch { throw new HttpError(400, 'Некорректный JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Нужен объект'); return data;
}
async function api(request, env, url) {
  const user = await validateInitData(request.headers.get('X-Telegram-Init-Data'), env);
  if (url.pathname === '/api/state' && request.method === 'GET') return json({ ...await snapshot(env), user: { first_name: user.first_name, id: user.id } });
  if (url.pathname === '/api/settings' && request.method === 'PATCH') {
    const patch = validateSettings(await bodyJson(request));
    const rows = await db(env, 'tima_settings?id=eq.1&select=value');
    const value = { ...defaults, ...rows[0]?.value, ...patch };
    await db(env, 'tima_settings?id=eq.1', 'PATCH', { value }); return json(value);
  }
  const match = /^\/api\/(events|tasks|money)(?:\/([a-f0-9-]+))?$/.exec(url.pathname);
  if (!match) throw new HttpError(404, 'Не найдено');
  const [, type, id] = match;
  if (id && !uuid.test(id)) throw new HttpError(400, 'Некорректный ID');
  if (request.method === 'POST' && !id) {
    const record = validateRecord(type, await bodyJson(request)); return json((await db(env, `tima_${type}`, 'POST', record))[0], 201);
  }
  if (request.method === 'PATCH' && id) {
    const old = (await db(env, `tima_${type}?id=eq.${id}`))[0]; if (!old) throw new HttpError(404, 'Запись не найдена');
    const record = validateRecord(type, { ...old, ...await bodyJson(request) });
    return json((await db(env, `tima_${type}?id=eq.${id}`, 'PATCH', record))[0]);
  }
  if (request.method === 'DELETE' && id) { await db(env, `tima_${type}?id=eq.${id}`, 'DELETE'); return json({ ok: true }); }
  throw new HttpError(405, 'Метод не поддерживается');
}
async function handleUpdate(update, env) {
  const m = update.message; const cb = update.callback_query; const from = m?.from || cb?.from; const chat = m?.chat || cb?.message?.chat;
  if (!env.OWNER_TELEGRAM_ID || String(from?.id) !== String(env.OWNER_TELEGRAM_ID) || chat?.type !== 'private' || String(chat.id) !== String(env.OWNER_TELEGRAM_ID)) return;
  if (!Number.isSafeInteger(update.update_id)) return;
  const key = `update:${update.update_id}`;
  const lease = await db(env, 'rpc/tima_claim', 'POST', { p_key: key, p_payload: '', p_expires: new Date(Date.now() + 86400000).toISOString() });
  if (!lease) { const row = (await db(env, `tima_deliveries?key=eq.${key}&select=sent_at`))[0]; if (row?.sent_at) return; throw new HttpError(503, 'Повторить позже'); }
  await routeBot(update, env, { db, telegram, snapshot, updateUuid });
  await db(env, `tima_deliveries?key=eq.${key}&lease=eq.${lease}`, 'PATCH', { sent_at: new Date().toISOString() });
}
async function updateUuid(id) { const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('telegram-task:' + id))); const h = Array.from(bytes.slice(0, 16), b => b.toString(16).padStart(2, '0')).join(''); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20)}`; }
export async function runNotifications(env, now = new Date()) {
  if (!ready(env)) return { configured: false };
  const state = await snapshot(env, localDate(now));
  const plan = notificationPlan(state.events, state.tasks, state.money, state.settings, now);
  // Recompute from current records so edited/deleted events never send stale retries.
  const jobs = new Map();
  for (const job of plan) jobs.set(job.key, { ...job, expires: new Date(+now + 5 * 60000).toISOString() });
  if (!state.settings.enabled || quietNow(state.settings, now)) return { sent: 0 };
  let sent = 0;
  for (const job of jobs.values()) {
    const kind = job.key.split(':')[0]; const flag = { shift: 'shifts', lesson: 'lessons', break: 'breaks', task: 'tasks', bill: 'bills', morning: 'morning', evening: 'evening' }[kind];
    if (!flag || !state.settings[flag]) continue;
    const lease = await db(env, 'rpc/tima_claim', 'POST', { p_key: job.key, p_payload: job.text, p_expires: job.expires }); if (!lease) continue;
    try {
      await send(env, job.text);
      await db(env, `tima_deliveries?key=eq.${encodeURIComponent(job.key)}&lease=eq.${lease}`, 'PATCH', { sent_at: new Date().toISOString() }); sent++;
    } catch { console.error('notification_delivery_failed', { kind }); }
  }
  await db(env, `tima_deliveries?expires_at=lt.${new Date(+now - 30 * 86400000).toISOString()}`, 'DELETE');
  return { sent };
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/health') return json({ ok: true, configured: ready(env) });
      if (url.pathname.startsWith('/api/')) return await api(request, env, url);
      if (url.pathname === '/telegram/webhook') {
        if (request.method !== 'POST') throw new HttpError(405, 'Метод не поддерживается');
        if (!env.WEBHOOK_SECRET || !constantEqual(request.headers.get('X-Telegram-Bot-Api-Secret-Token'), env.WEBHOOK_SECRET)) throw new HttpError(403, 'Доступ запрещён');
        if (!ready(env)) throw new HttpError(503, 'Настройка не завершена');
        await handleUpdate(await bodyJson(request), env); return json({ ok: true });
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'Метод не поддерживается');
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers); for (const [k, v] of Object.entries(securityHeaders)) headers.set(k, v);
      headers.set('Cache-Control', url.pathname.endsWith('.js') || url.pathname.endsWith('.css') ? 'public, max-age=300' : 'no-store');
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      if (!(error instanceof HttpError)) console.error('request_failed', { path: url.pathname, name: error?.name });
      return json({ error: error instanceof HttpError ? error.message : 'Что-то пошло не так. Попробуй ещё раз' }, error.status || 500);
    }
  },
  async scheduled(_controller, env, ctx) { ctx.waitUntil(runNotifications(env).catch(error => console.error('scheduler_failed', { name: error?.name }))); }
};
