// Title screen and flop tutorial (main_menu.tscn + Main_Menu.gd).
// The fish drops onto a ledge under the F L O P keycaps. Flop off the right
// edge into the water and the current carries you to the next stage.

import { LAYER_2 } from '../config';
import { Keycap } from '../entities/Keycap';
import { Rivergrass } from '../entities/Rivergrass';
import { addSprites, addStaticRect, addZone } from '../entities/Terrain';
import { Water } from '../entities/Water';
import { Fish } from '../entities/Fish';
import { input } from '../input';
import { addClouds, addFallingLeaves, addHills, addSky, addSun, PALETTES } from './kit';
import type { StageDef } from './types';

const DEPTH = { keycaps: 0, background: 1, water: 2, grass: 3, fish: 4 };
const CAMERA_CENTER = { x: 574, y: 475 };

const KEYCAPS = [
  { action: 'f', x: 455, y: 265, rot: -0.174533 },
  { action: 'l', x: 530, y: 256, rot: -0.0872665 },
  { action: 'o', x: 606, y: 256, rot: 0.0872665 },
  { action: 'p', x: 681, y: 265, rot: 0.174533 },
] as const;

/** [x, y, segments] */
const GRASS: [number, number, number][] = [
  [107, 820, 4], [181, 820, 2], [144, 820, 3], [66, 820, 3], [1041, 821, 4], [1115, 821, 2],
  [1078, 821, 3], [1000, 821, 3], [265, 844, 2], [292, 820, 2], [767, 836, 2], [794, 812, 2],
  [382, 820, 3], [415, 820, 4], [456, 820, 3],
];

export const mainMenu: StageDef = {
  id: 'title',
  name: 'The Last Run',
  isTitle: true,
  xBounds: [-200, 7600],
  music: { key: 'fish_theme', volume: 0.8 },
  ambience: { key: 'rushing_water', volume: 0.25 },

  build(scene) {
    const p = PALETTES.morning;
    addSky(scene, p);
    addSun(scene, p, 0.82, 0.12, 1.8);
    addHills(scene, { color: p.hillsFar, horizonY: 520, viewY: CAMERA_CENTER.y, scroll: 0.15, height: 200, width: 1600, seed: 5 });
    addHills(scene, { color: p.hillsNear, horizonY: 520, viewY: CAMERA_CENTER.y, scroll: 0.35, height: 110, width: 1600, seed: 9 });
    addClouds(scene, { count: 6, width: 1200, viewY: CAMERA_CENTER.y });
    addFallingLeaves(scene, 0.6);

    const cam = scene.camera;
    cam.speedZoom = false;
    cam.centerOn(CAMERA_CENTER.x, CAMERA_CENTER.y);

    for (const k of KEYCAPS) {
      scene.addEntity(
        new Keycap(scene, { ...k, texture: `keycap_${k.action}`, scale: 1.35, depth: DEPTH.keycaps }),
      );
    }

    addSprites(scene, 'background_sandtoland', [[-21, 685], [490, 685], [1002, 685], [1508, 684]], DEPTH.background);

    // Invisible ledge the fish lands on, and a wall on the left. Layer 2: only the fish hits them.
    const fishOnly = { layer: LAYER_2, mask: LAYER_2 };
    addStaticRect(scene, { x: 4, y: 507 }, { x: 589, y: 7.5, w: 1732, h: 45 }, fishOnly);
    addStaticRect(scene, { x: -296, y: 513, rot: 1.5708 }, { x: -759, y: -8, w: 1732, h: 45 }, fishOnly);

    scene.addEntity(
      new Water(scene, { x: -4, y: 574, current: { speed: 6000, dir: [1, 0] }, renderDepth: DEPTH.water, floaters: 3 }),
    );

    for (const [x, y, length] of GRASS) {
      scene.addEntity(new Rivergrass(scene, { x, y, length, depth: DEPTH.grass }));
    }

    // The title fish never uses a checkpoint and the camera stays put.
    const fish = scene.addEntity(new Fish(scene, { x: 420, y: -195, rot: 2.87281, depth: DEPTH.fish }));
    scene.fish = fish;
    cam.target = null;

    // Hold all four keys at once to peek to the right.
    scene.addEntity({
      update() {
        const all = input.isDown('f') && input.isDown('l') && input.isDown('o') && input.isDown('p');
        if (!scene.finished) cam.override = all ? { x: CAMERA_CENTER.x + 300, y: CAMERA_CENTER.y } : null;
      },
    });

    // Swept off to the right: pan after the fish, then on to the first stretch.
    let leaving = false;
    addZone(scene, { x: 1733, y: 930, w: 822, h: 760 }, fishOnly, () => {
      if (leaving) return;
      leaving = true;
      cam.override = { x: CAMERA_CENTER.x + 900, y: CAMERA_CENTER.y + 350, zoom: 1.1 };
      scene.time.delayedCall(500, () => scene.completeStage());
    });
  },
};
