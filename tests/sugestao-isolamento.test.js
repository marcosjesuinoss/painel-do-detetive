// IA-046: testes da sugestao por GANHO DE INFORMACAO + tatica de isolamento
// (trancar categorias com cartas mortas) + ordem de turno.
//
// Funcoes cobertas:
//   - ehCartaMortaAssistenteIA(linha, envelopeRows)
//   - valorPalpiteAssistenteIA(named, jogadores, envelopeRows)
//   - construirSugestaoAssistenteIA(resumo, linhas): nova logica de palpite

import { describe, it, expect } from "vitest";

function obterSugestao() {
  let resultado;
  executarComCacheAssistenteIA(() => {
    const linhas = obterLinhasAssistenteIA();
    const resumo = montarResumoLinhasAssistenteIA(linhas);
    resultado = construirSugestaoAssistenteIA(resumo, linhas);
  });
  return resultado;
}

function setarNivelExplicacao(nivel) {
  const cfg = JSON.parse(
    localStorage.getItem("assistenteIAConfiguracoes") || "{}",
  );
  cfg.nivelExplicacao = nivel;
  localStorage.setItem("assistenteIAConfiguracoes", JSON.stringify(cfg));
}

// Constroi uma "linha" minima (como obterLinhasAssistenteIA produz).
function linha(row, tipo, nome, estados) {
  return {
    row,
    tipo,
    nome,
    estados,
    xCount: estados.filter((v) => v === "X").length,
    maybeCount: estados.filter((v) => v === "?").length,
    isFound: estados.some((v) => v === "V"),
    isAllX: estados.every((v) => v === "X"),
    candidatos: estados
      .map((valor, col) => ({ valor, col }))
      .filter((item) => item.valor !== "X"),
  };
}

describe("ehCartaMortaAssistenteIA", () => {
  it("carta da mao de J1 (V na coluna 0) e morta", () => {
    const c = linha(0, "Suspeitos", "Marco", ["V", "", ""]);
    expect(ehCartaMortaAssistenteIA(c, new Set())).toBe(true);
  });

  it("carta do envelope (row em envelopeRows) e morta", () => {
    const c = linha(5, "Armas", "Corda", ["X", "X", "X"]);
    expect(ehCartaMortaAssistenteIA(c, new Set([5]))).toBe(true);
  });

  it("carta que um oponente tem (V em outra coluna) NAO e morta", () => {
    const c = linha(0, "Suspeitos", "Marco", ["", "V", ""]);
    expect(ehCartaMortaAssistenteIA(c, new Set())).toBe(false);
  });
});

describe("valorPalpiteAssistenteIA", () => {
  it("palpite absorvido por carta conhecida de oponente -> score negativo", () => {
    // suspeito e arma da mao de J1 (mortas), local que J2 JA TEM (V col1).
    // J2 mostraria o local conhecido -> palpite inutil.
    const named = [
      linha(0, "Suspeitos", "Marco", ["V", "", ""]),
      linha(3, "Armas", "Faca", ["V", "", ""]),
      linha(6, "Locais", "Cozinha", ["", "V", ""]),
    ];
    const { score } = valorPalpiteAssistenteIA(named, 3, new Set());
    expect(score).toBeLessThan(0);
  });

  it("mais trancas pontua mais que menos trancas", () => {
    const morta = (row, tipo, nome) => linha(row, tipo, nome, ["V", "", ""]);
    const viva = (row, tipo, nome) => linha(row, tipo, nome, ["", "", ""]);

    const duasTrancas = [
      morta(0, "Suspeitos", "Marco"),
      morta(3, "Armas", "Faca"),
      viva(6, "Locais", "Cozinha"),
    ];
    const umaTranca = [
      viva(1, "Suspeitos", "Bruno"),
      morta(3, "Armas", "Faca"),
      viva(6, "Locais", "Cozinha"),
    ];

    const a = valorPalpiteAssistenteIA(duasTrancas, 3, new Set());
    const b = valorPalpiteAssistenteIA(umaTranca, 3, new Set());
    expect(a.score).toBeGreaterThan(b.score);
  });
});

describe("construirSugestaoAssistenteIA - isolamento", () => {
  it("tranca as cartas da mao de J1 e investiga a categoria aberta", () => {
    configurarPartida(3, [3, 3, 3]);
    // J1 tem Marco (suspeito) e Faca (arma). Locais todos com J2 descartado.
    definirEstadoTabela({
      "0-0": "V", // J1 tem Marco
      "3-0": "V", // J1 tem Faca
      "6-1": "X",
      "7-1": "X",
      "8-1": "X",
    });

    const sug = obterSugestao();
    // Tranca = cartas da mao; probe = um local.
    expect(sug.escolhas[0].nome).toBe("Marco");
    expect(sug.escolhas[1].nome).toBe("Faca");
    expect(sug.escolhas[2].tipo).toBe("Locais");
  });

  it("nunca sugere uma carta que um oponente conhecido possui", () => {
    configurarPartida(3, [3, 3, 3]);
    definirEstadoTabela({ "0-1": "V" }); // J2 tem Marco

    const sug = obterSugestao();
    expect(sug.escolhas.every((c) => c.nome !== "Marco")).toBe(true);
  });

  it("varia a categoria investigada entre estados empatados", () => {
    const mao = ["Marco", "Faca", "Cozinha"]; // J1 tem 1 carta por categoria
    const probeTipo = (sug) =>
      sug.escolhas.find((c) => !mao.includes(c.nome)).tipo;

    // Estado A: 3 marcacoes (so a mao) -> offset 0 -> investiga suspeitos.
    configurarPartida(3, [3, 3, 3]);
    definirEstadoTabela({ "0-0": "V", "3-0": "V", "6-0": "V" });
    const sugA = obterSugestao();

    // Estado B: 4 marcacoes (mao + 1 X que nao quebra o empate) -> offset 1.
    resetarEstadoAssistenteIA();
    popularCartasPadrao();
    configurarPartida(3, [3, 3, 3]);
    definirEstadoTabela({ "0-0": "V", "3-0": "V", "6-0": "V", "1-1": "X" });
    const sugB = obterSugestao();

    expect(probeTipo(sugA)).not.toBe(probeTipo(sugB));
  });

  it("explica a ordem de turno: oponente descartado passa, proximo responde", () => {
    configurarPartida(4, [3, 3, 3]);
    setarNivelExplicacao("explicativa");
    definirEstadoTabela({
      "0-0": "V", // J1 tem Marco (tranca)
      "3-0": "V", // J1 tem Faca (tranca)
      "6-1": "X", // J2 nao tem Cozinha
      "7-1": "X",
      "8-1": "X",
    });

    const sug = obterSugestao();
    const texto = sug.itens.join(" ");
    expect(texto).toMatch(/Tranquei/);
    expect(texto).toMatch(/sua carta/);
    // J2 ja descartado do local -> resposta vem de J3 em diante.
    expect(texto).toMatch(/J2 já não tem/);
    expect(texto).toMatch(/J3 em diante/);
  });
});
