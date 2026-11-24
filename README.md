# Saddle Up

A 3D horse-riding and show-jumping game in a single HTML file, built with [three.js](https://threejs.org/).

Ride one of five mounts around a ten-fence course. Time your jumps to go clear: run into a fence, rock or tree and your horse stops dead.

## Play

Open `index.html` in a modern browser. Three.js loads from the jsDelivr CDN, so you need an internet connection.

If your browser blocks the page when it's opened straight from disk, serve the folder locally:

```bash
python3 -m http.server 8765
```

Then go to http://localhost:8765.

## Controls

| Key | Action |
|---|---|
| ↑ / ↓ | Change gait: halt, walk, trot, gallop |
| ← / → | Steer |
| Space | Jump |
| 1–5 | Change mount |
| R | Reset the course and score |
| M | Sound on/off |
| Drag / scroll | Orbit and zoom the camera |

## Mounts

| # | Mount | Type |
|---|---|---|
| 1 | Thoroughbred (bay) | Horse |
| 2 | Friesian (black, feathered legs) | Horse |
| 3 | Welsh Pony (dapple grey) | Pony |
| 4 | Shetland Pony (piebald) | Pony |
| 5 | Donkey (grey-dun) | Donkey |

Smaller mounts take quicker, shorter strides and jump lower, so the ponies and the donkey suit the smaller fences.

## Jumping

- Press Space about 5–9 m before a fence at a gallop, or about 3 m before at a trot.
- Both the forehand and the hindquarters have to clear the fence.
- Just a little low: a rail falls (or you rap a solid fence) and you get a fault, but you keep going.
- Too early, too late or no jump at all: you crash or refuse, and the horse stops.
- Knocked rails go back up a few seconds after you ride away.

## How it works

- The horse is built in code from smooth lofted shapes. Nothing is loaded from a model file.
- Each leg uses two-bone inverse kinematics, so hooves plant on the ground. Walk, trot and gallop each have a real footfall pattern and blend smoothly into one another.
- Hoof beats are synthesised with the Web Audio API.
