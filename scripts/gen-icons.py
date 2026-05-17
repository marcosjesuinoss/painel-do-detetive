"""
Gera os PNGs do icone do PWA a partir de assets/icons/source.png.

Saidas:
  - icon-192.png            (192x192, purpose=any, sem padding extra)
  - icon-512.png            (512x512, purpose=any)
  - icon-512-maskable.png   (512x512, conteudo em area segura 80%, fundo preto matching)
"""
import os
from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
SRC  = os.path.join(ROOT, "assets", "icons", "source.png")
OUT  = os.path.join(ROOT, "assets", "icons")

# Cor de fundo para o maskable (matches dark do logo)
BG = (10, 10, 10)


def open_square(path):
    """Abre a imagem fonte. Se nao for quadrada, recorta centralizado."""
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    if w != h:
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        img = img.crop((left, top, left + side, top + side))
    return img


def make_any(src, size):
    """Versao normal: redimensiona direto. Mantem transparencia se houver."""
    return src.resize((size, size), Image.LANCZOS)


def make_maskable(src, size, safe_ratio=0.80):
    """Versao maskable: conteudo dentro da area segura (80%), resto preenchido com BG.
    Android pode recortar bordas em qualquer formato (circulo/quadrado/squircle)."""
    canvas = Image.new("RGB", (size, size), BG)
    inner = int(size * safe_ratio)
    resized = src.resize((inner, inner), Image.LANCZOS)
    offset = (size - inner) // 2
    # Se houver alpha, achatar contra BG
    if resized.mode == "RGBA":
        bg = Image.new("RGB", (inner, inner), BG)
        bg.paste(resized, (0, 0), resized)
        resized = bg
    canvas.paste(resized, (offset, offset))
    return canvas


def main():
    src = open_square(SRC)
    print(f"Fonte: {SRC} ({src.size[0]}x{src.size[1]})")

    targets = [
        ("icon-180.png", lambda: make_any(src, 180)),  # apple-touch-icon
        ("icon-192.png", lambda: make_any(src, 192)),
        ("icon-512.png", lambda: make_any(src, 512)),
        ("icon-512-maskable.png", lambda: make_maskable(src, 512)),
    ]

    for name, fn in targets:
        img = fn()
        out_path = os.path.join(OUT, name)
        # Garantir que ambas as variantes sejam PNG; RGBA para "any", RGB para maskable
        img.save(out_path, "PNG", optimize=True)
        print(f"  -> {out_path} ({img.size[0]}x{img.size[1]})")

    print("Done.")


if __name__ == "__main__":
    main()
