// Renderiza el videoclip de "Herencia maldita" con el juego real, cuadro por cuadro, y lo arma con la canción.
//
// Uso:
//   node video/render.mjs --audio cancion.mp3 --beats beats.json --fonts carpeta-fuentes --qr qr.png --out video.mp4 [--from 0] [--to 305]
//   node video/render.mjs ... --probe carpeta --every 0.5        (prueba: guarda un PNG cada 0,5 s, sin armar video)
//
// Requiere Playwright (chromium) y ffmpeg. Los cuadros (960×540) se escalan ×2 sin suavizar: 1920×1080 a 60 fps.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const audio = arg('audio'), beatsFile = arg('beats'), fontsDir = arg('fonts'), qr = arg('qr'), out = arg('out');
const from = +arg('from', 0), probe = arg('probe'), every = +arg('every', .5);
const SONG_END = +arg('song-end', 304.9);
const to = Math.min(+arg('to', SONG_END), SONG_END);

const beats = JSON.parse(fs.readFileSync(beatsFile, 'utf8')).beats;
const font = f => fs.readFileSync(path.join(fontsDir, f)).toString('base64');
const fontCSS = `
@font-face{font-family:'VT323';src:url(data:font/woff2;base64,${font('vt323-latin-400-normal.woff2')}) format('woff2')}
@font-face{font-family:'VT323';src:url(data:font/woff2;base64,${font('vt323-latin-ext-400-normal.woff2')}) format('woff2');unicode-range:U+0100-024F}
@font-face{font-family:'Press Start 2P';src:url(data:font/woff2;base64,${font('press-start-2p-latin-400-normal.woff2')}) format('woff2')}
@font-face{font-family:'Metal Mania';src:url(data:font/woff2;base64,${font('metal-mania-latin-400-normal.woff2')}) format('woff2')}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:960, height:540 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.route(/fonts\.googleapis\.com/, r => r.fulfill({ contentType:'text/css', body:fontCSS }));
await page.route(/fonts\.gstatic\.com|_vercel/, r => r.abort());
await page.addInitScript(() => {
  let s = 20261030;                                     // semilla fija: el video sale igual cada vez
  Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  window.requestAnimationFrame = () => 0;               // el director avanza el juego, no el navegador
  window.__VIDEO = { actors:null, god:true };
});
await page.goto('file://' + path.resolve(HERE, '..', 'index.html'));
await page.evaluate(() => document.fonts.ready);
await page.addScriptTag({ path:path.join(HERE, 'director.js') });
const qrData = qr ? 'data:image/png;base64,' + fs.readFileSync(qr).toString('base64') : null;
await page.evaluate(c => window.DIR.setup(c), { beats, start:from, songEnd:SONG_END, qr:qrData });
await page.waitForTimeout(200);

const total = Math.round((to - from) * 60);
let ff = null;
if (!probe) {
  // --noaudio: solo video (para renderizar por tramos y unir después con la canción completa)
  const aud = process.argv.includes('--noaudio') ? [] : ['-ss', String(from), '-t', String(to - from), '-i', audio];
  const audOut = aud.length ? ['-c:a', 'aac', '-b:a', '256k', '-shortest'] : [];
  ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-', ...aud,
    '-vf', 'scale=1920:1080:flags=neighbor', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    ...audOut, '-movflags', '+faststart', out], { stdio:['pipe', 'inherit', 'inherit'] });
} else fs.mkdirSync(probe, { recursive:true });

const stepEvery = Math.max(1, Math.round(every * 60));
for (let i = 0; i < total; i++) {
  const url = await page.evaluate(() => window.DIR.frame());
  const buf = Buffer.from(url.split(',')[1], 'base64');
  if (ff) { if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
  else if (i % stepEvery === 0) fs.writeFileSync(path.join(probe, (from + i / 60).toFixed(2).padStart(7, '0') + '.png'), buf);
  if (i % 600 === 0) console.log(`${(from + i / 60).toFixed(1)}s`, JSON.stringify(await page.evaluate(() => window.DIR.info())));
}
await browser.close();
if (ff) { ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('listo:', out); }
if (errors.length) console.log('Errores de la página:', errors.slice(0, 5));
