import test from 'node:test';
import assert from 'node:assert/strict';
import { screen, routeBot, keyboard } from '../src/bot-ui.js';
import { defaults } from '../src/core.js';
const env={OWNER_TELEGRAM_ID:'1234',BOT_TOKEN:'999:test',APP_URL:'https://example.com'};
const state={events:[],tasks:[],money:[],settings:defaults};
test('all bot screens escape user data and keep callbacks within Telegram limit',()=>{
 const data={...state,tasks:[{id:'11111111-1111-4111-8111-111111111111',title:'<script>& unsafe',done:false}]};
 for(const route of ['home','day:2026-11-02','week:0','work','tasks:0','settings','money']){
  const v=screen(route,data,env);assert.ok(v.text.length<4096);
  for(const row of v.rows)for(const b of row)if(b.callback_data)assert.ok(Buffer.byteLength(b.callback_data)<=64);
 }
 assert.match(screen('tasks:0',data,env).text,/&lt;script&gt;&amp;/);
 assert.equal(keyboard(env).is_persistent,true);
});
test('setting callback writes desired value and edits the existing screen',async()=>{
 const calls=[],writes=[];
 const db=async(_env,path,method,body)=>{if(method==='PATCH')writes.push(body);return [{value:{breaks:true}}]};
 await routeBot({callback_query:{id:'q',data:'set:breaks:0',message:{message_id:45}}},env,{db,telegram:async(e,m,d)=>{calls.push([m,d])},snapshot:async()=>state});
 assert.equal(writes[0].value.breaks,false);assert.equal(calls[0][0],'answerCallbackQuery');
 assert.equal(calls[1][0],'editMessageText');assert.equal(calls[1][1].message_id,45);
 assert.equal(calls.filter(c=>c[0]==='sendMessage').length,0);
});
test('reply-based task creation requires a prompt from this bot and uses idempotent upsert',async()=>{
 const writes=[],calls=[];
 const deps={db:async(e,path,method,b)=>{writes.push({path,method,b});return[]},telegram:async(e,m,d)=>calls.push([m,d]),snapshot:async()=>state,updateUuid:async()=> '11111111-1111-4111-8111-111111111111'};
 await routeBot({update_id:1,message:{text:'Do it',reply_to_message:{from:{id:888,is_bot:true},text:'✏️ Новая задача'}}},env,deps);
 assert.equal(writes.length,0);
 await routeBot({update_id:2,message:{text:'Do it',reply_to_message:{from:{id:999,is_bot:true},text:'✏️ Новая задача'}}},env,deps);
 assert.equal(writes.length,1);assert.match(writes[0].path,/on_conflict=id/);assert.equal(writes[0].b.title,'Do it');
});
