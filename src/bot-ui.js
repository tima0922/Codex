import { localDate, addDays, clock, escapeHtml as esc, defaults, validateSettings, validateRecord } from './core.js';
const button=(text,callback_data)=>({text,callback_data});
const app=env=>({text:'✨ Открыть приложение',web_app:{url:env.APP_URL}});
const home=()=>button('⌂ Главное меню','home');
const date=d=>new Intl.DateTimeFormat('ru',{timeZone:'Asia/Tashkent',weekday:'long',day:'numeric',month:'long'}).format(new Date(d+'T12:00Z'));
const amount=n=>Number(n).toLocaleString('ru');
export function keyboard(env){return {keyboard:[[{text:'☀️ Сегодня'},{text:'🌤 Завтра'}],[{text:'📅 Неделя'},{text:'🌙 Работа'}],[{text:'✅ Задачи'},{text:'💳 Финансы'}],[{text:'⚙️ Настройки'},{text:'✨ Приложение',web_app:{url:env.APP_URL}}]],resize_keyboard:true,is_persistent:true,input_field_placeholder:'Выбери раздел или добавь задачу'};}
export function screen(route,state,env,now=Date.now()){
 const today=localDate(new Date(now)),tasks=state.tasks.filter(t=>!t.done),events=state.events;
 const footer=[[home(),app(env)]];
 if(route==='home'){
  const next=events.filter(e=>Date.parse(e.ends_at)>now).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at))[0];
  return {text:`<b>✦ TIMA ASSISTANT</b>\n<i>Твоё личное пространство</i>\n\nПривет, Тима 👋\n<b>${esc(date(today))}</b>\n\n${next?`⏭ <b>Ближайшее</b>\n${esc(next.title)}\n${clock(next.starts_at)}–${clock(next.ends_at)}${next.room?' · '+esc(next.room):''}`:'Сегодня есть место для новых планов.'}\n\n🎓 Пар сегодня: <b>${events.filter(e=>e.kind==='lesson'&&localDate(new Date(e.starts_at))===today).length}</b>\n✅ Дел в работе: <b>${tasks.length}</b>\n\n<i>Выбирай, что посмотрим ↓</i>`,rows:[[button('☀️ Сегодня','day:'+today),button('🌤 Завтра','day:'+addDays(today,1))],[button('📅 Неделя','week:0'),button('🌙 Смены','work')],[button('✅ Задачи','tasks:0'),button('💳 Финансы','money')],[button('⚙️ Настройки','settings')],[app(env)]]};
 }
 if(route.startsWith('day:')){
  const d=route.slice(4);if(!/^\d{4}-\d\d-\d\d$/.test(d)||!Number.isFinite(Date.parse(d)))return screen('home',state,env,now);
  const list=events.filter(e=>Date.parse(e.starts_at)<Date.parse(addDays(d,1)+'T00:00:00+05:00')&&Date.parse(e.ends_at)>Date.parse(d+'T00:00:00+05:00')).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
  const text=`<b>📅 ${esc(date(d))}</b>\n<i>Время Ташкента · UTC+5</i>\n\n`+(list.length?list.slice(0,6).map(e=>`${e.kind==='shift'?'🌙':e.kind==='lesson'?'🎓':'📍'} <b>${clock(e.starts_at)}–${clock(e.ends_at)}</b>${localDate(new Date(e.starts_at))!==d?' · началось вчера':''}\n<b>${esc(e.title.slice(0,150))}</b>${e.lesson_type?'\n'+esc(e.lesson_type):''}${e.room?'\n📍 '+esc(e.room):''}${e.teacher?'\n👤 '+esc(e.teacher):''}${e.official_ends_at?'\n↗ Уход на учёбу; по графику до '+clock(e.official_ends_at):''}`).join('\n\n'):'<b>Планов пока нет ☕</b>\nМожно добавить событие в приложении.');
  return {text,rows:[[button('‹ День назад','day:'+addDays(d,-1)),button('День вперёд ›','day:'+addDays(d,1))],[button('Сегодня','day:'+today),button('📅 Неделя','week:0')],...footer]};
 }
 if(route.startsWith('week:')){
  const offset=Math.max(-8,Math.min(8,Number(route.slice(5))||0));
  const days=Array.from({length:7},(_,i)=>addDays(today,offset*7+i));
  return {text:`<b>🗓 Твоя неделя</b>\n<i>Нажми день, чтобы увидеть предметы и аудитории.</i>\n\n`+days.map(d=>{const n=events.filter(e=>e.kind==='lesson'&&localDate(new Date(e.starts_at))===d).length;const work=events.some(e=>e.kind==='shift'&&localDate(new Date(e.starts_at))===d);return `<b>${esc(date(d))}</b>\n🎓 ${n} пар${work?' · 🌙 ночная смена':''}`}).join('\n\n'),rows:[...days.map(d=>[button(date(d),'day:'+d)]),[button('‹ Предыдущая','week:'+(offset-1)),button('Следующая ›','week:'+(offset+1))],...footer]};
 }
 if(route==='work'){
  const shifts=events.filter(e=>e.kind==='shift'&&Date.parse(e.ends_at)>now).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)).slice(0,7);
  return {text:'<b>🌙 Рабочий ритм</b>\n<i>Перед учёбой уход в '+esc(state.settings.study_leave_time||'07:00')+'</i>\n\n'+(shifts.length?shifts.map(e=>`<b>${esc(date(localDate(new Date(e.starts_at))))}</b>\n${clock(e.starts_at)} → ${clock(e.ends_at)} следующего дня${e.official_ends_at?'\n🎓 Ранний уход перед парами':''}`).join('\n\n'):'Ближайших смен нет.'),rows:[[button('📅 Расписание','week:0')],...footer]};
 }
 if(route.startsWith('tasks:')){
  const page=Math.max(0,Math.min(Math.max(0,Math.ceil(tasks.length/5)-1),Number(route.slice(6))||0)),slice=tasks.slice(page*5,page*5+5);
  return {text:`<b>✅ Задачи · ${tasks.length} в работе</b>\n\n`+(slice.length?slice.map((t,i)=>`<b>${page*5+i+1}. ${esc(t.title)}</b>${t.priority==='high'?' ⚑':''}\n${t.due_at?'⏰ '+esc(date(localDate(new Date(t.due_at))))+' · '+clock(t.due_at):'<i>Без срока</i>'}`).join('\n\n'):'<b>Все дела закрыты 😎</b>\nДобавь новое, когда понадобится.')+'\n\n<i>Кнопки ниже отмечают задачу выполненной.</i>',rows:[...slice.map((t,i)=>[button('✓ '+(page*5+i+1)+'. '+t.title.slice(0,34),'finish:'+t.id)]),[button('＋ Добавить задачу','task:add')],...(tasks.length>5?[[button('‹','tasks:'+Math.max(0,page-1)),button('Ещё ›','tasks:'+(page+1))]]:[]),...footer]};
 }
 if(route==='settings'){
  const labels=[['enabled','Все уведомления'],['lessons','Перед первой парой'],['breaks','На переменах'],['shifts','Перед сменой'],['tasks','Сроки задач'],['bills','Платежи'],['morning','Обзор утром'],['evening','Обзор вечером'],['quiet','Тихие часы']];
  return {text:`<b>⚙️ Настройки помощника</b>\n\n${state.settings.enabled?'🟢 Уведомления включены':'🔕 Все уведомления на паузе'}\n\n🎓 Первая пара — за <b>${state.settings.lesson_minutes} мин</b>\n🌙 Смена — за <b>${state.settings.shift_minutes} мин</b>\n✅ Задачи — за <b>${state.settings.task_minutes} мин</b>\n🤫 Тихие часы: ${state.settings.quiet_start}–${state.settings.quiet_end}\n↗ Уход перед учёбой: <b>${state.settings.study_leave_time||'07:00'}</b>\n\n<i>Нажми переключатель. Время можно настроить в приложении.</i>`,rows:[...labels.map(([key,label])=>[button(`${state.settings[key]?'🟢':'⚪️'} ${label}`,`set:${key}:${state.settings[key]?'0':'1'}`)]),...footer]};
 }
 if(route==='money'){
  const month=today.slice(0,7),records=state.money.filter(m=>m.date.startsWith(month));const incoming=records.filter(m=>m.kind==='income').reduce((a,m)=>a+Number(m.amount),0);const expense=records.filter(m=>m.kind==='expense'||m.kind==='bill'&&m.paid).reduce((a,m)=>a+Number(m.amount),0);const bills=state.money.filter(m=>m.kind==='bill'&&!m.paid).sort((a,b)=>a.date.localeCompare(b.date));
  return {text:`<b>💳 Личные финансы</b>\n<i>Записи за текущий месяц · сум</i>\n\n↗ Доходы: <b>${amount(incoming)}</b>\n↘ Расходы: <b>${amount(expense)}</b>\n✦ Остаток: <b>${amount(incoming-expense)}</b>\n\n<b>Ближайшие платежи</b>\n`+(bills.length?bills.slice(0,5).map(m=>`${esc(m.title)} · <b>${amount(m.amount)}</b>\n⏰ ${esc(date(m.date))}`).join('\n\n'):'Всё спокойно — платежей пока нет.')+'\n\n<i>Все операции и редактирование — в приложении.</i>',rows:[[button('＋ Записать расход','money:add')],...footer]};
 }
 return screen('home',state,env,now);
}

export async function routeBot(update,env,{db,telegram,snapshot,updateUuid}){
 const m=update.message,cb=update.callback_query,text=String(m?.text||'').trim();
 const call=(method,data)=>telegram(env,method,{chat_id:env.OWNER_TELEGRAM_ID,...data});
 const show=async route=>{const view=screen(route,await snapshot(env),env);const data={text:view.text,parse_mode:'HTML',reply_markup:{inline_keyboard:view.rows}};return cb?call('editMessageText',{message_id:cb.message.message_id,...data}):call('sendMessage',data)};
 const ask=kind=>call('sendMessage',{text:kind==='task'?'<b>✏️ Новая задача</b>\n\nОтветь на это сообщение названием дела.\nНапример: «Сдать лабораторную».\n\n/cancel — отменить':'<b>💸 Новый расход</b>\n\nОтветь суммой и названием.\nНапример: <code>12000 Такси</code>\n\n/cancel — отменить',parse_mode:'HTML',reply_markup:{force_reply:true,selective:true,input_field_placeholder:kind==='task'?'Название задачи':'12000 Такси'}});
 if(cb){
  try{await telegram(env,'answerCallbackQuery',{callback_query_id:cb.id});}catch{}
  const data=String(cb.data||'');
  if(data==='task:add')return ask('task');if(data==='money:add')return ask('money');
  const finish=/^(?:finish|done):([a-f0-9-]{36})$/.exec(data);
  if(finish){await db(env,`tima_tasks?id=eq.${finish[1]}`,'PATCH',{done:true});return show('tasks:0');}
  const toggle=/^set:(enabled|lessons|breaks|shifts|tasks|bills|morning|evening|quiet):([01])$/.exec(data);
  if(toggle){const old=(await db(env,'tima_settings?id=eq.1&select=value'))[0]?.value||{};const value={...defaults,...old,...validateSettings({[toggle[1]]:toggle[2]==='1'})};await db(env,'tima_settings?id=eq.1','PATCH',{value});return show('settings');}
  return show(data);
 }
 const command=text.split(/\s/)[0].split('@')[0];
 const aliases={'/today':'day:'+localDate(),'/tomorrow':'day:'+addDays(localDate(),1),'/week':'week:0','/work':'work','/tasks':'tasks:0','/settings':'settings','/finance':'money','/menu':'home','☀️ Сегодня':'day:'+localDate(),'🌤 Завтра':'day:'+addDays(localDate(),1),'📅 Неделя':'week:0','🌙 Работа':'work','✅ Задачи':'tasks:0','💳 Финансы':'money','⚙️ Настройки':'settings'};
 if(command==='/start'||command==='/help'){
  await call('sendMessage',{text:'<b>Привет, Тима 👋</b>\nМеню всегда под рукой — выбирай кнопки под полем ввода.\n\nВ приложении — полный календарь и красивые экраны ✨',parse_mode:'HTML',reply_markup:keyboard(env)});return show('home');
 }
 if(command==='/cancel'){await call('sendMessage',{text:'Добавление отменено.',reply_markup:keyboard(env)});return show('home');}
 if(aliases[text]||aliases[command])return show(aliases[text]||aliases[command]);
 if(text==='➕ Задача'||command==='/add'&&!/\s+\S/.test(text))return ask('task');
 const reply=m?.reply_to_message;
 const trustedReply=reply?.from?.is_bot&&String(reply.from.id)===env.BOT_TOKEN.split(':')[0];
 const taskReply=trustedReply&&reply.text?.startsWith('✏️ Новая задача');
 const moneyReply=trustedReply&&reply.text?.startsWith('💸 Новый расход');
 if(command==='/add'||taskReply){
  const title=command==='/add'?text.replace(/^\S+\s*/, ''):text;
  if(!title||title.length>200){await call('sendMessage',{text:'Название должно быть от 1 до 200 символов.'});return ask('task');}
  await db(env,'tima_tasks?on_conflict=id','POST',{id:await updateUuid(update.update_id),...validateRecord('tasks',{title})},'resolution=ignore-duplicates,return=representation');return show('tasks:0');
 }
 if(moneyReply){const match=/^(\d+(?:[.,]\d{1,2})?)\s+(.{1,200})$/u.exec(text);if(!match){await call('sendMessage',{text:'Нужны сумма и название: 12000 Такси'});return ask('money');}let record;try{record=validateRecord('money',{kind:'expense',amount:Number(match[1].replace(',','.')),title:match[2],date:localDate()});}catch{await call('sendMessage',{text:'Проверь сумму: она должна быть больше нуля.'});return ask('money');}await db(env,'tima_money?on_conflict=id','POST',{id:await updateUuid(update.update_id),...record},'resolution=ignore-duplicates,return=representation');return show('money');}
 return show('home');
}
