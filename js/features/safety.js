// Safety lesson (Galop 1): never pass close behind a horse. On foot with empty hands, walk into the zone behind a horse's
// croup and it warns you (ears pinned back, tail swishing, a hind hoof cocked), then kicks: you fly back, fall on your
// back and get up again a moment later with the lesson in the banner. Comic-strip tone, nothing gory.
//
// SU.features.safety = { watch({ R, s, B, name }) -> entry, unwatch(obj), kickNow(obj), zone(entry, x, z), get busy }
//   watch: let another feature's horse kick too (R, s as from SU.buildHorse / SU.newRigState, animated by SU.updateRig)

const HIND = 1.0;                                 // where the hindquarters end, in horse units behind the rig origin (x B.S), measured on buildHorse
const NEAR = 6;                                   // only horses this close are tested
const INNER = { b0: -0.4, b1: 1.6, w: 0.6 };      // the kick zone, metres behind the hindquarters (x B.S)
const OUTER = { b1: 2.5, w: 1.0 };                // the warning zone
const WALK = 1.7 * 1.15;                          // faster than a walk (x B.speed): too busy going somewhere to kick
const T_HIT = 0.22, T_RISE = 1.2, T_UP = 1.65;    // kick sequence timeline (s): the hoof lands, you start getting up, you are up

const CSS = `
#su-kick { position: fixed; inset: 0; z-index: 15; pointer-events: none; display: grid; place-items: center; background: #fff; opacity: 0; transition: opacity .25s ease-out; }
#su-kick.flash { opacity: .85; transition: none; }
#su-kick svg { width: min(340px, 70vw); transform: scale(.2) rotate(-12deg); opacity: 0; transition: transform .18s cubic-bezier(.3,1.8,.5,1), opacity .1s; }
#su-kick.pow svg { transform: scale(1) rotate(-8deg); opacity: 1; }
#su-kick.out svg { opacity: 0; transition: opacity .4s; }
`;

export function init(SU) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const { clamp, smooth } = SU.util;
  // SU.player is copied by Object.assign in index.html, so it goes stale when you switch rider: prefer the live one
  const player = () => SU.player;
  const watched = [];
  const watch = (o) => { const w = { R: o.R, s: o.s, B: o.B, name: o.name ?? '', cool: 0, inT: 0, warnT: 0, alerted: false }; watched.push(w); return w; };
  const find = (o) => watched.find(w => w === o || w.s === o.s || (o.R && w.R === o.R));
  const unwatch = (o) => { const w = find(o); if (!w) return; calm(w); watched.splice(watched.indexOf(w), 1); };
  for (const h of SU.horses) watch(h).home = h.box;

  // where the person stands relative to a horse: b = metres behind its hindquarters, lat = metres to its side (+ = its left/x side)
  const rel = { b: 0, lat: 0 };
  function zone(w, x, z) {
    const s = w.s, S = w.B.S, fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), dx = x - s.x, dz = z - s.z;
    rel.b = -(dx * fx + dz * fz) - HIND * S; rel.lat = dx * fz - dz * fx;
    const inner = rel.b > INNER.b0 * S && rel.b < INNER.b1 * S && Math.abs(rel.lat) < INNER.w * S;
    const outer = rel.b > INNER.b0 * S && rel.b < OUTER.b1 * S && Math.abs(rel.lat) < OUTER.w * S;
    return inner ? 2 : outer ? 1 : 0;
  }
  function calm(w) { if (w.alerted) { w.s.alertGoal = 0; w.alerted = false; } w.inT = 0; }
  const canKick = (w) => { const s = w.s; return w.cool <= 0 && !s.kick && !s.jump && !s.rear && !(s.stun > 0) && Math.abs(s.speed) <= WALK * (w.B.speed ?? 1); };

  let seq = null, lastWarn = -99, clock = 0;

  // ---- the zone test: 15 Hz, horses within NEAR metres, nothing at all unless you are on foot with empty hands
  SU.onUpdate((dt) => {
    clock += dt;
    const P = player();
    const free = P && P.mode === 'free' && !seq && SU.modal === 0;
    for (const w of watched) {
      w.cool -= dt;
      if (!free) { if (w.alerted || w.inT) calm(w); continue; }
      const dx = P.x - w.s.x, dz = P.z - w.s.z;
      if (dx * dx + dz * dz > NEAR * NEAR) { if (w.alerted || w.inT) calm(w); continue; }
      let zn = canKick(w) ? zone(w, P.x, P.z) : 0;
      // a horse standing in its own box has its croup to the door: coming in at a walk, you have spoken to it first (the
      // lesson), so it stays calm and you get the tip instead of a kick. Running in still surprises it.
      if (zn && w.home && Math.abs(P.speed) <= 2.2 && Math.hypot(w.s.x - w.home.x, w.s.z - w.home.z) < 1.2 && Math.hypot(P.x - w.home.x, P.z - w.home.z) < 3.8) {
        if (zn === 2 && clock - (w.tipT ?? -99) > 40) { w.tipT = clock; SU.toast(`Tu préviens ${w.name} de la voix, puis tu passes le long de son épaule.`, 'info'); }
        zn = 0;
      }
      if (zn === 0) { calm(w); continue; }
      // the warning: ears back, tail swishing, the hind hoof on your side cocked
      if (!w.alerted) {
        w.alerted = true; w.s.alertGoal = 1;
        if (clock - lastWarn > 5) { lastWarn = clock; SU.toast('Attention ! Ne passe pas derrière la croupe.', 'warn'); }
      }
      w.s.alertSide = rel.lat >= 0 ? 1 : -1;
      w.s.swish = Math.max(w.s.swish ?? 0, 0.6);
      if (zn === 2) { w.inT += dt; if (w.inT >= (Math.abs(P.speed) > 2.2 ? 0.1 : 0.35)) kickNow(w); }
      else w.inT = 0;
    }
  }, { hz: 15 });

  // ---- the kick
  const overlay = document.createElement('div'); overlay.id = 'su-kick';
  overlay.innerHTML = `<svg viewBox="0 0 200 140" aria-hidden="true">
    <polygon points="100,4 116,40 156,14 140,52 196,50 150,74 190,104 138,94 146,136 108,104 84,138 80,100 30,124 56,86 6,80 52,60 18,24 70,42" fill="#ffd23f" stroke="#2a1d12" stroke-width="5" stroke-linejoin="round"/>
    <text x="101" y="86" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="40" fill="#e8452c" stroke="#2a1d12" stroke-width="2.5">POC !</text></svg>`;
  const MOVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D', ' '];

  function kickNow(o) {
    const w = find(o) ?? (o && o.s ? watch(o) : null);
    const P = player();
    if (!w || seq || !P || P.mode !== 'free') return false;
    zone(w, P.x, P.z);
    const s = w.s, side = rel.lat >= 0 ? 1 : -1;
    s.kick = { t: 0, side }; s.alertGoal = 0; s.speed = 0; w.alerted = false; w.inT = 0; w.cool = 8;
    SU.modal++;                                            // no game keys (and no F prompt) until you are back on your feet
    for (const k of MOVE_KEYS) dispatchEvent(new KeyboardEvent('keyup', { key: k }));   // let go of any held arrow
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    P.speed = 0; P.yaw = Math.atan2(s.x - P.x, s.z - P.z);  // turned towards the croup, so you fall on your back
    seq = { w, t: 0, hit: false, vx: -fx * 4.2, vz: -fz * 4.2, fall: 0 };
    if (!overlay.isConnected) document.body.append(overlay);
    return true;
  }

  // the kick sequence runs every frame (it only ever exists for under 2 s)
  SU.onUpdate((dt) => {
    if (!seq) return;
    const P = player(), q = seq;
    q.t += dt;
    if (!q.hit && q.t >= T_HIT) {
      q.hit = true;
      SU.audio.hoofSound(1.2, 0); setTimeout(() => SU.audio.hoofSound(0.7, 0), 60);
      overlay.className = 'flash pow'; requestAnimationFrame(() => requestAnimationFrame(() => { if (seq) overlay.className = 'pow'; }));
      setTimeout(() => { if (overlay.className === 'pow') overlay.className = 'out'; }, 700);
    }
    if (q.hit && P.mode === 'free') {
      const u = q.t - T_HIT, e = Math.exp(-3.2 * dt);
      P.x += q.vx * dt; P.z += q.vz * dt; q.vx *= e; q.vz *= e;
      SU.actions.collidePerson(P);
      P.speed = 0;
      q.fall = smooth(clamp(u / 0.4, 0, 1)) * (1 - smooth(clamp((q.t - T_RISE) / (T_UP - T_RISE), 0, 1)));
      SU.actions.placeFree(P);
      const g = P.group;
      g.rotation.order = 'YXZ'; g.rotation.x = -1.42 * q.fall; g.rotation.z = 0.15 * Math.sin(u * 9) * (1 - q.fall);
      g.position.y += 0.12 * P.size * Math.sin(Math.PI * clamp(u / 0.4, 0, 1)) + 0.06 * P.size * q.fall;
    }
    if (q.t >= T_UP) back();
  });

  // back on your feet where you landed; the horse leaves you a few seconds to walk away
  function back() {
    const q = seq; if (!q) return;
    const P = player(), g = P.group;
    seq = null; SU.modal--;
    g.rotation.set(0, 0, 0, 'XYZ');
    if (P.mode === 'free') {
      P.speed = 0; SU.actions.placeFree(P);
      P.near = SU.actions.nearbyHorse(P); SU.actions.onModeChanged();   // so the core's "Press E…" doesn't cover the message below
    }
    overlay.className = ''; setTimeout(() => { if (!seq) overlay.remove(); }, 400);
    SU.toast(`Aïe ! Derrière lui, ${q.w.name || 'le cheval'} ne te voit pas : passe loin derrière et préviens-le de la voix.`, 'warn');
  }

  SU.features.safety = { watch, unwatch, kickNow, zone: (w, x, z) => zone(w, x, z), get busy() { return !!seq; }, watched };
}
