(() => {
  const local=['localhost','127.0.0.1'].includes(location.hostname);
  // O domínio público de teste será preenchido após criar o segundo serviço no Railway.
  window.RDM_V4_SERVER_URL = local ? 'http://localhost:3000' : '';
})();
