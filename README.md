# Saddle Up

A 3D horse-riding and show-jumping game in a single HTML file, built with [three.js](https://threejs.org/).

Ride one of five mounts around a ten-fence show-jumping arena or a smaller pony arena, then head out over rolling hills to a cross-country course with a bank and a water jump. Time your jumps to go clear: run into a fence, rock or tree and your horse stops dead.

Back at the yard, a French *ferme équestre*, you look after your horse, ride school figures in the manège, turn horses out to the pré, and revise for the **Galop 1** (the first French riding exam). The yard, the care activities and the Galop 1 trainer are in French.

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
| F | Do what the prompt at the bottom of the screen says (look after a horse, tighten the girth, choose a figure, sit down and revise…). You can also tap the prompt |
| P | Switch rider: Mélienette or Nanou |
| 1–5 | Fetch one of the five horses straight away (the one you had goes back to its box) |
| T | Time of day: dawn, day, golden hour, dusk |
| Y | Pick the weather: clear, cloudy, rain, fog (switches to manual weather) |
| U | Auto weather on/off |
| C | Change course: show-jumping arena, pony arena, cross-country, stable yard, trail course |
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

## Trail course

West of the stable is a fenced sand area with two trail obstacles. Press C until it says "Trail course" to start at its gateway.

- **Seesaw bridge:** a 5 m plank on a log pivot. Walk on at the end that's down (it's painted yellow at both ends). As your horse passes the middle, the plank tips over with a thump, and you walk off the other end. Crossing it end to end scores a clear; stepping off the side is a fault. The raised end is too high to step onto, so come at it from the low end.
- **Slalom:** six striped poles 6 m apart, with cones at each end. Weave through them on alternating sides, starting from either end, at a walk or a trot. A clean run shows your time and scores a clear. Each pole you pass on the wrong side, or knock over, is a fault. Knocked poles stand back up once you've ridden away.

Horses now turn a little tighter at a walk and trot (it makes the slalom possible at a trot), and the same as before at the gallop.

## The yard: la ferme équestre

West of the arenas is a farm riding school, inspired by the Ferme équestre du Loret near Nantes. Press C until it says "Stable yard" to start there. Signs are in French.

- **Le manège:** a covered 42 × 20 m school with a sand floor and big letters round the walls (A and C on the short sides, K-E-H and F-B-M on the long sides). No jumps: it's for figures (see below).
- **L'écurie:** boxes for the five horses you can ride, with their names, hay and a water bucket. Go in on foot to take one out. The **sellerie** (tack room) and the **bureau** open off the aisle.
- **Le club house:** in the stone farmhouse, with tables, posters and a hot-chocolate corner. Sit at the table to revise your Galop 1.
- **La stabulation libre:** an open shed and paddock where six ponies live loose: Frisette, Cowboy, Happy, Armstrong, Caramel and Réglisse. Walk up and press F to stroke one; the game tells you its coat.
- **Le pré:** a fenced field north of the yard, at the end of the track, with a shelter and a trough. The mare Hirondelle lives there with her foal, Filou.
- Also a hay barn with the feed room, a grooming bay, a round pen, a trough, a muck heap and a few hens.
- **Roofs fade** while you're inside a building, and the camera stays inside the walls.
- **Walls and fences are solid:** walking into one just stops you, but hitting one at a trot or faster counts as a crash.

### Looking after your horse

On foot, stand by a horse and press F ("S'occuper de…") for its care menu.

- **Tighten the girth (ressangler):** a horse fresh from its box has a loose girth, and you can't get on until you've tightened it. Resetting the course (R) or changing course (C) puts you straight in the saddle, so quick play is never blocked.
- **Grooming (pansage):** pick the tool and brush the horse: étrille first on the fleshy parts (never the head or legs), then the bouchon, then the brosse douce for the head and legs, and the cure-pieds for the feet. A wrong choice is explained, never punished. Horses get muddy with riding and shine after a good groom.
- **Feeding:** hay (fourrage) at the box, one ration of pellets (granulés) fetched from the feed room, and a treat or two (carrot or apple) on a flat hand. Too many pellets are refused.
- **Water:** each box bucket empties over time; refill it. A horse you're leading can also drink at the yard trough.
- **Tack:** saddle and bridle your horse step by step, or take the tack off (it then wears a halter). In the sellerie you choose the saddle, pad colour, leather and noseband, with the right size for a pony or a horse, and you clean the tack with water and glycerine soap.

### Safety: never walk behind a horse

On foot, if you go close behind a horse's hindquarters, it pins its ears back as a warning. Stay there and it kicks, and you wake up in hospital with a short lesson on how to go round a horse safely. It applies to every horse and pony, including the mare and foal. The horses in the écurie stand with their hindquarters to the box door: walk in (you speak to the horse as you come in) and pass along its shoulder; running in still surprises it.

### Figures in the manège

Ride (or lead) into the manège and a figure is traced on the sand. Follow the trace from its start gate and the game says the figure's name out loud in French and gives you one to three stars for precision.

- Press F ("Choisir une figure") to pick one, on either rein: volte, demi-volte, demi-volte renversée, diagonale, serpentine, cercle, doubler dans la largeur, doubler dans la longueur.
- "Suite libre" proposes them one after another. "Effacer" clears the trace: the game then recognises a volte, cercle, demi-volte, diagonale or serpentine that you ride on your own.

### Turning out to the pré

Lead a horse along the track into the pré and let go (Q), or press F at the gate. It grazes and wanders inside the fence until you come back and take its lead (E). Tack comes off before a horse is turned out. Press F by the fence ("Regarder le poulain") to watch the foal.

### Hay

There's hay in the open boxes, in loose piles around the yard and in a round bale feeder. Walk your horse up to any of it and the horse stops, puts its head down and starts munching, turning its head towards the hay. The pile slowly goes down while it eats, and gets refilled a while after it's finished. Change gait to ride on. This works on foot too, so you can lead your horse to the hay.

## Galop 1

The "Galop 1" button (top right), or the table in the club house, opens the trainer. Each rider has her own progress.

- **S'entraîner:** questions by chapter with the answer explained each time; ones you got wrong come back more often. The 139 questions follow the official FFE Galop 1 programme: general knowledge, knowing the horse, looking after it, working on foot, riding.
- **Les images:** name the parts of the body, legs, head and hoof, the coats (bai, alezan, noir, gris, pie, isabelle, palomino) and the white markings on the head and legs. Look first, then take the quiz.
- **Test blanc:** a 20-question mock exam, marked out of 20, with a review of your mistakes.
- **Je sais, je peux:** the self-assessment sheet.
- **Le parcours:** the steps of the practical test.

## Riding together

Two to four players can share the same yard, each on their own computer.

- One player clicks **À deux** (top right), then **Créer une partie**, and gets a four-letter code.
- The others click **À deux**, **Rejoindre une partie**, and type the code.

You see each other's horse and rider: gaits, jumps, getting on and off, leading and walking on foot, with a name above each friend.
Everything else stays personal: each player keeps their own stable horses, ponies, care, courses and Galop 1 progress, and
players pass through each other.

There is no game server. The browsers talk to each other directly (WebRTC); a free public broker ([PeerJS](https://peerjs.com))
is used for a second to introduce them, so both computers need Internet access at that moment. On the same Wi-Fi the game data
never leaves the house. It also works between two homes when the routers allow it. Guest Wi-Fi networks that isolate devices
from each other will block it.

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
- **Wildlife:** birds peck in the grass and scatter when you gallop past, and three loose horses graze in the pré. They sometimes call back when your horse whinnies.
- **Sound:** hoof beats, snorts after a fast ride, breathing at the gallop, a whinny (or a bray) when you crash, wind at speed, birdsong, splashing and rain.

## How it works

- The horses and rider are built in code from smooth lofted shapes. Nothing is loaded from a model file.
- Each horse leg uses two-bone inverse kinematics, so hooves plant on the ground, even on slopes. Walk, trot and gallop each have a real footfall pattern and blend smoothly into one another. The rider's arms and legs use 3D two-bone IK.
- The terrain is one height function, shared by the ground mesh, the physics and (in GLSL) the grass shader.
- The core game is the script in `index.html`. Everything added on top (care, safety, figures, Galop 1, the ponies and the pré) is a small module in `js/features/`; see `js/features/README.md`.
- Every sound is synthesised with the Web Audio API.
