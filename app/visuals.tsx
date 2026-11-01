import React, { memo, useEffect, useMemo, useState } from 'react';
function savedEffects(){try{return localStorage.getItem('tima-effects')!=='off'}catch{return true}}
export function useVisualEffects(){
 const [enabled,setEnabled]=useState(savedEffects);
 useEffect(()=>{document.documentElement.dataset.effects=enabled?'on':'off';try{localStorage.setItem('tima-effects',enabled?'on':'off')}catch{}},[enabled]);
 return [enabled,setEnabled] as const;
}
export function Ambient(){return <div className="ambient" aria-hidden="true"><div className="ambient-prism"/><div className="ambient-line"/></div>}
export const Countdown=memo(function Countdown({target,active}:{target:number;active:boolean}){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{let timer:ReturnType<typeof setInterval>;const resume=()=>{clearInterval(timer);if(!document.hidden){setNow(Date.now());timer=setInterval(()=>setNow(Date.now()),1000)}};document.addEventListener('visibilitychange',resume);resume();return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',resume)}},[]);
 const seconds=Math.max(0,Math.floor((target-now)/1000)),values=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60];
 return <div className="countdown-wrap"><span>{active?'До окончания':'До начала'}</span><div className="countdown" role="timer" aria-live="off" aria-label={`${values[0]} часов ${values[1]} минут ${values[2]} секунд`}>{values.map((v,i)=><React.Fragment key={i}>{i>0&&<i>:</i>}<span><b>{String(v).padStart(2,'0')}</b><small>{['час','мин','сек'][i]}</small></span></React.Fragment>)}</div></div>;
});
export function DayRail({today,selected,onSelect,events}:{today:string;selected:string;onSelect:(d:string)=>void;events:any[]}){
 const days=useMemo(()=>{const date=new Date(today+'T12:00Z'),monday=new Date(+date-((date.getUTCDay()+6)%7)*86400000);return Array.from({length:7},(_,i)=>new Date(+monday+i*86400000).toISOString().slice(0,10))},[today]);
 const planned=useMemo(()=>new Set(events.map(e=>new Date(Date.parse(e.starts_at)+5*3600000).toISOString().slice(0,10))),[events]);
 return <div className="day-rail">{days.map((d,i)=><button key={d} className={(d===selected?'active ':'')+(d===today?'is-today':'')} onClick={()=>onSelect(d)} aria-label={['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'][i]+', '+Number(d.slice(8))}><small>{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][i]}</small><b>{Number(d.slice(8))}</b><span className={planned.has(d)?'planned':''}/></button>)}</div>;
}
