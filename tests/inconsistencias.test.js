// IA-038: testes do classificador de inconsistencias
//
// classificarInconsistenciasAssistenteIA(linhas) retorna { graves, leves }
// com itens { codigo, nivel, mensagem, foco }.
//
// Cobertura: os 6 codigos graves + 1 leve definidos no spec (P5 + IA-043
// que unificou coluna-impossivel-aberta + coluna-insuficiente em
// coluna-fechada-abaixo quando ambos disparam juntos).

import { describe, it, expect } from "vitest";

// Helper local: chama obterLinhasAssistenteIA dentro de um cache pra que
// classificarInconsistencias use snapshot consistente.
function classificar() {
  let resultado;
  executarComCacheAssistenteIA(() => {
    const linhas = obterLinhasAssistenteIA();
    resultado = classificarInconsistenciasAssistenteIA(linhas);
  });
  return resultado;
}

describe("classificarInconsistenciasAssistenteIA - graves", () => {
  it("linha-v-duplicado: linha com 2 V (cada carta tem 1 dono unico)", () => {
    configurarPartida(3, [3, 3, 3]);
    // Marco com V em col 0 e col 1 - impossivel
    definirEstadoTabela({
      "0-0": "V",
      "0-1": "V",
    });

    const { graves } = classificar();
    const linhaV = graves.find((g) => g.codigo === "linha-v-duplicado");
    expect(linhaV).toBeDefined();
    expect(linhaV.mensagem).toContain("Marco");
  });

  it("oculta-duplicada: 2 linhas-toda-X na mesma secao", () => {
    configurarPartida(3, [3, 3, 3]);
    // Marco e Bruno (ambos Suspeitos) toda-X = 2 ocultas na mesma secao
    definirEstadoTabela({
      "0-0": "X", "0-1": "X", "0-2": "X",
      "1-0": "X", "1-1": "X", "1-2": "X",
    });

    const { graves } = classificar();
    const dup = graves.find((g) => g.codigo === "oculta-duplicada");
    expect(dup).toBeDefined();
    expect(dup.mensagem).toContain("Suspeitos");
  });

  it("secao-toda-v: todas as linhas da secao tem ao menos 1 V", () => {
    configurarPartida(3, [3, 3, 3]);
    // Suspeitos: Marco, Bruno, Carlos - todos com V em alguma coluna
    definirEstadoTabela({
      "0-0": "V",
      "1-1": "V",
      "2-2": "V",
    });

    const { graves } = classificar();
    const todaV = graves.find((g) => g.codigo === "secao-toda-v");
    expect(todaV).toBeDefined();
    expect(todaV.mensagem).toContain("Suspeitos");
  });

  it("coluna-excesso: V > limite da coluna", () => {
    configurarPartida(3, [3, 3, 3]);
    // J0 com 4 V mas limite eh 3
    definirEstadoTabela({
      "0-0": "V",
      "3-0": "V",
      "6-0": "V",
      "7-0": "V",
    });

    const { graves } = classificar();
    const excesso = graves.find((g) => g.codigo === "coluna-excesso");
    expect(excesso).toBeDefined();
    // Foco deve listar exatamente as celulas V (IA-043 fix)
    expect(excesso.foco.tipo).toBe("celulas");
    expect(excesso.foco.chaves).toHaveLength(4);
  });

  it("coluna-fechada-abaixo: mao fechada com V < limite (IA-043 unificado)", () => {
    configurarPartida(3, [3, 3, 3]);
    // J0: 2 V + 7 X = mao fechada (sem abertas), mas precisa de 3 V
    definirEstadoTabela({
      "0-0": "V",
      "1-0": "V",
      "2-0": "X",
      "3-0": "X",
      "4-0": "X",
      "5-0": "X",
      "6-0": "X",
      "7-0": "X",
      "8-0": "X",
    });

    const { graves } = classificar();
    const fechada = graves.find((g) => g.codigo === "coluna-fechada-abaixo");
    expect(fechada).toBeDefined();
    expect(fechada.mensagem).toContain("J1");
    expect(fechada.mensagem).toContain("faltam 1");
    // Nao deve disparar o codigo antigo separado
    const antigo = graves.find((g) => g.codigo === "coluna-insuficiente");
    expect(antigo).toBeUndefined();
  });

  it("coluna-impossivel-aberta: faltam > abertas, mas ainda tem abertas", () => {
    configurarPartida(3, [3, 3, 3]);
    // J0: 0 V + 8 X + 1 aberta. Precisa de 3 mas so 1 aberta.
    // (faltam=3, abertas=1 - matematicamente impossivel)
    definirEstadoTabela({
      "0-0": "X",
      "1-0": "X",
      "2-0": "X",
      "3-0": "X",
      "4-0": "X",
      "5-0": "X",
      "6-0": "X",
      "7-0": "X",
      // 8-0 aberta
    });

    const { graves } = classificar();
    const imp = graves.find((g) => g.codigo === "coluna-impossivel-aberta");
    expect(imp).toBeDefined();
    expect(imp.mensagem).toContain("precisa de 3");
    expect(imp.mensagem).toContain("1 celula(s) aberta(s)");
  });

  it("sem inconsistencias quando estado eh valido", () => {
    configurarPartida(3, [3, 3, 3]);
    // Estado simples sem nada errado
    definirEstadoTabela({
      "0-0": "V",
      "1-1": "V",
      "3-0": "X",
    });

    const { graves, leves } = classificar();
    expect(graves).toHaveLength(0);
    expect(leves).toHaveLength(0);
  });
});

describe("classificarInconsistenciasAssistenteIA - leves", () => {
  it("grupo-impossivel: grupo de resposta com todas as cartas X (sem V)", () => {
    configurarPartida(3, [3, 3, 3]);

    // Cria grupo de resposta pra J2 com 3 cartas
    const grupo = {
      id: "grupo-imp-1",
      coluna: 2,
      rows: [0, 3, 6],
      timestamp: Date.now(),
    };
    localStorage.setItem("assistenteGruposResposta", JSON.stringify([grupo]));

    // Estado: todas as 3 cartas do grupo viraram X em col 2 - impossivel
    definirEstadoTabela({
      "0-2": "X",
      "3-2": "X",
      "6-2": "X",
    });

    const { leves } = classificar();
    const grupoImp = leves.find((l) => l.codigo === "grupo-impossivel");
    expect(grupoImp).toBeDefined();
    expect(grupoImp.mensagem).toContain("J3");
  });

  it("grupo-impossivel NAO dispara quando ha V em alguma carta do grupo", () => {
    configurarPartida(3, [3, 3, 3]);

    const grupo = {
      id: "grupo-imp-2",
      coluna: 2,
      rows: [0, 3, 6],
      timestamp: Date.now(),
    };
    localStorage.setItem("assistenteGruposResposta", JSON.stringify([grupo]));

    // Uma carta confirmada como V - grupo esta resolvido, nao impossivel
    definirEstadoTabela({
      "0-2": "V",
      "3-2": "X",
      "6-2": "X",
    });

    const { leves } = classificar();
    const grupoImp = leves.find((l) => l.codigo === "grupo-impossivel");
    expect(grupoImp).toBeUndefined();
  });
});
