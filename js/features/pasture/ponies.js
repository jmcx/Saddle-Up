// pasture feature, la stabulation libre: six ponies living loose in the open shed and its paddock.
import { makeAnimal, makeRegion, runGroup, steer, face, addCols, lookAt, wrap } from './rig.js';

// ======== THE PONIES: edit this table freely (the user will correct names and coats later).
// name · line: what the game says about the coat when you stroke it · S: size (0.6 small … 0.8 big pony)
// type: 'shetland' (stout, short legs) or 'welsh' (finer) · coat colours (hex): coat, points (lower legs), hair (mane and tail), muzzle
// pattern: null | 'pinto' (pie) | 'dapple' (gris pommelé) · blaze: null | 'star' (en tête) | 'stripe' (liste) | 'face' (belle face)
// socks: white lower legs [front left, front right, hind left, hind right]
export const PONIES = [
  { name: 'Frisette', line: 'Frisette est alezane : toute rousse, crins compris.', S: 0.64, type: 'shetland',
    coat: 0xa4552a, points: 0x9a4e26, hair: 0xc27a40, muzzle: 0x4a2c1e, pattern: null, blaze: 'stripe', socks: [false, false, true, false] },
  { name: 'Cowboy', line: 'Cowboy est pie : de grandes taches blanches sur une robe noire.', S: 0.7, type: 'shetland',
    coat: 0x221a16, points: 0xe8e2d6, hair: 0x1a1512, muzzle: 0x2a211c, pattern: 'pinto', blaze: 'face', socks: [true, true, true, true] },
  { name: 'Happy', line: 'Happy est palomino : le corps doré, la crinière et la queue blanches.', S: 0.76, type: 'welsh',
    coat: 0xd29d4c, points: 0xc8913f, hair: 0xf1e7cf, muzzle: 0x4a3426, pattern: null, blaze: 'star', socks: [true, false, false, false] },
  { name: 'Armstrong', line: 'Armstrong est gris : des poils blancs mélangés à des poils foncés.', S: 0.8, type: 'welsh',
    coat: 0xc7c5c0, points: 0x8d8a86, hair: 0xe2dfd8, muzzle: 0x3a3532, pattern: 'dapple', blaze: null, socks: [false, false, false, false] },
  { name: 'Caramel', line: 'Caramel est bai : le corps marron, les crins et le bas des jambes noirs.', S: 0.72, type: 'welsh',
    coat: 0x7a4122, points: 0x1c1511, hair: 0x17110d, muzzle: 0x2e211a, pattern: null, blaze: 'star', socks: [false, false, false, false] },
  { name: 'Réglisse', line: 'Réglisse est noire : toute noire, des oreilles à la queue.', S: 0.62, type: 'shetland',
    coat: 0x1a1512, points: 0x14100d, hair: 0x0e0b09, muzzle: 0x120e0c, pattern: null, blaze: null, socks: [false, false, false, false] },
];

const de = (n) => (/^[AEIOUYÉaeiouyé]/.test(n) ? `d’${n}` : `de ${n}`);
const rnd = (a, b) => a + Math.random() * (b - a);

export function initPonies(SU) {
  const THREE = SU.THREE, W = SU.world, ST = W.places.stabulation;
  if (!ST) return null;
  const box = { minX: ST.minX, maxX: ST.maxX, minZ: ST.minZ, maxZ: ST.maxZ }, shed = ST.shed;
  const rg = makeRegion(SU, { box, margin: 0.3 });
  const paddock = { minX: box.minX + 1.5, maxX: box.maxX - 1.5, minZ: shed.maxZ + 2, maxZ: box.maxZ - 1.5 };
  const inShed = { minX: shed.minX + 1.4, maxX: shed.maxX - 1.4, minZ: shed.minZ + 2.4, maxZ: shed.maxZ - 0.8 };

  // feeding places: slots along the hay rack (facing the back wall), round the bale feeder, and the trough at the east end
  const rack = ST.hay ?? [], rackZ = rack.length ? rack[0].z : shed.minZ + 0.45;
  const rackX0 = rack.length ? Math.min(...rack.map(h => h.x)) - 1.2 : shed.minX + 1.5, rackX1 = rack.length ? Math.max(...rack.map(h => h.x)) + 1.2 : rackX0 + 5;
  const slots = [];
  for (let i = 0; i < 4; i++) { const x = rackX0 + (rackX1 - rackX0) * i / 3; slots.push({ x, z: rackZ + 1.6, yaw: Math.PI, hay: { x, z: rackZ, low: false, amount: 1 }, who: null }); }
  const bale = W.haySpots.find(h => h.bale && rg.inside(h.x, h.z));
  if (bale) for (const a of [0.6, 2.2, 3.8, 5.3]) slots.push({ x: bale.x + Math.sin(a) * 1.75, z: bale.z + Math.cos(a) * 1.75, yaw: a + Math.PI, hay: bale, who: null, bale: true });
  const trW = rg.walls.find(w => w.minX > shed.maxX - 1.2 && w.minZ > shed.minZ && w.maxZ < shed.maxZ);   // the trough's solid box
  const trough = trW ? { x: trW.minX - 0.95, z: (trW.minZ + trW.maxZ) / 2, yaw: Math.PI / 2, spot: { x: (trW.minX + trW.maxX) / 2, z: (trW.minZ + trW.maxZ) / 2, low: false, amount: 1, drink: true }, who: null } : null;

  // ---- build them (light rigs: 2 draw calls each)
  const tpl = { shetland: SU.BREEDS[3], welsh: SU.BREEDS[2] };
  const list = PONIES.map((c, i) => {
    const T = tpl[c.type] ?? tpl.welsh;
    const B = { ...T, name: c.name, kind: 'Pony', S: c.S, k: T.k * (0.94 + (c.S - 0.6) * 0.5), coat: c.coat, points: c.points, hair: c.hair, muzzle: c.muzzle,
      sheen: new THREE.Color(c.coat).lerp(new THREE.Color(0xffffff), 0.35).getHex(), top: c.pattern === 'dapple' ? 0.1 : 0.16,
      pattern: c.pattern, blaze: c.blaze, socks: c.socks, feather: c.type === 'shetland', featherColor: c.socks.every(Boolean) ? 0xd8d2c6 : c.hair };
    const R = makeAnimal(SU, B, 0.55);
    const sp = ST.spots[i % ST.spots.length];
    const s = SU.newRigState(sp.x, sp.z, sp.yaw); s.graze = 1; s.idle = 5;
    R.root.position.set(s.x, s.rootY, s.z); R.root.rotation.y = s.yaw;
    SU.scene.add(R.root);
    const a = { i, R, s, B, name: c.name, line: c.line, cfg: c, box: null, mode: 'idle', t: rnd(2, 12), tx: s.x, tz: s.z, then: null, slot: null, petT: 0, att: 0, doze: 0, best: 1e9, bestT: 0 };
    a.brain = brain; a.post = post;
    addCols(SU, a);
    return a;
  });
  const P = () => SU.player;

  // ---- what they do: eat at the rack or the bale, drink, doze in the shed, follow a friend, wander about the paddock
  const walkSp = (a) => 1.7 * a.B.speed * 0.7;
  function release(a) { if (a.slot) { a.slot.who = null; a.slot = null; } a.s.eatHay = null; }
  function goTo(a, x, z, then) { a.mode = 'go'; a.tx = x; a.tz = z; a.then = then; a.t = 45; a.best = 1e9; a.bestT = 0; }
  function choose(a) {
    release(a); a.doze = 0;
    const r = Math.random(), s = a.s;
    if (r < 0.3) {
      const free = slots.filter(sl => !sl.who); const sl = free[Math.floor(Math.random() * free.length)];
      if (sl) { sl.who = a; a.slot = sl; goTo(a, sl.x, sl.z, () => { a.mode = 'face'; a.fyaw = sl.yaw; a.t = 6; a.then = () => { a.mode = 'eat'; a.t = rnd(25, 55); s.eatHay = sl.hay; }; }); return; }
    }
    if (r < 0.4 && trough && !trough.who) {
      trough.who = a; a.slot = trough;
      goTo(a, trough.x, trough.z, () => { a.mode = 'face'; a.fyaw = trough.yaw; a.t = 6; a.then = () => { a.mode = 'eat'; a.t = rnd(5, 8); s.eatHay = trough.spot; }; }); return;
    }
    if (r < 0.58) { const p = rg.pick(s.x, s.z, inShed, 0.9); if (p) { goTo(a, p.x, p.z, () => { a.mode = 'doze'; a.t = rnd(20, 45); }); return; } }
    if (r < 0.72) { const f = list[(a.i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length]; if (f !== a) { a.mode = 'follow'; a.friend = f; a.t = rnd(14, 26); return; } }
    const p = rg.pick(s.x, s.z, Math.random() < 0.75 ? paddock : null, 1.1);
    if (p) goTo(a, p.x, p.z, () => { a.mode = 'idle'; a.t = rnd(8, 22); }); else { a.mode = 'idle'; a.t = rnd(4, 8); }
  }
  function brain(a, dt) {
    const s = a.s, p = P();
    a.t -= dt;
    // you, close by: they turn their heads to look (post), and stop to look if you stand at their head
    const dx = p.x - s.x, dz = p.z - s.z; a.pd = Math.hypot(dx, dz);
    if (s.eatHay && s.eatHay.amount !== undefined && s.eatHay !== bale) s.eatHay.amount = 1;     // the rack never runs dry for them
    if (a.petT > 0) { a.ctl.target = 0; a.ctl.turnIn = 0; return; }
    switch (a.mode) {
      case 'go': {
        const d = steer(a, rg, list, walkSp(a), p.mode === 'free' ? p : null);
        if (d < a.best - 0.3) { a.best = d; a.bestT = 0; } else a.bestT += dt;
        if (d < 0.45) { a.ctl.target = 0; a.ctl.turnIn = 0; const f = a.then; a.then = null; a.mode = 'idle'; a.t = 5; if (f) f(); }
        else if (a.t < 0 || a.bestT > 6) { release(a); a.mode = 'idle'; a.t = rnd(2, 5); a.ctl.target = 0; a.ctl.turnIn = 0; }
        break;
      }
      case 'face': if (face(a, a.fyaw) || a.t < 0) { a.ctl.turnIn = 0; const f = a.then; a.then = null; a.mode = 'idle'; a.t = 5; if (f) f(); } break;
      case 'follow': {
        const f = a.friend, fs = f.s, bx = fs.x - Math.sin(fs.yaw) * 1.9 * f.B.S - Math.cos(fs.yaw) * 0.6, bz = fs.z - Math.cos(fs.yaw) * 1.9 * f.B.S + Math.sin(fs.yaw) * 0.6;
        if (rg.free(bx, bz, 0.6)) { a.tx = bx; a.tz = bz; }
        const d = steer(a, rg, list, walkSp(a) * 1.05, null);
        if (d < 0.8) { a.ctl.target = 0; a.ctl.turnIn = 0; }
        if (a.t < 0) choose(a);
        break;
      }
      default:   // idle, eat, doze: stand still
        a.ctl.target = 0; a.ctl.turnIn = 0;
        if (a.mode === 'doze') s.idle = 0;                  // head low but not grazing
        if (a.t < 0) choose(a);
    }
  }
  // after each rig step: look at you, doze, lower the head when stroked
  function post(a, dt) {
    const R = a.R, p = P();
    const want = a.pd < 7 && a.mode !== 'eat' ? 1 - a.pd / 7 : 0;
    a.att += (want - a.att) * Math.min(1, dt * 3);
    a.doze += ((a.mode === 'doze' ? 1 : 0) - a.doze) * Math.min(1, dt * 0.8);
    if (a.doze > 0.01) {
      R.neck.rotation.x += 0.42 * a.doze; R.head.rotation.x += 0.12 * a.doze;
      for (const e of R.ears) { e.rotation.z -= e.userData.sx * 0.55 * a.doze; e.rotation.x += 0.35 * a.doze; }
    }
    if (a.petT > 0) {
      a.petT -= dt; const u = Math.min(1, a.petT / 0.5, (2.6 - a.petT) / 0.4);
      R.neck.rotation.x += 0.38 * u; R.head.rotation.x += 0.08 * u;
      for (const e of R.ears) e.rotation.x = e.userData.base - 0.25 * u;
    } else if (a.doze < 0.5) lookAt(a, p.x, p.z, a.att);
  }

  // ---- stroking, grooming and treats: one F per pony, "Caresser Frisette", then "S'occuper de Frisette"
  const care = () => SU.features.care;
  const pp = {};
  function behind(a) { SU.personPos(pp); const s = a.s; return (pp.x - s.x) * Math.sin(s.yaw) + (pp.z - s.z) * Math.cos(s.yaw) < -0.4 * a.B.S; }
  function pet(a) {
    a.petT = 2.6; a.petAt = performance.now(); a.ctl.target = 0; a.s.idle = 0;
    if (a.mode === 'go' || a.mode === 'follow') { release(a); a.mode = 'idle'; a.t = rnd(6, 12); }
    const C = care();
    if (C && C.fx) C.fx.burst(a);
    if (SU.audio.audioOk && SU.audio.audioOk()) { SU.audio.snort(a.B, 0.35); setTimeout(() => SU.audio.neigh(a.B, 0.18, 0), 450); }
    SU.toast(a.line, 'good'); SU.ui.say?.(a.line);
  }
  function careMenu(a) {
    const C = care(); if (!C) { pet(a); return; }
    const S = C.state(a); S.saddled = S.bridled = false; S.girthed = false;
    a.box = { x: a.s.x, z: a.s.z };                           // "standing still where it is": care lets you groom a horse in its place
    SU.ui.menu(`S’occuper ${de(a.name)}`, [
      { icon: '🪮', label: 'Panser', sub: 'Étrille, bouchon, brosse douce, cure-pieds', action: () => { a.box = { x: a.s.x, z: a.s.z }; C.groom(a); } },
      { icon: '🥕', label: 'Une carotte', sub: 'Une friandise, main bien à plat', action: () => { if (C.feed(a, 'carotte')) a.petT = 2.6; } },
      { icon: '🍎', label: 'Une pomme', sub: 'Une friandise, main bien à plat', action: () => { if (C.feed(a, 'pomme')) a.petT = 2.6; } },
      { icon: '🎨', label: 'Sa robe', sub: a.line, action: () => { SU.toast(a.line, 'info'); SU.ui.say?.(a.line); } },
    ], { intro: '<div style="font-size:13.5px;opacity:.8;margin-bottom:4px">Dans la stabulation, les poneys vivent ensemble, en liberté : ils mangent, boivent et se reposent quand ils veulent.</div>' });
  }
  const recent = (a) => a.petAt && performance.now() - a.petAt < 9000;
  for (const a of list) {
    SU.interact.add({
      id: 'pony-' + a.name, icon: '🐴', radius: 1.2 * a.B.S + 0.8, modes: ['free'],
      label: () => recent(a) ? `S’occuper ${de(a.name)}` : `Caresser ${a.name}`,
      pos: () => ({ x: a.s.x + Math.sin(a.s.yaw) * 0.75 * a.B.S, z: a.s.z + Math.cos(a.s.yaw) * 0.75 * a.B.S }),
      when: () => !behind(a), action: () => (recent(a) ? careMenu(a) : pet(a)),
    });
    SU.features.safety?.watch?.({ R: a.R, s: a.s, B: a.B, name: a.name });
  }

  // ---- name plates on the shed's back wall, above the rack: one canvas atlas, one mesh (1 draw call)
  {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    const g = cv.getContext('2d'), cw = 256, ch = 256 / 3;
    list.forEach((a, i) => {
      const x = (i % 2) * cw, y = Math.floor(i / 2) * ch;
      g.fillStyle = '#6f4e32'; g.fillRect(x, y, cw, ch); g.fillStyle = '#f3e6c8'; g.fillRect(x + 6, y + 6, cw - 12, ch - 12);
      g.strokeStyle = '#6f4e32'; g.lineWidth = 2; g.strokeRect(x + 12, y + 12, cw - 24, ch - 24);
      g.fillStyle = '#3a2616'; g.font = 'bold 40px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(a.name, x + cw / 2, y + ch / 2 + 2, cw - 36);
    });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const pos = [], uv = [], idx = [], wz = shed.minZ + 0.13, n = list.length, w = 1.05, h = 0.35;
    for (let i = 0; i < n; i++) {
      const cx = shed.minX + 1.3 + (shed.maxX - shed.minX - 2.6) * i / (n - 1), cy = W.groundH(cx, wz + 1) + 2.2, b = pos.length / 3;
      pos.push(cx - w / 2, cy - h / 2, wz, cx + w / 2, cy - h / 2, wz, cx + w / 2, cy + h / 2, wz, cx - w / 2, cy + h / 2, wz);
      const u0 = (i % 2) * 0.5, v1 = 1 - Math.floor(i / 2) / 3, v0 = v1 - 1 / 3;
      uv.push(u0, v0, u0 + 0.5, v0, u0 + 0.5, v1, u0, v1);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const plates = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); plates.receiveShadow = true;
    SU.scene.add(plates);
  }

  // ---- run: simulate only while you are within 110 m of the stabulation; hide them beyond 220 m
  const cx = (box.minX + box.maxX) / 2, cz = (box.minZ + box.maxZ) / 2;
  const step = runGroup(SU, list, { rg, others: list });
  SU.onUpdate(step, { near: { x: cx, z: cz, r: 110 } });
  let shown = true;
  SU.onUpdate(() => {
    const c = SU.camera.position, v = Math.hypot(c.x - cx, c.z - cz) < 220;
    if (v !== shown) { shown = v; for (const a of list) a.R.root.visible = v; }
  }, { hz: 1 });
  return { list, rg, slots, trough };
}
