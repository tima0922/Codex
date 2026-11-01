import React, { useEffect, useRef, useState } from 'react';

function savedEffects() { try { return localStorage.getItem('tima-effects') !== 'off'; } catch { return true; } }
export function useVisualEffects() {
 const [enabled, setEnabled] = useState(savedEffects);
 useEffect(() => {
  document.documentElement.dataset.effects = enabled ? 'on' : 'off';
  try { localStorage.setItem('tima-effects', enabled ? 'on' : 'off'); } catch {}
  if (!enabled || matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover: hover)').matches) return;
  let frame = 0, current: HTMLElement|null = null;
  const clear = () => { if (current) { current.style.removeProperty('--rx'); current.style.removeProperty('--ry'); } current = null; };
  const move = (event: PointerEvent) => {
   if (frame) return;
   frame = requestAnimationFrame(() => {
    frame = 0;
    const el = (event.target as HTMLElement)?.closest?.<HTMLElement>('.hero, .panel, .balance-card');
    if (current !== el) clear();
    if (!el) return; current = el;
    const box = el.getBoundingClientRect(), x = (event.clientX-box.left)/box.width, y=(event.clientY-box.top)/box.height;
    el.style.setProperty('--rx', `${(0.5-y)*3}deg`); el.style.setProperty('--ry', `${(x-0.5)*3}deg`);
    el.style.setProperty('--gx', `${x*100}%`); el.style.setProperty('--gy', `${y*100}%`);
   });
  };
  document.addEventListener('pointermove', move, {passive:true}); document.addEventListener('pointerleave', clear);
  return () => { cancelAnimationFrame(frame); clear(); document.removeEventListener('pointermove',move); document.removeEventListener('pointerleave',clear); };
 }, [enabled]);
 return [enabled, setEnabled] as const;
}

export function Ambient() { return <div className="ambient" aria-hidden="true"><div className="aurora a1"/><div className="aurora a2"/><div className="aurora a3"/><div className="star-dust"/><div className="floor-grid"/></div>; }

export function LivingOrb({enabled=true,large=false}:{enabled?:boolean;large?:boolean}) {
 const ref=useRef<HTMLDivElement>(null);
 useEffect(() => {
  const host=ref.current; if(!host || !enabled) return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  if(reduced.matches) return;
  let cancelled=false, cleanup=()=>{};
  import('three').then(T=>{
   if(cancelled) return;
   let renderer:any;
   try { renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'}); } catch { return; }
   renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5)); renderer.setClearColor(0x000000,0);
   const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true'); host.appendChild(canvas);
   const scene=new T.Scene(), camera=new T.PerspectiveCamera(36,1,0.1,30);camera.position.z=5.5;
   const group=new T.Group();scene.add(group);
   const resources:any[]=[];
   const geometry=new T.TorusKnotGeometry(.79,.245,144,24,2,3);resources.push(geometry);
   const material=new T.ShaderMaterial({uniforms:{uTime:{value:0}},vertexShader:`
    varying vec3 vNormal; varying vec3 vPosition; uniform float uTime;
    void main(){vec3 p=position; p+=normal*sin(p.y*4.+uTime*.7)*.025; vec4 mv=modelViewMatrix*vec4(p,1.);vPosition=mv.xyz;vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`
    varying vec3 vNormal; varying vec3 vPosition; uniform float uTime;
    void main(){vec3 n=normalize(vNormal);vec3 viewDir=normalize(-vPosition);float fresnel=pow(1.-abs(dot(n,viewDir)),2.4);
    float lit=max(dot(n,normalize(vec3(-1.2,1.5,2.))),0.);float highlight=pow(max(dot(reflect(-normalize(vec3(-.8,1.8,2.)),n),viewDir),0.),36.);
    vec3 violet=vec3(.29,.055,.68);vec3 pink=vec3(.86,.42,1.);vec3 cyan=vec3(.14,.72,1.);
    vec3 color=mix(violet,pink,lit*.75);color=mix(color,cyan,fresnel*.6);color+=highlight*.95+fresnel*vec3(.28,.2,.55);
    float sheen=sin(vPosition.y*3.+vPosition.x*2.+uTime*.3)*.5+.5;color+=sheen*.055;gl_FragColor=vec4(color,1.);}`}); resources.push(material);
   const knot=new T.Mesh(geometry,material);group.add(knot);knot.rotation.x=.35;
   const ringGeo=new T.TorusGeometry(1.55,.009,6,120);resources.push(ringGeo);
   const ringMat=new T.MeshBasicMaterial({color:0xb185ff,transparent:true,opacity:.5});resources.push(ringMat);
   const ring=new T.Mesh(ringGeo,ringMat);ring.rotation.x=1.1;ring.rotation.z=-.45;group.add(ring);
   const ring2=ring.clone();ring2.material=new T.MeshBasicMaterial({color:0x55c9ff,transparent:true,opacity:.18});resources.push(ring2.material);ring2.rotation.x=-.9;ring2.rotation.y=.5;ring2.scale.setScalar(1.17);group.add(ring2);
   const dotGeo=new T.SphereGeometry(.045,12,8),dotMat=new T.MeshBasicMaterial({color:0xc8b0ff});resources.push(dotGeo,dotMat);const dot=new T.Mesh(dotGeo,dotMat);scene.add(dot);
   const positions=new Float32Array(180*3);let randomSeed=92;const random=()=>{randomSeed=(randomSeed*16807)%2147483647;return randomSeed/2147483647;};
   for(let i=0;i<positions.length;i++)positions[i]=(random()-.5)*7;
   const pointsGeo=new T.BufferGeometry();pointsGeo.setAttribute('position',new T.BufferAttribute(positions,3));
   const pointsMat=new T.PointsMaterial({color:0xc49aff,size:.018,transparent:true,opacity:.55,depthWrite:false});resources.push(pointsGeo,pointsMat);const points=new T.Points(pointsGeo,pointsMat);scene.add(points);
   let visible=true,targetX=0,targetY=0,lastFrame=0,first=true;
   const render=(ms:number)=>{
    if(ms-lastFrame<32) return;lastFrame=ms;const t=ms*.001;
    material.uniforms.uTime.value=t;knot.rotation.y=t*.2;knot.rotation.z=Math.sin(t*.23)*.18;group.position.y=Math.sin(t*.7)*.08;
    group.rotation.x+=(targetY-group.rotation.x)*.035;group.rotation.y+=(targetX-group.rotation.y)*.035;ring.rotation.z=-.45+t*.08;ring2.rotation.z=-t*.06;
    dot.position.set(Math.cos(t*.6)*1.65,Math.sin(t*.6)*.55,Math.sin(t*.6)*.7);points.rotation.y=t*.018;
    renderer.render(scene,camera);if(first){first=false;host.classList.add('webgl-ready');}
   };
   const start=()=>renderer.setAnimationLoop(visible&&!document.hidden&&!reduced.matches?render:null);
   const resize=()=>{const box=host.getBoundingClientRect();if(!box.width||!box.height)return;renderer.setSize(box.width,box.height,false);camera.aspect=box.width/box.height;camera.updateProjectionMatrix();};
   const move=(e:PointerEvent)=>{targetX=(e.clientX/innerWidth-.5)*.35;targetY=(e.clientY/innerHeight-.5)*.2;};
   const observer=new ResizeObserver(resize);observer.observe(host);
   const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;start();});intersection.observe(host);
   const lost=(e:Event)=>{e.preventDefault();renderer.setAnimationLoop(null);host.classList.remove('webgl-ready');};
   const reduceChange=()=>{if(reduced.matches)host.classList.remove('webgl-ready');start();};
   canvas.addEventListener('webglcontextlost',lost);document.addEventListener('visibilitychange',start);window.addEventListener('pointermove',move,{passive:true});reduced.addEventListener('change',reduceChange);
   resize();start();
   cleanup=()=>{renderer.setAnimationLoop(null);observer.disconnect();intersection.disconnect();canvas.removeEventListener('webglcontextlost',lost);document.removeEventListener('visibilitychange',start);window.removeEventListener('pointermove',move);reduced.removeEventListener('change',reduceChange);resources.forEach(r=>r.dispose());renderer.dispose();canvas.remove();host.classList.remove('webgl-ready');};
  }).catch(()=>{});
  return()=>{cancelled=true;cleanup();};
 },[enabled]);
 return <div className={'living-orb '+(large?'large':'')} ref={ref} aria-hidden="true"><div className="orb-halo"/><div className="orb-fallback"><i/><i/><i/></div><span className="orb-satellite s1"/><span className="orb-satellite s2"/></div>;
}

export function Countdown({target,active}:{target:number;active:boolean}) {
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const id=setInterval(()=>{if(!document.hidden)setNow(Date.now())},1000);return()=>clearInterval(id)},[]);
 const seconds=Math.max(0,Math.floor((target-now)/1000));
 const values=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60];
 return <div className="countdown-wrap"><span>{active?'До окончания':'До начала'}</span><div className="countdown" aria-label={`${values[0]} часов ${values[1]} минут ${values[2]} секунд`}>{values.map((v,i)=><React.Fragment key={i}>{i>0&&<i>:</i>}<span><b key={v}>{String(v).padStart(2,'0')}</b><small>{['час','мин','сек'][i]}</small></span></React.Fragment>)}</div></div>;
}

export function DayRail({today,selected,onSelect,events}:{today:string;selected:string;onSelect:(d:string)=>void;events:any[]}) {
 const date=new Date(today+'T12:00Z');const monday=new Date(+date-((date.getUTCDay()+6)%7)*86400000);
 return <div className="day-rail">{Array.from({length:7},(_,i)=>{const d=new Date(+monday+i*86400000).toISOString().slice(0,10);return <button key={d} className={(d===selected?'active ':'')+(d===today?'is-today':'')} onClick={()=>onSelect(d)}><small>{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][i]}</small><b>{Number(d.slice(8))}</b><span>{events.some(e=>new Date(Date.parse(e.starts_at)+5*3600000).toISOString().slice(0,10)===d)?'•':''}</span></button>})}</div>;
}
