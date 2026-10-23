"""Construye el juego: inyecta los niveles en el HTML y genera la versión para Vercel."""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).parent
sys.path.insert(0, str(ROOT / 'src'))
from levels import L  # noqa: E402

def levels_js():
    out = ['[']
    for i, lv in enumerate(L):
        out.append('  { // Nivel %d' % (i + 1))
        out.append('    rows: [')
        for r in lv['rows']:
            out.append('      %s,' % json.dumps(r))
        out.append('    ],')
        out.append('    signs: %s' % json.dumps(lv['signs'], ensure_ascii=False))
        out.append('  },')
    out.append(']')
    return '\n'.join(out)

src = (ROOT / 'src' / 'game.src.html').read_text(encoding='utf-8')
import base64
logo = 'data:image/png;base64,' + base64.b64encode((ROOT / 'assets' / 'logo-evil-death.png').read_bytes()).decode()
body = src.replace('/*__LEVELS__*/', levels_js()).replace('__LOGO__', logo)

out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
if out: out.write_text(body, encoding='utf-8')  # versión sin <html>/<head> (vista previa)
head = ('<!doctype html>\n<html lang="es">\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">\n'
        '<meta name="description" content="La Gira Maldita: un plataformas de Evil Death. Rescata a los seis músicos y vence al Silenciador.">\n')
(ROOT / 'index.html').write_text(head + body + '\n</html>\n', encoding='utf-8')
print('ok', len(body))
