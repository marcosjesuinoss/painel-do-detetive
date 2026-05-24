// IA-038: testes pro calculo de confianca + construcao de sugestoes
//
// Funcoes cobertas:
//   - calcularConfiancaAssistenteIA(escolhas): retorna { nivel, detalhes }
//     com nivel em { Alta, Media, Baixa }
//   - construirSugestaoAssistenteIA(resumo, linhas): retorna { itens, escolhas }
//     - branches: acusacao final, tripla forte, exploratoria
//     - modos: objetiva (default), explicativa, detalhada
//   - construirRaciocinioDetalhadoAssistenteIA(escolhas): retorna itens do
//     card "Raciocinio detalhado" (so quando nivel detalhada)

import { describe, it, expect } from "vitest";

// Helper: monta resumo+linhas dentro de cache e retorna sugestao
function obterSugestao() {
  let resultado;
  executarComCacheAssistenteIA(() => {
    const linhas = obterLinhasAssistenteIA();
    const resumo = montarResumoLinhasAssistenteIA(linhas);
    resultado = construirSugestaoAssistenteIA(resumo, linhas);
  });
  return resultado;
}

// Helper: troca nivel de explicacao em runtime
function setarNivelExplicacao(nivel) {
  const cfg = JSON.parse(
    localStorage.getItem("assistenteIAConfiguracoes") || "{}",
  );
  cfg.nivelExplicacao = nivel;
  localStorage.setItem("assistenteIAConfiguracoes", JSON.stringify(cfg));
}

describe("calcularConfiancaAssistenteIA", () => {
  it("retorna Baixa quando alguma escolha eh null", () => {
    const result = calcularConfiancaAssistenteIA([
      { score: 100 },
      null,
      { score: 100 },
    ]);
    expect(result.nivel).toBe("Baixa");
    expect(result.detalhes[0]).toMatch(/faltam dados/i);
  });

  it("retorna Alta quando totalScore >= 220", () => {
    const result = calcularConfiancaAssistenteIA([
      { score: 100 },
      { score: 100 },
      { score: 25 },
    ]);
    expect(result.nivel).toBe("Alta");
  });

  it("retorna Media quando 120 <= totalScore < 220", () => {
    const result = calcularConfiancaAssistenteIA([
      { score: 50 },
      { score: 50 },
      { score: 30 },
    ]);
    expect(result.nivel).toBe("Media");
  });

  it("retorna Baixa quando totalScore < 120", () => {
    const result = calcularConfiancaAssistenteIA([
      { score: 30 },
      { score: 30 },
      { score: 30 },
    ]);
    expect(result.nivel).toBe("Baixa");
  });
});

describe("construirSugestaoAssistenteIA - branches principais", () => {
  it("acusacao final: 3 ocultas direta -> 'Crime solucionado'", () => {
    configurarPartida(3, [3, 3, 3]);
    // Marca toda-X em uma carta de cada secao:
    // Marco (Suspeito), Faca (Arma), Cozinha (Local)
    definirEstadoTabela({
      "0-0": "X", "0-1": "X", "0-2": "X", // Marco - oculta
      "3-0": "X", "3-1": "X", "3-2": "X", // Faca - oculta
      "6-0": "X", "6-1": "X", "6-2": "X", // Cozinha - oculta
    });

    const sug = obterSugestao();
    expect(sug.itens[0]).toMatch(/Crime solucionado/i);
    expect(sug.itens[0]).toContain("Marco");
    expect(sug.itens[0]).toContain("Faca");
    expect(sug.itens[0]).toContain("Cozinha");
  });

  it("tripla forte: cabecalho 'Sugestao:' em modo objetiva (default)", () => {
    configurarPartida(3, [3, 3, 3]);
    // Marca varios X pra gerar candidatos com score
    definirEstadoTabela({
      "0-0": "X", "0-1": "X",
      "3-0": "X", "3-1": "X",
      "6-0": "X", "6-1": "X",
    });

    const sug = obterSugestao();
    expect(sug.itens[0]).toMatch(/^Sugest/i);
    expect(sug.escolhas).toHaveLength(3);
  });

  it("tripla forte em modo explicativa: cabecalho 'Pergunta sugerida:'", () => {
    configurarPartida(3, [3, 3, 3]);
    setarNivelExplicacao("explicativa");
    definirEstadoTabela({
      "0-0": "X", "0-1": "X",
      "3-0": "X", "3-1": "X",
      "6-0": "X", "6-1": "X",
    });

    const sug = obterSugestao();
    expect(sug.itens[0]).toMatch(/Pergunta sugerida:/);
  });

  it("sugestao exploratoria com pouca evidencia", () => {
    configurarPartida(3, [3, 3, 3]);
    // Sem marcacoes -> nada conclusivo
    definirEstadoTabela({});

    const sug = obterSugestao();
    // Pode ser exploratoria ou "ainda nao ha dados"
    expect(sug.itens[0]).toMatch(/Sugest|ainda n|abrir o jogo/i);
  });
});

describe("construirRaciocinioDetalhadoAssistenteIA", () => {
  it("retorna 3 itens formatados 'Tipo (Nome): ...' quando escolhas presentes", () => {
    configurarPartida(3, [3, 3, 3]);
    setarNivelExplicacao("detalhada");
    definirEstadoTabela({
      "0-0": "X", "0-1": "X",
      "3-0": "X", "3-1": "X",
      "6-0": "X", "6-1": "X",
    });

    const sug = obterSugestao();
    const itens = construirRaciocinioDetalhadoAssistenteIA(sug.escolhas);

    expect(itens).toHaveLength(3);
    expect(itens[0]).toMatch(/^Suspeito \(.+\):/);
    expect(itens[1]).toMatch(/^Arma \(.+\):/);
    expect(itens[2]).toMatch(/^Local \(.+\):/);
    // Sem jargao de camada (IA-041 polish)
    itens.forEach((item) => {
      expect(item).not.toMatch(/camada/i);
    });
  });

  it("retorna array vazio quando todas as escolhas sao null", () => {
    const itens = construirRaciocinioDetalhadoAssistenteIA([null, null, null]);
    expect(itens).toHaveLength(0);
  });
});
