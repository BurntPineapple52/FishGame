// Chapter 4: wide, clear shallows under an open sky, and an eagle hunting
// them. Deep pools and weed beds are the only safe places.

import { DEPTH } from '../config';
import { Checkpoint, Goal } from '../entities/Checkpoint';
import { Hint } from '../entities/Decor';
import { Eagle, type Rect } from '../entities/Eagle';
import { LogSpawner } from '../entities/Log';
import { Fly, Roe } from '../entities/Pickups';
import { Rivergrass } from '../entities/Rivergrass';
import type { Pt } from '../physics/shapes';
import { buildRiver, contourY, PALETTES } from './kit';
import type { StageDef } from './types';

const WIDTH = 6400;
const SHALLOW = 470;
const POOL = 900;

/** Shallow bed with four steep-sided deep pools. */
const POOLS: [number, number][] = [[950, 1350], [2500, 2900], [3900, 4300], [5200, 5600]];
const BED: Pt[] = [[-200, SHALLOW]];
for (const [a, b] of POOLS) BED.push([a - 70, SHALLOW], [a, POOL], [b, POOL], [b + 70, SHALLOW]);
BED.push([WIDTH + 300, SHALLOW]);

/** Weed beds: hiding spots from the eagle. */
const WEEDS: [number, number][] = [[1800, 2100], [3300, 3600], [4650, 4950]];

export const talonRidge: StageDef = {
  id: 'talon',
  name: 'Talon Ridge',
  chapter: 'Chapter 4',
  story: [
    'The valley opens up. The water runs clear and shallow.',
    'Too clear. Something is circling.',
    'When you hear it call, get deep or get hidden.',
  ],
  music: { key: 'fish_theme', rate: 1.06 },
  ambience: { key: 'rushing_water', volume: 0.3 },
  xBounds: [-400, WIDTH + 400],
  par: 120,
  roeCount: 3,
  drying: 5,

  build(scene) {
    buildRiver(scene, {
      width: WIDTH,
      bed: BED,
      palette: PALETTES.afternoon,
      current: { speed: 3200, dir: [-1, 0] },
      water: { color: 0x0f4a6e, alpha: 0.6 },
      treeColors: [0x6a7f3a, 0x8a8a3a, 0x5a6f2a],
      clouds: 4,
    });

    scene.spawnFish({ x: 260, y: -60, rot: 0.4, depth: DEPTH.fish });
    scene.addEntity(new Hint(scene, { x: 560, y: -120, keys: [], text: 'Hear the cry? Dive into a deep pool\nor hide in the weeds!' }));

    const cover: Rect[] = [];
    for (const [a, b] of WEEDS) {
      for (let x = a; x <= b; x += 38) {
        scene.addEntity(new Rivergrass(scene, { x, y: SHALLOW + 6, length: 7 + (x % 3), depth: DEPTH.environment }));
      }
      cover.push({ x: (a + b) / 2, y: (140 + SHALLOW) / 2 + 40, w: b - a + 60, h: SHALLOW - 140 });
    }
    scene.addEntity(new Eagle(scene, { x0: 700, x1: WIDTH - 200, interval: [4, 6.5], cover }));
    scene.addEntity(new LogSpawner(scene, { x: 6000, y: -420, interval: 7, heights: [150, 170, 160], depth: DEPTH.environment }));

    scene.addEntity(new Checkpoint(scene, { x: 2700, y: POOL, spawnY: 620, order: 1 }));
    scene.addEntity(new Checkpoint(scene, { x: 4100, y: POOL, spawnY: 620, order: 2 }));
    for (const [x, y] of [[1700, 80], [3100, 75], [4500, 80], [5900, 85]]) scene.addEntity(new Fly(scene, x, y));
    Roe.create(scene, 1150, contourY(BED, 1150) - 40, 0);
    Roe.create(scene, 3450, 190, 1);
    Roe.create(scene, 5000, -110, 2);
    scene.addEntity(new Goal(scene, { x: 6250, top: -100, bottom: SHALLOW, markerY: 300 }));
  },
};
