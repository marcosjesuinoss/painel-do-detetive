// IA-038: setup do Vitest pra carregar o motor logico do assistente IA
// sem depender de refator pra ES6 modules.
//
// Estrategia: definir mocks minimos das dependencias externas que o
// assistente-ia.js precisa, e carregar o arquivo via eval no global da
// JSDOM. As funcoes ficam disponiveis em todos os testes via globalThis.

import fs from "node:fs";
import path from "node:path";
import { beforeEach } from "vitest";

// =========================================================================
// MOCKS DE DEPENDENCIAS EXTERNAS
// =========================================================================

// PRO ativo - assistente so roda em PRO. Pra testes, ligamos sempre.
globalThis.isPRO = () => true;
globalThis.temAcessoAIA = () => true;

// getEl: motor usa pra estrutura dos cards. Em testes nao temos DOM real
// (so JSDOM minima). Retornamos um elemento dummy quando solicitado.
globalThis.getEl = (id) => {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    document.body.appendChild(el);
  }
  return el;
};

// marcarCelula: em produção mexe no DOM + localStorage. Pra testes,
// soh atualizamos o estadoTabela em localStorage.
globalThis.marcarCelula = (cel, tipo, _modoTrinca = false, _origem = "manual") => {
  if (!cel || !cel.dataset) return;
  const chave = cel.dataset.key;
  if (!chave) return;
  let estado = {};
  try {
    estado = JSON.parse(localStorage.getItem("estadoTabela") || "{}");
  } catch {}
  if (tipo === "" || tipo == null) {
    delete estado[chave];
  } else {
    estado[chave] = tipo;
  }
  localStorage.setItem("estadoTabela", JSON.stringify(estado));
};

// document.querySelector pra [data-key="X-Y"]: motor usa pra achar celula
// e passar pra marcarCelula. Em testes, sintetizamos elementos com dataset.
const originalQuerySelector = document.querySelector.bind(document);
document.querySelector = (selector) => {
  const m = selector.match(/^\[data-key="(\d+-\d+)"\]$/);
  if (m) {
    const chave = m[1];
    const [row, col] = chave.split("-").map(Number);
    const el = document.createElement("div");
    el.dataset.key = chave;
    el.dataset.row = String(row);
    el.dataset.col = String(col);
    return el;
  }
  return originalQuerySelector(selector);
};

// Utils basicos
globalThis.ler = (chave) => localStorage.getItem(chave);
globalThis.salvar = (chave, valor) => localStorage.setItem(chave, valor);

// Funcoes opcionais que o motor pode chamar com `if (typeof X === "function")`
// - Definimos como undefined pra esses checks defensivos pularem.
// (renderizarEstado, atualizarDestaques, agendarAtualizacaoAssistenteIA,
//  registrarMudancaAssistenteIA - este ultimo eh do proprio motor entao
//  sera redefinido quando carregar o arquivo)

// =========================================================================
// CARREGA O MOTOR
// =========================================================================

const ROOT = path.resolve(__dirname, "..");
const assistenteCode = fs.readFileSync(
  path.join(ROOT, "js", "assistente-ia.js"),
  "utf8",
);

// Eval no escopo global. Funcoes top-level ficam em globalThis.
// Usamos indirect eval (0, eval) pra rodar em global scope.
(0, eval)(assistenteCode);

// =========================================================================
// HELPERS DE TESTE
// =========================================================================

/**
 * Reseta localStorage + estado em-memoria entre testes pra evitar
 * contaminacao cruzada.
 */
function resetarEstadoAssistenteIA() {
  localStorage.clear();
  // Reset estado em-memoria do motor
  if (typeof pendenciasMarcacaoAssistenteIA !== "undefined") {
    pendenciasMarcacaoAssistenteIA.length = 0;
  }
  if (typeof ultimoHashRenderAssistenteIA !== "undefined") {
    globalThis.ultimoHashRenderAssistenteIA = null;
  }
  if (typeof invalidarSnapshotAssistenteIA === "function") {
    invalidarSnapshotAssistenteIA();
  }
}
globalThis.resetarEstadoAssistenteIA = resetarEstadoAssistenteIA;

/**
 * Popula globalThis.cartas com layout padrao: 3 Suspeitos, 3 Armas, 3 Locais.
 * Total 9 linhas (3+3+3). Suficiente pra testes de deducao.
 *
 * Indices:
 *   0,1,2 = Suspeitos (Marco, Bruno, Carlos)
 *   3,4,5 = Armas (Faca, Pistola, Corda)
 *   6,7,8 = Locais (Cozinha, Sala, Hospital)
 */
function popularCartasPadrao() {
  globalThis.cartas = [
    { tipo: "Suspeitos", nome: "Marco" },
    { tipo: "Suspeitos", nome: "Bruno" },
    { tipo: "Suspeitos", nome: "Carlos" },
    { tipo: "Armas", nome: "Faca" },
    { tipo: "Armas", nome: "Pistola" },
    { tipo: "Armas", nome: "Corda" },
    { tipo: "Locais", nome: "Cozinha" },
    { tipo: "Locais", nome: "Sala" },
    { tipo: "Locais", nome: "Hospital" },
  ];
}
globalThis.popularCartasPadrao = popularCartasPadrao;

/**
 * Configura partida basica em localStorage.
 * @param {number} numJogadores - quantos jogadores (3-8)
 * @param {number[]} cartasPorJogador - distribuicao (deve somar 9 com 9 cartas)
 */
function configurarPartida(numJogadores, cartasPorJogador) {
  localStorage.setItem("numJogadores", String(numJogadores));
  if (cartasPorJogador) {
    localStorage.setItem(
      "assistenteCartasPorJogador",
      JSON.stringify(cartasPorJogador),
    );
  }
  // Config padrao do assistente: sugestoes + automarcacao on + objetiva
  localStorage.setItem(
    "assistenteIAConfiguracoes",
    JSON.stringify({
      sugestoes: true,
      automarcacao: true,
      nivelExplicacao: "objetiva",
    }),
  );
}
globalThis.configurarPartida = configurarPartida;

/**
 * Define estado da tabela direto via objeto { "row-col": "V"|"X"|"?" }
 */
function definirEstadoTabela(estado) {
  localStorage.setItem("estadoTabela", JSON.stringify(estado || {}));
}
globalThis.definirEstadoTabela = definirEstadoTabela;

/**
 * Le estado atual da tabela apos uma deducao.
 */
function lerEstadoTabelaTeste() {
  try {
    return JSON.parse(localStorage.getItem("estadoTabela") || "{}");
  } catch {
    return {};
  }
}
globalThis.lerEstadoTabelaTeste = lerEstadoTabelaTeste;

// Reseta entre cada teste
beforeEach(() => {
  resetarEstadoAssistenteIA();
  popularCartasPadrao();
});
