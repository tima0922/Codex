import React from 'react';
import { House, CalendarDays, ListTodo, Wallet, Settings, Plus, ArrowRight, ChevronRight, Bell, Moon, BookOpen, Check, X, Clock3, MapPin, Pencil, Trash2, RefreshCw, LockKeyhole, Sparkles, TriangleAlert, GraduationCap, UserRound, ArrowUpRight } from 'lucide-react';
const icons={home:House,calendar:CalendarDays,tasks:ListTodo,wallet:Wallet,settings:Settings,plus:Plus,arrow:ArrowRight,chevron:ChevronRight,bell:Bell,moon:Moon,book:BookOpen,check:Check,close:X,clock:Clock3,pin:MapPin,edit:Pencil,trash:Trash2,refresh:RefreshCw,lock:LockKeyhole,spark:Sparkles,warning:TriangleAlert,graduation:GraduationCap,person:UserRound,outward:ArrowUpRight};
export function Icon({name,size=20}:{name:string;size?:number}) {
 const Glyph=icons[name as keyof typeof icons]||Sparkles;
 return <Glyph size={size} strokeWidth={1.7} aria-hidden="true" focusable="false"/>;
}
