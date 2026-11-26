// care feature: a side-on picture of the actual horse being groomed, rendered once from its own breed config (coat, pattern,
// size, tack as it is now), plus the grooming zones projected from 3D anchor points on the rig into picture pixels.
// Same approach as js/features/galop/diagrams.js (private scene, the game's renderer and canvas, state restored afterwards).

const W = 840, H = 560, BG = 0xf1ead8;
const LEG = { LF: 0, RF: 1, LH: 2, RH: 3 };

// pts: [group, x, y, z] in that group's local space. The horse's right side (x < 0) faces the camera, head to the right.
function grp(R, name) { const [leg, part] = name.split('.'); return part ? R.legs[LEG[leg]][part] : R[name]; }

export function renderHorsePicture(SU, h, S, applyTack) {
  const T = SU.THREE, r = SU.renderer, cvs = r.domElement, t0 = performance.now();
  const B = h.B, Sz = B.S, bw = B.bodyW ?? 1;
  const R = SU.buildHorse(B, { tack: true });
  for (const e of R.extras) e.parent?.remove(e);                                      // reins live in the game scene: take them out at once
  // ears share the vertex-coloured coat material without vertex colours (they'd render black): give them a plain coat colour
  const earMat = new T.MeshPhysicalMaterial({ color: new T.Color(B.coat).multiplyScalar(0.85), roughness: 0.55, sheen: 0.6, sheenColor: new T.Color(B.sheen ?? B.coat) });
  R.mats.push(earMat);
  for (const e of R.ears) e.children.forEach(m => { if (m.material === R.mats[0]) m.material = earMat; });
  if (R.tack && R.tack.parts) { applyTack({ R }, S); for (const rr of R.tack.reins) for (const m of rr) m.visible = false; }
  const Y = SU.world.places.yard, fx = Y ? (Y.minX + Y.maxX) / 2 : 0, fz = Y ? (Y.minZ + Y.maxZ) / 2 : 0;
  const s = SU.newRigState(fx, fz, 0), ctl = { target: 0, turnIn: 0, player: false, vol: 0 };
  for (let i = 0; i < 30; i++) SU.updateRig(R, s, ctl, 1 / 60, 10 + i / 60);
  for (const e of R.ears) { e.rotation.x = e.userData.base; e.rotation.z = 0; }
  R.root.position.set(0, R.root.position.y - s.rootY, 0); R.root.rotation.set(0, 0, 0); R.root.updateMatrixWorld(true);

  const tBuilt = performance.now();
  const scene = new T.Scene(); scene.background = new T.Color(BG);
  const hemi = new T.HemisphereLight(0xfff8ec, 0x8a7458, 1.5);
  const key = new T.DirectionalLight(0xfff1dd, 2.6); key.position.set(-4, 7, 3);
  key.castShadow = true; key.shadow.mapSize.set(512, 512); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 0.5, far: 20 });
  const fill = new T.DirectionalLight(0xe6eeff, 0.7); fill.position.set(5, 3, -4);
  const ground = new T.Mesh(new T.CircleGeometry(3.2, 48).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ color: 0xe2d4b4, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(hemi, key, key.target, fill, ground, R.root);
  const cam = new T.PerspectiveCamera(26, W / H, 0.05, 50);
  cam.position.set(-5.4 * Sz, 1.3 * Sz, 0.0); cam.lookAt(0, 1.08 * Sz, 0.0); cam.updateMatrixWorld();

  const steps = [];
  let url = null, mask = null, pw = W, ph = H;
  const white = new T.MeshBasicMaterial({ color: 0xffffff });
  const saved = { rt: r.getRenderTarget(), vp: r.getViewport(new T.Vector4()), sc: r.getScissor(new T.Vector4()), st: r.getScissorTest(),
    cc: r.getClearColor(new T.Color()), ca: r.getClearAlpha(), exp: r.toneMappingExposure, au: r.shadowMap.autoUpdate, nu: r.shadowMap.needsUpdate, ac: r.autoClear };
  try {
    r.setRenderTarget(null); r.setScissorTest(true); r.toneMappingExposure = 1; r.autoClear = true; r.shadowMap.autoUpdate = true;
    const k = Math.min(1, cvs.width / W, cvs.height / H), pr = r.getPixelRatio(); pw = Math.floor(W * k); ph = Math.floor(H * k);
    r.setViewport(0, 0, pw / pr, ph / pr); r.setScissor(0, 0, pw / pr, ph / pr);
    r.render(scene, cam); const tR1 = performance.now();
    const c = document.createElement('canvas'); c.width = pw; c.height = ph;
    c.getContext('2d').drawImage(cvs, 0, cvs.height - ph, pw, ph, 0, 0, pw, ph);
    url = c.toDataURL('image/jpeg', 0.88); steps.push(Math.round(tBuilt - t0), Math.round(tR1 - tBuilt), Math.round(performance.now() - tR1));
    // second pass: the bare horse in white on black, a mask that keeps the dirt on the coat (not on the tack or the background)
    if (R.tack && R.tack.parts) for (const list of [...Object.values(R.tack.parts), R.tack.bits]) for (const m of list) m.visible = false;
    scene.overrideMaterial = white; scene.background = new T.Color(0x000000); ground.visible = false; key.castShadow = false;
    r.render(scene, cam);
    const mc = document.createElement('canvas'); mc.width = Math.round(pw / 2); mc.height = Math.round(ph / 2);
    mc.getContext('2d').drawImage(cvs, 0, cvs.height - ph, pw, ph, 0, 0, mc.width, mc.height);
    mask = mc.toDataURL('image/png');
    scene.overrideMaterial = null;
  } finally {
    r.setRenderTarget(saved.rt); r.setViewport(saved.vp); r.setScissor(saved.sc); r.setScissorTest(saved.st);
    r.setClearColor(saved.cc, saved.ca); r.toneMappingExposure = saved.exp; r.shadowMap.autoUpdate = saved.au; r.shadowMap.needsUpdate = saved.nu; r.autoClear = saved.ac;
  }

  // ---- zones, in picture pixels (W x H)
  const v = new T.Vector3();
  const P = (g, x, y, z) => { grp(R, g).localToWorld(v.set(x, y, z)); v.project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  const poly = (pts) => 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L') + ' Z';
  const ellipse = (zc, yc, rz, ry, n = 18) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push(P('body', -0.3 * bw, yc + ry * Math.sin(a), zc + rz * Math.cos(a))); } return poly(pts); };
  // a rounded band along a leg, from one joint to another, half width w (metres, before the horse's scale)
  const band = (leg, a, b, w) => {
    const A = P(`${leg}.${a}`, -0.02, 0, 0), Bp = P(`${leg}.${b}`, -0.02, 0, 0);
    const px = P(`${leg}.${a}`, -0.02 + w, 0, 0), wp = Math.max(6, Math.hypot(px[0] - A[0], px[1] - A[1]));
    const dx = Bp[0] - A[0], dy = Bp[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * wp, ny = dx / L * wp;
    return poly([[A[0] + nx, A[1] + ny], [Bp[0] + nx, Bp[1] + ny + wp * 0.4], [Bp[0] - nx, Bp[1] - ny + wp * 0.4], [A[0] - nx, A[1] - ny]]);
  };
  const hoof = (leg) => { const c = P(`${leg}.hoof`, -0.03, -0.04, 0.012), e = P(`${leg}.hoof`, -0.03, -0.04, 0.1); const rx = Math.max(10, Math.abs(e[0] - c[0]) * 1.1), ry = rx * 0.75;
    return `M${(c[0] - rx).toFixed(1)},${c[1].toFixed(1)} a${rx.toFixed(1)},${ry.toFixed(1)} 0 1,0 ${(2 * rx).toFixed(1)},0 a${rx.toFixed(1)},${ry.toFixed(1)} 0 1,0 ${(-2 * rx).toFixed(1)},0`; };
  const zones = {
    croupe: ellipse(-0.64, 1.28, 0.3, 0.26),
    dos: ellipse(-0.1, 1.2, 0.26, 0.3),
    epaule: ellipse(0.5, 1.22, 0.22, 0.28),
    encolure: poly([P('body', 0, 1.5, 0.34), P('neck', -0.1, 0.42, 0.3), P('head', -0.05, 0.08, -0.08), P('head', -0.08, -0.1, 0.1), P('body', -0.1, 1.05, 0.8), P('body', -0.2, 1.25, 0.62)]),
    tete: poly([P('head', -0.03, 0.095, -0.07), P('head', -0.04, 0.085, 0.16), P('head', -0.04, 0.07, 0.34), P('head', -0.06, 0.02, 0.62), P('head', -0.06, -0.07, 0.6),
      P('jaw', -0.03, -0.05, 0.3), P('head', -0.09, -0.12, 0.14), P('head', -0.07, -0.05, -0.05)]),
    avant: band('RF', 'joint', 'fet', 0.07) + ' ' + band('LF', 'joint', 'fet', 0.07),
    arriere: band('RH', 'joint', 'fet', 0.075) + ' ' + band('LH', 'joint', 'fet', 0.075),
    pAv: hoof('RF') + ' ' + hoof('LF'),
    pAr: hoof('RH') + ' ' + hoof('LH'),
  };
  const headPt = P('head', 0, 0.12, 0.12);

  // dispose of everything we made
  scene.remove(R.root);
  R.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  for (const e of R.extras) e.geometry?.dispose();
  for (const m of R.mats) m.dispose();
  ground.geometry.dispose(); ground.material.dispose(); white.dispose(); key.dispose(); fill.dispose(); hemi.dispose(); key.shadow.map?.dispose();
  return { url, mask, W, H, zones, headPt, ms: Math.round(performance.now() - t0), steps };
}
