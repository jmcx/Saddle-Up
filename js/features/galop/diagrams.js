// Galop 1 picture exercises: the data (parts, coats, markings) and the pictures themselves.
// Horse pictures are rendered once, lazily, from the game's own 3D horse (SU.buildHorse) in a private scene, straight into the
// game's canvas (so they get the same tone mapping), and copied out to JPEG data URLs; the hoof is a clean SVG schematic.
// Anchors are named points on the rig, projected to the picture so the numbered dots sit exactly on the part.

// ---- the parts. at: [group, x, y, z] in that group's local space (x < 0 is the side facing the camera: the horse's right).
// groups: body, neck, head, jaw, ear (near ear pivot), tail<i>, <leg>.<root|joint|knee|fet|hoof> with leg = RF RH (near side)
// off: where the number badge sits relative to the dot, as a fraction of the picture width/height
const BODY = [
  { id: 'tete', name: 'la tête', at: ['head', -0.1, -0.02, 0.3], off: [0.05, 0.07], why: 'La tête, avec les oreilles, les yeux et les naseaux.' },
  { id: 'nuque', name: 'la nuque', at: ['head', 0, 0.075, -0.07], off: [0.01, -0.09], why: 'La nuque est en haut, juste derrière les oreilles.' },
  { id: 'criniere', name: 'la crinière', at: ['neck', -0.12, 0.42, 0.25], off: [-0.05, -0.08], why: 'La crinière, ce sont les longs crins sur le dessus de l’encolure.' },
  { id: 'encolure', name: 'l’encolure', at: ['neck', -0.15, 0.2, 0.22], off: [-0.08, 0.04], why: 'L’encolure, c’est le cou du cheval, entre la tête et le corps.' },
  { id: 'garrot', name: 'le garrot', at: ['body', 0, 1.585, 0.36], off: [-0.01, -0.1], why: 'Le garrot est la bosse en haut, là où l’encolure rejoint le dos. On mesure la taille du cheval au garrot.' },
  { id: 'dos', name: 'le dos', at: ['body', 0, 1.475, 0.08], off: [0, -0.1], why: 'Le dos est derrière le garrot : c’est là qu’on pose la selle.' },
  { id: 'rein', name: 'le rein', at: ['body', 0, 1.52, -0.33], off: [0, -0.1], why: 'Le rein est entre le dos et la croupe.' },
  { id: 'croupe', name: 'la croupe', at: ['body', 0, 1.55, -0.68], off: [0, -0.1], why: 'La croupe est le haut de l’arrière du cheval, devant la queue.' },
  { id: 'queue', name: 'la queue', at: ['tail4', 0, 0, 0], off: [-0.07, 0], why: 'La queue sert au cheval à chasser les mouches.' },
  { id: 'hanche', name: 'la hanche', at: ['body', -0.27, 1.42, -0.52], off: [0.02, -0.06], why: 'La hanche est l’os qui dépasse de chaque côté, devant la croupe.' },
  { id: 'cotes', name: 'les côtes', at: ['body', -0.33, 1.15, 0.0], off: [0.0, 0.0], why: 'Les côtes forment les flancs du cheval, sur les côtés du ventre.' },
  { id: 'ventre', name: 'le ventre', at: ['body', -0.18, 0.9, -0.2], off: [0, 0.09], why: 'Le ventre est le dessous du corps, entre les membres.' },
  { id: 'sangle', name: 'le passage de sangle', at: ['body', -0.12, 0.89, 0.3], off: [0.0, 0.1], why: 'Le passage de sangle est juste derrière les antérieurs : c’est là que passe la sangle de la selle.' },
  { id: 'epaule', name: 'l’épaule', at: ['body', -0.25, 1.27, 0.55], off: [0.0, 0.0], why: 'L’épaule est en haut de l’antérieur, sous le garrot.' },
  { id: 'poitrail', name: 'le poitrail', at: ['body', -0.08, 1.12, 0.84], off: [0.08, 0.02], why: 'Le poitrail est le devant de la poitrine, entre les deux antérieurs.' },
  { id: 'anterieur', name: 'l’antérieur', at: ['RF.joint', -0.05, -0.2, 0.0], off: [0.08, 0], why: 'Les antérieurs sont les membres de devant.' },
  { id: 'posterieur', name: 'le postérieur', at: ['RH.joint', -0.06, -0.15, -0.02], off: [-0.08, 0], why: 'Les postérieurs sont les membres de derrière.' },
];
const LEGS = [
  { id: 'genou', name: 'le genou', at: ['RF.knee', -0.03, 0.0, 0.045], off: [0.09, 0], why: 'Le genou est au milieu de l’antérieur.' },
  { id: 'canon', name: 'le canon', at: ['RF.knee', -0.03, -0.16, 0.03], off: [0.09, 0], why: 'Le canon est l’os droit entre le genou (ou le jarret) et le boulet.' },
  { id: 'boulet', name: 'le boulet', at: ['RF.fet', -0.03, 0.0, -0.035], off: [-0.09, 0], why: 'Le boulet est l’articulation ronde au-dessus du paturon.' },
  { id: 'paturon', name: 'le paturon', at: ['RF.fet', -0.03, -0.07, 0.0], off: [0.09, 0], why: 'Le paturon est entre le boulet et le sabot.' },
  { id: 'sabot', name: 'le sabot', at: ['RF.hoof', -0.05, -0.04, 0.03], off: [0.09, 0.02], why: 'Le sabot est le pied du cheval. Il est en corne.' },
  { id: 'jarret', name: 'le jarret', at: ['RH.knee', -0.03, 0.03, -0.05], off: [-0.09, 0], why: 'Le jarret est l’articulation du milieu du postérieur, qui pointe vers l’arrière.' },
  { id: 'anterieur', name: 'l’antérieur', at: ['RF.joint', -0.05, -0.18, 0.02], off: [0.09, 0], why: 'Les antérieurs sont les membres de devant.' },
  { id: 'posterieur', name: 'le postérieur', at: ['RH.joint', -0.06, -0.15, -0.02], off: [-0.09, 0], why: 'Les postérieurs sont les membres de derrière.' },
];
const HEAD = [
  { id: 'oreille', name: 'l’oreille', at: ['ear', 0, 0.1, 0], off: [-0.08, -0.05], why: 'Les oreilles bougent pour écouter : elles montrent aussi l’humeur du cheval.' },
  { id: 'nuque', name: 'la nuque', at: ['head', 0, 0.06, -0.06], off: [-0.1, 0.02], why: 'La nuque est en haut, juste derrière les oreilles.' },
  { id: 'toupet', name: 'le toupet', at: ['head', -0.02, 0.085, 0.05], off: [0.02, -0.1], why: 'Le toupet, ce sont les crins qui tombent sur le front.' },
  { id: 'front', name: 'le front', at: ['head', -0.03, 0.08, 0.15], off: [0.06, -0.08], why: 'Le front est entre les yeux, sous le toupet.' },
  { id: 'oeil', name: 'l’œil', at: ['head', -0.09, 0.035, 0.14], off: [-0.04, -0.09], why: 'Le cheval a les yeux sur les côtés de la tête : il voit presque tout autour de lui.' },
  { id: 'chanfrein', name: 'le chanfrein', at: ['head', -0.03, 0.07, 0.33], off: [0.07, -0.07], why: 'Le chanfrein est le devant de la tête, entre les yeux et les naseaux.' },
  { id: 'naseau', name: 'le naseau', at: ['head', -0.05, 0.005, 0.59], off: [0.09, -0.02], why: 'Les naseaux servent à respirer et à sentir.' },
  { id: 'bouche', name: 'la bouche', at: ['head', -0.055, -0.045, 0.55], off: [0.09, 0.05], why: 'La bouche, avec les lèvres. Le mors du filet se place dans la bouche.' },
  { id: 'menton', name: 'le menton', at: ['jaw', -0.02, -0.04, 0.29], off: [0.05, 0.09], why: 'Le menton est sous la lèvre du bas.' },
  { id: 'joue', name: 'la joue', at: ['head', -0.1, 0.0, 0.25], off: [-0.01, 0.1], why: 'La joue est sur le côté de la tête, sous l’œil.' },
  { id: 'ganache', name: 'la ganache', at: ['head', -0.08, -0.105, 0.17], off: [-0.09, 0.05], why: 'La ganache est le bord arrondi de la mâchoire, en bas et à l’arrière de la tête.' },
];

// ---- hoof schematics (SVG, viewBox 0 0 600 400). at: [x, y] as fractions of the picture
const HOOF_SIDE_SVG = `<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="400" fill="#f4ecd9"/>
  <path d="M40 352 H560" stroke="#c9b896" stroke-width="4" stroke-linecap="round"/>
  <!-- pastern, at the same slope as the front of the hoof -->
  <path d="M262 150 L 356 6 L 548 6 C 520 80 492 170 470 252 Z" fill="#7a4a2a"/>
  <path d="M300 120 L 372 10" stroke="#93603c" stroke-width="8" stroke-linecap="round" opacity=".7"/>
  <!-- hoof wall: toe at the front (left), short heel at the back (right) -->
  <path d="M270 150 Q 370 172 466 258 L 482 350 L 126 350 Z" fill="#3b3029"/>
  <g stroke="#5a4b40" stroke-width="2.5" opacity=".85" fill="none">
    <path d="M300 156 L 180 346"/><path d="M335 166 L 238 347"/><path d="M370 182 L 298 348"/><path d="M405 203 L 360 348"/><path d="M438 228 L 422 348"/>
  </g>
  <!-- coronet: the band of skin and hair just above the horn -->
  <path d="M258 138 Q 372 160 474 248 L 466 266 Q 370 180 270 158 Z" fill="#a86f45"/>
  <path d="M126 350 L 482 350" stroke="#22190f" stroke-width="6" stroke-linecap="round"/>
  <text x="300" y="390" font-family="sans-serif" font-size="20" fill="#8a7a5a" text-anchor="middle">← devant · derrière →</text>
</svg>`;
const HOOF_SOLE_SVG = `<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="400" fill="#f4ecd9"/>
  <!-- wall: a rounded U, toe at the top, heels at the bottom -->
  <path d="M300 28 C 420 28 486 120 482 220 C 479 300 452 352 410 372 L 370 372 C 392 330 404 280 400 230 C 396 140 360 92 300 92 C 240 92 204 140 200 230 C 196 280 208 330 230 372 L 190 372 C 148 352 121 300 118 220 C 114 120 180 28 300 28 Z" fill="#3b3029"/>
  <!-- white line -->
  <path d="M300 54 C 404 54 460 132 456 222 C 453 290 432 336 400 360 M300 54 C 196 54 140 132 144 222 C 147 290 168 336 200 360" stroke="#d8c7a0" stroke-width="5" fill="none" opacity=".75"/>
  <!-- sole -->
  <path d="M300 62 C 398 62 450 138 446 222 C 443 286 424 330 396 356 L 372 356 C 390 322 398 280 394 236 C 390 150 360 100 300 100 C 240 100 210 150 206 236 C 202 280 210 322 228 356 L 204 356 C 176 330 157 286 154 222 C 150 138 202 62 300 62 Z" fill="#c9b48a"/>
  <path d="M300 100 C 360 100 390 150 394 236 C 398 280 390 322 372 356 L 228 356 C 210 322 202 280 206 236 C 210 150 240 100 300 100 Z" fill="#c9b48a"/>
  <!-- frog -->
  <path d="M300 130 C 318 180 352 270 360 350 C 340 362 318 352 300 336 C 282 352 260 362 240 350 C 248 270 282 180 300 130 Z" fill="#8d6a4d"/>
  <!-- grooves: the two side ones along the frog, and the middle one -->
  <path d="M296 140 C 274 200 246 280 236 350" stroke="#4a3426" stroke-width="9" fill="none" stroke-linecap="round"/>
  <path d="M304 140 C 326 200 354 280 364 350" stroke="#4a3426" stroke-width="9" fill="none" stroke-linecap="round"/>
  <path d="M300 250 C 298 290 300 316 300 334" stroke="#4a3426" stroke-width="8" fill="none" stroke-linecap="round"/>
  <text x="300" y="20" font-family="sans-serif" font-size="16" fill="#8a7a5a" text-anchor="middle">devant</text>
  <text x="300" y="394" font-family="sans-serif" font-size="16" fill="#8a7a5a" text-anchor="middle">derrière</text>
</svg>`;
const HOOF_SIDE = [
  { id: 'couronne', name: 'la couronne', at: [0.62, 0.462], off: [0.12, -0.1], why: 'La couronne est le haut du sabot, là où poussent les poils. La corne pousse à partir de la couronne.' },
  { id: 'paroi', name: 'la paroi', at: [0.53, 0.7], off: [0.0, 0.0], why: 'La paroi (ou muraille) est la partie du sabot qu’on voit quand le cheval est debout. On y cloue le fer.' },
  { id: 'pince', name: 'la pince', at: [0.26, 0.76], off: [-0.12, -0.05], why: 'La pince est le devant du sabot.' },
  { id: 'talon', name: 'le talon', at: [0.785, 0.78], off: [0.11, -0.04], why: 'Les talons sont à l’arrière du sabot.' },
];
const HOOF_SOLE = [
  { id: 'paroi', name: 'la paroi', at: [0.222, 0.4], off: [-0.1, 0], why: 'La paroi (ou muraille) fait le tour du sabot. C’est elle qui porte le fer.' },
  { id: 'pince', name: 'la pince', at: [0.5, 0.11], off: [0.16, -0.02], why: 'La pince est le devant du sabot.' },
  { id: 'sole', name: 'la sole', at: [0.375, 0.37], off: [0.0, 0.0], why: 'La sole est le dessous du sabot, autour de la fourchette.' },
  { id: 'fourchette', name: 'la fourchette', at: [0.5, 0.5], off: [0.0, 0.0], why: 'La fourchette est le triangle souple au milieu du dessous du sabot. Elle amortit les chocs.' },
  { id: 'lacunes', name: 'les lacunes', at: [0.425, 0.68], off: [-0.1, 0.06], why: 'Les lacunes sont les creux de chaque côté de la fourchette et au milieu. On les nettoie bien avec le cure-pied.' },
  { id: 'talons', name: 'les talons', at: [0.355, 0.9], off: [-0.12, 0.0], why: 'Les talons sont à l’arrière du sabot.' },
];

// ---- coats, face markings and leg markings (built on the game's thoroughbred)
const BAI = { coat: 0x7a4122, top: 0.22, points: 0x1c1511, hair: 0x17110d, muzzle: 0x2e211a, hoof: 0x2c2520, sheen: 0xb98058 };
const ALEZAN = { coat: 0xa4552a, top: 0.18, points: 0x9a4e26, hair: 0xa65a2c, muzzle: 0x4a2c1e, hoof: 0x3a3028, sheen: 0xd99a60 };
const ROBES = [
  { id: 'bai', name: 'bai', pick: 'Montre le cheval bai.', B: BAI, why: 'Bai : le corps est marron, et les crins (crinière et queue) et le bas des membres sont noirs.' },
  { id: 'alezan', name: 'alezan', pick: 'Montre le cheval alezan.', B: ALEZAN, why: 'Alezan : tout le cheval est roux, crins compris. Pas de noir !' },
  { id: 'noir', name: 'noir', pick: 'Montre le cheval noir.', B: { coat: 0x1a1512, top: 0.08, points: 0x14100d, hair: 0x0e0b09, muzzle: 0x120e0c, hoof: 0x1e1a17, sheen: 0x77737c }, why: 'Noir : le corps et les crins sont tout noirs.' },
  { id: 'gris', name: 'gris', pick: 'Montre le cheval gris.', B: { coat: 0xc7c5c0, top: 0.1, points: 0x8d8a86, hair: 0xe2dfd8, muzzle: 0x3a3532, hoof: 0x4a443e, sheen: 0xf0f0f4, pattern: 'dapple' }, why: 'Gris : des poils blancs mélangés à des poils foncés. Un cheval gris devient de plus en plus blanc en vieillissant.' },
  { id: 'pie', name: 'pie', pick: 'Montre le cheval pie.', B: { coat: 0x221a16, top: 0.08, points: 0xe8e2d6, hair: 0x1a1512, muzzle: 0x2a211c, hoof: 0x6b6158, sheen: 0x8a8078, pattern: 'pinto', socks: [true, true, true, true] }, why: 'Pie : de grandes taches blanches sur une robe de couleur (ici pie noir).' },
  { id: 'isabelle', name: 'isabelle', pick: 'Montre le cheval isabelle.', B: { coat: 0xc9a466, top: 0.16, points: 0x1c1511, hair: 0x17110d, muzzle: 0x2e211a, hoof: 0x2c2520, sheen: 0xe8cc96 }, why: 'Isabelle : le corps est jaune sable, et les crins et le bas des membres sont noirs.' },
  { id: 'palomino', name: 'palomino', pick: 'Montre le cheval palomino.', B: { coat: 0xd29d4c, top: 0.14, points: 0xc8913f, hair: 0xf1e7cf, muzzle: 0x4a3426, hoof: 0x4a3e33, sheen: 0xf0d090 }, why: 'Palomino : le corps est doré, et la crinière et la queue sont blanches ou très claires.' },
];
const MARQUES = [
  { id: 'entete', name: 'en tête', pick: 'Montre le cheval qui a une marque « en tête ».', paint: 'star', why: 'En tête : une petite tache blanche sur le front.' },
  { id: 'liste', name: 'la liste', pick: 'Montre la liste.', paint: 'stripe', why: 'La liste : une bande blanche qui descend le long du chanfrein.' },
  { id: 'belleface', name: 'la belle face', pick: 'Montre la belle face.', paint: 'face', why: 'La belle face : une large marque blanche qui couvre le front et le chanfrein.' },
  { id: 'ladre', name: 'le ladre', pick: 'Montre le ladre.', paint: 'ladre', why: 'Le ladre : de la peau rose, sans poils foncés, souvent entre les naseaux ou sur les lèvres.' },
];
// white leg markings, by where the white stops on the leg
const BALZANES = [
  { id: 'trace', name: 'la trace de balzane', pick: 'Montre la trace de balzane.', sock: 'trace', why: 'Trace de balzane : juste un peu de blanc autour de la couronne, en haut du sabot.' },
  { id: 'petite', name: 'la petite balzane', pick: 'Montre la petite balzane.', sock: 'petite', why: 'Petite balzane : le blanc monte jusqu’au boulet, pas plus haut.' },
  { id: 'balzane', name: 'la balzane', pick: 'Montre la balzane qui monte à mi-canon.', sock: 'mi', why: 'Balzane : le blanc monte jusqu’au milieu du canon.' },
  { id: 'grande', name: 'la grande balzane', pick: 'Montre la grande balzane.', sock: 'grande', why: 'Grande balzane : le blanc monte jusque sous le genou (ou le jarret).' },
  { id: 'haut', name: 'la balzane haut-chaussée', pick: 'Montre la balzane haut-chaussée.', sock: 'haut', why: 'Balzane haut-chaussée : le blanc monte plus haut que le genou (ou le jarret).' },
];

// kind 'labels': one picture with numbered parts. kind 'gallery': one picture per item.
export const DIAGRAMS = [
  { id: 'corps', title: 'Les parties du corps', icon: '🐴', kind: 'labels', view: 'side', B: BAI, parts: BODY },
  { id: 'membres', title: 'Les membres', icon: '🦵', kind: 'labels', view: 'legs', B: { ...ALEZAN, points: 0x7c3c1c }, parts: LEGS },
  { id: 'tete', title: 'La tête', icon: '🙂', kind: 'labels', view: 'head', B: ALEZAN, parts: HEAD },
  { id: 'sabot', title: 'Le sabot (de côté)', icon: '🦶', kind: 'labels', svg: HOOF_SIDE_SVG, parts: HOOF_SIDE },
  { id: 'dessous', title: 'Le dessous du pied', icon: '🔍', kind: 'labels', svg: HOOF_SOLE_SVG, parts: HOOF_SOLE },
  { id: 'robes', title: 'Les robes', icon: '🎨', kind: 'gallery', view: 'robe', items: ROBES, q: 'Quelle est la robe de ce cheval ?', cap: (s) => s[0].toUpperCase() + s.slice(1) },
  { id: 'marques', title: 'Les marques en tête', icon: '⭐', kind: 'gallery', view: 'face', B: ALEZAN, items: MARQUES, q: 'Comment s’appelle cette marque ?' },
  { id: 'balzanes', title: 'Les balzanes', icon: '🧦', kind: 'gallery', view: 'sock', B: BAI, items: BALZANES, q: 'Comment s’appelle cette balzane ?' },
];

// ---------------------------------------------------------------- rendering
const BG = 0xf4ecd9;
let cache = null;
export const pictures = () => cache;

// Builds every picture once and resolves to
// { [diagramId]: { url, ar, pts: { partId: [fx, fy] } } | { items: { itemId: url }, ar }, ms, maxStepMs }.
// Each picture is made synchronously in one go (between two game frames, renderer state restored after it), and the
// build yields to the browser between pictures so the page never freezes for long. onProgress(done, total) is optional.
let building = null;
export function buildPictures(SU, onProgress) {
  if (cache) return Promise.resolve(cache);
  return building ??= build(SU, onProgress).finally(() => { building = null; });
}
async function build(SU, onProgress) {
  const T = SU.THREE, r = SU.renderer, cvs = r.domElement;
  const t0 = performance.now();
  const scene = new T.Scene(); scene.background = new T.Color(BG);
  const hemi = new T.HemisphereLight(0xfff8ec, 0x8a7458, 1.5);
  const key = new T.DirectionalLight(0xfff1dd, 2.6); key.position.set(-4, 7, 3);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 0.5, far: 20 });
  const fill = new T.DirectionalLight(0xe6eeff, 0.7); fill.position.set(5, 3, -4);
  scene.add(hemi, key, key.target, fill);
  const ground = new T.Mesh(new T.CircleGeometry(3.2, 48).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);
  const cam = new T.PerspectiveCamera(26, 1, 0.05, 50);
  const out = {}, v = new T.Vector3(), w = new T.Vector3();
  // render the scene at W x H physical pixels (or as large as the canvas allows) and return a JPEG data URL.
  // Everything touched on the renderer is put back before returning.
  const snap = (W, H) => {
    const saved = { rt: r.getRenderTarget(), vp: r.getViewport(new T.Vector4()), sc: r.getScissor(new T.Vector4()), st: r.getScissorTest(),
      cc: r.getClearColor(new T.Color()), ca: r.getClearAlpha(), exp: r.toneMappingExposure, au: r.shadowMap.autoUpdate, nu: r.shadowMap.needsUpdate, ac: r.autoClear };
    try {
      r.setRenderTarget(null); r.setScissorTest(true); r.toneMappingExposure = 1; r.autoClear = true; r.shadowMap.autoUpdate = true;
      const k = Math.min(1, cvs.width / W, cvs.height / H), pw = Math.floor(W * k), ph = Math.floor(H * k), pr = r.getPixelRatio();
      cam.aspect = W / H; cam.updateProjectionMatrix();
      r.setViewport(0, 0, pw / pr, ph / pr); r.setScissor(0, 0, pw / pr, ph / pr);
      r.render(scene, cam);
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      c.getContext('2d').drawImage(cvs, 0, cvs.height - ph, pw, ph, 0, 0, pw, ph);
      return c.toDataURL('image/jpeg', 0.9);
    } finally {
      r.setRenderTarget(saved.rt); r.setViewport(saved.vp); r.setScissor(saved.sc); r.setScissorTest(saved.st);
      r.setClearColor(saved.cc, saved.ca); r.toneMappingExposure = saved.exp; r.shadowMap.autoUpdate = saved.au; r.shadowMap.needsUpdate = saved.nu; r.autoClear = saved.ac;
    }
  };
  const proj = (p) => { v.copy(p).project(cam); return [+((v.x + 1) / 2).toFixed(4), +((1 - v.y) / 2).toFixed(4)]; };
  // one job per picture
  const jobs = [];
  for (const d of DIAGRAMS) {
    if (d.svg) { out[d.id] = { url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(d.svg), ar: 1.5, pts: Object.fromEntries(d.parts.map(p => [p.id, p.at])) }; continue; }
    if (d.kind === 'labels') jobs.push(() => {
      const R = makeHorse(SU, d.B);
      scene.add(R.root); ground.visible = true; frame(SU, R, d.view, cam);
      const W = d.view === 'head' ? 900 : 1080, H = d.view === 'head' ? 760 : 720;
      cam.aspect = W / H; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      const pts = {};
      for (const p of d.parts) pts[p.id] = proj(anchor(R, p.at, w));
      out[d.id] = { url: snap(W, H), ar: W / H, pts };
      scene.remove(R.root); disposeHorse(R);
    });
    else {
      const W = d.view === 'robe' ? 720 : 480, H = d.view === 'robe' ? 480 : 560, o = out[d.id] = { items: {}, ar: W / H };
      for (const it of d.items) jobs.push(() => {
        const R = makeHorse(SU, { ...(d.B ?? {}), ...(it.B ?? {}) });
        if (it.paint) paintHead(SU, R, it.paint);
        scene.add(R.root); frame(SU, R, d.view, cam); ground.visible = d.view !== 'face';
        if (it.sock) paintSock(SU, R, it.sock);
        o.items[it.id] = snap(W, H);
        scene.remove(R.root); disposeHorse(R);
      });
    }
  }
  let maxStep = 0;
  try {
    for (let i = 0; i < jobs.length; i++) {
      const s0 = performance.now(); jobs[i](); maxStep = Math.max(maxStep, performance.now() - s0);
      onProgress?.(i + 1, jobs.length);
      await new Promise(res => setTimeout(res, 0));
    }
  } finally {
    ground.geometry.dispose(); ground.material.dispose(); key.dispose(); fill.dispose(); hemi.dispose();
  }
  cache = out; cache.ms = Math.round(performance.now() - t0); cache.maxStepMs = Math.round(maxStep);
  return cache;
}

// a horse standing square, at the origin, facing +z, with the game's thoroughbred proportions and the given colours
function makeHorse(SU, colours) {
  const B = { ...SU.BREEDS[0], blaze: null, socks: [false, false, false, false], pattern: null, mane: 'thick', maneL: 1.25, forelock: 1.3, ...colours };
  const R = SU.buildHorse(B, { tack: false });
  // the ears share the vertex-coloured coat material but have no vertex colours (they render black): give them a plain coat colour
  const earMat = new SU.THREE.MeshPhysicalMaterial({ color: new SU.THREE.Color(B.coat).multiplyScalar(0.85), roughness: 0.55, sheen: 0.6, sheenColor: new SU.THREE.Color(B.sheen) });
  R.mats.push(earMat);
  for (const e of R.ears) e.children.forEach(m => { if (m.material === R.mats[0]) m.material = earMat; });
  const Y = SU.world.places.yard, x = (Y.minX + Y.maxX) / 2, z = (Y.minZ + Y.maxZ) / 2;   // a flat spot, only for the ground-following
  const s = SU.newRigState(x, z, 0), ctl = { target: 0, turnIn: 0, player: false, vol: 0 };
  for (let i = 0; i < 40; i++) SU.updateRig(R, s, ctl, 1 / 60, 10 + i / 60);
  for (const e of R.ears) { e.rotation.x = e.userData.base; e.rotation.z = 0; }
  R.root.position.set(0, R.root.position.y - s.rootY, 0); R.root.rotation.set(0, 0, 0);
  R.root.updateMatrixWorld(true);
  return R;
}
function disposeHorse(R) {
  R.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  for (const m of R.mats) m.dispose();
  for (const e of R.extras) { e.parent?.remove(e); }
}
const LEG = { RF: 1, RH: 3, LF: 0, LH: 2 };
function group(R, name) {
  if (name === 'ear') return R.ears.find(e => e.userData.sx < 0);
  if (name.startsWith('tail')) return R.tailSegs[+name.slice(4)];
  const [leg, part] = name.split('.');
  if (part) return R.legs[LEG[leg]][part];
  return R[name];
}
function anchor(R, at, out) { return group(R, at[0]).localToWorld(out.set(at[1], at[2], at[3])); }

// camera placement per view; the horse's right side faces the camera (-x), so the head is on the right of the picture
function frame(SU, R, view, cam) {
  const T = SU.THREE, S = R.B.S, c = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  if (view === 'robe') { c.set(0, 1.0 * S, 0.12); cam.fov = 26; cam.position.set(-5.1 * S, 1.3 * S, 0.12); }
  else if (view === 'side') { c.set(0, 1.05 * S, 0.05); cam.fov = 26; cam.position.set(-5.8 * S, 1.4 * S, 0.05); }
  else if (view === 'legs') { c.set(0, 0.6 * S, -0.1); cam.fov = 26; cam.position.set(-5.6 * S, 0.9 * S, -0.1); }
  else if (view === 'head') {
    R.head.localToWorld(c.set(0, -0.01, 0.27));
    const p = R.head.localToWorld(new T.Vector3(-1.9, 0.25, 0.42));
    cam.fov = 26; cam.position.copy(p);
  } else if (view === 'face') {
    R.head.localToWorld(c.set(0, 0, 0.28));
    cam.position.copy(R.head.localToWorld(new T.Vector3(0, 2.1, 0.45)));
    const a = R.head.localToWorld(new T.Vector3(0, 0, -1)).sub(R.head.localToWorld(new T.Vector3(0, 0, 0))).normalize();
    up.copy(a);
    cam.fov = 24;
  } else if (view === 'sock') { c.set(0, 0.5 * S, 0.45); cam.fov = 24; cam.position.set(-3.4 * S, 0.7 * S, 0.9); }
  cam.up.copy(up); cam.lookAt(c); cam.updateMatrixWorld();
}

// ---- markings, painted onto the vertex colours after the horse is built
const smooth = (t) => (t = Math.max(0, Math.min(1, t)), t * t * (3 - 2 * t));
function paintGeo(SU, mesh, fn) {
  const g = mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal, col = g.attributes.color;
  if (!col) return;
  const c = new SU.THREE.Color(), p = new SU.THREE.Vector3(), n = new SU.THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nrm, i);
    c.fromBufferAttribute(col, i);
    if (fn(p, n, c, i)) col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}
function paintHead(SU, R, kind) {
  const white = new SU.THREE.Color(0xeee9de), pink = new SU.THREE.Color(0xd8a39a);
  const mask = {
    star: (p, n) => n.y > 0.3 ? 1 - smooth((Math.hypot(p.x, (p.z - 0.185) * 0.8) - 0.03) / 0.008) : 0,
    stripe: (p, n) => n.y > 0.25 ? (1 - smooth((Math.abs(p.x) - 0.016 - 0.012 * smooth((p.z - 0.3) / 0.3)) / 0.006)) * smooth((p.z - 0.07) / 0.03) * (1 - smooth((p.z - 0.56) / 0.03)) : 0,
    face: (p, n) => n.y > -0.15 ? (1 - smooth((Math.abs(p.x) - 0.05 - 0.012 * smooth((p.z - 0.3) / 0.3)) / 0.008)) * smooth((p.z + 0.02) / 0.04) : 0,
    ladre: () => 0,
  }[kind];
  const lad = (p) => (1 - smooth((Math.abs(p.x) - 0.04) / 0.012)) * smooth((p.z - 0.47) / 0.03);
  paintGeo(SU, R.head.children[0], (p, n, c) => {
    let changed = false;
    const m = mask(p, n); if (m > 0) { c.lerp(white, m); changed = true; }
    if (kind === 'ladre') { const l = lad(p); if (l > 0) { c.lerp(pink, l); changed = true; } }
    return changed;
  });
  if (kind === 'ladre') paintGeo(SU, R.jaw.children[0], (p, n, c) => { const l = smooth((p.z - 0.24) / 0.05) * (1 - smooth((Math.abs(p.x) - 0.03) / 0.015)); if (l > 0) { c.lerp(pink, l); return true; } return false; });
}
// white on the near front leg up to a height given by the leg's own joints (world space, the horse is posed)
function paintSock(SU, R, kind) {
  const T = SU.THREE, L = R.legs[LEG.RF], white = new T.Color(0xeee9de), wp = new T.Vector3();
  const y = (o, ly = 0) => o.localToWorld(wp.set(0, ly, 0)).y;
  const crown = y(L.hoof) + 0.005, fet = y(L.fet), knee = y(L.knee);
  const top = { trace: crown + 0.025, petite: fet + 0.012, mi: (fet + knee) / 2, grande: knee - 0.05, haut: knee + 0.12 }[kind];
  const soft = 0.012;
  for (const g of [L.fet, L.knee, L.joint]) {
    const mesh = g.children.find(o => o.isMesh && o.geometry.attributes.color); if (!mesh) continue;
    mesh.updateMatrixWorld();
    paintGeo(SU, mesh, (p, n, c) => {
      const wy = wp.copy(p).applyMatrix4(mesh.matrixWorld).y, m = 1 - smooth((wy - top) / soft);
      if (m <= 0) return false;
      c.lerp(white, m); return true;
    });
  }
}
