// care feature, grooming (le pansage): pick a tool, then brush the zones of a horse drawn side-on.
// Strokes (or taps) over a zone make progress; using a tool in the wrong place or order is explained, never punished.
const CSS = `
.cg-wrap { display: grid; gap: 10px; }
.cg-tools { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.cg-tools .su-btn { flex-direction: column; gap: 2px; text-align: center; padding: 8px 4px; min-height: 64px; font-size: 13px; }
.cg-tools .su-btn .ic { width: auto; }
.cg-tools .su-btn.on { border-color: #243a2c; background: #e5efd9; box-shadow: inset 0 0 0 2px #243a2c; }
.cg-svg { width: 100%; height: auto; touch-action: none; user-select: none; -webkit-user-select: none; background: linear-gradient(#eef3e6, #e4dcc6); border-radius: 12px; cursor: crosshair; max-height: 46vh; max-height: 46dvh; }
.cg-svg .z { cursor: pointer; }
.cg-svg .z:hover .base { filter: brightness(1.08); }
.cg-msg { min-height: 44px; padding: 8px 12px; border-radius: 10px; background: #f1e8d2; font-size: 14.5px; }
.cg-msg.bad { background: #fde4d8; } .cg-msg.good { background: #dff0d3; }
.cg-steps { display: flex; flex-wrap: wrap; gap: 6px; font-size: 12.5px; }
.cg-steps span { padding: 3px 8px; border-radius: 99px; background: #ece3cd; } .cg-steps span.ok { background: #cfe8c0; }
@keyframes cgPuff { from { opacity: .9; transform: scale(.4); } to { opacity: 0; transform: scale(1.6) translateY(-10px); } }
.cg-puff { animation: cgPuff .7s ease-out forwards; transform-box: fill-box; transform-origin: center; pointer-events: none; }
@keyframes cgHeart { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-36px); } }
.cg-heart { animation: cgHeart 1.2s ease-out forwards; pointer-events: none; }
`;
export const TOOLS = {
  etrille: { name: 'Étrille', icon: '🌀', tip: 'L’étrille : en petits cercles, seulement sur les parties charnues (encolure, épaule, dos, croupe). Elle décolle la boue.' },
  bouchon: { name: 'Bouchon', icon: '🧹', tip: 'Le bouchon : des petits coups de poignet, dans le sens du poil. Il chasse la poussière que l’étrille a fait remonter.' },
  brosse: { name: 'Brosse douce', icon: '🪮', tip: 'La brosse douce : pour la tête et les jambes, et pour finir le corps. Tout doucement, dans le sens du poil.' },
  cure: { name: 'Cure-pieds', icon: '🪝', tip: 'Le cure-pieds : du talon vers la pince (le bout du pied), sans appuyer sur la fourchette (le triangle tendre au milieu).' },
};
// side view, head to the right. kind: body (étrille → bouchon → brosse), head / legs (brosse, or bouchon for legs), hoof (cure-pieds)
const ell = (cx, cy, rx, ry) => `M${cx - rx},${cy} a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;
const ZONES = [
  { id: 'croupe', name: 'la croupe', kind: 'body', d: ell(112, 108, 50, 44) },
  { id: 'dos', name: 'le dos', kind: 'body', d: 'M140,72 Q190,60 238,74 L240,150 Q190,160 140,150 Z' },
  { id: 'epaule', name: 'l’épaule', kind: 'body', d: ell(256, 112, 34, 44) },
  { id: 'encolure', name: 'l’encolure', kind: 'body', d: 'M246,86 Q262,44 300,26 L328,46 Q300,80 290,122 L262,132 Z' },
  { id: 'tete', name: 'la tête', kind: 'head', d: 'M300,24 Q322,14 340,26 L384,70 Q388,84 374,90 L352,86 Q336,74 326,54 Z' },
  { id: 'avant', name: 'les jambes de devant', kind: 'legs', d: 'M240,146 L256,146 L256,214 L242,214 Z M266,146 L282,146 L280,214 L266,214 Z' },
  { id: 'arriere', name: 'les jambes de derrière', kind: 'legs', d: 'M80,132 L100,136 L98,214 L84,214 Z M108,140 L126,140 L122,214 L108,214 Z' },
  { id: 'pAG', name: 'le pied avant gauche', kind: 'hoof', d: 'M239,214 L259,214 L261,230 L237,230 Z' },
  { id: 'pAD', name: 'le pied avant droit', kind: 'hoof', d: 'M263,214 L283,214 L285,230 L261,230 Z' },
  { id: 'pPG', name: 'le pied arrière gauche', kind: 'hoof', d: 'M81,214 L101,214 L103,230 L79,230 Z' },
  { id: 'pPD', name: 'le pied arrière droit', kind: 'hoof', d: 'M105,214 L125,214 L127,230 L103,230 Z' },
];
const NEED = 120;          // stroke length (svg units) to finish one step on a zone; a tap counts 45

const de = (n) => (/^[AEIOUYÉaeiouyé]/.test(n) ? `d’${n}` : `de ${n}`);   // French elision: d’Onyx, de Comet
export function openGroom(SU, h, S, fx, onDone) {
  if (!document.getElementById('cg-css')) { const st = document.createElement('style'); st.id = 'cg-css'; st.textContent = CSS; document.head.appendChild(st); }
  const el = SU.ui.el;
  // per-zone progress. body: stage 0 dirty, 1 étrillé, 2 bouchonné, 3 fini à la brosse. head/legs: 0 → 1. hoof: 0 → 1
  const Z = ZONES.map(z => ({ ...z, stage: 0, prog: 0 }));
  const max = (z) => (z.kind === 'body' ? 3 : 1);
  let tool = null, lastMsgT = 0, lastSnd = 0, lastHeart = 0, hoofTip = false, done = false;
  const coat = '#' + new SU.THREE.Color(h.B.coat).getHexString(), hair = '#' + new SU.THREE.Color(h.B.hair).getHexString();
  const P = SU.ui.panel({ title: `Le pansage ${de(h.name)}`, wide: true, closeLabel: 'Terminer', onClose: () => finish() });
  const wrap = el('div', 'cg-wrap'); P.body.append(wrap);
  const tools = el('div', 'cg-tools');
  const tb = {};
  for (const [k, t] of Object.entries(TOOLS)) {
    const b = el('button', 'su-btn', `<span class="ic">${t.icon}</span><b>${t.name}</b>`);
    b.addEventListener('click', () => pick(k)); tools.append(b); tb[k] = b;
  }
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '30 0 380 245'); svg.setAttribute('class', 'cg-svg');
  svg.innerHTML = `<defs><pattern id="cgMud" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#7a5f3e"/><circle cx="3" cy="3" r="2.2" fill="#5e4528"/><circle cx="7" cy="7" r="1.6" fill="#9a7b52"/></pattern>
    <pattern id="cgDust" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#d9c9a6"/><circle cx="2" cy="2" r="1.4" fill="#f2e7cc"/></pattern></defs>
    <path d="M66,86 Q40,120 52,176 Q60,186 66,176 Q62,130 78,96 Z" fill="${hair}"/>
`;
  const shapes = {};
  for (const z of Z) {
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'z'); g.dataset.z = z.id;
    const base = document.createElementNS(NS, 'path'); base.setAttribute('d', z.d); base.setAttribute('class', 'base');
    base.setAttribute('fill', z.kind === 'hoof' ? '#3b322b' : coat); base.setAttribute('stroke', '#3a2b1e'); base.setAttribute('stroke-width', '1.2');
    const over = document.createElementNS(NS, 'path'); over.setAttribute('d', z.d); over.setAttribute('pointer-events', 'none');
    g.append(base, over); svg.append(g); shapes[z.id] = { g, over };
  }
  // eye, ear and a nostril over the head; the eye closes a little when the horse enjoys it
  svg.insertAdjacentHTML('beforeend', `<path d="M302,24 Q268,40 250,86 L258,92 Q276,54 310,30 Z" fill="${hair}" pointer-events="none"/><path d="M318,24 L322,4 L332,22 Z" fill="${coat}" stroke="#3a2b1e" pointer-events="none" id="cgEar"/>
    <ellipse id="cgEye" cx="342" cy="44" rx="4.5" ry="4" fill="#1b1410" pointer-events="none"/><circle cx="378" cy="80" r="2.6" fill="#1b1410" pointer-events="none"/>`);
  const eye = svg.querySelector('#cgEye');
  const msg = el('div', 'cg-msg', 'Choisis un outil, puis frotte (ou tape) sur le cheval. Tu es à côté de lui, jamais derrière !');
  const steps = el('div', 'cg-steps');
  wrap.append(tools, msg, svg, steps);
  if (S.saddled) say('Astuce : on fait le pansage avant de seller. Ici, on brosse autour de la selle.');

  function say(text, kind = '') { msg.className = 'cg-msg ' + kind; msg.innerHTML = text; }
  function warn(text) { const now = performance.now(); if (text === msg.innerHTML && now - lastMsgT < 1400) return; lastMsgT = now; say(text, 'bad'); }
  function refresh() {
    for (const z of Z) {
      const o = shapes[z.id].over, k = z.prog / NEED, dirt = Math.max(0.25, S.dirt);
      if (z.kind === 'hoof') { o.setAttribute('fill', z.stage ? '#8a8178' : 'url(#cgMud)'); o.setAttribute('opacity', z.stage ? 0.35 : 0.85 * (1 - k * 0.6)); continue; }
      if (z.kind === 'body') {
        if (z.stage === 0) { o.setAttribute('fill', 'url(#cgMud)'); o.setAttribute('opacity', dirt * (1 - 0.5 * k)); }
        else if (z.stage === 1) { o.setAttribute('fill', 'url(#cgDust)'); o.setAttribute('opacity', 0.6 * (1 - k)); }
        else if (z.stage === 2) { o.setAttribute('fill', '#ffffff'); o.setAttribute('opacity', 0.12 * k); }
        else { o.setAttribute('fill', '#ffffff'); o.setAttribute('opacity', 0.16); }
      } else { o.setAttribute('fill', z.stage ? '#ffffff' : 'url(#cgDust)'); o.setAttribute('opacity', z.stage ? 0.14 : 0.5 * (1 - k)); }
    }
    const body = Z.filter(z => z.kind === 'body'), hoofs = Z.filter(z => z.kind === 'hoof');
    const chip = (ok, t) => `<span class="${ok ? 'ok' : ''}">${ok ? '✓ ' : ''}${t}</span>`;
    steps.innerHTML = chip(body.every(z => z.stage >= 1), 'Étrille') + chip(body.every(z => z.stage >= 2), 'Bouchon')
      + chip(body.every(z => z.stage >= 3) && Z.filter(z => z.kind !== 'body' && z.kind !== 'hoof').every(z => z.stage), 'Brosse douce')
      + chip(hoofs.every(z => z.stage), 'Pieds curés');
  }
  function pick(k) {
    tool = k; for (const [kk, b] of Object.entries(tb)) b.classList.toggle('on', kk === k);
    const body = Z.filter(z => z.kind === 'body');
    if (k === 'bouchon' && body.every(z => z.stage === 0)) say('Commence par l’étrille : elle décolle la boue. Le bouchon vient juste après.', 'bad');
    else if (k === 'brosse' && body.some(z => z.stage === 1) && body.every(z => z.stage < 2)) say('D’abord le bouchon, pour enlever la poussière. La brosse douce, c’est pour finir (et pour la tête et les jambes).', 'bad');
    else say(TOOLS[k].tip);
  }
  // what this tool does on this zone: null = it works here, or a short explanation of why not (yet)
  function rule(z) {
    if (!tool) return 'Choisis d’abord un outil, en haut.';
    if (z.kind === 'hoof') return tool === 'cure' ? null : 'Pour les pieds, il faut le cure-pieds.';
    if (tool === 'cure') return 'Le cure-pieds, c’est seulement pour les pieds !';
    if (z.kind === 'head') {
      if (tool === 'etrille') return 'Pas l’étrille sur la tête ! Elle est dure, ça lui ferait mal. Prends la brosse douce.';
      if (tool === 'bouchon') return 'Pour la tête, la brosse douce : c’est plus doux près des yeux.';
      return null;
    }
    if (z.kind === 'legs') return tool === 'etrille' ? 'Pas l’étrille sur les jambes : les os et les tendons sont juste sous la peau. Prends la brosse douce.' : null;
    // body
    if (tool === 'etrille') return z.stage >= 1 ? `C’est déjà étrillé ici. Maintenant, le bouchon !` : null;
    if (tool === 'bouchon') return z.stage === 0 ? 'Commence par l’étrille : elle décolle la boue.' : z.stage >= 2 ? 'Le bouchon est déjà passé ici. Finis à la brosse douce !' : null;
    return z.stage === 0 ? 'Commence par l’étrille : elle décolle la boue.' : z.stage === 1 ? 'D’abord le bouchon : il chasse la poussière que l’étrille a fait remonter.' : z.stage >= 3 ? 'Ici, c’est tout beau !' : null;
  }
  const pt = svg.createSVGPoint();
  const toSvg = (e) => { pt.x = e.clientX; pt.y = e.clientY; const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 }; };
  function zoneAt(e) { const t = document.elementFromPoint(e.clientX, e.clientY); const g = t && t.closest && t.closest('.z'); return g ? Z.find(z => z.id === g.dataset.z) : null; }
  function puff(p, color) {
    const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', p.x + (Math.random() - 0.5) * 10); c.setAttribute('cy', p.y + (Math.random() - 0.5) * 10);
    c.setAttribute('r', 5 + Math.random() * 6); c.setAttribute('fill', color); c.setAttribute('class', 'cg-puff'); svg.append(c); setTimeout(() => c.remove(), 750);
  }
  function heart() {
    const now = performance.now(); if (now - lastHeart < 1600) return; lastHeart = now;
    const t = document.createElementNS(NS, 'text'); t.setAttribute('x', 330 + Math.random() * 20); t.setAttribute('y', 22); t.setAttribute('font-size', '18'); t.setAttribute('class', 'cg-heart'); t.textContent = '❤';
    t.setAttribute('fill', '#ff5c8a'); svg.append(t); setTimeout(() => t.remove(), 1250);
    eye.setAttribute('ry', '1.4'); setTimeout(() => eye.setAttribute('ry', '4'), 900);
  }
  // apply some rubbing (amount in svg units) of the current tool to zone z
  function work(z, amount, p) {
    if (done && !z) return;
    const why = rule(z); if (why) { warn(why); return; }
    if (z.stage >= max(z)) return;
    z.prog += amount;
    const now = performance.now();
    if (now - lastSnd > 110) { lastSnd = now; fx.brush(tool); }
    puff(p, tool === 'etrille' ? '#7a5f3e' : tool === 'bouchon' ? '#e8dcc0' : tool === 'cure' ? '#4a3a2a' : '#fff6d8');
    if (tool === 'cure' && !hoofTip) { hoofTip = true; say('Tu lèves le pied en restant à côté de l’épaule (ou de la hanche), jamais derrière. Puis du talon vers la pince, sans toucher la fourchette.'); }
    if (z.prog >= NEED) {
      z.prog = 0; z.stage++;
      const what = z.kind === 'hoof' ? `${z.name[0].toUpperCase() + z.name.slice(1)} est curé.` : `${z.name[0].toUpperCase() + z.name.slice(1)} : c’est fait !`;
      say(what, 'good'); if (z.kind !== 'hoof') heart();
      check();
    } else if (Math.random() < 0.05 && tool !== 'etrille') heart();
    refresh();
  }
  function check() {
    if (done || !Z.every(z => z.stage >= max(z))) return;
    done = true;
    say(`Bravo ! ${h.name} est tout propre et il brille. Il adore ça !`, 'good');
    const b = el('button', 'su-btn primary', 'Terminer'); b.addEventListener('click', () => P.close()); wrap.append(b);
  }
  let down = false, last = null;
  svg.addEventListener('pointerdown', (e) => { down = true; last = toSvg(e); const z = zoneAt(e); if (z) work(z, 45, last); });
  svg.addEventListener('pointermove', (e) => {
    if (!down) return; const p = toSvg(e), d = last ? Math.hypot(p.x - last.x, p.y - last.y) : 0; last = p;
    if (d < 2) return; const z = zoneAt(e); if (z) work(z, Math.min(d, 30), p);
  });
  const up = () => { down = false; last = null; };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointerleave', up); svg.addEventListener('pointercancel', up);
  refresh();

  function finish() {
    const nonHoof = Z.filter(z => z.kind !== 'hoof');
    const frac = nonHoof.reduce((a, z) => a + z.stage / max(z), 0) / nonHoof.length;
    const feet = Z.filter(z => z.kind === 'hoof').every(z => z.stage);
    onDone({ frac, feet, complete: done, worked: Z.some(z => z.stage > 0) });
  }
  // for tests: groom everything correctly without pointer strokes
  return {
    panel: P, zones: Z, pick, close: () => P.close(),
    rub(id, times = 3) { const z = Z.find(q => q.id === id); for (let i = 0; i < times; i++) work(z, 45, { x: 200, y: 100 }); return { stage: z.stage, msg: msg.textContent }; },
    message: () => msg.textContent,
  };
}
