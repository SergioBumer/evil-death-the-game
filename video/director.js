/* Director del videoclip de "Herencia maldita".
   Se inyecta en la página del juego (modo video: window.__VIDEO) y produce un cuadro por llamada a DIR.frame().
   Todo es determinista: la aleatoriedad del juego usa una semilla fija (ver render.mjs). */
(() => {
  const G = window.__gira, V = window.__VIDEO;
  const FPS = 60;
  // Ventana de espera de cada poder entre que se pulsa y el impacto (para que el impacto caiga en el golpe de la canción)
  const WIND = { 1: .28, 3: .3, 2: .35, 0: 0, 4: .58, 5: 0 };
  const NAME = ['Sergio', 'Rodrigo', 'Fabián', 'Andrés', 'Leo', 'César'];

  const DIR = {};
  let actors = [], events = [], f = 0, hpPlan = [], spawnT = 0, targetT = 0, sideL = true, cfg = null;
  // Cámara: lista de tomas {t, a (actor a seguir o null = plano general), lead (adelanto hacia donde mira), zoom}
  let shots = [], zoom = 1;
  const MAP_W = 34 * 32, MAP_H = 17 * 32;
  // cuánto adelantar la cámara hacia donde mira cada músico (lo que lanza va hacia allá)
  const LEAD = { 1:90, 3:130, 2:100, 0:70, 4:90, 5:0 };

  function actor(hero, x, ground, face, i){
    const p = G.newPlayer({ x, y:-90 - i * 40 });      // entran cayendo desde arriba
    p.face = face; p.life = 4;
    return { hero, p, keys:{}, hit:{}, holdJump:0 };
  }

  DIR.setup = (c) => {
    cfg = c;
    G.save.wins = 0; G.loadLevel(6); G.powers = 6;
    G.ents = [];                                        // los posers los mete el director
    const b = G.boss; b.shootT = 1.2; b.spawnT = 3; b.heartT = 999;
    actors = [
      actor(0, 110, 'piso', 1, 0),                      // Sergio
      actor(3, 330, 'piso', 1, 1),                      // Andrés
      actor(2, 980, 'piso', -1, 2),                     // Fabián
      actor(4, 230, 'plataforma izq.', 1, 3),           // Leo
      actor(1, 830, 'plataforma der.', -1, 4),          // Rodrigo
      actor(5, 520, 'plataforma central', 1, 5),        // César
    ];
    V.actors = actors; V.god = true; V.target = actors[5].p;
    G.cam.x = 64; G.clampCam();

    // ---- guion ----
    const B = c.beats;                                  // golpes relativos al inicio del clip (s)
    const by = h => actors.find(a => a.hero === h);
    const plan = [];
    // 1) ronda de presentación: un poder cada 4 golpes
    [1, 3, 2, 0, 4, 5].forEach((h, k) => plan.push({ beat:B[4 * k], h }));
    // 2) doble tiempo: un poder cada 2 golpes
    const cyc = [1, 3, 2, 0, 4, 5];
    for (let i = 24, k = 0; i <= c.lastDouble; i += 2, k++) plan.push({ beat:B[i], h:cyc[k % 6] });
    // 3) remate: los seis a la vez en el golpe final
    const fin = B[c.finalIdx];
    for (const h of [0, 1, 2, 3, 4, 5]) plan.push({ beat:fin, h, final:true });

    // tomas: plano general de entrada, cada poder en primer plano y plano general para el remate
    shots.push({ t:0, a:null, zoom:1 });
    plan.filter(e => !e.final).forEach((e, i) => shots.push({ t:Math.max(0, e.beat - WIND[e.h]) - .15, a:by(e.h), lead:LEAD[e.h], zoom:i < 6 ? 1.9 : 1.55 }));
    shots.push({ t:B[c.finalIdx - 4] - .1, a:null, zoom:1 });
    shots.sort((a, b) => a.t - b.t);
    const regular = plan.filter(e => !e.final).length;
    plan.forEach(e => {
      const a = by(e.h);
      const press = Math.max(0, e.beat - WIND[e.h]);
      events.push({ t:press, run:() => {
        a.p.shoutCD = 0;                                // el guion manda: sin esperar recarga
        if (e.h === 0) a.p.rollT = 0;
        if (e.face) a.p.face = e.face;
        a.hit.shout = true;
      }});
      if (e.h === 0) events.push({ t:press + .9, run:() => { a.hit.jump = true; a.holdJump = .28; } });   // Sergio salta rodando
    });
    // vida del jefe: baja en cada impacto y llega a cero en el remate
    let k = 0;
    plan.filter(e => !e.final).forEach(e => { k++; hpPlan.push({ t:e.beat, frac:1 - .92 * k / regular }); });
    hpPlan.push({ t:fin, frac:0 });
    events.push({ t:fin, run:() => { const b = G.boss; if (b && !b.dead) { b.hp = .01; G.bossDamage(5); G.shake = 34; G.flashT = .3; } } });
    // letreros
    events.push({ t:.15, run:() => { G.popup = { text:'¡TODOS CONTRA EL SILENCIADOR!', t:2.4, color:'#ffe14d', scale:1.25 }; } });
    events.push({ t:B[c.finalIdx - 4], run:() => { G.popup = { text:'¡AHORA!', t:1.6, color:'#ff5a6e', scale:2 }; } });
    events.sort((a, b) => a.t - b.t);
  };

  function spawnPoser(){
    const alive = G.ents.filter(e => e.t === 'E' && !e.dead).length;
    if (alive >= 6) return;
    const left = sideL; sideL = !sideL;
    const x = left ? 40 : 1020;
    G.ents.push({ t:'E', x, y:408, w:24, h:40, vx:left ? 60 : -60, vy:0, hp:2, hurt:0, anim:Math.random() * 6 });
  }

  DIR.frame = () => {
    const dt = 1 / FPS, t = f / FPS;
    while (events.length && events[0].t <= t) events.shift().run();
    for (const a of actors) {
      a.keys = {};
      if (a.holdJump > 0) { a.keys.jump = true; a.holdJump -= dt; }
    }
    // posers que entran por los lados para que los poderes tengan a quién pegarle
    if ((spawnT -= dt) <= 0 && t < cfg.finalT - .5) { spawnPoser(); spawnT = 1.25; }
    // el jefe le dispara a un músico distinto cada rato
    if ((targetT -= dt) <= 0) { V.target = actors[Math.floor(Math.random() * actors.length)].p; targetT = 1.1; }
    G.videoStep(dt);
    // vida del jefe según el guion
    const b = G.boss;
    if (b && !b.dead) {
      let frac = 1; for (const h of hpPlan) if (h.t <= t) frac = h.frac;
      const target = Math.max(.01, frac) * b.max;
      if (target < b.hp - .001) b.hurt = .18;
      b.hp = target;
    }
    // cámara: sigue la toma actual con zoom y movimiento suaves, sin salirse del escenario
    let shot = shots[0]; for (const s of shots) if (s.t <= t) shot = s;
    zoom += (shot.zoom - zoom) * Math.min(1, dt * 5);
    const vw = document.getElementById('c').width / zoom, vh = 540 / zoom;
    let fx = MAP_W / 2, fy = MAP_H / 2 + 20;
    if (shot.a) { const p = shot.a.p; fx = p.x + p.w / 2 + (shot.lead || 0) * p.face; fy = p.y + p.h / 2 - 34; }
    const clampX = x => Math.max(0, Math.min(MAP_W - vw, x)), clampY = y => Math.max(0, Math.min(MAP_H - vh, y));
    G.cam.x = clampX(G.cam.x + (clampX(fx - vw / 2) - G.cam.x) * Math.min(1, dt * 7));
    G.cam.y = clampY(G.cam.y + (clampY(fy - vh / 2) - G.cam.y) * Math.min(1, dt * 7));
    V.zoom = zoom;
    G.render();
    f++;
    return document.getElementById('c').toDataURL('image/png');
  };
  DIR.info = () => ({ f, actors:actors.map(a => ({ who:NAME[a.hero], x:Math.round(a.p.x), y:Math.round(a.p.y) })), state:G.state, hp:G.boss && +G.boss.hp.toFixed(2) });
  window.DIR = DIR;
})();
