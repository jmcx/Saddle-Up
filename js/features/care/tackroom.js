// care feature: ordered little activities (saddling, bridling, cleaning tack) and the tack-room chooser.
import { SADDLES, PADS, LEATHERS, NOSEBANDS, sizeOf } from './look.js';

const de = (n) => (/^[AEIOUYÉaeiouyé]/.test(n) ? `d’${n}` : `de ${n}`);   // French elision: d’Onyx, de Comet
const CSS = `
.cs-log { display: grid; gap: 6px; margin-bottom: 10px; font-size: 14px; }
.cs-log div { padding: 6px 10px; border-radius: 9px; background: #dff0d3; }
.cs-msg { padding: 8px 12px; border-radius: 10px; background: #f1e8d2; margin-bottom: 10px; font-size: 14.5px; min-height: 22px; }
.cs-msg.bad { background: #fde4d8; } .cs-msg.good { background: #dff0d3; }
.ct-sec { margin: 4px 0 12px; } .ct-sec h3 { margin: 0 0 6px; font-size: 15px; }
.ct-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
.ct-row .su-btn { min-height: 44px; padding: 8px 10px; font-size: 14px; }
.ct-row .su-btn.on { border-color: #243a2c; background: #e5efd9; box-shadow: inset 0 0 0 2px #243a2c; }
.ct-sw { display: inline-block; width: 18px; height: 18px; border-radius: 5px; border: 1px solid rgba(0,0,0,.3); flex: none; }
`;
const css = () => { if (document.getElementById('cs-css')) return; const s = document.createElement('style'); s.id = 'cs-css'; s.textContent = CSS; document.head.appendChild(s); };

// steps: [{ label, icon, why }] in the right order; wrong: [{ label, icon, why }] tempting mistakes that never advance.
// onStep(i) after each right step, onDone() at the end. Returns { panel, choose(label) } (choose is for tests).
export function sequence(SU, { title, intro, steps, wrong = [], doneMsg, onStep, onDone }) {
  css();
  const el = SU.ui.el, P = SU.ui.panel({ title, pause: false });
  const msg = el('div', 'cs-msg', intro ?? 'Dans quel ordre ? Choisis la première étape.'), log = el('div', 'cs-log'), box = el('div', 'su-menu');
  P.body.append(msg, log, box);
  let next = 0;
  const all = [...steps.map((s, i) => ({ ...s, i })), ...wrong.map(s => ({ ...s, i: -1 }))];
  for (let k = all.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [all[k], all[j]] = [all[j], all[k]]; }
  const btns = new Map();
  function choose(it) {
    if (it.i < 0) { msg.className = 'cs-msg bad'; msg.innerHTML = it.why; return false; }
    if (it.i !== next) { msg.className = 'cs-msg bad'; msg.innerHTML = `Pas encore ! D’abord : <b>${steps[next].label.toLowerCase()}</b>.`; return false; }
    next++; btns.get(it).remove();
    log.append(el('div', null, `✓ <b>${it.label}</b> · ${it.why}`));
    onStep && onStep(it.i);
    if (next === steps.length) {
      msg.className = 'cs-msg good'; msg.innerHTML = doneMsg;
      for (const [w, b] of btns) if (w.i < 0) b.remove();
      const b = el('button', 'su-btn primary', 'Terminer'); b.addEventListener('click', () => P.close()); box.append(b);
      onDone && onDone();
    } else { msg.className = 'cs-msg'; msg.innerHTML = 'Bien ! Et ensuite ?'; }
    return true;
  }
  for (const it of all) {
    const b = el('button', 'su-btn', `${it.icon ? `<span class="ic">${it.icon}</span>` : ''}<span><b>${it.label}</b></span>`);
    b.addEventListener('click', () => choose(it)); btns.set(it, b); box.append(b);
  }
  return { panel: P, choose: (label) => { const it = all.find(a => a.label === label); return it && btns.has(it) && btns.get(it).isConnected ? choose(it) : false; }, done: () => next === steps.length };
}

// the chooser: saddle (with the size rule), saddle pad colour, bridle leather and noseband. Applies to the 3D horse at once.
export function chooseTack(SU, h, S, apply) {
  css();
  const el = SU.ui.el, P = SU.ui.panel({ title: `Choisir la selle et le filet ${de(h.name)}`, wide: true, pause: false });
  const fit = sizeOf(h), what = fit === 'poney' ? 'un poney' : 'un cheval';
  const msg = el('div', 'cs-msg', `${h.name} est ${what}. La selle doit être à sa taille : ni trop grande, ni trop petite.`);
  P.body.append(msg);
  const secs = [
    { key: 'saddle', title: 'La selle', opts: SADDLES, sw: (o) => o.c },
    { key: 'pad', title: 'Le tapis de selle', opts: PADS, sw: (o) => o.c },
    { key: 'leather', title: 'Le filet (et les rênes)', opts: LEATHERS, sw: (o) => o.c },
    { key: 'noseband', title: 'La muserolle', opts: NOSEBANDS },
  ];
  const rows = {};
  function pick(key, id) {
    if (key === 'saddle') {
      const s = SADDLES[id];
      if (s.size !== fit) {
        msg.className = 'cs-msg bad';
        msg.innerHTML = s.size === 'cheval' ? `Trop grande pour ${h.name} ! Elle glisserait et le blesserait. Prends une selle poney.`
          : `Trop petite pour ${h.name} : elle lui pincerait le dos. Prends une selle mixte (pour cheval).`;
        return false;
      }
    }
    S.look[key] = id; apply();
    msg.className = 'cs-msg good';
    msg.innerHTML = key === 'saddle' ? `${SADDLES[id].name} : parfaite pour ${h.name} !` : key === 'noseband' ? `${NOSEBANDS[id].name} : ${NOSEBANDS[id].sub}.` : 'Très joli !';
    if (!S.saddled || !S.bridled) msg.innerHTML += ` Va le ${!S.saddled ? 'seller' : ''}${!S.saddled && !S.bridled ? ' et le ' : ''}${!S.bridled ? 'brider' : ''} (F à côté de lui).`;
    for (const [k2, b] of rows[key]) b.classList.toggle('on', k2 === id);
    return true;
  }
  for (const sec of secs) {
    const d = el('div', 'ct-sec'); d.append(el('h3', null, sec.title)); const row = el('div', 'ct-row'); d.append(row); P.body.append(d);
    rows[sec.key] = new Map();
    for (const [id, o] of Object.entries(sec.opts)) {
      const swc = sec.sw ? `<span class="ct-sw" style="background:#${sec.sw(o).toString(16).padStart(6, '0')}"></span>` : '';
      const b = el('button', 'su-btn' + (S.look[sec.key] === id ? ' on' : ''), `${swc}<span><b>${o.name}</b>${o.sub ? `<small>${o.sub}</small>` : ''}</span>`);
      b.addEventListener('click', () => pick(sec.key, id)); row.append(b); rows[sec.key].set(id, b);
    }
  }
  const ok = el('button', 'su-btn primary', 'C’est choisi !'); ok.addEventListener('click', () => P.close()); P.body.append(ok);
  return { panel: P, pick, message: () => msg.textContent };
}
