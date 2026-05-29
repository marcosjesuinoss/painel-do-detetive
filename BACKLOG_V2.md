# Backlog — v2.0 do app

Itens guardados pra próxima versão maior. O foco da **v1.x** é estabilizar features atuais, publicar nas lojas e validar o produto. v2.0 trata de polimentos estruturais e mudanças com risco visual/funcional maior.

---

## UI / Navegação

### Botão "Voltar" das telas — repaginar
**Contexto:** hoje o botão "Voltar" aparece em 6 telas (novoJogo, personalizar, aparência, pro, sobre, ajuda) como botão `.padrao` de largura 100%, alinhado ao topo. Problemas:

- **Hierarquia invertida** — ação secundária (escape) ocupa o mesmo espaço de CTAs primários
- **Primeiro elemento da tela** — usuário entra e vê "Voltar" antes do conteúdo
- **Só texto, sem ícone** — destoa do resto do app que usa SVG Feather
- **Não segue padrão mobile moderno** (iOS/Android usam setinha discreta no canto sup. esq.)

**Proposta:**
- Trocar pra **botão fantasma compacto** no canto superior esquerdo de cada tela
- Setinha SVG (chevron-left, Feather) + texto "Voltar"
- Sem fundo (transparent), sem shadow
- Opacity 0.7 normal, 1.0 ativo
- Cor `var(--text)` (não accent — é navegação, não CTA)
- ~40px altura, padding 8px 12px
- Alinhado à esquerda do container

**Resultado esperado:** título da tela vira o protagonista, navegação fica secundária e coerente com padrão mobile moderno + SVG do resto do app.

**Esforço:** ~30-40 min
**Risco:** Médio-baixo
**Arquivos:** `index.html` (6 lugares), `css/components.css` (reescrever `.btn-voltar` + remover overrides por tela `.tela#ajuda .btn-voltar` etc.), `js/app.js:241` (mantém seletor)

---

## CSS / Estrutura interna

### Consolidar variantes `body.modo-pro.light` / `body.modo-pro:not(.light)` / `body.light`
**Contexto:** ~150-200 linhas duplicadas de regras pra mesmo elemento em variantes de tema diferentes. Aproveitando melhor `var(--accent-rgb)` daria pra reduzir.

**Esforço:** ~1-1.5h
**Risco:** Alto — tem que testar 16 combinações (8 temas × light/dark)
**Quando fazer:** quando precisar mexer naquelas áreas com contexto fresco

### Sistema canônico de botões
**Contexto:** hoje temos 8 estilos custom (`.padrao`, `.play`, `.btn-pro-cta`, `.menu-acao`, `.carta-minha`, `.item-jogador-cartas`, `.btn-cancelar-pro-link`, `.botao-auto`). Cada um define suas próprias dimensões/sombras/states.

**Proposta:** criar `.btn-primary`, `.btn-secondary`, `.btn-ghost` como base + 8 customs herdam deles.

**Esforço:** ~1.5-2h
**Risco:** Alto — fácil quebrar visual específico de um botão
**Quando fazer:** quando precisar refatorar a área de botões por outro motivo

### Pass adicional de shadow scale
**Contexto:** criei `--shadow-sm/md/lg` e apliquei em alguns lugares, mas ~30 box-shadows inline ainda existem.

**Esforço:** ~5-10 min
**Risco:** Baixo (mudança 1:1 onde os valores casam)
**Por que não fiz na v1:** ganho de limpeza interna sem impacto visual

### Consolidar classes de título
**Contexto:** `.titulo-central`, `.titulo-aparencia`, `.pro-checklist-label`, etc. Funcionam mas são abstrações redundantes — type scale já cuida do tamanho. Bastaria `<h2>` puro com `text-align: center` quando precisar.

**Esforço:** ~15-20 min
**Risco:** Médio — tem que ler cada uso pra ver se a classe carrega CSS além de centralização

---

## Funcional / Features

### Vibração háptica
**Contexto:** já planejado. Implementar wrapper `vibrar(tipo)` em utils, toggle "Vibração" na Aparência, hook em ações principais (V/X/?, Undo, Confirmar Minhas Cartas, Trinca).

**Estado:** API `navigator.vibrate` funciona em Android (~70% do mercado BR). iOS bloqueado — precisará de Capacitor Haptics no app nativo.

**Esforço:** ~30 min (esqueleto) / ~1h (completo com variações)
**Risco:** Baixo (no-op silencioso em iOS Safari)

### Termos de Uso + Política de Privacidade
**Contexto:** obrigatório antes de publicar nas lojas e antes de processar pagamento real.

- Termos: limites de responsabilidade, política reembolso "Acesso vitalício", "Atualizações futuras", cancelamento
- Privacidade: LGPD, dados em localStorage só no aparelho, sem coleta externa
- Aviso de cookies se adicionar analytics

**Esforço:** ~30-45 min (esqueleto adequado pra PWA brasileiro)
**Risco:** Baixo (conteúdo principal, sem código)
**Quando fazer:** antes de publicar nas lojas

### Modo Leve / Performance
**Contexto:** opção pra reduzir animações infinitas, drop-shadows, gradientes pra celulares mais simples. Combinar com `prefers-reduced-motion`.

**Esforço:** ~30 min (suave — só anims) / ~2.5h (forte — tudo)
**Risco:** Baixo (toggle opcional, defaults atuais mantidos)

### Popup "Minhas Cartas" — quando o usuário pula e quer reabrir
**Contexto:** hoje o popup "Minhas Cartas" só aparece no início da partida. Se pular e depois quiser usar, precisa "Novo Jogo".

**Possível:** adicionar opção no menu pra reabrir o popup mid-game. Ou desistir e exigir Novo Jogo (decisão atual).

**Esforço:** ~20 min (adicionar opção menu + handler)
**Risco:** Baixo

### Migração pra Capacitor
**Contexto:** publicar nas lojas Android + iOS. Requisitos: ícones, splash, pagamento (Stripe / Mercado Pago / Capacitor Purchases), assinatura, Sentry pra crash reporting.

**Esforço:** ~1-2 semanas trabalho focado
**Risco:** Alto (novo stack, configs específicas das lojas)

---

## Ideias soltas (sem prioridade)

- Estatísticas da jornada do usuário (partidas iniciadas, tempo no app, etc) — mostrar em PRO ativo
- Compartilhar resultado de partida (screenshot + texto) via Web Share API
- Modo "histórico de partidas" — guardar últimas N partidas com data + jogadores + resultado
- Som/feedback de áudio sutil em ações chave (toggle opt-in)
- Onboarding/tutorial visual nas primeiras partidas
