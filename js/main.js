/* JS do portal. Não toca em nenhum jogo: só monta cards/links e navega. */
(function () {
  'use strict';
  var D = window.PORTAL || { universes: [], games: [] };
  var root = document.body.getAttribute('data-root') || '';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  function pagePath(path) {
    var p = root + path;
    return /\/$/.test(p) ? p + 'index.html' : p;
  }

  var U = document.getElementById('universes');
  if (U) D.universes.forEach(function (u, i) {
    var sea = u.theme === 'sea' || u.id === 'rei-dos-mares';
    var a = el('a', 'universe' + (sea ? ' sea-universe' : '')); a.href = pagePath(u.path); a.setAttribute('data-transition', '');
    a.setAttribute('aria-label', sea ? 'Jogar ' + u.title : 'Entrar em ' + u.title);
    var t = el('span', sea ? 'sea-title' : 'creepy', u.title); if (!sea) t.setAttribute('data-text', u.title); a.appendChild(t); U.appendChild(a);
  });

  var G = document.getElementById('grid');
  if (G) {
    var uni = G.getAttribute('data-universe'), max = D.universes.filter(function (u) { return u.id === uni; })[0];
    var total = (max && max.slots) || 9, seen = {};
    D.games.filter(function (g) { return g.universe === uni; }).forEach(function (g) {
      if (g.slot < 1 || g.slot > total || seen[g.slot]) console.warn('Slot inválido/duplicado:', g.title, g.slot); else seen[g.slot] = g;
    });
    for (var n = 1; n <= total; n++) {
      var g = seen[n], s;
      if (g) {
        s = el('a', 'slot card'); s.href = pagePath(g.path); s.setAttribute('aria-label', 'Jogar ' + g.title);
        var im = el('img'); im.src = root + g.thumbnail; im.alt = 'Capa de ' + g.title; im.decoding = 'async';
        s.appendChild(im); s.appendChild(el('span', 'name', g.title));
      } else {
        s = el('div', 'slot empty'); s.setAttribute('role', 'img'); s.setAttribute('aria-label', 'Espaço ' + n + ': em breve');
        s.appendChild(el('span', 'soon', 'Em breve'));
      }
      s.style.setProperty('--i', n - 1); G.appendChild(s);
    }
  }

  document.addEventListener('click', function (e) {          // transição suave entre páginas do portal
    var a = e.target.closest && e.target.closest('a[data-transition]');
    if (!a || reduce || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault(); document.body.classList.add('leaving');
    setTimeout(function () { location.href = a.href; }, 380);
  });
  addEventListener('pageshow', function () { document.body.classList.remove('leaving'); });
})();
