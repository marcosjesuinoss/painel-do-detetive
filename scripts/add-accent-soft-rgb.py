"""
Adiciona a variavel --accent-soft-rgb em todos os temas do pro-features.json,
calculada a partir do hex de --accent-soft existente em cada tema.
"""
import json
import re

FILE = "config/pro-features.json"

def hex_to_rgb_str(hex_color):
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r = int(h[0:2], 16)
    g = int(h[2:4], 16)
    b = int(h[4:6], 16)
    return f"{r}, {g}, {b}"

with open(FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

count = 0
for tema_id, tema in data["temas"].items():
    for chave_grupo in ("variaveis", "variaveis-light"):
        grupo = tema.get(chave_grupo)
        if not grupo:
            continue
        soft = grupo.get("--accent-soft")
        if not soft:
            continue
        if "--accent-soft-rgb" in grupo:
            print(f"  [skip] {tema_id}.{chave_grupo} ja tem --accent-soft-rgb")
            continue
        rgb = hex_to_rgb_str(soft)
        # Insere logo apos --accent-rgb mantendo ordem (recriar dict ordenado)
        novo = {}
        for k, v in grupo.items():
            novo[k] = v
            if k == "--accent-rgb":
                novo["--accent-soft-rgb"] = rgb
        # Se --accent-rgb nao estava, adiciona no final
        if "--accent-soft-rgb" not in novo:
            novo["--accent-soft-rgb"] = rgb
        tema[chave_grupo] = novo
        count += 1
        print(f"  [add] {tema_id}.{chave_grupo}: --accent-soft-rgb: '{rgb}' (de {soft})")

with open(FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"\nTotal de entradas atualizadas: {count}")
