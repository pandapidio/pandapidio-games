(() => {
  const params=new URLSearchParams(location.search);
  if(params.get('resetserver')==='1'){try{localStorage.removeItem('rdmV4TestServer');}catch(_){}}
  const local=['localhost','127.0.0.1'].includes(location.hostname);
  let url=local?'http://localhost:3000':String(params.get('server')||'').trim();
  if(!url){try{url=String(localStorage.getItem('rdmV4TestServer')||'').trim();}catch(_){}}
  if(!url&&!local){
    url=String(prompt('TESTE MULTIPLAYER V4\n\nCole aqui o domínio HTTPS do serviço rei-dos-mares-v4-test no Railway.\nExemplo: https://...up.railway.app')||'').trim();
  }
  url=url.replace(/\/+$/,'');
  if(url&&!local&&!/^https:\/\//i.test(url)){
    alert('O servidor de teste precisa usar HTTPS. Recarregue a página e cole o domínio completo começando com https://');
    url='';
  }
  if(url&&!local){try{localStorage.setItem('rdmV4TestServer',url);}catch(_){}}
  window.RDM_V4_SERVER_URL=url;
})();
