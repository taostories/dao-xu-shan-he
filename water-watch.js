/* 相对水位与收成仅作教学互动。 */
window.RiceWaterModel=(()=>{
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function fresh(){const order=[0,1,2];for(let i=2;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}return {version:2,mode:'playing',elapsed:0,events:0,order,repairs:0,fields:[42,55,62].map(water=>({water,health:100,gate:'closed',leak:false,repair:0}))};}
  const weather=t=>t<25?'dry':t<45?'rain':'clear';
  const harvest=s=>Math.round(s.fields.reduce((v,f)=>v+f.health,0)*.85);
  function step(s,delta,repair=null){
    if(s.mode!=='playing')return;
    let left=Math.min(delta,60-s.elapsed);
    while(left>.000001){
      const dt=Math.min(.05,left),climate=weather(s.elapsed),open=s.fields.filter(f=>f.gate==='in').length;
      s.fields.forEach((f,i)=>{
        const evaporation=climate==='dry'?1.3+i*.3:climate==='rain'?.35:.9+i*.15;
        const rain=climate==='rain'?4+i*.4:0;
        f.water=clamp(f.water+(rain+(f.gate==='in'?6/open:0)-(f.gate==='out'?5.5:0)-evaporation-(f.leak?2.4:0))*dt,0,100);
        const stress=f.water<30?(30-f.water)/30:f.water>70?(f.water-70)/30:0;
        f.health=clamp(f.health-stress*3.2*dt,0,100);
        if(i===repair&&f.leak){f.repair+=dt;if(f.repair>=3){f.leak=false;f.repair=0;s.repairs++;}}else f.repair=0;
      });
      s.elapsed=Math.min(60,s.elapsed+dt);left-=dt;
      const times=[14,36,50];while(s.events<3&&s.elapsed>=times[s.events]){s.fields[s.order[s.events]].leak=true;s.events++;}
    }
    if(s.elapsed>=59.999999){s.elapsed=60;s.mode='result';s.done=true;s.harvest=harvest(s);}
  }
  return {fresh,weather,step,harvest};
})();
window.RiceFieldRescue={mount({dialog,results,save,finish,frame,img,wireImages}){
  const model=window.RiceWaterModel,names=['左田','中田','右田'];
  let s=results.waterWatch;if(!s||s.version!==2)s=results.waterWatch=model.fresh();
  if(s.mode!=='result')s.mode='playing';
  s.fields.forEach(f=>f.repair=0);
  let disposed=false,raf=0,last=null,lastStored=-1,repair=null,notice='先观察水位，再决定开哪一道水口。',events=s.events,climate=model.weather(s.elapsed),repairs=s.repairs;
  const active=()=>!disposed&&dialog.open&&s.mode==='playing'&&!document.hidden;
  function release(){repair=null;s.fields.forEach(f=>f.repair=0);save();}
  function pauseClock(){last=null;release();if(s.mode==='playing'){s.mode='paused';save();render();}else save();}
  function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(raf);release();save();document.removeEventListener('keydown',onKey);document.removeEventListener('keyup',onKeyUp);document.removeEventListener('visibilitychange',pauseClock);window.removeEventListener('blur',pauseClock);window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);dialog.classList.remove('water-dialog');}
  function press(el,fn){let down=null;el.onpointerdown=e=>{if(e.pointerType==='touch'){e.preventDefault();down={x:e.clientX,y:e.clientY};}};el.onpointerup=e=>{if(e.pointerType==='touch'&&down){const distance=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;if(distance<12&&!el.disabled)fn();}};el.onpointercancel=()=>down=null;el.onclick=e=>{if(e.pointerType!=='touch')fn();};}
  function gate(i,value){if(!active()||repair!==null)return;s.fields[i].gate=value;notice=names[i]+{in:'正在引水，注意与其他田共享流量。',closed:'水口已关，继续留意天气。',out:'正在排水，别让水位降得太低。'}[value];save();update();}
  function beginRepair(i){if(!active()||repair!==null||!s.fields[i].leak)return;repair=i;notice='正在修补'+names[i]+'，其他田的水位仍在变化……';update();}
  function onKey(e){if(!dialog.open||disposed||e.altKey||e.metaKey||e.ctrlKey)return;if(e.code==='Space'&&e.target.matches('[data-water-repair]')){e.preventDefault();if(!e.repeat)beginRepair(Number(e.target.dataset.waterRepair));}}
  function onKeyUp(e){if(e.code==='Space'){release();update();}}
  function tick(now){
    if(disposed||s.mode!=='playing')return;
    if(active()&&last!==null)model.step(s,Math.min((now-last)/1000,.25),repair);last=now;
    if(repair!==null&&!s.fields[repair].leak)repair=null;
    if(s.events>events){events=s.events;notice=names[s.order[s.events-1]]+'田埂出现缺口，水正在漏走！';}
    if(s.repairs>repairs){repairs=s.repairs;notice='缺口补住了，看看其他田的水位。';}
    const nextClimate=model.weather(s.elapsed);if(nextClimate!==climate){climate=nextClimate;notice=climate==='rain'?'雨势突然转急！及时关闭进水，按需排水。':'雨停了，排水口也要及时收住。';}
    if(Math.floor(s.elapsed)!==lastStored){lastStored=Math.floor(s.elapsed);save();}
    if(s.mode==='result'){save();render();return;}update();raf=requestAnimationFrame(tick);
  }
  const condition=f=>f.water<30?'缺水':f.water>70?'积水':'适宜';
  function render(){
    cancelAnimationFrame(raf);last=null;if(disposed)return;dialog.classList.add('water-dialog');
    if(s.mode==='result'){
      dialog.innerHTML=frame('这一季，守住了多少？','田间体验 02 / 守住三块田',`<div class="water-result"><div class="harvest-weight"><span>${model.harvest(s)}</span>斤 / 亩</div><p>修补 ${s.repairs} 处缺口，每一次开关水口，都留下了不同的结果。</p><div class="water-summary">${s.fields.map((f,i)=>`<div><b>${names[i]}</b><strong>${Math.round(f.health)}%</strong><span>稻苗保全度</span></div>`).join('')}</div><details class="harvest-details"><summary>这次收成怎么算？</summary><p>水位低于30或高于70会持续损伤稻苗，偏离越多损伤越快。三块田的保全度决定收成；以300斤为无灾参考，本关另保留15%的灾情损失，最高255斤。这里的水位、时间与收成都是教学游戏规则，不是农业预测。</p></details></div><div class="harvest-actions"><button class="secondary" id="water-retry">再守一季</button><button class="primary" id="water-finish">听爷爷接着讲 →</button></div>`);
      dialog.querySelector('#close-game').onclick=()=>dialog.close();press(dialog.querySelector('#water-retry'),()=>{s=results.waterWatch=model.fresh();events=0;repairs=0;climate='dry';notice='先观察水位，再决定开哪一道水口。';release();save();render();});press(dialog.querySelector('#water-finish'),()=>{dispose();finish();});return;
    }
    const paused=s.mode==='paused';
    dialog.innerHTML=frame('守住三块田','',`<div class="water-top"><span class="water-countdown">还剩 <b id="water-time">60</b> 秒</span><button class="text-button" id="water-pause">${paused?'继续':'暂停'}</button></div><p id="water-weather" role="status"></p><div class="water-fields">${s.fields.map((f,i)=>`<section class="water-field" data-water-field="${i}" aria-label="${names[i]}"><div class="water-field-title"><b>${names[i]}</b></div><div class="water-land">${img('research','water-art','')}<div class="water-rise"></div><span class="water-condition"></span><span class="water-leak" hidden>田埂漏水</span></div><div class="water-level"><span class="water-needle"></span></div><div class="water-readout"><span>水位 <b class="water-value"></b></span><span class="water-mode"></span></div><div class="water-health"><span></span></div><div class="water-health-label">稻苗 <b></b>%</div><div class="water-local-controls"><div class="water-gates">${[['in','引水'],['closed','关闭'],['out','排水']].map(([id,label])=>`<button data-field="${i}" data-water-gate="${id}" aria-label="${names[i]}${label}">${label}</button>`).join('')}</div><button data-water-repair="${i}" class="water-repair" aria-label="按住修补${names[i]}缺口"><span class="water-repair-label"></span><span class="water-repair-bar"></span></button></div></section>`).join('')}</div><div class="water-river"><span>适宜水位 30—70</span></div><p id="water-notice" class="water-notice" role="status"></p>${paused?'<div class="water-paused">已暂停，点击右上方“继续”</div>':''}`);
    wireImages(dialog);dialog.querySelector('#close-game').onclick=()=>dialog.close();
    dialog.querySelectorAll('[data-water-gate]').forEach(el=>press(el,()=>gate(Number(el.dataset.field),el.dataset.waterGate)));
    dialog.querySelectorAll('[data-water-repair]').forEach(button=>{button.onpointerdown=e=>{if(e.button!==0||button.disabled)return;e.preventDefault();button.setPointerCapture(e.pointerId);beginRepair(Number(button.dataset.waterRepair));};button.onpointerup=button.onpointercancel=button.onlostpointercapture=()=>{release();update();};button.onblur=()=>{release();update();};});
    press(dialog.querySelector('#water-pause'),()=>{release();s.mode=s.mode==='paused'?'playing':'paused';save();render();});update();if(s.mode==='playing')raf=requestAnimationFrame(tick);
  }
  function update(){
    if(disposed||s.mode==='result'||!dialog.querySelector('#water-time'))return;
    const climate=model.weather(s.elapsed),playing=s.mode==='playing';dialog.dataset.weather=climate;
    dialog.querySelector('#water-weather').textContent=climate==='dry'?'旱情 · 田里持续失水':climate==='rain'?'急雨 · 三块田都在涨水':'雨停 · 水位仍在变化';dialog.querySelector('#water-time').textContent=Math.ceil(60-s.elapsed);
    dialog.querySelectorAll('[data-water-field]').forEach((el,i)=>{const f=s.fields[i];el.querySelector('.water-rise').style.height=f.water+'%';el.querySelector('.water-needle').style.left=f.water+'%';el.querySelector('.water-value').textContent=Math.round(f.water);el.querySelector('.water-condition').textContent=condition(f);el.dataset.condition=condition(f);el.querySelector('.water-leak').hidden=!f.leak;el.querySelector('.water-mode').textContent={in:'引水中',closed:'水口关闭',out:'排水中'}[f.gate];el.querySelector('.water-health span').style.width=f.health+'%';el.querySelector('.water-health-label b').textContent=Math.round(f.health);});
    dialog.querySelectorAll('[data-water-gate]').forEach(el=>{el.disabled=!playing||repair!==null;el.setAttribute('aria-pressed',String(s.fields[Number(el.dataset.field)].gate===el.dataset.waterGate));});
    dialog.querySelectorAll('[data-water-repair]').forEach(button=>{const i=Number(button.dataset.waterRepair),field=s.fields[i];button.disabled=!playing||!field.leak||(repair!==null&&repair!==i);button.querySelector('.water-repair-label').textContent=!field.leak?'田埂完好':repair===i?`修补中 · ${Math.ceil(3-field.repair)}秒`:'按住修补 · 3秒';button.querySelector('.water-repair-bar').style.width=field.repair/3*100+'%';});
    const message=dialog.querySelector('#water-notice');if(message.textContent!==notice)message.textContent=notice;
  }
  document.addEventListener('keydown',onKey);document.addEventListener('keyup',onKeyUp);document.addEventListener('visibilitychange',pauseClock);window.addEventListener('blur',pauseClock);window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);render();save();return dispose;
}};
