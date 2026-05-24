# Testes do motor (IA-038)

Suite de testes que valida o motor lógico do assistente IA — deduções,
classificação de inconsistências e cálculos relacionados.

## Pré-requisitos

- Node.js 18+ (testado em v24)
- npm

## Setup

```bash
npm install
```

## Rodar testes

```bash
npm test          # roda uma vez
npm run test:watch # modo watch (re-roda ao salvar arquivo)
```

## Estrutura

```
tests/
  setup.js          # carrega motor + mocks + helpers de teste
  deducoes.test.js  # testes das 4 deduções principais
```

## Estratégia

O app é vanilla JS (sem ES6 modules). Os testes usam:

- **Vitest** com ambiente **jsdom** (simula `window`, `document`, `localStorage`)
- O arquivo `tests/setup.js` carrega `js/assistente-ia.js` via `eval` no
  global, expondo todas as funções top-level para os testes
- Dependências externas do motor (`isPRO`, `marcarCelula`, `getEl`,
  `document.querySelector`) são mockadas com comportamento mínimo
  necessário para os testes

## Cobertura atual

- ✅ `deduzirCartasPorCapacidadeAssistenteIA` (3 casos incluindo regressão IA-001)
- ✅ `deduzirExclusoesFortesAssistenteIA` (2 casos: coluna-saturada, linha-unica)
- ✅ `deduzirCartasPorGrupoRespostaAssistenteIA` (3 casos: marca V, multi-candidato, já-V)
- ✅ `deduzirCruzamentosFortesAssistenteIA` (1 caso: dupla-trio)

Total: 9 testes, ~10ms de execução.

## Helpers disponíveis nos testes (via globalThis)

| Helper | Propósito |
|---|---|
| `configurarPartida(numJog, cartasPorJog)` | Setup básico em localStorage |
| `definirEstadoTabela({"row-col": valor})` | Estado inicial da tabela |
| `lerEstadoTabelaTeste()` | Lê estado após dedução |
| `popularCartasPadrao()` | 9 cartas mock (3 sus + 3 arm + 3 loc) |
| `resetarEstadoAssistenteIA()` | Limpa entre testes (chamado em beforeEach) |

## Adicionar novos testes

Crie arquivos `tests/*.test.js`. Os helpers globais e o motor estão
carregados via `setup.js`. Exemplo:

```js
import { describe, it, expect } from "vitest";

describe("minha funcao", () => {
  it("faz X quando Y", () => {
    configurarPartida(3, [3, 3, 3]);
    definirEstadoTabela({ "0-0": "V" });
    minhaFuncao();
    expect(lerEstadoTabelaTeste()["1-0"]).toBe("X");
  });
});
```
