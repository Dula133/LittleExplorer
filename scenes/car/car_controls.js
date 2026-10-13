/* 汽车架构模块：由 car.js 组装，文件加载时不创建模型或播放声音。 */
(function(M){
const LAMP_MODES=Object.freeze({OFF:'OFF',POSITION:'POSITION',HEADLIGHT:'HEADLIGHT'});
const TURN_MODES=Object.freeze({OFF:'OFF',LEFT:'LEFT',RIGHT:'RIGHT',HAZARD:'HAZARD'});
const RAIN_LEVELS=Object.freeze({NONE:'NONE',LIGHT:'LIGHT',MEDIUM:'MEDIUM',HEAVY:'HEAVY'});
const WIPER_MODES=Object.freeze({OFF:'OFF',SLOW:'SLOW',FAST:'FAST'});
const GEAR_MODES=Object.freeze({P:'P',D:'D'});
const setMode=(value,modes,label)=>{const v=String(value).toUpperCase();if(!Object.values(modes).includes(v))throw new RangeError(`${label}: ${value}`);return v;};
M.setMode=setMode;
M.modes={LAMP_MODES,TURN_MODES,RAIN_LEVELS,WIPER_MODES,GEAR_MODES};
M.createState=()=>({wheelW:0,shaftW:0,steer:0,steerDemoUntil:0,pistonPh:0,pistonSpd:0,lights:0,fuel:0,puffTimer:0,
  motionW:0,steerTarget:0,hornUntil:0,musicPlaying:false,temperature:22,fanLevel:0,defog:false,mist:0,mistTarget:0,locked:false,beltFastened:false,cup:false,armrestOpen:false,
  wheelUntil:0,engineUntil:0,shaftUntil:0,lightsUntil:0,fuelUntil:0,puffUntil:0,startOn:false,fuelOn:false,engineOn:false,shaftOn:false,wheelsOn:false,
  lampMode:LAMP_MODES.OFF,turnMode:TURN_MODES.OFF,turnEpoch:0,fogLight:false,position:0,fog:0,lampKnobAngle:-.65,
  rainLevel:RAIN_LEVELS.NONE,wiperMode:WIPER_MODES.OFF,rain:0,wipe:0,wipePh:0,
  gearMode:GEAR_MODES.P,gearK:0,volumeLevel:2,mediaPage:0,climateOn:false,throttleUntil:0,pedalBrake:0,pedalGas:0,
  brakeUntil:0,brake:0,lightReminderBeeps:0,lightReminderNext:0,lightReminderCondition:false});

M.createControls=function(C,api,now,onReminder,TIRE_R){
let bound=false,ports={doorPivots:[],frontWindows:[]};
const controls={
  driveFeedback(){return C.gearMode==='P'?'发动机启动了。P 档停车，选择 D 档才会前进。':'发动机启动了。现在是 D 档，汽车向前走。';},
  cockpitStatus(){return {
    start:api?.S.drive?'运行':'停止',gearControl:C.gearMode,
    lampKnob:{OFF:'关',POSITION:'小灯',HEADLIGHT:'大灯'}[C.lampMode],
    hazard:C.turnMode==='HAZARD'?'开启':'关闭',fogControl:C.fogLight?'开启':'关闭',
    turnControlLeft:C.turnMode==='LEFT'?'闪烁':'关闭',turnControlRight:C.turnMode==='RIGHT'?'闪烁':'关闭',
    dayNightControl:api?.S.nightT?'夜晚':'白天',rainControl:{NONE:'无雨',LIGHT:'小雨',MEDIUM:'中雨',HEAVY:'大雨'}[C.rainLevel],
    wiperControl:{OFF:'关',SLOW:'慢',FAST:'快'}[C.wiperMode],defogControl:C.defog?'开启':'关闭',
    musicPlay:C.musicPlaying?'播放中':'暂停',volumeControl:['静音','小','中','大'][C.volumeLevel],
    climateControl:C.climateOn?'开启':'关闭',temperatureDown:C.temperature+'°',temperatureUp:C.temperature+'°',
    fanControl:['关','小','中','大'][C.fanLevel],lockleft:C.locked?'锁住':'解锁',lockright:C.locked?'锁住':'解锁',
    windowleft:['关','半开','全开'][controls.getState().windows?.left||0],windowright:['关','半开','全开'][controls.getState().windows?.right||0]
  };},

  gears:GEAR_MODES,
  setGearMode(mode){C.gearMode=setMode(mode,GEAR_MODES,'gear mode');if(C.gearMode==='D'&&api.S.drive)for(const p of ports.doorPivots)p.userData.open=0;return this.getState();},
  setVolumeLevel(level){const n=Number(level);if(!Number.isInteger(n)||n<0||n>3)throw new RangeError(`volume level: ${level}`);C.volumeLevel=n;return this.getState();},
  setMediaPage(page){const n=Number(page);if(!Number.isInteger(n)||n<0||n>2)throw new RangeError(`media page: ${page}`);C.mediaPage=n;return this.getState();},
  setClimate(on){C.climateOn=!!on;C.fanLevel=on?Math.max(1,C.fanLevel):0;return this.getState();},
  setMusic(on){C.musicPlaying=!!on;return this.getState();},
  setTemperature(value){const n=Number(value);if(!Number.isInteger(n)||n<18||n>26||n%2)throw new RangeError('temperature: '+value);C.temperature=n;return this.getState();},
  setFanLevel(level){const n=Number(level);if(!Number.isInteger(n)||n<0||n>3)throw new RangeError('fan level: '+level);C.fanLevel=n;C.climateOn=n>0;return this.getState();},
  setDefog(on){C.defog=!!on;return this.getState();},
  setLocked(on){C.locked=!!on;return this.getState();},
  setSteering(value){const n=Number(value);if(![-1,0,1].includes(n))throw new RangeError('steering: '+value);C.steerTarget=n*.42;C.steerDemoUntil=0;return this.getState();},
  bindVehicle(next){if(bound)throw new Error('vehicle ports already bound');ports=next;bound=true;},
  setWindow(side,level){const w=ports.frontWindows.find(w=>w.userData.windowSide===side);if(!w||![0,1,2].includes(level))throw new RangeError('window state');w.userData.windowLevel=level;return this.getState();},
  toggleDoor(pv){if(this.getState().moving){api.caption('door','车门','汽车正在走，停稳后再开门。');return false;}if(C.locked&&!pv.userData.open){api.caption('door','门锁','门锁着，先按门锁解锁。');return false;}pv.userData.open=pv.userData.open?0:1;api.sfx?.door?.();onReminder(pv);return true;},
  getState(){const state={gearMode:C.gearMode,steering:C.steerTarget/.42,volumeLevel:C.volumeLevel,mediaPage:C.mediaPage,climateOn:C.climateOn,musicPlaying:C.musicPlaying,temperature:C.temperature,fanLevel:C.fanLevel,defog:C.defog,locked:C.locked,beltFastened:C.beltFastened,cup:C.cup,armrestOpen:C.armrestOpen,engineOn:!!api?.S.drive,moving:!!api?.S.drive&&C.gearMode==='D'&&now()>=C.brakeUntil,speed:Math.round(C.motionW*TIRE_R*3.6)};if(bound){state.doors=ports.doorPivots.map(p=>({driver:p.userData.driverDoor,open:!!p.userData.open}));state.windows=Object.fromEntries(ports.frontWindows.map(w=>[w.userData.windowSide,w.userData.windowLevel]));}return state;}
};
return controls;
};
const LAMP_SEQUENCE=[LAMP_MODES.OFF,LAMP_MODES.POSITION,LAMP_MODES.HEADLIGHT];
const RAIN_SEQUENCE=[RAIN_LEVELS.NONE,RAIN_LEVELS.LIGHT,RAIN_LEVELS.MEDIUM,RAIN_LEVELS.HEAVY];
const WIPER_SEQUENCE=[WIPER_MODES.OFF,WIPER_MODES.SLOW,WIPER_MODES.FAST];
const nextIn=(value,sequence)=>sequence[(sequence.indexOf(value)+1)%sequence.length];
const lampFeedback={OFF:'灯关掉了。',POSITION:'现在只打开小灯。',HEADLIGHT:'前照灯亮了，小灯也继续亮着。'};
const rainFeedback={NONE:'雨停了。',LIGHT:'现在下小雨了。',MEDIUM:'雨变大了一些。',HEAVY:'现在是大雨，前面更难看清了。'};
const wiperFeedback={OFF:'雨刮器停下来了。',SLOW:'雨刮器开始慢慢摆动。',FAST:'雨刮器现在摆得更快了。'};
M.presentation={LAMP_SEQUENCE,RAIN_SEQUENCE,WIPER_SEQUENCE,nextIn,lampFeedback,rainFeedback,wiperFeedback};
M.createRuntime=function(api,{preview=false}={}){
 const C=M.createState(),now=()=>api.now(),lighting=M.createLighting(C,now),weather=M.createWeather(C,now,api);
function startLightReminder(door){
  if(!api||!door?.userData.driverDoor||!door.userData.open||api.S.drive||C.lampMode===LAMP_MODES.OFF)return;
  C.lightReminderBeeps=3;C.lightReminderNext=now()+80;
  api.caption('door','车灯提醒','灯还开着，汽车在提醒你别忘了关灯。');
}

 const controls=M.createControls(C,api,now,startLightReminder,.385);
 return {state:C,api,now,lighting,weather,controls,startLightReminder,preview};
};
})(window.LECar=window.LECar||{});
