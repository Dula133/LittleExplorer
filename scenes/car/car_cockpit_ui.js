/* Car-only DOM presentation. State, selection and camera actions are engine ports. */
(function(M){
M.mountCockpitUI=function({SC,S,cam,PARTS,ICONS,select,now}){
  let cockpitPanel,cockpitParent,cockpitReset,cockpitRefresh;
  document.body.classList.add('car-controls');
  const style=document.createElement('style');style.textContent=`
    body.car-controls.talking .tile.immediate{pointer-events:auto;opacity:1;filter:none}
    .cockpit-panel{background:rgba(18,34,49,.96);border:1px solid #698596;border-radius:18px;padding:6px;color:#eff9ff}
    .cockpit-panel[hidden]{display:none}.cockpit-nav{display:flex;overflow-x:auto;gap:4px}
    .cockpit-panel button{border:1px solid #607F8B;border-radius:10px;background:#304C5D;color:#fff;font-size:13px;font-weight:700;min-height:48px;min-width:48px;touch-action:manipulation;cursor:pointer}
    .cockpit-nav button{flex:1;min-width:48px}.cockpit-panel button[aria-pressed=true]{background:#58795C;border-color:#D3D896}
    .cockpit-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:5px}.cockpit-actions button{padding:3px;line-height:1.3;display:flex;align-items:center;justify-content:center;gap:2px}.cockpit-actions img{width:24px;height:24px;object-fit:contain;flex:none}.cockpit-actions span{min-width:0;font-size:12px}
    .cockpit-help{display:flex;justify-content:space-between;align-items:center;margin-top:4px;font-size:12px}.cockpit-help button{min-height:44px;padding:4px 10px}
    .cockpit-details{max-width:420px;width:85%;border:0;border-radius:20px;padding:20px;background:#F1F7F8;color:#18384A}.cockpit-details button{min-height:48px;min-width:80px}
    @media(max-height:520px){body.car-controls.cockpit-mode .bottom{max-width:480px;right:0;left:auto}body.car-controls.cockpit-mode .cap{min-height:40px;padding:5px}.cockpit-actions{grid-template-columns:repeat(6,1fr)}.cockpit-help{display:none}.cockpit-panel{padding:4px}}
  `;document.head.appendChild(style);
  cockpitPanel=document.createElement('section');cockpitPanel.className='cockpit-panel';cockpitPanel.hidden=true;cockpitPanel.setAttribute('aria-label','驾驶舱分区控制');
  const nav=document.createElement('div');nav.className='cockpit-nav';cockpitPanel.appendChild(nav);
  const actions=document.createElement('div');actions.className='cockpit-actions';cockpitPanel.appendChild(actions);
  const help=document.createElement('div');help.className='cockpit-help';help.append('拖动看一看，也可以直接点车里的控件');
  cockpitParent=document.createElement('button');cockpitParent.textContent='给家长';cockpitParent.disabled=true;help.appendChild(cockpitParent);cockpitPanel.appendChild(help);
  const detail=document.createElement('dialog');detail.className='cockpit-details';const heading=document.createElement('h3'),body=document.createElement('p'),close=document.createElement('button');close.textContent='关闭';close.onclick=()=>detail.close();detail.append(heading,body,close);document.body.appendChild(detail);
  cockpitParent.onclick=()=>{const p=PARTS[S.sel];if(!p)return;heading.textContent=p.name;body.textContent=p.more||p.text;detail.showModal();};
  cockpitRefresh=()=>{if(!S.cockpit)return;const statuses=SC.cockpitStatus?.()||{};for(const b of actions.children){const id=b.dataset.part,text=(SC.cockpitShortNames?.[id]||PARTS[id].name)+(statuses[id]?' · '+statuses[id]:'');const span=b.querySelector('span');if(span.textContent!==text)span.textContent=text;const pressed=String(S.sel===id);if(b.getAttribute('aria-pressed')!==pressed)b.setAttribute('aria-pressed',pressed);}};
  const zoneButtons={};
  const showZone=key=>{
    S.cockpitZone=key;cam.cockpitYaw=cam.cockpitPitch=0;cam.cockpitZoom=1;cam.last=now();actions.replaceChildren();
    for(const [id,b] of Object.entries(zoneButtons))b.setAttribute('aria-pressed',String(id===key));
    for(const id of SC.cockpitControls[key].parts){const p=PARTS[id];if(!p)continue;const b=document.createElement('button');const img=document.createElement('img');img.src=ICONS[id]||'';img.alt='';const text=document.createElement('span');text.textContent=SC.cockpitShortNames?.[id]||p.name;b.append(img,text);b.setAttribute('aria-label',p.name);b.dataset.part=id;b.onclick=()=>{S.hit=null;select(id);};actions.appendChild(b);}
  };
  for(const [key,zone] of Object.entries(SC.cockpitControls)){const b=document.createElement('button');b.textContent=zone.name;b.setAttribute('aria-label','查看'+zone.name+'区');b.onclick=()=>showZone(key);nav.appendChild(b);zoneButtons[key]=b;}
  cockpitReset=()=>showZone('front');const bottom=document.querySelector('.bottom');bottom.insertBefore(cockpitPanel,bottom.firstChild);showZone('front');
  return {panel:cockpitPanel,parent:cockpitParent,reset:cockpitReset,refresh:cockpitRefresh};
};
})(window.LECar=window.LECar||{});
