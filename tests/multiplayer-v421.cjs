'use strict';
// Real UI regression test. Run frontend/server with RDM_TESTING=1.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const url=process.env.RDM_UI_URL||'http://127.0.0.1:5500/games/rei-dos-mares/';
const server=process.env.RDM_SERVER_URL||'http://127.0.0.1:3000';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ack(page,event,payload={}){return page.evaluate(({event,payload})=>new Promise(resolve=>RDMOnline.socket.emit(event,payload,resolve)),{event,payload});}
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.RDM_BROWSER_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const pages=[],errors=[];
 try{
  for(let i=0;i<3;i++){
   const ctx=await browser.newContext({viewport:{width:1280,height:900}});
   const page=await ctx.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/online-config-v4.js*',route=>route.fulfill({contentType:'application/javascript',body:'window.RDM_V4_SERVER_URL='+JSON.stringify(server)+';'}));
   await page.goto(url);await page.waitForFunction(()=>window.RDMOnline?.socket?.connected);
   assert.equal((await page.locator('#multiplayer-btn').innerText()).trim(),'MULTIPLAYER');
   assert.equal(await page.locator('#game-version').textContent(),'VERSÃO 4.3.0');
   await page.locator('#multiplayer-btn').click();
  }
  await pages[0].locator('#online-create').click();await pages[0].waitForFunction(()=>RDMOnline.state.room?.code);
  const code=await pages[0].evaluate(()=>RDMOnline.state.room.code);
  for(const page of pages.slice(1)){await page.locator('#online-code').fill(code);await page.locator('#online-join').click();}
  await pages[0].waitForFunction(()=>RDMOnline.state.room?.players?.length===3);
  await pages[0].locator('#online-start').click();
  for(const page of pages)await page.waitForFunction(()=>RDMOnline.state.started&&state==='play');
  await ack(pages[0],'test:force-wave-complete',{wave:5});
  for(const page of pages)await page.waitForFunction(()=>state==='upgrade'&&ReiMultiplayerLocal.shop?.phase==='class');
  const button=pages[0].locator('[data-mp-class="marine"]');const box=await button.boundingBox();
  await pages[0].mouse.move(box.x+box.width/2,box.y+box.height/2);
  await pages[0].evaluate(()=>window.__shopButton=document.querySelector('[data-mp-class="marine"]'));
  await pages[0].mouse.down();await sleep(650);
  assert(await pages[0].evaluate(()=>document.querySelector('[data-mp-class="marine"]')===window.__shopButton),'periodic snapshots must preserve the pressed button');
  await pages[0].mouse.up();await pages[0].waitForFunction(()=>ReiMultiplayerLocal.players[0].build.pendingPath==='marine');
  await pages[1].locator('[data-mp-class="pirate"]').click();await pages[1].waitForFunction(()=>ReiMultiplayerLocal.players[1].build.pendingPath==='pirate');
  await pages[2].locator('[data-mp-class="undead"]').click();
  for(const page of pages)await page.waitForFunction(()=>ReiMultiplayerLocal.shop?.phase==='talent');
  for(const page of pages){await page.locator('[data-mp-first]').first().click();await page.waitForFunction(()=>ReiMultiplayerLocal.playerById(RDMOnline.state.slot).build.path);}
  for(const [i,page]of pages.entries())assert.equal(await page.evaluate(()=>ReiMultiplayerLocal.playerById(RDMOnline.state.slot).build.path),['marine','pirate','undead'][i]);
  await pages[0].waitForFunction(()=>ReiMultiplayerLocal.shop.phase==='firstdone');
  await pages[0].locator('#mp-shop-continue').click();for(const page of pages)await page.waitForFunction(()=>state==='play'&&wave===6);
  await ack(pages[0],'test:force-wave-complete',{wave:10});await ack(pages[0],'test:grant-gold',{gold:5000});
  for(const page of pages)await page.waitForFunction(()=>state==='upgrade'&&ReiMultiplayerLocal.shop.phase==='normal'&&ReiMultiplayerLocal.playerById(RDMOnline.state.slot).gold===5000);
  const buy=pages[0].locator('[data-mp-buy]').first(),id=await buy.getAttribute('data-mp-buy');
  await buy.click();await pages[0].waitForFunction(id=>ReiMultiplayerLocal.playerById(RDMOnline.state.slot).upgrades.has(id),id);
  const goldAfter=await pages[0].evaluate(()=>ReiMultiplayerLocal.players[0].gold);await sleep(650);assert.equal(await pages[0].evaluate(()=>ReiMultiplayerLocal.players[0].gold),goldAfter);
  for(const page of pages)await page.locator('[data-mp-ready]').click();for(const page of pages)await page.waitForFunction(()=>state==='play'&&wave===11);
  await ack(pages[0],'test:force-wave',{wave:27});await sleep(6500);
  for(const page of pages){assert(await page.evaluate(()=>enemies.some(e=>['tank','bomber','sniper','rammer','hunter','scout'].includes(e.role))));}
  await ack(pages[0],'test:force-wave',{wave:21});await pages[0].waitForFunction(()=>voyage.event==='storm'&&campaign.events.includes('storm'));
  await ack(pages[0],'test:force-wave',{wave:25});for(const page of pages)await page.waitForFunction(()=>bossFight?.kind==='blackbeard');
  assert.equal(await pages[0].evaluate(()=>bossFight.cfg.h),300);await sleep(3500);
  if(process.env.RDM_SCREENSHOT)await pages[0].screenshot({path:process.env.RDM_SCREENSHOT});
  await ack(pages[0],'test:defeat-boss');for(const page of pages)await page.waitForFunction(()=>state==='bossreward');
  for(const page of pages)assert(await page.locator('#boss-reward-btn').isVisible());
  await pages[1].locator('#boss-reward-btn').click();await pages[0].waitForFunction(()=>bossReward?.dialogue?.includes('morte te aguarda'));
  await pages[2].locator('#boss-reward-btn').click();for(const page of pages)await page.waitForFunction(()=>state==='upgrade');
  await ack(pages[0],'test:force-gameover');for(const page of pages){await page.waitForFunction(()=>state==='gameover');assert(await page.locator('#again-btn').isHidden());}
  await pages[1].locator('#menu-btn').click();
  for(const page of pages){await page.waitForFunction(()=>state==='menu'&&!RDMOnline.state.started&&!ReiMultiplayerLocal.enabled);assert.equal(await page.evaluate(()=>RDMOnline.state.room.code),code);assert(await page.locator('#online-lobby').isVisible());assert.equal(await page.locator('.online-player:not(.empty)').count(),3);}
  await pages[0].locator('#online-start').click();for(const page of pages)await page.waitForFunction(()=>RDMOnline.state.started&&wave===1);
  await ack(pages[0],'test:force-wave-complete',{wave:5});for(const page of pages){await page.waitForFunction(()=>ReiMultiplayerLocal.shop?.phase==='class');assert.equal(await page.evaluate(()=>ReiMultiplayerLocal.playerById(RDMOnline.state.slot).build.path),null);}
  await ack(pages[0],'test:force-gameover');await pages[0].waitForFunction(()=>state==='gameover');await pages[0].locator('#menu-btn').click();await pages[0].waitForFunction(()=>state==='menu');
  await pages[0].locator('#online-close').click();await pages[0].evaluate(()=>{voyage.tutorial.active=false;localStorage.setItem('reiDosMaresTutorialCompleted','1');start();});await pages[0].waitForFunction(()=>state==='play');
  assert.equal(await pages[0].evaluate(()=>ReiMultiplayerLocal.enabled),false);
  await pages[0].evaluate(()=>{diamonds=500;player.hp=0;endGame();});await pages[0].waitForFunction(()=>state==='gameover'&&!document.querySelector('#gameover').classList.contains('hidden'));
  assert(await pages[0].locator('#again-btn').isVisible());assert(await pages[0].locator('#revive-btn').isVisible());
  await pages[0].locator('#again-btn').click();await pages[0].waitForFunction(()=>state==='play'&&wave===1);
  assert.deepEqual(errors,[],'browser runtime exceptions');
  console.log(JSON.stringify({ok:true,clients:3,stablePressedButton:true,oneClickChoices:true,fullEnemies:true,storm:true,fullBoss:true,bossReward:true,partyAutomaticallyVisible:true,freshRun:true,singleplayer:true},null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
