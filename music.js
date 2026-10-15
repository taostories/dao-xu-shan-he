/* Single CC0 background track. Loaded only after a deliberate user gesture. */
(() => {
  'use strict';
  const button=document.querySelector('#music-button');
  const audio=new Audio();
  audio.preload='none';audio.loop=true;audio.volume=.5;
  const key='daoxu-music-muted';
  let muted=false,activated=false;
  try{muted=localStorage.getItem(key)==='true';}catch(_){}
  function update(){
    const playing=!audio.paused&&!muted;
    button.textContent=playing?'音乐：开':'音乐：关';
    button.setAttribute('aria-label',playing?'关闭背景音乐':'播放背景音乐');
    button.setAttribute('aria-pressed',String(playing));
  }
  function play(){
    if(muted||document.hidden)return;
    if(!audio.getAttribute('src'))audio.src='assets/audio/peaceful-tune-2.mp3';
    audio.play().catch(update);
  }
  button.onclick=()=>{
    if(!audio.paused){muted=true;audio.pause();}
    else{muted=false;activated=true;play();}
    try{localStorage.setItem(key,String(muted));}catch(_){}
    update();
  };
  document.addEventListener('click',event=>{
    if(event.target.closest('#start-button,#next-button,[data-replay-chapter],#confirm-restart')){
      activated=true;play();
    }
  });
  document.addEventListener('keydown',event=>{
    if(event.code==='Space'&&document.querySelector('.story-shell')&&!event.repeat){activated=true;play();}
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)audio.pause();else if(activated)play();
  });
  window.addEventListener('pagehide',()=>audio.pause());
  window.addEventListener('pageshow',()=>{if(activated)play();});
  audio.addEventListener('play',update);audio.addEventListener('pause',update);
  audio.addEventListener('error',()=>{
    audio.pause();audio.removeAttribute('src');update();
    button.setAttribute('aria-label','音乐加载失败，点击重试');
  });
  update();
})();
