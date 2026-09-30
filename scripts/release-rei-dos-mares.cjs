// Keep the settings label and browser cache keys in the same release.
const fs=require('node:fs'),path=require('node:path');
const version=process.argv[2];
if(!/^\d+\.\d+\.\d+$/.test(version||''))throw new Error('Usage: node scripts/release-rei-dos-mares.cjs 4.3.0');
const dir=path.join(__dirname,'../games/rei-dos-mares');
fs.writeFileSync(path.join(dir,'version.js'),`window.RDM_GAME_VERSION='${version}';\ndocument.getElementById('game-version')?.replaceChildren(document.createTextNode('VERSÃO '+window.RDM_GAME_VERSION));\n`);
for(const name of ['index.html','v4-test.html']){
 let s=fs.readFileSync(path.join(dir,name),'utf8');
 s=s.replace(/(\.(?:js|css)\?v=)[^"']+/g,`$1${version}`).replace(/VERSÃO \d+\.\d+\.\d+/g,`VERSÃO ${version}`);
 fs.writeFileSync(path.join(dir,name),s);
}
console.log('Rei dos Mares '+version);
