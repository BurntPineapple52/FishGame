// Chapter 6: drought. The creek has shrunk to a chain of puddles across hot
// sand. Out of water you dry out fast; puddles revive you. Reaching the end
// brings the rain.

import { synth } from '../audio/synth';
import { DEPTH, LAYER_2 } from '../config';
import { Checkpoint, Goal } from '../entities/Checkpoint';
import { Hint } from '../entities/Decor';
import { addGround } from '../entities/Ground';
import { Fly, Roe } from '../entities/Pickups';
import { addStaticRect } from '../entities/Terrain';
import { Water } from '../entities/Water';
import type { Pt } from '../physics/shapes';
import { randRange } from '../util/xform';
import { addClouds, addHills, addSky, addSun, addTreeline, PALETTES } from './kit';
import type { StageDef } from './types';

const WIDTH = 6000;
const PUDDLE_TOP = 300;
const PUDDLE_BOTTOM = 170;
const PUDDLE_DEPTH = 125;

/** Puddle centres, left to right. */
const PUDDLES = [420, 900, 1380, 1880, 2330, 2850, 3330, 3820, 4300, 4820, 5300, 5760];

function groundY(x: number): number {
  return 400 + 22 * Math.sin(x / 310) + 12 * Math.sin(x / 97);
}

export const dryCreek: StageDef = {
  id: 'drycreek',
  name: 'Dry Creek',
  chapter: 'Chapter 6',
  story: [
    'No rain for weeks. The creek is barely a creek.',
    'Flop from puddle to puddle. The water will revive you.',
    'Smell that? A storm is coming. Just keep going.',
  ],
  music: { key: 'fish_theme', rate: 0.92 },
  ambience: null,
  xBounds: [-400, WIDTH + 400],
  par: 110,
  roeCount: 3,
  drying: 9,
  dryGrace: 1.5,
  waterHeal: 12,
  sky: 0x6aa7d8,

  build(scene) {
    const p = PALETTES.drought;
    addSky(scene, p);
    addSun(scene, p, 0.6, 0.15, 3.4);
    addHills(scene, { color: p.hillsFar, horizonY: 380, viewY: 380, scroll: 0.15, height: 200, width: WIDTH, seed: 2 });
    addHills(scene, { color: p.hillsNear, horizonY: 390, viewY: 380, scroll: 0.35, height: 110, width: WIDTH, seed: 17 });
    addClouds(scene, { count: 3, width: WIDTH, viewY: 380, tint: p.cloud });
    addTreeline(scene, { x0: -200, x1: WIDTH + 200, groundY: 385, spacing: [220, 520], colors: [0x7a6a3a, 0x8a7a4a, 0x6a5a30], seed: 31 });

    // Sand with puddle hollows.
    const pts: Pt[] = [[-400, groundY(-400)]];
    for (const c of PUDDLES) {
      const l = c - PUDDLE_TOP / 2;
      const r = c + PUDDLE_TOP / 2;
      const rim = Math.max(groundY(l), groundY(r));
      pts.push([l, groundY(l)], [c - PUDDLE_BOTTOM / 2, rim + PUDDLE_DEPTH], [c + PUDDLE_BOTTOM / 2, rim + PUDDLE_DEPTH], [r, groundY(r)]);
      // Ground between puddles, sampled for bumps.
      const next = PUDDLES[PUDDLES.indexOf(c) + 1] ?? WIDTH + 400;
      for (let x = r + 60; x < next - PUDDLE_TOP / 2 - 30; x += 70) pts.push([x, groundY(x)]);
    }
    pts.push([WIDTH + 400, groundY(WIDTH + 400)], [WIDTH + 400, 1400], [-400, 1400]);
    addGround(scene, { points: pts, color: 0xc9a36a, edge: 'sand', friction: 0.6 });

    for (const c of PUDDLES) {
      const l = c - PUDDLE_TOP / 2;
      const r = c + PUDDLE_TOP / 2;
      const rim = Math.max(groundY(l), groundY(r));
      scene.addEntity(
        new Water(scene, {
          x: l + 10,
          y: rim + 14,
          springSpacing: 20,
          springCount: Math.ceil((PUDDLE_TOP - 20) / 20) + 1,
          depth: PUDDLE_DEPTH,
          current: null,
          renderDepth: DEPTH.water,
          color: 0x3a6a7a,
          alpha: 0.75,
          chop: 3,
        }),
      );
    }

    const fishOnly = { layer: LAYER_2, mask: LAYER_2 };
    addStaticRect(scene, { x: -190, y: 0 }, { x: 0, y: 0, w: 300, h: 4000 }, fishOnly);
    addStaticRect(scene, { x: WIDTH + 190, y: 0 }, { x: 0, y: 0, w: 300, h: 4000 }, fishOnly);

    scene.camera.bounds = { left: 0, right: WIDTH, top: -260, bottom: 720 };

    // Heat: dust skittering across the sand.
    let dustTimer = 0;
    scene.addEntity({
      update(dt) {
        dustTimer -= dt;
        if (dustTimer > 0) return;
        dustTimer = randRange(0.2, 0.6);
        const view = scene.cameras.main.worldView;
        const x = randRange(view.x, view.right);
        scene.fx.dust(x, groundY(x) - 4, 3);
      },
    });

    scene.spawnFish({ x: PUDDLES[0], y: 300, rot: 0.2, depth: DEPTH.fish });
    scene.addEntity(new Hint(scene, { x: 700, y: 160, keys: ['f', 'p'], text: 'Flop between puddles!\nDry fish lose health fast.' }));

    scene.addEntity(new Checkpoint(scene, { x: 2600, y: groundY(2600), spawnX: 2850, spawnY: 470, order: 1 }));
    scene.addEntity(new Checkpoint(scene, { x: 4560, y: groundY(4560), spawnX: 4820, spawnY: 470, order: 2 }));
    for (const c of [900, 1880, 2850, 3820, 4820]) scene.addEntity(new Fly(scene, c, groundY(c) - 60));
    Roe.create(scene, 2090, groundY(2090) - 40, 0);
    Roe.create(scene, 3570, 180, 1);
    Roe.create(scene, 5300, groundY(5300) + 95, 2);

    let raining = false;
    scene.addEntity(
      new Goal(scene, {
        x: 5900,
        top: 0,
        bottom: 520,
        markerY: 280,
        onReach: () => {
          raining = true;
          scene.flash(0xffffff, 0.7, 400);
          synth.rumble(2);
          scene.shake(0.4);
        },
      }),
    );
    scene.addEntity({
      update(dt) {
        if (!raining || dt <= 0) return;
        const view = scene.cameras.main.worldView;
        for (let i = 0; i < 6; i++) scene.fx.streak(randRange(view.x, view.right + 300), view.y - 20, -250, 1500);
      },
    });
  },
};
