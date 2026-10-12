// Chapter 2: a faster river choked with driftwood. Logs float at different
// depths, so the safe line keeps changing.

import { DEPTH } from '../config';
import { Checkpoint, Goal } from '../entities/Checkpoint';
import { DecorFish, Hint } from '../entities/Decor';
import { LogSpawner } from '../entities/Log';
import { Fly, Roe } from '../entities/Pickups';
import { Rivergrass } from '../entities/Rivergrass';
import { createRock } from '../entities/Rock';
import type { Pt } from '../physics/shapes';
import { addFallingLeaves, buildRiver, contourY, PALETTES } from './kit';
import type { StageDef } from './types';

const WIDTH = 6000;
const BED: Pt[] = [
  [-200, 900], [0, 900], [800, 880], [1400, 820], [1600, 650], [2050, 650], [2300, 860], [3000, 900],
  [3600, 720], [4000, 720], [4250, 880], [5000, 900], [5500, 760], [6300, 760],
];

export const logJam: StageDef = {
  id: 'logjam',
  name: 'Log Jam',
  chapter: 'Chapter 2',
  story: [
    'A storm upriver has been busy.',
    'The current is stronger here, and full of driftwood.',
    'Logs ride at different depths. Find the gaps.',
  ],
  music: { key: 'fish_theme', rate: 1.03 },
  ambience: { key: 'rushing_water', volume: 0.4 },
  xBounds: [-400, WIDTH + 400],
  par: 100,
  roeCount: 3,
  drying: 5,

  build(scene) {
    buildRiver(scene, { width: WIDTH, bed: BED, palette: PALETTES.noon, current: { speed: 4200, dir: [-1, 0] } });
    addFallingLeaves(scene, 0.4);

    scene.spawnFish({ x: 260, y: -60, rot: 0.4, depth: DEPTH.fish });
    scene.addEntity(new Hint(scene, { x: 520, y: -120, keys: [], text: 'Logs! Duck under or slip between them.\nA fast log hurts.' }));

    scene.addEntity(
      new LogSpawner(scene, { x: 2700, y: -420, interval: 2.8, heights: [300, 160, 520, 220, 680, 260], depth: DEPTH.environment }),
    );
    scene.addEntity(
      new LogSpawner(scene, { x: 5800, y: -420, interval: 1.9, heights: [180, 420, 260, 620, 150, 360, 500], depth: DEPTH.environment }),
    );

    createRock(scene, { x: 3000, y: contourY(BED, 3000) - 165, depth: DEPTH.environment });
    createRock(scene, { x: 4900, y: contourY(BED, 4900) - 165, rot: 0.3, depth: DEPTH.environment });
    for (const x of [1700, 1780, 1880, 1960, 3700, 3790, 3880]) {
      scene.addEntity(new Rivergrass(scene, { x, y: contourY(BED, x) + 6, length: 4 + (x % 4), depth: DEPTH.environment }));
    }
    for (let i = 0; i < 3; i++) {
      scene.addEntity(new DecorFish({ scene, x0: -200, x1: WIDTH + 200, y: 380 + i * 110, speed: 35 + i * 15, scale: 0.4 }));
    }

    scene.addEntity(new Checkpoint(scene, { x: 2850, y: contourY(BED, 2850), spawnY: 450, order: 1 }));
    scene.addEntity(new Checkpoint(scene, { x: 4550, y: contourY(BED, 4550), spawnY: 450, order: 2 }));
    for (const [x, y] of [[1500, 85], [2500, 80], [3300, 90], [4800, 80], [5500, 85]]) scene.addEntity(new Fly(scene, x, y));
    Roe.create(scene, 1830, 600, 0);
    Roe.create(scene, 3900, 670, 1);
    Roe.create(scene, 5200, -90, 2);
    scene.addEntity(new Goal(scene, { x: 5850, top: -100, bottom: 760, markerY: 320 }));
  },
};
