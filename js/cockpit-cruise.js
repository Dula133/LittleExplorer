/* Cruise is a child simulation over the existing speed/gear/engine state. */
'use strict';
window.createCockpitCruise=function({state,$,announce}){
 const driving=()=>state.engine&&state.belt&&!state.handbrake&&!state.brake&&['D','S'].includes(state.gear);
 const limit=()=>state.gear==='S'?120:100;
 function cancel(){state.cruise=false;state.cruiseSet=0;}
 function validate(){
  if(state.cruise&&(!driving()||!Number.isFinite(state.speed)||!Number.isFinite(state.cruiseSet)||state.cruiseSet<20||state.cruiseSet>limit()))cancel();
  return state.cruise;
 }
 function render(){
  $('cruise').classList.toggle('active',state.cruise);$('cruise').setAttribute('aria-pressed',String(state.cruise));
  $('cruise').setAttribute('aria-label',state.cruise?'取消定速巡航 Cancel cruise':'定速巡航 Cruise');
  $('cruiseIndicator').hidden=!state.cruise;
  $('cruiseSet').textContent=state.cruise?Math.round(state.cruiseSet):'—';
  $('cruiseHint').textContent=state.cruise?'点击取消 · Cancel':'≥20 km/h · D/S';
 }
 function toggle(){
  if(state.cruise){cancel();announce('巡航已取消','汽车恢复滑行。需要加速时再踩油门。',false);return;}
  if(!driving()||!Number.isFinite(state.speed)||state.speed<20||state.speed>limit()){
   announce('现在不能开启巡航','系好安全带，启动后挂 D 或 S、松手刹和脚刹，达到每小时 20 公里。',false);return;
  }
  state.cruiseSet=state.speed;state.cruise=true;state.accel=false;
  announce('定速巡航已开启','保持约 '+Math.round(state.cruiseSet)+' 公里每小时。踩刹车或再点巡航可取消；加速前请先取消。这是儿童模拟。',false);
 }
 function blockAcceleration(){
  if(!state.cruise)return false;
  announce('先取消巡航再加速','再次点击定速巡航，然后再踩油门。脚刹随时可以取消巡航。',false);return true;
 }
 return{validate,render,toggle,blockAcceleration,tick(dt){
  if(!validate())return false;
  // The set speed is captured without rounding. A bounded correction preserves
  // continuity if a future simulation adds a small disturbance; never snap speed.
  state.speed+=Math.max(-6*dt,Math.min(6*dt,state.cruiseSet-state.speed));return true;
 }};
};
