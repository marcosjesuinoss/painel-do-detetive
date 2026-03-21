# Git Workflow

## Objetivo

Manter sempre uma base estavel do app e reduzir o risco de quebrar a tabela, temas, splash ou fluxo de partida.

## Estrutura de branches

- `main`
  - sempre a versao estavel
  - so recebe mudancas testadas
- `codex/feature/<nome>`
  - novas funcoes
  - exemplos:
    - `codex/feature/assistente-cartas`
    - `codex/feature/temas-pro`
- `codex/fix/<nome>`
  - correcoes de bugs
  - exemplos:
    - `codex/fix/tabela-nao-abre`
    - `codex/fix/tema-claro-pro`
- `codex/ui/<nome>`
  - ajustes visuais
  - exemplos:
    - `codex/ui/refino-planilha`
    - `codex/ui/splash-pro`

## Regra pratica

1. criar uma branch nova antes de mudancas grandes
2. fazer commits pequenos
3. testar o fluxo afetado
4. so depois levar para `main`

## Padrao de commits

- `feat: adiciona popup de distribuicao de cartas`
- `fix: restaura abertura da planilha`
- `style: refina selecao da tabela no modo claro`
- `refactor: isola logica do assistente`
- `chore: atualiza cache do service worker`

## Checklist antes de commit

1. verificar se a tela inicial abre
2. verificar se nova partida inicia
3. verificar se a planilha abre
4. verificar se tema claro e escuro continuam funcionando
5. verificar se nao apareceu erro de encoding
6. se alterou arquivos estaticos, atualizar o cache/versionamento

## Fluxo recomendado

### Nova feature

```powershell
git switch main
git pull
git switch -c codex/feature/nome-da-feature
```

### Correcao urgente

```powershell
git switch main
git switch -c codex/fix/nome-do-bug
```

### Commits pequenos

```powershell
git add <arquivos>
git commit -m "feat: descricao curta"
```

## Quando usar backup da pasta

Use a pasta `backup/` como restauracao rapida local.
Use Git para:

- historico confiavel
- comparacao entre mudancas
- retorno seguro para pontos estaveis
- isolamento de trabalho

Os dois juntos sao o caminho mais seguro.

