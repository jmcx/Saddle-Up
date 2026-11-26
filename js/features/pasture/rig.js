// pasture feature, shared machinery for the background animals (stabulation ponies, the pré herd, the mare and her foal):
// a light rig (one skinned mesh per animal instead of ~41 meshes), distance LOD for the animation, and cheap steering
// between targets inside a known region (a box or a round field) with walls, posts and the other animals pushed out.

// ---- light rig: build with buildHorse(B, { tack: false, detail }), then merge every mesh into ONE SkinnedMesh whose bones are
// the rig's own groups (each vertex rigidly bound to the group it hung from), so updateRig animates it unchanged.
// Two material groups (coat + glossy eyes): 2 draw calls (+2 in the shadow pass) instead of ~41.
export function makeAnimal(SU, B, detail = 0.6) {
  const R = SU.buildHorse(B, { tack: false, detail });
  skinMerge(SU, R);
  return R;
}
export function skinMerge(SU, R) {
  const THREE = SU.THREE, root = R.root;
  const p0 = root.position.clone(), y0 = root.rotation.y;
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), m = new THREE.Matrix4();
  const coatMat = R.mats[0], eyeMat = R.mats[4];
  const earC = new THREE.Color(R.B.coat).multiplyScalar(0.85);
  const meshes = []; root.traverse(o => { if (o.isMesh) meshes.push(o); });
  const bones = [], boneIdx = new Map(), lists = [[], []];
  let bodyData = null;
  for (const o of meshes) {
    let bi = boneIdx.get(o.parent);
    if (bi === undefined) { bi = bones.length; bones.push(o.parent); boneIdx.set(o.parent, bi); }
    if (o.parent === R.body && o.geometry.userData && o.geometry.userData.P) bodyData = o.geometry.userData;
    const g = o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
    if (!g.index) { const n = g.attributes.position.count, ix = new Uint32Array(n); for (let i = 0; i < n; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
    m.multiplyMatrices(inv, o.matrixWorld); g.applyMatrix4(m);
    const n = g.attributes.position.count;
    if (!g.attributes.color || o.material !== coatMat) {            // bake the part's material colour (ears had none: they rendered black)
      const c = o.material === coatMat ? earC : o.material.color, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    lists[o.material === eyeMat ? 1 : 0].push(g);
    o.parent.remove(o); o.geometry.dispose();
  }
  const merged = SU.mergeGeometries([SU.mergeGeometries(lists[0]), SU.mergeGeometries(lists[1])], true);
  for (const l of lists) for (const g of l) g.dispose();
  for (const mt of R.mats) if (mt !== coatMat && mt !== eyeMat) mt.dispose();
  R.mats = [coatMat, eyeMat];
  const mesh = new THREE.SkinnedMesh(merged, [coatMat, eyeMat]);
  mesh.castShadow = mesh.receiveShadow = true;
  root.add(mesh); root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  merged.computeBoundingSphere();
  mesh.boundingSphere = merged.boundingSphere.clone(); mesh.boundingSphere.radius *= 1.25;   // poses (head down, kicks) stay inside
  // an invisible stand-in keeps the barrel's curves, so care's mud blobs still find the body
  if (bodyData) { const g = new THREE.BufferGeometry(); g.userData = bodyData; const stub = new THREE.Mesh(g, coatMat); stub.visible = false; R.body.add(stub); }
  R.mesh = mesh;
  root.position.copy(p0); root.rotation.y = y0;
  return R;
}

// ---- regions: where an animal may stand. { box: {minX..maxZ} } or { circle: {x, z, r} }, plus walls (AABBs) and posts (circles)
export function makeRegion(SU, opts) {
  const W = SU.world, rg = { box: opts.box ?? null, circle: opts.circle ?? null, margin: opts.margin ?? 0.35 };
  const inBox = (w, b, m) => (w.minX + w.maxX) / 2 > b.minX - m && (w.minX + w.maxX) / 2 < b.maxX + m && (w.minZ + w.maxZ) / 2 > b.minZ - m && (w.minZ + w.maxZ) / 2 < b.maxZ + m;
  if (rg.box) {
    rg.walls = W.walls.filter(w => w.maxX > rg.box.minX + 0.3 && w.minX < rg.box.maxX - 0.3 && w.maxZ > rg.box.minZ + 0.3 && w.minZ < rg.box.maxZ - 0.3);
    rg.posts = W.colliders.filter(c => c.type !== 'horse' && c.h === Infinity && inBox({ minX: c.x, maxX: c.x, minZ: c.z, maxZ: c.z }, rg.box, 0)).map(c => ({ x: c.x, z: c.z, r: c.r }));
  } else {
    const C = rg.circle;
    rg.walls = W.walls.filter(w => Math.hypot((w.minX + w.maxX) / 2 - C.x, (w.minZ + w.maxZ) / 2 - C.z) < C.r - 1.5);
    rg.posts = W.colliders.filter(c => c.type !== 'horse' && c.h === Infinity && Math.hypot(c.x - C.x, c.z - C.z) < C.r - 1).map(c => ({ x: c.x, z: c.z, r: c.r }));
  }
  if (opts.walls) rg.walls.push(...opts.walls);
  // is a point free (inside, clear of walls and posts by m)?
  rg.free = (x, z, m = 1) => {
    if (rg.box) { const b = rg.box; if (x < b.minX + m || x > b.maxX - m || z < b.minZ + m || z > b.maxZ - m) return false; }
    else if (Math.hypot(x - rg.circle.x, z - rg.circle.z) > rg.circle.r - m - 1) return false;
    for (const w of rg.walls) if (x > w.minX - m && x < w.maxX + m && z > w.minZ - m && z < w.maxZ + m) return false;
    for (const p of rg.posts) if (Math.hypot(x - p.x, z - p.z) < p.r + m) return false;
    return true;
  };
  // does the straight walk from a to b cross a wall (grown by m)?
  rg.clear = (ax, az, bx, bz, m = 0.7) => {
    const dx = bx - ax, dz = bz - az;
    for (const w of rg.walls) {
      let t0 = 0, t1 = 1;
      for (const [p, d, lo, hi] of [[ax, dx, w.minX - m, w.maxX + m], [az, dz, w.minZ - m, w.maxZ + m]]) {
        if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) { t0 = 2; break; } continue; }
        let u0 = (lo - p) / d, u1 = (hi - p) / d; if (u0 > u1) { const t = u0; u0 = u1; u1 = t; }
        t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) break;
      }
      if (t0 <= t1) return false;
    }
    for (const p of rg.posts) {
      const L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / L2));
      if (Math.hypot(ax + dx * t - p.x, az + dz * t - p.z) < p.r + m) return false;
    }
    return true;
  };
  // a random reachable point, optionally inside a sub-box
  rg.pick = (fromX, fromZ, sub = null, m = 1.2) => {
    for (let i = 0; i < 14; i++) {
      let x, z;
      if (sub) { x = sub.minX + Math.random() * (sub.maxX - sub.minX); z = sub.minZ + Math.random() * (sub.maxZ - sub.minZ); }
      else if (rg.box) { const b = rg.box; x = b.minX + Math.random() * (b.maxX - b.minX); z = b.minZ + Math.random() * (b.maxZ - b.minZ); }
      else { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (rg.circle.r - 3); x = rg.circle.x + Math.sin(a) * r; z = rg.circle.z + Math.cos(a) * r; }
      if (rg.free(x, z, m) && rg.clear(fromX, fromZ, x, z)) return { x, z };
    }
    return null;
  };
  rg.inside = (x, z, m = 0) => rg.box ? (x > rg.box.minX + m && x < rg.box.maxX - m && z > rg.box.minZ + m && z < rg.box.maxZ - m)
    : Math.hypot(x - rg.circle.x, z - rg.circle.z) < rg.circle.r - m;
  return rg;
}

// ---- hard constraint, after each rig step: the barrel (two circles) stays inside the region, out of walls, posts and the others
const OFFS = [0.62, -0.62];
export function constrain(a, rg, others) {
  const s = a.s, S = a.B.S, fx = Math.sin(s.yaw), fz = Math.cos(s.yaw), rad = 0.36 * S;
  for (let k = 0; k < 3; k++) {
    const o = k < 2 ? OFFS[k] * S : 1.2 * S, r = k < 2 ? rad : 0.12;  // k = 2: the muzzle, kept inside the fence only
    const px = s.x + fx * o, pz = s.z + fz * o;
    if (rg.box) {
      const b = rg.box, m = rg.margin + r;
      if (px < b.minX + m) s.x += b.minX + m - px; else if (px > b.maxX - m) s.x -= px - (b.maxX - m);
      if (pz < b.minZ + m) s.z += b.minZ + m - pz; else if (pz > b.maxZ - m) s.z -= pz - (b.maxZ - m);
    } else {
      const C = rg.circle, dx = px - C.x, dz = pz - C.z, d = Math.hypot(dx, dz), lim = C.r - 0.45 - r;
      if (d > lim) { s.x -= dx / d * (d - lim); s.z -= dz / d * (d - lim); }
    }
    if (k === 2) break;
    for (const w of rg.walls) {
      const qx = Math.max(w.minX, Math.min(w.maxX, px)), qz = Math.max(w.minZ, Math.min(w.maxZ, pz));
      let dx = px - qx, dz = pz - qz; const d = Math.hypot(dx, dz);
      if (d >= rad) continue;
      if (d < 1e-4) {               // inside: out the shortest way
        const e = [[px - w.minX, -1, 0], [w.maxX - px, 1, 0], [pz - w.minZ, 0, -1], [w.maxZ - pz, 0, 1]].sort((p, q) => p[0] - q[0])[0];
        s.x += e[1] * (e[0] + rad); s.z += e[2] * (e[0] + rad);
      } else { s.x += dx / d * (rad - d); s.z += dz / d * (rad - d); }
    }
    for (const p of rg.posts) {
      const dx = px - p.x, dz = pz - p.z, d = Math.hypot(dx, dz), min = p.r + rad;
      if (d < min && d > 1e-4) { s.x += dx / d * (min - d); s.z += dz / d * (min - d); }
    }
    if (others) for (const b of others) {
      if (b === a || b.s === s) continue;
      const bs = b.s, bS = b.B.S, ddx = bs.x - s.x, ddz = bs.z - s.z;
      if (ddx * ddx + ddz * ddz > 9) continue;
      const bfx = Math.sin(bs.yaw), bfz = Math.cos(bs.yaw), min = rad + 0.36 * bS;
      for (const ob of OFFS) {
        const qx = bs.x + bfx * ob * bS, qz = bs.z + bfz * ob * bS, dx = px - qx, dz = pz - qz, d = Math.hypot(dx, dz);
        if (d < min && d > 1e-4) { const f = (min - d) * 0.5; s.x += dx / d * f; s.z += dz / d * f; }
      }
    }
  }
}

// ---- steering toward a.tx/a.tz (4-5 Hz): heading to the target, slowing for anyone ahead, steering round walls ahead
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function steer(a, rg, others, speed, P) {
  const s = a.s, S = a.B.S, dx = a.tx - s.x, dz = a.tz - s.z, d = Math.hypot(dx, dz);
  let want = Math.atan2(dx, dz), slow = 1;
  const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
  // anyone in the way (other animals, you)?
  let block = 0, side = 0;
  const test = (x, z, r) => {
    const ox = x - s.x, oz = z - s.z, ahead = ox * fx + oz * fz, lat = ox * fz - oz * fx;
    if (ahead > 0 && ahead < 1.2 * S + r + 1.1 && Math.abs(lat) < 0.45 * S + r + 0.15) { block = Math.max(block, 1 - ahead / (1.2 * S + r + 1.1)); side = lat > 0 ? -1 : 1; }
  };
  for (const b of others) if (b !== a && b.s !== s) test(b.s.x, b.s.z, 0.6 * b.B.S);
  if (P) test(P.x, P.z, 0.35);
  // a wall or post just ahead: turn along it
  const ax = s.x + fx * 1.4 * S, az = s.z + fz * 1.4 * S;
  if (!rg.free(ax, az, 0.15) && d > 1.2) { const l = Math.sin(wrap(want - s.yaw)); want = s.yaw + (l >= 0 ? 0.9 : -0.9); }
  if (block > 0) { slow = Math.max(0, 1 - block * 1.6); if (block > 0.35) want += side * 0.8; }
  const diff = wrap(want - s.yaw);
  a.ctl.turnIn = Math.max(-1, Math.min(1, diff * 1.7));
  a.ctl.target = (Math.abs(diff) > 1.15 ? 0.35 : speed * Math.min(1, 0.35 + d / 2.5)) * slow;
  a.blocked = slow < 0.2 ? (a.blocked ?? 0) + 1 : 0;
  return d;
}
// turn on the spot to a heading; true when done
export function face(a, yaw) {
  const diff = wrap(yaw - a.s.yaw);
  a.ctl.target = 0; a.ctl.turnIn = Math.abs(diff) < 0.12 ? 0 : Math.max(-1, Math.min(1, diff * 1.8));
  return Math.abs(diff) < 0.12;
}
export { wrap };

// ---- the LOD runner for a group of light animals: full-rate rig update up to 25 m from the camera, 12 Hz to 60 m, 4 Hz to 130 m,
// frozen beyond (the accumulated dt is passed in, so they keep their pace); shadows only within 45 m (toggled on transitions only).
// a: { R, s, B, ctl, cols?, acc, brainAcc, brain(a, dt), post?(a, dt) }
export function runGroup(SU, list, { rg, others, brainHz = 5 }) {
  const cp = SU.camera.position, P1 = 1 / brainHz;
  list.forEach((a, i) => { a.acc = 0; a.brainAcc = (i * 0.37) % P1; a.shadow = true; a.lod = 0; a.ctl ??= { target: 0, turnIn: 0, player: false, vol: 0 }; });
  return (dt, time) => {
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      a.brainAcc += dt;
      if (a.brainAcc >= P1) { a.brain(a, a.brainAcc); a.brainAcc -= P1; if (a.brainAcc > P1) a.brainAcc = 0; }
      const dx = a.s.x - cp.x, dz = a.s.z - cp.z, d2 = dx * dx + dz * dz;
      const per = d2 < 625 ? 0 : d2 < 3600 ? 1 / 12 : d2 < 16900 ? 0.25 : -1;
      a.lod = per;
      a.acc = Math.min(a.acc + dt, 0.3);
      if (per < 0 || a.acc < per) continue;
      a.ctl.vol = d2 < 900 ? (1 - Math.sqrt(d2) / 30) * 0.6 : 0;
      SU.updateRig(a.R, a.s, a.ctl, a.acc, time);
      constrain(a, rg, others);
      if (a.post) a.post(a, a.acc);
      a.acc = 0;
      if (a.cols) {
        const s = a.s, f = 0.45 * a.B.S, fx = Math.sin(s.yaw) * f, fz = Math.cos(s.yaw) * f;
        a.cols[0].x = s.x + fx; a.cols[0].z = s.z + fz; a.cols[1].x = s.x - fx; a.cols[1].z = s.z - fz;
      }
      const sh = d2 < 2025;
      if (sh !== a.shadow && a.R.mesh) { a.shadow = sh; a.R.mesh.castShadow = sh; }
    }
  };
}
export function addCols(SU, a) {
  a.cols = [0, 1].map(() => ({ type: 'horse', x: a.s.x, z: a.s.z, r: 0.55 * a.B.S, h: Infinity }));
  SU.world.colliders.push(...a.cols);
}
// head and ears toward a point (after updateRig wrote the pose): w 0..1
export function lookAt(a, x, z, w) {
  if (w < 0.01) return;
  const s = a.s, R = a.R;
  const ang = wrap(Math.atan2(x - s.x, z - s.z) - s.yaw), t = Math.max(-1, Math.min(1, ang / 1.6)) * w;
  R.neck.rotation.y += t * 0.55; R.head.rotation.y += t * 0.4;
  for (const e of R.ears) { e.rotation.x = e.userData.base - 0.15 * w; e.rotation.y = e.userData.sx * 0.1 + t * 0.4; }
}
