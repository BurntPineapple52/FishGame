// Chapter 7: the gravel beds at the head of the river. No predators, no
// hurry: slow water, golden dawn light, and every salmon that made it.

import { DEPTH } from '../config';
import { Goal } from '../entities/Checkpoint';
import { DecorFish } from '../entities/Decor';
import { Fly, Roe } from '../entities/Pickups';
import { Rivergrass } from '../entities/Rivergrass';
import type { Pt } from '../physics/shapes';
import { randRange } from '../util/xform';
import { buildRiver, contourY, PALETTES } from './kit';
import type { StageDef } from './types';

const WIDTH = 3800;
const BED: Pt[] = [
  [-200, 640], [0, 640], [500, 700], [1100, 660], [1500, 720], [2100, 680], [2600, 640], [3100, 690], [3500, 700], [4100, 700],
];

export const spawningGrounds: StageDef = {
  id: 'spawning',
  name: 'Spawning Grounds',
  chapter: 'Chapter 7',
  story: [
    'The water tastes like home.',
    'Gravel, cold and clean, exactly as you left it.',
    'One last swim.',
  ],
  music: { key: 'fish_theme', rate: 0.85, volume: 0.9 },
  ambience: { key: 'rushing_water', volume: 0.15 },
  xBounds: [-400, WIDTH + 400],
  par: 60,
  roeCount: 3,
  drying: 3,

  build(scene) {
    buildRiver(scene, {
      width: WIDTH,
      bed: BED,
      palette: PALETTES.dawn,
      current: { speed: 700, dir: [-1, 0] },
      water: { color: 0x1d5a6a, alpha: 0.55 },
      bedEdge: 'pebbles',
      bedColor: 0x7a6a58,
      treeColors: [0x2f5a4a, 0x3f6a50, 0x284a40],
    });

    scene.spawnFish({ x: 260, y: -60, rot: 0.4, depth: DEPTH.fish });

    // Everyone who made it.
    for (let i = 0; i < 12; i++) {
      scene.addEntity(
        new DecorFish({
          scene,
          x0: -200,
          x1: WIDTH + 200,
          y: 300 + (i % 4) * 85,
          speed: randRange(15, 45) * (i % 3 === 0 ? -1 : 1),
          scale: randRange(0.35, 0.55),
          tint: 0x6a3a3a,
          alpha: 0.5,
        }),
      );
    }
    for (const x of [700, 760, 820, 1800, 1860, 2900, 2960, 3020]) {
      scene.addEntity(new Rivergrass(scene, { x, y: contourY(BED, x) + 6, length: 5, depth: DEPTH.environment }));
    }

    // Fireflies drifting over the water.
    let t = 0;
    scene.addEntity({
      update(dt) {
        t -= dt;
        if (t > 0) return;
        t = 0.12;
        const view = scene.cameras.main.worldView;
        scene.fx.glow(randRange(view.x, view.right), randRange(-200, 120), 1, 0xfff0a0);
      },
    });

    for (const [x, y] of [[900, 85], [1600, 80], [2300, 85], [3000, 80]]) scene.addEntity(new Fly(scene, x, y));
    Roe.create(scene, 760, 610, 0);
    Roe.create(scene, 1950, -80, 1);
    Roe.create(scene, 3000, 640, 2);

    // The nest: a ring of stones on the gravel.
    const nestX = 3450;
    const bedY = contourY(BED, nestX);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      scene.add
        .image(nestX + Math.cos(a) * 110, bedY + 10 + Math.sin(a) * -30, 'stone')
        .setScale(randRange(0.6, 0.9))
        .setDepth(DEPTH.environment);
    }
    scene.addEntity(new Goal(scene, { x: nestX, top: -100, bottom: bedY, markerY: bedY - 120 }));
  },
};
