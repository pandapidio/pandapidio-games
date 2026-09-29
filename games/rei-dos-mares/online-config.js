/* Configuração de produção do multiplayer do Rei dos Mares.
   Em localhost:3000 o cliente continua podendo usar o servidor local.
   No GitHub Pages e demais hospedagens, usa o servidor público Railway. */
(() => {
  const localNode = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') && location.port === '3000';
  window.RDM_SERVER_URL = localNode
    ? location.origin
    : 'https://rei-dos-mares-server-production.up.railway.app';
})();
