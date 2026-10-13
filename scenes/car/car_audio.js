/* Per-car audio policy. Generic sound primitives and the AudioContext stay in app.js.
   Construction is silent; previews never create audio nodes. */
(function(M){
M.createAudio=function(C,api,now,{preview=false}={}){
  const {LAMP_MODES,RAIN_LEVELS}=M.modes;
  let music=null;
  const hidden=()=>typeof document!=='undefined'&&document.hidden;
  const audio={
    stopMusic(){if(!music)return;for(const o of music.nodes){o.stop();o.disconnect();}music.g.disconnect();music=null;},
    setMusic(on,level){
      if(preview||!on||api.sfx.isMuted?.()||hidden()){this.stopMusic();return;}
      const c=api.sfx.ac?.();if(!c)return;
      if(!music){const g=c.createGain(),o=c.createOscillator();o.type='triangle';o.connect(g).connect(c.destination);o.start();music={g,nodes:[o],start:c.currentTime,note:-1};}
      const notes=[262,330,392,330,294,349,440,349],step=Math.floor((c.currentTime-music.start)/.42)%notes.length;
      if(step!==music.note){music.note=step;music.nodes[0].frequency.setTargetAtTime(notes[step],c.currentTime,.012);}
      music.g.gain.setTargetAtTime(level*.018,c.currentTime,.025);
    },
    getMusicState(){return {active:!!music,gain:music?.g.gain.value||0,context:api.sfx.ctx?.state||'uninitialized'};},
    playHorn(){if(!preview)api.sfx.horn?.();},
    pressHorn(){if(now()<C.hornUntil)return;C.hornUntil=now()+500;this.playHorn();},
    startReminder(door){
      if(preview||!door?.userData.driverDoor||!door.userData.open||api.S.drive||C.lampMode===LAMP_MODES.OFF)return;
      C.lightReminderBeeps=3;C.lightReminderNext=now()+80;
      api.caption('door','车灯提醒','灯还开着，汽车在提醒你别忘了关灯。');
    },
    sync(t,driverDoor){
      if(preview)return;
      const wantWater=C.rainLevel!==RAIN_LEVELS.NONE&&!api.S.drive;
      if(wantWater&&!api.sfx.wantLoop)api.sfx.loop?.('water');else if(!wantWater&&api.sfx.wantLoop==='water')api.sfx.stopLoop?.();
      const condition=!api.S.drive&&C.lampMode!==LAMP_MODES.OFF&&!!driverDoor?.userData.open;
      if(condition&&!C.lightReminderCondition)this.startReminder(driverDoor);
      if(!condition)C.lightReminderBeeps=0;C.lightReminderCondition=condition;
      if(C.lightReminderBeeps>0&&t>=C.lightReminderNext){api.sfx.tone?.(1120,.11,'square',.045);C.lightReminderBeeps--;C.lightReminderNext=t+230;}
      this.setMusic(C.musicPlaying,C.volumeLevel);
    },
    dispose(){this.stopMusic();C.lightReminderBeeps=0;C.lightReminderCondition=false;}
  };
  return audio;
};
})(window.LECar=window.LECar||{});
