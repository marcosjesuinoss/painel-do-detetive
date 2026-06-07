// Gera a pasta www/ que o Capacitor empacota no app nativo.
// O codigo-fonte continua na raiz (servida pelo GitHub Pages); este script
// apenas COPIA os arquivos web pra www/. Assim mantemos uma unica fonte de
// verdade e o app nativo fica sempre em sincronia (rode antes de `cap sync`).

import { rmSync, mkdirSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const www = join(raiz, "www");

// Limpa e recria www/
rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

const arquivos = ["index.html", "privacidade.html", "manifest.json", "sw.js"];
const pastas = ["css", "js", "assets", "config"];

for (const arquivo of arquivos) {
  cpSync(join(raiz, arquivo), join(www, arquivo));
}
for (const pasta of pastas) {
  cpSync(join(raiz, pasta), join(www, pasta), { recursive: true });
}

console.log("www/ gerado com sucesso (" + (arquivos.length + pastas.length) + " itens copiados).");
