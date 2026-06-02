/* =====================================
   JOGADORES
===================================== */

function obterLimiteNomeJogador(numJogadores) {
  const num = parseInt(numJogadores, 10);

  if (num === 3) return 7;
  if (num === 4) return 6;
  if (num === 5) return 5;

  return 4;
}

function restaurarNomesPadraoJogadores() {
  for (let i = 1; i <= 8; i++) {
    const chave = "nomeJogador" + i;
    salvar(chave, "");
  }
}

function limparConfiguracaoDistribuicaoCartas() {
  localStorage.removeItem("assistenteCartasPorJogador");
  localStorage.removeItem("assistenteJogadoresMaisCartas");
}

// interacaoUsuario=true so quando chamado pelos onchange dos selects
// (usuario trocou versao/qtd). Na inicializacao do app eh chamado SEM
// esse flag - assim NAO reseta os nomes/distribuicao de um jogo em
// andamento ao reabrir o app (o select volta ao padrao e isso disparava
// restaurarNomesPadraoJogadores indevidamente).
function atualizarJogadores(interacaoUsuario = false) {
  const elVersao = getEl("versao");
  const select = getEl("jogadores");
  if (!elVersao || !select) return;

  const versaoSelecionada = elVersao.value;
  const v = versoes[versaoSelecionada];
  const atual = parseInt(select.value);
  select.innerHTML = "";

  for (let i = v.min; i <= v.max; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${i} jogadores`;
    select.appendChild(opt);
  }

  if (atual >= v.min && atual <= v.max) {
    select.value = atual;
  }

  const quantidadeAtual = String(select.value);
  const quantidadeAnterior = ler("numJogadoresPersonalizacao");

  if (
    interacaoUsuario &&
    quantidadeAnterior &&
    quantidadeAnterior !== quantidadeAtual
  ) {
    restaurarNomesPadraoJogadores();
    limparConfiguracaoDistribuicaoCartas();
  }

  // So persiste a nova quantidade quando foi o usuario que mexeu. Na
  // inicializacao, preservar o valor salvo (do jogo em andamento).
  if (interacaoUsuario) {
    salvar("numJogadoresPersonalizacao", quantidadeAtual);
  }
}

function abrirPersonalizar() {
  const selectJogadores = getEl("jogadores");
  const areaJog = getEl("editarJogadores");
  if (!selectJogadores || !areaJog) return;

  const num = selectJogadores.value;
  const limiteNome = obterLimiteNomeJogador(num);
  areaJog.innerHTML = "";

  for (let i = 1; i <= num; i++) {
    const input = document.createElement("input");
    input.maxLength = limiteNome;
    input.placeholder = "J" + i;
    input.value = (ler("nomeJogador" + i) || "").slice(0, limiteNome);
    salvar("nomeJogador" + i, input.value);

    input.oninput = function () {
      input.value = input.value.slice(0, limiteNome);
      salvar("nomeJogador" + i, input.value);
    };

    areaJog.appendChild(input);
  }

  mostrarTela("personalizar");
}
