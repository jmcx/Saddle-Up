// care feature, 3D and sound: how the tack looks (on/off, colours, a head collar), dust on the coat,
// water in the box buckets, a little burst of hearts, and the synthesised brushing / buckle / pouring sounds.

// choices offered in the tack room. size: which animals a saddle fits (B.S < 0.9 = 'poney')
export const SADDLES = {
  mixte: { name: 'Selle mixte', sub: 'pour un cheval · cuir marron', size: 'cheval', c: 0x5a3620 },
  mixteNoire: { name: 'Selle mixte noire', sub: 'pour un cheval · cuir noir', size: 'cheval', c: 0x1e1916 },
  poney: { name: 'Selle poney', sub: 'pour un poney · cuir marron', size: 'poney', c: 0x5a3620 },
  poneyHavane: { name: 'Selle poney havane', sub: 'pour un poney · cuir clair', size: 'poney', c: 0x8a5a30 },
};
export const PADS = {
  blanc: { name: 'Blanc', c: 0xf1eee6 }, marine: { name: 'Bleu marine', c: 0x22335a }, bordeaux: { name: 'Bordeaux', c: 0x6e1f2a },
  vert: { name: 'Vert', c: 0x2f6b4a }, rose: { name: 'Rose', c: 0xd884a6 },
};
export const LEATHERS = { marron: { name: 'Cuir marron', c: 0x2a1a10 }, noir: { name: 'Cuir noir', c: 0x111010 }, havane: { name: 'Cuir havane', c: 0x7a4a26 } };
export const NOSEBANDS = { fr: { name: 'Muserolle française', sub: 'une bande au-dessus du mors' }, comb: { name: 'Muserolle combinée', sub: 'une bande en plus sous le mors' } };
const HALTER_C = 0xc23b2c, ROPE_C = 0xd9c9a2;
export const sizeOf = (h) => (h.B.S < 0.9 ? 'poney' : 'cheval');

export function makeLook(SU) {
  const THREE = SU.THREE;
  const dustC = new THREE.Color(0x8a7556), v = new THREE.Vector3();

  // ---- tack: show / hide / colour the pieces buildTack named (R.tack.parts)
  function applyTack(h, S) {
    const t = h.R.tack; if (!t || !t.parts) return;
    const P = t.parts, wear = 1 - 0.38 * S.tackDirt;
    const sad = SADDLES[S.look.saddle] ?? SADDLES.mixte, pad = PADS[S.look.pad] ?? PADS.blanc, lea = LEATHERS[S.look.leather] ?? LEATHERS.marron;
    for (const m of P.pad) { m.visible = S.saddled; m.material.color.setHex(pad.c).lerp(dustC, 0.35 * S.tackDirt); }
    for (const m of P.saddle) { m.visible = S.saddled; m.material.color.setHex(sad.c).multiplyScalar(wear); m.material.roughness = 0.6 + 0.3 * S.tackDirt; }
    for (const m of P.girth) m.visible = S.saddled;
    const halter = !S.bridled; t.halter = halter;
    for (const m of [...P.bridle, ...P.noseband]) { m.visible = true; m.material.color.setHex(halter ? HALTER_C : lea.c); if (!halter) m.material.color.multiplyScalar(wear); }
    for (const m of P.flash) m.visible = !halter && S.look.noseband === 'comb';
    for (const m of t.bits) m.visible = !halter;
    t.reinMat.color.setHex(halter ? ROPE_C : lea.c).multiplyScalar(halter ? 1 : wear);
    if (!halter) for (const r of t.reins) for (const m of r) m.visible = true;
  }

  // ---- dust: soft mud blobs (vertex alpha) on the lower flanks and belly, one merged mesh per horse, plus a duller coat
  const dirtFx = new WeakMap();
  function blobs(R) {
    const bodyMesh = R.body.children.find(c => c.isMesh && c.geometry.userData && c.geometry.userData.P);
    if (!bodyMesh) return null;
    const { P, D } = bodyMesh.geometry.userData;
    const table = []; const p = new THREE.Vector3(), d = new THREE.Vector3(), tan = new THREE.Vector3(), nrm = new THREE.Vector3(), side = new THREE.Vector3(1, 0, 0);
    for (let i = 0; i <= 200; i++) { P.getPoint(i / 200, p); table.push([i / 200, p.z]); }
    const tAt = (z) => { let best = 0, bd = 1e9; for (const [t, zz] of table) { const e = Math.abs(zz - z); if (e < bd) { bd = e; best = t; } } return best; };
    const pos = [], col = [], idx = [];
    let seed = 7 + Math.round(R.B.S * 1300); const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed % 10000) / 10000; };
    const N = 20, G = 6;
    for (let b = 0; b < N; b++) {
      const left = b % 2 === 0;
      const zc = -0.75 + rnd() * 1.35, ac = (left ? -0.28 : -0.72) * Math.PI + (rnd() - 0.5) * 0.36 * Math.PI;
      const hz = 0.06 + rnd() * 0.08, ha = (0.07 + rnd() * 0.09) * Math.PI, base = pos.length / 3;
      for (let i = 0; i <= G; i++) for (let j = 0; j <= G; j++) {
        const u = i / G * 2 - 1, w = j / G * 2 - 1, t = tAt(zc + u * hz), a = ac + w * ha;
        P.getPoint(t, p); D.getPoint(t, d); P.getTangent(t, tan); tan.x = 0; tan.normalize(); nrm.crossVectors(tan, side).normalize();
        const ca = Math.cos(a), sa = Math.sin(a);
        v.copy(p).addScaledVector(side, (d.x + 0.006) * ca).addScaledVector(nrm, ((sa >= 0 ? d.y : d.z) + 0.006) * sa);
        pos.push(v.x, v.y, v.z);
        const r2 = u * u + w * w, al = Math.min(1, 1.4 * Math.max(0, 1 - r2)) * (0.75 + 0.25 * rnd());
        const k = 0.85 + 0.3 * rnd(); col.push(k, k * 0.97, k * 0.9, al);
        if (i < G && j < G) { const q = base + i * (G + 1) + j; idx.push(q, q + 1, q + G + 1, q + 1, q + G + 2, q + G + 1); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setIndex(idx); g.computeVertexNormals();
    const lum = new THREE.Color(R.B.coat).getHSL({}).l;                          // dusty-light on a dark coat, muddy-dark on a pale one
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: lum < 0.25 ? 0xcdb490 : 0x5a4328, roughness: 1, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }));
    m.renderOrder = 1; m.visible = false; R.body.add(m);
    return m;
  }
  function applyDirt(h, S, camPos) {
    let fx = dirtFx.get(h.R);
    if (!fx) {
      const coat = h.R.mats[0];
      fx = { mud: blobs(h.R), coat, sheen: coat.sheen ?? 0, last: -1 };
      dirtFx.set(h.R, fx);
    }
    const dirt = S.dirt, far = camPos && h.R.root.position.distanceTo(camPos) > 70;
    if (fx.mud) {
      const a = Math.min(1, Math.max(0, (dirt - 0.2) / 0.6));
      fx.mud.visible = a > 0.02 && !far; fx.mud.material.opacity = a * 0.95;
    }
    const key = Math.round(dirt * 40) + (S.shine > 0 ? 100 : 0);
    if (key === fx.last) return; fx.last = key;
    const c = fx.coat;
    c.color.setRGB(1 - 0.2 * dirt, 1 - 0.24 * dirt, 1 - 0.32 * dirt);
    if ('sheen' in c) c.sheen = fx.sheen * (1 - 0.85 * dirt) * (S.shine > 0 ? 1.35 : 1);
    if (c.emissive) c.emissive.copy(dustC).multiplyScalar(0.07 * dirt);
  }

  // ---- water level in each box's bucket: one instanced disc per bucket (a single draw call)
  const buckets = [];
  {
    const found = [];
    SU.scene.traverse(o => { const q = o.isMesh && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters; if (q && q.radiusTop === 0.17 && q.height === 0.32) found.push(o); });
    for (const box of SU.world.stallBoxes) {
      let best = null, bd = 1e9;
      for (const o of found) { o.getWorldPosition(v); const dd = Math.hypot(v.x - box.x, v.z - box.z); if (dd < bd) { bd = dd; best = v.clone(); } }
      buckets.push(best && bd < 4 ? { x: best.x, y: best.y - 0.16, z: best.z } : null);
    }
  }
  const water = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.155, 0.155, 0.01, 14), new THREE.MeshStandardMaterial({ color: 0x4f8596, roughness: 0.08, metalness: 0.2 }), Math.max(1, buckets.length));
  water.frustumCulled = false; water.visible = false; SU.scene.add(water);
  const m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(0, 0, 0), q0 = new THREE.Quaternion();
  function setWater(i, level) {
    const b = buckets[i]; if (!b) return;
    v.set(b.x, b.y + 0.05 + 0.26 * level, b.z);
    m4.compose(v, q0, level > 0.03 ? one : zero); water.setMatrixAt(i, m4); water.instanceMatrix.needsUpdate = true;
  }

  // ---- hearts: a little burst over a happy horse's head (one Points object, reused)
  const NH = 9, hp = new Float32Array(NH * 3), hv = new Float32Array(NH * 3);
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(hp, 3));
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  { const g = cv.getContext('2d'); g.fillStyle = '#ff5c8a'; g.beginPath(); g.moveTo(32, 56); g.bezierCurveTo(-8, 30, 10, 2, 32, 20); g.bezierCurveTo(54, 2, 72, 30, 32, 56); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(21, 22, 5, 0, Math.PI * 2); g.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const hm = new THREE.PointsMaterial({ map: tex, size: 0.22, transparent: true, depthWrite: false, sizeAttenuation: true });
  const hearts = new THREE.Points(hg, hm); hearts.visible = false; hearts.frustumCulled = false; SU.scene.add(hearts);
  let heartT = 0;
  function burst(h) {
    h.R.head.getWorldPosition(v);
    for (let i = 0; i < NH; i++) {
      hp[i * 3] = v.x + (Math.random() - 0.5) * 0.4; hp[i * 3 + 1] = v.y + 0.25 + Math.random() * 0.2; hp[i * 3 + 2] = v.z + (Math.random() - 0.5) * 0.4;
      hv[i * 3] = (Math.random() - 0.5) * 0.3; hv[i * 3 + 1] = 0.45 + Math.random() * 0.4; hv[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    hg.attributes.position.needsUpdate = true; heartT = 1.8; hearts.visible = true; hm.opacity = 1;
  }
  SU.onUpdate((dt) => {
    if (heartT <= 0) return;
    heartT -= dt;
    for (let i = 0; i < NH * 3; i++) hp[i] += hv[i] * dt;
    hg.attributes.position.needsUpdate = true; hm.opacity = Math.min(1, heartT / 0.6);
    if (heartT <= 0) hearts.visible = false;
  });

  // ---- sounds
  const A = SU.audio;
  const ok = () => A.audioOk && A.audioOk();
  function brush(tool) {
    if (!ok()) return;
    const t = A.ctx.currentTime + 0.01;
    if (tool === 'etrille') for (let i = 0; i < 2; i++) A.noiseHit(t + i * 0.07, { type: 'bandpass', freq: 1500 + Math.random() * 500, q: 2.5, peak: 0.12, attack: 0.02, decay: 0.07 });
    else if (tool === 'bouchon') A.noiseHit(t, { type: 'highpass', freq: 3200, q: 0.8, peak: 0.13, attack: 0.005, decay: 0.07 });
    else if (tool === 'brosse') A.noiseHit(t, { type: 'bandpass', freq: 2600, q: 0.7, peak: 0.07, attack: 0.04, decay: 0.16 });
    else { A.noiseHit(t, { type: 'bandpass', freq: 900, q: 3, peak: 0.16, attack: 0.003, decay: 0.05 }); A.noiseHit(t + 0.08, { type: 'lowpass', freq: 500, peak: 0.1, attack: 0.003, decay: 0.05 }); }
  }
  function buckle() {
    if (!ok()) return;
    const t = A.ctx.currentTime + 0.01;
    for (let i = 0; i < 2; i++) { A.noiseHit(t + i * 0.32, { type: 'lowpass', freq: 400, peak: 0.18, attack: 0.04, decay: 0.12 }); A.noiseHit(t + i * 0.32 + 0.14, { type: 'highpass', freq: 5200, peak: 0.2, attack: 0.002, decay: 0.03 }); }
  }
  function pour() {
    if (!ok()) return;
    const t = A.ctx.currentTime + 0.01;
    A.noiseHit(t, { type: 'lowpass', freq: 700, peak: 0.16, attack: 0.15, decay: 1.3 });
    for (let i = 0; i < 9; i++) A.noiseHit(t + 0.1 + i * 0.13 + Math.random() * 0.05, { type: 'bandpass', freq: 900 + Math.random() * 900, q: 6, peak: 0.07, attack: 0.01, decay: 0.06 });
  }
  function happy(h, big = false) {
    burst(h);
    if (!ok()) return;
    if (big && A.neigh) A.neigh(h.B, 0.35); else if (A.snort) A.snort(h.B, 0.6);
  }
  function munch() { if (ok() && A.munch) { A.munch(1); setTimeout(() => A.munch(1), 600); } }

  return { applyTack, applyDirt, buckets, setWater, water, burst, brush, buckle, pour, happy, munch };
}
