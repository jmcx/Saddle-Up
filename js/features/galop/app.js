// "Mon Galop 1": the trainer panel. Practice by chapter with spaced repetition, picture exercises, a mock exam,
// the "je sais, je peux" self-assessment sheet and the practical-test course. Loaded on first open; all DOM is built
// when the panel opens and removed when it closes. Progress is saved per rider (SU.store 'galop1.<name>').
import { CHAPTERS, QUESTIONS, SELF_EVAL, PARCOURS } from './questions.js';
import { DIAGRAMS, buildPictures, pictures } from './diagrams.js';

const CSS = `
.g1 { --g: #243a2c; --sand: #f1e3c8; --ink: #2a1d12; font-size: 16px; }
.g1 * { box-sizing: border-box; } .g1 [hidden] { display: none !important; }
.g1 h3 { margin: 4px 0 10px; font-size: 18px; }
.g1-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.g1-top { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.g1-top .t { flex: 1; font-weight: 700; font-size: 17px; min-width: 120px; }
.g1-b { font: inherit; font-size: 16px; font-weight: 650; cursor: pointer; color: var(--ink); background: #fff; border: 2px solid #e2d6bd; border-radius: 12px;
  padding: 10px 14px; min-height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-align: left; }
.g1-b:hover:not(:disabled), .g1-b:focus-visible { border-color: var(--g); background: #f4eeda; outline: none; }
.g1-b:disabled { opacity: .45; cursor: default; }
.g1-b.pri { background: var(--g); color: #f1ead8; border-color: var(--g); }
.g1-b.pri:hover:not(:disabled) { background: #2f4b39; }
.g1-b.small { min-height: 44px; padding: 6px 12px; font-size: 15px; }
.g1-b kbd { font: 700 12px/1 ui-monospace, monospace; background: #ece3cd; color: var(--ink); border-radius: 5px; padding: 4px 6px; margin-left: auto; }
.g1-b.pri kbd { background: rgba(255,255,255,.2); color: #fff; }
.g1-hello { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.g1-hello .who { font-size: 18px; font-weight: 750; } .g1-hello small { display: block; opacity: .7; font-size: 13.5px; }
.g1-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(165px, 100%), 1fr)); gap: 10px; margin-bottom: 16px; }
.g1-tile { position: relative; background: #fff; border-radius: 14px; padding: 10px 12px 12px; border: 2px solid #eadfc6; border-top: 6px solid var(--c); min-height: 92px; }
.g1-tile .n { font-weight: 700; font-size: 15px; line-height: 1.25; padding-right: 30px; }
.g1-tile .stars { color: #d89b16; font-size: 18px; letter-spacing: 2px; margin-top: 4px; }
.g1-tile .rz { position: absolute; right: 6px; top: 4px; transform: scale(.5); transform-origin: top right; }
.g1-bar { height: 10px; border-radius: 6px; background: #efe5cf; overflow: hidden; margin-top: 6px; }
.g1-bar i { display: block; height: 100%; width: 0; background: var(--c, #243a2c); border-radius: 6px; transition: width .4s; }
.g1-pct { font-size: 13px; opacity: .75; margin-top: 3px; }
.g1-menu { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.g1-menu .g1-b { justify-content: flex-start; min-height: 64px; width: 100%; }
.g1-menu .ic { font-size: 26px; width: 34px; text-align: center; flex: none; }
.g1-menu b { display: block; } .g1-menu small { display: block; font-weight: 500; font-size: 13.5px; opacity: .72; }
.g1-chip { display: inline-block; font-size: 13px; font-weight: 700; color: #fff; background: var(--c, #243a2c); border-radius: 999px; padding: 3px 10px; }
.g1-q { font-size: 19px; font-weight: 700; line-height: 1.35; margin: 10px 0 14px; }
.g1-opts { display: grid; gap: 8px; }
.g1-opts.two { grid-template-columns: 1fr 1fr; }
.g1-opt { width: 100%; justify-content: flex-start; font-weight: 600; font-size: 17px; min-height: 52px; }
.g1-opt .num { flex: none; width: 30px; height: 30px; border-radius: 50%; background: #efe5cf; display: grid; place-items: center; font-weight: 800; font-size: 15px; }
.g1-opt.sel { border-color: var(--g); background: #e7efe6; }
.g1-opt.sel .num { background: var(--g); color: #fff; }
.g1-opt.ok { border-color: #2e8b4e; background: #e3f4e6; } .g1-opt.ok .num { background: #2e8b4e; color: #fff; }
.g1-opt.bad { border-color: #c0392b; background: #fbe6e3; } .g1-opt.bad .num { background: #c0392b; color: #fff; }
.g1-opt .chk { margin-left: auto; font-size: 20px; }
.g1-order { display: grid; gap: 8px; }
.g1-order .slot { min-height: 44px; border: 2px dashed #d9c9a6; border-radius: 12px; display: flex; align-items: center; gap: 10px; padding: 6px 12px; color: #9a8a6a; font-size: 15px; }
.g1-order .slot.full { border-style: solid; border-color: var(--g); color: var(--ink); background: #fff; cursor: pointer; font-weight: 600; font-size: 17px; }
.g1-order .slot .num { flex: none; width: 30px; height: 30px; border-radius: 50%; background: var(--g); color: #fff; display: grid; place-items: center; font-weight: 800; }
.g1-order .slot.ok { border-color: #2e8b4e; background: #e3f4e6; } .g1-order .slot.bad { border-color: #c0392b; background: #fbe6e3; }
.g1-hint { font-size: 14px; opacity: .75; margin: 6px 0; }
.g1-fb { margin-top: 14px; border-radius: 14px; padding: 12px 14px; font-size: 16px; line-height: 1.45; }
.g1-fb.ok { background: #e3f4e6; border: 2px solid #9fd3ad; } .g1-fb.bad { background: #fdf0e4; border: 2px solid #efc28f; }
.g1-fb .h { font-size: 19px; font-weight: 800; margin-bottom: 4px; }
.g1-act { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; flex-wrap: wrap; }
.g1-act .g1-b.pri { min-width: 160px; }
.g1-pic { position: relative; border-radius: 14px; overflow: hidden; background: #f4ecd9; max-width: 720px; margin: 0 auto; user-select: none; -webkit-user-select: none; }
.g1-pic img { display: block; width: 100%; height: auto; pointer-events: none; }
.g1-pic svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.g1-dot { position: absolute; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; background: #fff; border: 3px solid var(--g); pointer-events: none; }
.g1-badge { position: absolute; transform: translate(-50%, -50%); min-width: 30px; height: 30px; padding: 0 6px; border-radius: 15px; border: 2px solid #fff;
  background: var(--g); color: #fff; font: 800 15px/26px system-ui, sans-serif; text-align: center; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,.3); }
.g1-badge::before { content: ''; position: absolute; inset: -8px; border-radius: 50%; }
.g1-badge.hl { background: #e0912f; transform: translate(-50%, -50%) scale(1.25); z-index: 2; }
.g1-badge.ok { background: #2e8b4e; transform: translate(-50%, -50%) scale(1.25); z-index: 2; } .g1-badge.bad { background: #c0392b; }
.g1-badge.dim { opacity: .55; }
.g1-legend { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; margin-top: 12px; }
.g1-legend .g1-b { justify-content: flex-start; font-weight: 600; min-height: 44px; padding: 6px 10px; }
.g1-legend .g1-b.on { border-color: #e0912f; background: #fff4e2; }
.g1-legend .num { flex: none; width: 28px; height: 28px; border-radius: 50%; background: var(--g); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 14px; }
.g1-why { min-height: 48px; margin-top: 10px; padding: 10px 12px; background: #fff; border-radius: 12px; border: 2px solid #eadfc6; }
.g1-gal { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.g1-gal.pick { grid-template-columns: 1fr 1fr; }
.g1-card { position: relative; background: #fff; border: 3px solid #eadfc6; border-radius: 14px; overflow: hidden; padding: 0; cursor: pointer; font: inherit; color: inherit; text-align: center; }
.g1-card img { display: block; width: 100%; height: auto; background: #f4ecd9; }
.g1-card .cap { padding: 6px 8px 8px; font-weight: 700; font-size: 15px; }
.g1-card .cap small { display: block; font-weight: 500; font-size: 13px; opacity: .78; text-align: left; margin-top: 3px; }
.g1-card .num { position: absolute; left: 8px; top: 8px; width: 32px; height: 32px; border-radius: 50%; background: var(--g); color: #fff; display: grid; place-items: center; font-weight: 800; border: 2px solid #fff; }
.g1-card:hover, .g1-card:focus-visible { border-color: var(--g); outline: none; }
.g1-card.sel { border-color: var(--g); box-shadow: 0 0 0 3px #b9d3bf; }
.g1-card.ok { border-color: #2e8b4e; box-shadow: 0 0 0 3px #9fd3ad; } .g1-card.bad { border-color: #c0392b; }
.g1-big { max-width: 560px; margin: 0 auto; border-radius: 14px; overflow: hidden; }
.g1-big img { display: block; width: 100%; height: auto; }
.g1-big.tall { max-width: 340px; }
.g1-score { text-align: center; padding: 8px 0 4px; }
.g1-score .big { font-size: 46px; font-weight: 850; color: var(--g); line-height: 1.1; }
.g1-score .msg { font-size: 18px; font-weight: 650; margin: 6px 0 2px; }
.g1-rev { margin-top: 14px; display: grid; gap: 8px; }
.g1-rev .it { background: #fff; border-radius: 12px; border: 2px solid #eadfc6; border-left: 6px solid #c0392b; padding: 10px 12px; font-size: 15px; }
.g1-rev .it .tq { display: block; font-weight: 700; font-size: 16px; margin-bottom: 3px; }
.g1-rev .it .th { margin: 6px 0; max-width: 260px; border-radius: 10px; overflow: hidden; }
.g1-rev .it .th img { display: block; width: 100%; height: auto; }
.g1-se { margin-bottom: 18px; }
.g1-se .hd { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.g1-se .hd .g1-bar { flex: 1; min-width: 120px; margin: 0; height: 12px; }
.g1-se .item { background: #fff; border: 2px solid #eadfc6; border-radius: 12px; padding: 10px 12px; margin-top: 8px; }
.g1-se .item .tx { font-weight: 650; margin-bottom: 8px; }
.g1-smiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.g1-smile { font: inherit; cursor: pointer; border: 2px solid #e2d6bd; background: #faf6ec; border-radius: 12px; min-height: 58px; padding: 4px 4px 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--ink); }
.g1-smile .e { font-size: 26px; line-height: 1; filter: grayscale(1); opacity: .6; }
.g1-smile .l { font-size: 12.5px; font-weight: 650; line-height: 1.15; text-align: center; }
.g1-smile[aria-pressed="true"] .e { filter: none; opacity: 1; }
.g1-smile.s0[aria-pressed="true"] { border-color: #d0763a; background: #fdeee2; }
.g1-smile.s1[aria-pressed="true"] { border-color: #d8b02a; background: #fdf6dc; }
.g1-smile.s2[aria-pressed="true"] { border-color: #2e8b4e; background: #e3f4e6; }
.g1-steps { display: grid; gap: 8px; counter-reset: s; }
.g1-step { display: grid; grid-template-columns: 40px 1fr; gap: 10px; align-items: start; background: #fff; border: 2px solid #eadfc6; border-left: 8px solid var(--c); border-radius: 12px; padding: 10px 12px; }
.g1-step .n { width: 36px; height: 36px; border-radius: 50%; background: var(--c); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 17px; }
.g1-step .tt { font-weight: 700; font-size: 16.5px; }
.g1-step .tip { font-size: 14.5px; opacity: .85; margin-top: 4px; }
.g1-pace { display: inline-block; font-size: 12.5px; font-weight: 750; border-radius: 999px; padding: 2px 9px; color: #fff; background: var(--c); margin-top: 4px; }
.g1-legendp { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
.g1-cele { text-align: center; padding: 14px 6px; }
.g1-cele .msg { font-size: 20px; font-weight: 800; margin-top: 26px; }
.g1-rosette { --c: #c0392b; position: relative; width: 72px; height: 72px; margin: 0 auto; isolation: isolate; }
.g1-rosette::before, .g1-rosette::after { content: ''; position: absolute; top: 46px; width: 20px; height: 38px; background: var(--c); z-index: -1;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%); }
.g1-rosette::before { left: 16px; transform: rotate(14deg); } .g1-rosette::after { right: 16px; transform: rotate(-14deg); }
.g1-rosette .p { position: absolute; inset: 0; border-radius: 50%; background: repeating-conic-gradient(var(--c) 0 9deg, #fff 9deg 11deg); box-shadow: 0 2px 6px rgba(0,0,0,.25); }
.g1-rosette .m { position: absolute; inset: 15px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff3c4, #e8b93a); display: grid; place-items: center;
  font-size: 22px; color: #7a5200; font-weight: 900; box-shadow: inset 0 0 0 2px rgba(255,255,255,.6); }
.g1-rosette.big { transform: scale(1.5); margin: 20px auto 30px; }
.g1-dg { background: #fff; border: 2px solid #eadfc6; border-radius: 14px; overflow: hidden; display: grid; }
.g1-dg img { width: 100%; height: 120px; object-fit: cover; background: #f4ecd9; display: block; }
.g1-dg .t { padding: 8px 10px 4px; font-size: 16px; } .g1-dg .r { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px 10px 10px; }
.g1-dg .r .g1-b { justify-content: center; min-height: 46px; }
.g1-load { text-align: center; padding: 40px 10px; font-size: 17px; font-weight: 650; }
@media (max-width: 520px) {
  .g1-q { font-size: 18px; }
  .g1-menu { grid-template-columns: 1fr; }
  .g1-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .g1-tile { padding: 8px 10px 10px; min-height: 0; } .g1-tile .n { font-size: 14px; hyphens: auto; } .g1-tile .stars { font-size: 15px; }
  .g1-hello { gap: 8px; } .g1-hello span { font-size: 30px !important; }
  .g1-badge { min-width: 26px; height: 26px; font-size: 13px; line-height: 22px; border-radius: 13px; }
  .g1-opts.two { grid-template-columns: 1fr; }
}
`;

const IMG_CH = { id: 'images', title: 'Les images', color: '#b07a1f' };
const PACES = { 'en main': '#8a6a45', 'arrêt': '#b03a2e', 'pas': '#2e8b4e', 'trot enlevé': '#2f6fb0', 'trot en équilibre': '#6b4c9a', 'galop': '#d07a16' };
const SMILES = [['😟', 'Je ne sais pas'], ['🙂', 'En cours'], ['😄', 'Je sais, je peux']];
const PASS = 0.7, SESSION = 10, EXAM = 20, EXAM_PICS = 4;

let SU = null, P = null, data = null, keyFn = null, styled = false;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const html = (tag, cls, h) => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = h; return e; };
const btn = (label, cls, onClick, kbd) => { const b = html('button', 'g1-b' + (cls ? ' ' + cls : ''), ''); b.type = 'button'; b.append(typeof label === 'string' ? el('span', null, label) : label); if (kbd) b.append(el('kbd', null, kbd)); b.addEventListener('click', onClick); return b; };
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

// ---------------------------------------------------------------- saved progress, per rider
const rider = () => SU.player?.look?.name ?? 'moi';
const storeKey = () => 'galop1.' + rider();
function load() { const d = SU.store.get(storeKey(), null) ?? {}; data = { q: d.q ?? {}, se: d.se ?? {}, best: d.best ?? null, exams: d.exams ?? 0, done: d.done ?? {} }; }
function save() { SU.store.set(storeKey(), data); }

// ---------------------------------------------------------------- the question pool
const chapters = () => CHAPTERS.filter(c => c && c.id);
const chap = (id) => id === 'images' ? IMG_CH : chapters().find(c => c.id === id) ?? { id, title: id, color: '#777' };
const TYPES = ['single', 'multi', 'vf', 'order'];
const textQs = () => QUESTIONS.filter(q => q && q.id != null && q.q && TYPES.includes(q.type) && (q.type === 'vf' || (Array.isArray(q.options) && q.options.length >= 2)));
let picPool = null;
function picQs() {
  if (picPool) return picPool;
  picPool = [];
  for (const d of DIAGRAMS) {
    if (d.kind === 'labels') for (const p of d.parts) {
      picPool.push({ id: `pic:${d.id}:${p.id}:n`, chapter: 'images', type: 'picname', d, p }, { id: `pic:${d.id}:${p.id}:w`, chapter: 'images', type: 'picwhere', d, p });
    } else for (const it of d.items) {
      picPool.push({ id: `pic:${d.id}:${it.id}:n`, chapter: 'images', type: 'picgal', d, it }, { id: `pic:${d.id}:${it.id}:p`, chapter: 'images', type: 'picpick', d, it });
    }
  }
  return picPool;
}
const poolOf = (ch) => ch === 'images' ? picQs() : ch ? textQs().filter(q => q.chapter === ch) : textQs();
const level = (q) => data.q[q.id]?.s ?? -1;
const weight = (q) => [4, 6, 3, 1.2, 0.5][level(q) + 1];           // unseen, then box 0..3: what you got wrong comes back most
function draw(pool, n, avoid = new Set()) {
  const out = [], left = pool.filter(q => !avoid.has(q.id));
  while (out.length < n && left.length) {
    let t = Math.random() * left.reduce((s, q) => s + weight(q), 0), i = 0;
    for (; i < left.length - 1; i++) { t -= weight(left[i]); if (t <= 0) break; }
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}
function grade(q, ok) {
  const r = data.q[q.id] ?? (data.q[q.id] = { s: 0, n: 0 });
  r.n++; r.s = ok ? Math.min(3, (r.n === 1 ? 1 : r.s + 1)) : 0;
  save();
}
const progress = (ch) => { const pool = poolOf(ch); if (!pool.length) return 0; return pool.reduce((s, q) => s + Math.min(2, Math.max(0, level(q))), 0) / (2 * pool.length); };
const allCh = () => [...chapters().map(c => c.id), 'images'];
function newlyMastered() {
  const got = [];
  for (const id of allCh()) if (!data.done[id] && progress(id) >= 1) { data.done[id] = true; got.push(id); }
  if (got.length) save();
  return got;
}
const stars = (p) => p >= 1 ? 3 : p >= 0.67 ? 2 : p >= 0.34 ? 1 : 0;
const rosette = (color, mid = '★', big = false) => setC(html('div', 'g1-rosette' + (big ? ' big' : ''), `<div class="p"></div><div class="m">${mid}</div>`), color);
function setC(e, c) { e.style.setProperty('--c', c); return e; }

// ---------------------------------------------------------------- panel and screens
export function openTrainer(su) {
  SU = su;
  if (P) return;
  if (!styled) { const s = document.createElement('style'); s.textContent = CSS; document.head.append(s); styled = true; }
  load();
  P = SU.ui.panel({ title: 'Mon Galop 1', wide: true, onClose: () => { P = null; keyFn = null; try { speechSynthesis.cancel(); } catch { /* no speech */ } } });
  P.body.classList.add('g1'); P.body.lang = 'fr';
  P.onKey = (k, e) => (keyFn ? keyFn(k, e) : false) || false;
  home();
}
function screen(title) {
  keyFn = null;
  P.body.replaceChildren(); P.body.scrollTop = 0;
  P.setTitle(title ? `Mon Galop 1 · ${title}` : `Mon Galop 1`);
  return P.body;
}
function topBar(root, title, back = home, extra) {
  const t = el('div', 'g1-top');
  t.append(btn('← Retour', 'small', back), el('div', 't', title ?? ''));
  if (extra) t.append(extra);
  root.append(t); return t;
}
const keys = (map) => { keyFn = (k) => { const f = map[k]; if (f) { f(); return true; } return false; }; };

function home() {
  const R = screen();
  const hello = el('div', 'g1-hello');
  hello.append(html('div', null, `<span style="font-size:40px">🏇</span>`), html('div', null, `<div class="who"></div><small>Change de cavalière dans le jeu pour voir les progrès de l’autre.</small>`));
  hello.querySelector('.who').textContent = `Les progrès de ${rider()}`;
  R.append(hello);
  const tiles = el('div', 'g1-tiles');
  for (const id of allCh()) {
    const c = chap(id), p = progress(id), t = setC(el('div', 'g1-tile'), c.color);
    t.append(el('div', 'n', c.title));
    t.append(el('div', 'stars', '★'.repeat(stars(p)) + '☆'.repeat(3 - stars(p))));
    const bar = setC(html('div', 'g1-bar', '<i></i>'), c.color); bar.firstChild.style.width = Math.round(p * 100) + '%'; t.append(bar);
    t.append(el('div', 'g1-pct', p >= 1 ? 'Maîtrisé !' : `${Math.round(p * 100)} %`));
    if (data.done[id]) { const r = setC(rosette(c.color), c.color); r.classList.add('rz'); t.append(r); }
    tiles.append(t);
  }
  R.append(tiles);
  const best = data.best ? `Meilleur test blanc : ${data.best.score}/${data.best.total}` : 'Pas encore de test blanc';
  const items = [
    ['🏇', 'S’entraîner', 'Une question à la fois, par chapitre', practiceMenu],
    ['🖼️', 'Les images', 'Le corps, la tête, le pied, les robes, les marques', imagesMenu],
    ['📝', 'Test blanc', `${EXAM} questions, comme le jour du Galop. ${best}`, () => withPics(exam)],
    ['😊', 'Je sais, je peux', 'Ta fiche : coche ce que tu sais faire', selfEval],
    ['🚩', 'Le parcours', 'Les étapes du test à cheval', parcours],
  ];
  const m = el('div', 'g1-menu'), map = {};
  items.forEach(([ic, t, sub, fn], i) => {
    const b = btn(html('span', null, `<span class="ic">${ic}</span>`), null, fn, String(i + 1));
    const tx = el('span'); tx.append(el('b', null, t), el('small', null, sub)); b.firstChild.append(tx); b.firstChild.style.cssText = 'display:flex;align-items:center;gap:12px';
    m.append(b); map[String(i + 1)] = fn;
  });
  R.append(m);
  keys(map);
}

// ---------------------------------------------------------------- practice
function practiceMenu() {
  const R = screen('S’entraîner');
  topBar(R, 'Choisis un chapitre');
  const m = el('div', 'g1-menu'), map = {};
  const entries = [...chapters().map(c => [c.id, c.title]), [null, 'Tout mélanger']];
  entries.forEach(([id, title], i) => {
    const n = poolOf(id).length, p = id ? progress(id) : null;
    const go = () => run(draw(poolOf(id), SESSION), { title });
    const b = btn(html('span', null, ''), null, go, i < 9 ? String(i + 1) : null);
    const tx = el('span'); tx.append(el('b', null, title), el('small', null, n ? (p != null ? `${n} questions · ${Math.round(p * 100)} % su` : `${n} questions`) : 'Pas encore de questions'));
    if (id) { const ch = setC(el('span', 'g1-chip', ' '), chap(id).color); ch.style.cssText += ';width:14px;height:14px;padding:0;margin-right:4px'; b.firstChild.append(ch); }
    b.firstChild.append(tx); b.firstChild.style.cssText = 'display:flex;align-items:center;gap:10px';
    b.disabled = !n; m.append(b); if (n && i < 9) map[String(i + 1)] = go;
  });
  R.append(m); keys(map);
}

function imagesMenu() {
  withPics(() => {
    const R = screen('Les images');
    topBar(R, 'Regarde, puis entraîne-toi');
    const mix = btn('🎲 Tout mélanger : 10 questions en images', 'pri', () => run(draw(picQs(), SESSION), { title: 'Les images', back: imagesMenu }), '1');
    mix.style.width = '100%'; mix.style.marginBottom = '12px'; R.append(mix);
    const m = el('div', 'g1-menu');
    for (const d of DIAGRAMS) {
      const box = el('div', 'g1-dg'), pic = pictures()[d.id];
      const img = new Image(); img.alt = ''; img.src = pic.url ?? Object.values(pic.items)[0]; box.append(img);
      box.append(html('div', 't', `<span>${d.icon}</span> <b></b>`)); box.querySelector('b').textContent = d.title;
      const row = el('div', 'r');
      const pool = picQs().filter(q => q.d === d);
      row.append(btn('👀 Découvrir', 'small', () => discover(d)), btn('✏️ Quiz', 'small pri', () => run(draw(pool, Math.min(SESSION, pool.length)), { title: d.title, back: imagesMenu })));
      box.append(row); m.append(box);
    }
    R.append(m);
    keys({ 1: () => run(draw(picQs(), SESSION), { title: 'Les images', back: imagesMenu }) });
  });
}

// make sure the pictures exist (rendered once, the first time they are needed)
function withPics(fn) {
  if (pictures()) return fn();
  const R = screen(), msg = html('div', 'g1-load', '🎨 Je prépare les images…'), bar = setC(html('div', 'g1-bar', '<i></i>'), '#b07a1f');
  bar.style.cssText += ';max-width:320px;margin:12px auto 0'; msg.append(bar); R.append(msg);
  const me = P;
  buildPictures(SU, (n, total) => { bar.firstChild.style.width = Math.round(n / total * 100) + '%'; })
    .then(() => { if (P === me) fn(); })
    .catch((e) => { console.error('[galop] pictures', e); if (P === me) { msg.textContent = 'Oups, les images n’ont pas pu être préparées.'; } });
}

// ---------------------------------------------------------------- pictures with numbered dots
// opts: { parts (subset, in display order), numbers: Map partId -> n, hl, click(partId) }
function picBox(d, opts = {}) {
  const pic = pictures()[d.id], box = el('div', 'g1-pic');
  const img = new Image(); img.src = pic.url; img.alt = d.title; img.style.aspectRatio = String(pic.ar); box.append(img);
  box.style.maxWidth = `min(720px, ${opts.vh ?? 46}vh * ${pic.ar})`;   // keep the answers in view on short screens
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); box.append(svg);
  const parts = opts.parts ?? d.parts, badges = {};
  parts.forEach((p, i) => {
    const [x, y] = pic.pts[p.id], off = p.off ?? [0, 0];
    const bx = Math.min(0.96, Math.max(0.04, x + off[0])), by = Math.min(0.94, Math.max(0.06, y + off[1] * pic.ar));
    if (off[0] || off[1]) {
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      Object.entries({ x1: x * 100 + '%', y1: y * 100 + '%', x2: bx * 100 + '%', y2: by * 100 + '%', stroke: '#243a2c', 'stroke-width': 2.5, 'stroke-linecap': 'round' }).forEach(([k, v]) => ln.setAttribute(k, v));
      svg.append(ln);
      const dot = el('div', 'g1-dot'); dot.style.left = x * 100 + '%'; dot.style.top = y * 100 + '%'; box.append(dot);
    }
    const n = opts.numbers ? opts.numbers.get(p.id) : i + 1;
    const b = el(opts.click ? 'button' : 'span', 'g1-badge', String(n)); if (opts.click) b.type = 'button';
    b.style.left = bx * 100 + '%'; b.style.top = by * 100 + '%';
    b.setAttribute('aria-label', `numéro ${n}`);
    if (opts.click) b.addEventListener('click', () => opts.click(p.id));
    if (opts.hl === p.id) b.classList.add('hl');
    box.append(b); badges[p.id] = b;
  });
  box.badges = badges;
  return box;
}

function discover(d) {
  const R = screen(d.title);
  topBar(R, d.title, imagesMenu, btn('✏️ S’entraîner', 'small pri', () => { const pool = picQs().filter(q => q.d === d); run(draw(pool, Math.min(SESSION, pool.length)), { title: d.title, back: imagesMenu }); }));
  const why = el('div', 'g1-why', d.kind === 'labels' ? 'Touche un numéro ou un nom pour savoir ce que c’est.' : 'Regarde bien chaque image.');
  if (d.kind === 'labels') {
    const box = picBox(d, { click: (id) => show(id), vh: 60 }); R.append(box);
    const leg = el('div', 'g1-legend'), lb = {};
    d.parts.forEach((p, i) => {
      const b = btn(html('span', null, ''), null, () => show(p.id)); b.firstChild.style.cssText = 'display:flex;align-items:center;gap:8px';
      b.firstChild.append(el('span', 'num', String(i + 1)), el('span', null, cap(p.name))); leg.append(b); lb[p.id] = b;
    });
    R.append(why, leg);
    function show(id) {
      const p = d.parts.find(x => x.id === id);
      for (const k in box.badges) { box.badges[k].classList.toggle('hl', k === id); lb[k].classList.toggle('on', k === id); }
      why.replaceChildren(el('b', null, cap(p.name) + ' : '), el('span', null, p.why));
      SU.ui.say(p.name);
    }
  } else {
    const pic = pictures()[d.id], g = el('div', 'g1-gal');
    for (const it of d.items) {
      const c = el('div', 'g1-card'); c.style.cursor = 'default';
      const img = new Image(); img.src = pic.items[it.id]; img.alt = it.name; img.style.aspectRatio = String(pic.ar);
      const capE = el('div', 'cap', cap(it.name)); capE.append(el('small', null, it.why));
      c.append(img, capE); g.append(c);
    }
    R.append(g);
  }
}

// ---------------------------------------------------------------- one question
// Builds the question into host. In practice mode an answer is checked as soon as it is given; in exam mode it is only
// selected, and the caller reads it with value() when the child presses "suivant".
function mountQuestion(q, host, { exam, onCommit, onSelect }) {
  const Q = { value: null, ready: false, keys: {}, reveal: null };
  const commit = (v) => { Q.value = v; Q.ready = true; if (exam) { onSelect(); } else onCommit(v); };
  const optButtons = (labels, onPick) => {
    const box = el('div', 'g1-opts' + (labels.length === 2 && labels.every(l => l.length < 14) ? ' two' : '')), bs = [];
    labels.forEach((l, i) => {
      const b = btn(html('span', null, ''), 'g1-opt', () => onPick(i)); b.firstChild.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%';
      b.firstChild.append(el('span', 'num', String(i + 1)), el('span', null, l)); bs.push(b); box.append(b);
      if (i < 9) Q.keys[String(i + 1)] = () => onPick(i);
    });
    return { box, bs };
  };
  const selOne = (bs, i) => bs.forEach((b, k) => b.classList.toggle('sel', k === i));
  const lock = (bs) => bs.forEach(b => { b.disabled = true; b.style.opacity = 1; });

  if (q.type === 'single' || q.type === 'vf') {
    let order, labels;
    if (q.type === 'vf') { order = [true, false]; labels = ['Vrai', 'Faux']; }
    else { const keep = q.options.some(o => /toutes|aucune|les deux|tous les/i.test(o)); order = keep ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i)); labels = order.map(i => q.options[i]); }
    const { box, bs } = optButtons(labels, (i) => { if (Q.locked) return; selOne(bs, i); commit(order[i]); });
    host.append(box);
    Q.reveal = (ok) => { Q.locked = true; lock(bs); bs.forEach((b, k) => { const right = q.type === 'vf' ? order[k] === q.answer : (q.answer ?? []).includes(order[k]); if (right) b.classList.add('ok'); else if (order[k] === Q.value) b.classList.add('bad'); b.classList.remove('sel'); }); };
  } else if (q.type === 'multi') {
    const keep = q.options.some(o => /toutes|aucune|les deux/i.test(o)), order = keep ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i));
    const chosen = new Set();
    host.append(el('div', 'g1-hint', 'Plusieurs réponses possibles : touche toutes les bonnes, puis « Valider ».'));
    const { box, bs } = optButtons(order.map(i => q.options[i]), (i) => {
      if (Q.locked) return;
      chosen.has(order[i]) ? chosen.delete(order[i]) : chosen.add(order[i]);
      bs[i].classList.toggle('sel', chosen.has(order[i]));
      Q.value = [...chosen].sort((a, b) => a - b); Q.ready = chosen.size > 0; if (exam) onSelect(); else onSelect();
    });
    bs.forEach(b => b.append(el('span', 'chk', '')));
    host.append(box);
    Q.validate = () => { if (Q.ready) onCommit(Q.value); };
    Q.needsValidate = !exam;
    Q.reveal = () => { Q.locked = true; lock(bs); bs.forEach((b, k) => { const right = (q.answer ?? []).includes(order[k]), was = chosen.has(order[k]); b.classList.remove('sel'); if (right) b.classList.add('ok'); else if (was) b.classList.add('bad'); b.querySelector('.chk').textContent = right ? '✔' : was ? '✘' : ''; }); };
  } else if (q.type === 'order') {
    const n = q.options.length, mix = (() => { let m; do { m = shuffle(q.options.map((_, i) => i)); } while (n > 1 && m.every((v, i) => v === i)); return m; })();
    const picked = [];
    host.append(el('div', 'g1-hint', 'Touche les étiquettes dans le bon ordre. Touche une case remplie pour la remettre.'));
    const slots = el('div', 'g1-order'), pool = el('div', 'g1-opts');
    host.append(pool, el('div', 'g1-hint', 'Ton ordre :'), slots);
    const poolBs = mix.map((oi, i) => {
      const b = btn(html('span', null, ''), 'g1-opt', () => { if (Q.locked || picked.includes(oi)) return; picked.push(oi); draw(); });
      b.firstChild.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%';
      b.firstChild.append(el('span', 'num', String(i + 1)), el('span', null, q.options[oi])); pool.append(b);
      if (i < 9) Q.keys[String(i + 1)] = () => b.click();
      return b;
    });
    const slotEs = [];
    function draw() {
      slots.replaceChildren(); slotEs.length = 0;
      for (let k = 0; k < n; k++) {
        const oi = picked[k], s = el('div', 'slot' + (oi != null ? ' full' : ''));
        s.append(el('span', 'num', String(k + 1)), el('span', null, oi != null ? q.options[oi] : '…'));
        if (oi != null) { s.setAttribute('role', 'button'); s.tabIndex = 0; s.addEventListener('click', () => { if (Q.locked) return; picked.splice(k, 1); draw(); }); }
        slots.append(s); slotEs.push(s);
      }
      poolBs.forEach((b, i) => { b.hidden = picked.includes(mix[i]); });
      Q.value = picked.slice(); Q.ready = picked.length === n; onSelect();
    }
    Q.keys.Backspace = () => { if (!Q.locked && picked.length) { picked.pop(); draw(); } };
    draw();
    Q.validate = () => { if (Q.ready) onCommit(Q.value); };
    Q.needsValidate = !exam;
    Q.reveal = () => { Q.locked = true; poolBs.forEach(b => { b.disabled = true; }); slotEs.forEach((s, k) => s.classList.add(picked[k] === k ? 'ok' : 'bad')); };
  } else if (q.type === 'picname' || q.type === 'picwhere') {
    const d = q.d, others = shuffle(d.parts.filter(p => p.name !== q.p.name)), pic = pictures()[d.id];
    // up to 5 other parts, keeping the numbers apart so small screens stay readable
    const spot = (p) => { const [x, y] = pic.pts[p.id], o = p.off ?? [0, 0]; return [x + o[0], (y + o[1] * pic.ar) / pic.ar]; };
    const far = (a, b) => { const [ax, ay] = spot(a), [bx, by] = spot(b); return Math.hypot(ax - bx, ay - by) > 0.075; };
    const sel = [q.p]; for (const p of others) if (sel.length < 6 && sel.every(x => far(x, p))) sel.push(p);
    for (const p of others) if (sel.length < 4 && !sel.includes(p)) sel.push(p);
    const shown = shuffle(sel);
    const numbers = new Map(shown.map((p, i) => [p.id, i + 1]));
    q.num = numbers.get(q.p.id);
    if (q.type === 'picname') {
      const box = picBox(d, { parts: shown, numbers, hl: q.p.id }); host.append(box);
      const opts = shuffle([q.p, ...shuffle(others).slice(0, 3)]);
      const { box: ob, bs } = optButtons(opts.map(p => cap(p.name)), (i) => { if (Q.locked) return; selOne(bs, i); commit(opts[i].id); });
      ob.style.marginTop = '12px'; host.append(ob);
      Q.reveal = () => { Q.locked = true; lock(bs); bs.forEach((b, k) => { b.classList.remove('sel'); if (opts[k].id === q.p.id) b.classList.add('ok'); else if (opts[k].id === Q.value) b.classList.add('bad'); }); };
    } else {
      const pick = (id) => { if (Q.locked) return; for (const k in box.badges) box.badges[k].classList.toggle('hl', k === id); commit(id); };
      const box = picBox(d, { parts: shown, numbers, click: pick }); host.append(box);
      host.append(el('div', 'g1-hint', 'Touche le bon numéro sur l’image (ou tape son chiffre).'));
      shown.forEach((p, i) => { Q.keys[String(i + 1)] = () => pick(p.id); });
      Q.reveal = () => { Q.locked = true; for (const k in box.badges) { const b = box.badges[k]; b.classList.remove('hl'); if (k === q.p.id) b.classList.add('ok'); else if (k === Q.value) b.classList.add('bad'); else b.classList.add('dim'); } };
    }
  } else if (q.type === 'picgal') {
    const d = q.d, pic = pictures()[d.id], big = el('div', 'g1-big' + (pic.ar < 1 ? ' tall' : '')); big.style.maxWidth = `min(${pic.ar < 1 ? 340 : 560}px, 40vh * ${pic.ar})`;
    const img = new Image(); img.src = pic.items[q.it.id]; img.alt = 'image'; img.style.aspectRatio = String(pic.ar); big.append(img); host.append(big);
    const opts = shuffle([q.it, ...shuffle(d.items.filter(x => x !== q.it)).slice(0, 3)]);
    const { box, bs } = optButtons(opts.map(x => cap(x.name)), (i) => { if (Q.locked) return; selOne(bs, i); commit(opts[i].id); });
    box.style.marginTop = '12px'; host.append(box);
    Q.reveal = () => { Q.locked = true; lock(bs); bs.forEach((b, k) => { b.classList.remove('sel'); if (opts[k] === q.it) b.classList.add('ok'); else if (opts[k].id === Q.value) b.classList.add('bad'); }); };
  } else if (q.type === 'picpick') {
    const d = q.d, pic = pictures()[d.id], opts = shuffle([q.it, ...shuffle(d.items.filter(x => x !== q.it)).slice(0, 3)]);
    const g = el('div', 'g1-gal pick'), cards = [];
    g.style.maxWidth = `min(${pic.ar < 1 ? 460 : 640}px, 2 * 27vh * ${pic.ar})`; g.style.margin = '0 auto';
    opts.forEach((it, i) => {
      const c = el('button', 'g1-card'); c.type = 'button';
      const img = new Image(); img.src = pic.items[it.id]; img.alt = `image ${i + 1}`; img.style.aspectRatio = String(pic.ar);
      c.append(img, el('span', 'num', String(i + 1)));
      const go = () => { if (Q.locked) return; cards.forEach((x, k) => x.classList.toggle('sel', k === i)); commit(it.id); };
      c.addEventListener('click', go); Q.keys[String(i + 1)] = go; cards.push(c); g.append(c);
    });
    host.append(g);
    Q.reveal = () => { Q.locked = true; cards.forEach((c, k) => { c.classList.remove('sel'); c.disabled = true; if (opts[k] === q.it) c.classList.add('ok'); else if (opts[k].id === Q.value) c.classList.add('bad'); }); };
  }
  return Q;
}
const qText = (q) => q.type === 'picname' ? `Comment s’appelle le numéro ${q.num ?? ''} ?` : q.type === 'picwhere' ? `Où est ${q.p.name} ?` : q.type === 'picgal' ? q.d.q : q.type === 'picpick' ? q.it.pick : q.q;
function isRight(q, v) {
  if (v == null) return false;
  if (q.type === 'single') return (q.answer ?? []).includes(v);
  if (q.type === 'vf') return v === q.answer;
  if (q.type === 'multi') { const a = [...(q.answer ?? [])].sort((x, y) => x - y); return a.length === v.length && a.every((x, i) => x === v[i]); }
  if (q.type === 'order') return v.length === q.options.length && v.every((x, i) => x === i);
  if (q.type === 'picname' || q.type === 'picwhere') return v === q.p.id || q.d.parts.find(p => p.id === v)?.name === q.p.name;
  return v === q.it.id;
}
function answerText(q) {
  if (q.type === 'single') return q.options[(q.answer ?? [0])[0]];
  if (q.type === 'vf') return q.answer ? 'Vrai' : 'Faux';
  if (q.type === 'multi') return (q.answer ?? []).map(i => q.options[i]).join(' · ');
  if (q.type === 'order') return q.options.join(' → ');
  if (q.type === 'picname' || q.type === 'picwhere') return cap(q.p.name);
  return cap(q.it.name);
}
function givenText(q, v) {
  if (v == null || (Array.isArray(v) && !v.length)) return 'pas de réponse';
  if (q.type === 'single') return q.options[v];
  if (q.type === 'vf') return v ? 'Vrai' : 'Faux';
  if (q.type === 'multi') return v.map(i => q.options[i]).join(' · ');
  if (q.type === 'order') return v.map(i => q.options[i]).join(' → ');
  if (q.type === 'picname' || q.type === 'picwhere') return cap(q.d.parts.find(p => p.id === v)?.name ?? '');
  return cap(q.d.items.find(x => x.id === v)?.name ?? '');
}
const whyOf = (q) => q.why ?? q.p?.why ?? q.it?.why ?? '';
function readAloud(q) {
  let t = qText(q);
  if (q.type === 'single' || q.type === 'multi' || q.type === 'order') t += ' ' + q.options.join('. ') + '.';
  if (q.type === 'vf') t += ' Vrai, ou faux ?';
  SU.ui.say(t);
}

// ---------------------------------------------------------------- a run of questions (practice or exam)
function run(list, opts) {
  const { exam = false, title = '', back = exam ? home : practiceMenu } = opts;
  if (!list.length) return back();
  if (!exam && list.some(q => q.chapter === 'images') && !pictures()) return withPics(() => run(list, opts));
  const res = [];
  let i = 0;
  const show = () => {
    const q = list[i], R = screen(title);
    const top = topBar(R, `Question ${i + 1} / ${list.length}`, () => (exam && res.length ? confirmQuit() : back()), btn('🔊 Lire', 'small', () => readAloud(q)));
    top.querySelector('.t').style.cssText = 'font-weight:650;font-size:15px';
    const bar = setC(html('div', 'g1-bar', '<i></i>'), '#243a2c'); bar.firstChild.style.width = (i / list.length * 100) + '%'; bar.style.marginTop = '-4px'; R.append(bar);
    const c = chap(q.chapter);
    const chip = setC(el('span', 'g1-chip', c.title), c.color); const hd = el('div'); hd.style.marginTop = '12px'; hd.append(chip); R.append(hd);
    const qEl = el('div', 'g1-q'); R.append(qEl);
    const host = el('div'); R.append(host);
    const fb = el('div'); R.append(fb);
    const act = el('div', 'g1-act'); R.append(act);
    let done = false;
    const next = () => { i++; if (i < list.length) show(); else (exam ? examEnd : practiceEnd)(); };
    const nextB = btn(i + 1 < list.length ? 'Suivant →' : (exam ? 'Voir ma note' : 'Terminer'), 'pri', () => go(), 'Entrée');
    const go = () => {
      if (exam) { if (!Q.ready) return; res.push({ q, v: Q.value, ok: isRight(q, Q.value) }); grade(q, isRight(q, Q.value)); next(); return; }
      if (!done) { if (Q.needsValidate && Q.ready) Q.validate(); return; }
      next();
    };
    let Q = null;
    Q = mountQuestion(q, host, {
      exam,
      onSelect: () => { if (!Q) return; nextB.disabled = !Q.ready; if (!exam && Q.needsValidate) nextB.firstChild.textContent = 'Valider'; },
      onCommit: (v) => {
        if (done) return; done = true;
        const ok = isRight(q, v); res.push({ q, v, ok }); grade(q, ok);
        Q.reveal(ok);
        const box = el('div', 'g1-fb ' + (ok ? 'ok' : 'bad'));
        box.append(el('div', 'h', ok ? '✅ Bravo !' : '💪 Pas tout à fait…'));
        if (!ok) { const a = el('div'); a.append(el('span', null, 'La bonne réponse : '), el('b', null, answerText(q))); box.append(a); }
        const w = whyOf(q); if (w) box.append(el('div', null, w));
        fb.replaceChildren(box);
        nextB.disabled = false; nextB.firstChild.textContent = i + 1 < list.length ? 'Suivant →' : 'Terminer';
        nextB.focus({ preventScroll: true });
        box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      },
    });
    qEl.textContent = qText(q);
    nextB.disabled = true;
    if (!exam && Q.needsValidate) nextB.firstChild.textContent = 'Valider';
    act.append(nextB);
    keyFn = (k) => {
      if (k === 'Enter') { go(); return true; }
      if (done && !exam) return false;
      const f = Q.keys[k]; if (f) { f(); return true; }
      return false;
    };
  };
  const confirmQuit = () => SU.ui.menu('Arrêter le test blanc ?', [
    { label: 'Continuer le test', icon: '📝', action: () => {} },
    { label: 'Arrêter (la note ne compte pas)', icon: '🚪', action: () => { if (P) back(); } },
  ]);
  const before = new Set(Object.keys(data.done));
  function practiceEnd() {
    const R = screen(title), good = res.filter(r => r.ok).length;
    topBar(R, 'Fini !', back);
    const s = el('div', 'g1-score');
    s.append(el('div', 'big', `${good} / ${res.length}`), el('div', 'msg', good === res.length ? 'Parfait, bravo !' : good >= res.length * 0.7 ? 'Très bien !' : 'Continue, tu progresses !'));
    s.append(el('div', 'g1-hint', 'Les questions ratées reviendront plus souvent.'));
    R.append(s);
    const got = newlyMastered().filter(id => !before.has(id));
    for (const id of got) R.append(celebrate(chap(id)));
    const act = el('div', 'g1-act'); act.style.justifyContent = 'center';
    const more = () => { const pool = list.every(q => q.chapter === list[0].chapter) ? (list[0].chapter === 'images' && list.every(q => q.d === list[0].d) ? picQs().filter(q => q.d === list[0].d) : poolOf(list[0].chapter)) : poolOf(null); run(draw(pool, Math.min(SESSION, pool.length)), opts); };
    act.append(btn('Encore 10 questions', 'pri', more, 'Entrée'), btn('Retour', null, back));
    R.append(act);
    keys({ Enter: more });
  }
  function examEnd() {
    const R = screen('Test blanc'), good = res.filter(r => r.ok).length, total = res.length, pass = Math.ceil(total * PASS);
    topBar(R, 'Ta note', home);
    data.exams++;
    const isBest = !data.best || good / total > data.best.score / data.best.total;
    if (isBest) data.best = { score: good, total };
    save();
    const s = el('div', 'g1-score');
    if (good >= pass) s.append(setC(rosette('#2e8b4e', '✓', true), '#2e8b4e'));
    s.append(el('div', 'big', `${good} / ${total}`));
    s.append(el('div', 'msg', good >= pass ? 'Réussi ! Bravo, tu es sur la bonne route pour le Galop 1 !' : `Il faut ${pass}/${total} pour réussir. Tu y es presque : entraîne-toi encore un peu !`));
    if (isBest && data.exams > 1) s.append(el('div', 'g1-hint', '⭐ C’est ton meilleur score !'));
    R.append(s);
    const bad = res.filter(r => !r.ok);
    if (bad.length) {
      R.append(el('h3', null, 'Tes erreurs, pour apprendre :'));
      const rev = el('div', 'g1-rev');
      for (const r of bad) {
        const it = el('div', 'it'); it.append(el('span', 'tq', (r.q.type === 'picname' ? `${r.q.d.title} : ` : '') + qText(r.q)));
        if (r.q.p) { const th = picBox(r.q.d, { parts: [r.q.p], numbers: new Map([[r.q.p.id, r.q.num ?? '?']]), hl: r.q.p.id }); th.style.maxWidth = '300px'; th.style.margin = '6px 0'; it.append(th); }
        else if (r.q.it) { const th = el('div', 'th'), im = new Image(); im.src = pictures()[r.q.d.id].items[r.q.it.id]; im.alt = ''; th.append(im); it.append(th); }
        const l1 = el('div'); l1.append(el('span', null, 'Ta réponse : '), el('span', null, givenText(r.q, r.v)));
        const l2 = el('div'); l2.append(el('span', null, 'La bonne réponse : '), el('b', null, answerText(r.q)));
        it.append(l1, l2); const w = whyOf(r.q); if (w) it.append(el('div', 'g1-hint', w));
        rev.append(it);
      }
      R.append(rev);
    }
    for (const id of newlyMastered().filter(id => !before.has(id))) R.append(celebrate(chap(id)));
    const act = el('div', 'g1-act'); act.style.justifyContent = 'center';
    act.append(btn('Refaire un test', 'pri', exam0), btn('Retour', null, home)); R.append(act);
  }
  const exam0 = () => exam_();
  show();
}
function celebrate(c) {
  const box = el('div', 'g1-cele');
  box.append(setC(rosette(c.color, '★', true), c.color), el('div', 'msg', `Bravo ! Tu as gagné le flot du chapitre « ${c.title} » !`));
  return box;
}
// 20 questions: a few pictures, the rest spread evenly over the chapters
function exam_() {
  const picked = draw(picQs(), EXAM_PICS), ids = new Set(picked.map(q => q.id));
  const chs = chapters().map(c => shuffle(textQs().filter(q => q.chapter === c.id))).filter(a => a.length);
  const text = [];
  for (let k = 0; text.length < EXAM - picked.length && chs.some(a => a.length); k = (k + 1) % chs.length) { const a = chs[k]; if (a.length) text.push(a.pop()); }
  const list = shuffle([...text, ...picked]).filter(q => !ids.has(q.id) || picked.includes(q));
  run(list, { exam: true, title: 'Test blanc', back: home });
}
const exam = exam_;

// ---------------------------------------------------------------- je sais, je peux
function selfEval() {
  const R = screen('Je sais, je peux');
  topBar(R, 'Pour chaque ligne, choisis ce qui est vrai pour toi');
  for (const sec of SELF_EVAL) {
    if (!sec || !Array.isArray(sec.items)) continue;
    const c = chap(sec.chapter), wrap = el('div', 'g1-se');
    const hd = el('div', 'hd'), bar = setC(html('div', 'g1-bar', '<i></i>'), c.color), pct = el('span', 'g1-pct');
    hd.append(setC(el('span', 'g1-chip', c.title), c.color), bar, pct); wrap.append(hd);
    const upd = () => { const v = sec.items.reduce((s, t) => s + (data.se[`${sec.chapter}|${t}`] ?? 0), 0) / (2 * sec.items.length || 1); bar.firstChild.style.width = Math.round(v * 100) + '%'; pct.textContent = Math.round(v * 100) + ' %'; };
    for (const t of sec.items) {
      const k = `${sec.chapter}|${t}`, it = el('div', 'item'); it.append(el('div', 'tx', t));
      const row = el('div', 'g1-smiles'), bs = [];
      SMILES.forEach(([e, l], v) => {
        const b = el('button', 'g1-smile s' + v); b.type = 'button'; b.append(el('span', 'e', e), el('span', 'l', l));
        b.setAttribute('aria-pressed', String(data.se[k] === v));
        b.addEventListener('click', () => { data.se[k] = v; save(); bs.forEach((x, j) => x.setAttribute('aria-pressed', String(j === v))); upd(); });
        bs.push(b); row.append(b);
      });
      it.append(row); wrap.append(it);
    }
    upd(); R.append(wrap);
  }
}

// ---------------------------------------------------------------- le parcours
function parcours() {
  const R = screen('Le parcours');
  topBar(R, 'Le test à cheval, étape par étape');
  const lg = el('div', 'g1-legendp');
  for (const [p, c] of Object.entries(PACES)) lg.append(setC(el('span', 'g1-pace', cap(p)), c));
  R.append(lg);
  const list = el('div', 'g1-steps');
  for (const s of PARCOURS) {
    if (!s) continue;
    const col = PACES[s.pace] ?? '#777', st = setC(el('div', 'g1-step'), col);
    st.append(el('div', 'n', String(s.n ?? '')));
    const tx = el('div'); tx.append(el('div', 'tt', s.title ?? ''));
    if (s.pace) tx.append(setC(el('span', 'g1-pace', cap(s.pace)), col));
    if (s.tip) tx.append(el('div', 'tip', '💡 ' + s.tip));
    st.append(tx); list.append(st);
  }
  R.append(list);
  const more = btn('😊 Ce que je sais faire à pied et à cheval : ma fiche « Je sais, je peux »', null, selfEval); more.style.cssText = 'width:100%;margin-top:12px;justify-content:flex-start';
  R.append(more);
}
