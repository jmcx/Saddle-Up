// Riding together: two to four players in the same yard, browser to browser (WebRTC data channels through PeerJS).
// One player creates a game and gets a four-letter code, the others type it. The public PeerJS broker is only used for the
// handshake; after that the players talk directly (on the same Wi-Fi the data never leaves the house). The host relays between guests.
//
// Stage 1: you SEE each other (horse, rider, gaits, jumps, getting on and off, walking on foot). Everything else stays personal:
// each player keeps their own stable horses, ponies, care, courses and Galop 1 progress.
//
// Nothing here costs anything until a game is joined: the library is fetched on demand, the 15 Hz sender only runs while
// connected, and each friend is one horse rig (batched by perf.js, cached per breed) plus one rider.
const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js';
const PREFIX = 'saddleup-loret-';
const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';     // no I, O or Q: easy to read aloud and to type
const SEND_HZ = 15, DELAY = 0.13, STALE = 6, MAX_GUESTS = 3;
const MODES = ['ride', 'lead', 'free', 'toLead', 'toRide', 'toTake'];

export function init(SU) {
  const { THREE, scene, util: { clamp, lerp } } = SU;
  const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
  const angLerp = (a, b, u) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * u; };
  const nowS = () => performance.now() / 1000;

  // ------------------------------------------------------------------ what I send: one small array, 15 times a second
  // [horse, person, mode, hx, hz, hyaw, hspeed, jumpHeight, rearing, px, pz, pyaw, pspeed, my clock]
  function snapshot() {
    const P = SU.player, s = SU.st, h = SU.horse; if (!P || !s || !h) return null;
    return [h.i, Math.max(0, SU.PERSONS.indexOf(P.look)), MODES.indexOf(P.mode),
      r2(s.x), r2(s.z), r3(s.yaw), r2(s.speed), s.jump && !s.jump.fall && s.jump.state !== 'land' ? r2(s.jump.h) : 0, s.rear ? 1 : 0,
      r2(P.x), r2(P.z), r3(P.yaw), r2(P.speed), r3(nowS())];
  }

  // ------------------------------------------------------------------ the friends I see
  const ghosts = new Map();           // id -> ghost
  const _v = new THREE.Vector3();
  function nameSprite(text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d'); g.font = '600 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = Math.min(244, g.measureText(text).width + 36);
    g.fillStyle = 'rgba(20,22,18,0.6)'; g.beginPath(); g.roundRect(128 - w / 2, 8, w, 48, 16); g.fill();
    g.fillStyle = '#fff'; g.fillText(text, 128, 33, 220);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
    sp.scale.set(1.5, 0.375, 1); sp.renderOrder = 5;
    return sp;
  }
  function makeGhost(id) {
    const G = { id, buf: [], rigs: new Map(), hi: -1, pi: -1, R: null, s: null, P: null, label: null, name: '', seen: nowS(), lastJ: 0, lastRear: 0, shown: true,
      ctl: { target: 0, turnIn: 0, player: false, vol: 0, rearHeld: false } };
    ghosts.set(id, G); return G;
  }
  function detach(G) {                 // the rider leaves whatever horse it is on and stands in the scene
    const P = G.P; if (!P) return;
    if (P.horse) P.horse.rider = null;
    scene.add(P.group); P.horse = null; P.mode = 'free';
  }
  function setHorse(G, hi) {
    if (G.hi === hi) return;
    detach(G);
    if (G.R) G.R.root.visible = false;
    let e = G.rigs.get(hi);
    if (!e) {
      const R = SU.buildHorse(SU.BREEDS[hi]); scene.add(R.root);
      e = { R, s: SU.newRigState(0, 0, 0) }; G.rigs.set(hi, e);
      SU.perf?.batchRig?.(R);          // before a rider sits on it, so the rider stays out of the batch
    }
    G.hi = hi; G.R = e.R; G.s = e.s; G.snap = true;
  }
  function setPerson(G, pi) {
    if (G.pi === pi) return;
    const old = G.P;
    if (old) { detach(G); scene.remove(old.group); old.mats.forEach(m => m.dispose()); old.group.traverse(o => o.geometry?.dispose()); }
    const look = SU.PERSONS[pi] ?? SU.PERSONS[0];
    G.P = SU.buildPerson(look); G.P.mode = 'free'; scene.add(G.P.group); G.pi = pi;
    if (G.label) { scene.remove(G.label); G.label.material.map.dispose(); G.label.material.dispose(); }
    const first = !G.name; G.name = look.name; G.label = nameSprite(look.name); scene.add(G.label);
    if (first) { SU.toast(`${look.name} est là ! Vous êtes ensemble.`, 'good'); refresh(); }
  }
  function setMode(G, want) {
    const P = G.P, R = G.R, cur = P.mode, on = P.horse === R;
    const seat = () => { detach(G); SU.actions.seatPerson(P, R); R.rider = P; };
    const stand = () => { detach(G); SU.actions.standAtLead(P, R); R.rider = P; };
    if (want === 'ride') { if (!(on && (cur === 'ride' || cur === 'toRide'))) seat(); }
    else if (want === 'lead') { if (!(on && (cur === 'lead' || cur === 'toLead'))) stand(); }
    else if (want === 'toRide') { if (on && cur === 'lead') { P.mode = 'toRide'; P.tr = 0; } else if (!(on && (cur === 'toRide' || cur === 'ride'))) seat(); }
    else if (want === 'toLead') { if (on && cur === 'ride') { R.root.attach(P.group); P.mode = 'toLead'; P.tr = 0; } else if (!(on && (cur === 'toLead' || cur === 'lead'))) stand(); }
    else if (on || cur !== 'free') detach(G);
  }
  function removeGhost(id, quiet) {
    const G = ghosts.get(id); if (!G) return;
    ghosts.delete(id);
    detach(G);
    if (G.P) { scene.remove(G.P.group); G.P.mats.forEach(m => m.dispose()); G.P.group.traverse(o => o.geometry?.dispose()); }
    if (G.label) { scene.remove(G.label); G.label.material.map.dispose(); G.label.material.dispose(); }
    for (const e of G.rigs.values()) e.R.root.visible = false;      // rigs are kept (batched meshes are cheap to keep, costly to rebuild)
    spare.push(...[...G.rigs].map(([hi, e]) => ({ hi, e })));
    if (!quiet && G.name) SU.toast(`${G.name} a quitté la partie.`, 'info');
    refresh();
  }
  const spare = [];                    // rigs of friends who left, reused by the next one
  function adopt(G, hi) { const k = spare.findIndex(x => x.hi === hi); if (k >= 0) G.rigs.set(hi, spare.splice(k, 1)[0].e); }

  function receive(id, d) {
    if (!Array.isArray(d) || d.length < 14 || !d.every(Number.isFinite)) return;
    if (!(d[0] >= 0 && d[0] < SU.BREEDS.length && SU.horses[d[0]])) return;
    const G = ghosts.get(id) ?? makeGhost(id);
    // snapshots are placed on the sender's clock, shifted by the shortest delay seen so far: messages that arrive late or in a
    // bunch (a busy frame, a hiccup on the Wi-Fi) then still fall in the right place and the friend keeps moving evenly
    const now = nowS(), lag = now - d[13];
    if (G.off != null && Math.abs(lag - G.off) > 5) { G.off = null; G.buf.length = 0; }           // their page was reloaded: a new clock
    const last = G.buf[G.buf.length - 1]; if (last && d[13] <= last.d[13]) return;                 // arrived out of order: too old to be useful
    G.off = G.off == null || lag < G.off ? lag : G.off + 0.0003;
    G.seen = now; G.buf.push({ at: d[13] + G.off, d });
    if (G.buf.length > 30) G.buf.splice(0, G.buf.length - 30);
  }

  const cur = new Array(13);
  function updateGhost(G, dt, time) {
    const buf = G.buf, n = buf.length; if (!n) return;
    const t = nowS() - DELAY;
    // the two snapshots around "a moment ago": moving between them hides the network's unevenness
    let k = n - 1; while (k > 0 && buf[k - 1].at > t) k--;
    const b = buf[k], a = k > 0 ? buf[k - 1] : b, A = a.d, B = b.d;
    let u = b.at > a.at ? clamp((t - a.at) / (b.at - a.at), 0, 1) : 1;
    const jumped = Math.hypot(B[3] - A[3], B[4] - A[4]) > 12 || A[0] !== B[0];        // a reset, a new course, another horse: don't slide there
    if (jumped) u = 1;
    for (let i = 0; i < 13; i++) cur[i] = u >= 1 ? B[i] : (i === 5 || i === 11) ? angLerp(A[i], B[i], u) : (i >= 3 && i !== 7 && i !== 8) ? lerp(A[i], B[i], u) : A[i];
    const late = clamp(t - b.at, 0, 0.25);                                              // nothing newer yet: carry on a little way
    if (late > 0 && k === n - 1) { cur[3] += Math.sin(cur[5]) * cur[6] * late; cur[4] += Math.cos(cur[5]) * cur[6] * late; }

    if (G.hi !== cur[0] && !G.rigs.has(cur[0])) adopt(G, cur[0]);
    setHorse(G, cur[0]); setPerson(G, cur[1]);
    const R = G.R, s = G.s, P = G.P, want = MODES[cur[2]] ?? 'free';
    setMode(G, want);

    // the horse: put it where its rider says it is and let the ordinary rig animate the gait at that speed
    const yawRate = dt > 0 && !G.snap ? Math.atan2(Math.sin(cur[5] - s.yaw), Math.cos(cur[5] - s.yaw)) / dt : 0;
    if (G.snap || jumped) { s.rootY = SU.world.groundH(cur[3], cur[4]); s.jump = null; s.rear = null; s.prevX = cur[3]; s.prevZ = cur[4]; G.snap = false; }
    s.x = cur[3]; s.z = cur[4]; s.yaw = cur[5]; s.speed = cur[6];
    if (cur[7] > 0 && !G.lastJ && !s.jump) s.jump = { state: 'prep', t: 0, y: 0, vy: 0, T: 1, h: cur[7] };
    G.lastJ = cur[7];
    if (cur[8] && !G.lastRear && !s.rear) s.rear = { phase: 'up', t: 0 };
    G.lastRear = cur[8];
    const F = SU.camFocus(), dist = Math.hypot(F.x - s.x, F.z - s.z);
    const c = G.ctl; c.target = cur[6]; c.turnIn = clamp(yawRate / 1.2, -1, 1); c.rearHeld = !!cur[8]; c.vol = SU.pauseCount ? 0 : 0.6 * clamp(1 - dist / 28, 0, 1);
    // on foot, a friend's horse is the one standing in my own yard: don't draw it twice in the same place
    const mine = SU.horses[G.hi].s, free = want === 'free' || want === 'toTake';
    R.root.visible = G.shown = !(free && Math.hypot(mine.x - s.x, mine.z - s.z) < 2.5);
    if (G.shown) SU.updateRig(R, s, c, dt, time);

    if (P.mode === 'free') { P.x = cur[9]; P.z = cur[10]; P.yaw = cur[11]; SU.actions.placeFree(P); SU.poseStanding(P, cur[12], dt, null); }
    P.headG.getWorldPosition(_v); G.label.position.set(_v.x, _v.y + 0.42, _v.z);
    G.label.visible = dist < 60;
  }
  let updater = null;
  function tick(dt, time) {
    const t = nowS();
    for (const G of [...ghosts.values()]) {
      if (t - G.seen > STALE) { removeGhost(G.id); continue; }       // some browsers never say a friend has gone
      updateGhost(G, dt, time);
    }
  }

  // ------------------------------------------------------------------ the connection
  let Peer = null, peer = null, role = null, code = '', hostConn = null, sender = 0, status = 'off';   // off | opening | waiting | joining | on
  const guests = new Map();           // host only: peer id -> its open channels
  function sendTo(id, msg) { for (const c of guests.get(id) ?? []) if (c.open) { c.send(msg); return; } }
  const listeners = new Set();        // the open panel redraws when something changes
  // game messages: small objects another feature sends to everyone in the game (js/features/chrono.js). The host passes them on.
  const gameL = new Set();
  const myId = () => role === 'host' ? 'host' : role === 'guest' && hostConn ? peer?.id ?? 'me' : 'me';
  const gotGame = (id, m) => { for (const f of gameL) { try { f(id, m); } catch (e) { console.error('[SU] multi', e); } } };
  function sendGame(m) {
    if (role === 'host') { for (const id of guests.keys()) sendTo(id, { ...m, t: 'g', id: 'host' }); }
    else if (hostConn?.open) hostConn.send({ ...m, t: 'g' });
  }
  function loadLib() {
    if (Peer) return Promise.resolve();
    return new Promise((ok, fail) => {
      const s = document.createElement('script'); s.src = PEERJS; s.async = true;
      s.onload = () => { Peer = window.Peer; Peer ? ok() : fail(new Error('peerjs')); };
      s.onerror = () => { s.remove(); fail(new Error('offline')); };
      document.head.append(s);
    });
  }
  const dbg = [];                      // ?netlog in the URL keeps PeerJS's own log here (SU.features.multi._test.log)
  const popts = () => location.search.includes('netlog') ? { debug: 3, logFunction: (...a) => { const m = a.map(x => typeof x === 'string' ? x : x?.type ?? x?.message ?? String(x)).join(' '); if (!m.includes('onmessage')) dbg.push(`${Math.round(performance.now())} ${role} ${m.slice(0, 200)}`); } } : { debug: 0 };
  // a browser announces its local-network name the first time a page uses WebRTC, and a friend who looks it up too early never
  // finds it. Announcing it as soon as a game is created or joined gives the name time to settle before the real handshake.
  function prewarm() {
    try {
      const pc = new RTCPeerConnection(); pc.createDataChannel('w');
      pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => {});
      setTimeout(() => pc.close(), 4000);
    } catch { /* no WebRTC here: PeerJS will say so */ }
  }
  const newCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
  function refresh() {
    btn.textContent = status === 'on' || status === 'waiting' ? `À deux · ${code}${ghosts.size ? ` (${ghosts.size + 1})` : ''}` : 'À deux';
    btn.classList.toggle('on', status === 'on');
    for (const f of listeners) f();
  }
  function setStatus(s) { status = s; refresh(); }
  function startSending() {
    if (sender) return;
    sender = setInterval(() => {
      const d = snapshot(); if (!d) return;
      if (role === 'host') { for (const id of guests.keys()) sendTo(id, { t: 's', id: 'host', d }); }
      else if (hostConn?.open) hostConn.send({ t: 's', d });
    }, 1000 / SEND_HZ);
    updater ??= SU.onUpdate(tick);
  }
  function leave(msg) {
    clearInterval(sender); sender = 0;
    const old = peer;                  // forget everything first: closing fires the channels' own "lost" handlers
    peer = null; hostConn = null; guests.clear(); role = null; code = '';
    try { old?.destroy(); } catch { /* already gone */ }
    for (const id of [...ghosts.keys()]) removeGhost(id, true);
    setStatus('off');
    if (msg) SU.toast(msg, 'info');
  }
  const ERR = {
    offline: 'Pas de connexion à Internet : il en faut une petite pour se trouver.',
    notfound: 'Ce code n’existe pas. Vérifie les quatre lettres avec ton ami·e.',
    full: 'Cette partie est déjà complète.',
    lost: 'La connexion avec la partie est perdue.',
    other: 'Ça n’a pas marché. Réessaie dans un instant.',
  };

  async function host() {
    leave(); role = 'host'; setStatus('opening'); prewarm();
    try { await loadLib(); } catch { leave(); throw new Error(ERR.offline); }
    return new Promise((ok, fail) => {
      let tries = 0, opened = false;
      const open = () => {
        code = newCode();
        const p = peer = new Peer(PREFIX + code, popts());
        p.on('open', () => { opened = true; setStatus('waiting'); startSending(); ok(code); });
        p.on('connection', (c) => {
          // a guest may open more than one channel while it looks for the quickest way here: any of them counts
          c.on('open', () => {
            if (!guests.has(c.peer) && guests.size >= MAX_GUESTS) { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); return; }
            if (!guests.has(c.peer)) guests.set(c.peer, new Set());
            guests.get(c.peer).add(c); setStatus('on');
          });
          c.on('data', (m) => {
            if (!guests.get(c.peer)?.has(c) || !m) return;
            if (m.t === 'g') { for (const id of guests.keys()) if (id !== c.peer) sendTo(id, { ...m, id: c.peer }); gotGame(c.peer, m); return; }
            if (m.t !== 's') return;
            receive(c.peer, m.d);
            for (const id of guests.keys()) if (id !== c.peer) sendTo(id, { t: 's', id: c.peer, d: m.d });   // pass it on to the other guests
          });
          const gone = () => {
            const set = guests.get(c.peer); if (!set || !set.delete(c) || set.size) return;
            guests.delete(c.peer); removeGhost(c.peer);
            for (const id of guests.keys()) sendTo(id, { t: 'bye', id: c.peer });
            setStatus(guests.size ? 'on' : 'waiting');
          };
          c.on('close', gone); c.on('error', gone);
        });
        p.on('disconnected', () => { if (peer === p && !p.destroyed) setTimeout(() => { try { peer === p && p.reconnect(); } catch { /* retried on the next drop */ } }, 2000); });
        p.on('error', (e) => {
          if (peer !== p) return;
          if (e.type === 'unavailable-id' && !opened && ++tries < 5) { p.destroy(); open(); return; }     // someone else has this code: draw another
          if (opened) return;                                                                             // a later hiccup with the broker: friends already here stay connected
          leave(); fail(new Error(e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' ? ERR.offline : ERR.other));
        });
      };
      open();
    });
  }

  async function join(c4) {
    leave(); role = 'guest'; code = c4; setStatus('joining'); prewarm();
    try { await loadLib(); } catch { leave(); throw new Error(ERR.offline); }
    return new Promise((ok, fail) => {
      let done = false;
      const p = peer = new Peer(popts());
      // the first handshake between two browsers often stalls while a later one goes straight through, so a second and a third
      // are started alongside it; the first channel to open is the one we keep
      const tries = [], timers = [];
      const bad = (why) => { if (done) return; done = true; timers.forEach(clearTimeout); if (peer === p) leave(); fail(new Error(why)); };
      const attempt = () => {
        if (done || peer !== p) return;
        const c = p.connect(PREFIX + c4, { reliable: false, serialization: 'json' }); tries.push(c);
        c.on('open', () => {
          if (done) { if (hostConn !== c) c.close(); return; }
          done = true; timers.forEach(clearTimeout); hostConn = c;
          for (const o of tries) if (o !== c) { try { o.close(); } catch { /* never opened */ } }
          setStatus('on'); startSending(); ok();
        });
        c.on('data', (m) => {
          if (!m || hostConn !== c) return;
          if (m.t === 's' && typeof m.id === 'string') receive(m.id, m.d);
          else if (m.t === 'g' && typeof m.id === 'string') gotGame(m.id, m);
          else if (m.t === 'bye') removeGhost(m.id);
          else if (m.t === 'full') leave(ERR.full);
        });
        const gone = () => { if (hostConn === c && peer === p) leave(ERR.lost); };
        c.on('close', gone); c.on('error', gone);
      };
      p.on('open', () => { attempt(); timers.push(setTimeout(attempt, 3500), setTimeout(attempt, 8000), setTimeout(() => bad(ERR.notfound), 20000)); });
      p.on('error', (e) => { if (done) return; bad(e.type === 'peer-unavailable' ? ERR.notfound : e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' ? ERR.offline : ERR.other); });
    });
  }
  addEventListener('pagehide', () => { try { peer?.destroy(); } catch { /* closing anyway */ } });

  // ------------------------------------------------------------------ the panel
  const css = document.createElement('style');
  css.textContent = `
#env button.on { background: #243a2c; color: #f1ead8; border-color: #243a2c; }
.su-code { font-size: 54px; font-weight: 800; letter-spacing: .22em; text-align: center; margin: 6px 0 2px; padding-left: .22em; color: #243a2c; font-variant-numeric: tabular-nums; }
.su-codeIn { box-sizing: border-box; width: 100%; font: inherit; font-size: 40px; font-weight: 800; letter-spacing: .3em; text-align: center; text-transform: uppercase; color: #243a2c;
  background: #fff; border: 2px solid #e2d6bd; border-radius: 12px; padding: 10px 6px 10px calc(6px + .3em); margin: 8px 0 12px; }
.su-codeIn:focus { outline: none; border-color: #243a2c; }
.su-note { text-align: center; opacity: .78; margin: 6px 0 14px; } .su-err { color: #a2331f; font-weight: 600; text-align: center; margin: 0 0 10px; min-height: 1.4em; }`;
  document.head.append(css);

  function openPanel() {
    const { el } = SU.ui;
    const P = SU.ui.panel({ title: 'Jouer à deux', pause: false, onClose: () => listeners.delete(draw) });
    let view = 'auto', err = '';
    const btnEl = (label, primary, action) => { const b = el('button', 'su-btn' + (primary ? ' primary' : ''), `<span><b>${label}</b></span>`); b.addEventListener('click', action); return b; };
    function draw() {
      const B = P.body; B.textContent = '';
      const who = [...ghosts.values()].map(g => g.name).filter(Boolean);
      if (status === 'off' && view === 'join') {
        B.append(el('div', null, 'Tape le code de ton ami·e :'));
        const inp = el('input', 'su-codeIn'); inp.maxLength = 4; inp.autocapitalize = 'characters'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('aria-label', 'Code de la partie');
        const go = btnEl('Rejoindre', true, () => {
          const c4 = inp.value.toUpperCase().replace(/[^A-Z]/g, ''); if (c4.length !== 4) { err = 'Le code a quatre lettres.'; draw(); return; }
          err = ''; join(c4).then(() => { P.close(); }, (e) => { err = e.message; view = 'join'; draw(); });
        });
        inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go.click(); else if (e.key === 'Escape') P.close(); });
        B.append(inp, el('div', 'su-err', err), go, btnEl('Retour', false, () => { view = 'auto'; err = ''; draw(); }));
        B.lastChild.style.marginTop = '8px';
        setTimeout(() => inp.focus(), 0);
      } else if (status === 'off') {
        B.append(el('div', 'su-note', 'Deux ordinateurs, la même écurie : vous vous voyez monter, marcher et sauter.<br>Chacun garde ses chevaux, ses soins et ses exercices.'));
        if (err) B.append(el('div', 'su-err', err));
        const m = el('div', 'su-menu');
        m.append(btnEl('Créer une partie', true, () => { err = ''; host().catch((e) => { err = e.message; draw(); }); }),
          btnEl('Rejoindre une partie', false, () => { view = 'join'; err = ''; draw(); }));
        B.append(m);
      } else if (status === 'opening' || status === 'joining') {
        B.append(el('div', 'su-note', status === 'joining' ? `Je cherche la partie ${code}…` : 'Je prépare la partie…'));
      } else {
        if (role === 'host') B.append(el('div', 'su-note', 'Donne ce code à ton ami·e :'), el('div', 'su-code', code));
        B.append(el('div', 'su-note', who.length ? `Avec toi : <b>${who.join(', ')}</b>` : role === 'host' ? 'J’attends ton ami·e…<br>Tu peux fermer cette fenêtre et jouer en attendant.' : 'Tu es dans la partie.'));
        if (SU.features.chrono?.open) B.append(btnEl('⏱ Parcours chrono', true, () => { P.close(); SU.features.chrono.open(); }));
        B.append(btnEl('Quitter la partie', false, () => { leave(); view = 'auto'; }));
        B.lastChild.style.marginTop = '8px';
      }
    }
    listeners.add(draw); draw();
  }
  const btn = SU.ui.topButton('À deux', 'Jouer à deux sur le même réseau', openPanel);

  SU.features.multi = { host, join, leave, open: openPanel, get status() { return status; }, get code() { return code; }, get role() { return role; }, ghosts,
    send: sendGame, onGame: (f) => { gameL.add(f); }, get myId() { return myId(); }, ids: () => role === 'host' ? ['host', ...guests.keys()] : [myId()],
    _test: { snapshot, receive, tick, log: dbg } };
}
