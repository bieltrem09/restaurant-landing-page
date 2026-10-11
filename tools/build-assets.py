#!/usr/bin/env python3
"""Gera as imagens otimizadas (AVIF + WebP + JPG) e o sprite de ícones.

Uso:  python3 tools/build-assets.py [caminho/para/node_modules/lucide-static]

- Lê as fotos originais em assets/originals/
- Recorta, gera larguras do srcset (640 e a largura nativa, sem upscaling)
- Gera o recorte transparente do niguiri usado na camada da frente do hero
- Gera assets/icons.svg a partir do lucide-static (se o caminho for informado)

Dependências: Pillow >= 11.2 (com AVIF), numpy, scipy.
Quando tiver fotos originais em alta resolução, basta substituí-las em
assets/originals/ e rodar o script de novo: as larguras 1024/1600/2400 são
geradas automaticamente quando a foto de origem comporta.
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "originals"
OUT = ROOT / "assets" / "img"
WIDTHS = [640, 1024, 1600, 2400]
QUALITY = {"avif": 62, "webp": 82, "jpeg": 84}  # AVIF 62 ~ JPEG 85 visualmente

# nome final -> (arquivo original, caixa de recorte ou None)
IMAGES = {
    # recorte remove o texto e a marca d'água da arte original
    "niguiri-salmao-macaricado": ("niguiri-salmao-macaricado.jpg", (40, 200, 736, 632)),
    "prato-combinado": ("prato-combinado.jpg", None),
    "prato-detalhe": ("prato-combinado.jpg", (150, 260, 640, 960)),
    "balcao-sakura": ("balcao-sakura.jpg", None),
    "salao-lanternas": ("salao-lanternas.jpg", None),
    "letreiro-logo": ("letreiro-logo.jpg", None),
}


def widths_for(w):
    ws = [x for x in WIDTHS if x < w]
    return ws + [w]


def save_all(img, name, alpha=False):
    meta = []
    for w in widths_for(img.width):
        h = round(img.height * w / img.width)
        im = img if w == img.width else img.resize((w, h), Image.LANCZOS)
        im.save(OUT / f"{name}-{w}.avif", quality=QUALITY["avif"])
        im.save(OUT / f"{name}-{w}.webp", quality=QUALITY["webp"], method=6)
        if alpha:
            im.save(OUT / f"{name}-{w}.png", optimize=True)
        else:
            im.convert("RGB").save(OUT / f"{name}-{w}.jpg", quality=QUALITY["jpeg"],
                                   optimize=True, progressive=True)
        meta.append(w)
    return {"widths": meta, "w": img.width, "h": img.height}


def niguiri_cutout(img):
    """Máscara do niguiri (salmão + arroz + cebolinha) sobre fundo escuro."""
    x = np.asarray(img).astype(float)
    mx, mn = x.max(-1), x.min(-1)
    sat = (mx - mn) / (mx + 1e-6)
    m = (mx > 120) | ((sat > 0.45) & (mx > 70))
    low = np.zeros_like(m)
    low[150:262, 220:490] = True          # arroz na sombra
    m |= (mx > 62) & low
    box = np.zeros_like(m)
    box[50:300, 135:550] = True
    m &= box
    m = nd.binary_closing(m, iterations=4)
    lab, _ = nd.label(m)
    keep = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
    keep = nd.binary_fill_holes(keep)
    keep = nd.binary_opening(keep, iterations=2)
    lab, _ = nd.label(keep)
    keep = lab == (np.bincount(lab.ravel())[1:].argmax() + 1)
    alpha = Image.fromarray((keep * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1.3))
    out = img.convert("RGBA")
    out.putalpha(alpha)
    return out


def build_hero():
    """Hero em 2K: usa a foto ampliada 4x por IA (Real-ESRGAN x4plus).

    A máscara do recorte é calculada na resolução original (mais estável) e
    ampliada com suavização, então aplicada sobre a foto em alta resolução.
    """
    hi_src = SRC / "niguiri-salmao-macaricado@4x.jpg"
    if not hi_src.exists():
        return {}
    box = IMAGES["niguiri-salmao-macaricado"][1]
    hi = Image.open(hi_src).convert("RGB").crop(tuple(v * 4 for v in box))
    lo = Image.open(SRC / IMAGES["niguiri-salmao-macaricado"][0]).convert("RGB").crop(box)
    alpha = niguiri_cutout(lo).getchannel("A").resize(hi.size, Image.LANCZOS)
    alpha = alpha.filter(ImageFilter.GaussianBlur(2.2))
    cut = hi.convert("RGBA")
    cut.putalpha(alpha)
    out = {}
    for name, img, is_alpha in (("hero-niguiri", hi, False), ("hero-niguiri-recorte", cut, True)):
        meta = []
        for w in (1024, 1600, 2048, 2560):
            im = img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)
            im.save(OUT / f"{name}-{w}.avif", quality=60)
            im.save(OUT / f"{name}-{w}.webp", quality=84, method=6)
            if is_alpha:
                if w == 1024:  # fallback PNG só na menor largura (peso)
                    im.save(OUT / f"{name}-{w}.png", optimize=True)
            else:
                im.save(OUT / f"{name}-{w}.jpg", quality=86, optimize=True, progressive=True)
            meta.append(w)
        out[name] = {"widths": meta, "w": img.width, "h": img.height}
    return out


def build_icons(lucide_dir):
    names = ["arrow-right", "arrow-up-right", "arrow-up", "menu", "x", "star", "chef-hat",
             "map-pin", "phone", "instagram", "message-circle", "clock", "calendar", "users",
             "chevron-left", "chevron-right", "pause", "play", "download", "navigation",
             "mail", "check", "fish", "flame", "utensils-crossed"]
    symbols = []
    for n in names:
        svg = (Path(lucide_dir) / "icons" / f"{n}.svg").read_text()
        body = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1).strip()
        body = re.sub(r"\s+", " ", body)
        symbols.append(f'<symbol id="i-{n}" viewBox="0 0 24 24">{body}</symbol>')
    sprite = ('<svg xmlns="http://www.w3.org/2000/svg">'
              "<!-- Lucide icons (ISC) https://lucide.dev -->" + "".join(symbols) + "</svg>\n")
    (ROOT / "assets" / "icons.svg").write_text(sprite)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, (file, box) in IMAGES.items():
        img = Image.open(SRC / file).convert("RGB")
        if box:
            img = img.crop(box)
        manifest[name] = save_all(img, name)
    # imagem de compartilhamento (Open Graph) 1200x630, fundo preto
    og = Image.new("RGB", (1200, 630), (10, 9, 8))
    hero = Image.open(SRC / "niguiri-salmao-macaricado.jpg").convert("RGB").crop((40, 200, 736, 632))
    hero = hero.resize((1015, 630), Image.LANCZOS)
    og.paste(hero, ((1200 - 1015) // 2, 0))
    og.save(OUT / "og-image.jpg", quality=85, optimize=True)
    manifest.update(build_hero())
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    if len(sys.argv) > 1:
        build_icons(sys.argv[1])
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
