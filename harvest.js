/* 打谷入仓：动画只在游戏打开、标签可见时运行，阶段与成绩即时存档。 */
window.RiceHarvest = {
  mount({dialog, results, save, finish, frame, img, wireImages}) {
    let r=results.harvest;
    if(!r||r.version!==1) r=results.harvest={version:1,stage:'thresh',hits:0,grain:0,dirt:6,lost:0,tosses:0,perfect:0};
    let raf=0,disposed=false,elapsed=0,last=0,cooldown=0,position=0,feedback='';
    const stop=()=>{cancelAnimationFrame(raf);raf=0;};
    const dispose=()=>{disposed=true;stop();};
    function press(button,action) {
      let touchStart=null;
      button.onpointerdown=e=>{if(e.pointerType==='touch'){e.preventDefault();touchStart={x:e.clientX,y:e.clientY};}};
      button.onpointerup=e=>{if(e.pointerType==='touch'&&touchStart){const moved=Math.hypot(e.clientX-touchStart.x,e.clientY-touchStart.y);touchStart=null;if(moved<10&&!button.disabled)action();}};
      button.onpointercancel=()=>{touchStart=null;};
      button.onclick=e=>{if(e.pointerType!=='touch')action();};
    }
    const asset=(id,cls='')=>`<div class="harvest-art ${cls}">${img(id,'','')}<span class="art-empty">${({bundle:'稻束',tray:'竹匾',grain:'稻谷',scale:'秤盘'})[id]||''}</span></div>`;
    const steps=()=>`<ol class="harvest-steps" aria-label="打谷步骤">${[['thresh','脱粒'],['winnow','扬谷'],['weigh','称重']].map(([id,label],i)=>`<li ${r.stage===id||r.stage==='result'&&id==='weigh'?'aria-current="step"':''}><span>${i+1}</span>${label}</li>`).join('')}</ol>`;
    function render() {
      stop();last=0;if(disposed)return;
      let body='';
      if(r.stage==='thresh') body=`<p class="harvest-instruction">指针进入绿色区域时，按下“打谷”。</p><div class="harvest-workbench">${asset('bundle')}<div class="harvest-count"><span>已经脱粒</span><strong>${r.hits} / 6</strong></div></div><div class="beat-track" aria-label="节奏区域"><span class="beat-zone"></span><span class="beat-pointer" id="beat-pointer"></span></div><div class="harvest-feedback" role="status">${feedback||'慢慢来，先看一遍节奏。'}</div><div class="harvest-actions"><button class="primary" id="thresh-button">打谷</button></div>`;
      if(r.stage==='winnow') body=`<p class="harvest-instruction">${matchMedia('(pointer: coarse)').matches?'按住竹匾左右拖动，松手扬谷。':'用鼠标左键按住竹匾左右拖动，松开扬谷。'}幅度落在绿色区域最稳。</p><div class="winnow-pad" id="winnow-pad" tabindex="0" role="slider" aria-label="扬谷幅度，左右方向键调节，回车扬谷" aria-valuemin="0" aria-valuemax="100" aria-valuenow="35"><div class="tray-assembly" id="tray-assembly">${asset('tray')}${img('grain','tray-grain','')}${img('chaff','tray-chaff','')}</div><div class="harvest-count"><span>剩余杂屑</span><strong>${r.dirt} / 6</strong></div></div><div class="toss-track"><span class="toss-zone"></span><span class="beat-pointer" id="toss-pointer" style="left:35%"></span></div><div class="harvest-feedback" role="status">${feedback||'手稳一些，别把谷粒也扬出去。'}</div>`;
      if(r.stage==='weigh') body=`<p class="harvest-instruction">把竹匾拖到秤盘上，称一称留下的谷子。</p><div class="weigh-station"><div class="weigh-tray" id="weigh-tray" tabindex="0" role="button" aria-label="竹匾，按回车倒入秤盘">${asset('tray')}${img('grain','tray-grain','')}</div><div class="weigh-scale" id="weigh-scale">${asset('scale')}</div></div><div class="harvest-feedback" role="status">${feedback||'杂屑已经扬净，可以上秤了。'}</div><div class="harvest-actions"><button class="primary" id="pour-button">倒入秤盘 →</button></div>`;
      if(r.stage==='result') body=`<div class="harvest-result">${asset('scale')}<p>这一把，你留下了</p><div class="harvest-weight"><span>${r.grain}</span> 克</div><p class="harvest-verdict">${r.lost===0?'手稳，粮也留得稳。':'扬谷有些损耗，下回放轻些。'}</p></div><details class="harvest-details"><summary>看看这次的收获</summary><p>6 次脱粒，${r.perfect} 次踩准节奏；扬去杂屑时损失 ${r.lost} 克。</p><p>重量来自本关的互动规则，仅作劳动体验示意，不能换算成亩产。</p></details><div class="harvest-actions"><button class="secondary" id="harvest-retry">再试一次</button><button class="primary" id="harvest-finish">听爷爷接着讲 →</button></div>`;
      dialog.innerHTML=frame('打谷入仓','田间体验 01',steps()+body);wireImages(dialog);
      dialog.querySelector('#close-game').onclick=()=>dialog.close();
      if(r.stage==='thresh') bindThresh();
      if(r.stage==='winnow') bindWinnow();
      if(r.stage==='weigh') bindWeigh();
      if(r.stage==='result') {
        press(dialog.querySelector('#harvest-finish'),()=>{dispose();finish();});
        press(dialog.querySelector('#harvest-retry'),()=>{r=results.harvest={version:1,stage:'thresh',hits:0,grain:0,dirt:6,lost:0,tosses:0,perfect:0};feedback='';elapsed=0;cooldown=0;save();render();});
      }
      save();
    }
    function bindThresh() {
      const marker=dialog.querySelector('#beat-pointer'),button=dialog.querySelector('#thresh-button');
      button.disabled=performance.now()<cooldown;
      function tick(now) {
        if(disposed||!marker.isConnected)return;
        if(last&&dialog.open&&!document.hidden)elapsed+=Math.min(now-last,80);
        last=now;
        position=(1-Math.cos(elapsed/2800*Math.PI*2))*50;
        marker.style.left=`${position}%`;
        button.disabled=now<cooldown;
        raf=requestAnimationFrame(tick);
      }
      raf=requestAnimationFrame(tick);
      press(button,()=>{
        if(performance.now()<cooldown)return;
        const perfect=position>=40&&position<=60,near=position>=23&&position<=77;
        const gain=perfect?40:near?28:16;
        r.hits++;r.grain+=gain;if(perfect)r.perfect++;
        feedback=perfect?'正好！这一把打得干净。':near?'节奏差一点，再稳一稳。':'偏早或偏晚了，先看准指针。';
        cooldown=performance.now()+400;
        if(r.hits>=6){r.stage='winnow';feedback='谷子打下来了，接着把杂屑扬净。';}
        save();render();
      });
    }
    function bindWinnow() {
      const pad=dialog.querySelector('#winnow-pad'),tray=dialog.querySelector('#tray-assembly'),marker=dialog.querySelector('#toss-pointer');
      const chaff=pad.querySelector('.tray-chaff');chaff.style.opacity=r.dirt/6;
      let start=null,min=0,max=0,strength=.35,pointerId=null;
      function setStrength(value) {strength=Math.min(1,Math.max(0,value));marker.style.left=`${strength*100}%`;pad.setAttribute('aria-valuenow',Math.round(strength*100));}
      function toss() {
        if(strength<.10){dialog.querySelector('.harvest-feedback').textContent='幅度太小，杂屑还没扬起来。';return;}
        const strong=strength>.55,weak=strength<.25;
        r.dirt=Math.max(0,r.dirt-(weak?1:2));r.tosses++;
        if(strong){const loss=Math.min(8,r.grain);r.grain-=loss;r.lost+=loss;}
        feedback=strong?'用力过猛，杂屑扬走了，也掉了些谷子。':weak?'轻轻一扬，去掉了一些杂屑。':'幅度刚好，杂屑走了，谷子留住了。';
        if(!r.dirt)r.stage='weigh';save();render();
      }
      pad.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();pointerId=e.pointerId;pad.setPointerCapture(pointerId);start=e.clientX;min=max=start;setStrength(0);};
      pad.onpointermove=e=>{if(start===null||pointerId!==e.pointerId)return;min=Math.min(min,e.clientX);max=Math.max(max,e.clientX);setStrength((max-min)/pad.clientWidth*2);tray.style.transform=`translateX(${Math.max(-65,Math.min(65,e.clientX-start))}px)`;};
      pad.onpointerup=e=>{if(start===null||pointerId!==e.pointerId)return;start=null;if(pad.hasPointerCapture(e.pointerId))pad.releasePointerCapture(e.pointerId);toss();};
      pad.onpointercancel=()=>{start=null;tray.style.transform='';setStrength(.35);};
      pad.onkeydown=e=>{if(e.repeat&&e.key==='Enter')return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setStrength(strength+(e.key==='ArrowRight'?.05:-.05));}if(e.key==='Enter'||e.code==='Space'){e.preventDefault();toss();}};
    }
    function bindWeigh() {
      const tray=dialog.querySelector('#weigh-tray'),scale=dialog.querySelector('#weigh-scale');let start=null,pointerId=null;
      function pour(){if(r.stage!=='weigh')return;r.stage='result';r.done=true;save();render();}
      press(dialog.querySelector('#pour-button'),pour);
      tray.onkeydown=e=>{if(e.key==='Enter'||e.code==='Space'){e.preventDefault();pour();}};
      tray.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();start={x:e.clientX,y:e.clientY};pointerId=e.pointerId;tray.setPointerCapture(pointerId);};
      tray.onpointermove=e=>{if(!start||pointerId!==e.pointerId)return;tray.style.transform=`translate(${e.clientX-start.x}px,${e.clientY-start.y}px)`;const b=scale.getBoundingClientRect();scale.classList.toggle('ready',e.clientX>=b.left&&e.clientX<=b.right&&e.clientY>=b.top&&e.clientY<=b.bottom);};
      tray.onpointerup=e=>{if(!start||pointerId!==e.pointerId)return;const b=scale.getBoundingClientRect();start=null;if(tray.hasPointerCapture(e.pointerId))tray.releasePointerCapture(e.pointerId);tray.style.transform='';scale.classList.remove('ready');if(e.clientX>=b.left&&e.clientX<=b.right&&e.clientY>=b.top&&e.clientY<=b.bottom)pour();};
      tray.onpointercancel=()=>{start=null;tray.style.transform='';scale.classList.remove('ready');};
    }
    render();return dispose;
  }
};
