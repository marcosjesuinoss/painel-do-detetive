## Painel do Detetive (Investigação)

Aplicativo web (PWA) para apoiar partidas de Detetive / Clue. Ele funciona como um painel digital onde você marca suspeitos, armas e locais, controla jogadores, destaca linhas/colunas e utiliza temas personalizados, incluindo um modo PRO.

---

### Tecnologias

- **Front-end**: HTML, CSS e JavaScript (sem framework)
- **Estado local**: `localStorage`
- **PWA**: `manifest.json` + `sw.js` (instalável e com cache offline)

---

### Como executar

- Basta abrir o arquivo `index.html` em um navegador moderno (Chrome, Edge, etc.).  
- Para testar como PWA:
  - Sirva a pasta com um servidor estático (por exemplo, extensão “Live Server” ou `npx serve .`).
  - Acesse pelo navegador, aceite a instalação/“Adicionar à tela inicial”.

---

### Estrutura principal

- `index.html` – única página; as diferentes telas são seções com `div.tela`.
- `css/` – estilos base, layout, componentes, temas e animações.
- `js/` – lógica dividida por responsabilidade:
  - `app.js` – inicialização, splash, registro do service worker.
  - `tabela.js` – geração da tabela de cartas, marcações V/X/? e destaques.
  - `jogadores.js` – seleção de versão e quantidade de jogadores, personalização de nomes.
  - `partida.js` – fluxo de nova partida, continuar partida.
  - `menu.js` – menu lateral e modo privacidade.
  - `tema.js` – tema claro/escuro.
  - `pro.js` / `utils-pro.js` – modo PRO e temas PRO.
  - `popup.js`, `accordion.js`, `utils.js`, `estado.js` – utilitários e interface.
- `config/pro-features.json` – definição de temas e features PRO.
- `sw.js` – cache dos arquivos para uso offline.

---

### Recursos principais

- Controle de suspeitos, armas e locais por versão do jogo.
- Marcação de células com:
  - **V** (verdadeiro / certeza)
  - **X** (descartado)
  - **?** (talvez)
- Destaque de **coluna**, **linha** e **interseção** sem alterar a lógica do jogo.
- Salvamento automático no `localStorage` para continuar partidas.
- Modo privacidade para esconder rapidamente o painel.
- Modo PRO com temas especiais e melhorias visuais.

---

### Observações de manutenção

- Evitar mudanças que quebrem o esquema atual de seleção de **linhas**, **colunas** e **células** na tabela.
- O estado do modo PRO é armazenado como objeto JSON na chave `modoPRO` do `localStorage`.
- O service worker (`sw.js`) precisa ser atualizado com um novo `CACHE_NAME` quando arquivos estáticos forem alterados de forma relevante.

