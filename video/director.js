/* Director del videoclip de "Herencia maldita".
   Se inyecta en la página del juego (modo video: window.__VIDEO) y produce un cuadro por llamada a DIR.frame().
   El tiempo es el de la canción (segundos): cada escena tiene su tramo [t0, t1). Todo es determinista (semilla fija).
   Los personajes juegan de verdad con entradas guionadas; el director solo decide entradas, cámara y textos. */
(() => {
  const G = window.__gira, V = window.__VIDEO, FPS = 60, DT = 1 / FPS;
  const cv = document.getElementById('c'), ctx = cv.getContext('2d');
  const BAND = G.BAND, MAP = { W:0, H:0 };
  const NAME = i => i < 0 ? 'El metalero' : BAND[i].name;
  const COL = i => i < 0 ? '#e9dcc5' : BAND[i].col;
  let cfg = null, f = 0, scene = null, shot = null, shotT = 0, zoom = 1, overlays = [];
  let qrImg = null;
  const logo = document.getElementById('logo');

  /* ---------- utilidades ---------- */
  const beatNear = t => cfg.beats.reduce((a, b) => Math.abs(b - t) < Math.abs(a - t) ? b : a, cfg.beats[0]);
  const beatsIn = (a, b) => cfg.beats.filter(x => x >= a && x < b);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = k => k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);

  function loadLevel(i, powers){ G.loadLevel(i); if (powers !== undefined) G.powers = powers; }

  function makeActor(hero, tx, ty, face = 1){
    const p = G.newPlayer({ x:tx * 32 + 6, y:(ty + 1) * 32 - 44 });
    p.face = face; p.life = 4;
    return { hero, p, keys:{}, hit:{}, hold:0 };
  }
  function setActors(list, target){ V.actors = list; V.target = target || (list[0] && list[0].p) || null; }

  // Bot genérico: corre hacia un lado y salta paredes, huecos y pinchos; trepa cuando queda colgado.
  function runner(o = {}){
    let lastJump = -99;
    return (fr, a) => {
      const P = a.p, K = a.keys, H = a.hit, dir = o.dir || 1;
      if (o.stopX && (o.dir || 1) * (P.x - o.stopX * 32) > 0) return;   // se detiene al llegar a esa columna
      K.right = dir > 0; K.left = dir < 0;
      if (P.state === 'hang') { K.up = true; return; }
      const cx = P.x + P.w / 2, feet = P.y + P.h, row = Math.floor((feet - 2) / 32);
      const c1 = Math.floor((cx + dir * 22) / 32), c2 = Math.floor((cx + dir * 46) / 32);
      const wall = G.isSolid(c1, row) || G.isSolid(c1, row - 1);
      const gap = !G.isSolid(c1, row + 1) && !G.isSolid(c2, row + 1);
      const spikes = G.tileAt(c1, row) === '^' || G.tileAt(c2, row) === '^';
      if (P.onGround && (wall || gap || spikes) && fr - lastJump > 10) { H.jump = true; a.hold = 28; lastJump = fr; }
      else if (o.double && !P.onGround && P.vy > 60 && P.airJumps > 0 && fr - lastJump > 14 && !G.isSolid(c1, row + 2)) { H.jump = true; a.hold = 22; lastJump = fr; }
      if (o.attack && fr % 18 === 0) {
        const near = G.ents.some(e => (e.t === 'E' || e.t === 'F') && !e.dead && Math.abs(e.x - cx) < 120 && Math.sign(e.x - cx) === dir && Math.abs(e.y - P.y) < 60);
        if (near) H.attack = true;
      }
    };
  }

  /* ---------- textos en pantalla (se dibujan encima del juego) ---------- */
  function text(str, x, y, o = {}){
    ctx.save(); ctx.globalAlpha = o.alpha ?? 1; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = o.font || '28px VT323, monospace';
    if (o.ls) { try { ctx.letterSpacing = o.ls; } catch (e) {} }
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 18; }
    if (o.shadow !== false) { ctx.fillStyle = o.shadowCol || '#000'; ctx.fillText(str, x + (o.sh || 3), y + (o.sh || 3)); }
    ctx.shadowBlur = 0; ctx.fillStyle = o.color || '#e9dcc5'; ctx.fillText(str, x, y);
    ctx.restore();
  }
  function band(y, h, a = .62){ ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#07030a'; ctx.fillRect(0, y, cv.width, h); ctx.restore(); }
  function vignette(a){
    const g = ctx.createRadialGradient(cv.width / 2, 270, 120, cv.width / 2, 270, 560);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, 540);
  }
  // Tarjeta de nivel (abajo a la izquierda): número y nombre del nivel + quién juega
  function levelCard(lt, lvl, hero){
    const k = Math.min(1, lt / .25, Math.max(0, (3.2 - lt) / .4)); if (k <= 0) return;
    const meta = G.LEVEL_META[lvl], x = 28 - (1 - k) * 40;
    band(400, 104, .6 * k);
    text(`NIVEL ${lvl + 1} · ${meta.name.toUpperCase()}`, x, 434, { align:'left', font:'12px "Press Start 2P", monospace', color:'#ff5a6e', alpha:k, sh:2 });
    text(hero < 0 ? 'El metalero sale a buscar a la banda' : `Ahora juega ${NAME(hero)}`, x, 476, { align:'left', font:'40px VT323, monospace', color:'#e9dcc5', alpha:k });
  }
  // Rescate: nombre grande del músico y su rol
  let rescueAt = null, rescueWho = -1;
  V.onRescue = i => { rescueAt = f; rescueWho = i; };
  function rescueCard(){
    if (rescueAt === null) return;
    const lt = (f - rescueAt) / FPS; if (lt > 3.4) return;
    const k = Math.min(1, lt / .2), pop = 1 + Math.max(0, .25 - lt) * 1.4, b = BAND[rescueWho];
    ctx.save(); ctx.translate(cv.width / 2, 200); ctx.scale(pop, pop); ctx.translate(-cv.width / 2, -200);
    text('¡RESCATASTE A', cv.width / 2, 150, { font:'16px "Press Start 2P", monospace', color:'#ffe14d', alpha:k });
    text(b.name.toUpperCase() + '!', cv.width / 2, 228, { font:'78px "Metal Mania", fantasy', color:b.col, alpha:k, glow:b.col, blur:22, sh:4 });
    text(b.title.replace(/^el /, '').toUpperCase(), cv.width / 2, 268, { font:'14px "Press Start 2P", monospace', color:'#e9dcc5', alpha:k });
    ctx.restore();
  }

  /* ---------- cámara ---------- */
  const inMap = () => G.state === 'play' || G.state === 'bossdown';
  const mapW = () => inMap() ? G.mapSize().w : 1088, mapH = () => inMap() ? G.mapSize().h : 544;
  function camera(focus, z, lead = 0, snap = false, rate = 7){
    zoom = snap ? z : zoom + (z - zoom) * Math.min(1, DT * 5);
    const vw = cv.width / zoom, vh = 540 / zoom;
    const fx = focus.x + lead, fy = focus.y;
    const cxw = x => clamp(x, 0, Math.max(0, mapW() - vw)), cyw = y => clamp(y, 0, Math.max(0, mapH() - vh));
    if (snap) { G.cam.x = cxw(fx - vw / 2); G.cam.y = cyw(fy - vh / 2); }
    else { G.cam.x = cxw(G.cam.x + (cxw(fx - vw / 2) - G.cam.x) * Math.min(1, DT * rate)); G.cam.y = cyw(G.cam.y + (cyw(fy - vh / 2) - G.cam.y) * Math.min(1, DT * rate)); }
    V.zoom = zoom;
  }
  const centerOf = p => ({ x:p.x + p.w / 2, y:p.y + p.h / 2 - 30 });

  /* ---------- escenas de niveles: montaje de tomas cortas ---------- */
  // Cada toma: { d (s), lvl, hero, tx, ty, face, script(fr, actor), zoom, lead, enemies (false = sin enemigos) }
  function levelScene(t0, t1, lvl, hero, shots){
    let i = -1, start = 0, a = null, fr = 0;
    const cuts = []; let acc = t0;
    shots.forEach((s, k) => { const end = k === shots.length - 1 ? t1 : beatNear(acc + s.d); cuts.push([acc, end]); acc = end; });
    return { t0, t1, enter(){ i = -1; rescueAt = null; }, update(t){
      const k = cuts.findIndex(([a0, a1]) => t >= a0 && t < a1);
      if (k !== i) {                                         // corte: arranca la toma
        i = k; const s = shots[k]; fr = 0; start = t;
        loadLevel(s.lvl ?? lvl, s.powers ?? (s.lvl ?? lvl));
        if (s.enemies === false) G.ents = G.ents.filter(e => e.t !== 'E' && e.t !== 'F');
        a = makeActor(hero, s.tx, s.ty, s.face || 1); setActors([a]);
        if (s.setup) s.setup(a);
        camera(centerOf(a.p), s.zoom || 1.7, (s.lead ?? 70) * a.p.face, true);
      }
      const s = shots[i];
      a.keys = {}; if (a.hold > 0) { a.keys.jump = true; a.hold--; }
      s.script(fr, a); fr++;
      G.videoStep(DT);
      camera(centerOf(a.p), s.zoom || 1.7, (s.lead ?? 70) * a.p.face);
    }, draw(t){
      G.render();
      if (i === 0) levelCard(t - t0, lvl, hero);
      rescueCard();
    } };
  }

  /* ---------- escenas ---------- */
  function buildScenes(){
    const L = [];
    // 0:00 Título
    L.push({ t0:0, t1:beatNear(13), enter(){ setActors([]); G.state = 'menu'; }, update(t){ G.videoStep(DT); }, draw(t){
      G.render();
      vignette(.75);
      const lk = ease((t - .6) / 1.6), pk = ease((t - 3.9) / .8), tk = ease((t - 6.8) / 1), sk = ease((t - 9.6) / .8);
      if (logo.complete && lk > 0) {
        const w = 460, h = w * logo.naturalHeight / logo.naturalWidth, sc = 1.12 - .12 * lk;
        ctx.save(); ctx.globalAlpha = lk; ctx.translate(cv.width / 2, 170); ctx.scale(sc, sc);
        ctx.shadowColor = 'rgba(212,34,58,.9)'; ctx.shadowBlur = 26 * lk; ctx.drawImage(logo, -w / 2, -h / 2, w, h); ctx.restore();
      }
      text('PRESENTA', cv.width / 2, 312, { font:'14px "Press Start 2P", monospace', color:'#d4223a', alpha:pk, ls:'8px', sh:2 });
      text('La Gira Maldita', cv.width / 2, 398, { font:'84px "Metal Mania", fantasy', color:'#e9dcc5', alpha:tk, glow:'rgba(212,34,58,.8)', blur:24, sh:4, shadowCol:'#5a0d18' });
      text('VIDEOCLIP OFICIAL · HERENCIA MALDITA', cv.width / 2, 452, { font:'11px "Press Start 2P", monospace', color:'#a3949a', alpha:sk, sh:2 });
    } });

    // 0:13 Nivel 1 — el metalero (rescata a Sergio)
    L.push(levelScene(beatNear(13), beatNear(28), 0, -1, [
      { d:3.4, tx:2, ty:12, script:runner(), zoom:1.6 },
      { d:3.4, tx:28, ty:10, script:(fr, a) => { const K = a.keys; K.right = true; if (fr === 10) { a.hit.jump = true; a.hold = 30; } if (a.p.state === 'hang') K.up = true; } },
      { d:3.4, tx:38, ty:12, script:(fr, a) => { a.keys.right = true; if (fr === 20) { a.hit.jump = true; a.hold = 30; } } },
      { d:4.8, tx:56, ty:12, script:runner(), zoom:1.5 },
    ]));
    // 0:28 Nivel 2 — Sergio (rescata a Rodrigo)
    L.push(levelScene(beatNear(28), beatNear(47), 1, 0, [
      { d:4.3, tx:2, ty:12, script:runner({ attack:true }) },
      { d:5.0, tx:38, ty:9, script:(fr, a) => { a.keys.right = true; if (fr === 12) { a.hit.jump = true; a.hold = 38; } if (fr > 70) runner({ attack:true, stopX:62 })(fr, a); } },
      { d:5.0, tx:68, ty:12, script:(fr, a) => { if (a.p.x < 76 * 32) a.keys.right = true; if (fr === 10) { a.hit.jump = true; a.hold = 30; } if (a.p.state === 'hang') a.keys.up = true; } },
      { d:4.8, tx:76, ty:8, script:runner({ attack:true }), zoom:1.5 },
    ]));
    // 0:47 Nivel 3 — Rodrigo (rescata a Fabián)
    L.push(levelScene(beatNear(47), beatNear(68), 2, 1, [
      { d:4.4, tx:2, ty:12, script:runner({ double:true, attack:true, stopX:29 }), enemies:false },
      { d:4.0, tx:27, ty:12, script:(fr, a) => { if (a.p.x < 44 * 32) a.keys.right = true; if (fr === 8) { a.hit.jump = true; a.hold = 60; } if (fr === 28) a.hit.jump = true; if (a.p.state === 'hang') a.keys.up = true; }, enemies:false },
      { d:4.0, tx:53, ty:5, script:(fr, a) => { if (a.p.x < 66 * 32) a.keys.right = true; if (fr === 10) { a.hit.jump = true; a.hold = 60; } if (fr === 32) a.hit.jump = true; }, enemies:false },
      { d:3.8, tx:70, ty:7, script:(fr, a) => { if (a.p.x < 80 * 32) a.keys.right = true; if (fr === 8) { a.hit.jump = true; a.hold = 70; } if (fr === 30) a.hit.jump = true; if (a.p.state === 'hang') a.keys.up = true; }, enemies:false },
      { d:4.8, tx:80, ty:9, script:runner({ double:true, attack:true }), zoom:1.5 },
    ]));
    // 1:08 Nivel 4 — Fabián (rescata a Andrés)
    L.push(levelScene(beatNear(68), beatNear(89), 3, 2, [
      { d:3.6, tx:2, ty:12, script:(fr, a) => { runner({ double:true, attack:true, stopX:22 })(fr, a); const c = Math.floor((a.p.x + a.p.w / 2) / 32); if (c === 12 && a.p.onGround) a.hit.dash = true; } },
      { d:4.2, tx:26, ty:12, script:(fr, a) => { if (a.p.x < 44 * 32) a.keys.right = true; if (fr === 20) { a.hit.jump = true; a.hold = 70; } if (fr === 42) a.hit.jump = true; if (fr === 58) a.hit.dash = true; if (a.p.state === 'hang') a.keys.up = true; }, enemies:false },
      { d:5.0, tx:68, ty:12, script:(fr, a) => { if (a.p.x < 80 * 32) a.keys.right = true; if (fr % 40 === 5) { a.hit.jump = true; a.hold = 25; } if (a.p.state === 'hang') a.keys.up = true; }, enemies:false },
      { d:3.3, tx:79, ty:3, script:runner({ double:true, stopX:88 }), enemies:false },
      // pisa la placa (col. 90), espera que se abra la reja y llega a Andrés
      { d:4.8, tx:88, ty:3, zoom:1.5, script:(fr, a) => { const c = Math.floor((a.p.x + a.p.w / 2) / 32); if (c < 90 || fr > 50) runner()(fr, a); } },
    ]));
    // 1:29 Pasaje limpio — el Silenciador en la oscuridad
    L.push({ t0:beatNear(89), t1:beatNear(105.16), enter(){ loadLevel(6, 6); G.ents = []; setActors([]); const b = G.boss; b.shootT = 999; b.spawnT = 999; b.heartT = 999; zoom = 1; this.q1 = this.q2 = false; },
      update(t){ const b = G.boss; b.shootT = 999; G.videoStep(DT); const lt = t - this.t0;
        if (lt >= 1.2 && !this.q1) { this.q1 = true; G.taunt = { text:'¿Tanto ruido para decir que estás triste?', t:5.6, show:5.6 }; }
        if (lt >= 8.6 && !this.q2) { this.q2 = true; G.taunt = { text:'Tu género tiene más subgéneros que oyentes.', t:6, show:6 }; }
        camera({ x:b.x + b.w / 2, y:b.y + b.h / 2 + 90 }, 1 + .7 * ease(lt / 15), 0, lt < DT, 3);
      },
      draw(t){ G.render(); vignette(.9); const lt = t - this.t0; const k = Math.min(1, lt / .6, Math.max(0, (4 - lt) / .6));
        if (k > 0) text('EL SILENCIADOR', 40, 470, { align:'left', font:'16px "Press Start 2P", monospace', color:'#ff5cc6', alpha:k });
        if (k > 0) text('Un productor que odia la distorsión', 40, 505, { align:'left', font:'32px VT323, monospace', color:'#e9dcc5', alpha:k }); } });
    // 1:45 Nivel 5 — Andrés (rescata a Leo)
    L.push(levelScene(beatNear(105.16), beatNear(118), 4, 3, [
      { d:4.2, tx:15, ty:36, zoom:1.5, lead:0, script:(fr, a) => { const P = a.p, K = a.keys;
          if (P.state === 'hang') { K.up = true; return; }
          if (P.onGround) { K.right = true; if (fr % 20 === 0) a.hit.jump = true; return; }
          if (P.wall) a.hit.jump = true; a.keys.jump = true;
          if (P.y < 22 * 32 - 10) { K.left = true; } else { K.left = P.vx < 0; K.right = P.vx >= 0; } } },
      { d:4.2, tx:6, ty:21, zoom:1.5, lead:0, script:(fr, a) => { const P = a.p, K = a.keys;
          if (P.state === 'hang') { K.up = true; return; }
          if (P.onGround && P.y > 10 * 32) { K.left = true; if (fr % 20 === 0) a.hit.jump = true; return; }
          if (P.onGround) { K.right = true; return; }
          if (P.wall) a.hit.jump = true; K.jump = true;
          if (P.y < 6 * 32 - 10) { K.right = true; } else { K.left = P.vx < 0; K.right = P.vx >= 0; } } },
      { d:4.4, tx:30, ty:5, script:runner({ double:true, attack:true }), zoom:1.6 },
    ]));
    // 1:58 Nivel 6 — Leo (rescata a César)
    L.push(levelScene(beatNear(118), beatNear(145.85), 5, 4, [
      { d:4.5, tx:9, ty:12, enemies:false, script:(fr, a) => { const P = a.p, K = a.keys; if (fr === 5) a.hit.attack = true;
          if (fr > 40 && P.x < 30 * 32) { K.right = true; const c = Math.floor((P.x + P.w / 2) / 32); if (P.onGround && (c === 11 || c === 14)) { a.hit.jump = true; a.hold = 25; } } } },
      { d:3.5, tx:58, ty:7, enemies:false, script:(fr, a) => { if (a.p.x < 66 * 32) a.keys.right = true; if (fr === 8) a.hit.dash = true; } },
      { d:5.0, tx:68, ty:7, enemies:false, script:(fr, a) => { const P = a.p, K = a.keys; if (fr === 5) a.hit.attack = true;
          if (fr > 30 && P.x < 79 * 32) { K.right = true; const c = Math.floor((P.x + P.w / 2) / 32); if (P.onGround && (c === 71 || c === 75)) { a.hit.jump = true; a.hold = 25; } } } },
      { d:7.0, tx:82, ty:12, script:runner({ double:true, attack:true, stopX:94 }) },
      { d:7.85, tx:90, ty:12, script:runner({ double:true, attack:true }), zoom:1.5 },
    ]));
    // 2:26 Jefe final — César canta la letra mientras pelea
    L.push(bossScene(beatNear(145.85), beatNear(177.15)));
    // 2:57 Turnos de poderes
    L.push(turnsScene(beatNear(177.15), beatNear(189.99)));
    // 3:10 Solo de Leo
    L.push(soloScene(beatNear(189.99), beatNear(214.83)));
    // 3:35 Clímax: los seis contra el Silenciador
    L.push(climaxScene(beatNear(214.83), 241.0));
    // 4:01 Final: la banda en el escenario y créditos
    L.push(endingScene(241.0, beatNear(268.86)));
    // 4:29 Cierre: juega gratis, redes, contrataciones
    L.push(outroScene(beatNear(268.86), beatNear(296.87)));
    // 4:57 Logo
    L.push({ t0:beatNear(296.87), t1:cfg.songEnd, enter(){}, update(){}, draw(t){
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, 540); const lt = t - this.t0, k = Math.min(1, lt / .8, Math.max(0, (cfg.songEnd - t) / 1.2));
      if (logo.complete) { const w = 520, h = w * logo.naturalHeight / logo.naturalWidth; ctx.save(); ctx.globalAlpha = k; ctx.shadowColor = 'rgba(212,34,58,.9)'; ctx.shadowBlur = 30; ctx.drawImage(logo, cv.width / 2 - w / 2, 250 - h / 2, w, h); ctx.restore(); }
      text('evil-death.vercel.app', cv.width / 2, 470, { font:'30px VT323, monospace', color:'#a3949a', alpha:k }); } });
    return L;
  }

  /* ---------- pelea con el jefe ---------- */
  let bossFrac = 1;                                         // vida del jefe (fracción) a lo largo de toda la pelea
  function bossHold(){ const b = G.boss; if (b && !b.dead) { const v = Math.max(.01, bossFrac) * b.max; if (v < b.hp - .001) b.hurt = .18; b.hp = v; } }
  function spawnPoser(left){
    if (G.ents.filter(e => e.t === 'E' && !e.dead).length >= 5) return;
    G.ents.push({ t:'E', x:left ? 40 : 1020, y:408, w:24, h:40, vx:left ? 60 : -60, vy:0, hp:2, hurt:0, anim:Math.random() * 6 });
  }
  function arena(){ if (G.state !== 'play' || !G.boss || G.boss.dead) { loadLevel(6, 6); G.ents = []; const b = G.boss; b.heartT = 999; } }

  // Letra (2:28–2:52): globos grandes sobre César
  const LYRICS = [
    [147.98, 'Tantas horas por vivir'], [151.0, 'tanta oscuridad'], [154.0, 'este mundo no para'], [156.99, 'DE LLORAR', 'caps'],
    [162.12, 'Tanta oscuridad total'], [165.14, 'invade mi mente'], [169.0, 'ya no quiero vivir'], [171.99, '¡MÁS!', 'big'],
  ];
  function lyric(t, p){
    let cur = null; for (const l of LYRICS) if (t >= l[0] && t < l[0] + 2.9) cur = l; if (!cur) return;
    const lt = t - cur[0], k = Math.min(1, lt / .1, (2.9 - lt) / .25), big = cur[2] === 'big', caps = cur[2] === 'caps';
    const fs = big ? 72 : caps ? 52 : 40, font = big || caps ? `${fs}px "Metal Mania", fantasy` : `${fs}px VT323, monospace`;
    ctx.save(); ctx.font = font;
    const tw = ctx.measureText(cur[1]).width, bw = tw + 36, bh = fs + 22;
    const px = (p.x + p.w / 2 - G.cam.x) * zoom, py = (p.y - G.cam.y) * zoom - 12;
    const bx = clamp(px - bw / 2, 12, cv.width - bw - 12), by = Math.max(12, py - bh - 18);
    const shake = big ? (Math.random() - .5) * 6 * (1 - Math.min(1, lt / .8)) : 0;
    ctx.globalAlpha = k; ctx.translate(shake, shake);
    ctx.fillStyle = big || caps ? '#d4223a' : '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(clamp(px, bx + 16, bx + bw - 16) - 9, by + bh); ctx.lineTo(px, py); ctx.lineTo(clamp(px, bx + 16, bx + bw - 16) + 9, by + bh); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh);
    ctx.textAlign = 'center'; ctx.fillStyle = big || caps ? '#fff' : '#1a0d10'; ctx.fillText(cur[1], bx + bw / 2, by + bh / 2 + fs * .34);
    ctx.restore();
  }
  function bossScene(t0, t1){
    let c = null, fr = 0;
    return { t0, t1, enter(){ loadLevel(6, 6); G.ents = []; V.noSay = true; const b = G.boss; b.heartT = 999; b.shootT = 1.5; bossFrac = 1;
        c = makeActor(5, 16, 13, 1); setActors([c]); camera({ x:544, y:300 }, 1.25, 0, true); fr = 0;
        G.popup = { text:'JEFE FINAL', sub:'El Silenciador', t:2.6, color:'#ff5cc6', scale:1.5 }; },
      update(t){
        const P = c.p, K = c.keys = {}; if (c.hold > 0) { K.jump = true; c.hold--; }
        // César se mueve debajo del jefe, salta en algunos golpes y grita en los énfasis de la letra
        const b = G.boss, dx = (b.x + b.w / 2) - (P.x + P.w / 2);
        if (Math.abs(dx) > 80) { K.right = dx > 0; K.left = dx < 0; }
        for (const bt of beatsIn(t - DT / 2, t + DT / 2)) { const k = cfg.beats.indexOf(bt); if (k % 8 === 4 && P.onGround) { c.hit.jump = true; c.hold = 22; } }
        for (const s of [156.99, 171.99, 165.14]) if (Math.abs(t - s) < DT / 2) { P.shoutCD = 0; c.hit.shout = true; bossFrac -= .05; }
        if ((fr % 150) === 0) spawnPoser(fr % 300 === 0);
        if (fr % 30 === 0 && G.ents.some(e => e.t === 'E' && !e.dead && Math.abs(e.x - P.x) < 110)) c.hit.attack = true;
        fr++; G.videoStep(DT); bossHold();
        camera({ x:P.x + P.w / 2, y:P.y - 90 }, 1.25, 0, false, 4);
      },
      draw(t){ G.render(); lyric(t, c.p); } };
  }
  function turnsScene(t0, t1){
    const order = [1, 3, 2, 0]; let i = -1, a = null, fr = 0;
    const cuts = []; for (let k = 0; k < 4; k++) cuts.push(t0 + (t1 - t0) * k / 4);
    const pos = { 1:[26, 9, -1], 3:[8, 13, 1], 2:[28, 13, -1], 0:[4, 13, 1] };
    return { t0, t1, enter(){ arena(); i = -1; },
      update(t){
        const k = cuts.filter(c => c <= t).length - 1;
        if (k !== i) { i = k; const h = order[k], [tx, ty, face] = pos[h]; a = makeActor(h, tx, ty, face); setActors([a]); fr = 0; G.ents = [];
          spawnPoser(face < 0); spawnPoser(face < 0); camera(centerOf(a.p), 1.8, 90 * face, true); }
        a.keys = {}; if (a.hold > 0) { a.keys.jump = true; a.hold--; }
        if (fr === 30) { a.p.shoutCD = 0; a.hit.shout = true; bossFrac -= .045; }
        if (a.hero === 0 && fr === 85) { a.hit.jump = true; a.hold = 26; }
        fr++; G.videoStep(DT); bossHold();
        camera(centerOf(a.p), 1.8, 90 * a.p.face);
      },
      draw(t){ G.render(); const lt = t - cuts[Math.max(0, i)], h = order[Math.max(0, i)];
        const k = Math.min(1, lt / .15, Math.max(0, (2.4 - lt) / .3)); if (k <= 0) return;
        const pw = { 1:'TOM', 3:'ONDA DE BAJO', 2:'BARRIL DE CERVEZA', 0:'RODADA' }[h];
        band(430, 80, .55 * k);
        text(BAND[h].name.toUpperCase(), 34, 468, { align:'left', font:'38px "Metal Mania", fantasy', color:BAND[h].col, alpha:k, sh:3 });
        text(pw, 36, 496, { align:'left', font:'11px "Press Start 2P", monospace', color:'#e9dcc5', alpha:k, sh:2 }); } };
  }
  function soloScene(t0, t1){
    let a = null, fr = 0;
    return { t0, t1, enter(){ arena(); G.ents = []; a = makeActor(4, 15, 5, 1); setActors([a]); fr = 0; camera(centerOf(a.p), 1.6, 0, true);
        G.popup = { text:'SOLO DE LEO', sub:'Guitarra líder II', t:2.6, color:BAND[4].col, scale:1.3 }; },
      update(t){
        const P = a.p; a.keys = {}; if (a.hold > 0) { a.keys.jump = true; a.hold--; }
        const b = G.boss, bx = b.x + b.w / 2; P.face = bx >= P.x + P.w / 2 ? 1 : -1;
        // camina un poco sobre la plataforma central siguiendo al jefe
        const dx = bx - (P.x + P.w / 2); if (Math.abs(dx) > 40 && P.x > 13 * 32 + 4 && P.x < 20 * 32 - 24) { a.keys.right = dx > 0; a.keys.left = dx < 0; }
        if (P.x <= 13 * 32 + 4) a.keys.right = true; if (P.x >= 20 * 32 - 24) a.keys.left = true;
        for (const bt of beatsIn(t - DT / 2, t + DT / 2)) { a.hit.attack = true; bossFrac -= .003; }   // una nota en cada golpe del solo
        if (Math.abs(t - (t1 - .8)) < DT / 2) { P.shoutCD = 0; a.hit.shout = true; }                  // remata el solo con el guitarrazo
        if (fr % 120 === 0) { spawnPoser(true); spawnPoser(false); }
        fr++; G.videoStep(DT); bossHold();
        camera({ x:P.x + P.w / 2, y:P.y - 40 }, 1.6, 0, false, 4);
      },
      draw(){ G.render(); } };
  }

  /* ---------- clímax ---------- */
  function climaxScene(t0, t1){
    const WIND = { 1:.28, 3:.3, 2:.35, 0:0, 4:.58, 5:0 }, LEAD = { 1:90, 3:130, 2:100, 0:70, 4:90, 5:0 };
    let actors = [], events = [], shots = [], hpPlan = [], spawnT = 0, targetT = 0, sideL = true, finalT = 0, startFrac = 1;
    function actor(hero, x, face, i){ const p = G.newPlayer({ x, y:-90 - i * 40 }); p.face = face; p.life = 4; return { hero, p, keys:{}, hit:{}, hold:0 }; }
    return { t0, t1, enter(){
        arena(); G.ents = []; V.noSay = false; startFrac = bossFrac;
        const b = G.boss; b.shootT = 1.2; b.spawnT = 3; b.heartT = 999;
        actors = [actor(0, 110, 1, 0), actor(3, 330, 1, 1), actor(2, 980, -1, 2), actor(4, 230, 1, 3), actor(1, 830, -1, 4), actor(5, 520, 1, 5)];
        setActors(actors, actors[5].p);
        const B = beatsIn(t0 + .6, t1).map(x => x - t0);
        const fin = 238.42 - t0, finalIdx = B.reduce((bi, x, i) => Math.abs(x - fin) < Math.abs(B[bi] - fin) ? i : bi, 0); finalT = B[finalIdx];
        const by = h => actors.find(a => a.hero === h), plan = [];
        [1, 3, 2, 0, 4, 5].forEach((h, k) => plan.push({ beat:B[4 * k], h }));
        const cyc = [1, 3, 2, 0, 4, 5];
        for (let i = 24, k = 0; i <= finalIdx - 6; i += 2, k++) plan.push({ beat:B[i], h:cyc[k % 6] });
        for (const h of [0, 1, 2, 3, 4, 5]) plan.push({ beat:finalT, h, final:true });
        shots = [{ t:0, a:null, zoom:1 }];
        plan.filter(e => !e.final).forEach((e, i) => shots.push({ t:Math.max(0, e.beat - WIND[e.h]) - .15, a:by(e.h), lead:LEAD[e.h], zoom:i < 6 ? 1.9 : 1.55 }));
        shots.push({ t:B[finalIdx - 4] - .1, a:null, zoom:1 });
        const regular = plan.filter(e => !e.final).length;
        events = [];
        plan.forEach(e => { const a = by(e.h), press = Math.max(0, e.beat - WIND[e.h]);
          events.push({ t:press, run:() => { a.p.shoutCD = 0; if (e.h === 0) a.p.rollT = 0; a.hit.shout = true; } });
          if (e.h === 0) events.push({ t:press + .9, run:() => { a.hit.jump = true; a.hold = 17; } }); });
        let k = 0; hpPlan = [{ t:0, frac:startFrac }];
        plan.filter(e => !e.final).forEach(e => { k++; hpPlan.push({ t:e.beat, frac:startFrac * (1 - .92 * k / regular) }); });
        hpPlan.push({ t:finalT, frac:0 });
        events.push({ t:finalT, run:() => { const b = G.boss; if (b && !b.dead) { b.hp = .01; G.bossDamage(5); G.shake = 34; G.flashT = .3; } } });
        events.push({ t:.15, run:() => { G.popup = { text:'¡TODOS CONTRA EL SILENCIADOR!', t:2.4, color:'#ffe14d', scale:1.25 }; } });
        events.push({ t:B[finalIdx - 4], run:() => { G.popup = { text:'¡AHORA!', t:1.6, color:'#ff5a6e', scale:2 }; } });
        events.sort((x, y) => x.t - y.t);
        camera({ x:544, y:292 }, 1, 0, true);
      },
      update(t){
        const lt = t - t0;
        while (events.length && events[0].t <= lt) events.shift().run();
        for (const a of actors) { a.keys = {}; if (a.hold > 0) { a.keys.jump = true; a.hold--; } }
        if ((spawnT -= DT) <= 0 && lt < finalT - .5) { spawnPoser(sideL); sideL = !sideL; spawnT = 1.25; }
        if ((targetT -= DT) <= 0) { V.target = actors[Math.floor(Math.random() * actors.length)].p; targetT = 1.1; }
        G.videoStep(DT);
        let frac = startFrac; for (const h of hpPlan) if (h.t <= lt) frac = h.frac; bossFrac = frac; bossHold();
        let s = shots[0]; for (const x of shots) if (x.t <= lt) s = x;
        camera(s.a ? centerOf(s.a.p) : { x:544, y:292 }, s.zoom, s.a ? (s.lead || 0) * s.a.p.face : 0);
      },
      draw(){ G.render(); } };
  }

  /* ---------- final ---------- */
  // El escenario del final ocupa la parte de arriba del lienzo: se amplía para que la banda se vea grande
  const stageCv = document.createElement('canvas');
  function zoomStage(z = 1.45, cx = cv.width / 2, cy = 196){
    stageCv.width = cv.width; stageCv.height = 540; const g = stageCv.getContext('2d'); g.drawImage(cv, 0, 0);
    const w = cv.width / z, h = 540 / z, sx = clamp(cx - w / 2, 0, cv.width - w), sy = clamp(cy - h / 2, 0, 540 - h);
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(stageCv, sx, sy, w, h, 0, 0, cv.width, 540); ctx.restore();
  }
  const CREDITS = [[0, 'Guitarra de backup'], [1, 'Batería'], [2, 'Guitarra líder I'], [3, 'Bajo'], [4, 'Guitarra líder II'], [5, 'Voz']];
  function endingScene(t0, t1){
    return { t0, t1, enter(){ setActors([]); G.state = 'ending'; },
      update(){ G.videoStep(DT); },
      draw(t){ G.render(); zoomStage(); const lt = t - t0;
        const tk = Math.min(1, lt / .4, Math.max(0, (4.2 - lt) / .4));
        if (tk > 0) { band(70, 120, .55 * tk); text('¡NOS HAS SALVADO!', cv.width / 2, 140, { font:'64px "Metal Mania", fantasy', color:'#ffe14d', alpha:tk, glow:'rgba(212,34,58,.8)', blur:20 }); text('El metal vuelve a sonar en Bogotá', cv.width / 2, 178, { font:'30px VT323, monospace', color:'#e9dcc5', alpha:tk }); }
        const span = (t1 - t0 - 4.2) / CREDITS.length, ci = Math.floor((lt - 4.2) / span);
        if (ci >= 0 && ci < CREDITS.length) { const [h, role] = CREDITS[ci], cl = lt - 4.2 - ci * span, k = Math.min(1, cl / .25, Math.max(0, (span - cl) / .25));
          band(388, 116, .6 * k);
          text(BAND[h].name.toUpperCase(), 40 - (1 - k) * 30, 446, { align:'left', font:'52px "Metal Mania", fantasy', color:BAND[h].col, alpha:k, sh:3 });
          text(role.toUpperCase(), 44 - (1 - k) * 30, 482, { align:'left', font:'12px "Press Start 2P", monospace', color:'#e9dcc5', alpha:k, sh:2 }); } } };
  }
  function outroScene(t0, t1){
    return { t0, t1, enter(){ setActors([]); G.state = 'ending'; },
      update(){ G.videoStep(DT); },
      draw(t){ G.render(); zoomStage(); const lt = t - t0;
        ctx.save(); ctx.globalAlpha = .78; ctx.fillStyle = '#07030a'; ctx.fillRect(0, 0, cv.width, 540); ctx.restore();
        const seg = (a, b) => Math.min(1, (lt - a) / .4, Math.max(0, (b - lt) / .4));
        let k = seg(0, 9.5);
        if (k > 0) {
          text('JUEGA GRATIS', cv.width * .36, 150, { font:'16px "Press Start 2P", monospace', color:'#ff5a6e', alpha:k });
          text('La Gira Maldita', cv.width * .36, 232, { font:'74px "Metal Mania", fantasy', color:'#e9dcc5', alpha:k, glow:'rgba(212,34,58,.8)', blur:22 });
          text('evil-death.vercel.app', cv.width * .36, 300, { font:'46px VT323, monospace', color:'#ffe14d', alpha:k });
          text('Desde el celular, sin descargar nada', cv.width * .36, 342, { font:'30px VT323, monospace', color:'#a3949a', alpha:k });
          if (qrImg && qrImg.complete) { ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = '#fff'; ctx.fillRect(cv.width * .7 - 6, 120 - 6, 232, 232); ctx.imageSmoothingEnabled = false; ctx.drawImage(qrImg, cv.width * .7, 120, 220, 220); ctx.restore(); }
        }
        k = seg(9.5, 19);
        if (k > 0) {
          text('SIGUE A EVIL DEATH', cv.width / 2, 170, { font:'16px "Press Start 2P", monospace', color:'#ff5a6e', alpha:k });
          text('linktr.ee/evildeathofficial', cv.width / 2, 250, { font:'58px VT323, monospace', color:'#e9dcc5', alpha:k });
          text('TikTok · Instagram · X · Facebook · Threads', cv.width / 2, 300, { font:'32px VT323, monospace', color:'#a3949a', alpha:k });
        }
        k = seg(19, t1 - t0 + 1);
        if (k > 0) {
          text('CONTRATACIONES', cv.width / 2, 170, { font:'16px "Press Start 2P", monospace', color:'#ff5a6e', alpha:k });
          text('Tatiana · Manager', cv.width / 2, 246, { font:'60px "Metal Mania", fantasy', color:'#e9dcc5', alpha:k });
          text('WhatsApp +57 320 362 3738', cv.width / 2, 300, { font:'40px VT323, monospace', color:'#25d366', alpha:k });
        } } };
  }

  /* ---------- API ---------- */
  const DIR = {};
  DIR.setup = c => {
    cfg = c;
    G.save.wins = 0;
    if (c.qr) { qrImg = new Image(); qrImg.src = c.qr; }
    DIR.scenes = buildScenes();
  };
  DIR.frame = () => {
    const t = cfg.start + f / FPS;
    const s = DIR.scenes.find(x => t >= x.t0 && t < x.t1) || DIR.scenes[DIR.scenes.length - 1];
    if (s !== scene) { scene = s; s.enter(); }
    s.update(t);
    s.draw(t);
    f++;
    return cv.toDataURL('image/png');
  };
  DIR.info = () => ({ f, t:+(cfg.start + f / FPS).toFixed(2), scene:DIR.scenes.indexOf(scene), state:G.state, actors:(V.actors || []).map(a => ({ who:NAME(a.hero), x:Math.round(a.p.x), y:Math.round(a.p.y), st:a.p.state })), hp:G.boss && +G.boss.hp.toFixed(2) });
  DIR.seek = t => { f = Math.round((t - cfg.start) * FPS); };
  window.DIR = DIR;
})();
