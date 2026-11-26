// perf feature: keeps the game smooth on any device, without changing how it looks on a capable one.
//
// 1. Rig batching. A horse is ~45-80 small meshes (body parts, tack), so each one cost 45-80 draw calls in the view and as many
//    again in the shadow pass; the yard (five horses in boxes, three in the meadow) was mostly horses. batchRig(R) merges a rig's
//    meshes into one SkinnedMesh per material, where each part is a "bone" that is simply the original mesh's world matrix: the
//    original objects keep animating exactly as before (updateRig, features toggling .visible, recolouring materials), they are
//    only moved to a layer the camera doesn't draw. A hidden part gets a zero matrix; a part whose material is swapped falls back
//    to drawing itself. ~65% fewer draw calls per horse.
// 2. Adaptive quality governor. Measures real frame times and steers one quality level: first the render resolution, then
//    grass density, then the shadow map, then the animation rate of far horses. Level 0 is full quality (what you get on any
//    machine that keeps up); it only steps down when frames are consistently late, and probes back up after sustained headroom.
//    SU.perf = { level, fps, set(level | 'auto'), batchRig(R) }. Add ?fps to the URL to see a small readout.
const LAYER_HIDDEN = 31;            // the camera never enables it: batched originals live here

export function init(SU) {
  const { THREE, renderer, scene, gfx } = SU;

  // ------------------------------------------------------------------ rig batching
  const batches = [];               // { root, parts: Mesh[], mesh: SkinnedMesh, mat }
  const ZERO = new Float32Array(16);
  function visibleInScene(o) { for (let p = o; p; p = p.parent) { if (!p.visible) return false; if (p.isScene) return true; } return false; }
  // a part must stay under its rig (or be one of the rig's world-space extras, like the reins); one that moved elsewhere draws itself
  function stillOwned(o, root) { for (let p = o.parent; p; p = p.parent) if (p === root) return true; return false; }
  function batchRig(R) {
    const root = R.root ?? R;
    if (root.userData.batched) return;
    root.userData.batched = true;
    root.updateMatrixWorld(true);
    const groups = new Map(), extras = new Set(R.extras ?? []), rider = SU.player?.group;
    const add = (o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.material.transparent || o.renderOrder) return;
      const g = o.geometry; if (g.morphAttributes.position) return;
      const key = `${o.material.id}|${Object.keys(g.attributes).sort()}|${g.index ? 'i' : 'n'}|${o.castShadow}|${o.receiveShadow}`;
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(o);
    };
    // the rider sitting on the horse is its own thing (it gets off, changes horse, is rebuilt): leave it out
    const walk = (o) => { if (o === rider) return; add(o); for (const c of o.children) walk(c); };
    walk(root); extras.forEach(add);
    const rig = { root, batches: [], parts: [...groups.values()].flat() };
    for (const parts of groups.values()) {
      if (parts.length < 2) continue;
      const geos = parts.map((m, i) => {
        const g = m.geometry.clone(), n = g.attributes.position.count;
        const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
        for (let k = 0; k < n; k++) { si[k * 4] = i; sw[k * 4] = 1; }
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
        return g;
      });
      const geo = SU.mergeGeometries(geos); if (!geo) continue;
      const mesh = new THREE.SkinnedMesh(geo, parts[0].material);
      mesh.castShadow = parts[0].castShadow; mesh.receiveShadow = parts[0].receiveShadow;
      // bones are plain placeholders; update() below writes each part's world matrix (or zeros) straight into the bone texture
      const skel = new THREE.Skeleton(parts.map(() => new THREE.Bone()), parts.map(() => new THREE.Matrix4()));
      mesh.bind(skel, new THREE.Matrix4());
      const b = { root, parts, mesh, mat: parts[0].material, extras, own: new Uint8Array(parts.length) };
      skel.update = () => updateBatch(b);
      root.add(mesh);
      // culled as one: a sphere around the rig in its own space, wide enough for rearing, kicking and the head down
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.1, 0), 3.4);
      for (const m of parts) m.layers.set(LAYER_HIDDEN);
      batches.push(b); rig.batches.push(b);
    }
    if (rig.batches.length) addOccluder(rig);
  }
  function updateBatch(b) {
    const skel = b.mesh.skeleton, out = skel.boneMatrices;
    for (let i = 0; i < b.parts.length; i++) {
      const m = b.parts[i];
      if (b.own[i] || m.material !== b.mat || (!b.extras.has(m) && !stillOwned(m, b.root))) { b.own[i] = 1; m.layers.set(0); out.set(ZERO, i * 16); continue; }   // draws itself from now on
      if (visibleInScene(m)) out.set(m.matrixWorld.elements, i * 16); else out.set(ZERO, i * 16);
    }
    if (skel.boneTexture) skel.boneTexture.needsUpdate = true;
  }
  let batching = true;
  function unbatchAll(on) {        // debugging / A-B comparisons: SU.perf.batching(false) draws the original meshes again
    batching = on;
    for (const b of batches) { b.mesh.visible = on; b.parts.forEach((m, i) => { if (!b.own[i]) m.layers.set(on ? LAYER_HIDDEN : 0); }); }
    for (const o of occluders) o.hidden = false;
  }

  // ------------------------------------------------------------------ occlusion culling for the rigs (horses in their boxes)
  // Each batched rig gets an invisible proxy box (no colour, no depth write) drawn after everything opaque, wrapped in a WebGL2
  // occlusion query. When two answers in a row say no pixel of the box passed the depth test (a horse behind the écurie's walls,
  // say), the rig's batches aren't drawn; the box keeps being tested and the horse is back the moment any of it could show.
  // The box is bigger than the horse, so it starts passing before the horse itself comes into view. Never used for a rig that
  // can throw a shadow into view (its shadow would go missing) or when the camera is inside its box.
  const gl = renderer.getContext(), ANY = gl.ANY_SAMPLES_PASSED_CONSERVATIVE;
  const occluders = [], proxyMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
  let frameNo = 0, occlusion = !!ANY;
  const _inv = new THREE.Matrix4(), _bb = new THREE.Box3(), _v = new THREE.Vector3();
  function addOccluder(rig) {
    if (!ANY) return;
    const { root } = rig, box = new THREE.Box3();
    _inv.copy(root.matrixWorld).invert();
    for (const m of rig.parts) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); _bb.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld).applyMatrix4(_inv); box.union(_bb); }
    const s = root.getWorldScale(_v).x || 1, pad = 0.5 / s;            // half a metre all round, plus room for the head going up or down
    box.min.subScalar(pad); box.max.addScalar(pad); box.max.y += 0.4 / s; box.min.z -= 0.3 / s; box.max.z += 0.3 / s;
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(...box.getSize(_v).toArray()), proxyMat);
    box.getCenter(proxy.position); proxy.renderOrder = 1e9; proxy.castShadow = proxy.receiveShadow = false;
    const o = { rig, box, proxy, q: gl.createQuery(), active: false, pending: false, drawn: -1, occN: 0, hidden: false };
    proxy.onBeforeRender = () => { o.drawn = frameNo; if (!o.pending && occlusion) { gl.beginQuery(ANY, o.q); o.active = true; } };
    proxy.onAfterRender = () => { if (o.active) { gl.endQuery(ANY); o.active = false; o.pending = true; } };
    root.add(proxy);
    occluders.push(o);
  }
  const sun = gfx.sun, sc = sun.shadow.camera, _d = new THREE.Vector3(), _p = new THREE.Vector3();
  function shadowRelevant(root) {         // could this rig cast a shadow into the sun's shadow box? (same test as the trees' scatterLOD)
    _d.subVectors(sun.position, sun.target.position).normalize();
    root.getWorldPosition(_p).sub(sun.target.position);
    const t = _p.dot(_d), lat = _p.addScaledVector(_d, -t).length(), r = 3;
    return t > 40 - sc.far - r - 4 && t < 40 - sc.near + r + 4 && lat < sc.right * Math.SQRT2 + 4 + r;
  }
  function updateOcclusion(cam) {
    frameNo++;
    for (const o of occluders) {
      if (o.pending && gl.getQueryParameter(o.q, gl.QUERY_RESULT_AVAILABLE)) {
        o.pending = false; o.occN = gl.getQueryParameter(o.q, gl.QUERY_RESULT) ? 0 : o.occN + 1;
      }
      if (o.drawn < frameNo - 1) o.occN = 0;                             // off screen last frame: assume visible when it comes back
      let hide = occlusion && batching && o.occN >= 2;
      if (hide) { o.rig.root.worldToLocal(_v.copy(cam.position)); if (o.box.containsPoint(_v) || shadowRelevant(o.rig.root)) hide = false; }
      if (hide !== o.hidden) { o.hidden = hide; for (const b of o.rig.batches) b.mesh.visible = !hide; }
    }
  }
  const prevBefore = scene.onBeforeRender;
  scene.onBeforeRender = (r, s, cam, rt) => { prevBefore(r, s, cam, rt); if (s === scene) updateOcclusion(cam); };
  for (const h of SU.horses) batchRig(h.R);
  for (const h of gfx.herd ?? []) batchRig(h.R);

  // ------------------------------------------------------------------ quality governor
  const maxPR = gfx.maxPixelRatio, GRASS_N = gfx.GRASS_N, shadowMax = gfx.sun.shadow.mapSize.x;
  // each level: render scale (fraction of the device's pixel ratio, never below 0.6), grass fraction, shadow map size factor,
  // shadow update every n frames, animation-LOD distance factor
  const LADDER = [
    [1.00, 1.0, 1, 1, 1], [0.85, 1.0, 1, 1, 1], [0.72, 1.0, 1, 1, 1], [0.60, 1.0, 1, 1, 1], [0.50, 1.0, 1, 1, 1],
    [0.50, 0.6, 1, 1, 1], [0.42, 0.6, 1, 1, 0.7], [0.42, 0.4, 0.5, 1, 0.7], [0.36, 0.4, 0.5, 2, 0.5], [0.30, 0.3, 0.25, 2, 0.4],
  ];
  const settings = (l) => { const [ps, gr, sh, every, anim] = LADDER[l]; return { pr: Math.max(Math.min(0.6, maxPR), +(maxPR * ps).toFixed(2)), grass: Math.round(GRASS_N * gr), shadow: Math.max(256, shadowMax * sh), every, anim }; };
  // levels that change nothing on this device (e.g. the render scale is already at its floor) are skipped
  const levels = []; let prev = '';
  LADDER.forEach((_, l) => { const s = settings(l), k = JSON.stringify(s); if (k !== prev) levels.push(s); prev = k; });

  let level = 0, auto = true, shadowEvery = 1, shadowN = 0;
  function apply(l) {
    level = Math.max(0, Math.min(levels.length - 1, l));
    const s = levels[level];
    if (Math.abs(renderer.getPixelRatio() - s.pr) > 0.001) renderer.setPixelRatio(s.pr);
    gfx.grass.geometry.instanceCount = s.grass;
    const sh = gfx.sun.shadow;
    if (sh.mapSize.x !== s.shadow) { sh.mapSize.setScalar(s.shadow); if (sh.map) { sh.map.dispose(); sh.map = null; } }
    shadowEvery = s.every; renderer.shadowMap.autoUpdate = s.every === 1;
    gfx.animLOD = s.anim;
    if (readout) readout.dataset.level = level;
  }

  // measurement: frame intervals from our own requestAnimationFrame, ignoring the first seconds, hidden tabs, open panels,
  // and a while after a course change or a level change (shader compiles and buffer reallocations make one-off spikes)
  const W = 1.0;                              // window length (s)
  let last = 0, winT = 0, winN = 0, holdUntil = performance.now() + 4000, fps = 60;
  let goodFor = 0, lastChange = 0, probe = null;  // probe: { from, at } while trying a better level
  const ban = new Map();                      // level -> { until, wait }: levels that failed a probe, with exponential back-off
  // futility: if two steps down bought nothing (the main thread is the bottleneck, or the screen is capped at 30 Hz), lower quality
  // can't help, so the quality is given back and we stop stepping down for a while
  let downs = [], downBlockedUntil = 0;
  const hold = (ms) => { holdUntil = Math.max(holdUntil, performance.now() + ms); winT = winN = 0; };
  SU.on('reset', () => hold(2500));
  document.addEventListener('visibilitychange', () => hold(1500));
  function tick(now) {
    requestAnimationFrame(tick);
    // shadow map every n frames at the lowest levels
    if (shadowEvery > 1 && ++shadowN >= shadowEvery) { shadowN = 0; renderer.shadowMap.needsUpdate = true; }
    const dt = (now - last) / 1000; last = now;
    if (document.hidden || SU.modal > 0 || SU.pauseCount > 0 || now < holdUntil || dt > 0.25 || dt <= 0) { winT = winN = 0; return; }
    winT += dt; winN++;
    if (winT < W) return;
    fps = winN / winT; winT = winN = 0;
    if (readout) readout.textContent = `${fps.toFixed(0)} fps · q${level}${auto ? '' : ' (fixed)'} · ${renderer.getPixelRatio().toFixed(2)}x`;
    if (!auto) return;
    const target = 60 * 0.97, t = performance.now();       // aim for 60 (a 120 Hz screen is happy with that too)
    if (fps < target * 0.85) {
      goodFor = 0;
      if (probe && t - probe.at < 4000) {                  // the better level we tried can't keep up: go back and leave it alone for a while
        const b = ban.get(level) ?? { wait: 15000 }; b.until = t + b.wait; b.wait = Math.min(b.wait * 2, 240000); ban.set(level, b);
        apply(probe.from); probe = null; lastChange = t; hold(1000); return;
      }
      if (downs.length >= 2 && fps < downs[downs.length - 2].fps * 1.08) {          // two steps, no gain: undo them and wait
        apply(downs[downs.length - 2].from); downs = []; downBlockedUntil = t + 20000; lastChange = t; hold(1000); return;
      }
      if (t - lastChange > 1000 && t > downBlockedUntil && level < levels.length - 1) {
        downs.push({ from: level, fps }); if (downs.length > 3) downs.shift();
        apply(level + 1); lastChange = t; probe = null; hold(1000);
      }
    } else if (fps >= target) {
      goodFor += W; downs = [];
      if (probe && t - probe.at > 4000) probe = null;    // the probe held: keep it
      const up = level - 1, b = ban.get(up);
      if (level > 0 && goodFor >= 5 && !(b && t < b.until)) { probe = { from: level, at: t }; apply(up); lastChange = t; goodFor = 0; hold(1000); }
    } else goodFor = 0;
  }
  requestAnimationFrame(tick);

  // optional readout: ?fps in the URL
  let readout = null;
  if (/[?&]fps\b/.test(location.search)) {
    readout = document.createElement('div');
    readout.style.cssText = 'position:fixed;left:8px;top:8px;z-index:30;font:12px/1.3 system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:4px 8px;border-radius:6px;pointer-events:none';
    document.body.appendChild(readout);
  }

  apply(SU.MOBILE ? 1 : 0);
  SU.perf = {
    get level() { return level; }, get fps() { return fps; }, get levels() { return levels.length; }, get auto() { return auto; },
    set(l) { if (l === 'auto') { auto = true; ban.clear(); } else { auto = false; apply(+l); } return level; },
    batchRig, batching: unbatchAll, occlusion(on) { occlusion = on && !!ANY; }, get occluded() { return occluders.filter(o => o.hidden).length; },
  };

  // warm-up: compile every shader the world can use now, including things that are hidden at the start (rain, mud, splashes,
  // the hay on its way back...), so the first shower or the first splash doesn't stall the game for a shader compile
  const hidden = [];
  scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  try { renderer.compile(scene, SU.camera); } catch (e) { console.warn('[perf] warm-up', e); } finally { for (const o of hidden) o.visible = false; }
}
