// Riding-school figures in the indoor arena (le manège): a figure is traced on the sand, you ride (or lead) it, the game
// judges how well you stayed on the trace and says the figure's name out loud. With no figure chosen ("mode libre") it
// watches what you ride and recognises a volte, demi-volte (renversée), diagonale, serpentine or cercle on its own.
//
// Geometry works in arena-local coordinates: u along the long side (from A towards C), v across, origin at the centre;
// (u, v) -> world keeps the handedness of (x, z), so "counter-clockwise in (u, v)" is the right rein (main droite) and
// clockwise is the left rein (main gauche). Figures are written for the right rein and mirrored (v -> -v) for the left.
export function init(SU) {
  const THREE = SU.THREE, { clamp, TAU } = SU.util;
  const AR = SU.world.places && SU.world.places.arena;
  if (!AR) return;
  const PI = Math.PI;

  // ---------------------------------------------------------------- arena frame
  const cx = (AR.minX + AR.maxX) / 2, cz = (AR.minZ + AR.maxZ) / 2;
  const longX = AR.maxX - AR.minX >= AR.maxZ - AR.minZ;
  let Lx = longX ? 1 : 0, Lz = longX ? 0 : 1;
  const LET = AR.letters || {};
  if (LET.A && LET.C && (LET.C.x - LET.A.x) * Lx + (LET.C.z - LET.A.z) * Lz < 0) { Lx = -Lx; Lz = -Lz; }
  const Wx = -Lz, Wz = Lx;
  const HL = (longX ? AR.maxX - AR.minX : AR.maxZ - AR.minZ) / 2, HW = (longX ? AR.maxZ - AR.minZ : AR.maxX - AR.minX) / 2;
  const TRACK = 1.1, a = HL - TRACK, b = HW - TRACK;            // the track ("la piste"), 1.1 m inside the walls
  const RC = Math.min(3, b - 1);                                // corners of the track are ridden round, not square
  const UQ = Math.max(3, HL - 6);                               // quarter letters (K, F, H, M) stand 6 m from the short sides
  const FLOOR = (SU.world.places.y ?? 0) + 0.05;
  const toW = (u, v, o) => { o.x = cx + u * Lx + v * Wx; o.z = cz + u * Lz + v * Wz; return o; };
  const toL = (x, z, o) => { const dx = x - cx, dz = z - cz; o.u = dx * Lx + dz * Lz; o.v = dx * Wx + dz * Wz; return o; };
  const letL = [];
  for (const k in LET) { if (LET[k]) { const p = toL(LET[k].x, LET[k].z, {}); letL.push({ k, u: p.u, v: p.v }); } }
  const letterNear = (u, v, max = 3.6) => { let best = null, bd = max; for (const l of letL) { const d = Math.hypot(l.u - u, l.v - v); if (d < bd) { bd = d; best = l.k; } } return best; };
  const L = { u: 0, v: 0 }, W = { x: 0, z: 0 };
  const inArena = (x, z, m = 0.2) => { toL(x, z, L); return Math.abs(L.u) < HL - m && Math.abs(L.v) < HW - m; };

  // ---------------------------------------------------------------- path builder (local coordinates)
  function builder() {
    const pts = [], keys = [];
    const B = {
      pts, keys,
      at(u, v) { pts.push(u, v); return B; },
      line(u, v) {
        const n = pts.length, u0 = pts[n - 2], v0 = pts[n - 1], k = Math.max(1, Math.ceil(Math.hypot(u - u0, v - v0) / 0.5));
        for (let i = 1; i <= k; i++) pts.push(u0 + (u - u0) * i / k, v0 + (v - v0) * i / k);
        return B;
      },
      arc(cu, cv, ang) {                                          // around (cu, cv) by ang (+ = counter-clockwise)
        const n = pts.length, du = pts[n - 2] - cu, dv = pts[n - 1] - cv, r = Math.hypot(du, dv), a0 = Math.atan2(dv, du);
        const k = Math.max(2, Math.ceil(Math.abs(ang) * r / 0.4));
        for (let i = 1; i <= k; i++) { const t = a0 + ang * i / k; pts.push(cu + r * Math.cos(t), cv + r * Math.sin(t)); }
        return B;
      },
      key() { keys.push(pts.length / 2 - 1); return B; },
    };
    return B;
  }
  // on the right rein, down the A short side: from the F corner to the point (−a, v)
  const leadA = (P, v) => P.at(-a + RC + 2.5, b).line(-a + RC, b).arc(-a + RC, b - RC, PI / 2).line(-a, v);

  // ---------------------------------------------------------------- the figures (FFE definitions), right rein
  // r: volte radius for this horse. Each build returns the builder; `where` names the figure's letters.
  const FIGS = [
    { id: 'volte', name: 'Volte', art: 'une volte', pace: 'pas', icon: '⭕',
      what: 'Un petit rond, et tu reviens sur la piste à la même main.',
      build: (r) => builder().at(-7, -b).line(0, -b).key().arc(0, -b + r, TAU).line(5, -b),
      where: (l) => l[0] && `en ${l[0]}` },
    { id: 'demivolte', name: 'Demi-volte', art: 'une demi-volte', pace: 'pas', icon: '↩️',
      what: 'Un demi-rond, puis une ligne en biais : tu as changé de main.',
      build: (r) => { const u0 = a * 0.45; return builder().at(u0 - 7, -b).line(u0, -b).key().arc(u0, -b + r, PI).key().line(u0 - 3 * r, -b).key().line(u0 - 3 * r - 5, -b); },
      where: (l) => l[0] && `en ${l[0]}` },
    { id: 'renversee', name: 'Demi-volte renversée', art: 'une demi-volte renversée', pace: 'pas', icon: '↪️',
      what: 'Une ligne en biais, puis un demi-rond : tu as changé de main.',
      build: (r) => { const u1 = -a * 0.45; return builder().at(u1 - 7, -b).line(u1, -b).key().line(u1 + 3 * r, -b + 2 * r).key().arc(u1 + 3 * r, -b + r, -PI).key().line(u1 + 3 * r - 5, -b); },
      where: (l) => l[0] && `en ${l[0]}` },
    { id: 'diagonale', name: 'Diagonale', art: 'une diagonale', pace: 'trot', icon: '↘️',
      what: "Tu as traversé le manège en biais, d'un coin à l'autre : tu as changé de main.",
      build: () => builder().at(a, -2).line(a, b - RC).arc(a - RC, b - RC, PI / 2).line(UQ, b).key().line(-UQ, -b).key().line(-a + RC + 1, -b),
      where: (l) => l[0] && l[1] && `de ${l[0]} à ${l[1]}` },
    { id: 'serpentine', name: 'Serpentine', art: 'une serpentine', pace: 'trot', icon: '〰️',
      what: "Trois boucles d'un bout à l'autre du manège.",
      build: () => {
        const r = Math.min(a / 3, b - 0.5), h = b - r, u = (i) => -a + i * r;   // three half circles touching the long sides, joined across the centre line
        const P = leadA(builder(), -h).key();
        P.arc(u(1), -h, PI).key().line(u(2), h).arc(u(3), h, -PI).key().line(u(4), -h).arc(u(5), -h, PI).key();
        return P.line(a, Math.min(b - RC, 3));
      },
      where: (l) => l[0] && l[3] && `de ${letterNear(-a, 0, 4) || l[0]} à ${letterNear(a, 0, 4) || l[3]}` },
    { id: 'cercle', name: 'Cercle', art: 'un cercle', pace: 'trot', icon: '🔵',
      what: 'Un grand rond de toute la largeur du manège.',
      build: () => leadA(builder(), 0).key().arc(-a + b, 0, TAU).line(-a, -(b - RC)),
      where: (l) => l[0] && `en ${l[0]}` },
    { id: 'doublerL', name: 'Doubler dans la largeur', said: 'Tu as doublé dans la largeur.', pace: 'trot', icon: '⬆️',
      what: "Tu as traversé le manège tout droit, d'une piste à l'autre.",
      build: () => { const d = 2.5; return builder().at(-8, -b).line(-d, -b).arc(-d, -b + d, PI / 2).key().line(0, b - d).key().arc(-d, b - d, PI / 2).line(-8, b); },
      where: () => { const p = letterNear(0, -b), q = letterNear(0, b); return p && q && `de ${p} à ${q}`; } },
    { id: 'doublerLong', name: 'Doubler dans la longueur', said: 'Tu as doublé dans la longueur.', pace: 'trot', icon: '➡️',
      what: 'Tu as traversé le manège dans la longueur, sur la ligne du milieu.',
      build: () => { const d = 2.5; return leadA(builder(), d).arc(-a + d, d, PI / 2).key().line(a - d, 0).key().arc(a - d, d, PI / 2).line(a, b - RC); },
      where: () => { const p = letterNear(-a, 0, 4), q = letterNear(a, 0, 4); return p && q && `de ${p} à ${q}`; } },
  ];
  const FIG = Object.fromEntries(FIGS.map(f => [f.id, f]));
  const REIN = { D: 'main droite', G: 'main gauche' };
  const PACE = { pas: 'au pas', trot: 'au trot' };
  const volteR = (B) => (B && B.S < 0.85 ? 4 : 5);                // 8 m volte on a pony, 10 m on a horse (they turn ~1.5 rad/s at walk and trot)

  // build a figure for a rein: local points (for the menu drawing) and the world polyline (for the trace and the judge)
  function makePath(f, rein, B) {
    const P = f.build(volteR(B)), m = rein === 'G' ? -1 : 1, lp = P.pts;
    if (m < 0) for (let i = 1; i < lp.length; i += 2) lp[i] = -lp[i];
    return finishPath(lp, P.keys, f, rein);
  }
  function finishPath(lp, keys, f, rein) {
    const n = lp.length / 2, x = new Float32Array(n), z = new Float32Array(n), s = new Float32Array(n);
    for (let i = 0; i < n; i++) { toW(lp[2 * i], lp[2 * i + 1], W); x[i] = W.x; z[i] = W.z; if (i) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]); }
    const lets = keys.map(k => letterNear(lp[2 * k], lp[2 * k + 1]));
    return { f, rein, lp, keys, x, z, s, n, total: s[n - 1], where: f && f.where ? f.where(lets) || '' : '' };
  }

  // ---------------------------------------------------------------- the trace on the sand: one merged mesh, one draw call
  const mat = new THREE.ShaderMaterial({
    uniforms: { uProg: { value: -1 }, uTime: { value: 0 } },
    vertexShader: `attribute vec3 acol; attribute float along; uniform float uProg, uTime; varying vec3 vC;
      void main() {
        vec3 c = acol;
        if (uProg >= 0.0) {
          float passed = step(along, uProg);
          c = mix(c, vec3(0.25, 0.82, 0.36), passed * 0.85);
          float ahead = along - uProg;
          c += (1.0 - passed) * smoothstep(7.0, 0.0, ahead) * (0.18 + 0.12 * sin(uTime * 5.0 - along * 1.3));
        }
        vC = c; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `varying vec3 vC; void main() { gl_FragColor = vec4(vC, 0.92); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  let trace = null;
  function buildTrace(p) {
    const pos = [], col = [], al = [];
    const C = { path: [0.16, 0.42, 1.0], arrow: [1, 1, 1], mark: [1, 0.95, 0.6], red: [0.86, 0.16, 0.14], white: [0.97, 0.97, 0.95] };
    const tri = (ax, ay, az, bx, by, bz, qx, qy, qz, c, s) => { pos.push(ax, ay, az, bx, by, bz, qx, qy, qz); for (let i = 0; i < 3; i++) { col.push(c[0], c[1], c[2]); al.push(s); } };
    const quad = (p0, p1, p2, p3, c, s) => { tri(...p0, ...p1, ...p2, c, s); tri(...p0, ...p2, ...p3, c, s); };
    const at = (s, o = {}) => {                                  // point and unit tangent at arc length s
      let i = 0; while (i < p.n - 2 && p.s[i + 1] < s) i++;
      const L = p.s[i + 1] - p.s[i] || 1, t = clamp((s - p.s[i]) / L, 0, 1);
      o.x = p.x[i] + (p.x[i + 1] - p.x[i]) * t; o.z = p.z[i] + (p.z[i + 1] - p.z[i]) * t;
      o.tx = (p.x[i + 1] - p.x[i]) / L; o.tz = (p.z[i + 1] - p.z[i]) / L; return o;
    };
    const y = FLOOR;
    const strip = (s0, s1, w, c, dy = 0) => {
      let q = at(s0);
      for (let s = s0; s < s1 - 1e-3;) {
        const sn = Math.min(s1, s + 0.3), r = at(sn);
        quad([q.x - q.tz * w, y + dy, q.z + q.tx * w], [q.x + q.tz * w, y + dy, q.z - q.tx * w], [r.x + r.tz * w, y + dy, r.z - r.tx * w], [r.x - r.tz * w, y + dy, r.z + r.tx * w], c, s);
        q = r; s = sn;
      }
    };
    // dashes and arrows: dash, gap, dash, gap, arrow, gap
    for (let s = 0.4; s < p.total - 0.6; s += 3.8) {
      strip(s, Math.min(s + 1.0, p.total), 0.16, C.path);
      if (s + 1.4 < p.total) strip(s + 1.4, Math.min(s + 2.4, p.total), 0.16, C.path);
      if (s + 3.4 < p.total) {
        const q = at(s + 2.8), r = at(s + 3.4), w = 0.42;
        tri(r.x, y + 0.004, r.z, q.x - q.tz * w, y + 0.004, q.z + q.tx * w, q.x + q.tz * w, y + 0.004, q.z - q.tx * w, C.arrow, s + 2.8);
      }
    }
    // soft markers (rings) at the figure's key points
    for (const k of p.keys) {
      const mx = p.x[k], mz = p.z[k], sk = p.s[k];
      for (let i = 0; i < 20; i++) {
        const t0 = i / 20 * TAU, t1 = (i + 1) / 20 * TAU, r0 = 0.45, r1 = 0.62;
        quad([mx + Math.cos(t0) * r0, y + 0.002, mz + Math.sin(t0) * r0], [mx + Math.cos(t0) * r1, y + 0.002, mz + Math.sin(t0) * r1],
          [mx + Math.cos(t1) * r1, y + 0.002, mz + Math.sin(t1) * r1], [mx + Math.cos(t1) * r0, y + 0.002, mz + Math.sin(t1) * r0], C.mark, sk);
      }
    }
    // start gate: a chequered bar across the path and two striped poles
    const g = at(0.2), nx = -g.tz, nz = g.tx, GW = 1.4;
    for (let i = 0; i < 6; i++) {
      const o0 = -GW + i * GW / 3, o1 = o0 + GW / 3, d = 0.16, c = i % 2 ? C.white : C.red;
      quad([g.x + nx * o0 - g.tx * d, y + 0.006, g.z + nz * o0 - g.tz * d], [g.x + nx * o1 - g.tx * d, y + 0.006, g.z + nz * o1 - g.tz * d],
        [g.x + nx * o1 + g.tx * d, y + 0.006, g.z + nz * o1 + g.tz * d], [g.x + nx * o0 + g.tx * d, y + 0.006, g.z + nz * o0 + g.tz * d], c, 0);
    }
    for (const sd of [-1, 1]) {
      const px = g.x + nx * sd * (GW + 0.1), pz = g.z + nz * sd * (GW + 0.1), hw = 0.05;
      for (let j = 0; j < 4; j++) {
        const y0 = y + j * 0.3, y1 = y0 + 0.3, c = j % 2 ? C.white : C.red;
        quad([px - g.tx * hw, y0, pz - g.tz * hw], [px + g.tx * hw, y0, pz + g.tz * hw], [px + g.tx * hw, y1, pz + g.tz * hw], [px - g.tx * hw, y1, pz - g.tz * hw], c, 0);
        quad([px - nx * hw, y0, pz - nz * hw], [px + nx * hw, y0, pz + nz * hw], [px + nx * hw, y1, pz + nz * hw], [px - nx * hw, y1, pz - nz * hw], c, 0);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('acol', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('along', new THREE.Float32BufferAttribute(al, 1));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; m.name = 'figureTrace';
    return m;
  }
  function showTrace() { hideTrace(); if (J.path && near) { trace = buildTrace(J.path); SU.scene.add(trace); } }
  function hideTrace() { if (trace) { SU.scene.remove(trace); trace.geometry.dispose(); trace = null; } }

  // ---------------------------------------------------------------- HUD line
  const css = document.createElement('style');
  css.textContent = `
#su-fig { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.15);
  font-size: 13.5px; color: #fff; max-width: 300px; user-select: none; }
#su-fig b { font-weight: 700; color: #f1e3c8; } #su-fig .dim { opacity: .75; }
#su-fig .q { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
#su-fig .q i { width: 11px; height: 11px; border-radius: 50%; background: #888; display: inline-block; }
#su-fig .bar { width: 64px; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.2); overflow: hidden; } #su-fig .bar span { display: block; height: 100%; background: #6fd07f; width: 0; }
body.touch #su-fig { font-size: 12.5px; max-width: 220px; }
.su-btn .ic:has(svg.fig) { width: 52px; }
.su-btn .ic svg.fig { display: block; width: 52px; height: 28px; }`;
  document.head.appendChild(css);
  let hud = null, hudKey = '';
  const hudShow = () => { if (!hud) { hud = SU.ui.el('div'); hud.id = 'su-fig'; (document.getElementById('hud') || document.body).append(hud); hudKey = ''; } };   // a row in the game's HUD panel
  const hudHide = () => { if (hud) { hud.remove(); hud = null; hudKey = ''; } };
  function hudUpdate() {
    const P = SU.player;
    if (!near || !P || (P.mode !== 'ride' && P.mode !== 'lead') || !inArena(SU.st.x, SU.st.z, -2)) { hudHide(); return; }
    hudShow();
    let q = 0, pct = 0;
    if (J.phase === 'run') { q = J.lastD < J.tol * 0.45 ? 3 : J.lastD < J.tol ? 2 : 1; pct = Math.floor(J.prog / J.path.total * 20) * 5; }
    const key = J.path ? `${J.path.f.id}${J.rein}${J.phase}${q}${pct}${J.stars}` : 'libre';
    if (key === hudKey) return; hudKey = key;
    if (!J.path) { hud.innerHTML = `<b>Mode libre</b><span class="dim">fais une figure, je la reconnais !</span>`; return; }
    const f = J.path.f, head = `<b>${f.name}</b><span class="dim">${REIN[J.rein]} · ${PACE[f.pace]}${J.suite ? ' · suite libre' : ''}</span>`;
    let tail;
    if (J.phase === 'wait') tail = `<span class="q"><i style="background:#e34a3a"></i>Va au départ</span>`;
    else if (J.phase === 'done') tail = `<span class="q" style="color:#a9e08f">${stars(J.stars)}</span>`;
    else tail = `<span class="q"><i style="background:${['', '#e86a3a', '#f0b43c', '#58c96a'][q]}"></i>${['', 'Reviens sur le tracé', 'Presque', 'Sur le tracé'][q]}</span><span class="bar"><span style="width:${pct}%"></span></span>`;
    hud.innerHTML = head + tail;
  }
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

  // ---------------------------------------------------------------- sounds and announcements
  function chime() {
    const A = SU.audio; if (!A.audioOk || !A.audioOk()) return;
    const c = A.ctx, t = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(), t0 = t + i * 0.11;
      o.type = 'triangle'; o.frequency.value = f; A.env(g, t0, 0.16, 0.01, 0.55); o.connect(g).connect(A.out); o.start(t0); o.stop(t0 + 0.75);
    });
  }
  function announce(f, { stars: n = 0, lead = false, extra = '' } = {}) {
    const head = f.said ? `Bravo ! ${f.said}` : `Bravo ! C'est ${f.art}${extra}.`;
    SU.toast(`Bravo ! ${f.name}${extra}${lead ? ' en main' : ''}${n ? ' ' + stars(n) : ''}`, 'good');
    SU.ui.say(`${head} ${f.what}`);
    chime();
    SU.emit('figure', f.id, n);
  }
  const riderKey = () => 'figures.' + ((SU.player && SU.player.look && SU.player.look.name) || 'rider');
  const best = () => SU.store.get(riderKey(), {});

  // ---------------------------------------------------------------- guided mode: follow the trace
  const J = { path: null, rein: 'D', phase: 'wait', prog: 0, seg: 0, offT: 0, sumD: 0, sumT: 0, lastD: 0, tol: 1.3, stars: 0, doneT: 0, builtFor: null, suite: false, suiteI: 0 };
  let near = false, autoDone = false, cleared = false;
  const NR = { d: 0, s: 0, i: 0 };
  function nearest(px, pz, i0, i1) {                            // closest point on segments i0..i1-1 (into NR, no allocation)
    const p = J.path; NR.d = 1e9;
    for (let i = i0; i < i1; i++) {
      const ax = p.x[i], az = p.z[i], dx = p.x[i + 1] - ax, dz = p.z[i + 1] - az, l2 = dx * dx + dz * dz || 1e-6;
      const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1), qx = ax + dx * t - px, qz = az + dz * t - pz, d = qx * qx + qz * qz;
      if (d < NR.d) { NR.d = d; NR.i = i; NR.s = p.s[i] + (p.s[i + 1] - p.s[i]) * t; }
    }
    NR.d = Math.sqrt(NR.d); return NR;
  }
  const currentRein = () => {                                    // which way round you are going: D (counter-clockwise in u,v) or G
    const s = SU.st, hx = Math.sin(s.yaw), hz = Math.cos(s.yaw), hu = hx * Lx + hz * Lz, hv = hx * Wx + hz * Wz;
    toL(s.x, s.z, L); return L.u * hv - L.v * hu >= 0 ? 'D' : 'G';
  };
  function select(id, rein, { suite = false } = {}) {
    const f = FIG[id]; if (!f) return;
    J.rein = rein || currentRein(); J.suite = suite; J.builtFor = SU.H && SU.H.B;
    J.path = makePath(f, J.rein, J.builtFor);
    resetRun(); showTrace(); hudKey = '';
    SU.toast(`${f.name} · ${REIN[J.rein]}`, 'info');
  }
  function clear() { J.path = null; J.suite = false; resetRun(); hideTrace(); hudKey = ''; cleared = true; freeReset(); }
  function resetRun() { J.phase = 'wait'; J.prog = 0; J.seg = 0; J.offT = 0; J.sumD = 0; J.sumT = 0; J.stars = 0; mat.uniforms.uProg.value = -1; }
  const SUITE = ['volte', 'demivolte', 'volte', 'renversee', 'diagonale', 'serpentine', 'cercle', 'doublerL', 'doublerLong'];
  function suiteNext() { const id = SUITE[J.suiteI++ % SUITE.length]; select(id, null, { suite: true }); }

  function fail() { SU.toast('Presque ! Reste bien sur le tracé.', 'warn'); resetRun(); }
  function succeed(lead) {
    const p = J.path, f = p.f, m = J.sumD / Math.max(J.sumT, 1e-3), r = m / J.tol;
    const n = r < 0.3 ? 3 : r < 0.55 ? 2 : 1;
    J.stars = n; J.phase = 'done'; J.doneT = 2.5; J.lastMean = m;
    const all = best(), k = f.id + '.' + J.rein; if (!(all[k] >= n)) { all[k] = n; SU.store.set(riderKey(), all); }
    announce(f, { stars: n, lead });
  }

  function judge(dt, time) {
    mat.uniforms.uTime.value = time;
    const P = SU.player, s = SU.st;
    if (!J.path) { autoSuggest(); hudUpdate(); return; }
    if (SU.H && SU.H.B !== J.builtFor) { select(J.path.f.id, J.rein, { suite: J.suite }); }   // another horse: volte size changes
    if (J.phase === 'done') {
      J.doneT -= dt;
      if (J.doneT <= 0) { if (J.suite) suiteNext(); else resetRun(); }
      hudUpdate(); return;
    }
    if (!P || (P.mode !== 'ride' && P.mode !== 'lead') || P.horse !== SU.H) { if (J.phase === 'run') resetRun(); hudUpdate(); return; }
    const p = J.path, spd = Math.abs(s.speed), S = SU.H.B.S;
    J.tol = clamp(1.0 + 0.3 * S + 0.06 * spd, 1.2, 1.6);
    const hx = Math.sin(s.yaw), hz = Math.cos(s.yaw);
    if (J.phase === 'wait') {
      let i1 = 1; while (i1 < p.n - 1 && p.s[i1] < 3) i1++;
      nearest(s.x, s.z, 0, i1);
      const i = NR.i, l = p.s[i + 1] - p.s[i] || 1, tx = (p.x[i + 1] - p.x[i]) / l, tz = (p.z[i + 1] - p.z[i]) / l;
      if (NR.d < J.tol && spd > 0.3 && hx * tx + hz * tz > 0.64 && s.speed > 0) {
        J.phase = 'run'; J.prog = NR.s; J.seg = NR.i; J.offT = 0; J.sumD = 0; J.sumT = 0;
      }
    } else {
      let i1 = J.seg + 1; while (i1 < p.n - 1 && p.s[i1] < J.prog + 6) i1++;
      nearest(s.x, s.z, Math.max(0, J.seg - 2), i1);
      const d = NR.d; J.lastD = d;
      if (d <= J.tol) {
        if (NR.s > J.prog && NR.s < J.prog + 4.5) { J.prog = NR.s; J.seg = NR.i; }
        J.offT = 0;
      } else J.offT += dt * (d > 2.4 * J.tol ? 3 : 1);
      const i = J.seg, l = p.s[i + 1] - p.s[i] || 1;
      if (spd > 0.3 && (hx * (p.x[i + 1] - p.x[i]) + hz * (p.z[i + 1] - p.z[i])) / l < -0.2) J.offT += dt;   // going the wrong way
      if (spd > 0.2) { J.sumD += Math.min(d, 3) * dt; J.sumT += dt; }
      mat.uniforms.uProg.value = J.prog;
      if (J.offT > 1.2) fail();
      else if (J.prog >= p.total - 0.7) succeed(P.mode === 'lead');
    }
    hudUpdate();
  }
  // the first time you ride into the manège, propose a volte so there is always a trace to follow
  function autoSuggest() {
    const P = SU.player;
    if (autoDone || cleared || !P || P.mode !== 'ride' || !inArena(SU.st.x, SU.st.z, 0.8)) return;
    autoDone = true; select('volte', currentRein());
    SU.toast('Suis le tracé sur le sable : une volte !', 'info');
  }
  SU.onUpdate(judge, {
    near: { x: cx, z: cz, r: Math.max(HL, HW) + 14 }, hz: 18,
    onRange(inside) { near = inside; if (inside) showTrace(); else { hideTrace(); hudHide(); if (J.phase === 'run') resetRun(); freeReset(); } },
  });

  // ---------------------------------------------------------------- choosing: "F · Choisir une figure"
  function svgOf(p) {
    const sc = 48 / (2 * HL), H2 = 2 * HW * sc, ox = 2, oy = 2;
    const X = (u) => (ox + (u + HL) * sc).toFixed(1), Y = (v) => (oy + (HW - v) * sc).toFixed(1);
    let d = ''; const lp = p.lp;
    for (let i = 0; i < lp.length; i += 6) d += (i ? 'L' : 'M') + X(lp[i]) + ' ' + Y(lp[i + 1]);
    d += 'L' + X(lp[lp.length - 2]) + ' ' + Y(lp[lp.length - 1]);
    return `<svg class="fig" viewBox="0 0 52 ${(H2 + 4).toFixed(0)}" aria-hidden="true"><rect x="${ox}" y="${oy}" width="48" height="${H2.toFixed(1)}" rx="2" fill="#efe2c4" stroke="#8a7350" stroke-width="1"/>` +
      `<path d="${d}" fill="none" stroke="#2a6cf0" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>` +
      `<circle cx="${X(lp[0])}" cy="${Y(lp[1])}" r="2" fill="#d8322a"/></svg>`;
  }
  function openMenu() {
    const B = SU.H && SU.H.B, all = best();
    const items = FIGS.map(f => {
      const n = Math.max(all[f.id + '.D'] || 0, all[f.id + '.G'] || 0), p = makePath(f, 'D', B);
      return { label: `${f.name}${n ? ` <span style="color:#c58a12">${stars(n)}</span>` : ''}`, sub: `${p.where ? p.where + ' · ' : ''}${PACE[f.pace]}`, icon: svgOf(p), action: () => reinMenu(f) };
    });
    items.push({ label: 'Suite libre', sub: 'Les figures l’une après l’autre', icon: '🎠', action: () => { J.suiteI = 0; suiteNext(); } });
    items.push({ label: 'Effacer', sub: 'Mode libre : fais une figure, je la reconnais', icon: '🧽', action: clear });
    SU.ui.menu('Choisir une figure', items);
  }
  function reinMenu(f) {
    const B = SU.H && SU.H.B, all = best(), cur = currentRein();
    SU.ui.menu(f.name, ['D', 'G'].map(r => {
      const p = makePath(f, r, B), n = all[f.id + '.' + r] || 0;
      return { label: `${REIN[r][0].toUpperCase()}${REIN[r].slice(1)}${n ? ` <span style="color:#c58a12">${stars(n)}</span>` : ''}`, sub: `${p.where || ''}${r === cur ? (p.where ? ' · ' : '') + 'tu y es déjà' : ''}`, icon: svgOf(p), action: () => select(f.id, r) };
    }));
  }
  const pp = {};
  SU.interact.add({
    id: 'figures', label: 'Choisir une figure', icon: '🎯', modes: ['ride', 'lead'], radius: 2, priority: -0.01,
    pos: () => { if (!near || !inArena(SU.st.x, SU.st.z, 0.5)) return null; return SU.personPos(pp); },
    action: openMenu,
  });

  // ---------------------------------------------------------------- free mode: recognise what the child rides on their own
  // The horse's path inside the arena is sampled at 5 Hz into a ring buffer (local u, v, unwrapped heading, distance).
  const RN = 512, RM = RN - 1, Ru = new Float32Array(RN), Rv = new Float32Array(RN), Rh = new Float32Array(RN), Rs = new Float32Array(RN);
  let rk = 0, rk0 = 0, have = false, lu = 0, lv = 0, lth = 0, hcum = 0, scum = 0;
  let onK = -1, onSide = 0, onRein = 0;
  const SP = { from: 0, cross: 0, apex: 0, apexSign: 0, vSign: 0, ok: false, run: 0 };
  function freeReset() { rk0 = rk; have = false; onK = -1; SP.from = 0; }
  function freeHit(id, extra) {
    const P = SU.player; announce(FIG[id], { lead: P.mode === 'lead', extra });
    rk0 = rk; onK = -1; SP.from = 0;
  }
  function sampler() {
    const P = SU.player, s = SU.st;
    if (J.path || !P || (P.mode !== 'ride' && P.mode !== 'lead') || P.horse !== SU.H || !inArena(s.x, s.z, 0.3)) { if (have) freeReset(); return; }
    const u = L.u, v = L.v;
    if (!have) { have = true; lu = u; lv = v; lth = NaN; return; }
    const du = u - lu, dv = v - lv, d = Math.hypot(du, dv);
    if (d < 0.25) return;
    const th = Math.atan2(dv, du);
    if (lth === lth) { let dt = th - lth; dt -= TAU * Math.round(dt / TAU); hcum += dt; }
    lth = th; lu = u; lv = v; scum += d;
    const k = rk & RM; Ru[k] = u; Rv[k] = v; Rh[k] = hcum; Rs[k] = scum; rk++;
    if (rk - rk0 > RN) rk0 = rk - RN;
    const hu = du / d, hv = dv / d, j = rk - 1;
    // on the track? 1/2 = long sides (v<0 / v>0), 3/4 = short sides (A end / C end)
    let side = 0;
    if (Math.abs(b - Math.abs(v)) < 1.8 && Math.abs(u) < a - 2 && Math.abs(hu) > 0.87) side = v < 0 ? 1 : 2;
    else if (Math.abs(a - Math.abs(u)) < 1.8 && Math.abs(v) < b - 2 && Math.abs(hv) > 0.87) side = u < 0 ? 3 : 4;
    const rein = u * hv - v * hu >= 0 ? 1 : -1;
    if (loopCheck(j)) return;
    if (side) {
      if (onK >= rk0 && j - onK >= 3 && excursion(onK, j, onSide, onRein, side, rein)) return;
      onK = j; onSide = side; onRein = rein;
    }
    if (serpCheck(u, v, d, side)) return;
  }
  // a full turn that closes on itself, round, starting from the track: volte (5-12 m) or cercle (14 m - arena width)
  function loopCheck(j) {
    const hj = Rh[j & RM];
    for (let k = j - 8; k >= rk0; k--) {
      const dh = hj - Rh[k & RM];
      if (Math.abs(dh) < TAU - 0.3) continue;
      const ku = Ru[k & RM], kv = Rv[k & RM];
      if (Math.hypot(Ru[j & RM] - ku, Rv[j & RM] - kv) > 3) return false;
      if (b - Math.abs(kv) > 2.2 && a - Math.abs(ku) > 2.2) return false;      // must leave from the track
      let mu = 0, mv = 0, tot = 0; const n = j - k + 1;
      for (let i = k; i <= j; i++) { mu += Ru[i & RM]; mv += Rv[i & RM]; if (i > k) tot += Math.abs(Rh[i & RM] - Rh[(i - 1) & RM]); }
      if (tot > Math.abs(dh) + 1.5) return false;
      mu /= n; mv /= n;
      let mr = 0; for (let i = k; i <= j; i++) mr += Math.hypot(Ru[i & RM] - mu, Rv[i & RM] - mv); mr /= n;
      let dev = 0; for (let i = k; i <= j; i++) dev = Math.max(dev, Math.abs(Math.hypot(Ru[i & RM] - mu, Rv[i & RM] - mv) - mr));
      if (dev > 0.28 * mr) return false;
      if (2 * mr >= 4.5 && 2 * mr <= 12.5) { freeHit('volte'); return true; }
      if (2 * mr >= 14 && 2 * mr <= 2 * b + 2) { freeHit('cercle'); return true; }
      return false;
    }
    return false;
  }
  // left a long side and came back to the track on the other rein: demi-volte, demi-volte renversée or diagonale
  function excursion(k0, k1, s0, r0, s1, r1) {
    if (r0 === r1 || s0 > 2 || s1 > 2) return false;
    const len = Rs[k1 & RM] - Rs[k0 & RM]; if (len < 8 || len > 60) return false;
    const u0 = Ru[k0 & RM], v0 = Rv[k0 & RM], u1 = Ru[k1 & RM], v1 = Rv[k1 & RM];
    let tot = 0; for (let i = k0 + 1; i <= k1; i++) tot += Math.abs(Rh[i & RM] - Rh[(i - 1) & RM]);
    const net = Rh[k1 & RM] - Rh[k0 & RM];
    if (s0 === s1) {
      const sg = s0 === 1 ? -1 : 1;
      let km = k0, dm = 0; for (let i = k0; i <= k1; i++) { const dd = b - sg * Rv[i & RM]; if (dd > dm) { dm = dd; km = i; } }
      if (dm < 3.5 || dm > 2 * b - 1.5) return false;
      if (Math.abs(Math.abs(net) - PI) > 0.9 || tot > Math.abs(net) + 2.2) return false;
      const before = Math.abs(Rh[km & RM] - Rh[k0 & RM]), after = Math.abs(Rh[k1 & RM] - Rh[km & RM]);
      if (before > after + 1.2) { freeHit('demivolte'); return true; }
      if (after > before + 1.2) { freeHit('renversee'); return true; }
      return false;
    }
    // opposite long sides: a straight line most of the way along the arena
    if (Math.abs(u1 - u0) < 1.1 * a) return false;
    const cl = Math.hypot(u1 - u0, v1 - v0), nu = -(v1 - v0) / cl, nv = (u1 - u0) / cl;
    for (let i = k0; i <= k1; i++) if (Math.abs((Ru[i & RM] - u0) * nu + (Rv[i & RM] - v0) * nv) > 2) return false;
    freeHit('diagonale'); return true;
  }
  // from one short side to the other, touching the long sides in turn and crossing the centre line between loops
  function serpCheck(u, v, d, side) {
    if (side === 3 || side === 4) {
      let hit = false;
      if (SP.from && SP.from !== side && SP.ok && SP.apex >= 3 && SP.cross === SP.apex - 1) { freeHit('serpentine', SP.apex === 3 ? '' : ` à ${SP.apex} boucles`); hit = true; }
      Object.assign(SP, { from: side, cross: 0, apex: 0, apexSign: 0, vSign: 0, ok: true, run: 0 });
      return hit;
    }
    if (!SP.from) return false;
    if (side === 1 || side === 2) { SP.run += d; if (SP.run > 7) SP.ok = false; } else SP.run = 0;   // riding along a long side isn't a loop
    if (b - Math.abs(v) < 2.2) { const sg = v < 0 ? -1 : 1; if (sg !== SP.apexSign) { SP.apex++; SP.apexSign = sg; } }
    if (Math.abs(u) < a - 4 && Math.abs(v) > 0.5) { const sg = v < 0 ? -1 : 1; if (SP.vSign && sg !== SP.vSign) SP.cross++; SP.vSign = sg; }
    return false;
  }
  SU.onUpdate(sampler, { near: { x: cx, z: cz, r: Math.max(HL, HW) + 6 }, hz: 5 });
  SU.on('reset', () => { resetRun(); freeReset(); });
  SU.on('mode', () => { if (J.phase === 'run') resetRun(); freeReset(); });

  // ---------------------------------------------------------------- API (+ a test autopilot that steers through the arrow keys)
  const key = (k, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k }));
  const _test = {
    frame: { cx, cz, Lx, Lz, HL, HW, a, b },
    path: (id, rein) => makePath(FIG[id], rein, SU.H && SU.H.B),
    // laps of the plain track (rounded corners), starting on the K-E-H side at E: never a figure
    trackPath(rein = 'D', laps = 1) {
      const P = builder().at(0, -b);
      for (let i = 0; i < laps; i++) P.line(a - RC, -b).arc(a - RC, -b + RC, PI / 2).line(a, b - RC).arc(a - RC, b - RC, PI / 2).line(-a + RC, b).arc(-a + RC, b - RC, PI / 2).line(-a, -b + RC).arc(-a + RC, -b + RC, PI / 2).line(0, -b);
      if (rein === 'G') for (let i = 1; i < P.pts.length; i += 2) P.pts[i] = -P.pts[i];
      return finishPath(P.pts, [], null, rein);
    },
    // put the horse on the path, `back` metres before its start, facing along it
    place(p, back = 2) {
      const s = SU.st, tx = p.x[1] - p.x[0], tz = p.z[1] - p.z[0], l = Math.hypot(tx, tz);
      s.x = p.x[0] - tx / l * back; s.z = p.z[0] - tz / l * back; s.prevX = s.x; s.prevZ = s.z; s.yaw = Math.atan2(tx, tz); s.speed = 0; s.turn = 0;
    },
    // pure pursuit with the real controls: ←/→ key events (pulse-width modulated), gait via setGait (riding) or ↑ held (leading)
    drive(p, { gait = 1, maxS = 240, stopAt = 1e9, step = 2 } = {}) {
      const P = SU.player, lead = P.mode === 'lead', s = SU.st;
      if (lead) key('ArrowUp', true); else SU.actions.setGait(gait);
      let acc = 0, held = 0, ti = 0, t = 0, maxD = 0;
      const set = (k) => { if (k === held) return; if (held) key(held > 0 ? 'ArrowLeft' : 'ArrowRight', false); if (k) key(k > 0 ? 'ArrowLeft' : 'ArrowRight', true); held = k; };
      for (; t < maxS; t += step / 60) {
        let bi = ti, bd = 1e9;
        for (let i = ti; i < Math.min(p.n, ti + 40); i++) { const d = Math.hypot(p.x[i] - s.x, p.z[i] - s.z); if (d < bd) { bd = d; bi = i; } }
        ti = bi; maxD = Math.max(maxD, bd);
        if (p.s[ti] >= Math.min(p.total - 0.2, stopAt)) break;
        const la = 1.6 + 0.45 * Math.abs(s.speed); let k = ti; while (k < p.n - 1 && p.s[k] < p.s[ti] + la) k++;
        const want = Math.atan2(p.x[k] - s.x, p.z[k] - s.z); let err = want - s.yaw; err -= TAU * Math.round(err / TAU);
        acc += clamp(err * 3, -1, 1); let dk = 0; if (acc > 0.5) { dk = 1; acc -= 1; } else if (acc < -0.5) { dk = -1; acc += 1; }
        set(dk); __horse.step(step);
      }
      set(0); if (lead) key('ArrowUp', false);
      return { t: +t.toFixed(1), maxD: +maxD.toFixed(2), reached: +(p.s[ti] / p.total).toFixed(3) };
    },
  };
  SU.features.figures = {
    select, clear, suite: () => { J.suiteI = 0; suiteNext(); }, openMenu, figures: FIGS.map(f => f.id),
    get state() { return { id: J.path && J.path.f.id, rein: J.rein, phase: J.phase, prog: J.prog, total: J.path && J.path.total, stars: J.stars, mean: J.lastMean, trace: !!trace, near }; },
    _test,
  };
}
