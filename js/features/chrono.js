// Parcours chrono: a timed round over the fences of an arena, alone or against the friends of a shared game (js/features/multi.js).
// Someone calls a round, the others say whether they ride it, everyone lines up before fence 1 and goes on the same "Partez !".
// Each computer times its own rider (jump the fences in order; every fault adds 4 seconds) and tells the others how far it is
// and its final time. Nothing else is shared: a rail your friend knocks down still stands on your screen.
const PENALTY = 4, ANSWER_S = 15, COUNT_S = 3.4, LANE = 1.4;
const COURSES = { main: { idx: 0, name: 'Grande carrière', sub: '10 obstacles · pour les chevaux', icon: '🐴' }, pony: { idx: 1, name: 'Carrière des poneys', sub: '8 petits obstacles · pour les poneys', icon: '🐎' } };

export function init(SU) {
  const multi = SU.features.multi && SU.features.multi !== true ? SU.features.multi : null;
  const { el } = SU.ui;
  const me = () => multi?.myId ?? 'me';
  const boss = () => !(multi && multi.role === 'guest' && multi.status === 'on');     // the host (or a lone rider) decides when a round starts
  const everyone = () => multi && multi.role === 'host' ? multi.ids() : [me()];
  const names = new Map();             // a friend who has left keeps their name on the board
  const nameOf = (id) => {
    if (id === me() || id === race?.me) return SU.player?.look?.name ?? 'Toi';
    const n = multi?.ghosts.get(id)?.name; if (n) names.set(id, n);
    return names.get(id) ?? 'Ami·e';
  };
  const secs = (t) => t.toFixed(1).replace('.', ',') + ' s';
  const fautes = (n) => n ? `${n} faute${n > 1 ? 's' : ''}` : 'sans faute';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let lobby = null;    // { c, by, in: Set, no: Set, t }
  let race = null;     // { c, me, fences, order, riders: Map(id -> { n, time, faults, out }), phase: 'count' | 'run' | 'wait' | 'seen', t, T, k, side, f0, hold, over }
  let mine = false;    // true while this module resets the course itself

  function beep(freq, dur) {
    const A = SU.audio; if (!A.audioOk()) return;
    const t = A.ctx.currentTime + 0.01, o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq; A.env(g, t, 0.22, 0.01, dur); o.connect(g).connect(A.out); o.start(t); o.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------------ messages: the same handler for mine and for my friends'
  const say = (m) => { const id = me(); multi?.send(m); got(id, m); };
  function got(id, m) {
    if (!m || typeof m.k !== 'string' || typeof id !== 'string') return;
    if (m.k === 'call') {
      if (lobby || (race && !race.over && race.riders.has(race.me) && !race.riders.get(race.me).out && race.riders.get(race.me).time == null) || !COURSES[m.c]) return;
      lobby = { c: m.c, by: id, in: new Set([id]), no: new Set(), t: ANSWER_S };
      if (id !== me()) beep(660, 0.25);
    } else if (m.k === 'in' || m.k === 'no') {
      if (!lobby) return;
      lobby.in.delete(id); lobby.no.delete(id); lobby[m.k].add(id);
    } else if (m.k === 'go') {
      if (!(id === 'host' || (id === me() && boss())) || !COURSES[m.c] || !Array.isArray(m.order) || m.order.length > 4 || !m.order.every(x => typeof x === 'string')) return;
      lobby = null;
      if (m.order.includes(me())) begin(m.c, m.order);
      else { if (race?.over) race = null; if (multi?.status === 'on') SU.toast('Le parcours commence sans toi.', 'info'); }
    } else if (race && race.riders.has(id)) {
      const r = race.riders.get(id), was = r.out;
      if (m.k === 'p' && Number.isInteger(m.n) && m.n >= 0 && m.n <= race.fences.length) r.n = Math.max(r.n, m.n);
      else if (m.k === 'done' && Number.isFinite(m.time) && m.time > 0 && m.time < 3600 && Number.isInteger(m.faults) && m.faults >= 0 && m.faults < 100) { r.time = m.time; r.faults = m.faults; r.n = race.fences.length; }
      else if (m.k === 'out' && r.time == null) r.out = true;
      // a friend who went quiet for a while (and was counted out) is back in as soon as they are heard again
      if (m.k !== 'out' && was && id !== race.me) { r.out = false; if (r.time == null) race.over = false; }
    }
    draw();
  }
  multi?.onGame(got);

  function call(c) { if (!lobby) say({ k: 'call', c }); }

  function begin(c, order) {
    mine = true; try { SU.actions.setCourse(COURSES[c].idx); } finally { mine = false; }
    const fences = SU.world.fences.filter(f => f.course === c), f0 = fences[0], s = SU.st, id = me();
    const off = (order.indexOf(id) - (order.length - 1) / 2) * LANE;                   // side by side before the first fence
    s.x += f0.ax.x * off; s.z += f0.ax.z * off; s.prevX = s.x; s.prevZ = s.z; s.rootY = SU.world.groundH(s.x, s.z);
    race = { c, me: id, fences, order, riders: new Map(order.map(o => [o, { n: 0, time: null, faults: 0, out: false }])),
      phase: 'count', t: COUNT_S, T: 0, k: 0, side: 0, f0: 0, hold: { x: s.x, z: s.z, yaw: s.yaw }, over: false, shown: 4 };
  }

  SU.on('reset', () => {                 // R, or another course picked, in the middle of a round: that rider is out
    if (mine || !race || race.over) return;
    const r = race.riders.get(race.me);
    if (r.time == null && !r.out) { say({ k: 'out' }); SU.toast('Parcours abandonné.', 'info'); }
  });

  // ------------------------------------------------------------------ every frame
  function tick(dt) {
    if (lobby) {
      lobby.t -= dt;
      if (boss()) {
        const all = everyone();
        if (lobby.t <= 0 || all.every(id => lobby.in.has(id) || lobby.no.has(id))) {
          const order = all.filter(id => lobby.in.has(id)).slice(0, 4), c = lobby.c;
          lobby = null;
          if (order.length) say({ k: 'go', c, order }); else draw();
        }
      } else if (lobby.t < -4) { lobby = null; SU.toast('Le parcours n’a pas pu démarrer. Réessaie.', 'info'); draw(); }
      if (lobby) { const n = Math.max(0, Math.ceil(lobby.t)); if (n !== lobby.shown) { lobby.shown = n; draw(); } }
    }
    const R = race; if (!R) return;
    const my = R.riders.get(R.me), s = SU.st;
    if (multi) for (const [id, r] of R.riders) if (id !== R.me && r.time == null && !r.out && !multi.ghosts.has(id) && R.T > 1) { r.out = true; draw(); }

    if (R.phase === 'count') {
      R.t -= dt;
      if (!my.out) { s.x = R.hold.x; s.z = R.hold.z; s.yaw = R.hold.yaw; s.speed = 0; if (SU.gait) SU.actions.setGait(0); }
      const n = Math.ceil(R.t - 0.4);                                                  // 3, 2, 1, then "Partez !" at 0
      if (n !== R.shown) { R.shown = n; big(n > 0 ? String(n) : 'Partez !', n <= 0); beep(n > 0 ? 520 : 880, n > 0 ? 0.12 : 0.45); }
      if (R.t <= 0.4) { R.phase = 'run'; R.T = 0; R.f0 = SU.score.faults; R.side = 0; draw(); }
    } else if ((R.phase === 'run' || R.phase === 'wait') && !my.out) {
      R.T += dt;
      my.faults = SU.score.faults - R.f0;
      if (R.phase === 'run') {
        const f = R.fences[R.k], dx = s.x - f.x, dz = s.z - f.z, lx = dx * f.ax.x + dz * f.ax.z, lz = dx * f.az.x + dz * f.az.z;
        const side = Math.abs(lx) > 6 || Math.abs(lz) > 6 ? 0 : lz >= 0 ? 1 : -1;
        if (R.side === -1 && side === 1 && Math.abs(lx) < f.L + 0.3) {                 // through this fence, the right way round
          R.k++; R.side = 0; say({ k: 'p', n: R.k });
          if (R.k === R.fences.length) { R.phase = 'wait'; R.end = R.T; R.w = 0.8; }   // the hindquarters may still take the last rail
        } else R.side = side;
      } else if ((R.w -= dt) <= 0) {
        const total = Math.round((R.end + PENALTY * my.faults) * 10) / 10;
        R.phase = 'seen';
        const best = SU.store.get('chrono.' + R.c, null), record = best == null || total < best;
        if (record) SU.store.set('chrono.' + R.c, total);
        R.record = record;
        say({ k: 'done', time: total, faults: my.faults });
        SU.toast(`Arrivée ! ${secs(total)}${record && best != null ? ' · nouveau record !' : ''}`, 'good'); beep(990, 0.5);
      }
      clockEl && (clockEl.textContent = clockText());
    } else if (R.phase !== 'seen' && my.out) R.T += dt;

    if (!R.over && R.phase !== 'count' && [...R.riders.values()].every(r => r.out || r.time != null)) {
      R.over = true;
      const w = winner();
      if (R.order.length > 1 && w) SU.toast(w === R.me ? '🏆 Tu gagnes le parcours !' : `🏆 ${nameOf(w)} gagne le parcours !`, 'good');
      draw();
    }
  }
  SU.onUpdate(tick);
  const winner = () => { let w = null; for (const [id, r] of race.riders) if (r.time != null && (w == null || r.time < race.riders.get(w).time)) w = id; return w; };
  const clockText = () => { const R = race, my = R.riders.get(R.me); return `${secs(R.phase === 'run' ? R.T : R.end ?? R.T)} · obstacle ${Math.min(R.k + 1, R.fences.length)}/${R.fences.length}${my.faults ? ` · ${fautes(my.faults)}` : ''}`; };

  // ------------------------------------------------------------------ what you see: a small board under the banner, and the big count
  const css = document.createElement('style');
  css.textContent = `
#su-chrono { position: fixed; top: 146px; left: 50%; transform: translateX(-50%); z-index: 6; display: none; box-sizing: border-box; width: max-content; min-width: 250px; max-width: calc(100vw - 24px);
  color: #fff; background: rgba(20,22,18,0.66); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.22); border-radius: 14px; padding: 10px 14px; font-size: 14.5px; line-height: 1.45; text-align: center; }
#su-chrono.show { display: block; }
#su-chrono .clk { font-size: 19px; font-weight: 700; font-variant-numeric: tabular-nums; }
#su-chrono table { border-collapse: collapse; margin: 6px auto 0; } #su-chrono td { padding: 1px 8px; text-align: left; font-variant-numeric: tabular-nums; } #su-chrono td:last-child { text-align: right; opacity: .92; }
#su-chrono tr.me td { font-weight: 700; } #su-chrono tr.out td { opacity: .55; }
#su-chrono .row { display: flex; gap: 8px; justify-content: center; margin-top: 9px; }
#su-chrono button { font: inherit; font-size: 14px; font-weight: 650; cursor: pointer; color: #2a1d12; background: #f1e3c8; border: 1px solid #f1e3c8; border-radius: 10px; padding: 8px 14px; min-height: 40px; }
#su-chrono button.alt { color: #fff; background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.3); }
#su-chrono button:hover { filter: brightness(1.08); }
#su-chronoBig { position: fixed; left: 50%; top: 38%; transform: translate(-50%, -50%); z-index: 6; pointer-events: none; font-size: min(26vw, 190px); font-weight: 800; color: #fff; text-shadow: 0 6px 30px rgba(0,0,0,0.55); opacity: 0; }
#su-chronoBig.go { font-size: min(15vw, 120px); color: #c9f0a8; }
#su-chronoBig.pop { animation: su-chronoPop .9s ease-out; }
@keyframes su-chronoPop { 0% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); } 15% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 70% { opacity: 1; } 100% { opacity: 0; } }
@media (max-width: 700px) { #su-chrono { top: 150px; font-size: 13.5px; } }`;
  document.head.append(css);
  const box = el('div'); box.id = 'su-chrono'; box.setAttribute('role', 'status');
  const bigEl = el('div'); bigEl.id = 'su-chronoBig';
  document.body.append(box, bigEl);
  let clockEl = null;
  function big(text, go) { bigEl.textContent = text; bigEl.className = go ? 'go' : ''; void bigEl.offsetWidth; bigEl.classList.add('pop'); }
  const button = (label, alt, action) => { const b = el('button', alt ? 'alt' : null, label); b.addEventListener('click', () => { b.blur(); action(); }); return b; };

  function draw() {
    box.textContent = ''; clockEl = null;
    if (lobby) {
      const C = COURSES[lobby.c], id = me(), answered = lobby.in.has(id) || lobby.no.has(id), n = Math.max(0, Math.ceil(lobby.t));
      if (lobby.no.has(id)) { box.classList.remove('show'); return; }
      box.append(el('div', null, lobby.by === id ? `⏱ <b>Parcours chrono</b> · ${C.name}` : `⏱ <b>${esc(nameOf(lobby.by))}</b> lance un parcours chrono · ${C.name}`));
      if (answered) box.append(el('div', null, `J’attends les autres… ${n} s`));
      else {
        const row = el('div', 'row');
        row.append(button('Je participe', false, () => say({ k: 'in' })), button('Non merci', true, () => say({ k: 'no' })));
        box.append(el('div', null, `Départ dans ${n} s`), row);
      }
    } else if (race) {
      const R = race, C = COURSES[R.c], my = R.riders.get(R.me);
      if (R.over || my.out || my.time != null) box.append(el('div', null, `⏱ <b>Parcours chrono</b> · ${C.name}`));
      else { clockEl = el('div', 'clk', R.phase === 'count' ? 'Prêt·e ?' : clockText()); box.append(clockEl); }
      const rows = [...R.riders].sort((a, b) => (a[1].time ?? 1e6 + (a[1].out ? 1e3 : 0) - a[1].n) - (b[1].time ?? 1e6 + (b[1].out ? 1e3 : 0) - b[1].n));
      if (R.order.length > 1 || my.time != null || my.out) {
        const t = el('table');
        rows.forEach(([id, r], i) => {
          const tr = el('tr', (id === R.me ? 'me ' : '') + (r.out ? 'out' : ''));
          tr.append(el('td', null, r.time != null ? `${i + 1}.` : ''), el('td', null, esc(nameOf(id))),
            el('td', null, r.time != null ? `${secs(r.time)} <small>(${fautes(r.faults)})</small>` : r.out ? 'abandon' : `obstacle ${Math.min(r.n + 1, R.fences.length)}/${R.fences.length}`));
          t.append(tr);
        });
        box.append(t);
      }
      if (my.time != null) { const best = SU.store.get('chrono.' + R.c, null); box.append(el('div', null, R.record ? '⭐ Ton nouveau record !' : best != null ? `Ton record : ${secs(best)}` : '')); }
      const row = el('div', 'row');
      if (R.over) row.append(button('Rejouer', false, () => { const c = R.c; race = null; call(c); }), button('Fermer', true, () => { race = null; draw(); }));
      else if (my.time == null && !my.out && R.phase !== 'count') row.append(button('Abandonner', true, () => { say({ k: 'out' }); }));
      if (row.childNodes.length) box.append(row);
    }
    box.classList.toggle('show', !!(lobby || race));
  }

  // ------------------------------------------------------------------ choosing a round
  function open() {
    if (lobby) return;
    const with_ = multi?.status === 'on' && multi.ghosts.size;
    SU.ui.menu('Parcours chrono', Object.entries(COURSES).map(([c, C]) => {
      const best = SU.store.get('chrono.' + c, null);
      return { label: C.name, sub: C.sub + (best != null ? ` · ton record : ${secs(best)}` : ''), icon: C.icon, action: () => call(c) };
    }), { intro: `Saute tous les obstacles dans l’ordre, le plus vite possible.<br>Chaque faute ajoute ${PENALTY} secondes.${with_ ? '<br>Tes ami·es reçoivent une invitation.' : ''}` });
  }
  SU.ui.topButton('⏱ Chrono', 'Parcours chrono : saute tous les obstacles le plus vite possible', open);

  SU.features.chrono = { open, call, get lobby() { return lobby; }, get race() { return race; }, _test: { got, tick } };
}
