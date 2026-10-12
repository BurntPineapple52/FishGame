// Chapter 5: a staircase of pools climbing a cliff at sunset. Bubbling jets
// at the foot of each waterfall launch you up to the next pool.

import { DEPTH, LAYER_2 } from '../config';
import { Checkpoint, Goal } from '../entities/Checkpoint';
import { Hint, Jet, Waterfall } from '../entities/Decor';
import { addGround } from '../entities/Ground';
import { Fly, Roe } from '../entities/Pickups';
import { Rivergrass } from '../entities/Rivergrass';
import { addStaticRect } from '../entities/Terrain';
import { Water } from '../entities/Water';
import type { Pt } from '../physics/shapes';
import { addClouds, addHills, addSky, addSun, PALETTES } from './kit';
import type { StageDef } from './types';

/** Each pool: left/right x, surface y, bottom y. The wall to its right rises to the next pool. */
interface Pool {
  x0: number;
  x1: number;
  surface: number;
  bottom: number;
}

const WALL = 100;
const POOLS: Pool[] = [
  { x0: -200, x1: 1000, surface: 1400, bottom: 1900 },
  { x0: 1100, x1: 2100, surface: 1150, bottom: 1620 },
  { x0: 2200, x1: 3200, surface: 900, bottom: 1370 },
  { x0: 3300, x1: 4300, surface: 650, bottom: 1120 },
  { x0: 4400, x1: 5900, surface: 400, bottom: 870 },
];
const WIDTH = 5800;
/** Jet push per fish part: strong lift, a nudge toward the wall. */
const JET_FORCE: [number, number] = [2600, -19500];

export const falls: StageDef = {
  id: 'falls',
  name: 'The Falls',
  chapter: 'Chapter 5',
  story: [
    'The river climbs. So must you.',
    'Salmon have leapt these falls for ten thousand years.',
    'Ride the bubbles at the foot of each fall, and jump.',
  ],
  music: { key: 'fish_theme', rate: 0.97 },
  ambience: { key: 'waterfall', volume: 0.55 },
  xBounds: [-400, WIDTH + 400],
  par: 120,
  roeCount: 3,
  drying: 5,
  sky: 0x3b3f8c,

  build(scene) {
    const p = PALETTES.sunset;
    addSky(scene, p);
    addSun(scene, p, 0.3, 0.35, 2.6);
    addHills(scene, { color: p.hillsFar, horizonY: 900, viewY: 1100, scroll: 0.15, height: 300, width: WIDTH, seed: 6 });
    addHills(scene, { color: p.hillsNear, horizonY: 950, viewY: 1100, scroll: 0.35, height: 180, width: WIDTH, seed: 13 });
    addClouds(scene, { count: 7, width: WIDTH, viewY: 1100, tint: p.cloud });

    // Cliff face behind the pools, stepped like the terrain but higher.
    const backdrop: Pt[] = [[-400, 2600], [-400, 1000]];
    for (const pool of POOLS) backdrop.push([pool.x0, pool.surface - 420], [pool.x1 + WALL, pool.surface - 420]);
    backdrop.push([WIDTH + 400, 0], [WIDTH + 400, 2600]);
    addGround(scene, { points: backdrop, color: 0x4a4060, edge: 'moss', depth: DEPTH.background, decorOnly: true });

    // Terrain: pool floors and the walls between them.
    const ground: Pt[] = [[-400, POOLS[0].bottom]];
    POOLS.forEach((pool, i) => {
      ground.push([pool.x0, pool.bottom], [pool.x1, pool.bottom]);
      const next = POOLS[i + 1];
      if (next) ground.push([pool.x1, next.surface - 10], [pool.x1 + WALL, next.surface - 10]);
    });
    ground.push([WIDTH + 400, POOLS[POOLS.length - 1].bottom], [WIDTH + 400, 2600], [-400, 2600]);
    addGround(scene, { points: ground, color: 0x5a5068, edge: 'moss' });

    POOLS.forEach((pool, i) => {
      const last = i === POOLS.length - 1;
      scene.addEntity(
        new Water(scene, {
          x: pool.x0,
          y: pool.surface,
          springSpacing: 50,
          springCount: Math.ceil((pool.x1 - pool.x0) / 50) + 1,
          depth: pool.bottom - pool.surface + 20,
          current: last ? { speed: 900, dir: [-1, 0] } : { speed: 1500, dir: [-1, 0] },
          renderDepth: DEPTH.water,
          color: 0x14406a,
          rays: true,
          floaters: 1,
        }),
      );
      const next = POOLS[i + 1];
      if (!next) return;
      // Falls pouring over the wall into this pool, and the jet at its foot.
      scene.addEntity(new Waterfall(scene, { x: pool.x1 - 18, top: next.surface - 10, bottom: pool.surface, width: 60 }));
      const jetX = pool.x1 - 210;
      const jetTop = pool.surface - 60;
      scene.addEntity(
        new Jet(scene, { x: jetX, y: (jetTop + pool.bottom) / 2, w: 150, h: pool.bottom - jetTop, force: JET_FORCE, style: 'bubbles', exitBoostX: 380 }),
      );
      for (const dx of [-420, -380, -330]) {
        scene.addEntity(new Rivergrass(scene, { x: pool.x1 + dx, y: pool.bottom + 4, length: 4, depth: DEPTH.environment }));
      }
    });

    const fishOnly = { layer: LAYER_2, mask: LAYER_2 };
    addStaticRect(scene, { x: -190, y: 1000 }, { x: 0, y: 0, w: 300, h: 4000 }, fishOnly);
    addStaticRect(scene, { x: WIDTH + 190, y: 0 }, { x: 0, y: 0, w: 300, h: 4000 }, fishOnly);

    scene.spawnFish({ x: 300, y: 1250, rot: 0.3, depth: DEPTH.fish });
    scene.addEntity(new Hint(scene, { x: 760, y: 1180, keys: [], text: 'Swim into the bubbles\nand leap up the falls!' }));

    scene.addEntity(new Checkpoint(scene, { x: 1500, y: POOLS[1].bottom, spawnY: 1350, order: 1 }));
    scene.addEntity(new Checkpoint(scene, { x: 2600, y: POOLS[2].bottom, spawnY: 1100, order: 2 }));
    scene.addEntity(new Checkpoint(scene, { x: 3700, y: POOLS[3].bottom, spawnY: 850, order: 3 }));
    for (const [x, y] of [[700, 1330], [1700, 1080], [2800, 830], [3900, 580], [5000, 330]]) scene.addEntity(new Fly(scene, x, y));
    Roe.create(scene, 300, 1840, 0);
    Roe.create(scene, 2050, 760, 1);
    Roe.create(scene, 4250, 300, 2);
    scene.addEntity(new Goal(scene, { x: 5550, top: 100, bottom: 870, markerY: 560 }));

    scene.camera.bounds = { left: 0, right: WIDTH, top: -100, bottom: 1950 };
  },
};
