// Chapter 1: a gentle first stretch that teaches swimming, steering, leaping
// for flies and checkpoints, with other salmon swimming alongside.

import { DEPTH } from '../config';
import { Checkpoint, Goal } from '../entities/Checkpoint';
import { DecorFish, Hint } from '../entities/Decor';
import { Fly, Roe } from '../entities/Pickups';
import { Rivergrass } from '../entities/Rivergrass';
import { createRock } from '../entities/Rock';
import type { Pt } from '../physics/shapes';
import { addFallingLeaves, buildRiver, contourY, PALETTES } from './kit';
import type { StageDef } from './types';

const WIDTH = 5200;
const BED: Pt[] = [
  [-200, 700], [0, 700], [600, 650], [1000, 540], [1250, 540], [1500, 640], [2000, 700], [2400, 700],
  [2560, 600], [2760, 600], [3000, 720], [3500, 760], [3850, 640], [4300, 540], [4700, 500], [5400, 490],
];

export const shallows: StageDef = {
  id: 'shallows',
  name: 'The Shallows',
  chapter: 'Chapter 1',
  story: [
    'Four summers at sea. Now the river calls you home.',
    'Upstream, to the gravel where you hatched.',
    'Your tail remembers how. Wiggle F and P. Steer with L and O.',
  ],
  music: { key: 'fish_theme' },
  ambience: { key: 'rushing_water', volume: 0.25 },
  xBounds: [-400, WIDTH + 400],
  par: 75,
  roeCount: 3,
  drying: 5,

  build(scene) {
    buildRiver(scene, { width: WIDTH, bed: BED, palette: PALETTES.morning, current: { speed: 2500, dir: [-1, 0] } });
    addFallingLeaves(scene, 0.5);

    scene.spawnFish({ x: 260, y: -60, rot: 0.6, depth: DEPTH.fish });

    // Tutorial hints, floating above the water.
    scene.addEntity(new Hint(scene, { x: 430, y: -110, keys: ['f', 'p'], text: 'Wiggle your tail to swim' }));
    scene.addEntity(new Hint(scene, { x: 1150, y: -110, keys: ['l', 'o'], text: 'Tilt your head to steer' }));
    scene.addEntity(new Hint(scene, { x: 1950, y: -130, keys: [], text: 'Swim fast toward the surface\nto leap for flies (they heal you!)' }));
    scene.addEntity(new Hint(scene, { x: 2650, y: -110, keys: [], text: 'Glowing cairns are checkpoints.\nHold R to return to one.' }));
    scene.addEntity(new Hint(scene, { x: 3700, y: -110, keys: [], text: "Don't stay out of the water too long..." }));

    for (const [x, len] of [[3150, 6], [3240, 8], [3330, 5], [3420, 7], [3520, 9], [3610, 6], [1580, 4], [1700, 5]] as const) {
      scene.addEntity(new Rivergrass(scene, { x, y: contourY(BED, x) + 6, length: len, depth: DEPTH.environment }));
    }
    createRock(scene, { x: 3950, y: contourY(BED, 3950) - 165, depth: DEPTH.environment });

    // Others on the run.
    for (let i = 0; i < 5; i++) {
      scene.addEntity(new DecorFish({ scene, x0: -200, x1: WIDTH + 200, y: 260 + i * 70, speed: 50 + i * 12, scale: 0.35 + i * 0.05 }));
    }

    scene.addEntity(new Checkpoint(scene, { x: 2660, y: 600, spawnY: 380, order: 1 }));
    for (const [x, y] of [[1950, 90], [2250, 80], [3400, 85], [4100, 80], [4800, 90]]) scene.addEntity(new Fly(scene, x, y));
    Roe.create(scene, 1480, 590, 0);
    Roe.create(scene, 3250, -70, 1);
    Roe.create(scene, 3560, 700, 2);
    scene.addEntity(new Goal(scene, { x: 5000, top: -100, bottom: 490, markerY: 300 }));
  },
};
