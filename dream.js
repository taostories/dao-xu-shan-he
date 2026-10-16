(() => {
  'use strict';
  const points = [
    {id:'grain', at:14, label:'稻穗饱满', text:'梦里饱满的谷粒，寄托着对好种子、好收成的盼望。稻禾长得高，并不等于一定高产；真正的丰收，还要靠育种与田间管理。'},
    {id:'harvest', at:28, label:'粮食丰收', text:'从一株稻到一片田，多收一些粮食，辛苦一年的农人就多一份着落。可丰收不是凭空来的，你刚才守田、打谷时，也体会到了。'},
    {id:'food', at:42, label:'百姓不再挨饿', text:'盼稻穗饱满，盼粮食丰收，归根结底，是盼家家户户都能吃饱饭，不再为下一顿发愁。这是第一层梦最朴素的心愿。'},
    {id:'research', at:58, label:'继续钻研', text:'吃饱饭的心愿，要靠一代代人接着努力。气候在变，田里的难题也在变，好种子还要继续研究，种田的办法还要不断改进。'},
    {id:'land', at:72, label:'守护土地', text:'种子再好，也离不开养育它的土地。护好耕地、用好水，让田地长久地结出粮食，就是把前人的心愿接着往下做。'},
    {id:'cherish', at:86, label:'珍惜粮食', text:'接过梦想，不一定人人都要下田育种。像你今天这样，愿意走近稻田、了解粮食的来处，再从珍惜每一粒粮食做起，也是接续。'}
  ];
  const summary='一层，是让人吃饱；一层，是让这份安稳延续。';
  function normalize(value) {
    const found=value?.version===1&&Array.isArray(value.found)?points.filter(p=>value.found.includes(p.id)).map(p=>p.id):[];
    return {version:1,found,position:Number.isFinite(value?.position)?Math.max(6,Math.min(94,value.position)):50,merged:found.length===6&&value?.merged===true};
  }
  function mount({root,progress,save,img,wireImages,remember,finish}) {
    let disposed=false,dragging=false,engaged=false,timer=null,pending=null,active=null;
    const stopDwell=()=>{clearTimeout(timer);timer=null;pending=null;root.querySelectorAll('.dwelling').forEach(el=>el.classList.remove('dwelling'));};
    const found=id=>progress.found.includes(id);
    root.innerHTML=`<section class="dream-experience ${progress.merged?'dream-merged':''}" aria-label="探索禾下乘凉梦的两层含义">
      ${img('dusk','scene-image','想象中的禾下乘凉梦')}
      <div class="dream-surface">
        <div class="dream-layer dream-layer-first">${img('grain','dream-grain','')}</div>
        <div class="dream-layer dream-layer-second">${img('player','dream-player','')}</div>
        <div class="dream-readings">${[0,1].map(side=>`<section class="dream-reading"><h2>${side===0?'第一层梦<span>愿人人吃饱</span>':'第二层梦<span>愿后人接续</span>'}</h2><ul>${points.slice(side*3,side*3+3).map(p=>`<li><button data-dream-memory="${p.id}" ${found(p.id)?'':'disabled'}>${found(p.id)?p.label:'待探寻'}</button></li>`).join('')}</ul></section>`).join('')}</div>
        <div class="dream-controls">
          <div class="dream-track" aria-hidden="true">${points.map(p=>`<span class="dream-stop ${found(p.id)?'found':''}" data-stop="${p.id}" style="left:${p.at}%"></span>`).join('')}</div>
          <div class="dream-divider"><button class="dream-handle" role="slider" aria-label="拖动分界线探索两层梦" aria-describedby="dream-instruction" aria-valuemin="6" aria-valuemax="94" aria-valuenow="${progress.position}"><span aria-hidden="true">‹ ›</span></button></div>
        </div>
      </div>
      <section class="dream-caption" aria-label="探索讲解"><p id="dream-instruction">拖动分界线，在光点处稍作停留 · <span id="dream-count">${progress.found.length}</span>/6</p><div class="dream-speech"><span class="dream-speaker">李爷爷</span><p id="dream-response" aria-live="polite">${progress.merged?summary:'慢慢看，这两层梦就在同一片稻田里。一层是吃饱饭的心愿，一层是让这份心愿长久延续的守护。'}</p></div><div class="dream-actions"><button class="primary" id="dream-join" ${progress.found.length===6&&!progress.merged?'':'hidden'}>合看两层梦</button><button class="next-button" id="dream-continue" ${progress.merged?'':'hidden'}>听爷爷接着讲 →</button></div></section>
    </section>`;
    const shell=root.querySelector('.dream-experience'),surface=root.querySelector('.dream-surface'),handle=root.querySelector('.dream-handle'),response=root.querySelector('#dream-response');
    const blocked=()=>disposed||document.hidden||!!document.querySelector('dialog[open]');
    function paint() {
      shell.style.setProperty('--dream-split',progress.position+'%');
      shell.classList.toggle('dream-focus-first',progress.position<50);
      shell.classList.toggle('dream-focus-second',progress.position>50);
      handle.setAttribute('aria-valuenow',Math.round(progress.position));
      const near=points.find(p=>Math.abs(p.at-progress.position)<=4);
      handle.setAttribute('aria-valuetext',near?`${near.at<50?'第一层梦':'第二层梦'}，${near.label}${found(near.id)?'，已发现':''}`:'左右移动，寻找光点');
      root.querySelectorAll('[data-stop]').forEach(el=>el.classList.toggle('near',el.dataset.stop===near?.id));
    }
    function reveal(point) {
      if(blocked())return;
      active=point;response.textContent=point.text;
      if(!found(point.id)) {
        progress.found.push(point.id);
        root.querySelector(`[data-stop="${point.id}"]`).classList.add('found');
        const label=root.querySelector(`[data-dream-memory="${point.id}"]`);label.disabled=false;label.textContent=point.label;
        root.querySelector('#dream-count').textContent=progress.found.length;
        remember('李爷爷',point.text);save();
      }
      root.querySelectorAll('[data-dream-memory]').forEach(el=>el.classList.toggle('selected',el.dataset.dreamMemory===point.id));
      root.querySelector('#dream-join').hidden=progress.found.length!==6;
      paint();
    }
    function inspect() {
      if(blocked()||progress.merged||!engaged)return;
      const point=points.find(p=>Math.abs(p.at-progress.position)<=4);
      if(!point){stopDwell();return;}
      if(pending===point.id||active?.id===point.id)return;
      stopDwell();pending=point.id;
      root.querySelector(`[data-stop="${point.id}"]`).classList.add('dwelling');
      timer=setTimeout(()=>{stopDwell();reveal(point);},700);
    }
    function move(value) {progress.position=Math.max(6,Math.min(94,value));paint();inspect();}
    function pointerMove(e) {if(!dragging)return;const rect=surface.getBoundingClientRect();move((e.clientX-rect.left)/rect.width*100);}
    handle.onpointerdown=e=>{
      if(e.button!==0||blocked()||progress.merged)return;
      e.preventDefault();dragging=true;engaged=true;handle.focus();handle.setPointerCapture(e.pointerId);pointerMove(e);
    };
    handle.onpointermove=pointerMove;
    handle.onpointerup=()=>{dragging=false;save();};
    handle.onpointercancel=()=>{dragging=false;engaged=false;stopDwell();save();};
    handle.onkeydown=e=>{
      if(blocked()||progress.merged)return;
      const direction=['ArrowLeft','ArrowDown'].includes(e.key)?-1:['ArrowRight','ArrowUp'].includes(e.key)?1:0;
      if(!direction&&!['Home','End'].includes(e.key))return;
      e.preventDefault();engaged=true;
      const targets=points.map(p=>p.at);
      move(e.key==='Home'?14:e.key==='End'?86:direction<0?targets.filter(v=>v<progress.position-1).at(-1)??6:targets.find(v=>v>progress.position+1)??94);
      save();
    };
    handle.onblur=()=>{engaged=false;stopDwell();};
    root.querySelectorAll('[data-dream-memory]').forEach(button=>button.onclick=()=>{stopDwell();active=points.find(p=>p.id===button.dataset.dreamMemory);response.textContent=active.text;root.querySelectorAll('[data-dream-memory]').forEach(el=>el.classList.toggle('selected',el===button));});
    function merge() {
      if(progress.found.length!==6)return;
      stopDwell();engaged=false;progress.merged=true;save();remember('',summary);save();
      shell.classList.add('dream-merged');handle.disabled=true;response.textContent=summary;
      root.querySelector('#dream-instruction').textContent='两层梦，相连在同一片稻田里';
      root.querySelector('.dream-speaker').hidden=true;
      root.querySelector('#dream-join').hidden=true;
      root.querySelector('#dream-continue').hidden=false;
      root.querySelector('#dream-continue').focus({preventScroll:true});
    }
    root.querySelector('#dream-join').onclick=merge;
    root.querySelector('#dream-continue').onclick=()=>{if(progress.merged)finish();};
    const pause=()=>{if(document.hidden){stopDwell();engaged=false;}};
    document.addEventListener('visibilitychange',pause);
    const modalObserver=new MutationObserver(()=>{if(blocked()){stopDwell();engaged=false;}});
    document.querySelectorAll('dialog').forEach(d=>modalObserver.observe(d,{attributes:true,attributeFilter:['open']}));
    if(progress.merged){handle.disabled=true;root.querySelector('#dream-instruction').textContent='两层梦，相连在同一片稻田里';root.querySelector('.dream-speaker').hidden=true;}
    paint();wireImages(root);
    return ()=>{disposed=true;stopDwell();modalObserver.disconnect();document.removeEventListener('visibilitychange',pause);};
  }
  window.RiceDream={mount,normalize};
})();
