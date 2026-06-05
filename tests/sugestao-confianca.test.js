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

// IA-045: confianca agora normaliza pela fracao de jogadores descartados (X)
// por categoria e usa o MINIMO das 3 (gargalo). Helper monta uma "linha" com
// `numX` descartes numa mesa de `jogadores`.
function linhaCom(numX, jogadores, motivo) {
  const estados = Array.from({ length: jogadores }, (_, i) =>
    i < numX ? "X" : "",
  );
  return { estados, xCount: numX, motivo };
}

describe("calcularConfiancaAssistenteIA", () => {
  it("retorna Baixa quando alguma escolha eh null", () => {
    const result = calcularConfiancaAssistenteIA([
      linhaCom(3, 6),
      null,
      linhaCom(3, 6),
    ]);
    expect(result.nivel).toBe("Baixa");
    expect(result.detalhes[0]).toMatch(/falta/i);
  });

  it("retorna Alta quando todas as categorias estao quase fechadas", () => {
    // 5 de 6 descartados em cada -> 0.83 >= 0.75
    const result = calcularConfiancaAssistenteIA([
      linhaCom(5, 6),
      linhaCom(5, 6),
      linhaCom(5, 6),
    ]);
    expect(result.nivel).toBe("Alta");
  });

  it("oculta-direta conta como certeza total", () => {
    const result = calcularConfiancaAssistenteIA([
      linhaCom(6, 6, "linha-toda-x"),
      linhaCom(5, 6),
      linhaCom(5, 6),
    ]);
    expect(result.nivel).toBe("Alta");
  });

  it("retorna Media quando a categoria mais fraca esta no meio", () => {
    // 3 de 6 -> 0.5 (entre 0.34 e 0.75)
    const result = calcularConfiancaAssistenteIA([
      linhaCom(5, 6),
      linhaCom(3, 6),
      linhaCom(5, 6),
    ]);
    expect(result.nivel).toBe("Media");
  });

  it("retorna Baixa quando alguma categoria esta muito aberta", () => {
    // 1 de 6 -> 0.167 < 0.34 puxa o minimo pra baixo
    const result = calcularConfiancaAssistenteIA([
      linhaCom(5, 6),
      linhaCom(5, 6),
      linhaCom(1, 6),
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
    expect(sug.itens[0]).toMatch(/Caso encerrado/i);
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
    expect(sug.itens[0]).toMatch(/^Pergunte/i);
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
    expect(sug.itens[0]).toMatch(/Que tal perguntar/);
  });

  it("sugestao exploratoria com pouca evidencia", () => {
    configurarPartida(3, [3, 3, 3]);
    // Sem marcacoes -> nada conclusivo
    definirEstadoTabela({});

    const sug = obterSugestao();
    // Cabecalho do palpite (modo objetivo) ou fallback.
    expect(sug.itens[0]).toMatch(/Pergunte|abrir o jogo|nenhum palpite/i);
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
