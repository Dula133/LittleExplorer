/* 汽车架构模块：由 car.js 组装，文件加载时不创建模型或播放声音。 */
(function(M){
const RAIN_PROFILES=Object.freeze({
  NONE:Object.freeze({count:0,speedMin:0,speedMax:0,opacity:0,gloom:0}),
  LIGHT:Object.freeze({count:80,speedMin:7,speedMax:9,opacity:.42,gloom:.22}),
  MEDIUM:Object.freeze({count:190,speedMin:8.5,speedMax:11.5,opacity:.62,gloom:.55}),
  HEAVY:Object.freeze({count:360,speedMin:10.5,speedMax:14.5,opacity:.82,gloom:1})
});
M.RAIN_PROFILES=RAIN_PROFILES;
const {RAIN_LEVELS,WIPER_MODES}=M.modes,setMode=M.setMode;
M.createWeather=function(C,now){
const weather={
  levels:RAIN_LEVELS,wiperModes:WIPER_MODES,
  setRainLevel(level){C.rainLevel=setMode(level,RAIN_LEVELS,'rain level');return this.getState();},
  setWiperMode(mode){C.wiperMode=setMode(mode,WIPER_MODES,'wiper mode');return this.getState();},
  demonstrateMist(){C.mistTarget=1;return this.getState();},
  getState(){const p=RAIN_PROFILES[C.rainLevel];return {rainLevel:C.rainLevel,wiperMode:C.wiperMode,dropCount:p.count,speedMin:p.speedMin,speedMax:p.speedMax,mist:C.mist};}
};
return weather;
};
})(window.LECar=window.LECar||{});
