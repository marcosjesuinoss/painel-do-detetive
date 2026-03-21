let celulaSelecionada = null;
let colunaSelecionada = null;
let linhasSelecionadas = {
  Suspeitos: null,
  Armas: null,
  Locais: null
};

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

  const area = document.getElementById("tabela");
  area.innerHTML = "";

  const estadoSalvo = JSON.parse(localStorage.getItem("estadoTabela") || "{}");
  const template = `31% repeat(${jogadores}, 1fr)`;

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
  if (typeof atualizarAssistenteIA === "function") {
    atualizarAssistenteIA();
  }
}

function atualizarCor(td, estado) {
  td.classList.remove("ok", "no", "maybe");

  if (estado === "✔") td.classList.add("ok");
  if (estado === "✖") td.classList.add("no");
  if (estado === "?") td.classList.add("maybe");
}

function marcarCelula(cel, tipo, modoTrinca = false) {
  if (!cel) return;

  const chave = cel.dataset.key;
  const row = cel.dataset.row;
  const estadoSalvo = JSON.parse(localStorage.getItem("estadoTabela") || "{}");
  const autoXChaves = new Set();

  if (tipo === "V") {
    estadoSalvo[chave] = "V";

    // marcar resto da linha como X automaticamente
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

  if (tipo === "X") {

  // Se for marcação da trinca e já for V, NÃO altera
  if (modoTrinca && estadoSalvo[chave] === "V") {
    return;
  }

  estadoSalvo[chave] = "X";
}

  if (tipo === "?") {
    estadoSalvo[chave] = "?";
  }

if (tipo === "") {
  delete estadoSalvo[chave];
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
  if (typeof atualizarAssistenteIA === "function") {
    atualizarAssistenteIA();
  }
}

function atualizarEstadoVisualCartasEncontradas() {
  const estadoSalvo = JSON.parse(localStorage.getItem("estadoTabela") || "{}");
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
  const estadoSalvo = JSON.parse(localStorage.getItem("estadoTabela") || "{}");

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

  const estadoSalvo = JSON.parse(localStorage.getItem("estadoTabela") || "{}");
  const porLinha = {};

  Object.entries(estadoSalvo).forEach(([chave, estado]) => {
    if (estado !== "V") return;

    const partes = chave.split("-");
    const row = partes[0];

    if (!porLinha[row]) {
      porLinha[row] = [];
    }

    porLinha[row].push(chave);
  });

  Object.values(porLinha).forEach((chavesDaLinha) => {
    if (chavesDaLinha.length < 2) return;

    chavesDaLinha.forEach((chave) => {
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

  // modo trinca
  if (temTrinca) {
    btnFalse?.classList.remove("botao-desativado");
    btnClear?.classList.remove("botao-desativado");
  }
}

function renderizarEstado(cel, estado) {

  cel.innerHTML = "";

  if (estado === "V") {
    cel.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24" class="estado-icon estado-check check-anim" aria-hidden="true">        <path class="estado-traco" d="M7.2 12.3L10.4 15.5L16.9 8.7"></path>
      </svg>
    `;
  }

  if (estado === "X") {
    cel.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24" class="estado-icon estado-x x-anim" aria-hidden="true">        <path class="estado-traco" d="M8 8L16 16"></path>
        <path class="estado-traco" d="M16 8L8 16"></path>
      </svg>
    `;
  }

  if (estado === "?") {
    cel.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24" class="estado-icon estado-duvida q-anim" aria-hidden="true">        <path class="estado-traco" d="M9.2 9.2A2.9 2.9 0 0112 7.6A2.85 2.85 0 0114.8 10.5C14.8 12.2 12.8 12.5 12 13.8"></path>
        <circle class="estado-ponto" cx="12" cy="16.8" r="1.2"></circle>
      </svg>
    `;
  }
}

function aplicarTrincaX() {

  const jogadores = parseInt(localStorage.getItem("numJogadores") || 3);
  const estadoSalvo = JSON.parse(localStorage.getItem("estadoTabela") || "{}");

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
  if (typeof atualizarAssistenteIA === "function") {
    atualizarAssistenteIA();
  }
}
