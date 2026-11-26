// pasture feature: the animals that live loose at the club. See README.md in this folder.
//  - la stabulation libre: six ponies (names and coats in js/features/pasture/ponies.js, PONIES) living in the shed and its paddock
//  - le pré: the loose herd, a Selle Français mare and her foal, and turning a club horse out to grass (and catching it again)
// All of them are light rigs (one skinned mesh each) with distance LOD; see js/features/pasture/rig.js.
// SU.features.pasture = { ponies, pre: { mare, foal, out, turnOut(h), caught(h), isOut(h), watchFoal() } }
import { initPonies } from './pasture/ponies.js';
import { initPre } from './pasture/pre.js';

export function init(SU) {
  const ponies = initPonies(SU);
  const pre = initPre(SU);
  SU.features.pasture = { ponies, pre };
}
