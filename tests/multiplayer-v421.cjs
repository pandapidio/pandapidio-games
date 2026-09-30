'use strict';
// Run with a local frontend (:5500), server (:3000, RDM_TESTING=1) and Playwright.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const url=process.env.RDM_UI_URL||'http://127.0.0.1:5500/games/rei-dos-mares/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ack(page,event,payload={}){return page.evaluate(({event,payload})=>new Promise(resolve=>RDMOnline.socket.emit(event,payload,resolve)),{event,payload});}
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.RDM_BROWSER_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const pages=[],contexts=[],errors=[];
 try{
  for(let i=0;i<3;i++){
   const ctx=await browser.newContext({viewport:{width:1280,height:900}});contexts.push(ctx);
   const page=await ctx.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/online-config-v4.js*',route=>route.fulfill({contentType:'application/javascript',body:'window.RDM_V4_SERVER_URL="http://127.0.0.1:3000";'}));
   await page.goto(url);await page.waitForFunction(()=>window.RDMOnline?.socket?.connected);
   await page.locator('#multiplayer-btn').click();
  }
  await pages[0].locator('#online-create').click();
  await pages[0].waitForFunction(()=>window.RDMOnline.state.room?.code);
  const code=await pages[0].evaluate(()=>RDMOnline.state.room.code);
  for(const page of pages.slice(1)){await page.locator('#online-code').fill(code);await page.locator('#online-join').click();}
  await pages[0].waitForFunction(()=>RDMOnline.state.room?.players?.length===3);
  await pages[0].locator('#online-start').click();
  for(const page of pages)await page.waitForFunction(()=>RDMOnline.state.started&&state==='play');
  await ack(pages[0],'test:force-wave-complete',{wave:5});
  for(const page of pages)await page.waitForFunction(()=>state==='upgrade'&&ReiMultiplayerLocal.shop?.phase==='class');
  // Keep the mouse pressed over several snapshots: a stable button must survive.
  const button=pages[0].locator('[data-mp-class="marine"]');
  const box=await button.boundingBox();await pages[0].mouse.move(box.x+box.width/2,box.y+box.height/2);
  await pages[0].evaluate(()=>window.__shopButton=document.querySelector('[data-mp-class="marine"]'));
  await pages[0].mouse.down();await sleep(400);
  assert(await pages[0].evaluate(()=>document.querySelector('[data-mp-class="marine"]')===window.__shopButton),'snapshots must preserve a pressed shop button');
  await pages[0].mouse.up();
  await pages[0].waitForFunction(()=>ReiMultiplayerLocal.shop.phase==='talent');
  for(const [i,path] of ['marine','pirate','undead'].entries()){
   const page=pages[i];if(i)await page.locator(`[data-mp-class="${path}"]`).click({delay:180});
   await page.waitForFunction(()=>ReiMultiplayerLocal.shop.phase==='talent');
   await page.locator('[data-mp-first]').first().click({delay:180});
   await page.waitForFunction(()=>ReiMultiplayerLocal.shop.phase==='firstdone');
   const chosen=await page.evaluate(()=>ReiMultiplayerLocal.playerById(RDMOnline.state.slot).build.path);
   assert.equal(chosen,path);
  }
  for(const page of pages)await page.locator('#mp-shop-continue').click({delay:180});
  for(const page of pages)await page.waitForFunction(()=>state==='play'&&wave===6);
  // Shop actions retain spent gold and damage changes despite an older snapshot.
  await ack(pages[0],'test:force-wave-complete',{wave:10});
  for(const page of pages)await page.waitForFunction(()=>state==='upgrade'&&ReiMultiplayerLocal.shop.phase==='normal');
  const profile=await pages[0].evaluate(()=>{
   const mp=ReiMultiplayerLocal,p=mp.playerById(RDMOnline.state.slot);p.gold=500;p.entity.damageMult=1.75;
   const stale={v:2,authoritativeV4:true,lite:true,state:'upgrade',wave,score,elapsed,transition,shop:mp.serverShop,players:[{id:p.id,gold:0,entity:{...p.entity,damageMult:1}}],enemies:[],shots:[],enemyShots:[],chests:[]};
   mp.applySnapshot(stale);return mp.exportShopProfile();
  });
  assert.equal(profile.gold,500);assert.equal(profile.damageMult,1.75);
  for(const page of pages)await page.locator('[data-mp-ready]').click({delay:180});
  for(const page of pages)await page.waitForFunction(()=>state==='play'&&wave===11);
  await ack(pages[0],'test:force-gameover');
  for(const page of pages){await page.waitForFunction(()=>state==='gameover');assert(await page.locator('#again-btn').isHidden());}
  await pages[1].locator('#menu-btn').click();
  for(const page of pages){
   await page.waitForFunction(()=>state==='menu'&&!RDMOnline.state.started&&!ReiMultiplayerLocal.enabled);
   assert.equal(await page.evaluate(()=>RDMOnline.state.room.code),code);
   assert(await page.evaluate(()=>!document.querySelector('#again-btn').classList.contains('hidden')),'singleplayer retry must be restored on cleanup');
   await page.locator('#multiplayer-btn').click();await page.waitForFunction(()=>!document.querySelector('#online-lobby').classList.contains('hidden'));
   assert.equal(await page.locator('.online-player:not(.empty)').count(),3);
  }
  await pages[0].locator('#online-close').click();await pages[0].locator('#multiplayer-btn').click();
  assert.equal(await pages[0].evaluate(()=>RDMOnline.state.room.code),code);
  await pages[0].locator('#online-start').click();
  for(const page of pages)await page.waitForFunction(()=>RDMOnline.state.started&&wave===1&&state==='play');
  await ack(pages[0],'test:force-wave-complete',{wave:5});
  for(const page of pages){await page.waitForFunction(()=>ReiMultiplayerLocal.shop?.phase==='class');assert.equal(await page.evaluate(()=>ReiMultiplayerLocal.playerById(RDMOnline.state.slot).build.path),null);}
  assert.deepEqual(errors,[],'browser must not report runtime exceptions');
  console.log(JSON.stringify({ok:true,clients:3,stablePressedButton:true,oneClickChoices:true,staleSnapshotPreserved:true,partyPreserved:true,freshRun:true},null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
