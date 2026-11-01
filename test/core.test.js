import test from 'node:test';
import assert from 'node:assert/strict';
import { hmac, hex, validateInitData, notificationPlan, localDate, localTime, addDays, validateRecord, validateSettings, quietNow, defaults, dayText, applyStudyDeparture } from '../src/core.js';
import worker from '../src/index.js';

const env = { BOT_TOKEN: 'test:token', OWNER_TELEGRAM_ID: '1234', WEBHOOK_SECRET: 'test_secret' };
async function sign(user = { id: 1234 }, authDate = Math.floor(Date.now()/1000), more = {}) {
 const p = new URLSearchParams({ user:JSON.stringify(user), auth_date:String(authDate), query_id:'q', ...more });
 const str=[...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');
 p.set('hash', hex(await hmac(await hmac('WebAppData', env.BOT_TOKEN), str)));return p.toString();
}
test('signed Telegram data authenticates only owner, including additional signature field',async()=>{
 assert.equal((await validateInitData(await sign(),env)).id,1234);
 assert.equal((await validateInitData(await sign({id:1234},undefined,{signature:'additional-telegram-signature'}),env)).id,1234);
 await assert.rejects(()=>validateInitData('invalid',env));
});
test('forged, stale, future, duplicate and foreign-owner initData are denied',async()=>{
 const raw=await sign();
 for(const value of [raw.replace('query_id=q','query_id=evil'),await sign({id:4567}),await sign({id:1234},Math.floor(Date.now()/1000)-3601),await sign({id:1234},Math.floor(Date.now()/1000)+60),raw+'&user=%7B%22id%22%3A1234%7D']) await assert.rejects(()=>validateInitData(value,env));
 await assert.rejects(()=>validateInitData(raw,{...env,OWNER_TELEGRAM_ID:undefined}));
});
test('Tashkent dates and night-shift formatting cross UTC midnight correctly',()=>{
 assert.equal(localDate(new Date('2026-11-01T20:00:00Z')),'2026-11-02');
 assert.equal(localTime(new Date('2026-11-01T20:00:00Z')),'01:00');
 assert.equal(addDays('2026-11-30',1),'2026-12-01');
 assert.match(dayText([{kind:'shift',title:'Test',starts_at:'2026-11-01T21:00:00+05:00',ends_at:'2026-11-02T09:00:00+05:00'}],'2026-11-01'),/\(\+1 день\)/);
});
test('early departure changes only overnight shifts ending on a confirmed study date',()=>{
 const shift={id:'s',kind:'shift',title:'Night',starts_at:'2026-11-01T21:00:00+05:00',ends_at:'2026-11-02T09:00:00+05:00'};
 const lesson={id:'l',kind:'lesson',title:'Class',starts_at:'2026-11-02T08:00:00+05:00',ends_at:'2026-11-02T09:20:00+05:00'};
 const rows=applyStudyDeparture([shift,lesson],'07:00');
 assert.equal(rows[0].ends_at,'2026-11-02T02:00:00.000Z');assert.equal(rows[0].official_ends_at,shift.ends_at);
 assert.equal(shift.ends_at,'2026-11-02T09:00:00+05:00');
 assert.equal(applyStudyDeparture([shift],'07:00')[0].ends_at,shift.ends_at);
 assert.deepEqual(applyStudyDeparture(rows,'07:00'),rows);
 assert.equal(applyStudyDeparture(rows,'07:30')[0].ends_at,'2026-11-02T02:30:00.000Z');
 assert.equal(applyStudyDeparture(rows,'10:00')[0].ends_at,shift.ends_at);
 assert.match(dayText(rows,'2026-11-01'),/07:00/);
});
const events=[{id:'1',kind:'lesson',title:'Первая',starts_at:'2026-11-02T08:00:00+05:00',ends_at:'2026-11-02T09:20:00+05:00',room:'101'}, {id:'2',kind:'lesson',title:'Следующая',starts_at:'2026-11-02T09:30:00+05:00',ends_at:'2026-11-02T10:50:00+05:00',room:'lab 07',teacher:'Учитель'}, {id:'3',kind:'shift',title:'Смена',starts_at:'2026-11-02T21:00:00+05:00',ends_at:'2026-11-03T09:00:00+05:00'}];
const plan=(at,s={},ts=[],money=[])=>notificationPlan(events,ts,money,s,new Date(at+'+05:00'));
test('break sends exact next room and clock, with bounded catchup and stable dedupe key',()=>{
 const p=plan('2026-11-02T09:20:00');assert.equal(p.length,1);assert.match(p[0].text,/Следующая/);assert.match(p[0].text,/lab 07/);assert.match(p[0].text,/09:30/);
 assert.equal(plan('2026-11-02T09:22:00')[0].key,p[0].key);
 assert.equal(plan('2026-11-02T09:19:59').length,0);assert.equal(plan('2026-11-02T09:25:00').length,0);
 assert.match(plan('2026-11-02T10:50:00')[0].text,/закончились/);
});
test('first lesson and shift settings respect offset and separate switches',()=>{
 assert.equal(plan('2026-11-02T07:45:00').length,1);
 assert.equal(plan('2026-11-02T09:15:00').length,0);
 assert.equal(plan('2026-11-02T20:00:00').length,1);
 assert.equal(plan('2026-11-02T20:00:00',{shifts:false}).length,0);
 assert.equal(plan('2026-11-02T07:30:00',{lesson_minutes:30}).length,1);
 assert.equal(plan('2026-11-02T09:20:00',{breaks:false}).length,0);
 assert.equal(plan('2026-11-02T09:20:00',{enabled:false}).length,0);
});
test('quiet hours span midnight and same-time range means no quiet hours',()=>{
 const s={...defaults,quiet:true,quiet_start:'22:00',quiet_end:'08:00'};
 assert.equal(quietNow(s,new Date('2026-11-02T07:45:00+05:00')),true);
 assert.equal(quietNow(s,new Date('2026-11-02T12:00:00+05:00')),false);
 assert.equal(quietNow({...s,quiet_start:'08:00'},new Date('2026-11-02T07:45:00+05:00')),false);
 assert.equal(plan('2026-11-02T07:45:00',s).length,0);
});
test('completed tasks and paid bills never remind',()=>{
 const t={id:'t',title:'Task',due_at:'2026-11-02T10:15:00+05:00',done:true};const b={id:'b',title:'Bill',amount:100,date:'2026-11-02',kind:'bill',paid:true};
 assert.equal(plan('2026-11-02T10:00:00',{},[t],[b]).length,0);
 assert.equal(plan('2026-11-02T10:00:00',{},[{...t,done:false}],[{...b,paid:false}]).length,2);
});
test('invalid writes are rejected and night shifts validate',()=>{
 assert.throws(()=>validateRecord('money',{kind:'expense',amount:-1,title:'x',date:'2026-11-02'}));
 assert.throws(()=>validateRecord('money',{kind:'bill',amount:1,title:'x',date:'2026-02-30'}));
 assert.throws(()=>validateSettings({enabled:'true'}));assert.throws(()=>validateSettings({owner_id:1}));assert.throws(()=>validateSettings({shift_minutes:181}));
 const b={kind:'shift',title:'Night',starts_at:'2026-11-02T21:00:00+05:00',ends_at:'2026-11-03T09:00:00+05:00'};
 assert.equal(validateRecord('events',b).ends_at,'2026-11-03T04:00:00.000Z');
 assert.throws(()=>validateRecord('events',{...b,ends_at:'2026-11-02T09:00:00+05:00'}));
});
test('HTTP boundary protects private state and forged webhooks; public health has no secrets',async()=>{
 let reads=0;const old=globalThis.fetch;globalThis.fetch=async()=>{reads++;throw Error('must not access db')};
 try{
 const r=await worker.fetch(new Request('https://example.com/api/state'),env);assert.equal(r.status,401);assert.equal(reads,0);
 const foreign=await worker.fetch(new Request('https://example.com/api/state',{headers:{'X-Telegram-Init-Data':await sign({id:4567})}}),env);assert.equal(foreign.status,403);assert.equal(reads,0);
 const w=await worker.fetch(new Request('https://example.com/telegram/webhook',{method:'POST',body:'{}'}),env);assert.equal(w.status,403);assert.equal(reads,0);
 const health=await worker.fetch(new Request('https://example.com/health'),env);assert.deepEqual(await health.json(),{ok:true,configured:false});
 }finally{globalThis.fetch=old;}
});
