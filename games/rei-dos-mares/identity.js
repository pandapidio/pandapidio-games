/* Captain cosmetics: no changes to combat stats. All names entered by the player use textContent. */
const TITLE_RARITIES={
 common:{label:'COMUM',color:'#c0ccd0'},rare:{label:'RARO',color:'#82cdeb'},epic:{label:'ÉPICO',color:'#c9a6f1'},legendary:{label:'LENDÁRIO',color:'#f3d084'},secret:{label:'SECRETO',color:'#d5e6dc'},mythic:{label:'MÍTICO',color:'#ff4b4b'}
};
const AVATARS=[
 {id:'pirate',name:'Bandeira livre',rarity:'common',cost:0,desc:'Seu primeiro estandarte.'},
 {id:'straw',name:'Chapéu de palha',rarity:'common',cost:2,skin:'straw',desc:'O sorriso de um rei dos piratas.'},
 {id:'papyrates',name:'Sorriso de ossos',rarity:'common',cost:2,skin:'papyrates',desc:'Inspirado na bravata do Papyrates.'},
 {id:'caribe',name:'Corsário do Caribe',rarity:'rare',cost:0,skin:'caribe',desc:'Disponível para quem possui a skin Caribe.'},
 {id:'ghost',name:'Bandeira do além',rarity:'epic',cost:0,skin:'holandez',desc:'Uma vela fantasma para o Holandês Voador.'},
 {id:'beam',name:'Presas do abismo',rarity:'legendary',cost:0,skin:'beam',desc:'O estandarte do predador Beam.'},
 {id:'pandapidio',name:'Panda',rarity:'common',cost:0,skin:'pandapidio',desc:'Um panda inspirado na bandeira da skin Pandapidio.'},
 {id:'rock-revenge',name:'Rock Revenge',rarity:'rare',cost:0,skin:'rock-revenge',desc:'Um estandarte rochoso para a skin Rock Revenge.'},
 {id:'gullit',name:'Grito da torcida',rarity:'epic',cost:0,skin:'gullit',desc:'Uma bola em chamas para a skin Gullit.'},
 {id:'espectro-abissal',name:'Caveira Abissal',rarity:'epic',cost:0,skin:'espectro-abissal',desc:'Uma caveira azul inspirada na bandeira da skin Espectro Abissal.'},
 {id:'midas',name:'Toque de ouro',rarity:'legendary',cost:0,skin:'midas',desc:'Um brasão rico em ouro inspirado na skin Midas.'},
 {id:'rei-dos-mares',name:'Coroa do oceano',rarity:'secret',cost:0,skin:'rei-dos-mares',desc:'O retrato supremo do Rei dos Mares.'},
 {id:'marine',name:'Honra da Marinha',rarity:'rare',cost:0,skin:'secret-marine',desc:'O emblema de quem rompeu o bloqueio.'},
 {id:'blackbeard',name:'Três destinos',rarity:'epic',cost:0,skin:'secret-blackbeard',desc:'Uma lembrança de Barba Negra.'},
 {id:'pearl',name:'Pérola da noite',rarity:'secret',cost:0,skin:'secret-pearl',desc:'O estandarte de um rei dos mares.'},
 {id:'atlas',name:'Rosa dos ventos',rarity:'rare',cost:4,desc:'Feita para capitães que estudam o mar.'},
 {id:'admiral-seal',name:'Selo do almirante',rarity:'epic',cost:0,achievement:'marine',desc:'Recompensa da conquista Bandeira livre.'},
 {id:'hellfire-eye',name:'Olho infernal',rarity:'legendary',cost:0,achievement:'black-fire',desc:'Um olhar severo forjado em fogo infernal, prêmio da conquista O fogo que não se apaga.'},
 {id:'treasure-star',name:'Fortuna da maré',rarity:'rare',cost:0,achievement:'gold',desc:'Um emblema de riqueza e tesouro, prêmio da conquista Fortuna da maré.'},
 {id:'ghost-king-mark',name:'Marca do rei morto',rarity:'legendary',cost:0,achievement:'king',desc:'Um selo sombrio e régio, prêmio da conquista Rei dos Mares.'},
 {id:'infinity-crown',name:'Coroa infinita',rarity:'secret',cost:0,achievement:'century',desc:'Uma coroa nobre e luminosa, recompensa máxima da conquista Um século de marés.'},
 {id:'silver-trophy',name:'Troféu de Platina',rarity:'mythic',cost:0,achievement:'platinum',desc:'Um troféu prateado sobre o vermelho mítico, reservado a quem conquistou tudo.'}
];
const avatarById=Object.fromEntries(AVATARS.map(a=>[a.id,a]));
const harborUI={tab:'ships'};
function avatarSrc(id){return `assets/portraits/${avatarById[id]?id:'pirate'}.svg`;}
function captainTitleInfo(){
 const a=ACHIEVEMENTS.find(a=>a.title===chronicle.data.title&&chronicle.data.achievements.includes(a.id));
 const rarity=a?.rarity||'common';return{name:a?.title||'Capitão',rarity,...TITLE_RARITIES[rarity],color:a?.titleColor||TITLE_RARITIES[rarity].color};
}
function updateCaptainIdentity(){
 if(!chronicle.ready)return;
 const d=chronicle.data,title=captainTitleInfo(),name=d.name==='Capitão'?'Capitão':`Capitão ${d.name}`;
 for(const id of ['hud-captain-name']){const el=document.getElementById(id);el.textContent=name;el.title=name;}
 for(const id of ['hud-captain-title','captain-title']){const el=document.getElementById(id);el.textContent=title.name;el.style.color=title.color;el.title=`${title.name} • ${title.label}`;el.dataset.rarity=title.rarity;}
 for(const el of document.querySelectorAll('[data-captain-portrait]')){el.src=avatarSrc(d.profile.avatar);el.alt=`Retrato: ${avatarById[d.profile.avatar].name}`;}
 document.querySelector('.captain-emblem').style.setProperty('--portrait-color',TITLE_RARITIES[avatarById[d.profile.avatar].rarity].color);
}
function equipCaptainTitle(id){
 const a=id==='captain'?null:ACHIEVEMENTS.find(a=>a.id===id);
 if(id!=='captain'&&(!a||!chronicle.data.achievements.includes(id)))return;
 chronicle.data.title=a?.title||'Capitão';persistChronicle();refreshCaptainUI();renderCollection();sfx('ui',.35);
}
function renderCaptainTitles(content){
 const d=chronicle.data,unlocked=a=>a.id==='captain'||d.achievements.includes(a.id);
 const titles=[{id:'captain',title:'Capitão',rarity:'common',desc:'Seu primeiro título.'},...ACHIEVEMENTS].sort((a,b)=>Number(unlocked(b))-Number(unlocked(a)));
 content.innerHTML=`<p class="tab-intro">${titles.filter(unlocked).length} de ${titles.length} títulos • Escolha como será conhecido no mar.</p><div class="titles-grid">${titles.map(a=>{
 const owned=unlocked(a),secret=(a.secret||!achievementDiscovered(a))&&!owned,r=TITLE_RARITIES[a.rarity||'common'],name=secret?'Título desconhecido':a.title;
 return `<article class="title-card ${owned?'owned':'locked'}" style="--title-color:${secret?'#7d929c':a.titleColor||r.color}"><span class="title-rarity">${secret?'SECRETO':r.label}</span><h3>${name}</h3><p>${secret?'Uma façanha escondida revelará este título.':a.desc}</p><button data-equip-title="${a.id}" ${!owned||d.title===a.title?'disabled':''}>${owned?(d.title===a.title?'EQUIPADO':'USAR TÍTULO'):'BLOQUEADO'}</button></article>`;
 }).join('')}</div>`;
 for(const b of content.querySelectorAll('[data-equip-title]'))b.addEventListener('click',()=>equipCaptainTitle(b.dataset.equipTitle));
}
function avatarRequirementLabel(a,diamonds,owned){
 if(owned) return 'EQUIPAR';
 if(a.achievement) return 'RESGATAR';
 if(a.skin) return 'RESGATAR';
 if(a.cost===0) return 'RESGATAR';
 return diamonds<a.cost?`FALTAM ${a.cost-diamonds} ◆`:`COMPRAR • ${a.cost} ◆`;
}
function renderAvatarCards(container){
 const profile=chronicle.data.profile;
 container.innerHTML=AVATARS.map(a=>{
 const owned=profile.ownedAvatars.includes(a.id),equipped=profile.avatar===a.id;
 const achievementLocked=a.achievement&&!chronicle.data.achievements.includes(a.achievement);
 const locked=(a.skin&&!ownedSkins.has(a.skin)&&!owned)||achievementLocked;
 const requirement=achievementLocked?'CONQUISTA NECESSÁRIA':a.skin&&!ownedSkins.has(a.skin)&&!owned?'OBTENHA A SKIN':a.cost>0?`${a.cost} diamantes`:'RECOMPENSA GRATUITA';
 const r=TITLE_RARITIES[a.rarity];
 const label=equipped?'EQUIPADO':locked?(achievementLocked?'BLOQUEADO POR CONQUISTA':'BLOQUEADO'):(owned?'EQUIPAR':avatarRequirementLabel(a,diamonds,owned));
 return `<article class="portrait-card ${equipped?'equipped':''} ${locked?'locked':''}" style="--portrait-color:${r.color}"><img src="${avatarSrc(a.id)}" alt="${a.name}"><h3>${a.name}</h3><span class="portrait-rarity">${r.label}</span><p>${a.desc}</p><small>${requirement}</small><button data-avatar="${a.id}" ${equipped||locked||(!owned&&a.cost>0&&diamonds<a.cost)?'disabled':''}>${label}</button></article>`;
 }).join('');
 for(const b of container.querySelectorAll('[data-avatar]'))b.addEventListener('click',()=>selectCaptainAvatar(b.dataset.avatar));
}
function selectCaptainAvatar(id){
 if(!['shop','collection'].includes(state))return;
 const a=avatarById[id],profile=chronicle.data.profile;if(!a)return;
 if(!profile.ownedAvatars.includes(id)){
   if((a.skin&&!ownedSkins.has(a.skin))||(a.achievement&&!chronicle.data.achievements.includes(a.achievement))||diamonds<a.cost)return;
   diamonds-=a.cost;profile.ownedAvatars.push(id);addStat('portraits');checkAchievements();sfx('upgrade',.55);
 }else sfx('ui',.4);
 profile.avatar=id;persistChronicle();updateDiamondUI();refreshCaptainUI();
 if(state==='shop')renderShop();else renderCollection();
}
function initIdentityUI(){
 document.getElementById('captain-portrait-open').addEventListener('click',()=>{chronicle.tab='portraits';renderCollection();});
 document.getElementById('shop-close-top').addEventListener('click',closeShop);
 for(const b of document.querySelectorAll('[data-shop-tab]'))b.addEventListener('click',()=>{harborUI.tab=b.dataset.shopTab;renderShop();});
}
