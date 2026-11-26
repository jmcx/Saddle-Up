// care feature: looking after the horse (s'occuper du cheval), all Galop 1 skills.
// One F interaction per horse ("S'occuper de Comet") opens a menu of what you can do now: tighten the girth, groom,
// feed, water, saddle / unsaddle, bridle / unbridle. In the tack room: choose saddle and bridle, and clean the tack.
// Per-horse state lives here (keyed by the rig, so any { B, R, s, name } object works) and ticks at 2 Hz.
import { makeLook, SADDLES, sizeOf } from './care/look.js';
import { openGroom } from './care/groom.js';
import { sequence, chooseTack } from './care/tackroom.js';

const de = (n) => (/^[AEIOUYÉaeiouyé]/.test(n) ? `d’${n}` : `de ${n}`);   // French elision: d’Onyx, de Comet
export function init(SU) {
  const fx = makeLook(SU);
  const W = SU.world, places = W.places;
  const states = new WeakMap(), tracked = [];
  let gameT = 0;

  function state(h) {
    let S = states.get(h.R);
    if (!S) {
      S = {
        dirt: 0.1 + Math.random() * 0.2, feetClean: false, hunger: 0.25, thirst: 0.2,
        saddled: true, bridled: true, girthed: false, tackDirt: 0.25, shine: 0, walked: 0,
        pelletsAt: -1e9, treats: [], water: 0.8,
        look: { saddle: sizeOf(h) === 'poney' ? 'poney' : 'mixte', pad: 'blanc', leather: 'marron', noseband: 'fr' },
        lastDirtKey: -1,
      };
      states.set(h.R, S);
      fx.applyTack(h, S);
    }
    return S;
  }
  const isTacked = (h) => { const S = state(h); return S.saddled && S.bridled; };
  const isGirthed = (h) => state(h).girthed;
  function setGirthed(h, v) { state(h).girthed = !!v; }
  function setTacked(h, v) { const S = state(h); S.saddled = S.bridled = !!v; if (!v) S.girthed = false; fx.applyTack(h, S); }
  const applyTack = (h) => fx.applyTack(h, state(h));

  // good deeds per rider, the only thing saved
  const deeds = () => SU.store.get('care.deeds', {});
  function deed(h, kind, praise, big = false) {
    const who = SU.player?.look?.name ?? 'moi', d = deeds(); d[who] = (d[who] ?? 0) + 1; SU.store.set('care.deeds', d);
    if (praise) SU.toast(praise, 'good');
    fx.happy(h, big);
    SU.emit('care', kind, h);
  }

  // ---- where things are
  const P = () => SU.player;
  const held = (h) => { const p = P(); return !!p && p.horse === h.R && p.mode !== 'free'; };
  const leadingIt = (h) => { const p = P(); return !!p && p.horse === h.R && p.mode === 'lead'; };
  const atBox = (h) => !!h.box && Math.hypot(h.s.x - h.box.x, h.s.z - h.box.z) < 1.2;
  const pp = {};
  const nearBox = (h) => { if (!h.box) return false; SU.personPos(pp); return Math.hypot(pp.x - h.box.x, pp.z - h.box.z) < 3 || atBox(h); };
  const boxIdx = (h) => (h.box ? W.stallBoxes.indexOf(h.box) : -1);
  const inside = (b, x, z, m = 0) => !!b && x > b.minX - m && x < b.maxX + m && z > b.minZ - m && z < b.maxZ + m;
  // you may groom / tack up a horse you hold, or one standing in its box
  // ...or one tied up at the grooming bay (standing at one of its spots)
  const atBay = (h) => !!places.groomingBay?.spots?.some(p => Math.hypot(h.s.x - p.x, h.s.z - p.z) < 1.6);
  const steady = (h) => held(h) || atBox(h) || atBay(h);
  const notSteady = (h) => `Tiens ${h.name} en main (E), ou laisse-le dans son box ou à l'aire de pansage.`;

  // ---- per-horse drink / ration spots for the head-down eating pose (s.eatHay: the rig eats from any { x, z, low, amount })
  const bucketSpot = W.stallBoxes.map((b, i) => fx.buckets[i] ? { x: fx.buckets[i].x, z: fx.buckets[i].z, reach: 1.2, low: false, amount: 0, drink: true } : null);
  const troughSpot = places.trough ? { x: places.trough.x, z: places.trough.z, reach: 1.6, low: false, amount: 0, drink: true } : null;
  function eatFrom(h, spot, seconds) { spot.amount = seconds / 120 + 0.02; h.s.eatHay = spot; h.s.idle = 0; }

  // ---- girth, tack and riding: mounting is refused until the horse is saddled, bridled and girthed
  SU.guards.mount.push((h) => {
    if (!h || !h.R) return null;
    const S = state(h);
    if (!S.saddled && !S.bridled) return `${h.name} n'a ni selle ni filet : selle-le et bride-le d'abord (F).`;
    if (!S.saddled) return `Pas de selle ! Selle ${h.name} avant de monter (F).`;
    if (!S.bridled) return `Pas de filet ! Bride ${h.name} avant de monter (F).`;
    if (!S.girthed) { SU.ui.say?.('Attention, la sangle est lâche. Ressangle avant de monter.'); return `Sangle lâche ! Ressangle ${h.name} avant de monter (F).`; }
    return null;
  });
  // R / course change puts you straight back in the saddle: that horse counts as tacked and girthed
  SU.on('reset', () => { const h = SU.horse; if (!h) return; const S = state(h); S.saddled = S.bridled = S.girthed = true; fx.applyTack(h, S); });
  function ressangler(h) {
    const S = state(h);
    if (!S.saddled) { SU.toast(`${h.name} n'a pas de selle.`, 'warn'); return false; }
    fx.buckle();
    S.girthed = true;
    SU.toast('Sangle resserrée. Tu peux monter !', 'good');
    SU.emit('care', 'girth', h);
    return true;
  }

  // ---- the 2 Hz tick: dirt, hunger, thirst, water levels, girth loosening back in the box, drinking
  const cam = SU.camera.position;
  function tick(dt) {
    gameT += dt;
    const p = P();
    for (const h of tracked) {
      const S = state(h), s = h.s, sp = Math.abs(s.speed ?? 0), ridden = !!p && p.horse === h.R && p.mode === 'ride';
      if (ridden) {
        S.girthed = true;
        if (!S.saddled || !S.bridled) { S.saddled = S.bridled = true; fx.applyTack(h, S); }
      } else if (!held(h) && !(p?.mode === 'toTake' && p.target === h) && atBox(h)) S.girthed = false;
      // dirt from work (and slowly from the straw), feet pick up mud after a few hundred metres
      S.dirt = Math.min(1, S.dirt + dt * (sp > 0.5 ? 0.00075 * sp : 0.00025));
      S.walked += sp * dt; if (S.walked > 400) S.feetClean = false;
      if (ridden && sp > 0.5) { const t0 = S.tackDirt; S.tackDirt = Math.min(1, S.tackDirt + dt * 0.0006 * sp); if (Math.floor(t0 * 20) !== Math.floor(S.tackDirt * 20)) fx.applyTack(h, S); }
      S.shine = Math.max(0, S.shine - dt);
      S.hunger = Math.min(1, S.hunger + dt * (1 / 900 + (sp > 0.5 ? sp / 6000 : 0)));
      S.thirst = Math.min(1, S.thirst + dt * (1 / 700 + (sp > 0.5 ? sp / 4000 : 0)));
      const eat = s.eatHay;
      if (eat && !eat.drink && !eat.ration) S.hunger = Math.max(0, S.hunger - dt / 40);
      // the box bucket empties slowly; a thirsty horse in its box drinks now and then
      const bi = boxIdx(h);
      if (bi >= 0) {
        S.water = Math.max(0, S.water - dt / 900);
        if (!held(h) && atBox(h) && S.thirst > 0.3 && S.water > 0.08 && bucketSpot[bi] && !(eat && eat.drink) && Math.random() < dt * 0.05) {
          eatFrom(h, bucketSpot[bi], 6); S.thirst = 0; S.water = Math.max(0, S.water - 0.15);
        }
        fx.setWater(bi, S.water);
      }
      fx.applyDirt(h, S, cam);
    }
  }
  SU.onUpdate(tick, { hz: 2 });
  // the bucket water only matters up close
  if (places.barn) {
    const b = places.barn, c = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, r: 40 };
    SU.onUpdate(() => {}, { near: c, onRange: (inR) => { fx.water.visible = inR; } });
  }

  // ---- status shown inside the horse's menu
  function status(h) {
    const S = state(h), bi = boxIdx(h);
    const chip = (ok, txt) => `<span style="display:inline-block;margin:2px 4px 2px 0;padding:3px 9px;border-radius:99px;font-size:13px;background:${ok ? '#dff0d3' : '#fde4d8'}">${txt}</span>`;
    const dirt = S.dirt < 0.15 ? 'Propre' : S.dirt < 0.5 ? 'Un peu sale' : 'Sale';
    const tack = S.saddled && S.bridled ? 'Sellé et bridé' : S.bridled ? 'Bridé, sans selle' : S.saddled ? 'Sellé, en licol' : 'En licol';
    const water = bi < 0 ? null : S.water > 0.6 ? 'Seau plein' : S.water > 0.15 ? 'Seau à moitié' : 'Seau vide !';
    const n = deeds()[SU.player?.look?.name ?? 'moi'] ?? 0;
    return `<div style="margin-bottom:6px">${chip(S.dirt < 0.15, dirt)}${chip(S.feetClean, S.feetClean ? 'Pieds curés' : 'Pieds à curer')}${chip(S.hunger < 0.5, S.hunger < 0.5 ? 'A mangé' : 'A faim')}`
      + `${chip(S.thirst < 0.5, S.thirst < 0.5 ? 'A bu' : 'A soif')}${water ? chip(S.water > 0.15, water) : ''}${chip(S.saddled && S.bridled, tack)}`
      + `${S.saddled ? chip(S.girthed, S.girthed ? 'Sangle serrée' : 'Sangle lâche') : ''}</div>`
      + (n ? `<div style="font-size:12.5px;opacity:.7;margin-bottom:4px">⭐ Tes bonnes actions : ${n}</div>` : '');
  }

  // ---- the horse's menu
  function openMenu(h) {
    const S = state(h), lead = leadingIt(h), items = [];
    if (lead && S.saddled && !S.girthed) items.push({ icon: '🔧', label: 'Ressangler', sub: 'La sangle s’est relâchée : resserre-la juste avant de monter.', action: () => ressangler(h) });
    items.push({ icon: '🪮', label: 'Panser', sub: 'Étrille, bouchon, brosse douce, cure-pieds', action: () => groom(h) });
    items.push({ icon: '🥕', label: 'Nourrir', sub: 'Foin, granulés ou friandise', action: () => feedMenu(h) });
    if (boxIdx(h) >= 0) items.push({ icon: '💧', label: 'Remplir le seau d’eau', sub: nearBox(h) ? 'Un cheval doit toujours avoir de l’eau propre.' : 'Le seau est dans son box.', disabled: !nearBox(h), action: () => fillWater(h) });
    items.push(S.saddled
      ? { icon: '🪑', label: 'Desseller', sub: 'Dessangler, puis retirer la selle et le tapis', action: () => unsaddle(h) }
      : { icon: '🪑', label: 'Seller', sub: 'Le tapis, la selle, puis la sangle', action: () => saddle(h) });
    items.push(S.bridled
      ? { icon: '🐴', label: 'Débrider', sub: 'Retirer le filet et mettre le licol', action: () => unbridle(h) }
      : { icon: '🐴', label: 'Brider', sub: 'Mettre le filet à la place du licol', action: () => bridle(h) });
    return SU.ui.menu(`S’occuper ${de(h.name)}`, items, { intro: status(h) });
  }

  // ---- grooming
  function groom(h) {
    if (!steady(h)) { SU.toast(notSteady(h), 'warn'); return null; }
    const S = state(h);
    return openGroom(SU, h, S, fx, ({ frac, feet, complete, worked }) => {
      S.dirt *= 1 - frac; if (feet) { S.feetClean = true; S.walked = 0; }
      if (complete) { S.dirt = 0; S.shine = 600; deed(h, 'groom', `${h.name} est tout propre. Bravo !`, true); }
      else if (worked) { if (frac > 0.3) S.shine = 120; SU.emit('care', 'groom', h); SU.toast(frac > 0.9 ? `${h.name} est presque tout propre !` : `Le pansage n’est pas fini, mais c’est déjà bien !`, 'info'); }
      fx.applyDirt(h, S, cam);
    });
  }

  // ---- feeding
  function feedMenu(h) {
    const S = state(h), atB = nearBox(h), room = places.feedRoom;
    const needFetch = !!room && !S.carryPellets;
    return SU.ui.menu(`Nourrir ${h.name}`, [
      { icon: '🌾', label: 'Fourrage (foin)', sub: atB ? 'La base de son repas : il en mange presque toute la journée.' : 'Le foin se donne dans son box.', disabled: !atB, action: () => feed(h, 'foin') },
      { icon: '🥣', label: 'Granulés', sub: needFetch ? 'Va d’abord chercher la ration à la réserve.' : 'Une ration mesurée, dans un seau.', disabled: needFetch, action: () => feed(h, 'granules') },
      { icon: '🥕', label: 'Une carotte', sub: 'Une friandise, pour le récompenser', action: () => feed(h, 'carotte') },
      { icon: '🍎', label: 'Une pomme', sub: 'Une friandise, pour le récompenser', action: () => feed(h, 'pomme') },
    ], { intro: '<div style="font-size:13.5px;opacity:.8;margin-bottom:4px">Le foin d’abord, un peu de granulés, et les friandises juste pour dire merci.</div>' });
  }
  // kind: 'foin' | 'granules' | 'carotte' | 'pomme'. Returns true when given.
  function feed(h, kind) {
    const S = state(h);
    if (kind === 'foin') {
      const hay = h.box && h.box.hay;
      if (!hay || !nearBox(h)) { SU.toast('Le foin se donne dans son box.', 'warn'); return false; }
      hay.amount = 1; hay.refillT = 45;
      if (atBox(h) && !(h.s.eatHay && h.s.eatHay.drink) && (!held(h) || Math.abs(h.s.speed) < 0.3)) h.s.eatHay = hay;
      S.hunger = Math.max(0, S.hunger - 0.3);
      fx.munch();
      deed(h, 'feed', 'Du bon foin ! C’est la base de son repas.');
      return true;
    }
    if (kind === 'granules') {
      if (places.feedRoom && !S.carryPellets) { SU.toast('Les granulés sont dans la réserve à grain, dans le hangar : va préparer sa ration.', 'warn'); return false; }
      if (gameT - S.pelletsAt < 600) { SU.toast('Trop de granulés, ça peut le rendre malade ! Une ration suffit.', 'bad'); SU.ui.say?.('Trop de granulés, ça peut le rendre malade.'); return false; }
      S.pelletsAt = gameT; S.carryPellets = false; S.hunger = Math.max(0, S.hunger - 0.35);
      const sp = { x: h.s.x + Math.sin(h.s.yaw) * 1.1 * h.B.S, z: h.s.z + Math.cos(h.s.yaw) * 1.1 * h.B.S, reach: 1, low: true, ration: true, amount: 0 };
      eatFrom(h, sp, 8); fx.munch();
      deed(h, 'feed', 'Sa ration de granulés : juste ce qu’il faut.');
      return true;
    }
    // treats: a little only, hand flat
    S.treats = S.treats.filter(t => gameT - t < 180);
    if (S.treats.length >= 2) { SU.toast('Juste un peu ! Une friandise, c’est une récompense, pas un repas.', 'warn'); return false; }
    S.treats.push(gameT); S.hunger = Math.max(0, S.hunger - 0.03);
    fx.munch();
    deed(h, 'feed', `${kind === 'pomme' ? 'Une pomme' : 'Une carotte'}, main bien à plat : il ne peut pas te pincer.`, true);
    return true;
  }
  // a feed room may be added by another feature: if so, granulés are fetched there first
  SU.interact.add({
    id: 'care-feedroom', icon: '🥣', radius: 2.5, label: () => `Préparer la ration de granulés${SU.horse ? ' ' + de(SU.horse.name) : ''}`,
    pos: () => places.feedRoom ?? null, when: () => !!SU.horse && !state(SU.horse).carryPellets,
    action: () => { const h = SU.horse; state(h).carryPellets = true; SU.toast(`Ration prête dans un seau. Va la donner à ${h.name}.`, 'good'); },
  });

  // ---- water
  function fillWater(h) {
    const S = state(h), bi = boxIdx(h);
    if (bi < 0 || !nearBox(h)) { SU.toast('Va à son box pour remplir son seau.', 'warn'); return false; }
    S.water = 1; fx.setWater(bi, 1); fx.pour();
    if (atBox(h) && !held(h) && bucketSpot[bi]) { eatFrom(h, bucketSpot[bi], 6); S.thirst = 0; }
    deed(h, 'water', 'Seau rempli. Un cheval doit toujours avoir de l’eau propre.');
    return true;
  }
  function drinkTrough(h) {
    const S = state(h); if (!troughSpot) return false;
    eatFrom(h, troughSpot, 6); S.thirst = 0; fx.pour();
    deed(h, 'water', `${h.name} boit à l’abreuvoir. L’eau propre, c’est très important.`);
    return true;
  }

  if (troughSpot) SU.interact.add({
    id: 'care-trough', icon: '🚰', radius: 3, pos: troughSpot, modes: ['lead'],
    label: () => `Faire boire ${SU.horse.name}`, when: () => !!SU.horse && Math.hypot(SU.st.x - troughSpot.x, SU.st.z - troughSpot.z) < 3.2,
    action: () => drinkTrough(SU.horse),
  });

  // ---- saddling and bridling: short ordered activities; the 3D tack follows each step
  function saddle(h) {
    if (!steady(h)) { SU.toast(notSteady(h), 'warn'); return null; }
    const S = state(h), sad = SADDLES[S.look.saddle];
    if (sad && sad.size !== sizeOf(h)) S.look.saddle = sizeOf(h) === 'poney' ? 'poney' : 'mixte';
    const t = h.R.tack.parts;
    return sequence(SU, {
      title: `Seller ${h.name}`, intro: 'Tu te mets à gauche du cheval. Dans quel ordre poses-tu le matériel ?',
      steps: [
        { label: 'Le tapis de selle', icon: '🟦', why: 'il protège le dos et absorbe la sueur. Un peu en avant, puis on le glisse dans le sens du poil.' },
        { label: 'La selle', icon: '🪑', why: 'posée doucement sur le tapis, à sa place, derrière l’épaule.' },
        { label: 'La sangle', icon: '🔗', why: 'on l’attache sans trop serrer. On ressanglera juste avant de monter.' },
      ],
      wrong: [{ label: 'Serrer la sangle très fort tout de suite', icon: '💪', why: 'Non ! Ça le surprend et ça lui fait mal. On serre doucement, en plusieurs fois.' }],
      doneMsg: `${h.name} est sellé. Pense à ressangler avant de monter !`,
      onStep: (i) => {
        if (i === 0) { S.saddled = false; fx.applyTack(h, S); for (const m of t.pad) m.visible = true; }
        if (i === 1) { for (const m of t.saddle) m.visible = true; }
        if (i === 2) { S.saddled = true; S.girthed = false; fx.applyTack(h, S); fx.buckle(); }
      },
      onDone: () => deed(h, 'tack', null),
    });
  }
  function unsaddle(h) {
    if (!steady(h)) { SU.toast(notSteady(h), 'warn'); return null; }
    const S = state(h), t = h.R.tack.parts;
    return sequence(SU, {
      title: `Desseller ${h.name}`, intro: 'Par quoi commences-tu ?',
      steps: [
        { label: 'Remonter les étriers', icon: '⬆️', why: 'ils ne tapent pas le cheval et ne s’accrochent nulle part.' },
        { label: 'Dessangler', icon: '🔓', why: 'sans défaire la sangle, la selle ne peut pas venir !' },
        { label: 'Retirer la selle et le tapis', icon: '🪑', why: 'on les fait glisser vers soi, en arrière, et on les pose bien à l’abri.' },
      ],
      doneMsg: `${h.name} est dessellé. Son dos peut respirer !`,
      onStep: (i) => {
        if (i === 1) { S.girthed = false; for (const m of t.girth) m.visible = false; fx.buckle(); }
        if (i === 2) { S.saddled = false; fx.applyTack(h, S); }
      },
      onDone: () => SU.emit('care', 'untack', h),
    });
  }
  function bridle(h) {
    if (!steady(h)) { SU.toast(notSteady(h), 'warn'); return null; }
    const S = state(h);
    return sequence(SU, {
      title: `Brider ${h.name}`, intro: 'Le filet remplace le licol. Dans quel ordre ?',
      steps: [
        { label: 'Passer les rênes sur l’encolure', icon: '🪢', why: 'comme ça, tu le tiens quand tu enlèves le licol.' },
        { label: 'Mettre le mors et la têtière', icon: '🐴', why: 'le pouce dans le coin de la bouche (là où il n’y a pas de dents) : il ouvre la bouche. Puis la têtière derrière les oreilles.' },
        { label: 'Boucler sous-gorge et muserolle', icon: '✋', why: 'sous-gorge : on passe un poing. Muserolle : deux doigts.' },
      ],
      wrong: [{ label: 'Tirer sur les oreilles', icon: '👂', why: 'Non, doucement ! On plie les oreilles une par une sous la têtière.' }],
      doneMsg: `${h.name} est bridé.`,
      onStep: (i) => { if (i === 1) { S.bridled = true; fx.applyTack(h, S); } },
      onDone: () => deed(h, 'tack', null),
    });
  }
  function unbridle(h) {
    if (!steady(h)) { SU.toast(notSteady(h), 'warn'); return null; }
    const S = state(h);
    return sequence(SU, {
      title: `Débrider ${h.name}`, intro: 'Par quoi commences-tu ?',
      steps: [
        { label: 'Déboucler muserolle et sous-gorge', icon: '🔓', why: 'sinon le filet ne peut pas sortir.' },
        { label: 'Retirer la têtière doucement', icon: '🐴', why: 'on laisse le mors sortir tout seul de la bouche, sans le cogner dans les dents.' },
        { label: 'Mettre le licol', icon: '🟥', why: 'ton cheval n’est jamais sans rien sur la tête : tu peux toujours le tenir.' },
      ],
      doneMsg: `${h.name} est en licol.`,
      onStep: (i) => { if (i === 1) { S.bridled = false; fx.applyTack(h, S); } },
      onDone: () => SU.emit('care', 'untack', h),
    });
  }

  // ---- tack room: choose the saddle and bridle, and clean the tack after riding
  const tr = places.tackRoom;
  const inTackRoom = () => { if (!tr) return false; SU.personPos(pp); return inside(tr, pp.x, pp.z, 0.3); };
  const trPos = tr ? { x: (tr.minX + tr.maxX) / 2, z: (tr.minZ + tr.maxZ) / 2 } : null;
  function chooser(h = SU.horse) { if (!h) return null; const S = state(h); return chooseTack(SU, h, S, () => fx.applyTack(h, S)); }
  function cleanTack(h = SU.horse) {
    if (!h) return null;
    const S = state(h);
    if (S.saddled || S.bridled) { SU.toast(`Le matériel est encore sur ${h.name}. Desselle et débride-le d'abord.`, 'warn'); return null; }
    return sequence(SU, {
      title: `Entretenir le matériel ${de(h.name)}`, intro: `Après le travail, le cuir est plein de sueur et de poussière. ${S.tackDirt > 0.3 ? 'Il en a bien besoin !' : ''} Par quoi commences-tu ?`,
      steps: [
        { label: 'Défaire le filet', icon: '🔓', why: 'on défait les boucles pour nettoyer partout, même dessous.' },
        { label: 'Laver le mors à l’eau', icon: '🚿', why: 'le mors va dans la bouche : à l’eau claire, sans savon.' },
        { label: 'Passer l’éponge humide', icon: '🧽', why: 'elle enlève la sueur et la poussière du cuir.' },
        { label: 'Savon glycériné sur le cuir', icon: '🧼', why: 'il nourrit le cuir : il reste souple et ne craque pas.' },
        { label: 'Remonter et ranger', icon: '🗄️', why: 'le filet sur son crochet, la selle sur son porte-selle, au sec.' },
      ],
      wrong: [
        { label: 'Faire sécher le cuir sur le radiateur', icon: '🔥', why: 'Non ! La chaleur dessèche le cuir et le fait craquer.' },
        { label: 'Savonner le mors', icon: '🫧', why: 'Non, pas de savon sur le mors : ça aurait mauvais goût dans sa bouche !' },
      ],
      doneMsg: 'Ton matériel est propre et souple.',
      onDone: () => { S.tackDirt = 0; fx.applyTack(h, S); deed(h, 'cleanTack', 'Ton matériel est propre et souple.'); },
    });
  }
  if (tr) {
    SU.interact.add({ id: 'care-choose', icon: '🪑', pos: trPos, radius: 4, when: () => inTackRoom() && !!SU.horse,
      label: () => `Choisir la selle et le filet ${de(SU.horse.name)}`, action: () => chooser() });
    SU.interact.add({ id: 'care-clean', icon: '🧼', pos: trPos, radius: 4, when: () => inTackRoom() && !!SU.horse,
      label: () => `Entretenir le matériel ${de(SU.horse.name)}`, action: () => cleanTack() });
  }

  // ---- one interaction per horse, never from behind its croup (it could kick)
  function behind(h) {
    SU.personPos(pp);
    const lz = (pp.x - h.s.x) * Math.sin(h.s.yaw) + (pp.z - h.s.z) * Math.cos(h.s.yaw);
    return lz < -0.5 * h.B.S;
  }
  function register(h) {
    if (tracked.includes(h)) return;
    tracked.push(h); state(h);
    SU.interact.add({
      id: 'care-' + h.name, icon: '🐴', label: () => `S'occuper ${de(h.name)}`, radius: 1.3 * h.B.S + 0.7,
      pos: () => ({ x: h.s.x + Math.sin(h.s.yaw) * 0.3 * h.B.S, z: h.s.z + Math.cos(h.s.yaw) * 0.3 * h.B.S }),
      when: () => { const p = P(); if (p.mode === 'lead') return p.horse === h.R; return !behind(h); },
      action: () => openMenu(h),
    });
  }
  for (const h of SU.horses) register(h);

  SU.features.care = {
    state, isTacked, isGirthed, setGirthed, setTacked, applyTack, register, openMenu, groom, feed, fillWater, drinkTrough,
    saddle, unsaddle, bridle, unbridle, ressangler, chooser, cleanTack, deeds, fx,
  };
}
