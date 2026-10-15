(() => {
  'use strict';
  const {chapters, nodes, art, dreams, legacyGrowthIndexMap} = window.RICE_STORY;
  const app = document.querySelector('#app');
  const gameDialog = document.querySelector('#game-dialog');
  const drawer = document.querySelector('#drawer');
  const SAVE_KEY = 'daoxu-story-v1';
  const defaults = () => ({index:0, unlocked:0, started:false, finished:false, results:{}, dreamAnswers:[], dreamQuestion:0, dreamRevision:1, dreamActive:null, memories:[], largeText:false, epilogueRevision:2});
  let state = defaults(), showingCover = true, temporaryArt = new Map(), db;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if(saved&&saved.storyRevision!==2){
      if(Number.isInteger(saved.index))saved.index=legacyGrowthIndexMap[saved.index]??saved.index;
      if(Array.isArray(saved.memories))saved.memories=saved.memories.map(m=>{
        const parts=String(m.key).split(':'),oldIndex=Number(parts.shift());
        return {...m,key:legacyGrowthIndexMap[oldIndex]!==undefined?legacyGrowthIndexMap[oldIndex]+':'+parts.join(':'):m.key};
      });
      saved.storyRevision=2;
    }
    if (saved && Number.isInteger(saved.index) && saved.index >= 0 && saved.index < nodes.length) {
      state = {...defaults(), ...saved};
      state.unlocked = Math.max(0,Math.min(3,Number(state.unlocked)||0));
      state.dreamAnswers = Array.isArray(saved.dreamAnswers) ? saved.dreamAnswers.slice(0,2).filter((id,i)=>dreams[i].options.some(o=>o.id===id)) : [];
      state.dreamQuestion = state.dreamAnswers.length===2 ? 1 : 0;
      if(saved.dreamQuestion===1&&state.dreamAnswers.length>=1)state.dreamQuestion=1;
      state.dreamActive = dreams[state.dreamQuestion].options.some(o=>o.id===saved.dreamActive)&&state.dreamAnswers[state.dreamQuestion]===saved.dreamActive ? saved.dreamActive : null;
      if(saved.dreamRevision!==1){state.dreamAnswers=[];state.dreamQuestion=0;state.dreamActive=null;state.dreamRevision=1;state.memories=Array.isArray(saved.memories)?saved.memories.filter(m=>Number(String(m.key).split(':')[0])!==nodes.findIndex(n=>n.type==='dream')):[];}

      state.memories = Array.isArray(state.memories) ? state.memories : [];
      state.results = state.results && typeof state.results === 'object' ? state.results : {};
      const epilogueStart=nodes.findIndex(n=>n.type==='dream')+1;
      if(saved.epilogueRevision!==2){
        if(state.index>=epilogueStart){state.index=epilogueStart;state.finished=false;state.dreamActive=null;}
        state.memories=state.memories.filter(m=>Number(String(m.key).split(':')[0])<epilogueStart);
        state.epilogueRevision=2;
      }
    }
  } catch (_) { /* Storage can be unavailable when opening local files. */ }
  state.memories=state.memories.map(m=>{
    const index=Number(String(m.key).split(':')[0]),node=nodes[index];
    return node?.type==='walk'?{...m,key:index+':'+node.text,who:'',text:node.text}:m;
  }).filter((m,i,all)=>all.findIndex(other=>other.key===m.key)===i);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const artSrc = id => temporaryArt.get(id) || `assets/${art.find(a=>a.id===id).file}`;
  const img = (id, cls='', alt='') => `<img class="${cls}" data-art="${id}" src="${esc(artSrc(id))}" alt="${esc(alt)}" decoding="async"${cls==='scene-image'?' fetchpriority="high"':''}>`;
  const warmedImages = new Map();
  let warmRevision = 0;
  function prepareNextImages(ids) {
    const revision = ++warmRevision;
    if(navigator.connection?.saveData)return;
    // Finish the visible artwork first; speculative requests must not delay it.
    const visible = [...app.querySelectorAll('img')];
    Promise.allSettled(visible.map(el=>el.decode())).then(()=>setTimeout(async()=>{
      for(const id of [...new Set(ids)].filter(Boolean)){
        if(revision!==warmRevision)return;
        const src=artSrc(id);
        if(warmedImages.has(src))continue;
        const preview=new Image();preview.decoding='async';preview.fetchPriority='low';
        warmedImages.set(src,preview);
        preview.src=src;
        try{await preview.decode();}catch(_){warmedImages.delete(src);}
      }
    },200));
  }
  function wireImages(root=document) {
    root.querySelectorAll('img[data-art]').forEach(el => {
      const success = () => {
        el.hidden = false;
        const placeholder = el.parentElement.querySelector(':scope > .placeholder-label, :scope > .stage-placeholder, :scope > .art-empty');
        if (placeholder && el.className !== 'character') placeholder.classList.add('hidden');
        if (el.parentElement.classList.contains('rice-tile')) el.parentElement.classList.add('has-art');
      };
      const failure = () => {el.hidden=true;el.parentElement.classList.remove('has-art');};
      el.onload=success; el.onerror=failure;
      if(el.complete) el.naturalWidth ? success() : failure();
    });
  }
  function save() {
    state.storyRevision=2;
    try {localStorage.setItem(SAVE_KEY, JSON.stringify(state));}
    catch (_) {document.querySelector('#save-state').textContent='本次进度暂未保存';}
  }
  function toast(text) {
    const el=document.querySelector('#toast');el.textContent=text;el.classList.add('visible');
    clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),2800);
  }
  function remember(who,text) {
    if (!text) return;
    const key=`${state.index}:${text}`;
    if (!state.memories.some(m=>m.key===key)) state.memories.push({key,who,text,chapter:nodes[state.index].chapter});
  }
  function renderCover() {
    showingCover=true;
    const inProgress=state.started&&!state.finished;
    app.innerHTML=`<section class="ending opening-screen">${img('cover','scene-image','清晨稻田主页面')}<div class="ending-content"><h1 class="cover-title"><img src="assets/00-title.webp" alt="稻续山河" width="1857" height="658"></h1><p>一粒稻种，<br>一场未完的梦。</p><div class="ending-buttons"><button class="primary" id="start-button">${inProgress?'继续故事':'走进稻乡'}</button>${inProgress?'<button class="secondary" id="restart-cover">重新启程</button>':''}</div></div></section>`;
    document.querySelector('#start-button').onclick=()=>{
      if(state.finished)state={...defaults(),largeText:state.largeText,hasCompleted:true};
      state.started=true;save();renderStory();
    };
    document.querySelector('#restart-cover')?.addEventListener('click',restartPrompt);
    wireImages(app);
    const resume=nodes[state.finished?0:state.index];
    prepareNextImages([resume.scene||chapters[resume.chapter].scene,...(resume.chapter===2?['rice-normal','rice-special']:[]),'grandpa','player']);
  }
  function currentText(node) {
    if(node.dynamic==='harvest-reflection')return state.results.harvest?.lost>0?'刚才我只想着把杂屑扬干净，手一重，连谷子也扬出去了。以前说“别浪费粮食”，到了自己手上，才知道留下它也得有耐心。':'这一把谷子就得这么仔细，才能稳稳留下来。我以前只看见碗里的饭，还真没想过，前面有这么多道工夫。';
    if(node.dynamic==='search-reflection')return state.results.search?.success?'找到的时候，我还挺高兴的。可这里只看了几株，真到了整片田里，得弯多少次腰、看多久，才能遇见这样一点不同啊。':'才看了这么几株，我就想赶紧知道答案了。他们却要在整片田里一株株找，找不到，第二天还得接着找。';
    if(node.dynamic==='search-result') return state.results.search?.success ? '好眼力！你留意到了花药的差别。当年，寻找特殊稻株需要这样的细心，更需要日复一日的耐心。一次发现背后，是许许多多次弯腰查看。' : '不容易吧？在大片稻田里找出细微的差别，就像大海捞针。机会用完了也没关系，你已经体会到观察需要多大的耐心。科研人员的寻找，还要一天一天继续。';
    return node.text || '';
  }
  function renderStory() {
    showingCover=false;
    const node=nodes[state.index], c=chapters[node.chapter];
    state.unlocked=Math.max(state.unlocked,node.chapter);
    document.body.classList.toggle('large-text',state.largeText);
    if(node.type==='ending') {renderEnding();return;}
    const scene=node.scene||c.scene;
    const night=scene==='night'||scene==='epilogue';
    let text=currentText(node), who=node.who, choices='', action='点击继续';
    if(node.type==='walk'){action=node.label;}
    if(node.type==='game'){action='开始田间体验';}
    if(node.type==='dream') {
      const question=dreams[state.dreamQuestion];
      who='李爷爷';
      if(state.dreamActive){text=question.options.find(o=>o.id===state.dreamActive).text;}
      else {
        text=question.question;
        choices=`<div class="dream-options">${question.options.map(o=>`<button class="dream-option" data-dream="${o.id}">${esc(o.label)}</button>`).join('')}</div>`;
        action='';
      }
    }
    const portrait = !node.opening && !node.panorama && !night && node.type !== 'walk' ? (who === '你' ? 'player' : who === '李爷爷' ? 'grandpa' : null) : null;
    remember(who,text);save();
    const within=nodes.filter(n=>n.chapter===node.chapter), position=within.indexOf(node)+1;
    app.innerHTML=`<section class="story-shell ${night?'night':''} ${node.type==='dream'?'dream-mode':''} ${node.panorama?'panorama':''}">${img(scene,'scene-image','')}<div class="scene-shade"></div><div class="stage">${portrait?img(portrait,'character character-'+portrait,who):''}</div><section class="dialogue ${node.type==='walk'?'scene-caption':''}" aria-label="${node.type==='walk'?'场景描写':'剧情对白'}">${who?`<div class="speaker">${who}</div>`:''}<div class="dialogue-main">${state.dreamActive&&node.type==='dream'?choices:''}<p class="dialogue-text" aria-live="polite">${esc(text)}</p>${!state.dreamActive&&node.type==='dream'?choices:''}<div class="dialogue-foot">${action?`<button class="next-button" id="next-button">${action}<span aria-hidden="true">→</span></button>`:''}</div></div></section><div class="chapter-progress" role="progressbar" aria-label="本章进度" aria-valuenow="${position}" aria-valuemin="0" aria-valuemax="${within.length}"><span style="width:${position/within.length*100}%"></span></div></section>`;
    document.querySelector('#next-button')?.addEventListener('click',advance);
    app.querySelectorAll('[data-dream]').forEach(b=>b.onclick=()=>{
      if(state.dreamActive)return;
      const option=dreams[state.dreamQuestion].options.find(o=>o.id===b.dataset.dream);
      if(!option)return;
      remember('你',option.label);state.dreamActive=option.id;state.dreamAnswers[state.dreamQuestion]=option.id;renderStory();
    });
    wireImages(app);
    const nextScene=nodes.slice(state.index+1).map(n=>n.scene||chapters[n.chapter].scene).find(id=>id!==scene);
    prepareNextImages([...(node.chapter===2?['rice-normal','rice-special']:[]),!night?(portrait==='player'?'grandpa':'player'):null,nextScene,...(nextScene==='research'?['rice-normal','rice-special']:[])]);
  }
  function advance() {
    const node=nodes[state.index];
    if(node.type==='game') {openGame(node.game);return;}
    if(node.type==='dream') {
      if(!state.dreamActive)return;
      state.dreamActive=null;
      if(state.dreamQuestion===0){state.dreamQuestion=1;renderStory();return;}
    }
    state.index=Math.min(state.index+1,nodes.length-1);renderStory();
  }
  function renderEnding() {
    ++warmRevision;
    showingCover=false;state.finished=true;state.hasCompleted=true;save();
    app.innerHTML=`<section class="ending finale">${img('epilogue','scene-image','星河稻田中的老人和青年')}<div class="ending-content"><h1 class="cover-title"><img src="assets/00-title.webp" alt="稻续山河" width="1857" height="658"></h1><p>前人种下稻种，<br>我们继续守护山河稻香。</p><div class="ending-buttons"><button class="primary" id="ending-memory">回望沿途记忆</button><button class="secondary" id="ending-home">回到主页面</button></div></div></section>`;
    document.querySelector('#ending-memory').onclick=showChapters;
    document.querySelector('#ending-home').onclick=renderCover;
    wireImages(app);
  }
  function chapterChoices(){
    return `<nav class="replay-chapters" aria-label="选择章节重新体验">${chapters.map((c,i)=>`<button class="replay-chapter" data-replay-chapter="${i}">${c.name}</button>`).join('')}</nav>`;
  }
  function bindChapterChoices(root){
    root.querySelectorAll('[data-replay-chapter]').forEach(button=>button.onclick=()=>{
      const chapter=Number(button.dataset.replayChapter);
      state.index=nodes.findIndex(n=>n.chapter===chapter);state.started=true;state.finished=false;
      const keys=[['harvest','yield'],['waterWatch','fieldRescue','weather'],['search']];
      keys.forEach((list,i)=>{if(i>=chapter)list.forEach(key=>delete state.results[key]);});
      state.dreamAnswers=[];state.dreamQuestion=0;state.dreamActive=null;
      if(drawer.open)drawer.close();save();renderStory();
    });
  }
  function showChapters(){showDrawer('选择章节',chapterChoices(),'');bindChapterChoices(drawer);}
  function modalFrame(title,kicker,body) {
    return `<header class="modal-head"><div><div class="kicker">${kicker}</div><h2 id="game-title">${title}</h2></div><button class="close-button" id="close-game" aria-label="暂时收起小游戏">×</button></header><div class="modal-body">${body}</div>`;
  }
  function openGame(id) {
    if(id==='yield')renderYield();
    if(id==='weather')renderWeather();
    if(id==='search')renderSearch();
    if(!gameDialog.open)gameDialog.showModal();
  }
  function bindCloseGame(){gameDialog.querySelector('#close-game').onclick=()=>gameDialog.close();}
  function finishGame(){gameDialog.close();state.index++;renderStory();}
  let harvestCleanup=null;
  gameDialog.addEventListener('close',()=>{harvestCleanup?.();harvestCleanup=null;});
  function renderYield() {
    harvestCleanup?.();
    harvestCleanup=window.RiceHarvest.mount({dialog:gameDialog,results:state.results,save,finish:finishGame,frame:modalFrame,img,wireImages});
  }
  let rescueCleanup=null;
  gameDialog.addEventListener('close',()=>{rescueCleanup?.();rescueCleanup=null;});
  function renderWeather() {
    rescueCleanup?.();
    rescueCleanup=window.RiceFieldRescue.mount({dialog:gameDialog,results:state.results,save,finish:finishGame,frame:modalFrame,img,wireImages});
  }
  function renderSearch() {
    const r=state.results.search||{target:Math.floor(Math.random()*12),wrong:[],done:false,success:false};state.results.search=r;save();
    gameDialog.innerHTML=modalFrame('稻海之中，寻找一点不同','田间体验 03 / 稻株寻穗',`<p class="hint">移动或拖动光圈观察，点选你认为特殊的那株。目标特征：<strong>花药细瘦、颜色偏浅</strong>。手机先拖动观察，再轻点确认；键盘可用 Tab 观察、Enter 选择。</p><div class="search-toolbar"><span>12 株稻穗 · 简化形态观察</span><span>剩余机会 <strong id="chances">${3-r.wrong.length}</strong> / 3</span></div><div class="search-field" id="search-field" aria-label="稻穗观察区">${Array.from({length:12},(_,i)=>`<button class="rice-tile ${r.wrong.includes(i)?'wrong':''} ${r.done?'revealed':''} ${r.done&&i===r.target?'correct':''}" data-plant="${i}" aria-label="观察第 ${i+1} 株稻穗" ${r.done||r.wrong.includes(i)?'disabled':''}><span class="plant-number">${String(i+1).padStart(2,'0')} 号稻穗</span>${img(i===r.target?'rice-special':'rice-normal','','')}<span class="trait">${i===r.target?'细瘦 · 色浅':'饱满 · 偏黄'}</span></button>`).join('')}<div class="beam-shade" ${r.done?'hidden':''}></div></div><div class="search-feedback" id="search-feedback" role="status">${r.done?r.success?'找到啦。你留意到了花药的细微差别。':'三次观察机会用完了。标记出的那株，就是本关目标。':r.wrong.length?'这株的花药偏黄、饱满。再细看一次。':'先观察花药，再做判断。'}</div><footer class="game-footer"><button class="primary" id="search-submit" ${r.done?'':'disabled'}>听爷爷接着讲 →</button></footer>`);
    bindCloseGame();wireImages(gameDialog);
    const field=gameDialog.querySelector('#search-field');
    const tiles=[...field.querySelectorAll('[data-plant]')];
    let pointerStart=null,dragged=false;
    function reveal(x,y) {
      if(r.done)return;
      const rect=field.getBoundingClientRect();field.style.setProperty('--beam-x',`${x-rect.left}px`);field.style.setProperty('--beam-y',`${y-rect.top}px`);
      tiles.forEach(t=>{const b=t.getBoundingClientRect();const lit=Math.hypot(b.left+b.width/2-x,b.top+b.height/2-y)<105;t.classList.toggle('revealed',lit);t.setAttribute('aria-label',`第 ${Number(t.dataset.plant)+1} 株稻穗${lit?'，'+(Number(t.dataset.plant)===r.target?'花药细瘦、色浅':'花药饱满、偏黄'):''}`);});
    }
    function choose(tile) {
      if(!tile||r.done||!tile.classList.contains('revealed'))return;
      const choice=Number(tile.dataset.plant);
      if(r.wrong.includes(choice))return;
      if(choice===r.target){r.success=true;r.done=true;}else{r.wrong.push(choice);r.done=r.wrong.length>=3;}
      save();renderSearch();
    }
    field.onpointerdown=e=>{if(e.pointerType==='touch')e.preventDefault();pointerStart={x:e.clientX,y:e.clientY};dragged=false;reveal(e.clientX,e.clientY);};
    field.onpointermove=e=>{if(pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>8)dragged=true;reveal(e.clientX,e.clientY);};
    field.onpointerup=e=>{pointerStart=null;if(e.pointerType==='touch'&&!dragged)choose(e.target.closest('[data-plant]'));};
    field.onpointercancel=()=>{pointerStart=null;dragged=true;};
    tiles.forEach(t=>{
      t.onfocus=()=>{const b=t.getBoundingClientRect();reveal(b.left+b.width/2,b.top+b.height/2);};
      t.onclick=e=>{
        if(e.pointerType==='touch')return;
        if(r.done||r.wrong.includes(Number(t.dataset.plant)))return;
        if(e.detail!==0&&dragged){dragged=false;return;}
        if(!t.classList.contains('revealed'))return;
        choose(t);
      };
    });
    gameDialog.querySelector('#search-submit').onclick=finishGame;
    requestAnimationFrame(()=>{if(field.isConnected&&!r.done){const b=field.getBoundingClientRect();reveal(b.left+b.width/2,b.top+b.height/2);}});
  }
  function showDrawer(title,body,kicker='稻续山河') {
    drawer.innerHTML=`<header class="modal-head"><div><div class="kicker">${kicker}</div><h2 id="drawer-title">${title}</h2></div><button class="close-button" id="close-drawer" aria-label="关闭面板">×</button></header><div class="drawer-body">${body}</div>`;
    drawer.querySelector('#close-drawer').onclick=()=>drawer.close();
    if(!drawer.open)drawer.showModal();wireImages(drawer);
  }
  function showMemories() {
    showDrawer('沿途记忆',state.memories.length?state.memories.map(m=>`<article class="memory-item"><b>${chapters[m.chapter]?.name||''}${m.who?' · '+esc(m.who):''}</b><p>${esc(m.text).replace(/\n/g,'<br>')}</p></article>`).join(''):'<p>田间之旅还未启程。听过的对白会留在这里，随时可以回看。</p>','回望 / 已读对白');
  }
  function restartPrompt() {
    showDrawer('重新走一次田埂？','<p>重新启程会清空这次的剧情进度、小游戏结果和沿途记忆。你的画稿会保留。</p><div class="cover-buttons"><button class="primary" id="confirm-restart">重新启程</button><button class="secondary" id="cancel-restart">留在此刻</button></div>');
    drawer.querySelector('#cancel-restart').onclick=()=>drawer.close();
    drawer.querySelector('#confirm-restart').onclick=()=>{const largeText=state.largeText;state=defaults();state.largeText=largeText;state.started=true;save();drawer.close();renderStory();};
  }
  function showSettings() {
    showDrawer('旅途设置',`<div class="setting-row"><div><h3>较大对白文字</h3><p>让阅读更轻松</p></div><input type="checkbox" id="large-text" aria-label="较大对白文字" ${state.largeText?'checked':''}></div><div class="setting-row"><div><h3>重新启程</h3><p>从清晨田埂开始，画稿会保留</p></div><button class="secondary" id="restart-settings">重置进度</button></div><div class="setting-row"><div><h3>返回封面</h3><p>保留当前进度</p></div><button class="secondary" id="back-cover">返回</button></div><p class="notice">操作：点击按钮推进对白，也可使用空格键。小游戏与选择题需要完成相应交互。进度保存在当前浏览器；清理网站数据会删除存档。<br><br>本作人物与具体村庄经历为虚构；仅出场你与老年李爷爷。袁先生的故事由李爷爷讲述，不设置穿越、画外音或手稿交互。两层梦是本作的主题理解，不是对原话的逐字引用。所有画面由创作者提供。</p>`);
    drawer.querySelector('#large-text').onchange=e=>{state.largeText=e.target.checked;document.body.classList.toggle('large-text',state.largeText);save();};
    drawer.querySelector('#restart-settings').onclick=restartPrompt;
    drawer.querySelector('#back-cover').onclick=()=>{drawer.close();renderCover();};
  }
  async function initArt() {
    try {
      db=await new Promise((resolve,reject)=>{
        const req=indexedDB.open('daoxu-art-v1',1);
        req.onupgradeneeded=()=>req.result.createObjectStore('images');
        req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      });
      const records=await new Promise((resolve,reject)=>{
        const tx=db.transaction('images','readonly'),store=tx.objectStore('images'),out=[];
        const req=store.openCursor();req.onsuccess=()=>{const cursor=req.result;if(cursor){out.push([cursor.key,cursor.value]);cursor.continue();}else resolve(out);};req.onerror=()=>reject(req.error);
      });
      records.forEach(([id,blob])=>temporaryArt.set(id,URL.createObjectURL(blob)));
      if(records.length)showingCover?renderCover():renderStory();
    } catch (_) {db=null;}
  }
  async function storeArt(id,file) {
    if(!db)return false;
    try {
      await new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');if(file)tx.objectStore('images').put(file,id);else tx.objectStore('images').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
      return true;
    } catch (_) {return false;}
  }
  function showArt() {
    showDrawer('把你的画，放进故事',`<p class="hint">所有画面都留给你创作。这里选择图片就能预览；正式交付时，也可以把图片按下列文件名放进 assets 文件夹。背景推荐 1920 × 1080，人物推荐透明 PNG。</p><div class="art-list">${art.map(a=>`<section class="art-item"><div class="art-preview">${img(a.id,'',a.name)}<span class="art-empty">画稿待接入</span></div><h3>${a.name}</h3><p>${a.note}</p><p><code>${a.file}</code></p><label class="upload-label">选择画稿<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="${a.id}" aria-label="上传${a.name}"></label>${temporaryArt.has(a.id)?`<button class="remove-art" data-remove="${a.id}">移除预览</button>`:''}</section>`).join('')}</div><p class="notice">支持 PNG、JPG、WebP，每张不超过 15 MB。上传仅保存在当前浏览器，不会发送到服务器；浏览器存储不可用时，只在本次打开期间预览。清理浏览器数据会移除上传预览，原始画稿请自行保留。</p>`,'画稿接入 / 由你创作');
    drawer.querySelectorAll('[data-upload]').forEach(input=>input.onchange=async()=>{
      const file=input.files[0],id=input.dataset.upload;if(!file)return;
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>15*1024*1024){toast('请选择 15 MB 以内的 PNG、JPG 或 WebP 图片');return;}
      const url=URL.createObjectURL(file);
      try{await new Promise((resolve,reject)=>{const test=new Image();test.onload=resolve;test.onerror=reject;test.src=url;});}catch(_){URL.revokeObjectURL(url);toast('图片无法读取，请检查文件');return;}
      if(temporaryArt.has(id))URL.revokeObjectURL(temporaryArt.get(id));temporaryArt.set(id,url);
      const persisted=await storeArt(id,file);showingCover?renderCover():renderStory();showArt();toast(persisted?'画稿已接入，并保存在当前浏览器':'画稿已预览；本次未能持久保存');
    });
    drawer.querySelectorAll('[data-remove]').forEach(button=>button.onclick=async()=>{
      const id=button.dataset.remove;URL.revokeObjectURL(temporaryArt.get(id));temporaryArt.delete(id);const persisted=await storeArt(id,null);showingCover?renderCover():renderStory();showArt();toast(persisted?'已移除上传预览，恢复文件夹画稿或占位':'已移除本次预览；浏览器存储未能更新');
    });
  }
  document.querySelector('#home-link').onclick=e=>{e.preventDefault();renderCover();};
  document.querySelector('#log-button').onclick=showMemories;

  document.querySelector('#menu-button').onclick=showSettings;
  document.addEventListener('keydown',e=>{
    if(e.code==='Space'&&!e.repeat&&!showingCover&&!drawer.open&&!gameDialog.open&&!['INPUT','BUTTON','TEXTAREA','SELECT','A'].includes(document.activeElement.tagName)) {
      e.preventDefault();if(nodes[state.index].type!=='ending')advance();
    }
  });
  if(state.finished&&nodes[state.index].type==='ending')renderEnding();else renderCover();initArt();
})();
