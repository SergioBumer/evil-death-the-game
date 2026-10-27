"""Genera los marcos (PNG con transparencia) para los formatos vertical 9:16 y cuadrado 1:1 del videoclip.
Uso: python3 video/overlays.py <logo.png> <metal-mania.ttf> <press-start-2p.ttf> <carpeta-salida>"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
logo_p, mm_p, ps_p, out = sys.argv[1:5]
logo = Image.open(logo_p).convert('RGBA')

def glow_text(im, xy, txt, font, fill, glow=(212, 34, 58, 200), r=10, anchor='mm'):
    lay = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.text(xy, txt, font=font, fill=glow, anchor=anchor)
    lay = lay.filter(ImageFilter.GaussianBlur(r)); im.alpha_composite(lay)
    d = ImageDraw.Draw(im); d.text((xy[0] + 3, xy[1] + 3), txt, font=font, fill=(0, 0, 0, 220), anchor=anchor); d.text(xy, txt, font=font, fill=fill, anchor=anchor)

def paste_logo(im, cx, cy, w):
    h = int(w * logo.height / logo.width); lg = logo.resize((w, h), Image.LANCZOS)
    g = Image.new('RGBA', im.size, (0, 0, 0, 0)); g.alpha_composite(lg, (cx - w // 2, cy - h // 2))
    sh = g.split()[3].filter(ImageFilter.GaussianBlur(14)); red = Image.new('RGBA', im.size, (212, 34, 58, 0)); red.putalpha(sh.point(lambda v: int(v * .8)))
    im.alpha_composite(red); im.alpha_composite(g)
    return h

def frame(W, H, video_h, path, logo_w, title_size, foot_size):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    vy = (H - video_h) // 2                       # el video 16:9 va centrado
    top_mid = vy // 2
    lh = paste_logo(im, W // 2, top_mid - title_size // 2, logo_w)
    glow_text(im, (W // 2, top_mid + lh // 2 + title_size // 3), 'Herencia maldita', ImageFont.truetype(mm_p, title_size), (233, 220, 197, 255))
    fy = vy + video_h + (H - vy - video_h) // 2
    d.text((W // 2, fy - foot_size), 'JUEGA GRATIS', font=ImageFont.truetype(ps_p, int(foot_size * .55)), fill=(255, 90, 110, 255), anchor='mm')
    glow_text(im, (W // 2, fy + foot_size // 2), 'evil-death.vercel.app', ImageFont.truetype(mm_p, foot_size), (255, 225, 77, 255), r=8)
    # filo sutil alrededor del video
    d.rectangle([0, vy - 3, W, vy - 1], fill=(212, 34, 58, 180)); d.rectangle([0, vy + video_h + 1, W, vy + video_h + 3], fill=(212, 34, 58, 180))
    im.save(path)

frame(1080, 1920, 608, out + '/marco-9x16.png', 760, 92, 70)
frame(1080, 1080, 608, out + '/marco-1x1.png', 270, 44, 42)
print('ok')
