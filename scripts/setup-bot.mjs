// Run locally after Worker secrets are installed. Credentials are accepted through hidden stdin.
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
async function hidden(label) {
 stdout.write(label);
 if (!stdin.isTTY) { const r=createInterface({input:stdin});const answer=await new Promise(resolve=>r.once('line',resolve));r.close();return String(answer).trim(); }
 stdin.setRawMode(true);stdin.resume();let text='';
 return new Promise((resolve,reject)=>{const listener=chunk=>{for(const c of chunk.toString()){if(c==='\u0003'){stdin.setRawMode(false);stdin.pause();stdin.off('data',listener);reject(new Error('Отменено'));return;}if(c==='\r'||c==='\n'){stdin.setRawMode(false);stdin.pause();stdin.off('data',listener);stdout.write('\n');resolve(text.trim());return;}if(c==='\u007f')text=text.slice(0,-1);else text+=c;}};stdin.on('data',listener)});
}
const token=await hidden('BOT_TOKEN (скрытый ввод): ');
const webhookSecret=await hidden('WEBHOOK_SECRET (тот же, что в Worker): ');
const appUrl=process.env.APP_URL||'https://codex.bagirovtimur09.workers.dev';
if(!/^\d+:[A-Za-z0-9_-]+$/.test(token)||!/^[A-Za-z0-9_-]{16,256}$/.test(webhookSecret))throw new Error('Некорректный формат секретов');
const health=await fetch(appUrl+'/health').then(r=>r.json());
if(!health.configured)throw new Error('Сначала добавь все секреты Worker и выполни Deploy');
async function call(method,body){const result=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());if(!result.ok)throw new Error(`${method}: Telegram отклонил настройку`);console.log(`${method}: OK`);return result.result;}
await call('setMyName',{name:'Tima Assistant'});
await call('setMyDescription',{description:'Твой личный помощник: расписание пар и аудитории, ночные смены, задачи, расходы и напоминания. Открывай приложение — всё нужное рядом.'});
await call('setMyShortDescription',{short_description:'Пары, смены, задачи и деньги — в одном месте.'});
await call('setMyCommands',{commands:[['start','Открыть помощника'],['today','Сегодня'],['tomorrow','Завтра'],['week','Ближайшие 7 дней'],['work','Рабочие смены'],['tasks','Активные задачи'],['add','Добавить задачу'],['settings','Настройки уведомлений'],['help','Помощь']].map(([command,description])=>({command,description}))});
await call('setChatMenuButton',{menu_button:{type:'web_app',text:'Мой помощник',web_app:{url:appUrl}}});
await call('setWebhook',{url:appUrl+'/telegram/webhook',secret_token:webhookSecret,allowed_updates:['message','callback_query'],drop_pending_updates:false,max_connections:1});
const check=await call('getWebhookInfo',{});if(check.url!==appUrl+'/telegram/webhook')throw new Error('Webhook URL mismatch');
console.log('Настройки сохранены. Проверь /start в личном чате с ботом.');
