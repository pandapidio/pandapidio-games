/* Load the prototype only after consent and account restoration. */
(() => {
  'use strict';
  const button = document.getElementById('preview-continue');
  const status = document.getElementById('preview-status');
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Abrindo o prédio…';
    try {
      await PG.ready;
      for (const original of document.querySelectorAll('script[type="application/pg-game"]')) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = original.getAttribute('src');
          script.onload = resolve;
          script.onerror = () => reject(new Error('Não foi possível carregar o jogo. Recarregue a página para tentar novamente.'));
          document.body.append(script);
        });
      }
      const shell = document.getElementById('gameShell');
      shell.hidden = false;
      shell.inert = false;
      document.getElementById('preview-notice').remove();
      window.dispatchEvent(new Event('resize'));
      document.getElementById('playBtn')?.focus();
    } catch (error) {
      status.textContent = error.message;
      PG.block(error);
    }
  });
})();
