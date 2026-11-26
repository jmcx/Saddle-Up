// Safety lesson (Galop 1): never pass close behind a horse. On foot with empty hands, walk into the zone behind a horse's
// croup and it warns you (ears pinned back, tail swishing, a hind hoof cocked), then kicks: you fly back, fall, and wake up
// in hospital, where the doctor explains the lesson. Comic-strip tone, nothing gory.
//
// SU.features.safety = { watch({ R, s, B, name }) -> entry, unwatch(obj), kickNow(obj), zone(entry, x, z), get busy }
//   watch: let another feature's horse kick too (R, s as from SU.buildHorse / SU.newRigState, animated by SU.updateRig)

const HIND = 1.0;                                 // where the hindquarters end, in horse units behind the rig origin (x B.S), measured on buildHorse
const NEAR = 6;                                   // only horses this close are tested
const INNER = { b0: -0.4, b1: 1.6, w: 0.6 };      // the kick zone, metres behind the hindquarters (x B.S)
const OUTER = { b1: 2.5, w: 1.0 };                // the warning zone
const WALK = 1.7 * 1.15;                          // faster than a walk (x B.speed): too busy going somewhere to kick
const T_HIT = 0.22, T_FADE = 1.5, T_PANEL = 2.25; // kick sequence timeline (s)

const CSS = `
#su-kick { position: fixed; inset: 0; z-index: 15; pointer-events: none; display: grid; place-items: center; background: #fff; opacity: 0; transition: opacity .25s ease-out; }
#su-kick.flash { opacity: .85; transition: none; }
#su-kick.fade { opacity: 1; background: #fdf8ec; transition: opacity .7s ease-in; }
#su-kick svg { width: min(340px, 70vw); transform: scale(.2) rotate(-12deg); opacity: 0; transition: transform .18s cubic-bezier(.3,1.8,.5,1), opacity .1s; }
#su-kick.pow svg { transform: scale(1) rotate(-8deg); opacity: 1; }
#su-kick.fade svg { opacity: 0; transition: opacity .4s; }
.su-hosp svg.room { display: block; width: 100%; height: auto; border-radius: 12px; background: #dcebf3; }
.su-hosp .doc { margin: 12px 0 10px; padding: 10px 14px; background: #fff; border: 2px solid #e2d6bd; border-radius: 14px; position: relative; font-size: 15.5px; }
.su-hosp .doc b { color: #2f6f8f; }
.su-hosp ol { list-style: none; padding: 0; margin: 0 0 14px; display: grid; gap: 8px; }
.su-hosp li { display: flex; gap: 10px; align-items: flex-start; background: #f4eeda; border-radius: 12px; padding: 9px 12px; font-size: 15px; line-height: 1.4; }
.su-hosp li .ic { font-size: 22px; flex: none; width: 28px; text-align: center; }
`;

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export function init(SU) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const { clamp, smooth } = SU.util;
  // SU.player is copied by Object.assign in index.html, so it goes stale when you switch rider: prefer the live one
  const player = () => SU.player;
  const watched = [];
  const watch = (o) => { const w = { R: o.R, s: o.s, B: o.B, name: o.name ?? '', cool: 0, inT: 0, warnT: 0, alerted: false }; watched.push(w); return w; };
  const find = (o) => watched.find(w => w === o || w.s === o.s || (o.R && w.R === o.R));
  const unwatch = (o) => { const w = find(o); if (!w) return; calm(w); watched.splice(watched.indexOf(w), 1); };
  for (const h of SU.horses) watch(h);

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
      const zn = canKick(w) ? zone(w, P.x, P.z) : 0;
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
    SU.modal++;                                            // no game keys (and no F prompt) until you are back at the club
    for (const k of MOVE_KEYS) dispatchEvent(new KeyboardEvent('keyup', { key: k }));   // let go of any held arrow
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    P.speed = 0; P.yaw = Math.atan2(s.x - P.x, s.z - P.z);  // turned towards the croup, so you fall on your back
    seq = { w, t: 0, hit: false, fade: false, vx: -fx * 4.2, vz: -fz * 4.2, fall: 0, panel: null };
    if (!overlay.isConnected) document.body.append(overlay);
    return true;
  }

  // the kick sequence runs every frame (it only ever exists for 2 s)
  SU.onUpdate((dt) => {
    if (!seq || seq.panel) return;
    const P = player(), q = seq;
    q.t += dt;
    if (!q.hit && q.t >= T_HIT) {
      q.hit = true;
      SU.audio.hoofSound(1.2, 0); setTimeout(() => SU.audio.hoofSound(0.7, 0), 60);
      overlay.className = 'flash pow'; requestAnimationFrame(() => requestAnimationFrame(() => { if (seq && !seq.fade) overlay.className = 'pow'; }));
    }
    if (q.hit && P.mode === 'free') {
      const u = q.t - T_HIT, e = Math.exp(-3.2 * dt);
      P.x += q.vx * dt; P.z += q.vz * dt; q.vx *= e; q.vz *= e;
      SU.actions.collidePerson(P);
      P.speed = 0;
      q.fall = smooth(clamp(u / 0.4, 0, 1));
      SU.actions.placeFree(P);
      const g = P.group;
      g.rotation.order = 'YXZ'; g.rotation.x = -1.42 * q.fall; g.rotation.z = 0.15 * Math.sin(u * 9) * (1 - q.fall);
      g.position.y += 0.12 * P.size * Math.sin(Math.PI * clamp(u / 0.4, 0, 1)) + 0.06 * P.size * q.fall;
    }
    if (!q.fade && q.t >= T_FADE) { q.fade = true; overlay.className = 'fade'; }
    if (q.t >= T_PANEL) { q.panel = hospital(); SU.modal--; }
  });

  // ---- the hospital
  function riderSvg(look) {
    const hair = hex(look.hair ?? 0x4b3424), skin = hex(look.skin ?? 0xe2b396), blanket = hex(look.jacket ?? 0x3d7cc9);
    return `
      <!-- bed -->
      <rect x="40" y="150" width="250" height="16" rx="4" fill="#9fb4c2"/>
      <rect x="40" y="112" width="12" height="78" rx="4" fill="#7f97a8"/><rect x="278" y="128" width="12" height="62" rx="4" fill="#7f97a8"/>
      <rect x="56" y="122" width="70" height="30" rx="14" fill="#ffffff" stroke="#d6dde3" stroke-width="2"/>
      <!-- rider: hair, face, bandage -->
      ${look.bun ? `<circle cx="74" cy="112" r="11" fill="${hair}"/>` : ''}
      <circle cx="92" cy="120" r="23" fill="${hair}"/>
      <circle cx="94" cy="124" r="19" fill="${skin}"/>
      ${look.bangs ? `<path d="M76 118 Q80 100 98 101 Q112 102 113 117 Q104 108 96 114 Q88 108 76 118 Z" fill="${hair}"/>` : `<path d="M76 116 Q84 101 102 103 Q94 108 76 116 Z" fill="${hair}"/>`}
      <path d="M74 112 Q94 100 114 112 L113 119 Q94 108 75 119 Z" fill="#fff" stroke="#dbe2e8" stroke-width="1.2"/>
      <rect x="99" y="104" width="12" height="7" rx="2" fill="#f6c8c0" transform="rotate(-14 105 107)"/>
      <path d="M86 127 q3 -3 6 0 M98 127 q3 -3 6 0" stroke="#3a2a20" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M90 135 q5 4 10 0" stroke="#b5594a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="84" cy="133" r="3.2" fill="#f4a6a0" opacity=".7"/><circle cx="106" cy="133" r="3.2" fill="#f4a6a0" opacity=".7"/>
      <!-- plaster on a crossed cheek -->
      <g transform="rotate(30 107 128)"><rect x="101" y="125" width="13" height="6" rx="2" fill="#f2d3a8"/><circle cx="105" cy="128" r=".8" fill="#c9a27a"/><circle cx="110" cy="128" r=".8" fill="#c9a27a"/></g>
      <!-- blanket and a leg in plaster sticking out with a star -->
      <path d="M112 136 Q200 118 284 132 L284 156 L112 156 Z" fill="${blanket}"/>
      <path d="M112 136 Q200 118 284 132" stroke="#fff" stroke-width="3" fill="none" opacity=".35"/>
      <rect x="236" y="112" width="52" height="20" rx="9" fill="#ffffff" stroke="#d6dde3" stroke-width="2"/>
      <path d="M262 116 l2 4 4 .5 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -.5 z" fill="#ffd23f"/>`;
  }
  function doctorSvg() {
    return `
      <g transform="translate(372 52)">
        <rect x="-26" y="44" width="52" height="86" rx="18" fill="#ffffff" stroke="#cfd8df" stroke-width="2"/>
        <rect x="-8" y="44" width="16" height="22" fill="#7cc4b8"/>
        <path d="M-12 56 q0 26 12 26 q12 0 12 -26" stroke="#4b5560" stroke-width="2.5" fill="none"/><circle cx="0" cy="84" r="4" fill="#4b5560"/>
        <circle cx="0" cy="22" r="22" fill="#8a5a3c"/><circle cx="0" cy="26" r="18" fill="#c58b68"/>
        <path d="M-18 20 Q0 -2 18 20 Q8 10 0 14 Q-8 8 -18 20 Z" fill="#2a1d12"/>
        <circle cx="-6" cy="26" r="2.2" fill="#2a1d12"/><circle cx="6" cy="26" r="2.2" fill="#2a1d12"/>
        <path d="M-6 34 q6 5 12 0" stroke="#2a1d12" stroke-width="2" fill="none" stroke-linecap="round"/>
        <rect x="16" y="70" width="22" height="30" rx="3" fill="#e9d7a8" stroke="#a88a4e" stroke-width="2" transform="rotate(12 27 85)"/>
        <rect x="-20" y="130" width="14" height="10" rx="3" fill="#4b5560"/><rect x="6" y="130" width="14" height="10" rx="3" fill="#4b5560"/>
      </g>`;
  }
  function roomSvg(look) {
    return `<svg class="room" viewBox="0 0 460 200" role="img" aria-label="Une chambre d'hôpital">
      <rect width="460" height="200" fill="#dcebf3"/><rect y="168" width="460" height="32" fill="#c9d8c4"/>
      <!-- window with sun and a horse in the field -->
      <rect x="150" y="20" width="110" height="70" rx="6" fill="#bfe3f7" stroke="#fff" stroke-width="6"/>
      <circle cx="236" cy="40" r="10" fill="#ffd23f"/><path d="M153 74 Q200 62 257 72 L257 87 L153 87 Z" fill="#8cc47a"/>
      <path d="M178 70 l4 -9 h14 l4 -5 3 2 -3 6 v6 M182 70 v6 M196 70 v6" stroke="#7a4122" stroke-width="3" fill="none" stroke-linecap="round"/>
      <line x1="205" y1="20" x2="205" y2="90" stroke="#fff" stroke-width="4"/>
      <!-- poster: never behind the croup -->
      <g transform="translate(22 22)"><rect width="78" height="58" rx="5" fill="#fff8e6" stroke="#e2d6bd" stroke-width="2"/>
        <path d="M14 36 q4 -14 20 -12 h14 l6 -8 4 3 -4 9 v14 M18 36 v10 M44 38 v8" stroke="#7a4122" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <path d="M10 26 q-6 4 -4 12" stroke="#2a1d12" stroke-width="2" fill="none"/>
        <circle cx="14" cy="44" r="9" fill="none" stroke="#e8452c" stroke-width="3"/><line x1="8" y1="50" x2="20" y2="38" stroke="#e8452c" stroke-width="3"/>
        <text x="39" y="12" font-size="8" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" fill="#2a1d12">PAS DERRIÈRE !</text></g>
      <!-- flowers -->
      <g transform="translate(316 150)"><rect x="-8" y="0" width="16" height="18" rx="3" fill="#7cc4b8"/>
        <path d="M0 0 v-16 M-6 0 l-6 -12 M6 0 l6 -12" stroke="#4f8a3c" stroke-width="2"/>
        <circle cx="0" cy="-18" r="5" fill="#ff8fa3"/><circle cx="-12" cy="-14" r="4.5" fill="#ffd23f"/><circle cx="12" cy="-14" r="4.5" fill="#b48cf2"/></g>
      ${riderSvg(look)}
      ${doctorSvg()}
      <!-- a few comic stars over the bump -->
      <g fill="#ffd23f" stroke="#c99a12" stroke-width="1"><path d="M70 88 l2 5 5 .5 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -.5z"/><path d="M118 82 l1.6 4 4 .4 -3 2.6 1 4 -3.6 -2.2 -3.6 2.2 1 -4 -3 -2.6 4 -.4z"/></g>
    </svg>`;
  }
  function doctorLine(name, n) {
    if (n <= 1) return `Bonjour ${name} ! Tu es passée juste derrière un cheval et il t'a donné un coup de pied. Rien de cassé : juste une belle bosse !`;
    if (n === 2) return `Encore toi ? Derrière la croupe, encore ? On va finir par te garder une chambre, ${name} !`;
    if (n === 3) return `Encore toi ?! Je t'ai gardé ton lit préféré, près de la fenêtre. Les infirmières t'appellent déjà « Mademoiselle Sabot ».`;
    return `${n}e visite, ${name} ! Tu as gagné la carte de fidélité de l'hôpital… mais les chevaux préféreraient te voir passer loin d'eux.`;
  }
  function hospital() {
    const P = player(), look = P.look ?? {}, name = look.name ?? 'toi';
    const visits = SU.store.get('safety.hospital', {});
    const n = visits[name] = (visits[name] ?? 0) + 1; SU.store.set('safety.hospital', visits);
    const pn = SU.ui.panel({ title: '🏥 À l’hôpital', closable: false, onClose: back });
    pn.el.classList.add('su-hosp');
    pn.body.innerHTML = `${roomSvg(look)}
      <div class="doc"><b>Le docteur :</b> ${doctorLine(name, n)}</div>
      <ol>
        <li><span class="ic">👀</span><span>Juste derrière lui, le cheval <b>ne te voit pas</b>. S’il est surpris, il tape.</span></li>
        <li><span class="ic">↩️</span><span>Pour passer derrière, <b>passe loin derrière</b> (plus d’une longueur de cheval) et <b>préviens-le de la voix</b>.</span></li>
        <li><span class="ic">💛</span><span>Un cheval qui tape n’est pas méchant : <b>il a eu peur</b>.</span></li>
      </ol>`;
    const btn = SU.ui.el('button', 'su-btn primary', 'Je retourne au club 🐴');
    btn.addEventListener('click', () => pn.close());
    pn.body.append(btn);
    setTimeout(() => btn.focus(), 50);
    return pn;
  }

  // back on your feet, standing safely by the horse's head
  function back() {
    const q = seq; if (!q) return;
    const P = player(), g = P.group, s = q.w.s, S = q.w.B.S, fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    g.rotation.set(0, 0, 0, 'XYZ');
    if (P.mode === 'free') {
      const d = 1.25 * S + 0.7, lx = 0.55 * S + 0.4;
      const tries = [[d, lx], [d, -lx], [d + 0.8, 0], [0.2 * S, 0.9 * S + 0.6], [0.2 * S, -(0.9 * S + 0.6)]];
      let ok = false;
      for (const [a, l] of tries) {
        P.x = s.x + fx * a + fz * l; P.z = s.z + fz * a - fx * l;
        for (let i = 0; i < 3; i++) SU.actions.collidePerson(P);
        if (!watched.some(w => zone(w, P.x, P.z) === 2)) { ok = true; break; }
      }
      if (!ok && SU.world.places.yard) { const Y = SU.world.places.yard; P.x = (Y.minX + Y.maxX) / 2; P.z = (Y.minZ + Y.maxZ) / 2; SU.actions.collidePerson(P); }
      P.yaw = Math.atan2(s.x + fx * S - P.x, s.z + fz * S - P.z); P.speed = 0;
      SU.actions.placeFree(P);
    }
    q.w.cool = 3;
    overlay.className = ''; setTimeout(() => { if (!seq) overlay.remove(); }, 400);
    seq = null;
    SU.toast('Te revoilà ! Fais le tour loin derrière les chevaux.', 'info');
  }

  SU.features.safety = { watch, unwatch, kickNow, zone: (w, x, z) => zone(w, x, z), get busy() { return !!seq; }, watched };
}
