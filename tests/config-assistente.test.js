// Testes da configuracao do assistente: toggles independentes
// (sugestoes / automarcacao) + migracao do modelo antigo (mestre 'ativo').

import { describe, it, expect, beforeEach } from "vitest";

beforeEach(() => {
  localStorage.removeItem("assistenteIAConfiguracoes");
});

describe("obterConfiguracaoAssistenteIA - defaults e formato novo", () => {
  it("default: sugestoes e automarcacao ligadas", () => {
    const cfg = obterConfiguracaoAssistenteIA();
    expect(cfg.sugestoes).toBe(true);
    expect(cfg.automarcacao).toBe(true);
    expect(cfg.nivelExplicacao).toBe("objetiva");
    expect("ativo" in cfg).toBe(false);
  });

  it("le os dois eixos de forma independente", () => {
    localStorage.setItem(
      "assistenteIAConfiguracoes",
      JSON.stringify({ sugestoes: false, automarcacao: true }),
    );
    const cfg = obterConfiguracaoAssistenteIA();
    expect(cfg.sugestoes).toBe(false);
    expect(cfg.automarcacao).toBe(true);
  });
});

describe("salvarConfiguracaoAssistenteIA - toggles independentes", () => {
  it("desligar sugestoes nao desliga a marcacao automatica", () => {
    salvarConfiguracaoAssistenteIA({ sugestoes: false });
    const cfg = obterConfiguracaoAssistenteIA();
    expect(cfg.sugestoes).toBe(false);
    expect(cfg.automarcacao).toBe(true);
  });

  it("desligar a marcacao automatica nao desliga as sugestoes", () => {
    salvarConfiguracaoAssistenteIA({ automarcacao: false });
    const cfg = obterConfiguracaoAssistenteIA();
    expect(cfg.sugestoes).toBe(true);
    expect(cfg.automarcacao).toBe(false);
  });
});

describe("migracao do modelo antigo (mestre 'ativo')", () => {
  it("ativo:true -> sugestoes:true (mantem automarcacao)", () => {
    localStorage.setItem(
      "assistenteIAConfiguracoes",
      JSON.stringify({ ativo: true, automarcacao: false }),
    );
    const cfg = obterConfiguracaoAssistenteIA();
    expect(cfg.sugestoes).toBe(true);
    expect(cfg.automarcacao).toBe(false);
  });

  it("ativo:false desligava TUDO -> sugestoes:false E automarcacao:false", () => {
    // No modelo antigo, automarcacao:true so valia com o mestre ligado.
    localStorage.setItem(
      "assistenteIAConfiguracoes",
      JSON.stringify({ ativo: false, automarcacao: true }),
    );
    const cfg = obterConfiguracaoAssistenteIA();
    expect(cfg.sugestoes).toBe(false);
    expect(cfg.automarcacao).toBe(false);
  });

  it("formato novo tem prioridade sobre 'ativo' legado", () => {
    localStorage.setItem(
      "assistenteIAConfiguracoes",
      JSON.stringify({ ativo: false, sugestoes: true, automarcacao: true }),
    );
    const cfg = obterConfiguracaoAssistenteIA();
    expect(cfg.sugestoes).toBe(true);
    expect(cfg.automarcacao).toBe(true);
  });
});
