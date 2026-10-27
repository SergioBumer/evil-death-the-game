// Renderiza una escena del videoclip cuadro por cuadro con el juego real y la arma con la canción.
// Uso: node video/render.mjs <escena> <audio.mp3> <beats.json> <carpeta-salida> <dir-fuentes>
// Requiere Playwright (chromium) y ffmpeg.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)('playwright');   // Playwright instalado global o en el proyecto
const [scene = 'climax', audio, beatsFile, out, fontsDir] = process.argv.slice(2);

// Escenas: inicio y fin en segundos de la canción
const SCENES = {
  climax: { start:215.0, end:241.0 },
};
const S = SCENES[scene];
if (!S) throw new Error('Escena desconocida: ' + scene);

const beatsAll = JSON.parse(fs.readFileSync(beatsFile, 'utf8')).beats;
const beats = beatsAll.filter(b => b >= S.start + .6 && b <= S.end).map(b => +(b - S.start).toFixed(3));
// golpe del remate: el más cercano a 3:58.4
const finalAbs = 238.42 - S.start;
const finalIdx = beats.reduce((best, b, i) => Math.abs(b - finalAbs) < Math.abs(beats[best] - finalAbs) ? i : best, 0);
const cfg = { beats, finalIdx, finalT:beats[finalIdx], lastDouble:finalIdx - 6 };

const font = f => fs.readFileSync(path.join(fontsDir, f)).toString('base64');
const fontCSS = `
@font-face{font-family:'VT323';src:url(data:font/woff2;base64,${font('vt323-latin-400-normal.woff2')}) format('woff2')}
@font-face{font-family:'VT323';src:url(data:font/woff2;base64,${font('vt323-latin-ext-400-normal.woff2')}) format('woff2');unicode-range:U+0100-024F}
@font-face{font-family:'Press Start 2P';src:url(data:font/woff2;base64,${font('press-start-2p-latin-400-normal.woff2')}) format('woff2')}
@font-face{font-family:'Metal Mania';src:url(data:font/woff2;base64,${font('metal-mania-latin-400-normal.woff2')}) format('woff2')}`;

const frames = path.join(out, 'frames-' + scene);
fs.rmSync(frames, { recursive:true, force:true }); fs.mkdirSync(frames, { recursive:true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:960, height:540 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.route(/fonts\.googleapis\.com/, r => r.fulfill({ contentType:'text/css', body:fontCSS }));
await page.route(/fonts\.gstatic\.com/, r => r.abort());
await page.addInitScript(() => {
  let s = 20261030;                                   // semilla fija: el video sale igual cada vez
  Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  window.requestAnimationFrame = () => 0;             // el director avanza el juego, no el navegador
  window.__VIDEO = { actors:null, god:true };
});
await page.goto('file://' + path.resolve(HERE, '..', 'index.html'));
await page.evaluate(() => document.fonts.ready);
await page.addScriptTag({ path:path.join(HERE, 'director.js') });
await page.evaluate(c => window.DIR.setup(c), cfg);

const total = Math.round((S.end - S.start) * 60);
for (let i = 0; i < total; i++) {
  const url = await page.evaluate(() => window.DIR.frame());
  fs.writeFileSync(path.join(frames, String(i).padStart(5, '0') + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  if (i % 300 === 0) console.log(i, '/', total, JSON.stringify(await page.evaluate(() => window.DIR.info())));
}
await browser.close();
if (errors.length) console.log('Errores de la página:', errors);

// 960×540 → 1920×1080 sin suavizar (pixel art), con la canción
const mp4 = path.join(out, `herencia-maldita-${scene}-16x9.mp4`);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '60', '-i', path.join(frames, '%05d.png'),
  '-ss', String(S.start), '-t', String(S.end - S.start), '-i', audio,
  '-vf', 'scale=1920:1080:flags=neighbor', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', mp4]);
console.log('listo:', mp4);
