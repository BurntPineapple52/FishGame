// The river stage with the bear (bear_stage.tscn). The current pushes left;
// swim right past rocks, weeds and drifting logs to the bear.

import { COLORS, LAYER_1, LAYER_2 } from '../config';
import { Bear } from '../entities/Bear';
import { Checkpoint, Goal } from '../entities/Checkpoint';
import { LogSpawner } from '../entities/Log';
import { Fly, Roe } from '../entities/Pickups';
import { Rivergrass } from '../entities/Rivergrass';
import { createRock } from '../entities/Rock';
import { addColorRect, addStaticRect } from '../entities/Terrain';
import { Water } from '../entities/Water';
import type { Xform } from '../util/xform';
import { addClouds, addHills, addReveal, addSky, addSun, addTreeline, PALETTES } from './kit';
import type { StageDef } from './types';

const DEPTH = { background: 0, environment: 10, fish: 20, water: 30, ground: 40 };

/** stage.gd camera_xbounds / camera_ybounds */
const CAMERA_BOUNDS = { left: 0, right: 7600, top: -20, bottom: 1300 };

/** Background sprites in scene-tree order (later ones draw on top). */
const BACKGROUND: [string, number, number][] = [
  ['background_sandtoland', 256, 256], ['background_sandtoland', 766, 256],
  ...(
    [
      [256, 755], [4335, 758], [4845, 761], [5357, 758], [5867, 761], [6370, 762], [6880, 765],
      [7392, 762], [3313, 759], [3823, 762], [2801, 762], [2291, 759], [1788, 758], [1278, 755],
      [3595, 1181], [766, 758], [256, 1143], [766, 1146], [256, 1551], [766, 1554], [256, 1859],
      [766, 1862], [1238, 1150], [1748, 1153], [1238, 1558], [1748, 1561], [1238, 1866],
      [1748, 1869], [2104, 1151], [2614, 1154], [2104, 1559], [2614, 1562], [2104, 1867],
      [2614, 1870], [3086, 1158], [3086, 1566], [3596, 1569], [3086, 1874], [3596, 1877],
      [7417, 1194], [4078, 1156], [4588, 1159], [4078, 1564], [4588, 1567], [4078, 1872],
      [4588, 1875], [5060, 1163], [5570, 1166], [5060, 1571], [5570, 1574], [5060, 1879],
      [5570, 1882], [5926, 1164], [6436, 1167], [5926, 1572], [6436, 1575], [5926, 1880],
      [6436, 1883], [6908, 1171], [6908, 1579], [7418, 1582], [6908, 1887], [7418, 1890],
    ] as const
  ).map(([x, y]): [string, number, number] => ['sand', x, y]),
  ...(
    [
      [1278, 256], [1788, 256], [2291, 260], [2801, 260], [3313, 260], [3823, 260], [4335, 259],
      [4845, 259], [5357, 259], [5867, 259], [6370, 263], [6880, 263], [7392, 263],
    ] as const
  ).map(([x, y]): [string, number, number] => ['background_sandtoland', x, y]),
];

/** [x, y, segments] */
const GRASS: [number, number, number][] = [
  [1609, 1130, 5], [1525, 1130, 4], [1787, 1130, 8], [1973, 1130, 8], [2122, 1130, 6],
  [1692, 1130, 7], [1870, 1123, 7], [2056, 1130, 9], [2235, 1130, 5], [2325, 1130, 3],
  [2282, 1130, 5], [2182, 1130, 4], [2370, 1130, 8], [2424, 1130, 8], [2503, 1130, 6],
  [2558, 1130, 5], [2641, 1130, 3], [3261, 1130, 5], [3029, 1130, 2], [3083, 1130, 4],
  [3162, 1130, 6], [3217, 1130, 6], [3300, 1130, 5], [3369, 1130, 8], [3440, 1130, 8],
  [3502, 1130, 6], [3557, 1130, 5],
];

/** Sloped riverbed pieces: a scaled, sometimes rotated box with a matching ColorRect. */
const INCLINES: { body: Xform; shapeY: number }[] = [
  { body: { x: 4284, y: 1388, rot: -0.486947, sx: 1.55, sy: 2 }, shapeY: -2.67908 },
  { body: { x: 6580, y: 819, sx: 1.55, sy: 2 }, shapeY: -1.16043 },
];

/** Surface of the second incline, the shallows around the bear. */
const SHALLOWS_Y = 321;

export const bearStage: StageDef = {
  id: 'bear',
  name: 'Bear Crossing',
  chapter: 'Chapter 3',
  story: [
    'The river narrows into the shallows.',
    'Every salmon knows this place. Every bear does too.',
    'Wait for the swipe. Then go.',
  ],
  music: { key: 'fish_theme', rate: 1.05 },
  ambience: { key: 'rushing_water', volume: 0.35 },
  xBounds: [-200, 7600],
  par: 120,
  roeCount: 3,
  drying: 5,

  build(scene) {
    const p = PALETTES.noon;
    addSky(scene, p);
    addSun(scene, p);
    addHills(scene, { color: p.hillsFar, horizonY: 70, viewY: 304, scroll: 0.15, height: 220, width: 7600, seed: 4 });
    addHills(scene, { color: p.hillsNear, horizonY: 70, viewY: 304, scroll: 0.35, height: 130, width: 7600, seed: 8 });
    addClouds(scene, { count: 10, width: 7600, viewY: 304 });
    addTreeline(scene, { x0: -100, x1: 7700, groundY: 65, seed: 21 });
    for (const [texture, x, y] of BACKGROUND) scene.add.image(x, y, texture).setDepth(DEPTH.background);

    createRock(scene, { x: 2829, y: 948, depth: DEPTH.environment });
    createRock(scene, { x: 5032, y: 232, rot: -0.507891, friction: 1, depth: DEPTH.environment });
    scene.addEntity(new Bear(scene, { x: 6434, y: 160, depth: DEPTH.environment }));
    for (const [x, y, length] of GRASS) {
      scene.addEntity(new Rivergrass(scene, { x, y, length, depth: DEPTH.environment }));
    }

    scene.spawnFish({ x: 685, y: -574, depth: DEPTH.fish });

    scene.addEntity(
      new Water(scene, {
        x: 0,
        y: 140,
        springSpacing: 64,
        springCount: 128,
        depth: 1400,
        current: { speed: 4500, dir: [-1, 0] },
        renderDepth: DEPTH.water,
        rays: true,
        floaters: 8,
      }),
    );

    // Left wall (fish only, so logs drift out of the level) and the riverbed.
    const edge = { x: -642, y: -491 };
    addStaticRect(scene, edge, { x: 316, y: 492, w: 652, h: 6876 }, { layer: LAYER_2, mask: LAYER_2 });
    const bed = LAYER_1 | LAYER_2;
    addStaticRect(scene, edge, { x: 4647, y: 1796, w: 8742, h: 340 }, { layer: bed, mask: bed });
    addColorRect(scene, edge, [614, 1985, 8357, 2231], COLORS.black, DEPTH.ground);
    addColorRect(scene, edge, [636, 1805, 8367, 2001], COLORS.ground, DEPTH.ground);
    addColorRect(scene, edge, [636, 1625, 8367, 1821], COLORS.ground, DEPTH.ground);
    // Right wall past the goal.
    addStaticRect(scene, { x: 7700, y: 0 }, { x: 0, y: 0, w: 200, h: 3000 }, { layer: LAYER_2, mask: LAYER_2 });

    scene.addEntity(
      new LogSpawner(scene, {
        x: 4013,
        y: -496,
        interval: 2,
        heights: [700, 150, 400, 10, 600, 200, 300, 200],
        depth: DEPTH.environment,
      }),
    );

    for (const { body, shapeY } of INCLINES) {
      addStaticRect(scene, body, { x: 0, y: shapeY, w: 1722, h: 495.679 });
      addColorRect(scene, body, [-868, -249, 864, 242], COLORS.ground, DEPTH.ground);
    }

    // Progress, pickups and secrets.
    scene.addEntity(new Checkpoint(scene, { x: 2350, y: 1135, spawnY: 700, order: 1 }));
    scene.addEntity(new Checkpoint(scene, { x: 5650, y: SHALLOWS_Y, spawnY: 235, order: 2 }));
    for (const x of [1250, 1950, 3350, 4700, 6000, 7050]) scene.addEntity(new Fly(scene, x, 92));
    Roe.create(scene, 2600, 1070, 0);
    Roe.create(scene, 3060, 1080, 1);
    Roe.create(scene, 6640, 270, 2);
    scene.addEntity(new Goal(scene, { x: 7350, top: -20, bottom: SHALLOWS_Y, markerY: 230 }));

    addReveal(scene, { triggerX: 5250, x: 6480, y: 120, zoom: 0.8, seconds: 1.8, banner: 'THE BEAR' });

    scene.camera.bounds = { ...CAMERA_BOUNDS };
  },
};
