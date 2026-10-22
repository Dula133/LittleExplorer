/* Independent child simulation. Does not call the outside 3D scene. */
'use strict';
window.createCockpitV33=function({state,$,announce}){
 const audio=window.createCockpitAudio({state,$});
 const NS='http://www.w3.org/2000/svg',scenery=[],marks=[];
 let distance=0,cabinMist=.6;
 const ventNames={WINDSHIELD:"前窗 Windshield",FACE:"吹脸 Face",FEET:"吹脚 Feet",FACE_FEET:"脸＋脚 Face + Feet",FEET_WINDSHIELD:"脚＋前窗 Feet + Windshield"};
 for(let i=0;i<18;i++){
  const el=document.createElementNS(NS,'use');
  el.setAttribute('href','#'+['sceneTree','sceneHouse','sceneLamp'][i%3]);
  el.dataset.motionIndex=i;el.classList.add('moving-scenery');el.dataset.kind=['tree','house','lamp'][i%3];
  $('roadScenery').append(el);scenery.push({el,side:i%2?-1:1,offset:(i+.4)/18});
 }
 for(let i=0;i<7;i++){const el=document.createElementNS(NS,'path');el.classList.add('moving-road-mark');$('roadMarks').append(el);marks.push({el,offset:i/7});}
 const wrap=n=>((n%1)+1)%1;
 function renderMotion(){
  for(const item of scenery){const p=wrap(item.offset+distance),q=p*p,x=600+item.side*(91+Math.pow(p,1.6)*700),y=136+q*220,scale=.08+q*1.45;
   item.el.setAttribute('transform',`translate(${x.toFixed(3)} ${y.toFixed(3)}) scale(${scale.toFixed(5)})`);item.el.dataset.depth=p.toFixed(6);}
  // Painter order keeps nearby roadside objects in front of the distant ones.
  for(const item of [...scenery].sort((a,b)=>Number(a.el.dataset.depth)-Number(b.el.dataset.depth)))$('roadScenery').append(item.el);
  for(const item of marks){const p=wrap(item.offset+distance),a=p*p,b=Math.min(1.1,p+.065)**2,w=1+14*a,v=1+14*b;
   item.el.setAttribute('d',`M${600-w} ${136+184*a}H${600+w}L${600+v} ${136+184*b}H${600-v}Z`);item.el.dataset.depth=p.toFixed(6);}
  $('skyParallax').setAttribute('transform',`translate(${(Math.sin(distance*.18)*2).toFixed(5)} 0)`);
  $('mountainParallax').setAttribute('transform',`translate(${(Math.sin(distance*.18)*8).toFixed(5)} 0)`);
  $('nearParallax').setAttribute('transform',`translate(${(Math.sin(distance*.18)*18).toFixed(5)} 0)`);
 }
 function renderClimate(){
  const glass=state.vent==='WINDSHIELD'||state.vent==='FEET_WINDSHIELD',face=state.vent==='FACE'||state.vent==='FACE_FEET',feet=['FEET','FACE_FEET','FEET_WINDSHIELD'].includes(state.vent);
  const flow=$('hvacFlow');flow.classList.toggle('fan-running',state.fan>0);flow.style.setProperty('--flow-time',({0:1,1:1.8,2:1,3:.5})[state.fan]+'s');
  for(const [name,on]of [['windshield',glass],['face',face],['feet',feet]])flow.querySelector('.flow-'+name).classList.toggle('flow-selected',on);
  document.querySelectorAll('[data-vent]').forEach(b=>{const on=b.dataset.vent===state.vent;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  $('airflowStatus').textContent=state.fan>0?ventNames[state.vent]+' · '+['','🍃','🌀','💨'][state.fan]:'风机关闭 · Fan off';
  $('glassMistStatus').textContent='内侧水汽 · Inside mist '+Math.round(cabinMist*100)+'%';
  $('innerCondensation').style.opacity=(cabinMist*.36).toFixed(3);
 }
 renderMotion();
 return{...audio,renderClimate,tick(dt,speed){if(!document.hidden){const defrost=['WINDSHIELD','FEET_WINDSHIELD'].includes(state.vent)&&state.fan>0;cabinMist=Math.max(0,Math.min(.6,cabinMist+(defrost?-.045*state.fan:.004)*dt));renderClimate();}
 if(speed>0&&['D','S','R'].includes(state.gear)&&!document.hidden){distance+=(state.gear==='R'?-1:1)*speed*dt/230;renderMotion();}}};
};
