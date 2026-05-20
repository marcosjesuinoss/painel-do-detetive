# Backlog — Assistente de IA

Backlog estruturado de tudo que precisa ser feito no motor lógico do Assistente IA do Painel do Detetive. Ordenado por prioridade.

**Referências:**
- Spec original do usuário (sessão de design, 2026-05-20) — 29 seções
- Análise de gap atual: ~75% do spec ausente no código
- Código atual: [js/assistente-ia.js](js/assistente-ia.js), [js/tabela.js](js/tabela.js), [js/pro.js](js/pro.js), [css/components.css](css/components.css), [index.html](index.html)

**Convenções:**
- **Custo** = tempo de trabalho focado (não wall-clock)
- **Risco** = chance de regressão visual ou de quebrar fluxo existente
- **Dependências** = itens que precisam estar prontos antes

---

## Sumário por prioridade

| P | Categoria | Itens | Custo total |
|---|---|---|---|
| P0 | Bugs críticos | 2 | ~2h |
| P1 | Quick win de performance | 2 | ~6-9h |
| P2 | Limpeza & redundâncias | 6 | ~5h |
| P3 | Fundação do motor | 2 | 2-3 dias |
| P4 | Restaurar deduções faltantes | 3 | 2-3 dias |
| P5 | Inconsistências (UX salto) | 4 | ~2 dias |
| P6 | Controle do usuário | 3 | 2-3 dias |
| P7 | Features avançadas | 4 | 3-5 dias |
| P8 | Otimizações do assistente | 3 | ~6h |
| P9 | Robustez de retomada | 4 | 2-3 dias |
| P10 | Arquitetura (longo prazo) | 3 | 4-5 semanas |
| P11 | Nice to have | 5 | 2-3 semanas |

**Total realístico para "voltar pro spec completo": 4-6 semanas focadas.**

---

## P0 — Bugs críticos

### IA-001 — Corrigir auto-dedução por capacidade que cria V duplicado
- **O quê:** `deduzirCartasPorCapacidadeAssistenteIA()` em [assistente-ia.js:160-246](js/assistente-ia.js) marca uma célula como V sem verificar se outra coluna da mesma linha já tem V. Resultado: cria 2 V's na mesma linha (impossível pelas regras do jogo) e ativa o alerta de duplicidade.
- **Fix:** ao montar `candidatas`, filtrar rows onde alguma coluna já tem V.
- **AC:** roteiro de teste com Player A=V em "Faca" + Player B precisando de 1 carta com candidatas apenas em "Faca" → algoritmo marca "Faca" como X pra B (ou não age), nunca cria V duplicado.
- **Custo:** 30min-1h
- **Risco:** Baixo
- **Deps:** nenhuma

### IA-002 — Restaurar narração de marcações manuais
- **O quê:** `construirMudancasAssistenteIA()` em [assistente-ia.js:361-393](js/assistente-ia.js) tem 4 branches mortos (`trinca-x`, `V`, `X`, `?`) sem produtor. O único evento emitido hoje é `auto-capacidade`.
- **Fix:** ligar hook em `marcarCelula()` ([tabela.js](js/tabela.js)) que chama `registrarMudancaAssistenteIA({ tipo: marcacao, carta, jogador })`.
- **AC:** ao clicar V/X/? em uma célula, o card "O que mudou" passa a narrar ("Marco foi confirmado com Faca", etc.) — não só quando a IA marca sozinha.
- **Custo:** ~1h
- **Risco:** Baixo
- **Deps:** nenhuma

---

## P1 — Quick win de performance (tabela)

### IA-003 — Tabela atualiza só a célula afetada (não recria DOM inteiro)
- **O quê:** `marcarCelula()` em [tabela.js](js/tabela.js) chama `criarTabela()` que recria todos os ~200 elementos DOM. Lag de 200-500ms por clique em mobile.
- **Fix:** mudar `marcarCelula` para atualizar `textContent` + classes da célula clicada, mais um `atualizarDestaques()` cirúrgico. `criarTabela()` segue existindo só para boot.
- **AC:** clicar em V/X/? em celular mid-range fica abaixo de 50ms; nenhum flicker visual; destaques (linha/coluna/interseção) continuam atualizando.
- **Custo:** 4-6h
- **Risco:** **Médio** — afeta interação principal do app
- **Deps:** nenhuma

### IA-004 — Coalescer chamadas de `atualizarAssistenteIA()` via RAF + debounce
- **O quê:** `atualizarAssistenteIA()` é invocada em 3 lugares de [tabela.js](js/tabela.js) (linhas 298, 390, 685) — frequentemente 3x em sequência por um único clique.
- **Fix:** envolver em wrapper `agendarAtualizacaoAssistenteIA()` que faz debounce de 50-100ms via `requestAnimationFrame`.
- **AC:** UI fluida em sequência de marcações rápidas; motor roda 1x por interação consolidada.
- **Custo:** 2-3h
- **Risco:** Baixo
- **Deps:** nenhuma

---

## P2 — Limpeza & redundâncias

### IA-005 — Remover ou ativar branches mortos em `construirMudancasAssistenteIA`
- Após IA-002, decidir destino dos branches `trinca-x` (se não vai ser implementado em P4, remover; senão, deixar em standby).
- **Custo:** 15min
- **Deps:** IA-002

### IA-006 — Remover `porTipo` não usado de `montarResumoLinhasAssistenteIA`
- Campo retornado mas nunca lido por consumers. Ou remover, ou usar (P5/P7 podem precisar dele).
- **Custo:** 15min se remover; 0 se decidirmos usar mais tarde

### IA-007 — Ligar leitura de `assistenteJogadoresMaisCartas`
- Hoje escrito em [partida.js:37](js/partida.js), apagado em [jogadores.js:24](js/jogadores.js), nunca lido. Usar no algoritmo de capacidade pra desempate em 5/7 jogadores.
- **Custo:** 30min
- **Deps:** IA-001 (corrigir capacidade primeiro)

### IA-008 — Centralizar leituras redundantes de `estadoTabela` em [tabela.js](js/tabela.js)
- 6 chamadas separadas a `JSON.parse(localStorage.getItem("estadoTabela"))`. Refatorar pra função única `lerEstadoTabela()` com cache de 1 interaction frame.
- **Custo:** 1h
- **Deps:** nenhuma; sinergia com IA-009

### IA-009 — Remover duplicata de `.status-icon` em components.css
- Linhas 549 e 1847 ambas definem `.status-icon`. Limpar vestígio do design antigo.
- **Custo:** 15min

### IA-010 — Auditar `if (typeof X === "function")` defensivos
- Espalhados em pro.js, tabela.js, menu.js. Sinal de dependências circulares não declaradas. Documentar quais são realmente necessários vs vestígios.
- **Custo:** 1h
- **Deps:** nenhuma; resolução real vem com P10 (módulos ES6)

---

## P3 — Fundação do motor

### IA-011 — Implementar snapshot interno + cache de estado
- **O quê:** criar `construirSnapshotAssistenteIA()` que monta objeto com `{ estadoTabela, numJogadores, nomesJogadores, configuracao, gruposResposta, origensDuvida, cartasPorJogador }`. Cache em `cacheSnapshotAssistenteIA`. Função wrapper `executarComCacheAssistenteIA(callback)` invalida no início.
- **Por quê primeiro:** sem isso, cada nova feature lê localStorage cruamente e cria mais redundância. Base pra tudo P3-P8.
- **AC:** todas funções internas da IA leem do snapshot, não diretamente do localStorage; uma rodada de cálculo vê estado consistente do começo ao fim.
- **Custo:** 1-2 dias
- **Risco:** Médio — refator central da IA
- **Deps:** nenhuma

### IA-012 — Implementar 4 camadas formais + tabela de prioridades
- **O quê:** introduzir `CAMADAS = ["soberana", "estrutural-forte", "dedutiva", "heuristica"]` e mapa `MOTIVO_CAMADA` + tabela `PRIORIDADES`:
  ```
  oculta-direta: 100, linha-unica: 92, grupo-resposta-unico: 90,
  capacidade-coluna: 87, secao-quase-fechada: 84, grupo-resposta: 76,
  grupos-sobrepostos: 72, exclusoes-linha: 68, exige-coluna: 64,
  gargalo-coluna: 61, duvida-manual: 28, heuristica-local: 18
  ```
- Adaptar `montarResumoLinhasAssistenteIA` para anexar `cadeiaPrioridades` e `necessidadeTeste` a cada linha. Adaptar `obterMelhorLinhaPorTipoAssistenteIA` pra usar a tabela.
- **AC:** scores deixam de ser ad-hoc, ficam derivados da camada+prioridade. Cada motivo tem camada conhecida e peso fixo.
- **Custo:** 1 dia
- **Risco:** Médio — mudança fundamental no scoring
- **Deps:** IA-011

---

## P4 — Restaurar deduções faltantes

### IA-013 — Dedução por grupo de resposta
- **Função:** `deduzirCartasPorGrupoRespostaAssistenteIA()`
- **Regra:** em um grupo de resposta, se ainda não há V e só sobrou uma opção não-X, marca essa como V. Motivo `grupo-resposta`.
- **Bloqueador:** depende da estrutura `assistenteGruposResposta` que ainda não existe — incluir criação desta estrutura aqui (UI + persistência básica).
- **Custo:** 1-1.5 dia
- **Deps:** IA-011, IA-012

### IA-014 — Exclusões fortes
- **Função:** `deduzirExclusoesFortesAssistenteIA()`
- **Regras:**
  1. Se coluna fechou mão (`confirmadas >= limite`), tudo aberto vira X. Motivo `coluna-saturada`.
  2. Se linha não pode mais ser oculta e só sobra 1 candidato de coluna, esse candidato vira V. Motivo `linha-unica`.
- **Custo:** 1 dia
- **Deps:** IA-011, IA-012

### IA-015 — Cruzamentos fortes (dupla-trio)
- **Função:** `deduzirCruzamentosFortesAssistenteIA()`
- **Regra:** procurar combinações confinadas de 2 ou 3 colunas onde N linhas consomem exatamente N vagas. Outras células dessas colunas fora das linhas confinadas viram X. Motivo `dupla-trio`.
- **Custo:** 1-1.5 dia
- **Risco:** Médio — algoritmo combinatório, precisa de testes
- **Deps:** IA-011, IA-012, IA-014

---

## P5 — Inconsistências (salto de UX)

### IA-016 — Classificador de inconsistências
- **Função:** `classificarInconsistenciasAssistenteIA(linhas, resumo)` retorna `{ graves: [...], leves: [...] }`.
- **Códigos graves:** `oculta-duplicada`, `linha-v-duplicado`, `coluna-excesso`, `coluna-impossivel-aberta`, `coluna-insuficiente`, `secao-toda-v`.
- **Códigos leves:** `grupo-impossivel`.
- Cada item carrega `foco` opcional (coluna/linhas/células).
- **Custo:** 1 dia
- **Deps:** IA-011, IA-012

### IA-017 — Adicionar 4º card "Inconsistências" no HTML + estrutura
- Editar [index.html](index.html) seção `#assistenteIAMenu` adicionando 4º `<article class="ia-menu-card">`.
- Adaptar `garantirEstruturaAssistenteIA` em [assistente-ia.js:310](js/assistente-ia.js) pra registrar `iaInconsistenciasAssistente`.
- **Custo:** 1h
- **Deps:** IA-016

### IA-018 — Override dos demais cards conforme inconsistência
- Sugestão: se grave → mensagem de correção; se leve → mantém com cautela.
- Confiança: sem inconsistência → Alta/Média/Baixa; grave → "Inválida"; leve → "Cautela".
- **Custo:** 4h
- **Deps:** IA-016, IA-017

### IA-019 — Foco clicável da inconsistência na tabela
- Itens do 4º card com `foco` viram `<button>`. Clique chama nova função em [tabela.js](js/tabela.js) que aplica classe `.assistente-foco-inconsistencia` por 2500ms na coluna/linhas/células indicadas.
- Adicionar CSS pra `.assistente-foco-inconsistencia` (animação pulsante + cor de alerta).
- **Custo:** 4-6h
- **Deps:** IA-017

---

## P6 — Controle do usuário

### IA-020 — Estrutura de configurações persistidas
- Criar chave `assistenteIAConfiguracoes` no localStorage com `{ ativo: true, automarcacao: true, nivelExplicacao: "objetiva" }`.
- Funções: `obterConfiguracaoAssistenteIA()`, `salvarConfiguracaoAssistenteIA(parcial)`, `resetarConfiguracaoAssistenteIA()`.
- Incluir snapshot da IA-011.
- **Custo:** 3-4h
- **Deps:** IA-011

### IA-021 — Popup `#popupConfiguracoesAssistenteIA`
- HTML do popup com 3 controles (toggle ativo, toggle automarcação, radio objetivo/explicativo).
- Função `atualizarPopupConfiguracoesAssistenteIA()` desabilita grupos quando `ativo=false`.
- Botão de abertura no menu lateral (sob `#assistenteIAMenu`).
- **Custo:** 4-6h
- **Deps:** IA-020

### IA-022 — Modo manual: pendências em vez de auto-marcação
- Quando `automarcacao=false`, motor não chama `marcarCelula(cel, "V")`. Em vez disso, registra em `pendenciasMarcacaoAssistenteIA`.
- Card de sugestão passa a listar "Marque V em X para Y" (modo objetivo) ou anexar razão (modo explicativo).
- Confiança rebaixa 1 nível se há pendências.
- **Custo:** 6-8h
- **Deps:** IA-020, IA-021, IA-012

### IA-023 — Integridade global pré-marcação
- Antes de auto-marcar, validar globalmente:
  - Não pode criar coluna impossível
  - Não pode criar duplicidade de oculta
  - Não pode quebrar grupo de resposta
  - Não pode criar excesso de cartas
  - Não pode introduzir inconsistência grave por simulação
- Funções: `marcacaoAutomaticaPermitidaAssistenteIA(acao)`, `validarIntegridadeGlobalAcaoAssistenteIA(acao)`.
- **Custo:** 1 dia
- **Risco:** Médio — guarda contra cascata de erros
- **Deps:** IA-011, IA-016

---

## P7 — Features avançadas

### IA-024 — Grupos de resposta e origens de dúvida (estrutura completa)
- Implementar `assistenteGruposResposta` + `assistenteOrigensDuvida` no localStorage.
- UI pra registrar resposta de jogador ("J3 mostrou uma de 3 cartas").
- Origens formais: `manual`, `grupo`, `manual-e-grupo`, `nenhuma`.
- Influencia score, prioridade, pressão lógica, qualidade da explicação.
- Limpar em `novaPartida()` ([partida.js](js/partida.js)).
- **Custo:** 2-3 dias
- **Risco:** Alto — feature inteira nova
- **Deps:** IA-011, IA-012, IA-013

### IA-025 — Modo explicativo + sugestão tripla
- Modo objetivo: `Sugestão: X + Y + Z.`
- Modo explicativo: `Pergunta sugerida: X + Y + Z [+ por que]`.
- Anexar: cartas ocultas quase resolvidas, explicação heurística de Locais, "Carta sob pressão", "Teste prioritário".
- **Custo:** 1 dia
- **Deps:** IA-020 (config), IA-012

### IA-026 — Sugestão exploratória `obterSugestaoMaximizarInformacaoAssistenteIA`
- Quando não há tripla forte o suficiente, gerar sugestão exploratória orientada a abrir informação e apertar gargalos lógicos.
- **Custo:** 1 dia
- **Deps:** IA-012, IA-025

### IA-027 — Acusação final "Crime solucionado!"
- Quando os 3 tipos (Suspeito + Arma + Local) já são ocultas fortes, o card de sugestão vira "Crime solucionado! Acuse com X + Y + Z".
- **Custo:** 2-3h
- **Deps:** IA-016 (precisa saber que não há inconsistência grave)

---

## P8 — Otimizações do assistente

### IA-028 — Skip de re-render quando snapshot não mudou
- Hash do snapshot, comparar com último; abortar `atualizarAssistenteIA` se igual.
- **Custo:** 1-2h
- **Deps:** IA-011

### IA-029 — Não rodar motor quando menu PRO está fechado
- Guarda `if (assistenteIAMenu.style.display === "none") return;` no início de `atualizarAssistenteIA`.
- **Custo:** 30min
- **Deps:** nenhuma

### IA-030 — Substituir `innerHTML` em rajada por DOM nodes/template
- Cada `atualizarAssistenteIA` faz 3 `innerHTML = ...`. Trocar por `<template>` clonado ou montagem programática.
- **Custo:** 2-3h
- **Deps:** nenhuma

---

## P9 — Robustez de retomada

### IA-031 — Listeners `visibilitychange` / `pagehide` / `pageshow` / `focus`
- Em [app.js](js/app.js), registrar handlers que disparam `reidratarTelaJogoAoRetomar()` quando o usuário volta de tela bloqueada/aba em background.
- **Custo:** 2-3h
- **Deps:** nenhuma

### IA-032 — `garantirIntegridadeDistribuicaoCartasPartida()`
- Em [partida.js](js/partida.js), validar e reconstruir `assistenteCartasPorJogador` no retorno (especialmente crítico em 5/7 jogadores).
- Cancelar pendências antigas; recriar tabela; forçar atualização completa.
- **Custo:** 4-6h
- **Deps:** IA-031

### IA-033 — `reidratarTelaJogoAoRetomar()` + overlay de loading
- Função orquestradora que executa: valida distribuição → reconstrói tabela → repinta visual → restaura snapshot da IA. Overlay visual durante o processo se houve ocultação real.
- **Custo:** 4-6h
- **Deps:** IA-031, IA-032

### IA-034 — `retomarJogoComCarregamento()` + `agendarRetomadaJogoComCarregamento()` + `continuar()`
- API pública para outros módulos pedirem retomada. Coalesce múltiplas chamadas.
- **Custo:** 2-3h
- **Deps:** IA-033

---

## P10 — Arquitetura (longo prazo)

### IA-035 — Camada de estado central (`gameState.js`)
- Único módulo que detém estado completo do jogo + IA. localStorage vira backup (sync periódico), não fonte da verdade.
- Habilita reactivity, undo/redo, testes determinísticos.
- **Custo:** 1-2 semanas
- **Risco:** Alto — refator profundo
- **Deps:** todos P3-P9 idealmente prontos

### IA-036 — Módulos ES6 (`import`/`export`)
- Substitui globals. Permite tree-shaking, elimina `typeof X === "function"`, alinha com Capacitor.
- **Custo:** 1 semana
- **Risco:** Médio
- **Deps:** IA-035

### IA-037 — Migração para TypeScript
- Após módulos ES6, migrar arquivo por arquivo. Tipagem do snapshot da IA é onde mais previne bugs.
- **Custo:** 2-3 semanas
- **Risco:** Médio
- **Deps:** IA-036

---

## P11 — Nice to have

### IA-038 — Suite de testes só do motor lógico
- Vitest ou Jest. Cobrir todas as deduções, classificação de inconsistências, cálculo de confiança como funções puras.
- Cobertura alvo: 80% no motor (não toda a UI).
- **Custo:** 3-5 dias
- **Deps:** IA-011 (snapshot habilita testes puros)

### IA-039 — DSL declarativo pra regras de dedução
- Em vez de função imperativa por dedução, escrever regras como `{ nome, quando, entao, motivo, camada, prioridade }`.
- Adiciona regra nova sem mexer no engine.
- **Custo:** 2-3 dias
- **Deps:** IA-012, IA-013, IA-014, IA-015

### IA-040 — Telemetria local (privacy-friendly)
- localStorage com contadores: acertos da oculta, tempo médio de cálculo, distribuição de níveis de confiança.
- Ajuda a calibrar heurísticas com dados reais.
- **Custo:** 1-2 dias
- **Deps:** IA-011

### IA-041 — Modo "explicar tudo" (árvore de raciocínio)
- Clicar numa sugestão abre painel com árvore completa: motivos → camada → prioridade → linhas envolvidas.
- Útil pra confiança do usuário e debug do motor.
- **Custo:** 2-3 dias
- **Deps:** IA-012, IA-013, IA-014, IA-015

### IA-042 — Web Worker para cálculos pesados
- Após P3-P5, o motor pode ficar custoso em partidas grandes (8 jogadores). Mover deduções pra Worker mantém UI fluida.
- **Custo:** 1-2 dias
- **Deps:** IA-036 (módulos ES6)

---

## Notas operacionais

### Sequência recomendada de execução

1. **Sprint A (3-4 dias)** — P0 + P1 + P2: bugs visíveis + tabela rápida + limpeza. Win rápido.
2. **Sprint B (3-5 dias)** — P3: fundação. Snapshot + camadas + prioridades.
3. **Sprint C (3-4 dias)** — P4: 3 deduções faltantes (grupo-resposta, exclusões-fortes, cruzamentos-fortes).
4. **Sprint D (3-4 dias)** — P5: inconsistências + 4º card + foco clicável. Maior salto perceptível.
5. **Sprint E (3-5 dias)** — P6: configurações + modo manual + integridade global.
6. **Sprint F (5-7 dias)** — P7: grupos de resposta + explicações + acusação final.
7. **Sprint G (3-5 dias)** — P8 + P9: otimizações + retomada robusta.
8. **Backlog longo** — P10 + P11: quando estabilizar e quiser próxima onda.

### Critério "PRO-only" transversal
Todo item P3+ assume que o motor só roda quando `isPRO() === true`. A função `assistenteIAEstaAtivo()` pendente em IA-020 será a fonte autoritativa, conjugando `isPRO()` com `assistenteIAConfiguracoes.ativo`.

### Critério de "PRO-only PRO mesmo"
Lembrar: hoje o "Modo PRO" é ativado por clique sem pagamento real. Antes de publicar app, isso precisa ser resolvido (item #5 do backlog geral, fora do escopo IA).

### Resetar configuração em nova partida
`novaPartida()` em [partida.js](js/partida.js) precisa chamar `resetarConfiguracaoAssistenteIA?.()` + limpar grupos de resposta + limpar origens de dúvida (mas **preservar** distribuição de cartas em 5/7 jogadores).
