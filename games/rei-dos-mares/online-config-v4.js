(() => {
  const localNode=(location.hostname==='localhost'||location.hostname==='127.0.0.1')&&location.port==='3000';
  window.RDM_V4_SERVER_URL=localNode
    ? location.origin
    : 'https://rei-dos-mares-server-production.up.railway.app';
})();
