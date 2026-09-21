/* Catálogo do portal. Para adicionar jogo/universo, edite só este arquivo.
   Caminhos são relativos à RAIZ do portal (a pasta onde está o index.html). */
window.PORTAL = {
  universes: [
    { id: "creepygames", title: "CreepyGames", path: "universes/creepygames/index.html", slots: 9 }
  ],
  games: [
    {
      title: "Ayuwoke e a Batalha de Aura",
      universe: "creepygames",
      slot: 3,                                   // 1 a 9 (esquerda→direita, cima→baixo)
      thumbnail: "assets/covers/ayuwoke.png",
      path: "universes/creepygames/games/ayuwoke/index.html"
    }
  ]
};
