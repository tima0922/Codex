import React, { memo } from 'react';
import { Icon } from './icons';
const clock=new Intl.DateTimeFormat('ru',{timeZone:'Asia/Tashkent',hour:'2-digit',minute:'2-digit',hour12:false});
const localDay=(s:string)=>new Date(Date.parse(s)+5*3600000).toISOString().slice(0,10);
const person=(s:string)=>s.split(' ').map(w=>w.length>2&&!w.endsWith('.')?w[0]+w.slice(1).toLocaleLowerCase():w).join(' ');
export const EventCard=memo(function EventCard({event:e,live,presentationDay,onOpen}:{event:any;live:boolean;presentationDay:string;onOpen:(e:any)=>void}){
 const start=clock.format(new Date(e.starts_at)),end=clock.format(new Date(e.ends_at));
 const firstDay=localDay(e.starts_at),lastDay=localDay(e.ends_at);
 return <button className={'event-card '+e.kind+(live?' live':'')} onClick={()=>onOpen(e)} aria-label={`${e.title}, ${start}–${end}. Открыть событие`}>
  <span className="event-time"><b>{start}</b><span>до {end}</span>{firstDay<presentationDay?<small>вчера</small>:lastDay>firstDay?<small>+1 день</small>:null}</span>
  <span className="event-body">
   <span className="event-tags"><span className="event-kind"><Icon name={e.kind==='shift'?'moon':e.kind==='lesson'?'graduation':'calendar'} size={12}/>{e.kind==='shift'?'Работа':e.kind==='lesson'?(e.lesson_type||'Пара'):'Личное'}</span>{live&&<span className="live-tag"><i/>Сейчас</span>}</span>
   <span className="event-title">{e.title}</span>
   {e.room&&<span className="event-location"><Icon name="pin" size={13}/>{e.room}</span>}
   {e.teacher&&<span className="event-teacher"><Icon name="person" size={12}/>{person(e.teacher)}</span>}
   {e.official_ends_at&&<span className="early-leave-label">Уход на учёбу · по графику до {clock.format(new Date(e.official_ends_at))}</span>}
  </span><span className="event-open"><Icon name="chevron" size={16}/></span>
 </button>;
});
