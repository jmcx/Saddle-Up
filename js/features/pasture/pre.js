// pasture feature, le pré: the loose herd (taken over from the core, on light rigs), a Selle Français mare with her foal,
// turning one of the five club horses out to grass and catching it again, and a little cut-scene to watch the foal.
import { makeAnimal, makeRegion, runGroup, steer, face, constrain, addCols, lookAt, wrap } from './rig.js';

export const MARE = { name: 'Hirondelle', coat: 0x6e3a1e, points: 0x1c1511, hair: 0x17110d, muzzle: 0x2e211a, sheen: 0xb98058, blaze: 'star', socks: [false, false, true, false] };
export const FOAL = { name: 'Filou', coat: 0xa4552a, points: 0x9a4e26, hair: 0xb8693a, muzzle: 0x4a2c1e, sheen: 0xd99a60, blaze: 'face', socks: [true, false, false, true] };
const FACTS = [
  'Le poulain est le petit du cheval.',
  'Sa maman est la jument. Son papa est l’étalon.',
  'Il tète le lait de sa mère, puis il broute l’herbe avec elle.',
  'On ne l’approche qu’avec un adulte, sans jamais le séparer de sa mère.',
];
const rnd = (a, b) => a + Math.random() * (b - a);
const NONE = [];

export function initPre(SU) {
  const THREE = SU.THREE, W = SU.world, PR = W.places.pasture;
  if (!PR) return null;
  const C = { x: PR.x, z: PR.z, r: PR.r }, gate = PR.gate;
  const rg = makeRegion(SU, { circle: C });
  const P = () => SU.player;
  const care = () => SU.features.care;
  const all = [];          // everyone in the field (light animals and turned-out club horses), for separation
  const light = [];        // the ones this module animates
  const walk = (a, f = 0.75) => 1.7 * a.B.speed * f;
  const trough = PR.trough, troughSpot = trough ? { x: trough.x, z: trough.z, low: false, amount: 1, drink: true } : null;
  const drinkPos = trough ? (() => { const dz = Math.sign(C.z - trough.z) || 1; return { x: trough.x, z: trough.z + dz * 1.55, yaw: dz > 0 ? Math.PI : 0 }; })() : null;
  let troughWho = null;

  // ---- generic grazer: wander a few metres, graze (the rig drops its head after standing a while), sometimes drink
  function goTo(a, x, z, then, sp) { a.mode = 'go'; a.tx = x; a.tz = z; a.then = then; a.t = 40; a.best = 1e9; a.bestT = 0; a.sp = sp ?? walk(a); }
  function grazeChoose(a) {
    const s = a.s;
    if (troughWho === a) troughWho = null;
    s.eatHay = null;
    if (drinkPos && !troughWho && Math.random() < 0.1) {
      troughWho = a;
      goTo(a, drinkPos.x, drinkPos.z, () => { a.mode = 'face'; a.fyaw = drinkPos.yaw; a.t = 6; a.then = () => { a.mode = 'eat'; a.t = rnd(5, 8); s.eatHay = troughSpot; const h = a.club; if (h && care()) care().state(h).thirst = 0; }; });
      return;
    }
    const near = { minX: s.x - 9, maxX: s.x + 9, minZ: s.z - 9, maxZ: s.z + 9 };
    const p = rg.pick(s.x, s.z, Math.random() < 0.8 ? near : null, 1.5);
    if (p) goTo(a, p.x, p.z, () => { a.mode = 'idle'; a.t = rnd(14, 40); }, walk(a, 0.6));
    else { a.mode = 'idle'; a.t = rnd(5, 10); }
  }
  // the common moves: returns true if it handled this tick
  function common(a, dt) {
    a.t -= dt;
    const p = P(), pf = p.mode === 'free' ? p : null;
    if (troughSpot && a.s.eatHay === troughSpot) troughSpot.amount = 1;
    if (a.mode === 'go') {
      const d = steer(a, rg, all, a.sp, pf);
      if (d < a.best - 0.3) { a.best = d; a.bestT = 0; } else a.bestT += dt;
      if (d < 0.5) { a.ctl.target = 0; a.ctl.turnIn = 0; const f = a.then; a.then = null; a.mode = 'idle'; a.t = 6; if (f) f(); }
      else if (a.t < 0 || a.bestT > 6) { if (troughWho === a) troughWho = null; a.mode = 'idle'; a.t = rnd(2, 5); a.ctl.target = 0; a.ctl.turnIn = 0; }
      return true;
    }
    if (a.mode === 'face') { if (face(a, a.fyaw) || a.t < 0) { a.ctl.turnIn = 0; const f = a.then; a.then = null; a.mode = 'idle'; a.t = 6; if (f) f(); } return true; }
    a.ctl.target = 0; a.ctl.turnIn = 0;
    return false;
  }
  function grazer(a, dt) { if (!common(a, dt) && a.t < 0) grazeChoose(a); }
  const lookPost = (R7 = 9) => (a, dt) => {
    const p = P(), d = Math.hypot(p.x - a.s.x, p.z - a.s.z), want = d < R7 && a.mode !== 'eat' ? 1 - d / R7 : 0;
    a.att = (a.att ?? 0) + (want - (a.att ?? 0)) * Math.min(1, dt * 3);
    lookAt(a, p.x, p.z, a.att * (a.s.graze > 0.6 ? 0.4 : 1));
  };

  // ---- the core's three loose horses: rebuilt as light rigs and driven here (the core's updateHerd stands down)
  if (SU.herd) {
    SU.herdOwned = true;
    for (const h of SU.herd) {
      const old = h.R, B = old.B;
      SU.scene.remove(old.root);
      old.root.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); old.mats.forEach(m => m.dispose());
      h.R = makeAnimal(SU, B, 0.6); SU.scene.add(h.R.root);
      const a = { R: h.R, s: h.s, B, name: B.name, cols: h.cols, mode: 'idle', t: rnd(3, 20), brain: grazer, post: lookPost() };
      light.push(a); all.push(a);
    }
  }

  // ---- the mare and her foal
  const base = SU.BREEDS[0];
  const mareB = { ...base, name: 'Selle Français', kind: 'Horse', S: 1.03, k: 1.02, mane: 'flat', maneL: 1.05, ...MARE, pattern: null };
  const foalB = { ...base, name: 'Poulain', kind: 'Foal', ...FOAL, pattern: null,
    S: 0.46, k: 1.36, kw: 0.84, bodyW: 0.8, bodyH: 0.84, bodyL: 0.78, neckL: 0.7, neckW: 0.84, headS: 1.55, headL: 0.74, earL: 1.12, earW: 1.05, eyeS: 1.6,
    speed: 0.95, graze: 0.85, mane: 'upright', maneL: 1.35, forelock: 0.4, tail: 'full', tailL: 0.42, tailW: 1.15, feather: false };
  const spawn = (B, x, z, yaw, detail) => {
    const R = makeAnimal(SU, B, detail), s = SU.newRigState(x, z, yaw); s.graze = 1; s.idle = 8;
    R.root.position.set(x, s.rootY, z); R.root.rotation.y = yaw; SU.scene.add(R.root);
    const a = { R, s, B, mode: 'idle', t: rnd(4, 9) }; addCols(SU, a); light.push(a); all.push(a); return a;
  };
  const m0 = rg.pick(C.x + 4, C.z + 2, { minX: C.x - 6, maxX: C.x + 10, minZ: C.z - 4, maxZ: C.z + 10 }, 2) ?? { x: C.x + 4, z: C.z + 2 };
  const mare = spawn(mareB, m0.x, m0.z, 2.2, 0.7); mare.name = MARE.name;
  const foal = spawn(foalB, m0.x + 2.2, m0.z + 1.2, 1.7, 0.7); foal.name = FOAL.name;
  const pp = {};

  // the foal: stays by its mother, plays in bursts and comes back, suckles, is curious when you stand still, runs off if you run at it
  foal.brain = (a, dt) => {
    const s = a.s, ms = mare.s, p = P(); SU.personPos(pp);
    a.t -= dt;
    const dM = Math.hypot(ms.x - s.x, ms.z - s.z), dP = Math.hypot(pp.x - s.x, pp.z - s.z);
    const pSpeed = p.mode === 'free' || p.mode === 'toTake' ? Math.abs(p.speed ?? 0) : Math.abs(SU.st.speed);
    const inField = rg.inside(pp.x, pp.z, -1);
    // you run at it: off it goes, round to the far side of its mother
    if (a.mode !== 'flee' && inField && dP < 7 && pSpeed > 2.3) {
      const ux = (s.x - pp.x) / (dP || 1), uz = (s.z - pp.z) / (dP || 1);
      let tx = ms.x + ux * 3, tz = ms.z + uz * 3;
      if (!rg.free(tx, tz, 1.5)) { tx = s.x + ux * 6; tz = s.z + uz * 6; }
      a.mode = 'flee'; a.tx = tx; a.tz = tz; a.t = 5; a.calm = 8;
    }
    a.calm = Math.max(0, (a.calm ?? 0) - dt);
    switch (a.mode) {
      case 'flee': { const d = steer(a, rg, all, 5.2 * a.B.speed, null); if (d < 1 || a.t < 0) { a.mode = 'near'; a.t = rnd(3, 6); } break; }
      case 'play': {
        a.ang += dt * a.dir * 0.75;
        a.tx = ms.x + Math.sin(a.ang) * a.pr; a.tz = ms.z + Math.cos(a.ang) * a.pr;
        if (!rg.free(a.tx, a.tz, 1.6)) { a.dir = -a.dir; a.ang += a.dir * 0.6; }
        steer(a, rg, all, a.fast ? 5.4 * a.B.speed : 3.2 * a.B.speed, null);
        if (a.t < 0) { a.mode = 'near'; a.t = rnd(6, 14); }
        break;
      }
      case 'suckle': {
        // antiparallel, its head under the mare's flank by her hind legs
        const fx = Math.sin(ms.yaw), fz = Math.cos(ms.yaw), S = mare.B.S, side = a.side;
        a.tx = ms.x - fx * 0.05 * S + fz * side * 0.62 * S; a.tz = ms.z - fz * 0.05 * S - fx * side * 0.62 * S;
        const d = Math.hypot(a.tx - s.x, a.tz - s.z);
        if (d > 0.35 && !a.latched) steer(a, rg, NONE, 1.2, null);
        else { a.latched = true; face(a, ms.yaw + Math.PI); s.x += (a.tx - s.x) * 0.3; s.z += (a.tz - s.z) * 0.3; }
        if (a.t < 0 || dM > 3) { a.mode = 'near'; a.latched = false; a.t = rnd(8, 16); }
        break;
      }
      case 'curious': {
        const stand = inField && dP < 14 && pSpeed < 0.3 && p.mode === 'free';
        if (!stand || a.t < 0) { a.mode = 'near'; a.t = rnd(4, 8); break; }
        const ux = (s.x - pp.x) / (dP || 1), uz = (s.z - pp.z) / (dP || 1);
        a.tx = pp.x + ux * 3; a.tz = pp.z + uz * 3;
        if (dP > 3.4) steer(a, rg, all, walk(a, 0.6), null);
        else face(a, Math.atan2(pp.x - s.x, pp.z - s.z));
        break;
      }
      case 'go': common(a, dt); break;
      default: {   // 'near' / 'idle': keep within a few metres of its mother
        a.ctl.target = 0; a.ctl.turnIn = 0;
        if (dM > 4.5) { const sd = Math.random() < 0.5 ? 1 : -1, fx = Math.sin(ms.yaw), fz = Math.cos(ms.yaw); goTo(a, ms.x + fz * sd * 1.8 - fx * 0.5, ms.z - fx * sd * 1.8 - fz * 0.5, () => { a.mode = 'near'; a.t = rnd(3, 8); }, dM > 9 ? 3.4 * a.B.speed : walk(a, 0.9)); break; }
        if (a.t > 0) break;
        const r = Math.random();
        if (inField && dP < 14 && pSpeed < 0.3 && p.mode === 'free' && a.calm <= 0 && r < 0.45) { a.mode = 'curious'; a.t = rnd(10, 18); }
        else if (r < 0.62) { a.mode = 'play'; a.t = rnd(4, 7); a.pr = rnd(5, 8); a.ang = Math.atan2(s.x - ms.x, s.z - ms.z); a.dir = Math.random() < 0.5 ? 1 : -1; a.fast = Math.random() < 0.6; }
        else if (r < 0.78 && mare.mode !== 'go') { a.mode = 'suckle'; a.side = Math.random() < 0.5 ? 1 : -1; a.t = rnd(8, 14); a.latched = false; }
        else a.t = rnd(4, 9);
      }
    }
  };
  foal.post = (a, dt) => {
    const R = a.R;
    if (a.mode === 'suckle' && a.latched) { R.neck.rotation.y += -a.side * 0.55; R.neck.rotation.x += 0.18; R.head.rotation.x -= 0.25; }
    else lookPost(12)(a, dt);
  };
  // the mare: grazes in short hops, keeps her foal near, walks round to it if you come between them, watches you
  mare.brain = (a, dt) => {
    const s = a.s, fs = foal.s; SU.personPos(pp);
    if (common(a, dt)) return;
    if (foal.mode === 'suckle') { a.t = Math.max(a.t, 1); return; }
    const dF = Math.hypot(fs.x - s.x, fs.z - s.z);
    // are you between us? (close to the segment mare -> foal, and in the field)
    const sx = fs.x - s.x, sz = fs.z - s.z, L2 = sx * sx + sz * sz || 1, u = ((pp.x - s.x) * sx + (pp.z - s.z) * sz) / L2;
    const between = rg.inside(pp.x, pp.z, -1) && u > 0.15 && u < 0.85 && Math.hypot(s.x + sx * u - pp.x, s.z + sz * u - pp.z) < 1.6;
    if (between || dF > 9) {
      const ox = fs.x - pp.x, oz = fs.z - pp.z, od = Math.hypot(ox, oz) || 1;
      let tx = fs.x + ox / od * 1.8, tz = fs.z + oz / od * 1.8;
      if (!rg.free(tx, tz, 1.2)) { tx = fs.x; tz = fs.z; }
      goTo(a, tx, tz, () => { a.mode = 'idle'; a.t = rnd(6, 12); }, walk(a, between ? 0.95 : 0.8));
      return;
    }
    if (a.t < 0) grazeChoose(a);
  };
  mare.post = lookPost(15);
  SU.features.safety?.watch?.({ R: mare.R, s: mare.s, B: mare.B, name: mare.name });
  SU.features.safety?.watch?.({ R: foal.R, s: foal.s, B: foal.B, name: foal.name });

  // ---- turning a club horse out: led in through the gate and let go (Q), it lives in the pré until you catch it again (E)
  const out = new Map();                        // club horse entry -> grazing agent
  const inPre = (x, z, m = 0) => Math.hypot(x - C.x, z - C.z) < C.r - m;
  const gateIn = { x: gate.x + Math.sin(gate.yaw) * 2.6, z: gate.z + Math.cos(gate.yaw) * 2.6 };   // just inside the gateway
  let leadSpeed = 0, tipGate = false, tipFace = false;
  function turnOut(h) {
    if (out.has(h)) return;
    const Cc = care();
    let untacked = false;
    if (Cc && Cc.isTacked && (Cc.state(h).saddled || Cc.state(h).bridled)) {
      untacked = true;
      Cc.setTacked(h, false);
      SU.toast('On enlève la selle et le filet avant de lâcher un cheval au pré.', 'info');
    }
    if (Cc) Cc.setGirthed(h, false);
    const a = { R: h.R, s: h.s, B: h.B, name: h.name, club: h, mode: 'idle', t: rnd(4, 8), ctl: { target: 0, turnIn: 0 }, v: 0, turn: 0, brainAcc: 0 };
    a.brain = grazer;
    out.set(h, a); all.push(a);
    // was it a good release?
    const toGate = Math.atan2(gate.x - h.s.x, gate.z - h.s.z), facing = Math.abs(wrap(toGate - h.s.yaw)) < 1.1;
    const later = (msg, kind) => setTimeout(() => SU.toast(msg, kind), untacked ? 2100 : 0);
    if (leadSpeed > 0.7) later('Ne lâche jamais un cheval qui tire : arrête-le d’abord, bien calme.', 'warn');
    else if (facing) later(`Bravo ! ${h.name} est au pré. Face à la barrière, il ne peut pas te bousculer en partant.`, 'good');
    else later(`${h.name} est au pré. La prochaine fois, tourne-le face à la barrière avant de le lâcher.`, 'info');
    SU.emit('pasture', 'out', h);
  }
  function caught(h, quiet) {
    const a = out.get(h); if (!a) return;
    out.delete(h); all.splice(all.indexOf(a), 1);
    if (care()) care().setGirthed(h, false);
    if (!quiet) SU.toast(`Tu as attrapé ${h.name}. Ramène-le à son box.`, 'good');
    SU.emit('pasture', 'in', h);
  }
  SU.on('mode', (mode, prev) => {
    const p = P();
    if (prev === 'lead' && mode === 'free') { const h = SU.horse; if (h && SU.horses.includes(h) && inPre(h.s.x, h.s.z, 0.8)) turnOut(h); }
    for (const h of [...out.keys()]) if (p.horse === h.R || (p.mode === 'toTake' && p.target === h)) caught(h, p.mode !== 'toTake');
  });
  SU.on('reset', () => { for (const h of [...out.keys()]) if (!inPre(h.s.x, h.s.z, -1) || P().horse === h.R) caught(h, true); });

  // F at the gate: lead it in, turn it to face the gate and let go, all in one
  SU.interact.add({
    id: 'pasture-release', icon: '🌿', radius: 5, modes: ['lead'], pos: gate,
    label: () => `Lâcher ${SU.horse?.name ?? ''} au pré`, when: () => !!SU.horse && SU.horses.includes(SU.horse) && P().mode === 'lead',
    action: () => {
      const h = SU.horse, s = h.s, yaw = gate.yaw + Math.PI;
      Object.assign(s, { x: gateIn.x, z: gateIn.z, prevX: gateIn.x, prevZ: gateIn.z, yaw, speed: 0, turn: 0 });
      s.rootY = W.groundH(s.x, s.z); h.R.root.position.set(s.x, s.rootY, s.z); h.R.root.rotation.y = yaw; h.R.root.updateMatrixWorld(true);
      leadSpeed = 0;
      SU.actions.letGo();
      if (!out.has(h)) turnOut(h);
    },
  });
  // F by its box while leading it: put it back in
  SU.interact.add({
    id: 'pasture-home', icon: '🏠', radius: 3.5, modes: ['lead'], pos: () => SU.horse?.box ?? null,
    label: () => `Ramener ${SU.horse?.name ?? ''} à son box`, when: () => { const h = SU.horse; return !!h && !!h.box && Math.hypot(h.s.x - h.box.x, h.s.z - h.box.z) > 1.2; },
    action: () => {
      const h = SU.horse, b = h.box, p = P(); SU.actions.letGo(); SU.actions.sendHome(h);
      // you step out in front of its box, by its head (never behind it)
      p.x = b.x + Math.sin(b.yaw) * (1.4 * h.B.S + 1); p.z = b.z + Math.cos(b.yaw) * (1.4 * h.B.S + 1); p.yaw = b.yaw + Math.PI;
      SU.actions.collidePerson(p); SU.actions.placeFree(p);
      SU.toast(`${h.name} est rentré dans son box.`, 'good');
    },
  });

  // ---- the turned-out club horses are animated by the core (updateStableHorses / stepWorld): steer them by their state
  // (speed and turn, reapplied every frame against the core's "stand still"), and keep them inside the fence
  function drive(dt) {
    const p = P();
    if (p.mode === 'lead' && SU.horse && SU.horses.includes(SU.horse)) {
      const h = SU.horse; leadSpeed = Math.abs(h.s.speed);
      SU.personPos(pp);
      // one-line tips at the right moments
      const dg = Math.hypot(pp.x - gate.x, pp.z - gate.z);
      if (!tipGate && dg < 9 && !inPre(pp.x, pp.z)) { tipGate = true; SU.toast('Au pré : entre avec lui, tourne-le face à la barrière, puis lâche-le (Q).', 'info'); }
      if (dg > 25) tipGate = tipFace = false;
      if (!tipFace && inPre(h.s.x, h.s.z, 3) && dg < 12 && leadSpeed < 0.2) {
        const toGate = Math.atan2(gate.x - h.s.x, gate.z - h.s.z);
        if (Math.abs(wrap(toGate - h.s.yaw)) > 1.3) { tipFace = true; SU.toast('Tourne-le face à la barrière avant de le lâcher.', 'info'); }
      }
    }
    for (const [h, a] of out) {
      const s = h.s;
      if (p.horse === h.R) { caught(h, true); continue; }
      a.brainAcc += dt;
      if (a.brainAcc >= 0.2) {
        a.brain(a, a.brainAcc); a.brainAcc = 0;
        if (!inPre(s.x, s.z, -2)) { caught(h, true); continue; }       // teleported away (1-5, R)
        const Cc = care(); if (Cc && s.graze > 0.6) { const S = Cc.state(h); S.hunger = Math.max(0, S.hunger - 0.2 / 60); }
      }
      a.v += Math.max(-4 * dt, Math.min(2.6 * dt, a.ctl.target - a.v));
      a.turn += (a.ctl.turnIn - a.turn) * (1 - Math.exp(-6 * dt));
      s.speed = a.v > 0.02 ? a.v + 4 * dt : s.speed; s.turn = a.turn;
      if (a.ctl.target === 0 && a.v < 0.05) s.idle = Math.max(s.idle, 0);
      constrain(a, rg, all);
      if (s.eatHay === troughSpot) troughSpot.amount = 1;
    }
  }

  // ---- "Regarder le poulain": a short cut-scene framing the mare and her foal, with a few facts; any key or tap ends it
  let scene = null;
  function watchFoal() {
    if (scene || SU.camOverride) return;
    const cam = SU.camera, el = SU.ui.el('div', null, '');
    el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:12;max-width:min(560px,calc(100vw - 32px));box-sizing:border-box;padding:14px 18px;border-radius:16px;background:rgba(251,246,234,0.95);color:#2a1d12;font-size:17px;line-height:1.45;box-shadow:0 10px 40px rgba(0,0,0,.35);text-align:center;cursor:pointer';
    document.body.append(el);
    SU.modal++;
    const from = cam.position.clone(), look = new THREE.Vector3(), tgt = new THREE.Vector3(), pos = new THREE.Vector3();
    let t = 0, i = -1, nextT = 0;
    const side = (() => { const ms = mare.s, ang = Math.atan2(cam.position.x - ms.x, cam.position.z - ms.z); return ang; })();
    const show = (k) => { i = k; el.innerHTML = `<div style="font-size:13px;opacity:.65;margin-bottom:4px">La jument ${MARE.name} et son poulain ${FOAL.name}</div><b>${FACTS[k]}</b><div style="font-size:12px;opacity:.55;margin-top:6px">Touche une touche pour revenir</div>`; SU.ui.say?.(FACTS[k]); nextT = t + 5; };
    if (foal.mode !== 'suckle' && Math.hypot(foal.s.x - mare.s.x, foal.s.z - mare.s.z) < 6) { foal.mode = 'suckle'; foal.side = 1; foal.t = 12; foal.latched = false; }
    show(0);
    const end = () => {
      if (!scene) return;
      removeEventListener('keydown', onKey); el.removeEventListener('pointerdown', end); SU.renderer.domElement.removeEventListener('pointerdown', end);
      el.remove(); SU.modal--; SU.camOverride = null; scene = null; SU.ui.say?.('', { interrupt: true });
    };
    const onKey = (e) => { if (t < 0.4) return; e.preventDefault(); end(); };
    setTimeout(() => { if (!scene) return; addEventListener('keydown', onKey); el.addEventListener('pointerdown', end); SU.renderer.domElement.addEventListener('pointerdown', end); }, 50);
    scene = { end };
    SU.camOverride = (dt) => {
      t += dt;
      const ms = mare.s, fs = foal.s;
      tgt.set((ms.x + fs.x) / 2, 0, (ms.z + fs.z) / 2); tgt.y = W.groundH(tgt.x, tgt.z) + 0.85;
      const a = side + t * 0.06, r = 6.5 + Math.hypot(ms.x - fs.x, ms.z - fs.z) * 0.5;
      pos.set(tgt.x + Math.sin(a) * r, 0, tgt.z + Math.cos(a) * r); pos.y = Math.max(W.groundH(pos.x, pos.z), tgt.y - 0.85) + 1.55;
      const u = Math.min(1, t / 1.2), e = u * u * (3 - 2 * u);
      cam.position.lerpVectors(from, pos, e);
      if (t < 0.05) look.copy(tgt); else look.lerp(tgt, Math.min(1, dt * 4));
      cam.lookAt(look);
      if (t > nextT) { if (i + 1 < FACTS.length) show(i + 1); else end(); }
    };
    return scene;
  }
  const nearFence = { x: 0, z: 0 };
  SU.interact.add({
    id: 'pasture-foal', icon: '🐎', radius: 4.5, modes: ['free', 'lead'],
    label: 'Regarder le poulain',
    pos: () => {       // the nearest point of the fence (or the gateway)
      SU.personPos(pp); const dx = pp.x - C.x, dz = pp.z - C.z, d = Math.hypot(dx, dz) || 1;
      if (Math.abs(d - C.r) > 4.5) return null;
      nearFence.x = C.x + dx / d * C.r; nearFence.z = C.z + dz / d * C.r; return nearFence;
    },
    when: () => !scene && !SU.camOverride && Math.hypot(foal.s.x - pp.x, foal.s.z - pp.z) < 45, action: () => watchFoal(),
  });
  SU.on('reset', () => scene?.end());

  // ---- run: the field simulates while you are within 120 m (the yard is ~95 m away: they keep moving, at a low LOD rate);
  // the animals are hidden beyond 230 m
  const step = runGroup(SU, light, { rg, others: all });
  SU.onUpdate((dt, time) => { step(dt, time); drive(dt); }, { near: { x: C.x, z: C.z, r: 120 } });
  let shown = true;
  SU.onUpdate(() => {
    const c = SU.camera.position, v = Math.hypot(c.x - C.x, c.z - C.z) < 230;
    if (v !== shown) { shown = v; for (const a of light) a.R.root.visible = v; }
  }, { hz: 1 });
  return { mare, foal, light, all, out, rg, turnOut, caught, watchFoal, get scene() { return scene; }, isOut: (h) => out.has(h) };
}
