// IA-038: testes das 4 deducoes do motor logico do assistente IA
//
// Cobertura inicial:
//   - deduzirCartasPorCapacidadeAssistenteIA (P0/IA-001 - corrigida)
//   - deduzirExclusoesFortesAssistenteIA (P4/IA-014)
//   - deduzirCartasPorGrupoRespostaAssistenteIA (Sprint G/IA-013)
//   - deduzirCruzamentosFortesAssistenteIA (P4/IA-015)
//
// Layout das cartas (definido em setup.js):
//   row 0,1,2 = Suspeitos (Marco, Bruno, Carlos)
//   row 3,4,5 = Armas (Faca, Pistola, Corda)
//   row 6,7,8 = Locais (Cozinha, Sala, Hospital)
//
// Helpers globais (de setup.js):
//   configurarPartida(numJogadores, cartasPorJogador)
//   definirEstadoTabela({ "row-col": "V"|"X"|"?" })
//   lerEstadoTabelaTeste() -> objeto estado
//   resetarEstadoAssistenteIA() -> chamado em beforeEach

import { describe, it, expect } from "vitest";

describe("deduzirCartasPorCapacidadeAssistenteIA", () => {
  it("marca V nas candidatas quando faltam = candidatas disponiveis (capacidade-coluna)", () => {
    // Capacidade marca V quando o jogador precisa de N cartas e restam
    // exatamente N candidatas (nao-X, nao-V) na coluna. NAO marca X em
    // resto - quem marca X em coluna saturada eh exclusoes-fortes.
    configurarPartida(3, [3, 3, 3]);

    // J0 ja tem 1 V (Marco). Precisa de mais 2.
    // Marca X em 6 das 8 restantes -> sobram 2 candidatas (Faca e Cozinha).
    // Essas 2 devem virar V.
    definirEstadoTabela({
      "0-0": "V", // Marco eh do J0
      "1-0": "X",
      "2-0": "X",
      "4-0": "X",
      "5-0": "X",
      "7-0": "X",
      "8-0": "X",
      // Sobram candidatas: 3-0 (Faca) e 6-0 (Cozinha) = 2 candidatas = 2 faltantes
    });

    deduzirCartasPorCapacidadeAssistenteIA();

    const estado = lerEstadoTabelaTeste();
    expect(estado["3-0"]).toBe("V");
    expect(estado["6-0"]).toBe("V");
  });

  it("nao age se jogador ainda nao fechou a mao (vCount < limite)", () => {
    configurarPartida(3, [3, 3, 3]);

    // J0 tem so 2 V (precisa de 3)
    definirEstadoTabela({
      "0-0": "V",
      "3-0": "V",
    });

    deduzirCartasPorCapacidadeAssistenteIA();

    const estado = lerEstadoTabelaTeste();
    // Nenhuma outra celula da col 0 muda
    expect(estado["1-0"]).toBeUndefined();
    expect(estado["4-0"]).toBeUndefined();
    expect(estado["6-0"]).toBeUndefined();
  });

  it("NAO cria V duplicado na linha (fix do IA-001)", () => {
    configurarPartida(3, [3, 3, 3]);

    // J1 ja tem V em Marco (linha 0, col 1).
    // J0 tem 2 V (Faca, Cozinha) e precisa de mais 1.
    // Sem o fix, a deducao por capacidade marcaria V em algo na col 0 - se
    // calhar de ser Marco (row 0), criaria V duplicado na linha.
    // O fix garante que candidatas com V em outra coluna sao filtradas.
    definirEstadoTabela({
      "0-1": "V", // Marco eh do J1
      "3-0": "V", // Faca eh do J0
      "6-0": "V", // Cozinha eh do J0
      // J0 precisa de mais 1 V. Candidatas: 1-0, 2-0, 4-0, 5-0, 7-0, 8-0.
      // Mas se a logica filtra rows com V em outra coluna, row 0 nao entra.
    });

    deduzirCartasPorCapacidadeAssistenteIA();

    const estado = lerEstadoTabelaTeste();
    // Marco (row 0) NAO pode ter V em col 0 (ja tem V em col 1)
    expect(estado["0-0"]).not.toBe("V");
  });
});

describe("deduzirExclusoesFortesAssistenteIA", () => {
  it("coluna-saturada: jogador com limite atingido -> resto vira X", () => {
    configurarPartida(3, [3, 3, 3]);

    // J0 tem 3 V (limite). Equivale a capacidade, mas exclusoes-fortes
    // tambem deve marcar resto como X via coluna-saturada.
    definirEstadoTabela({
      "0-0": "V",
      "3-0": "V",
      "6-0": "V",
    });

    deduzirExclusoesFortesAssistenteIA();

    const estado = lerEstadoTabelaTeste();
    expect(estado["1-0"]).toBe("X");
    expect(estado["2-0"]).toBe("X");
  });

  it("linha-unica: linha com X em todas exceto 1 + secao com oculta -> unica vira V", () => {
    configurarPartida(3, [3, 3, 3]);

    // Cenario: secao Suspeitos.
    // Linha Marco (0): X em todas col 0 e 1, soh col 2 aberta
    // Linha Bruno (1): toda em X -> oculta!
    // Linha Carlos (2): tem V em col 0 -> dono confirmado.
    //
    // Como Bruno eh oculta e Carlos ja foi confirmado, Marco eh a linha
    // unica nao-V da secao com 1 candidato -> deve virar V em col 2.
    definirEstadoTabela({
      "0-0": "X",
      "0-1": "X",
      // 0-2 aberto
      "1-0": "X",
      "1-1": "X",
      "1-2": "X",
      "2-0": "V",
    });

    deduzirExclusoesFortesAssistenteIA();

    const estado = lerEstadoTabelaTeste();
    // Marco em col 2 deve virar V (linha-unica - linha unica nao-confirmada
    // com 1 unica candidata aberta)
    expect(estado["0-2"]).toBe("V");
  });
});

describe("deduzirCartasPorGrupoRespostaAssistenteIA", () => {
  it("marca V quando grupo de resposta tem so 1 candidata restante (nao-X, nao-V)", () => {
    configurarPartida(3, [3, 3, 3]);

    // Cria grupo de resposta: J2 mostrou uma de 3 cartas (Marco, Faca, Cozinha)
    const grupo = {
      id: "grupo-teste-1",
      coluna: 2,
      rows: [0, 3, 6],
      timestamp: Date.now(),
    };
    localStorage.setItem("assistenteGruposResposta", JSON.stringify([grupo]));

    // Estado: J2 ja descartou Marco e Faca (X) - so sobrou Cozinha como candidata
    definirEstadoTabela({
      "0-2": "X",
      "3-2": "X",
      // 6-2 ainda em aberto -> deve virar V
    });

    deduzirCartasPorGrupoRespostaAssistenteIA();

    const estado = lerEstadoTabelaTeste();
    expect(estado["6-2"]).toBe("V");
  });

  it("NAO age quando o grupo ainda tem multiplos candidatos", () => {
    configurarPartida(3, [3, 3, 3]);

    const grupo = {
      id: "grupo-teste-2",
      coluna: 2,
      rows: [0, 3, 6],
      timestamp: Date.now(),
    };
    localStorage.setItem("assistenteGruposResposta", JSON.stringify([grupo]));

    // Soh 1 X nas 3 cartas - ainda restam 2 candidatas
    definirEstadoTabela({
      "0-2": "X",
    });

    deduzirCartasPorGrupoRespostaAssistenteIA();

    const estado = lerEstadoTabelaTeste();
    // Nenhuma virou V
    expect(estado["3-2"]).toBeUndefined();
    expect(estado["6-2"]).toBeUndefined();
  });

  it("NAO age quando grupo ja tem V em alguma das suas cartas", () => {
    configurarPartida(3, [3, 3, 3]);

    const grupo = {
      id: "grupo-teste-3",
      coluna: 2,
      rows: [0, 3, 6],
      timestamp: Date.now(),
    };
    localStorage.setItem("assistenteGruposResposta", JSON.stringify([grupo]));

    // J2 ja tem V em Marco (row 0) - grupo esta resolvido
    definirEstadoTabela({
      "0-2": "V",
      "3-2": "X",
      // 6-2 em aberto - NAO deve virar V (grupo ja resolvido)
    });

    deduzirCartasPorGrupoRespostaAssistenteIA();

    const estado = lerEstadoTabelaTeste();
    expect(estado["6-2"]).toBeUndefined();
  });
});

describe("deduzirCruzamentosFortesAssistenteIA", () => {
  it("dupla-trio: 2 linhas confinadas + vagasS=2 -> outras celulas em S viram X", () => {
    // Pra dupla-trio disparar, precisa: confinadas.length === vagasS.
    // Setup com vagas restritas em S={0,1}:
    //   J0 e J1 cada um ja tem 2 V (so resta 1 vaga em cada) -> vagasS = 2
    //   Marco e Bruno tem X em col 2 -> candidatos = [0,1] (confinados em S)
    //   confinadas = [Marco, Bruno] = 2, vagasS = 2 OK
    //   Carlos, Corda e Hospital nao tem V e nao sao confinados ->
    //   suas celulas em col 0 e col 1 viram X
    configurarPartida(3, [3, 3, 3]);

    definirEstadoTabela({
      // J0 ja tem 2 V (Faca, Cozinha)
      "3-0": "V",
      "6-0": "V",
      // J1 ja tem 2 V (Pistola, Sala)
      "4-1": "V",
      "7-1": "V",
      // Marco e Bruno descartados por J2 -> candidatos = [0,1]
      "0-2": "X",
      "1-2": "X",
    });

    deduzirCruzamentosFortesAssistenteIA();

    const estado = lerEstadoTabelaTeste();
    // Carlos (row 2), Corda (row 5) e Hospital (row 8) nao podem mais ter
    // celulas em col 0 ou col 1 (vagas consumidas por Marco+Bruno).
    expect(estado["2-0"]).toBe("X");
    expect(estado["2-1"]).toBe("X");
    expect(estado["5-0"]).toBe("X");
    expect(estado["5-1"]).toBe("X");
    expect(estado["8-0"]).toBe("X");
    expect(estado["8-1"]).toBe("X");
  });
});
