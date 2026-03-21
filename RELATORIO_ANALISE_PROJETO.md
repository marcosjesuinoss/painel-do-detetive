# Relatório de Análise – Painel do Detetive

**Data:** 07/03/2025  
**Escopo:** Análise de problemas e melhorias (sem alteração da estrutura que quebre o app).

---

## 1. Visão geral do projeto

O **Painel do Detetive** é um aplicativo de apoio para partidas do jogo Detetive/Clue. Funciona como bloco de anotações digital: o usuário controla suspeitos, armas e locais, marca cartas (V/X/?), usa destaque por linha/coluna e pode personalizar jogadores e temas. Há modo PRO (temas, IA futura, “sem anúncios”) e PWA (instalável, offline).

**Stack:** Projeto **vanilla** (HTML + CSS + JavaScript), sem framework, sem bundler e sem dependências npm.

---

## 2. Estrutura do projeto

```
Painel do Detetive/
├── index.html              # Única página; todas as "telas" são divs .tela
├── manifest.json           # PWA: nome, ícones, display standalone
├── sw.js                   # Service Worker (cache estático)
├── info.txt                # Notas internas
├── config/
│   └── pro-features.json   # Features PRO e temas (cores, variáveis CSS)
├── css/
│   ├── style.css           # Importa os demais
│   ├── base.css, layout.css, components.css, theme.css, animations.css
├── js/
│   ├── app.js              # DOMContentLoaded: bind de eventos, splash, SW
│   ├── utils.js            # getEl, salvar/ler localStorage, popup sugestão
│   ├── utils-pro.js        # Config PRO, temas PRO, notificação
│   ├── jogadores.js        # Select de jogadores, tela personalizar
│   ├── telas.js            # mostrarTela(id)
│   ├── partida.js          # continuar, nova partida, iniciar partida
│   ├── estado.js           # existeProgressoReal, atualizarBotaoContinuar
│   ├── tabela.js           # cartas, grid, marcações V/X/?
│   ├── menu.js             # toggle privacidade, menu lateral
│   ├── popup.js            # Popups confirmar nova partida / limpar
│   ├── tema.js             # Tema claro/escuro (auto/light/dark)
│   ├── accordion.js        # Accordion da tela de ajuda
│   └── pro.js              # Modo PRO: ativar/cancelar, status, efeitos
```

---

## 3. Pontos positivos

| Área | Descrição |
|------|-----------|
| **Organização** | Um arquivo JS por domínio (telas, partida, estado, tabela, menu, popup, tema, pro). |
| **Optional chaining** | Uso em `app.js` (ex.: `getEl("btnNovoJogo")?.addEventListener`) onde o elemento pode não existir. |
| **Persistência** | `existeProgressoReal()` e `lerPRO()` usam `try/catch` ao fazer `JSON.parse` do `localStorage`. |
| **PWA** | Manifest com ícones e tema; Service Worker com cache e fallback para `index.html`. |
| **Tema** | Tema claro/escuro com `prefers-color-scheme` e persistência da escolha. |
| **Acessibilidade** | `aria-label` nos botões do rodapé; `lang="pt-br"` no HTML. |
| **Documentação** | `info.txt` e `Detalhes do app.txt` ajudam no escopo e próximos passos. |

---

## 4. Problemas encontrados

### 4.1 Erros / robustez (risco de quebra)

| Arquivo | Linhas | Problema |
|---------|--------|----------|
| **js/popup.js** | 6, 10, 20, 24 | `getEl("popupConfirmar")` e `getEl("popupLimpar")` usados sem verificação. Se o elemento não existir, `.classList` gera erro. |
| **js/menu.js** | 40–42 | `getEl("menuLateral")`, `getEl("overlayMenu")`, `getEl("btnMenu")` sem null check antes de `.classList.toggle`. |
| **js/partida.js** | 24 | `getEl("jogadores").value` — se `getEl("jogadores")` for null (ex.: chamada fora da tela novo jogo), quebra. |
| **js/jogadores.js** | 6–8, 26–27 | `getEl("versao").value`, `getEl("jogadores")`, `getEl("editarJogadores")` sem verificação. |
| **js/pro.js** | 47–50, 62–64, 88–90 | Uso de `statusEl`, `statusTexto` e `statusEl.querySelector(...)` sem garantir que existem. |
| **js/accordion.js** | 17, 24 | `item.querySelector(".conteudo")` usado sem verificação; `conteudo.style.maxHeight` pode quebrar. |

### 4.2 Bug de lógica

| Arquivo | Linha | Problema |
|---------|--------|----------|
| **js/utils-pro.js** | 109 | `localStorage.getItem("modoPRO") === "true"` — em `pro.js` o valor salvo é um objeto JSON (ex.: `{"ativo":true,...}`), nunca a string `"true"`. A condição **nunca** é verdadeira; o fallback para tema PRO (ex.: "ouro") não funciona como esperado. |
| **config/pro-features.json** | 147 | Cor inválida no tema diamante: `#d0duff` (typo; "du" não é hex válido). Deveria ser algo como `#d0d1ff`. Pode quebrar ou ignorar o gradiente. |
| **js/jogadores.js** | 33, 37 | `input.maxLength = 4` com comentário “máximo 3 caracteres”; inconsistência entre comentário e código. |

### 4.3 Segurança (XSS)

| Arquivo | Linha | Problema |
|---------|--------|----------|
| **js/tabela.js** | 153 | `cel.innerHTML = \`<strong>${nome}</strong>\`;` — `nome` vem de `localStorage.getItem("nomeJogador" + j)`. Se alguém gravar HTML/script no localStorage, há risco de XSS. **Recomendação:** usar `textContent` ou criar nó de texto. |
| **js/utils-pro.js** | 204 | `card.innerHTML = \`...${tema.nome}...${tema.descricao}...\`` — conteúdo do JSON; risco menor, mas sanitização ou nós de texto é mais seguro. |
| **js/pro.js** | 203, 208 | `textoProEl.innerHTML = "..."` com strings fixas; preferível `textContent` ou conteúdo estático no HTML. |

Não foram encontrados `eval` nem secrets em código.

### 4.4 Performance

| Arquivo | Linhas | Problema |
|---------|--------|----------|
| **js/tabela.js** | 350–352 | Em `marcarCelula`, após cada marcação chama-se `criarTabela()` inteira, reconstruindo todo o DOM. Para tabelas grandes (ex.: Detetive Estrela com 8 jogadores) pode ser pesado. **Sugestão:** atualizar apenas as células/linhas afetadas. |

### 4.5 PWA / cache offline

| Arquivo | Problema |
|---------|----------|
| **sw.js** | `STATIC_FILES` lista apenas `app.js`, `estado.js`, `tabela.js` e `style.css`. Faltam: `utils.js`, `jogadores.js`, `telas.js`, `partida.js`, `menu.js`, `popup.js`, `tema.js`, `accordion.js`, `pro.js`, `utils-pro.js`, e os CSS importados (`base.css`, `layout.css`, etc.). Após install, navegação offline pode falhar ao carregar esses recursos. |

### 4.6 Acessibilidade

- **Já existe:** `aria-label` nos botões do rodapé.
- **Falta:** gerenciamento de foco em popups (trap focus, foco no primeiro elemento, devolver foco ao fechar).
- **Falta:** `aria-expanded` / `aria-controls` no accordion da ajuda.
- **Falta:** skip link “ir para conteúdo” e estrutura de headings consistente em algumas telas.

### 4.7 Testes e documentação

- Nenhum arquivo de teste (sem Jest, Vitest, etc.).
- Nenhum README ou `.md` no projeto (até este relatório).
- Sem pipeline de build (minificação, checagem de vulnerabilidades); como não há `package.json`, não há dependências npm a auditar.

---

## 5. Sugestões de melhoria (priorizadas)

### Prioridade ALTA (evitar quebra e insegurança)

1. **Null checks:** Em todos os usos de `getEl(...)` que acessam propriedades/métodos em seguida, garantir verificação (ou helper que retorne no-op quando o elemento não existir).
2. **Typo no tema:** Em **config/pro-features.json** linha 147: `#d0duff` → `#d0d1ff` (ou o hex desejado).
3. **Condição do modo PRO:** Em **utils-pro.js** linha 109, usar `lerPRO().ativo === true` (ou função equivalente que leia o objeto salvo) em vez de `localStorage.getItem("modoPRO") === "true"`.
4. **XSS na tabela:** Em **tabela.js** linha 153, não usar `innerHTML` com `nome`; usar `textContent` ou criar nó de texto + `<strong>` vazio a preencher, ou sanitizar o valor.

### Prioridade MÉDIA

5. **Performance da tabela:** Em `marcarCelula`, atualizar apenas o estado no `localStorage` e refrescar só as células/linhas alteradas, em vez de chamar `criarTabela()` sempre.
6. **PWA:** Incluir em **sw.js** todos os JS e CSS usados na primeira carga (incluindo os importados por `style.css`) em `STATIC_FILES`, ou estratégia que cacheie as requisições na primeira visita.
7. **Acessibilidade:** Em popups: ao abrir, mover foco para o primeiro controle e trap focus; ao fechar, devolver foco ao botão que abriu. No accordion: `aria-expanded` e `aria-controls`.

### Prioridade BAIXA

8. **Consistência:** Em **jogadores.js**, alinhar comentário ao código (ex.: “máximo 4 caracteres”) ou alterar `maxLength` para 3.
9. **README:** Adicionar README com: como abrir o projeto, estrutura de pastas, como publicar (servir estático/PWA).
10. **Constantes:** Extrair strings repetidas (IDs de elementos, chaves de localStorage) para constantes ou pequeno módulo de config.
11. **Testes (opcional):** Adicionar testes para funções puras (`existeProgressoReal`, `lerPRO`, geração de cartas, etc.).

---

## 6. Conclusão

O **Painel do Detetive** é um app vanilla bem dividido em arquivos, com PWA, temas e modo PRO. Os principais riscos são:

1. Quebras quando elementos do DOM não existem (vários `getEl` sem verificação).
2. Typo na cor do tema diamante (`#d0duff`).
3. Condição incorreta do modo PRO em `utils-pro.js` (tema PRO não restaurado corretamente).
4. Uso de `innerHTML` com dados do usuário na tabela (XSS).
5. Service Worker com cache incompleto (offline incompleto).
6. Recriação total da tabela a cada marcação (performance).

Corrigir null checks, a condição do PRO, o typo do CSS e o uso de `innerHTML` no nome do jogador deixam o projeto mais estável e seguro **sem alterar a estrutura que quebre o app**. Em seguida, completar o cache do SW e reduzir re-renders da tabela melhoram a experiência e o uso offline.

---

*Relatório gerado por análise estática do código. Nenhuma alteração foi feita na estrutura do aplicativo.*
