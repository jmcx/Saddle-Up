// Shared UI for the feature modules: panels, menus, the "F" interaction prompt, speech and saved progress.
// Everything here is plain DOM on top of the canvas; nothing runs per frame except the 8 Hz interaction scan.
const CSS = `
.su-veil { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; background: rgba(15,18,12,0.45); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); }
.su-panel { box-sizing: border-box; width: min(560px, calc(100vw - 24px)); max-height: calc(100vh - 24px); max-height: calc(100dvh - 24px); display: flex; flex-direction: column;
  color: #2a1d12; background: #fbf6ea; border-radius: 18px; box-shadow: 0 18px 60px rgba(0,0,0,0.45); overflow: hidden; }
.su-panel.wide { width: min(940px, calc(100vw - 24px)); }
.su-panel header { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: #243a2c; color: #f1ead8; }
.su-panel header h2 { margin: 0; font-size: 19px; font-weight: 700; flex: 1; letter-spacing: .01em; }
.su-panel header button { font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; color: #f1ead8; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); border-radius: 9px; padding: 6px 12px; min-height: 36px; }
.su-panel header button:hover { background: rgba(255,255,255,0.22); }
.su-body { padding: 16px 18px 18px; overflow-y: auto; font-size: 15px; line-height: 1.5; }
.su-menu { display: grid; gap: 8px; }
.su-btn { display: flex; align-items: center; gap: 12px; width: 100%; box-sizing: border-box; text-align: left; font: inherit; font-size: 15.5px; cursor: pointer; color: #2a1d12;
  background: #fff; border: 2px solid #e2d6bd; border-radius: 12px; padding: 11px 14px; min-height: 48px; }
.su-btn:hover:not(:disabled), .su-btn:focus-visible { border-color: #243a2c; background: #f4eeda; outline: none; }
.su-btn:disabled { opacity: .45; cursor: default; }
.su-btn .ic { font-size: 24px; width: 30px; text-align: center; flex: none; }
.su-btn b { display: block; font-weight: 650; } .su-btn small { display: block; font-size: 12.5px; opacity: .7; }
.su-btn kbd { margin-left: auto; background: #ece3cd; color: #2a1d12; }
.su-btn.primary { background: #243a2c; color: #f1ead8; border-color: #243a2c; justify-content: center; font-weight: 650; }
.su-btn.primary:hover:not(:disabled) { background: #2f4b39; }
#su-hint { position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%); z-index: 6; display: none; align-items: center; gap: 9px; cursor: pointer; white-space: nowrap;
  font: inherit; font-size: 15px; font-weight: 600; color: #fff; padding: 9px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.3);
  background: rgba(20,22,18,0.62); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
#su-hint.show { display: flex; }
#su-hint kbd { background: #f1e3c8; color: #2a1d12; font-weight: 700; }
@media (max-width: 1600px) { #su-hint { bottom: 212px; } }   /* above the stride meter and the help box */
body.touch #su-hint { bottom: 190px; }
#su-menuBtn { font: inherit; font-size: 12.5px; font-weight: 600; color: #2a1d12; cursor: pointer; padding: 8px 12px; border-radius: 10px; border: 1px solid #f1e3c8; background: #f1e3c8; }
#su-menuBtn:hover { background: #fff1d6; }
`;

export function init(SU) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const stack = [];

  // ---- panel: a modal card. Returns { el, body, close, setTitle }. Escape or the close button closes it.
  // opts: { title, wide, pause = true, onClose, closeLabel = 'Fermer', closable = true }
  function panel(opts = {}) {
    const { title = '', wide = false, pause = true, onClose, closeLabel = 'Fermer', closable = true } = opts;
    const veil = el('div', 'su-veil'), card = el('div', 'su-panel' + (wide ? ' wide' : ''));
    const head = el('header'), h = el('h2', null, title), x = el('button', null, closeLabel);
    const body = el('div', 'su-body');
    head.append(h); if (closable) head.append(x); card.append(head, body); veil.append(card); document.body.append(veil);
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-label', title);
    SU.modal++; if (pause) SU.pauseCount++;
    let open = true;
    const P = { el: card, body, setTitle: (t) => { h.innerHTML = t; }, close, onKey: null };
    function close(result) {
      if (!open) return; open = false;
      SU.modal--; if (pause) SU.pauseCount--;
      stack.splice(stack.indexOf(P), 1); veil.remove();
      if (onClose) onClose(result);
    }
    x.addEventListener('click', () => close());
    veil.addEventListener('pointerdown', (e) => { if (e.target === veil && closable) close(); });
    stack.push(P);
    return P;
  }
  addEventListener('keydown', (e) => {
    const P = stack[stack.length - 1]; if (!P) return;
    if (P.onKey && P.onKey(e.key, e)) { e.preventDefault(); return; }
    if (e.key === 'Escape') { e.preventDefault(); P.close(); }
  });

  // ---- menu: a panel of choices. items: [{ label, sub, icon, action, disabled, primary }]. Keys 1-9 pick an item.
  function menu(title, items, opts = {}) {
    const P = panel({ title, pause: false, ...opts });
    const box = el('div', 'su-menu'); P.body.append(box);
    if (opts.intro) box.append(el('div', null, opts.intro));
    const live = [];
    items.forEach((it) => {
      const n = live.length + 1;
      const b = el('button', 'su-btn' + (it.primary ? ' primary' : ''), `${it.icon ? `<span class="ic">${it.icon}</span>` : ''}<span><b>${it.label}</b>${it.sub ? `<small>${it.sub}</small>` : ''}</span>${n <= 9 && !it.primary ? `<kbd>${n}</kbd>` : ''}`);
      b.disabled = !!it.disabled;
      const go = () => { if (b.disabled) return; if (it.keepOpen !== true) P.close(); it.action && it.action(P); };
      b.addEventListener('click', go); live.push(go); box.append(b);
    });
    P.onKey = (k) => { const i = +k; if (i >= 1 && i <= live.length) { live[i - 1](); return true; } return false; };
    return P;
  }

  // ---- speech: say(text) reads French aloud (browser speech synthesis); silent when the game is muted
  let voice = null;
  const pickVoice = () => { const vs = speechSynthesis.getVoices(); voice = vs.find(v => v.lang === 'fr-FR') ?? vs.find(v => v.lang.startsWith('fr')) ?? null; };
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }
  function say(text, { rate = 0.95, pitch = 1.05, interrupt = true } = {}) {
    if (!('speechSynthesis' in window) || SU.audio.muted) return false;
    if (interrupt) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; if (voice) u.voice = voice; u.rate = rate; u.pitch = pitch;
    speechSynthesis.speak(u); return true;
  }

  // ---- saved progress (localStorage, one JSON blob per key)
  const store = {
    get(key, def) { try { const v = localStorage.getItem('saddleup.' + key); return v == null ? def : JSON.parse(v); } catch { return def; } },
    set(key, val) { try { localStorage.setItem('saddleup.' + key, JSON.stringify(val)); } catch { /* private mode: progress just isn't kept */ } },
  };

  // ---- interactions: things you can do where you stand. The nearest eligible one shows as "F · label"; F (or a tap) does it.
  // add({ id, label, pos, radius = 2, modes = ['free','lead'], when, action, priority = 0 })
  //   pos: { x, z } or () => { x, z } | null     label: string or () => string     when: () => boolean (optional extra condition)
  //   modes: which of 'free' (on foot, hands empty), 'lead' (holding a horse), 'ride' it applies in
  const spots = [], hint = el('button'); hint.id = 'su-hint'; document.body.append(hint);
  let current = [];
  const pp = {};
  function scan() {
    const P = SU.player; current = [];
    if (!P || SU.modal > 0 || !['free', 'lead', 'ride'].includes(P.mode)) { hint.classList.remove('show'); return; }
    SU.personPos(pp);
    for (const s of spots) {
      if (!s.modes.includes(P.mode)) continue;
      const p = typeof s.pos === 'function' ? s.pos() : s.pos; if (!p) continue;
      const d = Math.hypot(p.x - pp.x, p.z - pp.z); if (d > s.radius) continue;
      if (s.when && !s.when()) continue;
      current.push({ s, d: d - s.priority * 100 });
    }
    current.sort((a, b) => a.d - b.d);
    if (!current.length) { hint.classList.remove('show'); return; }
    const lbl = (s) => typeof s.label === 'function' ? s.label() : s.label;
    hint.innerHTML = `<kbd>F</kbd> ${lbl(current[0].s)}${current.length > 1 ? ` <span style="opacity:.7">(+${current.length - 1})</span>` : ''}`;
    hint.classList.add('show');
  }
  function trigger() {
    if (!current.length) return false;
    const lbl = (s) => typeof s.label === 'function' ? s.label() : s.label;
    if (current.length === 1) current[0].s.action();
    else menu('Que veux-tu faire ?', current.map(c => ({ label: lbl(c.s), icon: c.s.icon, action: () => c.s.action() })));
    return true;
  }
  hint.addEventListener('click', (e) => { trigger(); hint.blur(); });
  SU.keyHooks.push((k) => (k === 'f' || k === 'F') ? trigger() : false);
  SU.onUpdate(scan, { hz: 8 });
  const interact = {
    add(s) { const spot = { radius: 2, modes: ['free', 'lead'], priority: 0, ...s }; spots.push(spot); return spot; },
    remove(spot) { const i = spots.indexOf(spot); if (i >= 0) spots.splice(i, 1); },
    get current() { return current.map(c => c.s); }, scan, trigger,
  };

  // ---- a button in the top-right bar for things that should be reachable from anywhere (e.g. the Galop 1 trainer)
  function topButton(label, title, action) {
    const b = el('button', null, label); b.title = title; b.addEventListener('click', (e) => { action(); b.blur(); });
    document.getElementById('env').prepend(b); return b;
  }

  SU.ui = { panel, menu, say, el, topButton };
  SU.store = store;
  SU.interact = interact;
}
