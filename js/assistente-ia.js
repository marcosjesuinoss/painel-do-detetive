// ============================================================================
// IA-020: CONFIGURACAO PERSISTIDA DO ASSISTENTE
// ============================================================================
// 3 eixos de comportamento independentes:
//   - ativo: bool        - desliga/liga toda a analise do motor
//   - automarcacao: bool - se true, IA marca V/X automaticamente; se false,
//                          gera apenas instrucoes manuais (pendencias)
//   - nivelExplicacao    - "objetiva" (curta) ou "explicativa" (com razao)
//
// Persistido em localStorage["assistenteIAConfiguracoes"]. Reset em
// novaPartida() preserva o que o usuario configurou se ele quiser
// (decisao deliberada - so reseta se chamar resetarConfiguracaoAssistenteIA).

const CHAVE_CONFIGURACAO_ASSISTENTE_IA = "assistenteIAConfiguracoes";

const CONFIGURACAO_PADRAO_ASSISTENTE_IA = Object.freeze({
  ativo: true,
  automarcacao: true,
  nivelExplicacao: "objetiva",
});

function obterConfiguracaoAssistenteIA() {
  try {
    const bruto = localStorage.getItem(CHAVE_CONFIGURACAO_ASSISTENTE_IA);
    if (!bruto) return { ...CONFIGURACAO_PADRAO_ASSISTENTE_IA };
    const parsed = JSON.parse(bruto);
    // Merge com defaults para tolerar chaves ausentes em saves antigos
    return {
      ativo:
        typeof parsed.ativo === "boolean"
          ? parsed.ativo
          : CONFIGURACAO_PADRAO_ASSISTENTE_IA.ativo,
      automarcacao:
        typeof parsed.automarcacao === "boolean"
          ? parsed.automarcacao
          : CONFIGURACAO_PADRAO_ASSISTENTE_IA.automarcacao,
      nivelExplicacao:
        parsed.nivelExplicacao === "explicativa" ||
        parsed.nivelExplicacao === "objetiva"
          ? parsed.nivelExplicacao
          : CONFIGURACAO_PADRAO_ASSISTENTE_IA.nivelExplicacao,
    };
  } catch {
    return { ...CONFIGURACAO_PADRAO_ASSISTENTE_IA };
  }
}

function salvarConfiguracaoAssistenteIA(parcial) {
  const atual = obterConfiguracaoAssistenteIA();
  const novo = { ...atual, ...(parcial || {}) };
  // Sanidade: nao deixa nivelExplicacao virar algo invalido
  if (novo.nivelExplicacao !== "objetiva" && novo.nivelExplicacao !== "explicativa") {
    novo.nivelExplicacao = "objetiva";
  }
  localStorage.setItem(CHAVE_CONFIGURACAO_ASSISTENTE_IA, JSON.stringify(novo));
  return novo;
}

function resetarConfiguracaoAssistenteIA() {
  localStorage.removeItem(CHAVE_CONFIGURACAO_ASSISTENTE_IA);
  return { ...CONFIGURACAO_PADRAO_ASSISTENTE_IA };
}

// Combina PRO + configuracao.ativo. Toda checagem "deve rodar assistente?"
// deveria passar por aqui em vez de chamar isPRO() direto.
function assistenteIAEstaAtivo() {
  if (typeof isPRO !== "function" || !isPRO()) return false;
  const cfg = obterConfiguracaoAssistenteIA();
  return cfg.ativo === true;
}

// ============================================================================
// IA-021: HANDLERS DO POPUP DE CONFIGURACOES
// ============================================================================

function abrirConfiguracoesAssistenteIA(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  // Pre-fill com config atual
  const cfg = obterConfiguracaoAssistenteIA();
  const ativoEl = getEl("configIAAtivo");
  const autoEl = getEl("configIAAutomarcacao");
  const radios = document.querySelectorAll('input[name="configIANivel"]');

  if (ativoEl) ativoEl.checked = cfg.ativo;
  if (autoEl) autoEl.checked = cfg.automarcacao;
  radios.forEach((r) => {
    r.checked = r.value === cfg.nivelExplicacao;
  });

  atualizarPopupConfiguracoesAssistenteIA();

  if (typeof abrirOverlayAcessivel === "function") {
    abrirOverlayAcessivel(
      "popupConfiguracoesAssistenteIA",
      "#configIAAtivo, .popup-acoes .play",
    );
  } else {
    const popup = getEl("popupConfiguracoesAssistenteIA");
    if (popup) popup.classList.add("ativo");
  }
}

function fecharConfiguracoesAssistenteIA() {
  if (typeof fecharOverlayAcessivel === "function") {
    fecharOverlayAcessivel("popupConfiguracoesAssistenteIA");
  } else {
    const popup = getEl("popupConfiguracoesAssistenteIA");
    if (popup) popup.classList.remove("ativo");
  }
}

function confirmarConfiguracoesAssistenteIA() {
  const ativoEl = getEl("configIAAtivo");
  const autoEl = getEl("configIAAutomarcacao");
  const radioChecked = document.querySelector('input[name="configIANivel"]:checked');

  const parcial = {};
  if (ativoEl) parcial.ativo = !!ativoEl.checked;
  if (autoEl) parcial.automarcacao = !!autoEl.checked;
  if (radioChecked && radioChecked.value) parcial.nivelExplicacao = radioChecked.value;

  salvarConfiguracaoAssistenteIA(parcial);
  fecharConfiguracoesAssistenteIA();

  // Re-roda IA com nova config. Quando o usuario desliga via popup, o
  // menu CONTINUA visivel mas com mensagem "Desativado" nos cards (para
  // que o gear de configuracao permaneca acessivel para reativacao).
  if (typeof agendarAtualizacaoAssistenteIA === "function") {
    agendarAtualizacaoAssistenteIA();
  } else if (typeof atualizarAssistenteIA === "function") {
    atualizarAssistenteIA();
  }
}

function atualizarPopupConfiguracoesAssistenteIA() {
  const ativoEl = getEl("configIAAtivo");
  if (!ativoEl) return;
  const dependentes = document.querySelectorAll(
    "#popupConfiguracoesAssistenteIA [data-dependente-de-ativo]",
  );
  const habilitar = ativoEl.checked;
  dependentes.forEach((grupo) => {
    grupo.classList.toggle("desabilitado", !habilitar);
    grupo.querySelectorAll("input").forEach((input) => {
      input.disabled = !habilitar;
    });
  });
}

// ============================================================================
// IA-011: SNAPSHOT + CACHE DO MOTOR DO ASSISTENTE
// ============================================================================
// Em vez de cada funcao ler localStorage diretamente (gerando leituras
// redundantes e potenciais inconsistencias quando alguma funcao escreve no
// meio de outra), o motor monta UM snapshot consolidado por ciclo e todas
// as funcoes downstream leem dele.
//
// API:
//   obterSnapshotAssistenteIA()        -> retorna snapshot ativo OU constroi um novo
//   executarComCacheAssistenteIA(fn)   -> ativa cache durante fn, invalida ao fim
//   invalidarSnapshotAssistenteIA()    -> dropa o cache (forca proximo getter a reler)
//
// Os getters obter*AssistenteIA checam o cache primeiro. Sem cache ativo,
// fazem leitura direta de localStorage como antes (backward-compat).
//
// Snapshot inclui placeholders para campos que ainda nao existem:
//   configuracao (P6 / IA-020)
//   gruposResposta, origensDuvida (P7 / IA-024)

let cacheSnapshotAssistenteIA = null;

function construirSnapshotAssistenteIA() {
  const numJogadores = parseInt(localStorage.getItem("numJogadores") || "3", 10);

  const nomesJogadores = [];
  for (let i = 0; i < numJogadores; i++) {
    nomesJogadores.push(
      localStorage.getItem(`nomeJogador${i + 1}`) || `J${i + 1}`,
    );
  }

  let estadoTabela = {};
  try {
    estadoTabela = JSON.parse(localStorage.getItem("estadoTabela") || "{}");
  } catch {}

  let cartasPorJogador = null;
  try {
    const salvas = JSON.parse(
      localStorage.getItem("assistenteCartasPorJogador") || "null",
    );
    if (Array.isArray(salvas) && salvas.length === numJogadores) {
      cartasPorJogador = salvas.map((v) => parseInt(v, 10));
    }
  } catch {}
  if (
    !cartasPorJogador &&
    typeof obterConfiguracaoDistribuicaoCartas === "function"
  ) {
    const configuracao = obterConfiguracaoDistribuicaoCartas(numJogadores);
    if (configuracao && !configuracao.precisaSelecionar) {
      cartasPorJogador = configuracao.cartasPorJogador.slice();
    }
  }

  let jogadoresMaisCartas = [];
  try {
    const lista = JSON.parse(
      localStorage.getItem("assistenteJogadoresMaisCartas") || "null",
    );
    if (Array.isArray(lista)) {
      jogadoresMaisCartas = lista.map((v) => parseInt(v, 10));
    }
  } catch {}

  // IA-020: configuracao real (Sprint E)
  const configuracao = obterConfiguracaoAssistenteIA();
  // Sprint G (trinca de ?): grupos de resposta e origens de duvida
  // tambem reais agora (eram placeholder ate aqui).
  const gruposResposta =
    typeof obterGruposResposta === "function" ? obterGruposResposta() : [];
  const origensDuvida =
    typeof obterOrigensDuvida === "function" ? obterOrigensDuvida() : {};

  return {
    estadoTabela,
    numJogadores,
    nomesJogadores,
    cartasPorJogador,
    jogadoresMaisCartas,
    configuracao,
    gruposResposta,
    origensDuvida,
    timestamp: Date.now(),
  };
}

function obterSnapshotAssistenteIA() {
  if (cacheSnapshotAssistenteIA !== null) return cacheSnapshotAssistenteIA;
  return construirSnapshotAssistenteIA();
}

function invalidarSnapshotAssistenteIA() {
  cacheSnapshotAssistenteIA = null;
}

function executarComCacheAssistenteIA(callback) {
  cacheSnapshotAssistenteIA = construirSnapshotAssistenteIA();
  try {
    return callback(cacheSnapshotAssistenteIA);
  } finally {
    cacheSnapshotAssistenteIA = null;
  }
}

// ============================================================================
// IA-012: CAMADAS LOGICAS E TABELA DE PRIORIDADES
// ============================================================================
// O motor classifica cada motivo de inferencia em uma das 4 camadas formais.
// Camadas tem peso decrescente para desempate, priorizacao e calculo de
// confianca. Prioridades sao numericas e usadas em score/cadeiaPrioridades.
//
// Estas estruturas sao expostas para uso em sprints C+ (P4 deducoes,
// P5 inconsistencias, P6+ refinamentos). Sprint B nao muda comportamento
// observavel - so disponibiliza a infraestrutura.

const CAMADAS_ASSISTENTE_IA = Object.freeze([
  "soberana",
  "estrutural-forte",
  "dedutiva",
  "heuristica",
]);

const PESO_CAMADA_ASSISTENTE_IA = Object.freeze({
  "soberana": 4,
  "estrutural-forte": 3,
  "dedutiva": 2,
  "heuristica": 1,
});

const MOTIVO_CAMADA_ASSISTENTE_IA = Object.freeze({
  "oculta-direta": "soberana",
  "capacidade-coluna": "soberana",
  "exige-coluna": "soberana",
  "linha-unica": "estrutural-forte",
  "grupo-resposta-unico": "estrutural-forte",
  "secao-quase-fechada": "estrutural-forte",
  "grupo-resposta": "dedutiva",
  "grupos-sobrepostos": "dedutiva",
  "exclusoes-linha": "dedutiva",
  "gargalo-coluna": "dedutiva",
  "duvida-manual": "dedutiva",
  "heuristica-local": "heuristica",
});

const PRIORIDADE_MOTIVO_ASSISTENTE_IA = Object.freeze({
  "oculta-direta": 100,
  "linha-unica": 92,
  "grupo-resposta-unico": 90,
  "capacidade-coluna": 87,
  "secao-quase-fechada": 84,
  "grupo-resposta": 76,
  "grupos-sobrepostos": 72,
  "exclusoes-linha": 68,
  "exige-coluna": 64,
  "gargalo-coluna": 61,
  "duvida-manual": 28,
  "heuristica-local": 18,
});

function obterCamadaDoMotivoAssistenteIA(motivo) {
  return MOTIVO_CAMADA_ASSISTENTE_IA[motivo] || "heuristica";
}

function obterPrioridadeDoMotivoAssistenteIA(motivo) {
  return PRIORIDADE_MOTIVO_ASSISTENTE_IA[motivo] || 0;
}

function obterPesoDaCamadaAssistenteIA(camada) {
  return PESO_CAMADA_ASSISTENTE_IA[camada] || 0;
}

// ============================================================================
// GETTERS - leem do snapshot quando ha cache ativo, fallback para localStorage
// ============================================================================

function obterEstadoTabelaAssistenteIA() {
  if (cacheSnapshotAssistenteIA !== null) {
    return cacheSnapshotAssistenteIA.estadoTabela;
  }
  try {
    return JSON.parse(localStorage.getItem("estadoTabela") || "{}");
  } catch {
    return {};
  }
}

function obterNumeroJogadoresAssistenteIA() {
  if (cacheSnapshotAssistenteIA !== null) {
    return cacheSnapshotAssistenteIA.numJogadores;
  }
  return parseInt(localStorage.getItem("numJogadores") || "3", 10);
}

function obterNomeJogadorAssistenteIA(coluna) {
  if (cacheSnapshotAssistenteIA !== null) {
    return (
      cacheSnapshotAssistenteIA.nomesJogadores[coluna] || `J${coluna + 1}`
    );
  }
  return localStorage.getItem(`nomeJogador${coluna + 1}`) || `J${coluna + 1}`;
}

function obterCartasPorJogadorAssistenteIA() {
  if (cacheSnapshotAssistenteIA !== null) {
    return cacheSnapshotAssistenteIA.cartasPorJogador;
  }
  const jogadores = obterNumeroJogadoresAssistenteIA();

  try {
    const salvas = JSON.parse(localStorage.getItem("assistenteCartasPorJogador") || "null");
    if (Array.isArray(salvas) && salvas.length === jogadores) {
      return salvas.map((valor) => parseInt(valor, 10));
    }
  } catch {}

  if (typeof obterConfiguracaoDistribuicaoCartas === "function") {
    const configuracao = obterConfiguracaoDistribuicaoCartas(jogadores);
    if (configuracao && !configuracao.precisaSelecionar) {
      return configuracao.cartasPorJogador.slice();
    }
  }

  return null;
}

// IA-007: getter para a lista de jogadores com mais cartas (5/7 jogadores).
// Hoje a deducao usa apenas cartasPorJogador, que ja e o array resolvido.
// Este getter expoe a lista bruta para P7 (modo explicativo) e validacao.
function obterJogadoresMaisCartasAssistenteIA() {
  if (cacheSnapshotAssistenteIA !== null) {
    return cacheSnapshotAssistenteIA.jogadoresMaisCartas;
  }
  try {
    const lista = JSON.parse(localStorage.getItem("assistenteJogadoresMaisCartas") || "null");
    return Array.isArray(lista) ? lista.map((v) => parseInt(v, 10)) : [];
  } catch {
    return [];
  }
}

// IA-007: validacao opcional - garante que a distribuicao salva e o
// conjunto "jogadores com mais cartas" sao consistentes. Loga warning
// caso contrario (ajuda detectar bug de retomada em 5/7 jogadores).
function validarConsistenciaDistribuicaoAssistenteIA() {
  const cartasPorJogador = obterCartasPorJogadorAssistenteIA();
  const maisCartas = obterJogadoresMaisCartasAssistenteIA();
  if (!Array.isArray(cartasPorJogador) || cartasPorJogador.length === 0) return true;
  if (maisCartas.length === 0) return true;

  const maxCartas = Math.max(...cartasPorJogador);
  for (const idx of maisCartas) {
    if (cartasPorJogador[idx] !== maxCartas) {
      console.warn(
        `[Assistente IA] Inconsistencia: jogador ${idx} marcado como "mais cartas" tem ${cartasPorJogador[idx]} cartas; maximo da distribuicao e ${maxCartas}.`,
      );
      return false;
    }
  }
  return true;
}

function obterLinhasAssistenteIA() {
  if (!Array.isArray(cartas) || cartas.length === 0) return [];

  const estado = obterEstadoTabelaAssistenteIA();
  const jogadores = obterNumeroJogadoresAssistenteIA();
  // Sprint G (trinca de ?): le origens de duvida do snapshot para diff
  // entre "?" manual (dúvida local) e "?" de grupo (evidência forte).
  const snapshot = obterSnapshotAssistenteIA();
  const origens = (snapshot && snapshot.origensDuvida) || {};

  return cartas.map((carta, row) => {
    const estados = [];
    let vCount = 0;
    let xCount = 0;
    let maybeCount = 0;
    let maybeManualCount = 0;
    let maybeGrupoCount = 0;

    for (let col = 0; col < jogadores; col++) {
      const valor = estado[`${row}-${col}`] || "";
      estados.push(valor);

      if (valor === "V") vCount++;
      if (valor === "X") xCount++;
      if (valor === "?") {
        maybeCount++;
        const chave = `${row}-${col}`;
        const origem = origens[chave];
        if (origem) {
          if (origem.manual) maybeManualCount++;
          if (Array.isArray(origem.grupos) && origem.grupos.length > 0) {
            maybeGrupoCount++;
          }
        } else {
          // "?" sem origem registrada (legacy ou edge case): conta como manual
          maybeManualCount++;
        }
      }
    }

    return {
      row,
      tipo: carta.tipo,
      nome: carta.nome,
      estados,
      vCount,
      xCount,
      maybeCount,
      maybeManualCount,
      maybeGrupoCount,
      isFound: vCount > 0,
      isAllX: xCount === jogadores,
      candidatos: estados
        .map((valor, col) => ({ valor, col }))
        .filter((item) => item.valor !== "X"),
    };
  });
}

function calcularPesoOcultacaoLocal(infoLinha, linhas) {
  if (infoLinha.tipo !== "Locais") return 0;

  return infoLinha.candidatos.reduce((total, candidato) => {
    const col = candidato.col;

    const alternativasNaoLocal = linhas.filter(
      (linha) =>
        linha.tipo !== "Locais" &&
        !linha.isFound &&
        linha.estados[col] !== "X" &&
        (linha.estados[col] === "?" || linha.xCount > 0),
    ).length;

    return total + alternativasNaoLocal;
  }, 0);
}

function montarResumoLinhasAssistenteIA(linhas) {
  // IA-006: porTipo era retornado mas nunca consumido externamente.
  // Mantemos apenas como variavel local para o filtro abaixo - quando
  // P5 (inconsistencias) e P7 (grupos resposta) chegarem e precisarem
  // dessa agregacao, sera adicionada de volta no return.
  const porTipo = {
    Suspeitos: linhas.filter((linha) => linha.tipo === "Suspeitos"),
    Armas: linhas.filter((linha) => linha.tipo === "Armas"),
    Locais: linhas.filter((linha) => linha.tipo === "Locais"),
  };

  const ocultas = [];

  Object.values(porTipo).forEach((grupo) => {
    const semV = grupo.filter((linha) => !linha.isFound);
    if (semV.length === 1) {
      ocultas.push({
        ...semV[0],
        motivo: "ultima-sem-v",
        score: 100,
      });
    }
  });

  linhas.forEach((linha) => {
    if (linha.isAllX) {
      ocultas.push({
        ...linha,
        motivo: "linha-toda-x",
        score: 120 + calcularPesoOcultacaoLocal(linha, linhas),
      });
    }
  });

  const mapaOcultas = new Map();
  ocultas.forEach((linha) => {
    const atual = mapaOcultas.get(linha.row);
    if (!atual || linha.score > atual.score) {
      mapaOcultas.set(linha.row, linha);
    }
  });

  const candidatosOcultos = linhas
    .filter((linha) => !linha.isFound)
    .map((linha) => {
      let score = linha.xCount * 8 + linha.maybeCount * 3;

      if (linha.tipo === "Locais") {
        score += calcularPesoOcultacaoLocal(linha, linhas) * 1.5;
      }

      if (linha.candidatos.length <= 2) {
        score += 8;
      }

      return {
        ...linha,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    ocultas: Array.from(mapaOcultas.values()),
    candidatosOcultos,
  };
}

// ============================================================================
// TRINCA DE ? : PERSISTENCIA DE GRUPOS DE RESPOSTA + ORIGENS DE DUVIDA
// ============================================================================
// Grupos de resposta representam a estrutura logica "jogador X mostrou UMA
// das 3 cartas (A, B, C)" - sabemos a coluna e as 3 linhas, mas nao qual
// das 3 foi mostrada. Persistidos em localStorage para sobreviver a recarga.
//
// Estrutura grupo:
//   { id: string, coluna: int, rows: [int, int, int], timestamp: number }
//
// Origens de duvida: cada celula com "?" tem origem registrada. Permite
// distinguir "?" manual puro (incerteza local) de "?" vindo de grupo
// (evidencia estrutural forte).
//
// Estrutura origens:
//   { "<chave>": { manual: bool, grupos: [grupoId, ...] } }

const CHAVE_GRUPOS_RESPOSTA = "assistenteGruposResposta";
const CHAVE_ORIGENS_DUVIDA = "assistenteOrigensDuvida";

function obterGruposResposta() {
  try {
    const bruto = localStorage.getItem(CHAVE_GRUPOS_RESPOSTA);
    if (!bruto) return [];
    const arr = JSON.parse(bruto);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function salvarGruposResposta(grupos) {
  localStorage.setItem(CHAVE_GRUPOS_RESPOSTA, JSON.stringify(grupos || []));
}

function resetarGruposResposta() {
  localStorage.removeItem(CHAVE_GRUPOS_RESPOSTA);
}

function obterOrigensDuvida() {
  try {
    const bruto = localStorage.getItem(CHAVE_ORIGENS_DUVIDA);
    if (!bruto) return {};
    const obj = JSON.parse(bruto);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function salvarOrigensDuvida(origens) {
  localStorage.setItem(CHAVE_ORIGENS_DUVIDA, JSON.stringify(origens || {}));
}

function resetarOrigensDuvida() {
  localStorage.removeItem(CHAVE_ORIGENS_DUVIDA);
}

function registrarOrigemDuvidaManual(chave) {
  const origens = obterOrigensDuvida();
  if (!origens[chave]) origens[chave] = { manual: false, grupos: [] };
  origens[chave].manual = true;
  salvarOrigensDuvida(origens);
}

function registrarOrigemDuvidaGrupo(chave, grupoId) {
  const origens = obterOrigensDuvida();
  if (!origens[chave]) origens[chave] = { manual: false, grupos: [] };
  if (!Array.isArray(origens[chave].grupos)) origens[chave].grupos = [];
  if (!origens[chave].grupos.includes(grupoId)) {
    origens[chave].grupos.push(grupoId);
  }
  salvarOrigensDuvida(origens);
}

function removerOrigemDuvida(chave) {
  const origens = obterOrigensDuvida();
  if (origens[chave]) {
    delete origens[chave];
    salvarOrigensDuvida(origens);
  }
}

// Quando uma celula "?" e apagada manualmente, remove a row do grupo
// associado. Se o grupo encolher abaixo de 2 cartas, o grupo nao faz
// mais sentido logico e e descartado.
function editarGruposRespostaPorApagamento(chave, row, col) {
  const origens = obterOrigensDuvida();
  const origem = origens[chave];
  if (!origem || !Array.isArray(origem.grupos) || origem.grupos.length === 0) {
    return;
  }

  const grupos = obterGruposResposta();
  const rowNum = parseInt(row, 10);
  const colNum = parseInt(col, 10);
  let mudou = false;

  const novosGrupos = [];
  for (const g of grupos) {
    if (!origem.grupos.includes(g.id)) {
      novosGrupos.push(g);
      continue;
    }
    if (g.coluna !== colNum) {
      novosGrupos.push(g);
      continue;
    }
    const novasRows = g.rows.filter((r) => r !== rowNum);
    if (novasRows.length < 2) {
      // Grupo colapsa - descartar
      mudou = true;
      continue;
    }
    novosGrupos.push({ ...g, rows: novasRows });
    mudou = true;
  }

  if (mudou) salvarGruposResposta(novosGrupos);
}

// ============================================================================
// IA-022: MODO MANUAL (pendencias em vez de auto-marcacao)
// ============================================================================
// Quando config.automarcacao=false, as deducoes NAO chamam marcarCelula -
// elas registram em pendenciasMarcacaoAssistenteIA. O card "Proxima sugestao"
// passa a listar "Marque V em X para Y" (modo objetivo) ou anexa razao
// (modo explicativo). Confianca rebaixa 1 nivel quando ha pendencias.

let pendenciasMarcacaoAssistenteIA = [];

function resetarPendenciasMarcacaoAssistenteIA() {
  pendenciasMarcacaoAssistenteIA = [];
}

function ehAutomarcacaoAtivaAssistenteIA() {
  const cfg = obterConfiguracaoAssistenteIA();
  return cfg.automarcacao === true;
}

// Helper que cada deducao usa em vez de chamar marcarCelula diretamente.
// Retorna true se aplicou (modo automatico), false se adiou ou bloqueou.
function aplicarOuAdiarMarcacaoAssistenteIA(acao) {
  // Idempotencia: se valor ja igual, nao faz nada (evita re-validacao)
  const snap = obterSnapshotAssistenteIA();
  const valorAtual = snap.estadoTabela[acao.chave] || "";
  if (valorAtual === acao.marca) return false;

  // IA-023: integridade pre-marcacao - bloqueia acoes que criariam
  // inconsistencia grave (coluna excesso, duplicidade de oculta, etc).
  if (!marcacaoAutomaticaPermitidaAssistenteIA(acao)) {
    console.warn(
      `[Assistente IA] Acao bloqueada por integridade: marca=${acao.marca} chave=${acao.chave} motivo=${acao.motivo}`,
    );
    return false;
  }

  if (ehAutomarcacaoAtivaAssistenteIA()) {
    const cel = document.querySelector(`[data-key="${acao.chave}"]`);
    if (!cel) return false;
    marcarCelula(cel, acao.marca);
    return true;
  }
  // Modo manual: dedupe por chave+marca antes de adicionar
  const jaExiste = pendenciasMarcacaoAssistenteIA.some(
    (p) => p.chave === acao.chave && p.marca === acao.marca,
  );
  if (!jaExiste) {
    pendenciasMarcacaoAssistenteIA.push({ ...acao });
  }
  return false;
}

// ============================================================================
// IA-023: INTEGRIDADE PRE-MARCACAO
// ============================================================================
// Antes de aplicar (ou adiar) uma acao auto-detectada, simula o efeito
// global. Se a acao geraria inconsistencia grave (coluna-excesso,
// oculta-duplicada, secao-toda-v, etc), bloqueia. Isso evita que bug em
// uma deducao cascateie em estado invalido.

function construirLinhasDeEstadoAssistenteIA(estadoSimulado) {
  if (!Array.isArray(cartas) || cartas.length === 0) return [];
  const jogadores = obterNumeroJogadoresAssistenteIA();
  return cartas.map((carta, row) => {
    const estados = [];
    let vCount = 0;
    let xCount = 0;
    let maybeCount = 0;
    for (let col = 0; col < jogadores; col++) {
      const valor = estadoSimulado[`${row}-${col}`] || "";
      estados.push(valor);
      if (valor === "V") vCount++;
      if (valor === "X") xCount++;
      if (valor === "?") maybeCount++;
    }
    return {
      row,
      tipo: carta.tipo,
      nome: carta.nome,
      estados,
      vCount,
      xCount,
      maybeCount,
      isFound: vCount > 0,
      isAllX: xCount === jogadores,
      candidatos: estados
        .map((valor, col) => ({ valor, col }))
        .filter((item) => item.valor !== "X"),
    };
  });
}

function simularAcaoAssistenteIA(acao) {
  const snapshot = obterSnapshotAssistenteIA();
  return { ...snapshot.estadoTabela, [acao.chave]: acao.marca };
}

// Validacao completa: simula a acao e classifica inconsistencias.
// Retorna true se nenhuma inconsistencia grave seria criada.
function validarIntegridadeGlobalAcaoAssistenteIA(acao) {
  const estadoSim = simularAcaoAssistenteIA(acao);
  const linhasSim = construirLinhasDeEstadoAssistenteIA(estadoSim);
  const inc = classificarInconsistenciasAssistenteIA(linhasSim);
  return inc.graves.length === 0;
}

// Wrapper: validacao rapida (sem reconstruir tudo) + global se passou.
// Garante 2 camadas: defesa cheap por excesso simples + defesa profunda
// via simulacao global.
function marcacaoAutomaticaPermitidaAssistenteIA(acao) {
  const snapshot = obterSnapshotAssistenteIA();

  // Validacao rapida 1: V que excederia capacidade da coluna
  if (acao.marca === "V" && Array.isArray(snapshot.cartasPorJogador)) {
    const limite = snapshot.cartasPorJogador[acao.col];
    if (typeof limite === "number") {
      let vAtual = 0;
      for (let row = 0; row < cartas.length; row++) {
        if (snapshot.estadoTabela[`${row}-${acao.col}`] === "V") vAtual++;
      }
      if (vAtual + 1 > limite) return false;
    }
  }

  // Validacao rapida 2: V que duplicaria V em outra coluna da mesma linha
  if (acao.marca === "V") {
    const jogadores = snapshot.numJogadores;
    for (let col = 0; col < jogadores; col++) {
      if (col === acao.col) continue;
      if (snapshot.estadoTabela[`${acao.row}-${col}`] === "V") return false;
    }
  }

  // Validacao profunda: simulacao global + classificarInconsistencias
  return validarIntegridadeGlobalAcaoAssistenteIA(acao);
}

const MOTIVO_LEGIVEL_ASSISTENTE_IA = {
  capacidade: "jogador fecha a mao com essa carta",
  "coluna-saturada": "outras cartas dessa coluna ja foram confirmadas",
  "linha-unica": "secao ja tem a oculta - esta carta tem 1 candidato unico",
  "dupla-trio": "outras linhas estao confinadas em outras colunas",
  "grupo-resposta-unico": "grupo de resposta tem so esta carta como opcao restante",
};

function motivoLegivelAssistenteIA(motivo) {
  return MOTIVO_LEGIVEL_ASSISTENTE_IA[motivo] || motivo;
}

function construirInstrucoesPendentesAssistenteIA() {
  if (pendenciasMarcacaoAssistenteIA.length === 0) return [];

  const cfg = obterConfiguracaoAssistenteIA();
  const explicativo = cfg.nivelExplicacao === "explicativa";
  const snapshot = obterSnapshotAssistenteIA();
  const itens = [];

  itens.push(
    `A IA detectou ${pendenciasMarcacaoAssistenteIA.length} marca${pendenciasMarcacaoAssistenteIA.length === 1 ? "cao" : "coes"} sugerida${pendenciasMarcacaoAssistenteIA.length === 1 ? "" : "s"} (marcação automática desligada):`,
  );

  const LIMITE_LISTA = 4;
  const mostrar = Math.min(pendenciasMarcacaoAssistenteIA.length, LIMITE_LISTA);
  for (let i = 0; i < mostrar; i++) {
    const p = pendenciasMarcacaoAssistenteIA[i];
    const carta =
      Array.isArray(cartas) && cartas[p.row] ? cartas[p.row].nome : `linha ${p.row}`;
    const jogador = snapshot.nomesJogadores[p.col] || `J${p.col + 1}`;
    let texto = `Marque ${p.marca} em ${carta} para ${jogador}`;
    if (explicativo && p.motivo) {
      texto += ` (${motivoLegivelAssistenteIA(p.motivo)})`;
    }
    itens.push(texto + ".");
  }
  if (pendenciasMarcacaoAssistenteIA.length > LIMITE_LISTA) {
    const resto = pendenciasMarcacaoAssistenteIA.length - LIMITE_LISTA;
    itens.push(`+ ${resto} marca${resto === 1 ? "cao" : "coes"} adicional${resto === 1 ? "" : "is"}.`);
  }

  return itens;
}

let executandoDeducaoCapacidadeAssistenteIA = false;

function deduzirCartasPorCapacidadeAssistenteIA() {
  if (executandoDeducaoCapacidadeAssistenteIA) return false;
  if (!Array.isArray(cartas) || cartas.length === 0) return false;

  const cartasPorJogador = obterCartasPorJogadorAssistenteIA();
  if (!Array.isArray(cartasPorJogador) || cartasPorJogador.length === 0) {
    return false;
  }

  executandoDeducaoCapacidadeAssistenteIA = true;

  try {
    let houveMudanca = false;
    // IA-022: em modo manual, so 1 passada (sem aplicar -> estado nao muda
    // -> proximas iteracoes detectariam as mesmas acoes -> loop sem progresso)
    const maxTentativas = ehAutomarcacaoAtivaAssistenteIA() ? 10 : 1;

    for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
      const estado = obterEstadoTabelaAssistenteIA();
      const jogadores = obterNumeroJogadoresAssistenteIA();
      const acoes = [];

      // IA-001: linhas que ja possuem V em alguma coluna nao podem receber
      // novo V em outra coluna (cada carta tem dono unico).
      const linhasComV = new Set();
      for (let row = 0; row < cartas.length; row++) {
        for (let c = 0; c < jogadores; c++) {
          if (estado[`${row}-${c}`] === "V") {
            linhasComV.add(row);
            break;
          }
        }
      }

      for (let col = 0; col < jogadores; col++) {
        const limite = cartasPorJogador[col];
        let confirmadas = 0;
        const candidatas = [];

        for (let row = 0; row < cartas.length; row++) {
          const chave = `${row}-${col}`;
          const valor = estado[chave] || "";

          if (valor === "V") {
            confirmadas++;
            continue;
          }

          // Exclui rows ja confirmadas em outra coluna (impede V duplicado)
          if (valor !== "X" && !linhasComV.has(row)) {
            candidatas.push({ row, col, chave });
          }
        }

        const faltam = limite - confirmadas;
        if (faltam <= 0) continue;

        if (candidatas.length === faltam) {
          candidatas.forEach((acao) => acoes.push(acao));
        }
      }

      if (acoes.length === 0) {
        break;
      }

      const unicas = new Map();
      acoes.forEach((acao) => {
        unicas.set(acao.chave, acao);
      });

      const porJogador = new Map();

      unicas.forEach((acao) => {
        const aplicada = aplicarOuAdiarMarcacaoAssistenteIA({
          row: acao.row,
          col: acao.col,
          chave: acao.chave,
          marca: "V",
          motivo: "capacidade",
        });

        if (aplicada) {
          houveMudanca = true;

          if (!porJogador.has(acao.col)) {
            porJogador.set(acao.col, []);
          }

          porJogador.get(acao.col).push(cartas[acao.row].nome);
        }
      });

      if (porJogador.size > 0 && typeof registrarMudancaAssistenteIA === "function") {
        const [coluna, nomesCartas] = porJogador.entries().next().value;
        registrarMudancaAssistenteIA({
          tipo: "auto-capacidade",
          jogador: obterNomeJogadorAssistenteIA(coluna),
          cartas: nomesCartas,
          limite: cartasPorJogador[coluna],
        });
      }
    }

    return houveMudanca;
  } finally {
    executandoDeducaoCapacidadeAssistenteIA = false;
  }
}

// ============================================================================
// IA-014: EXCLUSOES FORTES (coluna-saturada + linha-unica)
// ============================================================================
// Duas regras de exclusao defensivas:
//
// 1. coluna-saturada: se uma coluna ja tem N V's (limite da mao), todas as
//    celulas abertas dessa coluna viram X. Outros jogadores nao podem ter
//    cartas adicionais para esse jogador.
//
// 2. linha-unica: se uma secao (Suspeitos/Armas/Locais) ja tem a oculta
//    direta identificada, as DEMAIS linhas dessa secao TEM dono (regra do
//    Detetive: 1 oculta por secao). Se uma dessas demais linhas, sem V
//    ainda, tem candidatos restritos a 1 unica coluna -> essa celula vira V.

let executandoExclusoesFortesAssistenteIA = false;

function deduzirExclusoesFortesAssistenteIA() {
  if (executandoExclusoesFortesAssistenteIA) return false;
  if (!Array.isArray(cartas) || cartas.length === 0) return false;

  const cartasPorJogador = obterCartasPorJogadorAssistenteIA();
  if (!Array.isArray(cartasPorJogador) || cartasPorJogador.length === 0) {
    return false;
  }

  executandoExclusoesFortesAssistenteIA = true;

  try {
    let houveMudancaTotal = false;
    // IA-022: em modo manual, so 1 passada
    const maxTentativas = ehAutomarcacaoAtivaAssistenteIA() ? 5 : 1;

    for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
      const estado = obterEstadoTabelaAssistenteIA();
      const jogadores = obterNumeroJogadoresAssistenteIA();
      const acoes = [];

      // ===== Regra 1: coluna-saturada =====
      for (let col = 0; col < jogadores; col++) {
        let confirmadas = 0;
        const abertas = [];
        for (let row = 0; row < cartas.length; row++) {
          const v = estado[`${row}-${col}`] || "";
          if (v === "V") confirmadas++;
          else if (v !== "X") abertas.push({ row, col });
        }
        if (confirmadas >= cartasPorJogador[col] && abertas.length > 0) {
          abertas.forEach((a) => {
            acoes.push({
              row: a.row,
              col: a.col,
              chave: `${a.row}-${a.col}`,
              marca: "X",
              motivo: "coluna-saturada",
            });
          });
        }
      }

      // ===== Regra 2: linha-unica =====
      // Identifica ocultas diretas por secao
      const ocultaPorTipo = {};
      const linhasPorTipo = {};
      for (let row = 0; row < cartas.length; row++) {
        const tipo = cartas[row].tipo;
        let vCount = 0;
        let xCount = 0;
        for (let col = 0; col < jogadores; col++) {
          const v = estado[`${row}-${col}`] || "";
          if (v === "V") vCount++;
          else if (v === "X") xCount++;
        }
        if (!linhasPorTipo[tipo]) linhasPorTipo[tipo] = [];
        linhasPorTipo[tipo].push({ row, vCount, xCount });
        if (xCount === jogadores) {
          // linha-toda-x -> oculta direta
          ocultaPorTipo[tipo] = row;
        }
      }
      // Se uma secao tem exatamente 1 linha sem V e sem oculta-toda-x,
      // essa linha e a oculta (ultima-sem-v).
      for (const tipo of Object.keys(linhasPorTipo)) {
        if (ocultaPorTipo[tipo] != null) continue;
        const semV = linhasPorTipo[tipo].filter((l) => l.vCount === 0);
        if (semV.length === 1) {
          ocultaPorTipo[tipo] = semV[0].row;
        }
      }
      // Para linhas que NAO sao ocultas (mas ainda sem V) e tem 1 candidato unico -> V
      for (const tipo of Object.keys(linhasPorTipo)) {
        if (ocultaPorTipo[tipo] == null) continue;
        for (const info of linhasPorTipo[tipo]) {
          if (info.row === ocultaPorTipo[tipo]) continue;
          if (info.vCount > 0) continue;
          const candidatos = [];
          for (let col = 0; col < jogadores; col++) {
            const v = estado[`${info.row}-${col}`] || "";
            if (v !== "X") candidatos.push(col);
          }
          if (candidatos.length === 1) {
            const col = candidatos[0];
            acoes.push({
              row: info.row,
              col,
              chave: `${info.row}-${col}`,
              marca: "V",
              motivo: "linha-unica",
            });
          }
        }
      }

      // Aplica acoes (dedupe por chave+marca)
      if (acoes.length === 0) break;

      const unicas = new Map();
      acoes.forEach((a) => {
        const k = `${a.chave}:${a.marca}`;
        if (!unicas.has(k)) unicas.set(k, a);
      });

      let mudouNoCiclo = false;
      unicas.forEach((acao) => {
        const valorAtual = estado[acao.chave] || "";
        if (valorAtual === acao.marca) return;
        const aplicada = aplicarOuAdiarMarcacaoAssistenteIA(acao);
        if (aplicada) {
          mudouNoCiclo = true;
          houveMudancaTotal = true;
        }
      });

      if (!mudouNoCiclo) break;
    }

    return houveMudancaTotal;
  } finally {
    executandoExclusoesFortesAssistenteIA = false;
  }
}

// ============================================================================
// TRINCA DE ? : deduzirCartasPorGrupoRespostaAssistenteIA (motivo: grupo-resposta-unico)
// ============================================================================
// Para cada grupo persistido em assistenteGruposResposta:
//   - se o grupo nao tem V em nenhuma de suas 3 cartas
//   - e exatamente 1 das 3 cartas tem candidato nao-X (as outras 2 viraram X)
//   -> essa carta vira V para a coluna do grupo
// Motivo: "grupo-resposta-unico" (camada estrutural-forte, prioridade 90 do spec)

let executandoDeducaoGrupoRespostaAssistenteIA = false;

function deduzirCartasPorGrupoRespostaAssistenteIA() {
  if (executandoDeducaoGrupoRespostaAssistenteIA) return false;
  if (!Array.isArray(cartas) || cartas.length === 0) return false;

  const grupos =
    typeof obterGruposResposta === "function" ? obterGruposResposta() : [];
  if (grupos.length === 0) return false;

  executandoDeducaoGrupoRespostaAssistenteIA = true;

  try {
    let houveMudancaTotal = false;
    // Em modo manual nao precisa loop interno (cada passada gera mesmas pendencias)
    const maxTentativas = ehAutomarcacaoAtivaAssistenteIA() ? 5 : 1;

    for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
      const estado = obterEstadoTabelaAssistenteIA();
      const acoes = [];

      for (const g of grupos) {
        if (!Array.isArray(g.rows) || g.rows.length === 0) continue;
        const col = g.coluna;

        // Se alguma das cartas do grupo ja tem V (na coluna do grupo OU em outra),
        // o grupo esta resolvido logicamente.
        let grupoResolvido = false;
        for (const row of g.rows) {
          const chaveCol = `${row}-${col}`;
          if (estado[chaveCol] === "V") {
            grupoResolvido = true;
            break;
          }
        }
        if (grupoResolvido) continue;

        // Conta candidatos validos (nao X, nao V) dentro do grupo
        const candidatos = [];
        for (const row of g.rows) {
          const chave = `${row}-${col}`;
          const v = estado[chave] || "";
          if (v !== "X" && v !== "V") candidatos.push({ row, chave });
        }

        // Se sobrou exatamente 1 candidato -> ele DEVE ser V
        if (candidatos.length === 1) {
          acoes.push({
            row: candidatos[0].row,
            col,
            chave: candidatos[0].chave,
            marca: "V",
            motivo: "grupo-resposta-unico",
          });
        }
      }

      if (acoes.length === 0) break;

      let mudouNoCiclo = false;
      const unicas = new Map();
      acoes.forEach((a) => {
        const k = `${a.chave}:${a.marca}`;
        if (!unicas.has(k)) unicas.set(k, a);
      });
      unicas.forEach((acao) => {
        const aplicada = aplicarOuAdiarMarcacaoAssistenteIA(acao);
        if (aplicada) {
          mudouNoCiclo = true;
          houveMudancaTotal = true;
        }
      });

      if (!mudouNoCiclo) break;
    }

    return houveMudancaTotal;
  } finally {
    executandoDeducaoGrupoRespostaAssistenteIA = false;
  }
}

// ============================================================================
// IA-015: CRUZAMENTOS FORTES (dupla-trio)
// ============================================================================
// Encontra subconjuntos de 2 ou 3 colunas onde o numero de linhas
// "confinadas" (cujos candidatos estao todos dentro do subconjunto)
// iguala o numero total de vagas restantes nessas colunas.
//
// Quando isso ocorre, essas linhas vao ocupar TODAS as vagas do subconjunto -
// outras linhas que ainda tem candidatos dentro do subconjunto NAO PODEM
// usar essas vagas, entao suas celulas nessas colunas viram X.
//
// E o equivalente em logica do Detetive ao "naked pair/triple" do Sudoku.

let executandoCruzamentosFortesAssistenteIA = false;

function gerarSubconjuntosColunasAssistenteIA(n, tamanho) {
  const resultado = [];
  function recursivo(inicio, atual) {
    if (atual.length === tamanho) {
      resultado.push(atual.slice());
      return;
    }
    for (let i = inicio; i <= n - (tamanho - atual.length); i++) {
      atual.push(i);
      recursivo(i + 1, atual);
      atual.pop();
    }
  }
  recursivo(0, []);
  return resultado;
}

function deduzirCruzamentosFortesAssistenteIA() {
  if (executandoCruzamentosFortesAssistenteIA) return false;
  if (!Array.isArray(cartas) || cartas.length === 0) return false;

  const cartasPorJogador = obterCartasPorJogadorAssistenteIA();
  if (!Array.isArray(cartasPorJogador) || cartasPorJogador.length === 0) {
    return false;
  }

  executandoCruzamentosFortesAssistenteIA = true;

  try {
    const estado = obterEstadoTabelaAssistenteIA();
    const jogadores = obterNumeroJogadoresAssistenteIA();

    // Pre-computa para cada linha: candidatos (cols nao-X), e se ja tem V
    const linhaInfo = [];
    for (let row = 0; row < cartas.length; row++) {
      let temV = false;
      const candidatos = [];
      for (let col = 0; col < jogadores; col++) {
        const v = estado[`${row}-${col}`] || "";
        if (v === "V") temV = true;
        if (v !== "X") candidatos.push(col);
      }
      linhaInfo.push({ row, temV, candidatos });
    }

    // Pre-computa vagas por coluna
    const vagas = [];
    for (let col = 0; col < jogadores; col++) {
      let confirmadas = 0;
      for (let row = 0; row < cartas.length; row++) {
        if ((estado[`${row}-${col}`] || "") === "V") confirmadas++;
      }
      vagas.push(Math.max(0, cartasPorJogador[col] - confirmadas));
    }

    const acoes = [];

    for (const tamanho of [2, 3]) {
      if (jogadores < tamanho) continue;
      const subconjuntos = gerarSubconjuntosColunasAssistenteIA(jogadores, tamanho);

      for (const S of subconjuntos) {
        const setS = new Set(S);
        const vagasS = S.reduce((soma, c) => soma + vagas[c], 0);
        if (vagasS === 0) continue;

        // Linhas confinadas: sem V e candidatos subseteq S, com pelo menos 1 candidato em S
        const confinadas = [];
        for (const info of linhaInfo) {
          if (info.temV) continue;
          if (info.candidatos.length === 0) continue;
          const todosEmS = info.candidatos.every((c) => setS.has(c));
          if (todosEmS) confinadas.push(info);
        }

        if (confinadas.length !== vagasS) continue;
        if (confinadas.length === 0) continue;

        // Outras linhas (nao confinadas, sem V) que tem candidatos em S -> X nessas celulas
        const rowsConfinadas = new Set(confinadas.map((c) => c.row));
        for (const info of linhaInfo) {
          if (info.temV) continue;
          if (rowsConfinadas.has(info.row)) continue;
          for (const col of info.candidatos) {
            if (!setS.has(col)) continue;
            const chave = `${info.row}-${col}`;
            if ((estado[chave] || "") === "X") continue;
            acoes.push({
              row: info.row,
              col,
              chave,
              marca: "X",
              motivo: "dupla-trio",
            });
          }
        }
      }
    }

    if (acoes.length === 0) return false;

    // Dedupe e aplica
    const unicas = new Map();
    acoes.forEach((a) => {
      const k = `${a.chave}:${a.marca}`;
      if (!unicas.has(k)) unicas.set(k, a);
    });

    let houveMudanca = false;
    unicas.forEach((acao) => {
      const valorAtual = estado[acao.chave] || "";
      if (valorAtual === acao.marca) return;
      const aplicada = aplicarOuAdiarMarcacaoAssistenteIA(acao);
      if (aplicada) houveMudanca = true;
    });

    return houveMudanca;
  } finally {
    executandoCruzamentosFortesAssistenteIA = false;
  }
}

// ============================================================================
// ORQUESTRADOR DE DEDUCOES
// ============================================================================
// Roda as 3 funcoes de deducao em loop ate estabilizar (sem mudancas em
// um ciclo). Cada funcao pode habilitar a outra: ex. capacidade-coluna
// pode tornar uma coluna saturada, ativando exclusoes-fortes, que por sua
// vez pode confinar linhas e ativar dupla-trio.

function executarTodasDeducoesAssistenteIA() {
  // IA-022: limpa pendencias antes de cada rodada
  resetarPendenciasMarcacaoAssistenteIA();

  // Modo manual: roda cada deducao apenas 1 vez (sem aplicar, estado nao
  // muda - loop nao agregaria nada). Pendencias sao coletadas.
  if (!ehAutomarcacaoAtivaAssistenteIA()) {
    deduzirCartasPorCapacidadeAssistenteIA();
    deduzirExclusoesFortesAssistenteIA();
    deduzirCruzamentosFortesAssistenteIA();
    deduzirCartasPorGrupoRespostaAssistenteIA();
    return false;
  }

  // Modo automatico: loop ate estabilizar (cascata permitida)
  let houveMudancaTotal = false;
  const MAX_CICLOS = 8;
  for (let ciclo = 0; ciclo < MAX_CICLOS; ciclo++) {
    const a = deduzirCartasPorCapacidadeAssistenteIA();
    const b = deduzirExclusoesFortesAssistenteIA();
    const c = deduzirCruzamentosFortesAssistenteIA();
    const d = deduzirCartasPorGrupoRespostaAssistenteIA();
    if (!a && !b && !c && !d) break;
    houveMudancaTotal = true;
  }
  return houveMudancaTotal;
}

function obterMelhorLinhaPorTipoAssistenteIA(tipo, resumo) {
  const ocultaDireta = resumo.ocultas.find((linha) => linha.tipo === tipo);
  if (ocultaDireta) return ocultaDireta;

  return resumo.candidatosOcultos.find((linha) => linha.tipo === tipo) || null;
}

function calcularConfiancaAssistenteIA(escolhas) {
  const totalScore = escolhas.reduce((soma, item) => soma + (item?.score || 0), 0);
  const todasPresentes = escolhas.every(Boolean);

  if (!todasPresentes) {
    return {
      nivel: "Baixa",
      detalhes: [
        "Ainda faltam dados em pelo menos uma das secoes.",
        "Vale registrar mais X e V antes de confiar em uma sugest\u00e3o forte.",
      ],
    };
  }

  if (totalScore >= 220) {
    return {
      nivel: "Alta",
      detalhes: [
        "A sugest\u00e3o combina v\u00e1rias exclus\u00f5es fortes.",
        "H\u00e1 sinais consistentes de carta oculta ou dono muito restrito.",
      ],
    };
  }

  if (totalScore >= 120) {
    return {
      nivel: "Media",
      detalhes: [
        "A linha principal est\u00e1 bem encaminhada, mas ainda h\u00e1 concorrentes.",
        "Uma rodada boa pode confirmar a leitura atual.",
      ],
    };
  }

  return {
    nivel: "Baixa",
    detalhes: [
        "A recomenda\u00e7\u00e3o atual serve mais para explorar do que para fechar conclus\u00f5es.",
        "O melhor ganho agora \u00e9 eliminar combina\u00e7\u00f5es.",
    ],
  };
}

function formatarListaAssistenteIA(itens) {
  if (!Array.isArray(itens) || itens.length === 0) {
    return "<p>Nenhuma an\u00e1lise dispon\u00edvel.</p>";
  }

  return `
    <ul class="ia-lista">
      ${itens.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;
}

function garantirEstruturaAssistenteIA() {
  const secao = getEl("assistenteIAMenu");
  if (!secao) return null;

  const cards = secao.querySelectorAll(".ia-menu-card");
  if (cards.length < 3) return null;

  // IA-017: agora suportamos 4 cards (resumo, sugestao, confianca,
  // inconsistencias). 3 cards continua sendo aceito como fallback - so
  // o 4o slot fica null. Cards extras alem do 4o sao ignorados.
  const ids = [
    "iaResumoMudancas",
    "iaProximaSugestao",
    "iaConfiancaAssistente",
    "iaInconsistenciasAssistente",
  ];

  cards.forEach((card, index) => {
    if (index >= ids.length) return;
    let conteudo = card.querySelector(".ia-conteudo-lista");
    if (!conteudo) {
      const p = card.querySelector("p");
      conteudo = document.createElement("div");
      conteudo.className = "ia-conteudo-lista";
      conteudo.id = ids[index];
      if (p) {
        conteudo.innerHTML = `<p>${p.textContent}</p>`;
        p.remove();
      }
      card.appendChild(conteudo);
    } else if (!conteudo.id) {
      conteudo.id = ids[index];
    }
  });

  return {
    resumo: getEl("iaResumoMudancas"),
    sugestao: getEl("iaProximaSugestao"),
    confianca: getEl("iaConfiancaAssistente"),
    inconsistencias: getEl("iaInconsistenciasAssistente"),
  };
}

function registrarMudancaAssistenteIA(payload) {
  localStorage.setItem(
    "assistenteIAUltimaMudanca",
    JSON.stringify({
      ...payload,
      timestamp: Date.now(),
    }),
  );
}

function obterResumoMudancaAssistenteIA() {
  try {
    return JSON.parse(localStorage.getItem("assistenteIAUltimaMudanca") || "null");
  } catch {
    return null;
  }
}

function construirMudancasAssistenteIA(linhas, resumo) {
  const ultima = obterResumoMudancaAssistenteIA();
  const itens = [];

  // IA-005: branch "trinca-x" mantida dormente (sem produtor atual).
  // Detector de trinca-de-X esta no spec (secao 19 do BACKLOG_IA.md, item
  // P11+). Quando for restaurado, ele emite payload { tipo: "trinca-x", ... }
  // e esta branch passa a narrar automaticamente.
  if (ultima?.tipo === "trinca-x" && Array.isArray(ultima.cartas) && ultima.cartas.length) {
    itens.push(`Trinca eliminada para ${ultima.jogador}: ${ultima.cartas.join(", ")}.`);
  } else if (ultima?.tipo === "V" && ultima.carta && ultima.jogador) {
    itens.push(`${ultima.jogador} foi confirmado com ${ultima.carta}.`);
  } else if (ultima?.tipo === "X" && ultima.carta && ultima.jogador) {
    itens.push(`${ultima.jogador} foi descartado para ${ultima.carta}.`);
  } else if (ultima?.tipo === "?" && ultima.carta && ultima.jogador) {
    itens.push(`${ultima.carta} segue em aberto para ${ultima.jogador}.`);
  } else if (ultima?.tipo === "auto-capacidade" && ultima.jogador && Array.isArray(ultima.cartas)) {
    const prefixo =
      ultima.cartas.length === 1
        ? `${ultima.jogador} fechou a propria mao e confirmou ${ultima.cartas[0]}.`
        : `${ultima.jogador} fechou a propria mao e confirmou: ${ultima.cartas.join(", ")}.`;
    itens.push(prefixo);
  }

  const encontradas = linhas.filter((linha) => linha.isFound).length;
    itens.push(`${encontradas} cartas j\u00e1 t\u00eam dono confirmado.`);

  const ocultasFortes = resumo.ocultas.slice(0, 2);
  ocultasFortes.forEach((linha) => {
    if (linha.motivo === "linha-toda-x") {
      itens.push(`${linha.nome} parece oculta porque a linha inteira ficou em X.`);
    } else if (linha.motivo === "ultima-sem-v") {
      itens.push(`${linha.nome} ficou como \u00fanica carta sem V na se\u00e7\u00e3o de ${linha.tipo}.`);
    }
  });

  return itens.slice(0, 3);
}

// ============================================================================
// IA-027: helper - verifica se uma escolha veio de oculta-direta
// ============================================================================
function ehOcultaDiretaAssistenteIA(linha) {
  if (!linha || !linha.motivo) return false;
  return linha.motivo === "linha-toda-x" || linha.motivo === "ultima-sem-v";
}

// ============================================================================
// IA-025: helper - teste prioritario (carta com mais X = mais perto de fechar)
// ============================================================================
function obterTestePrioritarioAssistenteIA(escolhas) {
  let melhor = null;
  for (const e of escolhas) {
    if (!e) continue;
    if (e.isFound) continue;
    if (!melhor || (e.xCount || 0) > (melhor.xCount || 0)) melhor = e;
  }
  return melhor && melhor.xCount > 0 ? melhor : null;
}

// ============================================================================
// IA-026: sugestao exploratoria quando nao ha tripla forte ainda
// ============================================================================
// Quando o motor nao tem dados suficientes para uma sugestao com score alto,
// gera uma combinacao que MAXIMIZA INFORMACAO: pega a carta de cada tipo com
// mais candidatos abertos (= mais incerta = pergunta tende a comprimir o
// espaco de hipoteses melhor).
function obterSugestaoExploratoriaAssistenteIA(linhas) {
  const porTipo = { Suspeitos: [], Armas: [], Locais: [] };
  for (const linha of linhas) {
    if (linha.isFound) continue;
    if (porTipo[linha.tipo]) porTipo[linha.tipo].push(linha);
  }

  function pegarMaisAmbigua(grupo) {
    if (!grupo || grupo.length === 0) return null;
    return grupo
      .slice()
      .sort((a, b) => (b.candidatos.length || 0) - (a.candidatos.length || 0))[0];
  }

  const sus = pegarMaisAmbigua(porTipo.Suspeitos);
  const arm = pegarMaisAmbigua(porTipo.Armas);
  const loc = pegarMaisAmbigua(porTipo.Locais);

  if (!sus || !arm || !loc) return null;
  return { suspeito: sus, arma: arm, local: loc };
}

function construirSugestaoAssistenteIA(resumo, linhas) {
  const suspeito = obterMelhorLinhaPorTipoAssistenteIA("Suspeitos", resumo);
  const arma = obterMelhorLinhaPorTipoAssistenteIA("Armas", resumo);
  const local = obterMelhorLinhaPorTipoAssistenteIA("Locais", resumo);
  const escolhas = [suspeito, arma, local];

  // IA-025: le o nivel de explicacao configurado
  const cfg = obterConfiguracaoAssistenteIA();
  const explicativo = cfg.nivelExplicacao === "explicativa";

  // IA-027: ACUSACAO FINAL - se todos os 3 tipos tem oculta-direta identificada,
  // o crime esta solucionado.
  if (
    ehOcultaDiretaAssistenteIA(suspeito) &&
    ehOcultaDiretaAssistenteIA(arma) &&
    ehOcultaDiretaAssistenteIA(local)
  ) {
    const itens = [
      `Crime solucionado! Acuse com: ${suspeito.nome} + ${arma.nome} + ${local.nome}.`,
    ];
    if (explicativo) {
      itens.push(
        "As 3 cartas foram identificadas como ocultas (uma por se\u00e7\u00e3o). Pode fechar a partida.",
      );
    }
    return { itens, escolhas };
  }

  const scoreTotal = escolhas.reduce((soma, item) => soma + (item?.score || 0), 0);

  // IA-026: sem tripla forte -> sugestao exploratoria
  if (!(suspeito && arma && local && scoreTotal >= 18)) {
    const exploratoria = obterSugestaoExploratoriaAssistenteIA(linhas);
    if (exploratoria) {
      const itens = [
        explicativo
          ? `Sem certezas fortes ainda. Para abrir o jogo, sugiro: ${exploratoria.suspeito.nome} + ${exploratoria.arma.nome} + ${exploratoria.local.nome}.`
          : `Sugest\u00e3o explorat\u00f3ria: ${exploratoria.suspeito.nome} + ${exploratoria.arma.nome} + ${exploratoria.local.nome}.`,
      ];
      if (explicativo) {
        itens.push(
          "Foco em cartas com mais candidatos abertos \u2014 pergunta tende a eliminar mais hip\u00f3teses.",
        );
      }
      return {
        itens,
        escolhas: [exploratoria.suspeito, exploratoria.arma, exploratoria.local],
      };
    }
    return {
      itens: ["Ainda n\u00e3o h\u00e1 dados suficientes para montar uma combina\u00e7\u00e3o forte completa."],
      escolhas,
    };
  }

  // Tripla forte - modo objetivo ou explicativo
  const itens = [];
  itens.push(
    explicativo
      ? `Pergunta sugerida: ${suspeito.nome} + ${arma.nome} + ${local.nome}.`
      : `Sugest\u00e3o: ${suspeito.nome} + ${arma.nome} + ${local.nome}.`,
  );

  // IA-025: complementos so no modo explicativo
  if (explicativo) {
    if (local) {
      const pesoLocal = calcularPesoOcultacaoLocal(local, linhas);
      if (pesoLocal > 0) {
        itens.push(
          `${local.nome} ganhou prioridade porque locais costumam ser escondidos quando o jogador tamb\u00e9m pode mostrar outra carta.`,
        );
      }
    }

    const teste = obterTestePrioritarioAssistenteIA(escolhas);
    if (teste) {
      const verbo = teste.xCount === 1 ? "descartou" : "descartaram";
      const sufixo = teste.xCount === 1 ? "jogador" : "jogadores";
      itens.push(
        `Teste priorit\u00e1rio: ${teste.nome} (${teste.xCount} ${sufixo} j\u00e1 ${verbo} \u2014 confirmar fecha mais hip\u00f3teses).`,
      );
    }

    const linhaPressao = resumo.candidatosOcultos.find(
      (linha) => linha.candidatos.length > 1 && !linha.isFound,
    );
    if (linhaPressao) {
      const nomes = linhaPressao.candidatos
        .slice(0, 3)
        .map((item) => obterNomeJogadorAssistenteIA(item.col))
        .join(", ");
      itens.push(`Carta sob press\u00e3o: ${linhaPressao.nome}. Candidatos atuais: ${nomes}.`);
    }
  }

  return {
    itens: itens.slice(0, 4),
    escolhas,
  };
}

function construirDicasCapacidadeAssistenteIA(linhas) {
  const cartasPorJogador = obterCartasPorJogadorAssistenteIA();
  const jogadores = obterNumeroJogadoresAssistenteIA();

  if (!Array.isArray(cartasPorJogador) || cartasPorJogador.length !== jogadores) {
    return [];
  }

  const dicas = [];

  for (let col = 0; col < jogadores; col++) {
    const limite = cartasPorJogador[col];
    let confirmadas = 0;
    let possiveis = 0;

    linhas.forEach((linha) => {
      const valor = linha.estados[col];
      if (valor === "V") confirmadas++;
      if (valor !== "X") possiveis++;
    });

    const faltam = limite - confirmadas;
    const jogador = obterNomeJogadorAssistenteIA(col);

    if (faltam <= 0) {
      dicas.push(`${jogador} ja fechou a mao com ${limite} carta(s) confirmada(s).`);
      continue;
    }

    if (possiveis === faltam) {
      dicas.push(
        `${jogador} precisa de ${faltam} carta(s) e restam exatamente ${faltam} posicao(oes) possiveis na coluna.`,
      );
      continue;
    }

    if (faltam <= 2 || possiveis - faltam <= 2) {
      dicas.push(
        `${jogador} tem ${confirmadas}/${limite} carta(s) confirmada(s) e ainda precisa de ${faltam}.`,
      );
    }
  }

  return dicas.slice(0, 2);
}

// IA-004: coalesce multiplas chamadas dentro do mesmo frame de pintura.
// Sem isso, uma unica interacao do usuario dispara atualizarAssistenteIA
// 3+ vezes em sequencia (tabela.js linhas ~299, 414, 709).
let agendamentoAssistenteIA = null;

function agendarAtualizacaoAssistenteIA() {
  if (agendamentoAssistenteIA !== null) return;
  agendamentoAssistenteIA = requestAnimationFrame(() => {
    agendamentoAssistenteIA = null;
    try {
      atualizarAssistenteIA();
    } catch (erro) {
      console.error("Erro ao executar atualizarAssistenteIA agendada.", erro);
    }
  });
}

// ============================================================================
// IA-016: CLASSIFICADOR DE INCONSISTENCIAS
// ============================================================================
// Detecta erros logicos na marcacao atual. Retorna { graves, leves }.
// Cada item carrega { codigo, nivel, mensagem, foco } - foco e opcional
// e e usado pelo IA-019 para destaque visual clicavel na tabela.
//
// 6 inconsistencias graves implementadas. 1 leve (grupo-impossivel) pula
// porque depende de assistenteGruposResposta (P7/IA-024).

function classificarInconsistenciasAssistenteIA(linhas) {
  if (!Array.isArray(linhas) || linhas.length === 0) return { graves: [], leves: [] };

  const snapshot = obterSnapshotAssistenteIA();
  const nomes = snapshot.nomesJogadores;
  const cartasPorJogador = snapshot.cartasPorJogador;
  const jogadores = snapshot.numJogadores;
  const gruposResposta = snapshot.gruposResposta || [];

  const graves = [];
  const leves = [];

  // 1. linha-v-duplicado: linha com 2+ V
  linhas.forEach((linha) => {
    if (linha.vCount >= 2) {
      const cols = linha.estados
        .map((v, c) => (v === "V" ? c : -1))
        .filter((c) => c >= 0);
      graves.push({
        codigo: "linha-v-duplicado",
        nivel: "grave",
        mensagem: `"${linha.nome}" tem ${linha.vCount} marcacoes V (cada carta tem 1 dono unico).`,
        foco: { tipo: "celulas", chaves: cols.map((c) => `${linha.row}-${c}`) },
      });
    }
  });

  // Agrupa por tipo para regras de secao
  const porTipo = {};
  linhas.forEach((linha) => {
    if (!porTipo[linha.tipo]) porTipo[linha.tipo] = [];
    porTipo[linha.tipo].push(linha);
  });

  // 2. oculta-duplicada: mais de uma linha-toda-X na mesma secao
  for (const tipo of Object.keys(porTipo)) {
    const grupo = porTipo[tipo];
    const ocultasTodaX = grupo.filter((l) => l.isAllX);
    if (ocultasTodaX.length >= 2) {
      graves.push({
        codigo: "oculta-duplicada",
        nivel: "grave",
        mensagem: `Secao "${tipo}" tem ${ocultasTodaX.length} cartas marcadas com X em todas as colunas (so pode haver 1 oculta por secao).`,
        foco: { tipo: "linhas", rows: ocultasTodaX.map((l) => l.row) },
      });
    }
  }

  // 3. secao-toda-v: todas as linhas da secao tem ao menos 1 V
  for (const tipo of Object.keys(porTipo)) {
    const grupo = porTipo[tipo];
    if (grupo.every((l) => l.vCount > 0)) {
      graves.push({
        codigo: "secao-toda-v",
        nivel: "grave",
        mensagem: `Secao "${tipo}" tem V em todas as cartas (1 carta dessa secao deveria estar oculta).`,
        foco: { tipo: "linhas", rows: grupo.map((l) => l.row) },
      });
    }
  }

  // Regras de coluna dependem da distribuicao por jogador
  if (Array.isArray(cartasPorJogador) && cartasPorJogador.length === jogadores) {
    for (let col = 0; col < jogadores; col++) {
      const limite = cartasPorJogador[col];
      let vCount = 0;
      let xCount = 0;
      let abertas = 0;
      linhas.forEach((linha) => {
        const v = linha.estados[col];
        if (v === "V") vCount++;
        else if (v === "X") xCount++;
        else abertas++;
      });
      const nomeJog = nomes[col] || `J${col + 1}`;

      // 4. coluna-excesso: V > limite
      if (vCount > limite) {
        graves.push({
          codigo: "coluna-excesso",
          nivel: "grave",
          mensagem: `${nomeJog} tem ${vCount} V marcados mas a mao so permite ${limite}.`,
          foco: { tipo: "coluna", coluna: col },
        });
      }

      // 5. coluna-impossivel-aberta: faltam cartas mas abertas e menor que faltam
      const faltam = limite - vCount;
      if (faltam > 0 && abertas < faltam && vCount <= limite) {
        graves.push({
          codigo: "coluna-impossivel-aberta",
          nivel: "grave",
          mensagem: `${nomeJog} precisa de ${faltam} carta(s) mas so restam ${abertas} celula(s) aberta(s).`,
          foco: { tipo: "coluna", coluna: col },
        });
      }

      // 6. coluna-insuficiente: coluna fechada (sem abertas) com V < limite
      if (abertas === 0 && vCount < limite) {
        graves.push({
          codigo: "coluna-insuficiente",
          nivel: "grave",
          mensagem: `${nomeJog} esta com ${vCount} carta(s) confirmada(s) mas a mao precisa de ${limite}.`,
          foco: { tipo: "coluna", coluna: col },
        });
      }
    }
  }

  // 7. grupo-impossivel (LEVE): grupo de resposta ficou sem nenhuma opcao
  //    possivel (todas as cartas do grupo viraram X na coluna do grupo,
  //    ou nenhuma sobrou nao-V, sem haver V em outra das cartas)
  if (Array.isArray(gruposResposta) && gruposResposta.length > 0) {
    // Indexa estado por chave pra lookups rapidos
    const estadoLookup = {};
    linhas.forEach((linha) => {
      linha.estados.forEach((valor, col) => {
        estadoLookup[`${linha.row}-${col}`] = valor;
      });
    });
    for (const g of gruposResposta) {
      if (!Array.isArray(g.rows) || g.rows.length === 0) continue;
      const col = g.coluna;
      let temCandidato = false;
      let temVNoGrupo = false;
      for (const row of g.rows) {
        const v = estadoLookup[`${row}-${col}`] || "";
        if (v === "V") temVNoGrupo = true;
        if (v !== "X" && v !== "V") temCandidato = true;
      }
      // Inconsistente quando: nenhuma das cartas do grupo eh V para essa
      // coluna E todas viraram X (sem candidatos). Logica: jogador
      // mostrou uma das 3 - mas agora todas as 3 foram descartadas.
      if (!temVNoGrupo && !temCandidato) {
        const nomesCartas = g.rows
          .map((r) => (cartas[r] ? cartas[r].nome : `linha ${r}`))
          .join(", ");
        const nomeJog = nomes[col] || `J${col + 1}`;
        leves.push({
          codigo: "grupo-impossivel",
          nivel: "leve",
          mensagem: `Grupo de resposta de ${nomeJog} (${nomesCartas}) ficou sem opções possíveis - revise as marcações.`,
          foco: { tipo: "celulas", chaves: g.rows.map((r) => `${r}-${col}`) },
        });
      }
    }
  }

  return { graves, leves };
}

// ============================================================================
// IA-019: RENDERIZADOR DE LISTA DE INCONSISTENCIAS COM ITENS CLICAVEIS
// ============================================================================

function formatarInconsistenciasAssistenteIA(graves, leves) {
  const total = (graves?.length || 0) + (leves?.length || 0);
  if (total === 0) {
    // Mantem o mesmo padrao visual dos outros 3 cards (lista <ul class="ia-lista">)
    return formatarListaAssistenteIA([
      "Nenhuma inconsistencia detectada.",
      "Marcacoes estao logicamente consistentes.",
    ]);
  }

  const itens = [];
  (graves || []).forEach((inc) => {
    const focoJSON = inc.foco ? encodeURIComponent(JSON.stringify(inc.foco)) : "";
    if (inc.foco) {
      itens.push(
        `<li class="ia-inconsistencia ia-grave"><button type="button" class="ia-inconsistencia-btn" data-foco="${focoJSON}" onclick="aplicarFocoInconsistenciaAssistenteIA(decodeURIComponent(this.dataset.foco))">${inc.mensagem}</button></li>`,
      );
    } else {
      itens.push(`<li class="ia-inconsistencia ia-grave">${inc.mensagem}</li>`);
    }
  });
  (leves || []).forEach((inc) => {
    const focoJSON = inc.foco ? encodeURIComponent(JSON.stringify(inc.foco)) : "";
    if (inc.foco) {
      itens.push(
        `<li class="ia-inconsistencia ia-leve"><button type="button" class="ia-inconsistencia-btn" data-foco="${focoJSON}" onclick="aplicarFocoInconsistenciaAssistenteIA(decodeURIComponent(this.dataset.foco))">${inc.mensagem}</button></li>`,
      );
    } else {
      itens.push(`<li class="ia-inconsistencia ia-leve">${inc.mensagem}</li>`);
    }
  });
  return `<ul class="ia-lista-inconsistencias">${itens.join("")}</ul>`;
}

function atualizarAssistenteIA() {
  try {
    // Sem PRO -> menu inteiro fica oculto via atualizarStatusPRO; nao
    // precisamos renderizar nada.
    if (typeof isPRO === "function" && !isPRO()) return;
    if (!Array.isArray(cartas) || cartas.length === 0) return;

    const estrutura = garantirEstruturaAssistenteIA();
    if (!estrutura) return;

    // PRO ativo mas usuario desligou o assistente via popup: cards continuam
    // visiveis (pra o gear ficar acessivel) mas mostram estado "desativado".
    const cfgUsuario = obterConfiguracaoAssistenteIA();
    if (!cfgUsuario.ativo) {
      const msgDesativado = formatarListaAssistenteIA([
        "Assistente desativado.",
        "Reative no botão de configurações (engrenagem no topo).",
      ]);
      estrutura.resumo.innerHTML = msgDesativado;
      estrutura.sugestao.innerHTML = msgDesativado;
      estrutura.confianca.innerHTML = formatarListaAssistenteIA([
        "Nível atual: Desativado.",
        "Reative no botão de configurações para receber análises.",
      ]);
      if (estrutura.inconsistencias) {
        estrutura.inconsistencias.innerHTML = msgDesativado;
      }
      return;
    }

    const estado = obterEstadoTabelaAssistenteIA();
    const totalMarcacoes = Object.values(estado).filter(Boolean).length;

    if (totalMarcacoes === 0) {
      estrutura.resumo.innerHTML = formatarListaAssistenteIA([
        "Ainda n\u00e3o h\u00e1 leitura suficiente para resumir a rodada.",
        "Comece marcando V, X e ? para liberar an\u00e1lises reais.",
      ]);
      estrutura.sugestao.innerHTML = formatarListaAssistenteIA([
        "Registre as primeiras respostas da mesa para gerar uma sugestao valida.",
      ]);
      estrutura.confianca.innerHTML = formatarListaAssistenteIA([
        "Nivel atual: Inicial.",
        "Sem marca\u00e7\u00f5es, o assistente ainda n\u00e3o tem base para orientar.",
      ]);
      if (estrutura.inconsistencias) {
        estrutura.inconsistencias.innerHTML = formatarInconsistenciasAssistenteIA([], []);
      }
      return;
    }

    // Etapa 1: dedu\u00e7\u00e3o autom\u00e1tica - escreve em localStorage (marcarCelula).
    // NAO usa cache pois cada iteracao precisa releitura fresca apos writes.
    // Orquestrador roda 3 deducoes em loop ate estabilizar:
    //  - capacidade (IA-001)
    //  - exclusoes fortes: coluna-saturada + linha-unica (IA-014)
    //  - cruzamentos fortes: dupla-trio (IA-015)
    executarTodasDeducoesAssistenteIA();

    // Etapa 2: an\u00e1lise sobre estado FINAL - read-only, ideal para cache.
    // executarComCacheAssistenteIA garante consistencia: todas as funcoes
    // downstream (obterLinhasAssistenteIA, montarResumo, construirSugestao,
    // calcularConfianca, etc.) leem do MESMO snapshot.
    executarComCacheAssistenteIA(() => {
      const linhas = obterLinhasAssistenteIA();
      const resumo = montarResumoLinhasAssistenteIA(linhas);
      const mudancas = construirMudancasAssistenteIA(linhas, resumo);
      const sugestao = construirSugestaoAssistenteIA(resumo, linhas);
      const confianca = calcularConfiancaAssistenteIA(sugestao.escolhas);
      const dicasCapacidade = construirDicasCapacidadeAssistenteIA(linhas);

      // IA-016: classifica inconsistencias antes de renderizar cards
      const inc = classificarInconsistenciasAssistenteIA(linhas);
      const temGrave = inc.graves.length > 0;
      const temLeve = inc.leves.length > 0;

      // Card "O que mudou" - mantem normal
      estrutura.resumo.innerHTML = formatarListaAssistenteIA(mudancas);

      // Prioridade do override do card "Proxima sugestao":
      // 1. Inconsistencia grave -> "Corrija X" (IA-018)
      // 2. Pendencias do modo manual (IA-022) -> lista de instrucoes
      // 3. Sugestao normal
      const temPendencias = pendenciasMarcacaoAssistenteIA.length > 0;

      if (temGrave) {
        const qtd = inc.graves.length;
        const plural = qtd > 1 ? "inconsistencias graves" : "inconsistencia grave";
        estrutura.sugestao.innerHTML = formatarListaAssistenteIA([
          `Corrija ${qtd} ${plural} antes de continuar.`,
          "Veja os detalhes no card 'Inconsistencias' (clique em cada item para destacar na tabela).",
        ]);
      } else if (temPendencias) {
        estrutura.sugestao.innerHTML = formatarListaAssistenteIA(
          construirInstrucoesPendentesAssistenteIA(),
        );
      } else {
        estrutura.sugestao.innerHTML = formatarListaAssistenteIA(sugestao.itens);
      }

      // Override Confianca - hierarquia:
      // 1. Inconsistencia grave -> "Invalida"
      // 2. Inconsistencia leve -> "Cautela"
      // 3. Pendencias do modo manual -> rebaixa 1 nivel (Alta->Media,
      //    Media->Baixa, Baixa->Baixa)
      // 4. Nenhuma das anteriores -> nivel normal calculado
      let nivelFinal = confianca.nivel;
      let detalhesFinal = confianca.detalhes;
      if (temGrave) {
        nivelFinal = "Invalida";
        detalhesFinal = [
          "Marcacoes contem erros logicos - corrigir antes de confiar em sugestoes.",
        ];
      } else if (temLeve) {
        nivelFinal = "Cautela";
        detalhesFinal = [
          "Ha uma inconsistencia leve. A sugestao segue valida mas verifique.",
          ...confianca.detalhes,
        ];
      } else if (temPendencias) {
        const rebaixar = { Alta: "Media", Media: "Baixa", Baixa: "Baixa" };
        nivelFinal = rebaixar[confianca.nivel] || confianca.nivel;
        detalhesFinal = [
          `A IA detectou ${pendenciasMarcacaoAssistenteIA.length} marca${pendenciasMarcacaoAssistenteIA.length === 1 ? "cao pendente" : "coes pendentes"} - aplique manualmente para subir a confianca.`,
          ...confianca.detalhes,
        ];
      }
      estrutura.confianca.innerHTML = formatarListaAssistenteIA([
        `Nivel atual: ${nivelFinal}.`,
        ...detalhesFinal,
        ...(temGrave || temPendencias ? [] : dicasCapacidade),
      ]);

      // Card "Inconsistencias" (IA-017)
      if (estrutura.inconsistencias) {
        estrutura.inconsistencias.innerHTML = formatarInconsistenciasAssistenteIA(
          inc.graves,
          inc.leves,
        );
      }
    });
  } catch (erro) {
    console.error("Assistente IA falhou ao atualizar.", erro);
  }
}
