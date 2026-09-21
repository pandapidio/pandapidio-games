# Pandapidio Games

Portal de jogos 100% estático (HTML, CSS e JavaScript). Sem Node, PHP ou banco de dados.

## Estrutura

```
index.html               página principal (logo + universos)
css/  main.css, creepy-title.css
js/   main.js (portal), data.js (CATÁLOGO)
assets/logo, covers, ui  logo, favicon, capas dos jogos
universes/creepygames/
    index.html           página do universo (grade 3×3)
    css/creepygames.css
    games/ayuwoke/       jogo independente (index.html, js, sprites, audio, ui...)
```

Portal e jogos são separados: o `main.js` só monta cards e links. Cada jogo tem HTML, CSS, JS e assets próprios dentro da sua pasta.

## Testar

- Abra `index.html` com duplo clique (funciona em `file://`, pois o catálogo é um `.js`, não JSON), ou
- rode um servidor local na pasta: `python3 -m http.server 8000` e abra `http://localhost:8000`.

## Publicar (tudo é estático)

- **GitHub Pages:** suba a pasta para um repositório → Settings → Pages → Deploy from a branch → `main` / `(root)`.
- **Cloudflare Pages:** Create project → Direct Upload (arraste a pasta) ou conecte o repositório. Build command: vazio. Output directory: `/`.
- **Netlify:** Add new site → Deploy manually (arraste a pasta) ou conecte o repositório. Build command: vazio. Publish directory: `.`

Todos os caminhos são relativos: funciona em domínio próprio (ex.: pandapidiogames.com) ou em subpasta.

## Adicionar um jogo

1. Crie `universes/creepygames/games/nome-do-jogo/` com o jogo completo (o `index.html` dele na raiz da pasta, caminhos relativos).
2. Coloque a capa quadrada em `assets/covers/nome-do-jogo.png` (ideal ~800×800).
3. Em `js/data.js`, acrescente em `games`:
   ```js
   { title: "Nome do Jogo", universe: "creepygames", slot: 4,
     thumbnail: "assets/covers/nome-do-jogo.png",
     path: "universes/creepygames/games/nome-do-jogo/" }
   ```

`slot` vai de 1 a 9 (esquerda→direita, cima→baixo). **Preencher um slot vazio = só usar o número dele**; o placeholder "Em breve" some sozinho.

Dica: no `localStorage`, use prefixo próprio em cada jogo (ex.: `nomedojogo_recorde`). Todos os jogos do mesmo domínio compartilham o mesmo armazenamento.

## Adicionar um universo futuro

1. Copie `universes/creepygames/` para `universes/novo-universo/` (apague `games/ayuwoke`) e edite `index.html` e `css/` para dar a identidade visual dele (`data-universe="novo-universo"` no `#grid`).
2. Em `js/data.js`, acrescente em `universes`: `{ id: "novo-universo", title: "Nome", path: "universes/novo-universo/", slots: 9 }`.
3. Cadastre os jogos dele em `games` com `universe: "novo-universo"`.

O botão do universo aparece sozinho na página principal.

## Sobre o Ayuwoke

Está em `universes/creepygames/games/ayuwoke/`, com os arquivos originais. Única alteração: no `<head>` do `index.html`, o título (`... | Pandapidio Games`) e um `<link rel="icon">` com `favicon.png`. Nenhuma linha de JS, sprite ou áudio foi mexida.
