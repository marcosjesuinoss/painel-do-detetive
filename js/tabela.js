let celulaSelecionada = null;
let colunaSelecionada = null;
let linhasSelecionadas = {
  Suspeitos: null,
  Armas: null,
  Locais: null
};

// IA-008: leitura centralizada de estadoTabela.
// Concentra em 1 ponto as 6+ chamadas anteriores que faziam
// JSON.parse(localStorage.getItem("estadoTabela") || "{}") espalhadas
// pelo arquivo. Quando P3 (IA-011 snapshot) chegar, este wrapper passa
// a delegar ao cache central sem necessidade de tocar callsites.
function lerEstadoTabela() {
  try {
    return JSON.parse(localStorage.getItem("estadoTabela") || "{}");
  } catch {
    return {};
  }
}

/* =====================================
   CONFIGURAÇÕES DO JOGO
===================================== */

const versoes = {
  clueOriginal: {
    nome: "Clue Original",
    suspeitos: [
      "Coronel Mustard",
      "Professor Plum",
      "Rev. Green",
      "Sra. Peacock",
      "Srta. Scarlet",
      "Sra. White"
    ],
    armas: [
      "Faca", "Castiçal", "Revolver",
      "Corda", "Cano de chumbo", "Chave inglesa"
    ],
    locais: [
      "Entrada", "Sala de estar", "Sala de jantar",
      "Cozinha", "Sala de musica", "Jardim de inverno",
      "Salão de jogos", "Biblioteca", "Escritório"
    ],
    min: 3,
    max: 6
  },

  detetiveAntigo: {
    nome: "Detetive (Antigo)",
    suspeitos: [
      "Coronel Mustarda", "Dona Branca",
      "Senhora Pavão", "Professor Plum",
      "Rev. Sr. Green", "Senhorita Scarlet"
    ],
    armas: [
      "Castiçal", "Cano", "Chave inglesa",
      "Corda", "Revolver", "Faca"
    ],
    locais: [
      "Biblioteca", "Cozinha", "Hall",
      "Escritório", "Sala de estar",
      "Sala de jantar", "Sala de musica",
      "Sala de festa", "Sala de jogos"
    ],
    min: 3,
    max: 6
  },

  detetiveEstrela: {
    nome: "Detetive (Versão Estrela)",
    suspeitos: [
      "Sargento", "Florista", "Chefe de cozinha",
      "Mordomo", "Médica", "Dançarina",
      "Coveiro", "Advogado"
    ],
    armas: [
      "Espingarda", "Pá", "Pé de cabra",
      "Tesoura", "Arma química",
      "Veneno", "Soco inglês", "Faca"
    ],
    locais: [
      "Prefeitura", "Restaurante", "Floricultura",
      "Boate", "Hospital", "Mansão",
      "Cemitério", "Praça central",
      "Hotel", "Banco", "Estação de trem"
    ],
    min: 3,
    max: 8
  }
};

const coresPersonagens = {
  "Coronel Mustard": "#eab308",
  "Professor Plum": "#7c3aed",
  "Rev. Green": "#16a34a",
  "Sra. Peacock": "#2563eb",
  "Srta. Scarlet": "#dc2626",
  "Sra. White": "#d1d5db",
  "Coronel Mustarda": "#eab308",
  "Dona Branca": "#d1d5db",
  "Senhora Pavão": "#2563eb",
  "Rev. Sr. Green": "#16a34a",
  "Senhorita Scarlet": "#dc2626",
  Sargento: "#facc15",
  Florista: "#ffffff",
  "Chefe de cozinha": "#92400e",
  Mordomo: "#2563eb",
  Médica: "#f472b6",
  Dançarina: "#ef4444",
  Coveiro: "#000000",
  Advogado: "#65a30d"
};

/* =====================================
   ESTADO GLOBAL
===================================== */

let cartas = [];

/* =====================================
   CARTAS
===================================== */

function gerarCartas() {
  const versaoSelecionada = document.getElementById("versao").value;
  const v = versoes[versaoSelecionada];

  cartas = [];

  v.suspeitos.forEach(nome => cartas.push({ tipo: "Suspeitos", nome }));
  v.armas.forEach(nome => cartas.push({ tipo: "Armas", nome }));
  v.locais.forEach(nome => cartas.push({ tipo: "Locais", nome }));
}

/* =====================================
   TABELA
===================================== */

function criarTabela() {
  const jogadores = parseInt(localStorage.getItem("numJogadores") || 3);

  // 🔥 Ativa modo compacto se tiver 7 ou mais jogadores
  document.body.classList.toggle("modo-compacto", jogadores >= 7);

  // Polish H: densidade adaptativa - data attribute permite CSS ajustar
  // padding/font/altura baseado no numero de jogadores. 3-4 = espacoso,
  // 5-6 = medio (default), 7-8 = compacto.
  document.body.dataset.jogadores = String(jogadores);

  const area = document.getElementById("tabela");
  area.innerHTML = "";

  const estadoSalvo = lerEstadoTabela();
  // Polish H: largura fixa pra coluna de nomes - independente de quantos
  // jogadores. Antes era 31% (proporcional, ficava menor com menos jogadores
  // gerando overflow nos nomes longos). Agora 110px (equivale ao 31% que
  // 8 jogadores produzia em mobile).
  const template = `110px repeat(${jogadores}, 1fr)`;

  const header = document.createElement("div");
  header.className = "linha-grid";
  header.style.gridTemplateColumns = template;

  const titulo = document.createElement("div");
  titulo.className = "celula";
  titulo.innerHTML = "<strong>Cartas</strong>";
  header.appendChild(titulo);

  for (let j = 1; j <= jogadores; j++) {
  const nome = localStorage.getItem("nomeJogador" + j) || "J" + j;
  const cel = document.createElement("div");
  cel.className = "celula";
  const strong = document.createElement("strong");
  strong.textContent = nome;
  cel.appendChild(strong);

  // identificar coluna
  cel.dataset.col = j - 1;

  cel.onclick = () => {

    if (colunaSelecionada === j - 1) {
      colunaSelecionada = null;
    } else {
      colunaSelecionada = j - 1;
    }

    if (celulaSelecionada) {
      celulaSelecionada.classList.remove("selecionada");
      celulaSelecionada = null;
    }

    atualizarDestaques();
    atualizarBotoes();
  };

  header.appendChild(cel);
}

  area.appendChild(header);

  let tipoAtual = "";

  cartas.forEach((c, i) => {

    if (c.tipo !== tipoAtual) {
      tipoAtual = c.tipo;

      const secao = document.createElement("div");
      secao.className = "linha-grid secao-grid";
      secao.style.gridTemplateColumns = "1fr";

      const cel = document.createElement("div");
      cel.className = "celula";
      cel.textContent = tipoAtual;

      secao.appendChild(cel);
      area.appendChild(secao);
    }

    const linha = document.createElement("div");
    linha.className = "linha-grid";
    linha.style.gridTemplateColumns = template;

    const nomeCarta = document.createElement("div");
nomeCarta.className = "celula nome";
nomeCarta.textContent = c.nome;

// identificar linha e tipo
nomeCarta.dataset.row = i;
nomeCarta.dataset.tipo = c.tipo;

nomeCarta.onclick = () => {

  const tipo = c.tipo;

  // se clicar novamente, remove seleção
  if (linhasSelecionadas[tipo] === i) {
    linhasSelecionadas[tipo] = null;
  } else {
    linhasSelecionadas[tipo] = i;
  }

  // remover seleção individual se existir
  if (celulaSelecionada) {
    celulaSelecionada.classList.remove("selecionada");
    celulaSelecionada = null;
  }

  atualizarDestaques();
  atualizarBotoes();
};

    if (c.tipo === "Suspeitos") {
      const cor = document.createElement("div");
      cor.className = "referencia-cor";
      cor.style.background = coresPersonagens[c.nome] || "#999";
      nomeCarta.appendChild(cor);
    }

    linha.appendChild(nomeCarta);

    for (let j = 0; j < jogadores; j++) {

  const chave = `${i}-${j}`;
  let estado = estadoSalvo[chave] || "";

  const cel = document.createElement("div");
  cel.className = "celula";

  cel.dataset.row = i;
  cel.dataset.col = j;
  cel.dataset.key = chave;

  renderizarEstado(cel, estado);

cel.onclick = () => {

  // animação permanece
  cel.style.transform = "scale(0.9)";
  setTimeout(() => {
    cel.style.transform = "scale(1)";
  }, 100);

  // 🔹 Se clicar de novo na mesma célula
  if (celulaSelecionada === cel) {
    cel.classList.remove("selecionada");
    celulaSelecionada = null;

    atualizarDestaques();
    atualizarBotoes();
    return;
  }

  // 🔹 NOVO: se já havia outra célula selecionada, remover
  if (celulaSelecionada) {
    celulaSelecionada.classList.remove("selecionada");
  }

  // selecionar nova
  celulaSelecionada = cel;
  cel.classList.add("selecionada");

  atualizarBotoes();
};

      linha.appendChild(cel);
    }

    area.appendChild(linha);
  });
  atualizarEstadoVisualCartasEncontradas();
  atualizarDestaqueCartaOculta();
  atualizarAlertaDuplicidadePRO();
  atualizarDestaques();
  atualizarBotoes();
  atualizarBotaoContinuar();
  if (typeof agendarAtualizacaoAssistenteIA === "function") {
    agendarAtualizacaoAssistenteIA();
  } else if (typeof atualizarAssistenteIA === "function") {
    atualizarAssistenteIA();
  }
}

function atualizarCor(td, estado) {
  td.classList.remove("ok", "no", "maybe");

  if (estado === "✔") td.classList.add("ok");
  if (estado === "✖") td.classList.add("no");
  if (estado === "?") td.classList.add("maybe");
}

function marcarCelula(cel, tipo, modoTrinca = false, origem = "manual") {
  if (!cel) return;

  const chave = cel.dataset.key;
  const row = cel.dataset.row;
  const col = cel.dataset.col;
  const estadoSalvo = lerEstadoTabela();
  const estadoAnterior = estadoSalvo[chave] || "";
  const autoXChaves = new Set();

  if (tipo === "V") {
    estadoSalvo[chave] = "V";

    // Auto-X no resto da linha (carta com 1 dono unico, outros nao podem ter).
    // Respeita o toggle "Marcacao automatica" do popup config do assistente:
    // se PRO ativo + config.automarcacao=false, NAO faz auto-X.
    let permitirAutoX = true;
    try {
      const isProAtivo = typeof isPRO === "function" && isPRO();
      if (isProAtivo) {
        const cfgRaw = localStorage.getItem("assistenteIAConfiguracoes");
        if (cfgRaw) {
          const cfg = JSON.parse(cfgRaw);
          if (cfg && cfg.automarcacao === false) permitirAutoX = false;
        }
      }
    } catch {}

    if (permitirAutoX) {
      document.querySelectorAll(`[data-row="${row}"]`)
        .forEach(c => {
          if (c !== cel) {
            const k = c.dataset.key;
            if (!k) return;

            const estadoAnterior = estadoSalvo[k] || "";
            if (estadoAnterior !== "V") {
              estadoSalvo[k] = "X";

              // animar apenas os X que surgiram agora por causa do V
              if (estadoAnterior !== "X") {
                autoXChaves.add(k);
              }
            }
          }
        });
    }
  }

  if (tipo === "X") {

  // Se for marcação da trinca e já for V, NÃO altera
  if (modoTrinca && estadoSalvo[chave] === "V") {
    return;
  }

  estadoSalvo[chave] = "X";
}

  if (tipo === "?") {
    estadoSalvo[chave] = "?";
    // Trinca de ? registra origem via aplicarTrincaResposta diretamente
    // (origem="grupo"). ? manual chega aqui com origem="manual".
    if (origem === "manual" && typeof registrarOrigemDuvidaManual === "function") {
      registrarOrigemDuvidaManual(chave);
    }
  }

if (tipo === "") {
  delete estadoSalvo[chave];
}

// Limpeza generica: se a celula DEIXOU de ser "?", remove origens e edita
// grupos associados. Cobre V, X e "" sobre uma celula que era "?".
const estadoNovo = estadoSalvo[chave] || "";
if (estadoAnterior === "?" && estadoNovo !== "?") {
  if (typeof editarGruposRespostaPorApagamento === "function") {
    editarGruposRespostaPorApagamento(chave, row, col, estadoNovo);
  }
  if (typeof removerOrigemDuvida === "function") {
    removerOrigemDuvida(chave);
  }
}

  localStorage.setItem("estadoTabela", JSON.stringify(estadoSalvo));

// 🔹 LIMPAR SELEÇÃO COMPLETAMENTE
cel.classList.remove("selecionada");
celulaSelecionada = null;

// 🔹 Atualizar DOM apenas do necessário (sem recriar tabela)
if (tipo === "V") {
  document.querySelectorAll(`[data-row="${row}"][data-key]`).forEach((c) => {
    const k = c.dataset.key;
    renderizarEstado(c, estadoSalvo[k] || "");

    if (autoXChaves.has(k) && estadoSalvo[k] === "X") {
      const xIcon = c.querySelector(".estado-x");
      if (xIcon) {
        xIcon.classList.remove("x-auto-anim");
        void xIcon.offsetWidth;
        xIcon.classList.add("x-auto-anim");
      }
    }
  });
} else {
  renderizarEstado(cel, estadoSalvo[chave] || "");
}
  atualizarEstadoVisualCartasEncontradas();
  atualizarDestaqueCartaOculta();
  atualizarAlertaDuplicidadePRO();
  atualizarDestaques();
  atualizarBotoes();
  atualizarBotaoContinuar();

  // IA-002: narrar a marcacao manual para o card "O que mudou" do assistente.
  // Auto-X gerados por V (rest da linha) NAO sao narrados aqui - eles
  // sao consequencia logica, nao acao primaria do usuario.
  if (
    typeof registrarMudancaAssistenteIA === "function" &&
    tipo &&
    tipo !== "" &&
    !modoTrinca
  ) {
    const partes = chave.split("-");
    const rowIdx = Number(partes[0]);
    const colIdx = Number(partes[1]);
    const carta = Array.isArray(cartas) && cartas[rowIdx] ? cartas[rowIdx].nome : null;
    const jogador =
      typeof obterNomeJogadorAssistenteIA === "function"
        ? obterNomeJogadorAssistenteIA(colIdx)
        : localStorage.getItem(`nomeJogador${colIdx + 1}`) || `J${colIdx + 1}`;
    if (carta && jogador) {
      // IA-043: col usado pra suprimir narracao quando jogador eh J1 (voce)
      registrarMudancaAssistenteIA({ tipo, carta, jogador, col: colIdx });
    }
  }

  if (typeof agendarAtualizacaoAssistenteIA === "function") {
    agendarAtualizacaoAssistenteIA();
  } else if (typeof atualizarAssistenteIA === "function") {
    atualizarAssistenteIA();
  }
}

function atualizarEstadoVisualCartasEncontradas() {
  const estadoSalvo = lerEstadoTabela();
  const linhasComV = new Set();

  Object.entries(estadoSalvo).forEach(([chave, estado]) => {
    if (estado !== "V") return;
    const row = chave.split("-")[0];
    linhasComV.add(row);
  });

  document
    .querySelectorAll("#tabela .celula.nome[data-row]")
    .forEach((nomeCel) => {
      const row = nomeCel.dataset.row;
      nomeCel.classList.toggle("carta-encontrada", linhasComV.has(row));
    });
}

function atualizarDestaqueCartaOculta() {
  const jogadores = parseInt(localStorage.getItem("numJogadores") || 3);
  const estadoSalvo = lerEstadoTabela();

  document
    .querySelectorAll("#tabela .celula.carta-oculta")
    .forEach((c) => c.classList.remove("carta-oculta"));

  if (typeof isPRO !== "function" || !isPRO()) {
    return;
  }

  if (!Array.isArray(cartas) || cartas.length === 0) {
    return;
  }

  const infoLinhas = cartas.map((carta, row) => {
    let hasV = false;
    let allX = true;

    for (let j = 0; j < jogadores; j++) {
      const estado = estadoSalvo[`${row}-${j}`] || "";
      if (estado === "V") {
        hasV = true;
      }
      if (estado !== "X") {
        allX = false;
      }
    }

    return {
      row,
      tipo: carta.tipo,
      hasV,
      allX,
    };
  });

  const ocultas = new Set();

  // Regra 2: linha toda X
  infoLinhas.forEach((info) => {
    if (info.allX) {
      ocultas.add(String(info.row));
    }
  });

  // Regra 1: apenas 1 carta sem V na secao
  const porSecao = {};
  infoLinhas.forEach((info) => {
    if (!porSecao[info.tipo]) {
      porSecao[info.tipo] = [];
    }
    porSecao[info.tipo].push(info);
  });

  Object.values(porSecao).forEach((linhasSecao) => {
    const semV = linhasSecao.filter((info) => !info.hasV);
    if (semV.length === 1) {
      ocultas.add(String(semV[0].row));
    }
  });

  ocultas.forEach((row) => {
    document
      .querySelectorAll(`#tabela .celula[data-row="${row}"]`)
      .forEach((cel) => cel.classList.add("carta-oculta"));
  });
}

function atualizarAlertaDuplicidadePRO() {

  document
    .querySelectorAll("#tabela .celula.alerta-duplicidade-v")
    .forEach((c) => c.classList.remove("alerta-duplicidade-v"));

  if (typeof isPRO !== "function" || !isPRO()) {
    return;
  }

  const estadoSalvo = lerEstadoTabela();
  const porLinha = {};
  const porColuna = {};

  Object.entries(estadoSalvo).forEach(([chave, estado]) => {
    if (estado !== "V") return;

    const partes = chave.split("-");
    const row = partes[0];
    const col = partes[1];

    if (!porLinha[row]) porLinha[row] = [];
    porLinha[row].push(chave);

    if (!porColuna[col]) porColuna[col] = [];
    porColuna[col].push(chave);
  });

  // Regra 1: linha com 2+ V (carta com 2 donos - impossivel)
  Object.values(porLinha).forEach((chavesDaLinha) => {
    if (chavesDaLinha.length < 2) return;

    chavesDaLinha.forEach((chave) => {
      const cel = document.querySelector(`[data-key="${chave}"]`);
      if (cel) {
        cel.classList.add("alerta-duplicidade-v");
      }
    });
  });

  // Regra 2: coluna com mais V que o limite da mao do jogador
  const numJogadores = parseInt(localStorage.getItem("numJogadores") || "3", 10);
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
    const cfg = obterConfiguracaoDistribuicaoCartas(numJogadores);
    if (cfg && !cfg.precisaSelecionar) {
      cartasPorJogador = cfg.cartasPorJogador.slice();
    }
  }
  if (!Array.isArray(cartasPorJogador)) return;

  Object.entries(porColuna).forEach(([col, chavesDaColuna]) => {
    const limite = cartasPorJogador[parseInt(col, 10)];
    if (typeof limite !== "number") return;
    if (chavesDaColuna.length <= limite) return;
    chavesDaColuna.forEach((chave) => {
      const cel = document.querySelector(`[data-key="${chave}"]`);
      if (cel) {
        cel.classList.add("alerta-duplicidade-v");
      }
    });
  });
}

function atualizarDestaques() {

  document.querySelectorAll("#tabela .celula").forEach(c =>
    c.classList.remove("sel-col", "sel-row", "sel-inter")
  );

  if (colunaSelecionada !== null) {
    document.querySelectorAll(`[data-col="${colunaSelecionada}"]`)
      .forEach(c => c.classList.add("sel-col"));
  }

  Object.values(linhasSelecionadas).forEach(linha => {
    if (linha !== null) {
      document.querySelectorAll(`[data-row="${linha}"]`)
        .forEach(c => c.classList.add("sel-row"));
    }
  });

  if (colunaSelecionada !== null) {
    Object.values(linhasSelecionadas).forEach(linha => {
      if (linha !== null) {
        const inter = document.querySelector(`[data-row="${linha}"][data-col="${colunaSelecionada}"]`);
        if (inter) inter.classList.add("sel-inter");
      }
    });
  }
}

function limparSelecoes() {

  if (celulaSelecionada) {
    celulaSelecionada.classList.remove("selecionada");
    celulaSelecionada = null;
  }

  colunaSelecionada = null;

  linhasSelecionadas = {
    Suspeitos: null,
    Armas: null,
    Locais: null
  };

  atualizarDestaques();
}

function resetarSelecoesGlobais() {
  celulaSelecionada = null;
  colunaSelecionada = null;
  linhasSelecionadas = {
    Suspeitos: null,
    Armas: null,
    Locais: null
  };

  atualizarDestaques();
}

function atualizarBotoes() {

  const btnTrue = document.getElementById("btnTrue");
  const btnFalse = document.getElementById("btnFalse");
  const btnMaybe = document.getElementById("btnMaybe");
  const btnClear = document.getElementById("btnClearSel");

  const temCelula = celulaSelecionada !== null;

  const temColuna = colunaSelecionada !== null;
  const linhasAtivas = Object.values(linhasSelecionadas).filter(l => l !== null);
  const temTrinca = temColuna && linhasAtivas.length === 3;

  // reset visual
  [btnTrue, btnFalse, btnMaybe, btnClear].forEach(btn => {
    if (!btn) return;
    btn.classList.add("botao-desativado");
  });

  // modo célula única
  if (temCelula) {
    btnTrue?.classList.remove("botao-desativado");
    btnFalse?.classList.remove("botao-desativado");
    btnMaybe?.classList.remove("botao-desativado");
    btnClear?.classList.remove("botao-desativado");
    return;
  }

  // modo trinca - X marca todas como nao mostradas; ? cria grupo de resposta
  if (temTrinca) {
    btnFalse?.classList.remove("botao-desativado");
    btnMaybe?.classList.remove("botao-desativado");
    btnClear?.classList.remove("botao-desativado");
  }
}

function renderizarEstado(cel, estado) {

  cel.innerHTML = "";

  // Polish A: classe na celula reflete estado pra tint de fundo via CSS.
  // Remove classes antigas e aplica a correta (ou nenhuma).
  cel.classList.remove("celula-v", "celula-x", "celula-duvida");

  if (estado === "V") {
    cel.classList.add("celula-v");
    cel.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24" class="estado-icon estado-check check-anim" aria-hidden="true">        <path class="estado-traco" d="M7.2 12.3L10.4 15.5L16.9 8.7"></path>
      </svg>
    `;
  }

  if (estado === "X") {
    cel.classList.add("celula-x");
    cel.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24" class="estado-icon estado-x x-anim" aria-hidden="true">        <path class="estado-traco" d="M8 8L16 16"></path>
        <path class="estado-traco" d="M16 8L8 16"></path>
      </svg>
    `;
  }

  if (estado === "?") {
    cel.classList.add("celula-duvida");
    cel.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24" class="estado-icon estado-duvida q-anim" aria-hidden="true">        <path class="estado-traco" d="M9.2 9.2A2.9 2.9 0 0112 7.6A2.85 2.85 0 0114.8 10.5C14.8 12.2 12.8 12.5 12 13.8"></path>
        <circle class="estado-ponto" cx="12" cy="16.8" r="1.2"></circle>
      </svg>
    `;
  }
}

function aplicarTrincaX() {

  const jogadores = parseInt(localStorage.getItem("numJogadores") || 3);
  const estadoSalvo = lerEstadoTabela();

  const linhasAtivas = Object.values(linhasSelecionadas).filter(l => l !== null);

  if (colunaSelecionada === null || linhasAtivas.length !== 3) {
    return;
  }

  // 🔹 Atualiza apenas as 3 células visuais
  linhasAtivas.forEach(linha => {

    const chave = `${linha}-${colunaSelecionada}`;

    if (estadoSalvo[chave] !== "V") {
      estadoSalvo[chave] = "X";

      const cel = document.querySelector(`[data-key="${chave}"]`);
      if (cel) {
     renderizarEstado(cel, "X");
     cel.style.animationDelay = `${Math.random() * 0.8}s`;      }
    }

  });

  localStorage.setItem("estadoTabela", JSON.stringify(estadoSalvo));

  // 🔹 Avança coluna
  colunaSelecionada++;

  if (colunaSelecionada >= jogadores) {
    colunaSelecionada = 0;
  }

  // 🔹 Atualiza apenas os destaques (SEM recriar tabela)
  atualizarEstadoVisualCartasEncontradas();
  atualizarDestaqueCartaOculta();
  atualizarAlertaDuplicidadePRO();
  atualizarDestaques();
  atualizarBotoes();
  atualizarBotaoContinuar();
  if (typeof agendarAtualizacaoAssistenteIA === "function") {
    agendarAtualizacaoAssistenteIA();
  } else if (typeof atualizarAssistenteIA === "function") {
    atualizarAssistenteIA();
  }
}

// ============================================================================
// TRINCA DE ? : aplicarTrincaResposta
// ============================================================================
// Acionada quando temColuna && linhasAtivas.length === 3 e usuario clica ?.
// Representa: "jogador da coluna mostrou UMA destas 3 cartas".
//
// 4 cenarios (do mais resolvido ao menos):
// 1. Trinca ja resolvida (alguma das 3 ja tem V) -> nao faz nada
// 2. Sem candidatas (todas as 3 ja sao X ou V) -> sem nova info
// 3. Apenas 1 candidata -> colapsa para V (grupo OR com 1 opcao)
// 4. 2 ou 3 candidatas -> cria grupo + marca como "?" com origem grupo
function aplicarTrincaResposta() {
  const jogadores = parseInt(localStorage.getItem("numJogadores") || "3", 10);
  const estadoSalvo = lerEstadoTabela();
  const linhasAtivas = Object.values(linhasSelecionadas).filter((l) => l !== null);

  if (colunaSelecionada === null || linhasAtivas.length !== 3) {
    return;
  }

  const col = colunaSelecionada;
  const chaves = linhasAtivas.map((linha) => ({
    chave: `${linha}-${col}`,
    row: linha,
  }));

  // Filtra candidatas (nao V e nao X) - sao as celulas que podem virar "?"
  const candidatas = chaves.filter((c) => {
    const v = estadoSalvo[c.chave] || "";
    return v !== "V" && v !== "X";
  });
  const algumV = chaves.some((c) => estadoSalvo[c.chave] === "V");

  // Cenario A: nenhuma candidata - todas ja sao V/X, so avanca coluna
  if (candidatas.length === 0) {
    avancarColunaTrinca(jogadores);
    if (typeof agendarAtualizacaoAssistenteIA === "function") {
      agendarAtualizacaoAssistenteIA();
    }
    return;
  }

  // Cenario B: 1 candidata SEM V no resto -> colapsa para V (outros sao X)
  if (candidatas.length === 1 && !algumV) {
    const cel = document.querySelector(`[data-key="${candidatas[0].chave}"]`);
    if (cel) {
      marcarCelula(cel, "V", false, "assistente");
      if (typeof registrarMudancaAssistenteIA === "function") {
        const nomeJog = localStorage.getItem(`nomeJogador${col + 1}`) || `J${col + 1}`;
        const nomeCarta =
          Array.isArray(cartas) && cartas[candidatas[0].row]
            ? cartas[candidatas[0].row].nome
            : null;
        if (nomeCarta) {
          registrarMudancaAssistenteIA({
            tipo: "auto-grupo-resposta",
            jogador: nomeJog,
            col, // IA-043: usado pra suprimir narracao do J1
            carta: nomeCarta,
          });
        }
      }
    }
    avancarColunaTrinca(jogadores);
    return;
  }

  // Cenario C: 1 candidata MAS ja existe V no resto -> nao colapsar (criaria
  // 2o V na coluna - inconsistente). So marca a candidata como "?" sem grupo.
  // Permite ao usuario seguir registrando a duvida visual.
  if (candidatas.length === 1 && algumV) {
    const c = candidatas[0];
    estadoSalvo[c.chave] = "?";
    const cel = document.querySelector(`[data-key="${c.chave}"]`);
    if (cel) renderizarEstado(cel, "?");
    if (typeof registrarOrigemDuvidaManual === "function") {
      registrarOrigemDuvidaManual(c.chave);
    }
    localStorage.setItem("estadoTabela", JSON.stringify(estadoSalvo));

    avancarColunaTrinca(jogadores);
    atualizarEstadoVisualCartasEncontradas();
    atualizarDestaqueCartaOculta();
    atualizarAlertaDuplicidadePRO();
    atualizarDestaques();
    atualizarBotoes();
    atualizarBotaoContinuar();
    if (typeof agendarAtualizacaoAssistenteIA === "function") {
      agendarAtualizacaoAssistenteIA();
    }
    return;
  }

  // Cenario D: 2 ou 3 candidatas - cria grupo e marca como "?" com origem grupo
  // (algumV ou nao - se algumV, o grupo so contem as nao-V; o V permanece V)
  const grupoId = `grupo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const novoGrupo = {
    id: grupoId,
    coluna: col,
    rows: candidatas.map((c) => c.row),
    timestamp: Date.now(),
  };

  const grupos =
    typeof obterGruposResposta === "function" ? obterGruposResposta() : [];
  grupos.push(novoGrupo);
  if (typeof salvarGruposResposta === "function") {
    salvarGruposResposta(grupos);
  }

  // Marca as candidatas como "?" e registra origem grupo
  candidatas.forEach((c) => {
    estadoSalvo[c.chave] = "?";
    const cel = document.querySelector(`[data-key="${c.chave}"]`);
    if (cel) renderizarEstado(cel, "?");
    if (typeof registrarOrigemDuvidaGrupo === "function") {
      registrarOrigemDuvidaGrupo(c.chave, grupoId);
    }
  });

  localStorage.setItem("estadoTabela", JSON.stringify(estadoSalvo));

  avancarColunaTrinca(jogadores);

  // Atualiza todos os destaques (SEM recriar tabela)
  atualizarEstadoVisualCartasEncontradas();
  atualizarDestaqueCartaOculta();
  atualizarAlertaDuplicidadePRO();
  atualizarDestaques();
  atualizarBotoes();
  atualizarBotaoContinuar();
  if (typeof agendarAtualizacaoAssistenteIA === "function") {
    agendarAtualizacaoAssistenteIA();
  }
}

function avancarColunaTrinca(jogadores) {
  colunaSelecionada++;
  if (colunaSelecionada >= jogadores) {
    colunaSelecionada = 0;
  }
}

// IA-019: aplica destaque temporario (2500ms) em celulas/coluna/linhas
// associadas a uma inconsistencia. Chamado pelo onclick dos botoes
// gerados em formatarInconsistenciasAssistenteIA.
let timerFocoInconsistenciaAssistenteIA = null;

function aplicarFocoInconsistenciaAssistenteIA(focoJSON) {
  // Fecha o menu lateral pra que a tabela fique visivel quando o foco aplicar
  if (typeof resetarMenu === "function") {
    resetarMenu();
  }

  // Limpa qualquer foco anterior
  document
    .querySelectorAll(".assistente-foco-inconsistencia")
    .forEach((el) => el.classList.remove("assistente-foco-inconsistencia"));
  if (timerFocoInconsistenciaAssistenteIA) {
    clearTimeout(timerFocoInconsistenciaAssistenteIA);
    timerFocoInconsistenciaAssistenteIA = null;
  }

  if (!focoJSON) return;

  let foco;
  try {
    foco = JSON.parse(focoJSON);
  } catch {
    return;
  }
  if (!foco || typeof foco !== "object") return;

  let alvos = [];
  if (foco.tipo === "celulas" && Array.isArray(foco.chaves)) {
    foco.chaves.forEach((chave) => {
      const el = document.querySelector(`#tabela [data-key="${chave}"]`);
      if (el) alvos.push(el);
    });
  } else if (foco.tipo === "coluna" && Number.isInteger(foco.coluna)) {
    alvos = Array.from(
      document.querySelectorAll(`#tabela [data-col="${foco.coluna}"][data-key]`),
    );
  } else if (foco.tipo === "linhas" && Array.isArray(foco.rows)) {
    foco.rows.forEach((row) => {
      document
        .querySelectorAll(`#tabela [data-row="${row}"][data-key]`)
        .forEach((el) => alvos.push(el));
    });
  }

  if (alvos.length === 0) return;

  // Scroll para o primeiro alvo se estiver fora da viewport
  if (alvos[0].scrollIntoView) {
    alvos[0].scrollIntoView({ behavior: "smooth", block: "center" });
  }

  alvos.forEach((el) => el.classList.add("assistente-foco-inconsistencia"));

  timerFocoInconsistenciaAssistenteIA = setTimeout(() => {
    document
      .querySelectorAll(".assistente-foco-inconsistencia")
      .forEach((el) => el.classList.remove("assistente-foco-inconsistencia"));
    timerFocoInconsistenciaAssistenteIA = null;
  }, 2500);
}
