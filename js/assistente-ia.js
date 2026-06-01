// ============================================================================
// IA-020: CONFIGURACAO PERSISTIDA DO ASSISTENTE
// ============================================================================
// 3 eixos de comportamento independentes:
//   - ativo: bool        - desliga/liga toda a analise do motor
//   - automarcacao: bool - se true, IA marca V/X automaticamente; se false,
//                          gera apenas instrucoes manuais (pendencias)
//   - nivelExplicacao    - valores internos (labels UI):
//                          "objetiva"    (Resumido - so a sugestao)
//                          "explicativa" (Explicado - com o motivo)
//                          "detalhada"   (Detalhado - com raciocinio completo)
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
        parsed.nivelExplicacao === "objetiva" ||
        parsed.nivelExplicacao === "detalhada"
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
  if (
    novo.nivelExplicacao !== "objetiva" &&
    novo.nivelExplicacao !== "explicativa" &&
    novo.nivelExplicacao !== "detalhada"
  ) {
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

function executarComCacheAssistenteIA(callback, snapshotPreConstruido) {
  // IA-028: aceita snapshot pre-construido pra evitar 2x construirSnapshot
  // quando o caller ja precisou montar pra calcular hash de skip-render.
  cacheSnapshotAssistenteIA =
    snapshotPreConstruido || construirSnapshotAssistenteIA();
  try {
    return callback(cacheSnapshotAssistenteIA);
  } finally {
    cacheSnapshotAssistenteIA = null;
  }
}

// ============================================================================
// IA-028: hash deterministico do snapshot para skip de re-render
// ============================================================================
// Hashea apenas campos que afetam o RENDER dos 4 cards do assistente.
// Exclui: snap.timestamp (sempre muda). Inclui: estadoTabela, grupos, origens,
// configuracao, pendencias (memoria), ultima mudanca (localStorage).
//
// ultimoHashRenderAssistenteIA so eh atualizado APOS render real - assim,
// se o menu lateral esta fechado e pulamos o render, ao abrir o hash ainda
// reflete o ultimo render visivel e o snapshot atual (provavelmente mudou)
// vai disparar render.

let ultimoHashRenderAssistenteIA = null;

function hashSnapshotParaRenderAssistenteIA(snap) {
  if (!snap) return "";
  const cfg = snap.configuracao || {};

  const estadoOrdenado = Object.keys(snap.estadoTabela || {})
    .sort()
    .map((k) => `${k}:${snap.estadoTabela[k]}`)
    .join("|");

  const origensOrdenadas = Object.keys(snap.origensDuvida || {})
    .sort()
    .map((k) => `${k}:${JSON.stringify(snap.origensDuvida[k])}`)
    .join("|");

  // pendenciasMarcacaoAssistenteIA esta declarado mais abaixo no arquivo;
  // tipo-check garante no-throw mesmo se chamada cedo (raro - so via init).
  let pendStr = "";
  try {
    if (
      typeof pendenciasMarcacaoAssistenteIA !== "undefined" &&
      Array.isArray(pendenciasMarcacaoAssistenteIA)
    ) {
      pendStr = pendenciasMarcacaoAssistenteIA
        .map((p) => `${p.chave || ""}:${p.marca || ""}:${p.motivo || ""}`)
        .join(",");
    }
  } catch {}

  let ultimaMudStr = "";
  try {
    ultimaMudStr = localStorage.getItem("assistenteIAUltimaMudanca") || "";
  } catch {}

  return [
    snap.numJogadores,
    (snap.nomesJogadores || []).join("|"),
    (snap.cartasPorJogador || []).join(","),
    (snap.jogadoresMaisCartas || []).join(","),
    cfg.ativo,
    cfg.automarcacao,
    cfg.nivelExplicacao,
    JSON.stringify(snap.gruposResposta || []),
    estadoOrdenado,
    origensOrdenadas,
    pendStr,
    ultimaMudStr,
  ].join("##");
}

function resetarHashRenderAssistenteIA() {
  ultimoHashRenderAssistenteIA = null;
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
function editarGruposRespostaPorApagamento(chave, row, col, novoEstado) {
  // Logica diferenciada pelo novoEstado (intencao do usuario):
  //
  // - V: no-op. Grupo "resolvido" implicitamente - deducao filtra V e nao
  //   gera mais candidatos pro grupo. Manter o grupo permite que a
  //   inconsistencia 'grupo-impossivel' funcione se usuario depois
  //   sobrescrever V->X.
  //
  // - X: no-op. A carta foi descartada mas o grupo segue valido - deducao
  //   filtra X dos candidatos automaticamente. Outras cartas do grupo
  //   continuam podendo ser a resposta.
  //
  // - "" (vazio): usuario apagou manualmente um "?". Semantica: "errei em
  //   marcar essa carta". A row eh REMOVIDA do grupo - nao eh mais
  //   considerada candidata possivel. Se a remocao esvaziar o grupo,
  //   o grupo eh descartado.
  if (novoEstado !== "") return;

  const origens = obterOrigensDuvida();
  const origem = origens[chave];
  if (!origem || !Array.isArray(origem.grupos) || origem.grupos.length === 0) {
    return;
  }

  const grupos = obterGruposResposta();
  const colNum = parseInt(col, 10);
  const rowNum = parseInt(row, 10);
  const grupoIds = new Set(origem.grupos);
  let mudou = false;

  const novosGrupos = [];
  for (const g of grupos) {
    if (!grupoIds.has(g.id) || g.coluna !== colNum) {
      novosGrupos.push(g);
      continue;
    }
    const novasRows = g.rows.filter((r) => r !== rowNum);
    if (novasRows.length === 0) {
      // Grupo ficou vazio - descarta
      mudou = true;
      continue;
    }
    if (novasRows.length !== g.rows.length) {
      novosGrupos.push({ ...g, rows: novasRows });
      mudou = true;
    } else {
      novosGrupos.push(g);
    }
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

  // IA-043: nao gerar pendencia pra J1 (voce). Suas proprias cartas voce
  // sempre sabe - se a IA deduziu algo sobre suas cartas, voce ja sabia
  // a resposta. Nao polui a lista de pendencias com instrucoes inuteis.
  if (
    typeof acao.col === "number" &&
    ehJogadorUsuarioAssistenteIA(acao.col)
  ) {
    return false;
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
  capacidade: "jogador fecha a mão com essa carta",
  "coluna-saturada": "outras cartas dessa coluna já foram confirmadas",
  "linha-unica": "seção já tem a oculta — esta carta tem 1 candidato único",
  "dupla-trio": "outras linhas estão confinadas em outras colunas",
  "grupo-resposta-unico": "grupo de resposta só sobrou esta carta como opção",
  // IA-041: motivos vindos de montarResumoLinhasAssistenteIA - textos mais
  // diretos e sem jargao tecnico
  "ultima-sem-v": "única carta sem V em outras colunas",
  "linha-toda-x": "todos os jogadores já descartaram",
};

// IA-041: mapeia camada tecnica pra adjetivo legivel
const CAMADA_LEGIVEL_ASSISTENTE_IA = {
  soberana: "garantida",
  "estrutural-forte": "estrutural-forte",
  dedutiva: "dedutiva",
  heuristica: "heuristica",
};

function motivoLegivelAssistenteIA(motivo) {
  return MOTIVO_LEGIVEL_ASSISTENTE_IA[motivo] || motivo;
}

function camadaLegivelAssistenteIA(camada) {
  return CAMADA_LEGIVEL_ASSISTENTE_IA[camada] || camada;
}

// IA-041: descreve em portugues natural a JUSTIFICATIVA de uma escolha
// (sem rotulo nem nome - quem chama prefixa com "Tipo (Nome):"). Usado
// no card Raciocinio Detalhado. Mantem estrutura limpa: motivo + listas
// de descartados e em-aberto. Sem jargao de camada (info tecnica interna).
// J1 (voce) suprimido das listas.
function descreverEscolhaDetalhadaAssistenteIA(linha) {
  if (!linha) return null;

  const snapshot =
    typeof obterSnapshotAssistenteIA === "function"
      ? obterSnapshotAssistenteIA()
      : null;
  const nomes = (snapshot && snapshot.nomesJogadores) || [];

  // Motivo legivel - ou fallback baseado em stats quando nao ha motivo
  let motivoFrase;
  if (linha.motivo) {
    motivoFrase = motivoLegivelAssistenteIA(linha.motivo);
  } else if (linha.xCount > 0 || linha.maybeCount > 0) {
    const fragmentos = [];
    if (linha.xCount > 0) fragmentos.push(`${linha.xCount} descarte(s)`);
    if (linha.maybeCount > 0) fragmentos.push(`${linha.maybeCount} dúvida(s)`);
    motivoFrase = fragmentos.join(" e ");
  } else {
    motivoFrase = "ainda sem evidências fortes";
  }

  // Listas de jogadores envolvidos (sem J1 - voce)
  const descartados = [];
  const candidatos = [];
  (linha.estados || []).forEach((v, col) => {
    if (ehJogadorUsuarioAssistenteIA(col)) return;
    const nome = nomes[col] || `J${col + 1}`;
    if (v === "X") descartados.push(nome);
    else if (v !== "V") candidatos.push(nome);
  });

  // Monta: "motivo. Descartado por: X. Em aberto: Y."
  const partes = [`${motivoFrase}.`];

  // Carta ja deduzida como a do crime (oculta-direta): nao faz sentido
  // listar jogadores "em aberto" como se pudessem ter a carta - ela esta
  // no envelope. Conclui e, se houver celulas em branco, sugere marcar X.
  if (ehOcultaDiretaAssistenteIA(linha)) {
    partes.push("Está no envelope — ninguém tem essa carta.");
    if (candidatos.length > 0) {
      partes.push(`Pode marcar X para ${candidatos.join(", ")}.`);
    }
    return partes.join(" ");
  }

  if (descartados.length > 0) {
    partes.push(`Descartado por: ${descartados.join(", ")}.`);
  }
  if (candidatos.length > 0) {
    partes.push(`Em aberto: ${candidatos.join(", ")}.`);
  }

  return partes.join(" ");
}

function construirInstrucoesPendentesAssistenteIA() {
  if (pendenciasMarcacaoAssistenteIA.length === 0) return [];

  const cfg = obterConfiguracaoAssistenteIA();
  const explicativo = cfg.nivelExplicacao === "explicativa";
  const snapshot = obterSnapshotAssistenteIA();
  const itens = [];

  itens.push(
    `A IA detectou ${pendenciasMarcacaoAssistenteIA.length} marca${pendenciasMarcacaoAssistenteIA.length === 1 ? "ção" : "ções"} sugerida${pendenciasMarcacaoAssistenteIA.length === 1 ? "" : "s"} (marcação automática desligada):`,
  );

  // IA-043: filtra pendencias do J1 (voce) - voce ja sabe suas cartas,
  // nao tem o que marcar pra si mesmo via instrucao do assistente.
  const pendenciasFiltradas = pendenciasMarcacaoAssistenteIA.filter(
    (p) => !ehJogadorUsuarioAssistenteIA(p.col),
  );

  const LIMITE_LISTA = 4;
  const mostrar = Math.min(pendenciasFiltradas.length, LIMITE_LISTA);
  for (let i = 0; i < mostrar; i++) {
    const p = pendenciasFiltradas[i];
    const carta =
      Array.isArray(cartas) && cartas[p.row] ? cartas[p.row].nome : `linha ${p.row}`;
    const jogador = snapshot.nomesJogadores[p.col] || `J${p.col + 1}`;
    let texto = `Marque ${p.marca} em ${carta} para ${jogador}`;
    if (explicativo && p.motivo) {
      texto += ` (${motivoLegivelAssistenteIA(p.motivo)})`;
    }
    itens.push(texto + ".");
  }
  if (pendenciasFiltradas.length > LIMITE_LISTA) {
    const resto = pendenciasFiltradas.length - LIMITE_LISTA;
    itens.push(`+ ${resto} marca${resto === 1 ? "ção" : "ções"} adicional${resto === 1 ? "" : "is"}.`);
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
          col: coluna, // IA-043: usado pra suprimir narracao do J1
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

// Flag: pula a proxima rodada de deducoes da IA. Usado pelo undo pra
// evitar que a IA re-deduza imediatamente o que o usuario acabou de
// reverter (ex.: na trinca cenario B, o V eh uma conclusao logica
// derivada dos Xs ao redor - a IA conseguiria re-deduzir sozinha,
// "anulando" o efeito visual do undo). Pula UMA vez e auto-reseta.
let _pularProximaDeducaoIA = false;

function pularProximaDeducaoIA() {
  _pularProximaDeducaoIA = true;
}

function executarTodasDeducoesAssistenteIA() {
  // IA-022: limpa pendencias antes de cada rodada
  resetarPendenciasMarcacaoAssistenteIA();

  // Skip pos-undo: o usuario acabou de reverter algo, nao queremos que a
  // IA re-deduza o mesmo na mesma rodada. Limpa pendencias mas sai sem
  // executar deducoes. A proxima acao do usuario re-habilita normalmente.
  if (_pularProximaDeducaoIA) {
    _pularProximaDeducaoIA = false;
    return false;
  }

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
  // IA-041: agora 5 slots (resumo, sugestao, confianca, inconsistencias,
  // raciocinio detalhado). 3 cards continua sendo aceito como fallback.
  const ids = [
    "iaResumoMudancas",
    "iaProximaSugestao",
    "iaConfiancaAssistente",
    "iaInconsistenciasAssistente",
    "iaRaciocinioDetalhado",
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
    raciocinio: getEl("iaRaciocinioDetalhado"),
    raciocinioCard: getEl("iaCardRaciocinioDetalhado"),
  };
}

// IA-043: J1 (coluna 0) eh sempre o usuario do app. O assistente nao
// precisa avisar o usuario sobre coisas que ele ja sabe sobre si mesmo.
// Mensagens sobre estado/acoes do J1 sao suprimidas, exceto inconsistencias
// graves (onde o usuario pode ter errado a marcacao em si mesmo).
function ehJogadorUsuarioAssistenteIA(col) {
  return col === 0;
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

// Papel da carta no crime, por tipo. Usa "e" (presente) em vez de
// "foi descoberto/a" pra evitar flexao de genero (nao temos o genero
// das cartas: "a Faca" vs "o Castical").
function papelCrimeAssistenteIA(tipo) {
  if (tipo === "Suspeitos") return "o culpado";
  if (tipo === "Armas") return "a arma do crime";
  if (tipo === "Locais") return "o local do crime";
  return "parte do crime";
}

function construirMudancasAssistenteIA(linhas, resumo) {
  const ultima = obterResumoMudancaAssistenteIA();
  const itens = [];

  // IA-043: suprime narracao quando a mudanca eh sobre o J1 (voce) - voce
  // ja sabe o que aconteceu nas proprias marcacoes. Mantemos para J2+.
  const ultimaEhJ1 =
    ultima && typeof ultima.col === "number" &&
    ehJogadorUsuarioAssistenteIA(ultima.col);

  // IA-005: branch "trinca-x" mantida dormente (sem produtor atual).
  // Detector de trinca-de-X esta no spec (secao 19 do BACKLOG_IA.md, item
  // P11+). Quando for restaurado, ele emite payload { tipo: "trinca-x", ... }
  // e esta branch passa a narrar automaticamente.
  if (!ultimaEhJ1) {
    if (ultima?.tipo === "trinca-x" && Array.isArray(ultima.cartas) && ultima.cartas.length) {
      itens.push(`${ultima.jogador} n\u00e3o tem: ${ultima.cartas.join(", ")}.`);
    } else if (ultima?.tipo === "V" && ultima.carta && ultima.jogador) {
      itens.push(`${ultima.jogador} est\u00e1 com ${ultima.carta}.`);
    } else if (ultima?.tipo === "X" && ultima.carta && ultima.jogador) {
      itens.push(`${ultima.jogador} n\u00e3o tem ${ultima.carta}.`);
    } else if (ultima?.tipo === "?" && ultima.carta && ultima.jogador) {
      itens.push(`${ultima.jogador} pode estar com ${ultima.carta}.`);
    } else if (ultima?.tipo === "auto-capacidade" && ultima.jogador && Array.isArray(ultima.cartas)) {
      const prefixo =
        ultima.cartas.length === 1
          ? `${ultima.jogador} completou a m\u00e3o e est\u00e1 com ${ultima.cartas[0]}.`
          : `${ultima.jogador} completou a m\u00e3o e est\u00e1 com: ${ultima.cartas.join(", ")}.`;
      itens.push(prefixo);
    }
  }

  const encontradas = linhas.filter((linha) => linha.isFound).length;
    itens.push(`${encontradas} cartas j\u00e1 t\u00eam dono.`);

  // Nivel de explicacao controla quanto detalhe acompanha a deducao.
  const cfgMudancas =
    typeof obterConfiguracaoAssistenteIA === "function"
      ? obterConfiguracaoAssistenteIA()
      : { nivelExplicacao: "objetiva" };
  const detalhada = cfgMudancas.nivelExplicacao === "detalhada";
  const explicativa =
    cfgMudancas.nivelExplicacao === "explicativa" || detalhada;

  const ocultasFortes = resumo.ocultas.slice(0, 2);
  ocultasFortes.forEach((linha) => {
    const papel = papelCrimeAssistenteIA(linha.tipo);
    let frase = `${linha.nome} \u00e9 ${papel}.`;

    if (explicativa) {
      if (linha.motivo === "linha-toda-x") {
        frase += detalhada
          ? ` Todos os jogadores foram descartados (X) para essa carta, ent\u00e3o ela n\u00e3o est\u00e1 com ningu\u00e9m \u2014 est\u00e1 no envelope do crime.`
          : ` Ningu\u00e9m tem essa carta (linha toda em X).`;
      } else if (linha.motivo === "ultima-sem-v") {
        frase += detalhada
          ? ` Todas as outras cartas de ${linha.tipo} j\u00e1 t\u00eam dono confirmado (V). Por elimina\u00e7\u00e3o, ${linha.nome} \u00e9 a que sobrou para o envelope.`
          : ` \u00c9 a \u00fanica carta de ${linha.tipo} sem dono.`;
      }
    }

    itens.push(frase);
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
    // Pula cartas ja deduzidas como oculta-direta (a carta do crime).
    // Elas nao tem dono V (estao no envelope), mas ja sao CONHECIDAS -
    // sugerir "testa-las" contradiz a deducao "X e o culpado/arma/local"
    // mostrada no card "O que mudou".
    if (ehOcultaDiretaAssistenteIA(e)) continue;
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
  // IA-041: "detalhada" inclui tudo de "explicativa" + arvore de raciocinio
  const cfg = obterConfiguracaoAssistenteIA();
  const detalhado = cfg.nivelExplicacao === "detalhada";
  const explicativo = cfg.nivelExplicacao === "explicativa" || detalhado;

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
          ? `Ainda sem certezas fortes. Pra abrir o jogo, vale perguntar: ${exploratoria.suspeito.nome} + ${exploratoria.arma.nome} + ${exploratoria.local.nome}.`
          : `Sugest\u00e3o explorat\u00f3ria: ${exploratoria.suspeito.nome} + ${exploratoria.arma.nome} + ${exploratoria.local.nome}.`,
      ];
      if (explicativo) {
        itens.push(
          "Foco em cartas com mais incerteza \u2014 essa pergunta tende a eliminar mais hip\u00f3teses.",
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
          `Locais costumam ser escondidos quando o jogador tem outras cartas pra mostrar \u2014 ${local.nome} \u00e9 uma boa aposta.`,
        );
      }
    }

    const teste = obterTestePrioritarioAssistenteIA(escolhas);
    if (teste) {
      const xc = teste.xCount || 0;
      // Frase proporcional a forca da evidencia: com poucos X, nao
      // prometer que "fecha varias hipoteses" (seria exagero).
      let fraseTeste;
      if (xc <= 1) {
        fraseTeste = `${teste.nome} vale testar: ${xc} jogador j\u00e1 descartou, confirmar ajuda a estreitar as possibilidades.`;
      } else {
        fraseTeste = `${teste.nome} \u00e9 um bom teste: ${xc} jogadores j\u00e1 descartaram, ent\u00e3o confirmar essa carta fecha v\u00e1rias hip\u00f3teses de uma vez.`;
      }
      itens.push(fraseTeste);
    }

    const linhaPressao = resumo.candidatosOcultos.find(
      (linha) => linha.candidatos.length > 1 && !linha.isFound,
    );
    if (linhaPressao) {
      // IA-043: J1 (voce) nao eh candidato util - voce nao se pergunta
      const candidatosSemJ1 = linhaPressao.candidatos.filter(
        (item) => !ehJogadorUsuarioAssistenteIA(item.col),
      );
      if (candidatosSemJ1.length > 0) {
        const nomes = candidatosSemJ1
          .slice(0, 3)
          .map((item) => obterNomeJogadorAssistenteIA(item.col))
          .join(", ");
        itens.push(
          `${linhaPressao.nome} est\u00e1 pressionada \u2014 s\u00f3 ${nomes} ainda pode(m) ter essa carta.`,
        );
      }
    }
  }

  // IA-041: a arvore de raciocinio agora vai pro card "Raciocinio detalhado"
  // separado (montado em construirRaciocinioDetalhadoAssistenteIA). Aqui o
  // card Sugestao volta a ser enxuto (max 4 itens).

  return {
    itens: itens.slice(0, 4),
    escolhas,
  };
}

// IA-041: monta itens do card "Raciocinio detalhado". Formato:
// "Tipo (Nome): motivo. Descartado por: X. Em aberto: Y."
function construirRaciocinioDetalhadoAssistenteIA(escolhas) {
  const [suspeito, arma, local] = escolhas || [];
  const itens = [];

  const rotulados = [
    { rotulo: "Suspeito", linha: suspeito },
    { rotulo: "Arma", linha: arma },
    { rotulo: "Local", linha: local },
  ];

  rotulados.forEach((e) => {
    const desc = descreverEscolhaDetalhadaAssistenteIA(e.linha);
    if (desc && e.linha) {
      itens.push(`${e.rotulo} (${e.linha.nome}): ${desc}`);
    }
  });

  return itens;
}

function construirDicasCapacidadeAssistenteIA(linhas) {
  const cartasPorJogador = obterCartasPorJogadorAssistenteIA();
  const jogadores = obterNumeroJogadoresAssistenteIA();

  if (!Array.isArray(cartasPorJogador) || cartasPorJogador.length !== jogadores) {
    return [];
  }

  const dicas = [];

  for (let col = 0; col < jogadores; col++) {
    // IA-043: pula J1 (voce) - voce ja sabe quantas cartas tem
    if (ehJogadorUsuarioAssistenteIA(col)) continue;

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
      dicas.push(`${jogador} já fechou a mão com ${limite} carta(s) confirmada(s).`);
      continue;
    }

    if (possiveis === faltam) {
      dicas.push(
        `${jogador} precisa de ${faltam} carta(s) e restam exatamente ${faltam} posição(ões) possíveis na coluna.`,
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
        mensagem: `"${linha.nome}" tem ${linha.vCount} marcações V (cada carta tem 1 dono único).`,
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
        mensagem: `Seção "${tipo}" tem ${ocultasTodaX.length} cartas marcadas com X em todas as colunas (só pode haver 1 oculta por seção).`,
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
        mensagem: `Seção "${tipo}" tem V em todas as cartas (1 carta dessa seção deveria estar oculta).`,
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
      // IA-043: foco vira lista das celulas V dessa coluna (em vez da coluna
      // toda) - destaca exatamente as marcacoes que excedem o limite.
      if (vCount > limite) {
        const chavesV = [];
        linhas.forEach((linha) => {
          if (linha.estados[col] === "V") {
            chavesV.push(`${linha.row}-${col}`);
          }
        });
        graves.push({
          codigo: "coluna-excesso",
          nivel: "grave",
          mensagem: `${nomeJog} tem ${vCount} V marcados mas a mão só permite ${limite}.`,
          foco: { tipo: "celulas", chaves: chavesV },
        });
      }

      // 5/6. IA-043: unificadas. Antes eram 2 alertas que disparavam juntos
      // quando coluna fechava com V abaixo do limite (coluna-impossivel-aberta
      // + coluna-insuficiente). Agora:
      //   - coluna-fechada-abaixo: abertas=0 + V<limite (mensagem unificada)
      //   - coluna-impossivel-aberta: ainda tem abertas mas insuficientes
      const faltam = limite - vCount;
      if (abertas === 0 && vCount < limite) {
        graves.push({
          codigo: "coluna-fechada-abaixo",
          nivel: "grave",
          mensagem: `${nomeJog} fechou a mão com ${vCount} carta(s) confirmada(s), mas precisa de ${limite} (faltam ${faltam}).`,
          foco: { tipo: "coluna", coluna: col },
        });
      } else if (faltam > 0 && abertas < faltam && vCount <= limite) {
        graves.push({
          codigo: "coluna-impossivel-aberta",
          nivel: "grave",
          mensagem: `${nomeJog} precisa de ${faltam} carta(s) mas só restam ${abertas} célula(s) aberta(s).`,
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

// ============================================================================
// IA-030: APLICADORES DOM (substituem innerHTML = formatar*)
// ============================================================================
// Em vez de gerar string HTML e atribuir a innerHTML (parse + recria nodes +
// perde foco/scroll/animacoes), montamos nodes via createElement e usamos
// replaceChildren. Inconsistencias usam addEventListener no botao em vez
// do onclick inline HTML.
//
// Conteudo dos itens eh sempre texto puro (verificado em todos os push
// dos producers); usar textContent eh seguro e mais rapido que innerHTML.

function aplicarListaAssistenteIA(el, itens) {
  if (!el) return;
  if (!Array.isArray(itens) || itens.length === 0) {
    const p = document.createElement("p");
    p.textContent = "Nenhuma análise disponível.";
    el.replaceChildren(p);
    return;
  }
  const ul = document.createElement("ul");
  ul.className = "ia-lista";
  for (const item of itens) {
    const li = document.createElement("li");
    li.textContent = String(item);
    ul.appendChild(li);
  }
  el.replaceChildren(ul);
}

function aplicarInconsistenciasAssistenteIA(el, graves, leves) {
  if (!el) return;
  const total = (graves?.length || 0) + (leves?.length || 0);
  if (total === 0) {
    aplicarListaAssistenteIA(el, [
      "Nenhuma inconsistencia detectada.",
      "Marcacoes estao logicamente consistentes.",
    ]);
    return;
  }

  const ul = document.createElement("ul");
  ul.className = "ia-lista-inconsistencias";

  const adicionarItens = (lista, classeNivel) => {
    (lista || []).forEach((inc) => {
      const li = document.createElement("li");
      li.className = `ia-inconsistencia ${classeNivel}`;
      if (inc.foco) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ia-inconsistencia-btn";
        btn.textContent = inc.mensagem;
        const focoCopia = inc.foco;
        btn.addEventListener("click", () => {
          if (typeof aplicarFocoInconsistenciaAssistenteIA === "function") {
            aplicarFocoInconsistenciaAssistenteIA(JSON.stringify(focoCopia));
          }
        });
        li.appendChild(btn);
      } else {
        li.textContent = inc.mensagem;
      }
      ul.appendChild(li);
    });
  };

  adicionarItens(graves, "ia-grave");
  adicionarItens(leves, "ia-leve");

  el.replaceChildren(ul);
}

// IA-029: render dos cards do assistente eh desperdicio quando o menu
// lateral esta fechado (usuario nao ve). DEDUCOES continuam rodando
// (afetam V/auto-X na tabela mesmo com menu fechado). Quando o menu
// abre, toggleMenu() em menu.js dispara atualizarAssistenteIA().
function menuLateralAssistenteVisivelAssistenteIA() {
  const menu =
    typeof getEl === "function"
      ? getEl("menuLateral")
      : document.getElementById("menuLateral");
  return !!(menu && menu.classList && menu.classList.contains("aberto"));
}

function atualizarAssistenteIA() {
  try {
    // Sem PRO -> menu inteiro fica oculto via atualizarStatusPRO; nao
    // precisamos renderizar nada. Garante limpeza do badge de inconsistencia
    // (caso usuario desativou PRO com inconsistencia ainda na tela).
    if (typeof isPRO === "function" && !isPRO()) {
      document.body.classList.remove("tem-inconsistencia-grave");
      return;
    }
    if (!Array.isArray(cartas) || cartas.length === 0) return;

    const estrutura = garantirEstruturaAssistenteIA();
    if (!estrutura) return;

    // IA-029: usado pelos 2 early-returns abaixo e pelo skip do render etapa 2
    const menuVisivel = menuLateralAssistenteVisivelAssistenteIA();

    // PRO ativo mas usuario desligou o assistente via popup: cards continuam
    // visiveis (pra o gear ficar acessivel) mas mostram estado "desativado".
    const cfgUsuario = obterConfiguracaoAssistenteIA();
    if (!cfgUsuario.ativo) {
      // Limpa badge - assistente off, sem deteccao de inconsistencia
      document.body.classList.remove("tem-inconsistencia-grave");
      // IA-029: skip writes se menu lateral fechado - toggleMenu re-dispara
      if (!menuVisivel) return;
      // IA-030: replaceChildren via aplicarListaAssistenteIA
      // IA-043: textos mais diretos
      const itensDesativado = [
        "Assistente desativado.",
        "Toque na engrenagem no topo para ativar.",
      ];
      aplicarListaAssistenteIA(estrutura.resumo, itensDesativado);
      aplicarListaAssistenteIA(estrutura.sugestao, itensDesativado);
      aplicarListaAssistenteIA(estrutura.confianca, [
        "Nível atual: Desativado.",
      ]);
      if (estrutura.inconsistencias) {
        aplicarListaAssistenteIA(estrutura.inconsistencias, itensDesativado);
      }
      // IA-041: esconde card de raciocinio quando assistente desativado
      if (estrutura.raciocinioCard) estrutura.raciocinioCard.hidden = true;
      return;
    }

    const estado = obterEstadoTabelaAssistenteIA();
    const totalMarcacoes = Object.values(estado).filter(Boolean).length;

    if (totalMarcacoes === 0) {
      // IA-029: skip writes se menu lateral fechado - toggleMenu re-dispara
      if (!menuVisivel) return;
      // IA-030: replaceChildren via aplicarListaAssistenteIA
      // IA-043: textos mais diretos
      aplicarListaAssistenteIA(estrutura.resumo, [
        "Comece marcando V, X e ? na tabela.",
        "O assistente come\u00e7a a analisar assim que houver dados.",
      ]);
      aplicarListaAssistenteIA(estrutura.sugestao, [
        "Aguardando as primeiras marca\u00e7\u00f5es pra gerar uma sugest\u00e3o.",
      ]);
      aplicarListaAssistenteIA(estrutura.confianca, [
        "N\u00edvel atual: Inicial.",
      ]);
      if (estrutura.inconsistencias) {
        aplicarInconsistenciasAssistenteIA(estrutura.inconsistencias, [], []);
      }
      // IA-041: esconde card de raciocinio quando nada marcado
      if (estrutura.raciocinioCard) estrutura.raciocinioCard.hidden = true;
      return;
    }

    // Etapa 1: dedu\u00e7\u00e3o autom\u00e1tica - escreve em localStorage (marcarCelula).
    // NAO usa cache pois cada iteracao precisa releitura fresca apos writes.
    // Orquestrador roda 3 deducoes em loop ate estabilizar:
    //  - capacidade (IA-001)
    //  - exclusoes fortes: coluna-saturada + linha-unica (IA-014)
    //  - cruzamentos fortes: dupla-trio (IA-015)
    executarTodasDeducoesAssistenteIA();

    // Badge de inconsistencia grave (rodape) - precisa atualizar SEMPRE,
    // mesmo com menu fechado, senao o badge fica congelado ate o usuario
    // abrir o menu. Roda fora do skip-render do IA-029. Operacao barata
    // (1 classificacao das linhas) e tira o pulo de cache porque o estado
    // mudou apos a etapa 1 de deducoes.
    try {
      executarComCacheAssistenteIA(() => {
        const linhasAtuais = obterLinhasAssistenteIA();
        const incAtual = classificarInconsistenciasAssistenteIA(linhasAtuais);
        document.body.classList.toggle(
          "tem-inconsistencia-grave",
          incAtual.graves.length > 0,
        );
      });
    } catch {}

    // IA-029: render dos cards eh inutil se ninguem ve. toggleMenu() chama
    // atualizarAssistenteIA quando o menu abrir.
    if (!menuVisivel) return;

    // IA-028: skip render quando snapshot final (pos-deducao) nao mudou
    // desde o ultimo render. Hash inclui estadoTabela, grupos, origens,
    // config, pendencias e ultima mudanca. Snap construido aqui eh
    // reaproveitado por executarComCacheAssistenteIA logo abaixo.
    const snapPosDeducao = construirSnapshotAssistenteIA();
    const hashAtual = hashSnapshotParaRenderAssistenteIA(snapPosDeducao);
    if (hashAtual === ultimoHashRenderAssistenteIA) return;
    ultimoHashRenderAssistenteIA = hashAtual;

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

      // Badge vermelho no btnMenu (rodape) quando houver inconsistencia
      // grave - alerta visivel sem precisar abrir o menu. Apenas em PRO
      // (FREE nao roda IA). Atualiza body.tem-inconsistencia-grave.
      document.body.classList.toggle("tem-inconsistencia-grave", temGrave);

      // Card "O que mudou" - mantem normal
      // IA-030: replaceChildren via aplicarListaAssistenteIA
      aplicarListaAssistenteIA(estrutura.resumo, mudancas);

      // Prioridade do override do card "Proxima sugestao":
      // 1. Inconsistencia grave -> "Corrija X" (IA-018)
      // 2. Pendencias do modo manual (IA-022) -> lista de instrucoes
      // 3. Sugestao normal
      const temPendencias = pendenciasMarcacaoAssistenteIA.length > 0;

      if (temGrave) {
        const qtd = inc.graves.length;
        const plural = qtd > 1 ? "inconsistencias graves" : "inconsistencia grave";
        const autoAtiva = ehAutomarcacaoAtivaAssistenteIA();
        const linhaPausa = autoAtiva
          ? "Marcacao automatica pausada ate as inconsistencias serem resolvidas."
          : "Sugestoes pausadas ate as inconsistencias serem resolvidas.";
        aplicarListaAssistenteIA(estrutura.sugestao, [
          `Corrija ${qtd} ${plural} antes de continuar.`,
          linhaPausa,
          "Veja os detalhes no card 'Inconsistencias' (clique em cada item para destacar na tabela).",
        ]);
      } else if (temPendencias) {
        aplicarListaAssistenteIA(
          estrutura.sugestao,
          construirInstrucoesPendentesAssistenteIA(),
        );
      } else {
        aplicarListaAssistenteIA(estrutura.sugestao, sugestao.itens);
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
      // IA-030: replaceChildren via aplicarListaAssistenteIA
      aplicarListaAssistenteIA(estrutura.confianca, [
        `Nivel atual: ${nivelFinal}.`,
        ...detalhesFinal,
        ...(temGrave || temPendencias ? [] : dicasCapacidade),
      ]);

      // Card "Inconsistencias" (IA-017)
      if (estrutura.inconsistencias) {
        aplicarInconsistenciasAssistenteIA(
          estrutura.inconsistencias,
          inc.graves,
          inc.leves,
        );
      }

      // IA-041: Card "Raciocinio detalhado" - so aparece em nivel "detalhada".
      // Esconde completamente nos outros modos pra nao poluir a UI.
      if (estrutura.raciocinioCard) {
        const cfgNivel = cfgUsuario.nivelExplicacao;
        const ehDetalhado = cfgNivel === "detalhada";
        if (ehDetalhado) {
          estrutura.raciocinioCard.hidden = false;
          const itensRaciocinio = construirRaciocinioDetalhadoAssistenteIA(
            sugestao.escolhas,
          );
          if (estrutura.raciocinio && itensRaciocinio.length > 0) {
            aplicarListaAssistenteIA(estrutura.raciocinio, itensRaciocinio);
          } else if (estrutura.raciocinio) {
            aplicarListaAssistenteIA(estrutura.raciocinio, [
              "Sem dados suficientes ainda pra explicar o raciocínio.",
            ]);
          }
        } else {
          estrutura.raciocinioCard.hidden = true;
        }
      }
    }, snapPosDeducao);
  } catch (erro) {
    console.error("Assistente IA falhou ao atualizar.", erro);
  }
}
