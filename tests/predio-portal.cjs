'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.PREDIO_UI_URL||'http://127.0.0.1:5500';
(async()=>{
 const server=process.env.PREDIO_UI_URL?null:require('node:http').createServer((req,res)=>{const fs=require('node:fs'),path=require('node:path');let f=path.join(__dirname,'..',decodeURIComponent(req.url.split('?')[0]));try{if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.wav':'audio/wav','.mp3':'audio/mpeg'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res)}catch(e){res.statusCode=404;res.end()}});
 if(server)await new Promise(r=>server.listen(5500,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.PREDIO_TEST_BROWSER||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],missing=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)missing.push(r.url())});
 try{
  await page.goto(base);const card=page.getByRole('link',{name:'Entrar em prédio esquisito'});assert.equal(await card.count(),1);await card.hover();await page.screenshot({path:'/tmp/predio-home.png'});
  await card.click();await page.waitForSelector('#preview-continue');assert.equal(await page.evaluate(()=>typeof window.__GAME_TEST__),'undefined');assert.equal(await page.locator('#gameShell').isVisible(),false);
  await page.screenshot({path:'/tmp/predio-notice.png'});
  await page.locator('#preview-continue').click();await page.waitForFunction(()=>window.__GAME_TEST__,{},{timeout:60000});await page.waitForSelector('#gameShell',{state:'visible'});
  await page.locator('#playBtn').click();await page.waitForSelector('#letterScreen:not(.hidden)');
  await page.evaluate(()=>__GAME_TEST__.saveCheckpoint('girl'));
  assert.equal(await page.evaluate(()=>JSON.parse(PG.collect().predio_esquizito_save_v2).checkpoint),'girl');
  await page.reload();await page.locator('#preview-continue').click();await page.waitForSelector('#continueBtn:not(.hidden)');await page.locator('#continueBtn').click();await page.waitForFunction(()=>__GAME_TEST__.scene==='floor2');
  // Load all wedding sprites and audio through HTTP after replacing embedded duplicates.
  const wedding=await page.evaluate(async()=>{await __GAME_TEST__.loadWeddingAssets5();return Object.keys(window.PREDIO_WEDDING_SPRITES).length});assert.equal(wedding,48);
  const audio=await page.evaluate(async()=>{const c=new AudioContext();const results=await Promise.all([...Object.values(PREDIO_WEDDING_AUDIO),PREDIO_VIOLIN_12].map(async u=>{const r=await fetch(u);return (await c.decodeAudioData(await r.arrayBuffer())).duration>0}));await c.close();return results.every(Boolean)});assert.equal(audio,true);
  await page.screenshot({path:'/tmp/predio-game.png'});
  await page.close();
  // Account restoration must finish before the prototype reads its save.
  const cloud=await browser.newPage();await cloud.addInitScript(()=>{localStorage.setItem('pg.account.v1',JSON.stringify({token:'mock-token',user:{id:'test-user',username:'Teste',avatar:'panda'},revision:0}));});
  let saved=null;
  await cloud.route('**/accounts/me',r=>r.fulfill({json:{user:{id:'test-user',username:'Teste',avatar:'panda'},revision:1,progress:{predio_esquizito_save_v2:JSON.stringify({version:2,checkpoint:'oldlady',inventory:[]}),reiDosMaresDiamonds:'25'}}}));
  await cloud.route('**/accounts/progress',r=>{saved=r.request().postDataJSON();return r.fulfill({json:{revision:2}})});
  await cloud.goto(base+'/games/predio-esquisito/');await cloud.locator('#preview-continue').click();await cloud.waitForSelector('#continueBtn:not(.hidden)');assert.equal(await cloud.evaluate(()=>__GAME_TEST__.readSave().checkpoint),'oldlady');
  await cloud.evaluate(async()=>{__GAME_TEST__.saveCheckpoint('chef');await PG.flush()});assert.equal(JSON.parse(saved.progress.predio_esquizito_save_v2).checkpoint,'chef');assert.equal(saved.progress.reiDosMaresDiamonds,'25');await cloud.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844}});await mobile.goto(base);await mobile.getByRole('link',{name:'Entrar em prédio esquisito'}).click();await mobile.waitForSelector('#preview-continue');assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mobile.screenshot({path:'/tmp/predio-mobile.png'});await mobile.close();
  assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);console.log('PASS: standalone universe, warning gate, boot, local checkpoint reload, cloud restore/write, 48 sprites, audio decode, mobile layout; no JS errors or missing assets.');
 }finally{await browser.close();server?.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
