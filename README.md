# Saddle Up

A 3D horse-riding and show-jumping game in a single HTML file, built with [three.js](https://threejs.org/).

Ride one of five mounts around a ten-fence show-jumping arena or a smaller pony arena, then head out over rolling hills to a cross-country course with a bank and a water jump. Time your jumps to go clear: run into a fence, rock or tree and your horse stops dead.

## Play

**Play online: https://jmcx.github.io/Saddle-Up/**

To run it locally, open `index.html` in a modern browser. Three.js loads from the jsDelivr CDN, so you need an internet connection.

If your browser blocks the page when it's opened straight from disk, serve the folder locally:

```bash
python3 -m http.server 8765
```

Then go to http://localhost:8765.

## Controls

| Key | Action |
|---|---|
| ↑ / ↓ | Change gait: rein back, halt, walk, trot, gallop (↓ at a halt steps backwards) |
| ← / → | Steer |
| Space | Jump |
| E | Get off and lead your horse on foot, or get back on (at a halt) |
| 1–5 | Change mount |
| T | Time of day: dawn, day, golden hour, dusk |
| Y | Pick the weather: clear, cloudy, rain, fog (switches to manual weather) |
| U | Auto weather on/off |
| C | Change course: show-jumping arena, pony arena, cross-country |
| R | Reset the course and score |
| M | Sound on/off |
| Drag / scroll | Orbit and zoom the camera |

On phones and tablets, on-screen buttons appear for steering, gait and jumping. Drag the scene to look around.

## Mounts

| # | Mount | Type | Rider |
|---|---|---|---|
| 1 | Thoroughbred (bay) | Horse | Adult, navy jacket |
| 2 | Friesian (black, feathered legs) | Horse | Adult, green jacket |
| 3 | Welsh Pony (dapple grey) | Pony | Teenager, red jacket |
| 4 | Shetland Pony (piebald) | Pony | Child, blue jacket |
| 5 | Donkey (grey-dun) | Donkey | Adult, tweed jacket |

Smaller mounts take quicker, shorter strides and jump lower, so the ponies and the donkey suit the smaller fences.

## Jumping

- The stride meter at the bottom of the screen appears as you approach a fence. Press Space when the marker is in the green zone and it says "Jump now!".
- At a gallop that's about 5–9 m before the fence. At a trot you can only clear the smallest fences.
- Both the forehand and the hindquarters have to clear the fence.
- Just a little low: a rail falls (or you rap a solid fence) and you get a fault, but you keep going.
- Too early, too late or no jump at all: you crash or refuse, and the horse stops.
- Knocked rails go back up a few seconds after you ride away.

## Leading on foot

Press E (or the Get off button) at a halt and your rider hops down and walks beside the horse's left shoulder, leading it by the reins in one hand, as you would in real life. The stirrups are run up so they don't swing about.

- Steer and change pace as normal, but only up to a trot: the rider jogs alongside.
- No jumping while you're on foot.
- Press E again at a halt to get back in the saddle. Resetting the course or changing mount also puts you back on.

## Pony arena

South of the main arena is a smaller arena with eight low fences (P1–P8, 0.4–0.5 m) for the ponies: a crossrail, verticals, two narrow oxers, a log, a wall and a hedge. They sit four down each long side, so the turns at the ends are clear.

The fences are about 16–17 m apart, which leaves time to land, settle and line up for the next one. They're sized so even the Shetland can clear every one at a full gallop. A Shetland, Welsh Pony, donkey and Thoroughbred each went clear round at a gallop in testing.

Press C or the Course button to ride there. You start lined up in front of P1.

## Cross-country

Ride east out of the arena to find nine cross-country obstacles (XC1–XC9) marked with red and white flags: logs, hedges, a stone wall, a table bank and a water jump. Ride with the red flag on your right.

- **Bank:** too high to walk up, so you have to jump onto it. Ride across the top and you drop off the far side.
- **Water:** jump the log into the pond. Wading slows the horse right down and throws up spray.

## The world

- **Weather:** starts on auto, where a new kind of weather rolls in about every 3 minutes (2½–3½) and blends in over about 30 seconds. Clear and cloudy skies come up most often, then rain, then fog. Pick a weather with Y or the weather button and it switches to manual, so it stays as you set it. Press U or the Auto/Manual button to switch back.

- **Rider:** sits a rising trot, folds forward over jumps, stays balanced when the horse pitches, and holds the reins to a bit and bridle.
- **Hoofprints:** they stay in the sand track and fade after about 45 seconds.
- **Wildlife:** birds peck in the grass and scatter when you gallop past, and three loose horses graze in a meadow to the west. They sometimes call back when your horse whinnies.
- **Sound:** hoof beats, snorts after a fast ride, breathing at the gallop, a whinny (or a bray) when you crash, wind at speed, birdsong, splashing and rain.

## How it works

- The horses and rider are built in code from smooth lofted shapes. Nothing is loaded from a model file.
- Each horse leg uses two-bone inverse kinematics, so hooves plant on the ground, even on slopes. Walk, trot and gallop each have a real footfall pattern and blend smoothly into one another. The rider's arms and legs use 3D two-bone IK.
- The terrain is one height function, shared by the ground mesh, the physics and (in GLSL) the grass shader.
- Every sound is synthesised with the Web Audio API.
