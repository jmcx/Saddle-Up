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
| `SU.world.places` | named spots in world coordinates: `yard, barn, aisle, tackRoom, office, arena {minX..maxZ, door, letters{A:{x,z}..}}, trough`, and (may be `null`) `clubhouse, stabulation, pasture, feedRoom, groomingBay` |
| `SU.horses` | the five rideable horses: `{ i, B (breed config), R (rig: R.root is its Group, R.tack its tack), s (state: x, z, yaw, speed, eatHay, graze, ...), box, name, cols }` |
| `SU.H`, `SU.st`, `SU.horse` | rig / state / entry of the horse you ride, lead or last held |
| `SU.player` | `{ mode: 'ride'|'lead'|'free'|'toLead'|'toRide'|'toTake', horse, x, z, yaw, size, group }` |
| `SU.personPos(out)` | where you are, on foot or mounted |
| `SU.buildHorse(B, opts)`, `SU.newRigState(x,z,yaw)`, `SU.updateRig(R, s, ctl, dt, time)` | make and animate more horses. `ctl = { target (m/s), turnIn (-1..1), player: false, vol }` |
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
