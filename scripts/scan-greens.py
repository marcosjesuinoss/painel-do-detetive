"""
Mapeia todas as ocorrencias de cores verdes hardcoded em components.css,
agrupadas pelo seletor CSS pai. Saida em markdown ordenado por categoria.
"""
import re
from collections import defaultdict

FILE = "css/components.css"
OUT_FILE = "scripts/greens-report.md"

# Cores verdes do tema padrao que NAO deveriam ser hardcoded
GREEN_PATTERNS = [
    r"#16a34a",
    r"#15803d",
    r"#4ade80",
    r"#22c55e",
    r"#166534",
    r"#14532d",
    r"rgba\(22,\s*163,\s*74[^\)]*\)",
    r"rgba\(34,\s*197,\s*94[^\)]*\)",
    r"rgba\(74,\s*222,\s*128[^\)]*\)",
    r"rgba\(21,\s*128,\s*61[^\)]*\)",
]

GREEN_RE = re.compile("(" + "|".join(GREEN_PATTERNS) + ")", re.IGNORECASE)

with open(FILE, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Parser de seletor: rastreia o ultimo seletor antes do {
hits = []  # (line_num, selector, line_content, colors_found)
current_selector = "<root>"
brace_depth = 0
selector_buffer = []

for i, raw in enumerate(lines, 1):
    line = raw.rstrip()
    stripped = line.strip()

    # Acumula linhas ate encontrar {
    if "{" in stripped and brace_depth == 0:
        # Capturar seletor: tudo antes do {
        before_brace = "".join(selector_buffer) + stripped.split("{")[0]
        current_selector = re.sub(r"\s+", " ", before_brace).strip()
        selector_buffer = []
        brace_depth = stripped.count("{") - stripped.count("}")
        # Pode ter cor na mesma linha apos o {
        rest = stripped.split("{", 1)[1]
        for m in GREEN_RE.finditer(rest):
            hits.append((i, current_selector, stripped, m.group()))
        continue

    if brace_depth > 0:
        brace_depth += stripped.count("{") - stripped.count("}")
        for m in GREEN_RE.finditer(stripped):
            hits.append((i, current_selector, stripped, m.group()))
        if brace_depth <= 0:
            current_selector = "<root>"
            brace_depth = 0
    else:
        # Fora de bloco: acumulando seletor de varias linhas
        if stripped and not stripped.startswith("/*") and not stripped.startswith("*"):
            selector_buffer.append(stripped + " ")

# Categorizar por contexto do seletor
def categorize(selector):
    s = selector.lower()
    if "button" in s or "btn" in s or ".play" in s or ".padrao" in s:
        return "1. Botoes"
    if "card" in s:
        return "2. Cards"
    if "tabela" in s or "celula" in s or "linha-grid" in s or "secao-grid" in s:
        return "3. Tabela / Celulas"
    if "menu" in s or "lateral" in s or "container" in s or "popup" in s:
        return "4. Menu / Container / Popup"
    if "acordeao" in s or "accordion" in s or "ajuda" in s:
        return "5. Accordion / Ajuda"
    if "ia" in s or "assistente" in s or "toast" in s:
        return "6. Assistente IA / Toast"
    if "logo" in s or "splash" in s or "icone" in s:
        return "7. Logo / Splash / Icone"
    if "rodape" in s or "footer" in s:
        return "8. Rodape"
    if "tema" in s or "preco" in s or "sobre" in s or "status" in s or "badge" in s:
        return "9. Telas Sobre / Pro / Tema"
    return "0. Outros"

grupos = defaultdict(list)
for hit in hits:
    grupos[categorize(hit[1])].append(hit)

out = []
out.append(f"# Mapa de cores verdes hardcoded em {FILE}\n")
out.append(f"Total de ocorrencias: **{len(hits)}**\n")
out.append("Cores procuradas: `#16a34a`, `#15803d`, `#4ade80`, `#22c55e`, `#166534`, `#14532d`, `rgba(22,163,74,*)`, `rgba(34,197,94,*)`, `rgba(74,222,128,*)`, `rgba(21,128,61,*)`\n")

for grupo in sorted(grupos.keys()):
    items = grupos[grupo]
    out.append(f"\n## {grupo} ({len(items)} ocorrencias)\n")
    porSel = defaultdict(list)
    for h in items:
        porSel[h[1]].append(h)
    for sel, occs in porSel.items():
        cores_unicas = sorted(set(o[3] for o in occs))
        linhas = sorted(set(o[0] for o in occs))
        sel_clean = sel.replace("﻿", "").strip()
        sel_short = sel_clean[:140] + ("..." if len(sel_clean) > 140 else "")
        out.append(f"- **{sel_short}**")
        out.append(f"  - linhas: {linhas}")
        out.append(f"  - cores: {cores_unicas}")

with open(OUT_FILE, "w", encoding="utf-8") as f:
    f.write("\n".join(out))

print(f"Total: {len(hits)} ocorrencias")
for grupo in sorted(grupos.keys()):
    print(f"  {grupo}: {len(grupos[grupo])}")
print(f"Relatorio completo: {OUT_FILE}")
