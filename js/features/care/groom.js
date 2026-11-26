// care feature, grooming (le pansage): a picture of the real horse, rendered side-on when the panel opens, with the
// grooming zones laid over it. Pick a tool, then brush (strokes or taps) over a zone; the dirt patches fade as you work.
// Using a tool in the wrong place or order is explained, never punished.
import { renderHorsePicture } from './picture.js';

const CSS = `
.cg-wrap { display: grid; gap: 10px; }
.cg-tools { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.cg-tools .su-btn { flex-direction: column; gap: 2px; text-align: center; padding: 8px 4px; min-height: 64px; font-size: 13px; }
.cg-tools .su-btn .ic { width: auto; }
.cg-tools .su-btn.on { border-color: #243a2c; background: #e5efd9; box-shadow: inset 0 0 0 2px #243a2c; }
.cg-svg { display: block; aspect-ratio: 3 / 2; width: min(100%, 72vh); width: min(100%, 72dvh); height: auto; margin: 0 auto; touch-action: none; user-select: none; -webkit-user-select: none;
  border-radius: 12px; cursor: crosshair; background: #f1ead8; }
.cg-svg .z .base { fill: #fff; fill-opacity: 0; stroke: #fff; stroke-opacity: 0; stroke-width: 3; stroke-dasharray: 8 6; transition: fill-opacity .15s, stroke-opacity .15s; }
.cg-svg .z:hover .base, .cg-svg .z.hot .base { fill-opacity: .12; stroke-opacity: .85; }
.cg-svg .z.done .base { fill-opacity: .07; }
.cg-msg { min-height: 44px; padding: 8px 12px; border-radius: 10px; background: #f1e8d2; font-size: 14.5px; }
.cg-msg.bad { background: #fde4d8; } .cg-msg.good { background: #dff0d3; }
.cg-steps { display: flex; flex-wrap: wrap; gap: 6px; font-size: 12.5px; }
.cg-steps span { padding: 3px 8px; border-radius: 99px; background: #ece3cd; } .cg-steps span.ok { background: #cfe8c0; }
@keyframes cgPuff { from { opacity: .9; transform: scale(.4); } to { opacity: 0; transform: scale(1.6) translateY(-14px); } }
.cg-puff { animation: cgPuff .7s ease-out forwards; transform-box: fill-box; transform-origin: center; pointer-events: none; }
@keyframes cgHeart { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-70px); } }
.cg-heart { animation: cgHeart 1.3s ease-out forwards; pointer-events: none; }
`;
export const TOOLS = {
  etrille: { name: 'Étrille', icon: '🌀', tip: 'L’étrille : fais des petits cercles, seulement là où il y a des muscles (encolure, épaule, dos, croupe). Elle décolle la boue.' },
  bouchon: { name: 'Bouchon', icon: '🧹', tip: 'Le bouchon : des petits coups de poignet, dans le sens des poils. Il enlève la poussière que l’étrille a fait sortir.' },
  brosse: { name: 'Brosse douce', icon: '🪮', tip: 'La brosse douce : pour la tête et les jambes, et pour finir le corps. Tout doucement, dans le sens des poils.' },
  cure: { name: 'Cure-pieds', icon: '🪝', tip: 'Le cure-pieds : du talon vers la pince (le bout du pied). On n’appuie pas sur la fourchette, le triangle tendre au milieu.' },
};
// kind: body (étrille → bouchon → brosse), head / legs (brosse; bouchon also fine on the legs), hoof (cure-pieds, one per foot)
const ZONES = [
  { id: 'croupe', name: 'la croupe', kind: 'body' },
  { id: 'dos', name: 'le dos et le ventre', kind: 'body' },
  { id: 'epaule', name: 'l’épaule', kind: 'body' },
  { id: 'encolure', name: 'l’encolure', kind: 'body' },
  { id: 'tete', name: 'la tête', kind: 'head' },
  { id: 'avant', name: 'les jambes de devant', kind: 'legs' },
  { id: 'arriere', name: 'les jambes de derrière', kind: 'legs' },
  { id: 'pAv', name: 'les pieds de devant', kind: 'hoof', feet: ['Le pied avant droit', 'Le pied avant gauche'] },
  { id: 'pAr', name: 'les pieds de derrière', kind: 'hoof', feet: ['Le pied arrière droit', 'Le pied arrière gauche'] },
];
const NEED = 160;          // stroke length (picture pixels) to finish one step on a zone; a tap counts 60
const TAP = 60;
const cap = (s) => s[0].toUpperCase() + s.slice(1);

const de = (n) => (/^[AEIOUYÉaeiouyé]/.test(n) ? `d’${n}` : `de ${n}`);   // French elision: d’Onyx, de Comet
export function openGroom(SU, h, S, fx, onDone) {
  if (!document.getElementById('cg-css')) { const st = document.createElement('style'); st.id = 'cg-css'; st.textContent = CSS; document.head.appendChild(st); }
  const el = SU.ui.el, NS = 'http://www.w3.org/2000/svg';
  const pic = renderHorsePicture(SU, h, S, fx.applyTack);
  const Z = ZONES.map(z => ({ ...z, stage: 0, prog: 0 }));
  const max = (z) => (z.kind === 'body' ? 3 : z.kind === 'hoof' ? 2 : 1);
  let tool = null, lastMsgT = 0, lastSnd = 0, lastHeart = 0, hoofTip = false, done = false;
  const P = SU.ui.panel({ title: `Le pansage ${de(h.name)}`, wide: true, closeLabel: 'Terminer', onClose: () => finish() });
  const wrap = el('div', 'cg-wrap'); P.body.append(wrap);
  const tools = el('div', 'cg-tools'), tb = {};
  for (const [k, t] of Object.entries(TOOLS)) {
    const b = el('button', 'su-btn', `<span class="ic">${t.icon}</span><b>${t.name}</b>`);
    b.addEventListener('click', () => pick(k)); tools.append(b); tb[k] = b;
  }
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${pic.W} ${pic.H}`); svg.setAttribute('class', 'cg-svg');
  svg.innerHTML = `<defs>
    <radialGradient id="cgMud"><stop offset="0" stop-color="#4e3920" stop-opacity=".95"/><stop offset=".6" stop-color="#6b5133" stop-opacity=".7"/><stop offset="1" stop-color="#7a5f3e" stop-opacity="0"/></radialGradient>
    <radialGradient id="cgDust"><stop offset="0" stop-color="#e9dcbc" stop-opacity=".95"/><stop offset=".6" stop-color="#d8c69e" stop-opacity=".65"/><stop offset="1" stop-color="#d8c69e" stop-opacity="0"/></radialGradient>
    <radialGradient id="cgShine"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <filter id="cgSoft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="7"/></filter>
    <mask id="cgMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${pic.W}" height="${pic.H}"><image href="${pic.mask}" x="0" y="0" width="${pic.W}" height="${pic.H}" preserveAspectRatio="none"/></mask>
  </defs><image href="${pic.url}" x="0" y="0" width="${pic.W}" height="${pic.H}" preserveAspectRatio="none"/>`;
  // per zone: a clip path, dirt patches (blobs clipped to the zone) and the tappable zone outline on top
  const dirtLayer = document.createElementNS(NS, 'g'), zoneLayer = document.createElementNS(NS, 'g');
  dirtLayer.setAttribute('filter', 'url(#cgSoft)');
  if (pic.mask) dirtLayer.setAttribute('mask', 'url(#cgMask)');
  svg.append(dirtLayer, zoneLayer);
  const shapes = {};
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed % 10000) / 10000; };
  for (const z of Z) {
    const d = pic.zones[z.id];
    const clip = document.createElementNS(NS, 'clipPath'); clip.id = 'cgc-' + z.id;
    const cp = document.createElementNS(NS, 'path'); cp.setAttribute('d', d); clip.append(cp); svg.querySelector('defs').append(clip);
    const g = document.createElementNS(NS, 'g'); g.setAttribute('clip-path', `url(#cgc-${z.id})`); g.setAttribute('pointer-events', 'none'); dirtLayer.append(g);
    const tint = document.createElementNS(NS, 'path'); tint.setAttribute('d', d); tint.setAttribute('opacity', '0.35'); g.append(tint);
    const zg = document.createElementNS(NS, 'g'); zg.setAttribute('class', 'z'); zg.dataset.z = z.id;
    const base = document.createElementNS(NS, 'path'); base.setAttribute('d', d); base.setAttribute('class', 'base'); zg.append(base); zoneLayer.append(zg);
    shapes[z.id] = { g, zg, tint, blobs: [] };
  }
  // blobs need the zone's size: measure after the svg is in the page
  const msg = el('div', 'cg-msg', 'Choisis un outil, puis frotte (ou tape) sur le cheval. Tu restes à côté de lui, jamais derrière !');
  const steps = el('div', 'cg-steps');
  wrap.append(tools, msg, svg, steps);
  for (const z of Z) {
    const s = shapes[z.id], bb = s.zg.getBBox(), n = z.kind === 'body' ? 12 : z.kind === 'hoof' ? 3 : 7;
    for (let i = 0; i < n; i++) {
      const c = document.createElementNS(NS, 'ellipse'), r = Math.max(bb.width, bb.height) * (0.14 + rnd() * 0.18);
      c.setAttribute('cx', bb.x + bb.width * (0.1 + 0.8 * rnd())); c.setAttribute('cy', bb.y + bb.height * (z.kind === 'body' ? 0.25 + 0.75 * rnd() : rnd()));
      c.setAttribute('rx', r); c.setAttribute('ry', r * (0.6 + 0.4 * rnd())); s.g.append(c); s.blobs.push(c);
    }
  }
  if (S.saddled) say('Astuce : on fait le pansage avant de seller. Aujourd’hui, on brosse autour de la selle.');

  function say(text, kind = '') { msg.className = 'cg-msg ' + kind; msg.innerHTML = text; }
  function warn(text) { const now = performance.now(); if (text === msg.innerHTML && now - lastMsgT < 1400) return; lastMsgT = now; say(text, 'bad'); }
  function refresh() {
    const dirt = Math.max(0.3, S.dirt);
    for (const z of Z) {
      const s = shapes[z.id], k = z.prog / NEED;
      let fill = 'cgMud', op = 0;
      if (z.kind === 'hoof') op = z.stage >= 2 ? 0 : (0.9 - 0.35 * z.stage) * (1 - 0.4 * k);
      else if (z.kind === 'body') {
        if (z.stage === 0) op = dirt * (1 - 0.45 * k);
        else if (z.stage === 1) { fill = 'cgDust'; op = 0.75 * (1 - 0.8 * k); }
        else if (z.stage === 2) { fill = 'cgShine'; op = 0.5 * k; }
        else { fill = 'cgShine'; op = 0.6; }
      } else if (z.stage === 0) { fill = 'cgDust'; op = 0.25 + 0.5 * dirt * (1 - 0.7 * k); }
      else { fill = 'cgShine'; op = 0.45; }
      s.g.setAttribute('opacity', op.toFixed(3)); for (const b of s.blobs) b.setAttribute('fill', `url(#${fill})`); s.tint.setAttribute('fill', fill === 'cgMud' ? '#5e4528' : fill === 'cgDust' ? '#e4d5b2' : '#ffffff'); s.tint.setAttribute('opacity', z.kind === 'legs' ? '0.12' : '0.35');
      s.zg.classList.toggle('done', z.stage >= max(z));
    }
    const body = Z.filter(z => z.kind === 'body'), hoofs = Z.filter(z => z.kind === 'hoof');
    const chip = (ok, t) => `<span class="${ok ? 'ok' : ''}">${ok ? '✓ ' : ''}${t}</span>`;
    steps.innerHTML = chip(body.every(z => z.stage >= 1), 'Étrille') + chip(body.every(z => z.stage >= 2), 'Bouchon')
      + chip(body.every(z => z.stage >= 3) && Z.filter(z => z.kind === 'head' || z.kind === 'legs').every(z => z.stage), 'Brosse douce')
      + chip(hoofs.every(z => z.stage >= 2), 'Pieds curés');
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
      if (tool === 'bouchon') return 'Pour la tête, prends la brosse douce : c’est plus doux près des yeux.';
      return null;
    }
    if (z.kind === 'legs') return tool === 'etrille' ? 'Pas l’étrille sur les jambes : les os sont juste sous la peau, ça fait mal. Prends la brosse douce.' : null;
    if (tool === 'etrille') return z.stage >= 1 ? 'C’est déjà étrillé ici. Maintenant, le bouchon !' : null;
    if (tool === 'bouchon') return z.stage === 0 ? 'Commence par l’étrille : elle décolle la boue.' : z.stage >= 2 ? 'Le bouchon est déjà passé ici. Finis avec la brosse douce !' : null;
    return z.stage === 0 ? 'Commence par l’étrille : elle décolle la boue.' : z.stage === 1 ? 'D’abord le bouchon : il enlève la poussière que l’étrille a fait sortir.' : z.stage >= 3 ? 'Ici, c’est tout beau !' : null;
  }
  const pt = svg.createSVGPoint();
  const toSvg = (e) => { pt.x = e.clientX; pt.y = e.clientY; const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 }; };
  function zoneAt(e) { const t = document.elementFromPoint(e.clientX, e.clientY); const g = t && t.closest && t.closest('.z'); return g ? Z.find(z => z.id === g.dataset.z) : null; }
  function puff(p, color) {
    const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', p.x + (Math.random() - 0.5) * 24); c.setAttribute('cy', p.y + (Math.random() - 0.5) * 24);
    c.setAttribute('r', 10 + Math.random() * 12); c.setAttribute('fill', color); c.setAttribute('class', 'cg-puff'); svg.append(c); setTimeout(() => c.remove(), 750);
  }
  function heart() {
    const now = performance.now(); if (now - lastHeart < 1500) return; lastHeart = now;
    const t = document.createElementNS(NS, 'text'); t.setAttribute('x', pic.headPt[0] - 10 + Math.random() * 30); t.setAttribute('y', pic.headPt[1] - 10);
    t.setAttribute('font-size', '40'); t.setAttribute('class', 'cg-heart'); t.setAttribute('fill', '#ff5c8a'); t.textContent = '❤';
    svg.append(t); setTimeout(() => t.remove(), 1350);
  }
  let hot = null;
  const setHot = (z) => { if (hot === z) return; if (hot) shapes[hot.id].zg.classList.remove('hot'); hot = z; if (z) shapes[z.id].zg.classList.add('hot'); };
  // some rubbing (amount in picture pixels) of the current tool on zone z
  function work(z, amount, p) {
    const why = rule(z); if (why) { warn(why); return; }
    if (z.stage >= max(z)) return;
    z.prog += amount;
    const now = performance.now();
    if (now - lastSnd > 110) { lastSnd = now; fx.brush(tool); }
    puff(p, tool === 'etrille' ? '#6b5133' : tool === 'bouchon' ? '#eadfc4' : tool === 'cure' ? '#4a3a2a' : '#fff6d8');
    if (tool === 'cure' && !hoofTip) { hoofTip = true; say('Pour lever un pied, reste à côté de l’épaule (ou de la hanche), jamais derrière. Pour l’autre côté, passe devant le cheval.'); }
    if (z.prog >= NEED) {
      z.prog = 0; z.stage++;
      if (z.kind === 'hoof') say(z.stage === 1 ? `${z.feet[0]} est curé. Maintenant l’autre ! (Passe devant le cheval pour changer de côté.)` : `${z.feet[1]} est curé aussi.`, 'good');
      else { say(`${cap(z.name)} : c’est fait !`, 'good'); heart(); }
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
  svg.addEventListener('pointerdown', (e) => { down = true; last = toSvg(e); const z = zoneAt(e); setHot(z); if (z) work(z, TAP, last); });
  svg.addEventListener('pointermove', (e) => {
    if (!down) return; const p = toSvg(e), d = last ? Math.hypot(p.x - last.x, p.y - last.y) : 0; last = p;
    if (d < 3) return; const z = zoneAt(e); setHot(z); if (z) work(z, Math.min(d, 50), p);
  });
  const up = () => { down = false; last = null; setHot(null); };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointerleave', up); svg.addEventListener('pointercancel', up);
  refresh();

  function finish() {
    const nonHoof = Z.filter(z => z.kind !== 'hoof');
    const frac = nonHoof.reduce((a, z) => a + z.stage / max(z), 0) / nonHoof.length;
    const feet = Z.filter(z => z.kind === 'hoof').every(z => z.stage >= 2);
    onDone({ frac, feet, complete: done, worked: Z.some(z => z.stage > 0) });
  }
  // test hooks: rub a zone without pointer strokes
  return {
    panel: P, zones: Z, pick, close: () => P.close(), renderMs: pic.ms, svg,
    rub(id, times = 3) { const z = Z.find(q => q.id === id); for (let i = 0; i < times; i++) work(z, TAP, { x: 200, y: 100 }); return { stage: z.stage, msg: msg.textContent }; },
    message: () => msg.textContent,
  };
}
