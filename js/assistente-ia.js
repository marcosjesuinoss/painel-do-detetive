function obterEstadoTabelaAssistenteIA() {
  try {
    return JSON.parse(localStorage.getItem("estadoTabela") || "{}");
  } catch {
    return {};
  }
}

function obterNumeroJogadoresAssistenteIA() {
  return parseInt(localStorage.getItem("numJogadores") || "3", 10);
}

function obterNomeJogadorAssistenteIA(coluna) {
  return localStorage.getItem(`nomeJogador${coluna + 1}`) || `J${coluna + 1}`;
}

function obterCartasPorJogadorAssistenteIA() {
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
    porTipo,
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

          if (valor !== "X") {
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

  const ids = ["iaResumoMudancas", "iaProximaSugestao", "iaConfiancaAssistente"];

  cards.forEach((card, index) => {
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

function atualizarAssistenteIA() {
  try {
    if (typeof isPRO === "function" && !isPRO()) return;
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
      return;
    }

    deduzirCartasPorCapacidadeAssistenteIA();

    const linhas = obterLinhasAssistenteIA();
    const resumo = montarResumoLinhasAssistenteIA(linhas);
    const mudancas = construirMudancasAssistenteIA(linhas, resumo);
    const sugestao = construirSugestaoAssistenteIA(resumo, linhas);
    const confianca = calcularConfiancaAssistenteIA(sugestao.escolhas);
    const dicasCapacidade = construirDicasCapacidadeAssistenteIA(linhas);

    estrutura.resumo.innerHTML = formatarListaAssistenteIA(mudancas);
    estrutura.sugestao.innerHTML = formatarListaAssistenteIA(sugestao.itens);
    estrutura.confianca.innerHTML = formatarListaAssistenteIA([
      `N\u00edvel atual: ${confianca.nivel}.`,
      ...confianca.detalhes,
      ...dicasCapacidade,
    ]);
  } catch (erro) {
    console.error("Assistente IA falhou ao atualizar.", erro);
  }
}
