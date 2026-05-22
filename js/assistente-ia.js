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

  // IA-020: configuracao real lida do localStorage (P6/Sprint E).
  // gruposResposta/origensDuvida continuam como placeholder ate P7/Sprint F.
  const configuracao = obterConfiguracaoAssistenteIA();
  const gruposResposta = [];
  const origensDuvida = {};

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

  return cartas.map((carta, row) => {
    const estados = [];
    let vCount = 0;
    let xCount = 0;
    let maybeCount = 0;

    for (let col = 0; col < jogadores; col++) {
      const valor = estado[`${row}-${col}`] || "";
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

    for (let tentativa = 0; tentativa < 10; tentativa++) {
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
        const cel = document.querySelector(`[data-key="${acao.chave}"]`);
        if (!cel) return;

        marcarCelula(cel, "V");
        houveMudanca = true;

        if (!porJogador.has(acao.col)) {
          porJogador.set(acao.col, []);
        }

        porJogador.get(acao.col).push(cartas[acao.row].nome);
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

    for (let tentativa = 0; tentativa < 5; tentativa++) {
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
        const cel = document.querySelector(`[data-key="${acao.chave}"]`);
        if (!cel) return;
        marcarCelula(cel, acao.marca);
        mudouNoCiclo = true;
        houveMudancaTotal = true;
      });

      if (!mudouNoCiclo) break;
    }

    return houveMudancaTotal;
  } finally {
    executandoExclusoesFortesAssistenteIA = false;
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
      const cel = document.querySelector(`[data-key="${acao.chave}"]`);
      if (!cel) return;
      const valorAtual = estado[acao.chave] || "";
      if (valorAtual === acao.marca) return;
      marcarCelula(cel, acao.marca);
      houveMudanca = true;
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
  let houveMudancaTotal = false;
  const MAX_CICLOS = 8;
  for (let ciclo = 0; ciclo < MAX_CICLOS; ciclo++) {
    const a = deduzirCartasPorCapacidadeAssistenteIA();
    const b = deduzirExclusoesFortesAssistenteIA();
    const c = deduzirCruzamentosFortesAssistenteIA();
    if (!a && !b && !c) break;
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

function construirSugestaoAssistenteIA(resumo, linhas) {
  const suspeito = obterMelhorLinhaPorTipoAssistenteIA("Suspeitos", resumo);
  const arma = obterMelhorLinhaPorTipoAssistenteIA("Armas", resumo);
  const local = obterMelhorLinhaPorTipoAssistenteIA("Locais", resumo);

  const itens = [];
  const scoreTotal = [suspeito, arma, local].reduce(
    (soma, item) => soma + (item?.score || 0),
    0,
  );

  if (suspeito && arma && local && scoreTotal >= 18) {
    itens.push(`Pergunta sugerida: ${suspeito.nome} + ${arma.nome} + ${local.nome}.`);
  } else {
    itens.push("Ainda n\u00e3o h\u00e1 dados suficientes para montar uma combina\u00e7\u00e3o forte completa.");
  }

  if (local) {
    const pesoLocal = calcularPesoOcultacaoLocal(local, linhas);
    if (pesoLocal > 0) {
      itens.push(
        `${local.nome} ganhou prioridade porque locais costumam ser escondidos quando o jogador tambem pode mostrar outra carta.`,
      );
    }
  }

  const linhaPressao = resumo.candidatosOcultos.find(
    (linha) => linha.candidatos.length > 1 && !linha.isFound,
  );
  if (linhaPressao) {
    const nomes = linhaPressao.candidatos
      .slice(0, 3)
      .map((item) => obterNomeJogadorAssistenteIA(item.col))
      .join(", ");
    itens.push(`Carta sob pressao: ${linhaPressao.nome}. Candidatos atuais: ${nomes}.`);
  }

  return {
    itens: itens.slice(0, 3),
    escolhas: [suspeito, arma, local],
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
    // IA-020: respeita PRO E configuracao.ativo do usuario
    if (typeof assistenteIAEstaAtivo === "function") {
      if (!assistenteIAEstaAtivo()) return;
    } else if (typeof isPRO === "function" && !isPRO()) {
      return;
    }
    if (!Array.isArray(cartas) || cartas.length === 0) return;

    const estrutura = garantirEstruturaAssistenteIA();
    if (!estrutura) return;

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

      // IA-018: override Sugestao quando ha inconsistencia grave.
      // Mostra apenas contagem + recomendacao - detalhes ficam no card
      // dedicado de "Inconsistencias" (evita duplicacao de mensagem).
      if (temGrave) {
        const qtd = inc.graves.length;
        const plural = qtd > 1 ? "inconsistencias graves" : "inconsistencia grave";
        estrutura.sugestao.innerHTML = formatarListaAssistenteIA([
          `Corrija ${qtd} ${plural} antes de continuar.`,
          "Veja os detalhes no card 'Inconsistencias' (clique em cada item para destacar na tabela).",
        ]);
      } else {
        estrutura.sugestao.innerHTML = formatarListaAssistenteIA(sugestao.itens);
      }

      // IA-018: override Confianca - "Invalida" se grave, "Cautela" se leve
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
      }
      estrutura.confianca.innerHTML = formatarListaAssistenteIA([
        `Nivel atual: ${nivelFinal}.`,
        ...detalhesFinal,
        ...(temGrave ? [] : dicasCapacidade),
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
