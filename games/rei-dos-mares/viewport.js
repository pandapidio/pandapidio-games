(() => {
  'use strict';
  const DESIGN_W=1280,DESIGN_H=720;
  function fit(){
    const vv=window.visualViewport;
    const w=Math.max(1,vv?.width||window.innerWidth||DESIGN_W),h=Math.max(1,vv?.height||window.innerHeight||DESIGN_H);
    const scale=Math.min(w/DESIGN_W,h/DESIGN_H,1);
    document.documentElement.style.setProperty('--game-scale',String(Math.max(.1,scale)));
  }
  addEventListener('resize',fit,{passive:true});window.visualViewport?.addEventListener('resize',fit,{passive:true});fit();
  window.RDMViewport={fit};
})();
