# Feature modules

The core game is the inline module in `index.html`. Everything built on top of it lives here, one ES module per feature,
each exporting `init(SU)`. `index.html` loads them in order (`FEATURES` near the end of the script); a feature that throws
is logged and skipped, so it can never take the game down.

No build step, no dependencies: plain ES modules, three.js via `SU.THREE` (never import three yourself, it would load twice).

## The `SU` object

| | |
|---|---|
| `SU.THREE`, `SU.mergeGeometries`, `SU.scene`, `SU.camera`, `SU.renderer`, `SU.MOBILE` | rendering |
| `SU.util` | `clamp, lerp, damp, smooth, TAU` |
| `SU.world` | `groundH(x,z)`, `colliders`, `walls` (AABBs `{minX,maxX,minZ,maxZ}`), `fences`, `haySpots`, `roofs`, `interiors`, `stallBoxes`, `places`, `STABLE`, `TRAIL`, `COURSE`, `PONY_ARENA`, `MEADOW` |
| `SU.world.places` | named spots in world coordinates (boxes are `{minX,maxX,minZ,maxZ}`): `y` (yard ground height), `yard`, `barn`, `aisle`, `tackRoom {..box, door}`, `office {..box, door}`, `arena {..box, door, letters{A:{x,z}..}}`, `arenaLetters`, `trough`, `clubhouse {..box, door, seat{x,z,yaw}}`, `stabulation {..box (shed + paddock), shed (box), gate, hay (the two rack hay spots), spots [{x,z,yaw}]}`, `pasture {x, z, r, gate{x,z,yaw}, shelter, trough}`, `feedRoom {x,z}`, `groomingBay {x, z, yaw, spots [{x,z,yaw,wash}]}`, `roundPen {x, z, r, gate}`, `entrance {x,z}` (the yard's gateway). Features should still cope with a missing key |
| `SU.horses` | the five rideable horses: `{ i, B (breed config), R (rig: R.root is its Group, R.tack its tack), s (state: x, z, yaw, speed, eatHay, graze, ...), box, name, cols }` |
| `SU.H`, `SU.st`, `SU.horse` | rig / state / entry of the horse you ride, lead or last held |
| `SU.player` | `{ mode: 'ride'|'lead'|'free'|'toLead'|'toRide'|'toTake', horse, x, z, yaw, size, group }` |
| `SU.personPos(out)` | where you are, on foot or mounted |
| `SU.buildHorse(B, opts)`, `SU.newRigState(x,z,yaw)`, `SU.updateRig(R, s, ctl, dt, time)`, `SU.poseStanding(P, speed, dt, hold)` | make and animate more horses and people. `ctl = { target (m/s), turnIn (-1..1), player: false, vol }` |
| `SU.actions` | `actionE, letGo, takeLead(h), switchToHorse(i), setGait, setCourse, resetCourse, brakeHorse, sendHome(h), setPerson, placeFree, nearbyHorse, collidePerson, seatPerson, standAtLead, onModeChanged` |
| `SU.audio` | Web Audio helpers: `ctx, out, audioOk(), env, noiseHit, hoofSound, neigh, bray, snort, munch, muted` |
| `SU.toast(msg, 'info'|'good'|'bad'|'warn')` | the banner at the top (1.8 s, one line) |
| `SU.onUpdate(fn, { near: {x,z,r}, onRange, hz })` | per-frame callback, see below |
| `SU.on(event, fn)` / `SU.emit` | events: `mode (mode, prev)`, `reset`, `ready`; features may add their own |
| `SU.guards.mount` | push `(horse) => 'message'` to refuse getting on |
| `SU.keyHooks` | push `(key, event) => true` to swallow a key press |
| `SU.camOverride` | set to `(dt, time) => {}` to drive the camera yourself (cut-scenes); set back to `null` |
| `SU.ui` | `panel(opts)`, `menu(title, items, opts)`, `say(frenchText)`, `el(tag, cls, html)`, `topButton(label, title, action)` |
| `SU.interact.add({ id, label, icon, pos, radius, modes, when, action })` | a thing you can do where you stand: shows "F · label", F or a tap does it |
| `SU.store.get(key, def)` / `.set(key, val)` | saved progress (localStorage JSON) |
| `SU.modal`, `SU.pauseCount` | counters kept by `SU.ui.panel`: game keys are ignored while `modal > 0`, the world stops while `pauseCount > 0` |
| `SU.ready` | a promise that resolves once every feature has been initialised (`SU.emit('ready')` fires at the same time) |
| `SU.BREEDS`, `SU.PERSONS`, `SU.buildPerson`, `SU.horseOf(R)`, `SU.camFocus()`, `SU.gait`, `SU.course` | more of the core: breed and rider configs, the entry of a rig, what the camera follows, the current gait and course key |
| `SU.herd` | the three loose horses of the meadow `{ R, s, ... }`. `js/features/pasture` rebuilds them as light rigs and sets `SU.herdOwned = true`, which stands the core's herd update down |
| `SU.gfx` | for the quality governor: `maxPixelRatio`, `animLOD` (1 = full; less pulls the stable horses' animation-LOD distances in), `grass` (its `geometry.instanceCount` is the live blade count), `GRASS_N`, `sun`, `herd` |
| `SU.perf` | `js/features/perf.js`: `level` (0 = full quality), `levels`, `fps`, `auto`, `set(level \| 'auto')`, `batchRig(R)`, `batching(on)` and `occlusion(on)` (A/B switches for debugging), `occluded` (how many rigs the occlusion test hides now) |

### Rigs, batching and occlusion

`perf.js` merges each of the five club horses and the meadow herd into one skinned mesh per material at load. The original meshes
keep animating (updateRig, `.visible`, material colours all still work) but are moved to a layer the camera doesn't draw. A rig you
build **after load** with `SU.buildHorse` and leave in the scene for good should call `SU.perf.batchRig(R)` (optional, it only saves
draw calls). Don't call it on a rig that is already a single skinned mesh (`js/features/pasture/rig.js`'s `makeAnimal`) or on
temporary rigs rendered off-screen (the Galop pictures, the grooming picture), which are built, drawn once and disposed.
Swapping a part's `material` makes that part draw itself again; that is fine. Batched rigs are also hidden when an occlusion
query says they are fully behind walls (never when the camera is inside the rig's box or the rig can cast a shadow into view).

### What each feature exposes (`SU.features.<name>`)

| | |
|---|---|
| `galop` | `open()`: opens the Galop 1 trainer (also the "Galop 1" top button and the club-house seat) |
| `care` | `state(h)` (dirt, hunger, thirst, saddled, bridled, girthed, tackDirt, shine, water, look {saddle, pad, leather, noseband}...), `isTacked(h)`, `isGirthed(h)`, `setGirthed(h, v)`, `setTacked(h, v)`, `applyTack(h)`, `register(h)`, `openMenu(h)`, `groom(h)`, `feed(h, kind)`, `fillWater(h)`, `drinkTrough(h)`, `saddle(h)`, `unsaddle(h)`, `bridle(h)`, `unbridle(h)`, `ressangler(h)`, `chooser(h)`, `cleanTack(h)`, `deeds()`, `fx` (the 3D side: tack look, mud, buckets, hearts, sounds). Mounting is refused through `SU.guards.mount` until the horse is saddled, bridled and girthed; R/C and riding a horse count as tacked and girthed. Events: `SU.emit('care', kind, h)` |
| `safety` | `watch({ R, s, B, name })` (another feature's horse can kick too; returns the entry), `unwatch(obj)`, `kickNow(obj)`, `zone(entry, x, z)` (0 safe, 1 warning, 2 kick), `busy` (a kick is under way), `watched` |
| `figures` | `select(id, rein)`, `clear()`, `suite()`, `openMenu()`, `figures` (ids), `state` (`{ id, rein, phase, prog, total, stars, mean, trace, near }`). Event: `SU.emit('figure', id, stars)` |
| `pasture` | `ponies` (`{ list, rg, slots, trough }`, the stabulation ponies), `pre` (`{ mare, foal, light, all, out, rg, turnOut(h), caught(h, quiet), isOut(h), watchFoal(), scene }`). Events: `SU.emit('pasture', 'out' \| 'in', h)` |
| `multi` | riding together over WebRTC (PeerJS, loaded on demand): `host()` (resolves to the four-letter code), `join(code)`, `leave()`, `open()` (the panel), `status` (`off`, `opening`, `waiting`, `joining`, `on`), `code`, `role`, `ghosts` (id -> the friend's rig, state, person). A friend is a cached, batched horse rig driven by `updateRig` at the positions they send 15 times a second, shown 130 ms in the past so it moves evenly; `R.rider` puts their person on it. `?netlog` in the URL keeps PeerJS's log in `_test.log`. For other features: `send(msg)` (a small object to everyone in the game; the host passes it on), `onGame((id, msg) => {})`, `myId` (`host`, a guest's peer id, or `me` alone), `ids()` (host only: everyone) |
| `chrono` | the timed round, alone or against the friends of a shared game: `open()` (choose an arena), `call('main' \| 'pony')`, `lobby`, `race` (`{ c, order, riders: Map(id -> { n, time, faults, out }), phase, T, k, over }`). Messages over `multi.send`: `call`, `in`, `no`, `go` (host only, with the start order), `p` (fences done), `done` (time with 4 s per fault), `out`. Faults are read from `SU.score`. Best times in `SU.store` under `chrono.main` and `chrono.pony` |

## Rules

- **Language:** all new text shown to the player is in French, simple enough for a 7-10 year old. Code and comments in English.
- **Keys taken:** arrows/WASD, Space, E, Q, P, C, R, T, Y, U, M, 1-5, and **F = interact** (owned by `ui.js`). Don't bind new global keys;
  add an interaction instead, and put choices in a `SU.ui.menu`.
- **Performance is a requirement, not a nice-to-have.** The game must stay as smooth as before on a phone.
  - Per-frame work goes through `SU.onUpdate` with a `near` radius, so it costs nothing when you are elsewhere, and `hz` when it needn't run every frame.
  - Static scenery: merge geometry per material (`SU.mergeGeometries`) or use `InstancedMesh`. Aim for at most a handful of extra draw calls per feature. Share materials; no new lights; no per-frame allocation (reuse vectors).
  - Things only seen up close get `visible = false` when you leave (`onRange`). Canvas textures small (≤ 512 px) and created once.
  - DOM panels are built when opened and removed when closed.
  - Check with `__perf.run(300)` in the console before and after (mean ms per frame, draw calls, triangles).
- **Don't break the core:** edit `index.html` only where your brief says so, and keep edits small. The secret Space-hold move is never mentioned in any UI or doc.
- **Testing hooks:** `window.__horse` (`step(n)` advances n frames, `st`, `player`, `horses`, `actionE()`, `setCourse(i)`, `setCam(yawOff, pitch, dist)`...) and `window.SU`.
