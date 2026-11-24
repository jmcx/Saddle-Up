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
| ↑ / ↓ | Riding: change gait: rein back, halt, walk, trot, gallop (↓ at a halt steps backwards) |
| ← / → | Riding: steer |
| Arrow keys on foot | Hold ↑ to walk forward (tap ↑ twice to run), hold ↓ to step back, ← → turn on the spot |
| Space | Jump |
| E | Get off and lead your horse on foot, get back on, or take the lead of the horse you're standing by (works on the move: the horse pulls up) |
| Q | Let go of the lead and leave the horse where it stands |
| P | Switch rider: Mélienette or Nanou |
| 1–5 | Fetch one of the five horses straight away (the one you had goes back to its box) |
| T | Time of day: dawn, day, golden hour, dusk |
| Y | Pick the weather: clear, cloudy, rain, fog (switches to manual weather) |
| U | Auto weather on/off |
| C | Change course: show-jumping arena, pony arena, cross-country, stable yard |
| R | Reset the course and score |
| M | Sound on/off |
| Drag / scroll | Orbit and zoom the camera |

On phones and tablets, on-screen buttons appear for steering, gait and jumping. Drag the scene to look around.

## Horses and riders

There are five horses you can ride. Each one lives in its own box in the stable, with its name on the box:

| # | Name | Breed | Type |
|---|---|---|---|
| 1 | Comet | Thoroughbred (bay) | Horse |
| 2 | Onyx | Friesian (black, feathered legs) | Horse |
| 3 | Pebble | Welsh Pony (dapple grey) | Pony |
| 4 | Biscuit | Shetland Pony (piebald) | Pony |
| 5 | Hazel | Donkey (grey-dun) | Donkey |

Smaller mounts take quicker, shorter strides and jump lower, so the ponies and the donkey suit the smaller fences.

You play as one of two riders. Pick them in the panel at the bottom left, or press P:

- **Mélienette:** green jacket, dark hair in a bun.
- **Nanou:** a bit smaller, blue jacket, blond hair with bangs.

Your rider stays the same size and in the same clothes whichever horse they ride.

## Jumping

- The stride meter at the bottom of the screen appears as you approach a fence. Press Space when the marker is in the green zone and it says "Jump now!".
- At a gallop that's about 5–9 m before the fence. At a trot you can only clear the smallest fences.
- Both the forehand and the hindquarters have to clear the fence.
- Just a little low: a rail falls (or you rap a solid fence) and you get a fault, but you keep going.
- Too early, too late or no jump at all: you crash or refuse, and the horse stops.
- Knocked rails go back up a few seconds after you ride away.

## Stable yard

West of the arenas is a stable yard. Press C until it says "Stable yard" to start there, facing the barn.

- **The barn** has twelve boxes with straw bedding, name plates and water buckets, a tack room (saddles on wall racks, bridles on hooks, a tack trunk and rugs) and a little office (desk and computer, filing cabinet, notice board). The five horses you can ride live in open boxes with hay; go in on foot to take one out.
- **The indoor arena** is a 20 × 40 m school with a sand floor, kickboards, dressage letters and two small jumps (I1 and I2).
- **Roofs fade** while you're inside a building so you can see what you're doing, and the camera stays inside the walls.
- **Walls are solid:** walking into one just stops you, but hitting one at a trot or faster counts as a crash.

### Hay

There's hay in the open boxes, in loose piles around the yard and in a round bale feeder. Walk your horse up to any of it and the horse stops, puts its head down and starts munching, turning its head towards the hay. The pile slowly goes down while it eats, and gets refilled a while after it's finished. Change gait to ride on. This works on foot too, so you can lead your horse to the hay.

## On foot

- **Get off (E)** at any pace and the horse pulls up while your rider hops down and leads the horse by the reins from its left shoulder. You can walk or jog alongside, but not jump. The stirrups are run up while nobody's riding.
- **Let go (Q)**, even while you're walking or jogging, and the horse stops and stays where you left it. It grazes, or eats any hay it can reach.
- **Walk around on your own:** hold ↑ to walk forward and ↓ to step back; let go to stop. Tap ↑ twice quickly to run. ← and → turn you on the spot (or steer while you walk).
- **Leading works the same way:** hold ↑ and the horse walks on with you, ↓ backs it up, ← → turn you both. A double-tap on ↑ makes you both jog.
- **Take a lead (E):** walk up to any of the five horses (in its box, or wherever you left it) and press E to take its lead. The first step is always to hold the lead; then press E again to get on.
- The number keys 1–5 are a shortcut: the horse you pick comes straight to you, and the one you had goes back to its box.
- Resetting the course (R) puts you back in the saddle.

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
