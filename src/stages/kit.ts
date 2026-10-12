// Shared scenery for building stages: sky gradients, parallax hills, clouds,
// the riverbank cross-section behind the water, treelines and camera reveals.

import type * as Phaser from 'phaser';
import { DEPTH, LAYER_2, VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { addGround, type GroundEdge } from '../entities/Ground';
import { addStaticRect } from '../entities/Terrain';
import { Water, type WaterOptions } from '../entities/Water';
import type { Pt } from '../physics/shapes';
import type { GameScene } from '../scenes/GameScene';
import { bus, EV, session } from '../session';
import { randRange } from '../util/xform';

/** Height of a left-to-right contour at x (linear between points). */
export function contourY(points: readonly Pt[], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}

export interface RiverOptions {
  /** Playable width; the river runs from x = 0 to width. */
  width: number;
  surfaceY?: number;
  /** Top of the riverbed, left to right (start a little left of 0, end past width). */
  bed: Pt[];
  palette: Palette;
  current?: { speed: number; dir: readonly [number, number] } | null;
  water?: Partial<WaterOptions>;
  bedColor?: number;
  bedEdge?: GroundEdge;
  treeColors?: number[];
  clouds?: number;
}

/**
 * A complete river stretch: sky, sun, hills, clouds, trees, the soil bank,
 * the water, the riverbed, invisible end walls for the fish, and camera bounds.
 */
export function buildRiver(scene: GameScene, o: RiverOptions): Water {
  const surface = o.surfaceY ?? 140;
  const deepest = Math.max(...o.bed.map(([, y]) => y));
  const bottom = deepest + 600;
  const p = o.palette;
  const viewY = surface + 160;

  addSky(scene, p);
  addSun(scene, p);
  addHills(scene, { color: p.hillsFar, horizonY: surface - 70, viewY, scroll: 0.15, height: 220, width: o.width, seed: 3 });
  addHills(scene, { color: p.hillsNear, horizonY: surface - 70, viewY, scroll: 0.35, height: 130, width: o.width, seed: 11 });
  addClouds(scene, { count: o.clouds ?? 8, width: o.width, viewY, tint: p.cloud });
  addTreeline(scene, { x0: -200, x1: o.width + 200, groundY: surface - 75, colors: o.treeColors });
  addRiverbank(scene, { x0: -400, x1: o.width + 400, surfaceY: surface, bottomY: bottom });

  const spacing = 64;
  const water = scene.addEntity(
    new Water(scene, {
      x: -300,
      y: surface,
      springSpacing: spacing,
      springCount: Math.ceil((o.width + 600) / spacing) + 1,
      depth: deepest - surface + 200,
      current: o.current === undefined ? { speed: 4000, dir: [-1, 0] } : o.current,
      renderDepth: DEPTH.water,
      rays: true,
      floaters: Math.round(o.width / 900),
      color: 0x0d4373,
      alpha: 0.6,
      ...o.water,
    }),
  );

  const first = o.bed[0];
  const last = o.bed[o.bed.length - 1];
  addGround(scene, {
    points: [[-400, first[1]], ...o.bed, [o.width + 400, last[1]], [o.width + 400, bottom], [-400, bottom]],
    color: o.bedColor ?? 0x6f5f4a,
    edge: o.bedEdge ?? 'pebbles',
  });

  // End walls: fish only, so logs drift out of the level.
  const fishOnly = { layer: LAYER_2, mask: LAYER_2 };
  addStaticRect(scene, { x: -190, y: surface }, { x: 0, y: 0, w: 300, h: 4000 }, fishOnly);
  addStaticRect(scene, { x: o.width + 190, y: surface }, { x: 0, y: 0, w: 300, h: 4000 }, fishOnly);

  scene.camera.bounds = { left: 0, right: o.width, top: surface - 420, bottom: deepest + 60 };
  return water;
}

export interface Palette {
  skyTop: number;
  skyBottom: number;
  hillsFar: number;
  hillsNear: number;
  cloud: number;
  /** Tint for the whole scene's light (sun glow). */
  sun?: number;
  water?: number;
  waterAlpha?: number;
}

export const PALETTES = {
  morning: {
    skyTop: 0x3a8cd5,
    skyBottom: 0xa9dcf5,
    hillsFar: 0x8fbfd8,
    hillsNear: 0x5f9f7a,
    cloud: 0xffffff,
    sun: 0xfff2c0,
  },
  noon: {
    skyTop: 0x2f7fd0,
    skyBottom: 0x8fd0f2,
    hillsFar: 0x7fb2cf,
    hillsNear: 0x4f8f64,
    cloud: 0xffffff,
    sun: 0xffffff,
  },
  afternoon: {
    skyTop: 0x4a86c8,
    skyBottom: 0xf3d9a8,
    hillsFar: 0x9aa9c0,
    hillsNear: 0x6a8a5a,
    cloud: 0xfff0dc,
    sun: 0xffe2a0,
  },
  sunset: {
    skyTop: 0x3b3f8c,
    skyBottom: 0xff9a6a,
    hillsFar: 0x7a5d8c,
    hillsNear: 0x4a4466,
    cloud: 0xffc0a0,
    sun: 0xffb070,
  },
  drought: {
    skyTop: 0x6aa7d8,
    skyBottom: 0xffe4a8,
    hillsFar: 0xd2b48a,
    hillsNear: 0xb08a5a,
    cloud: 0xfff4e0,
    sun: 0xfff0b0,
  },
  dawn: {
    skyTop: 0x2c3e74,
    skyBottom: 0xffc98a,
    hillsFar: 0x8d7ca6,
    hillsNear: 0x4f6a6a,
    cloud: 0xffd8b8,
    sun: 0xffd890,
  },
} satisfies Record<string, Palette>;

/** A full-screen vertical gradient fixed to the camera. */
export function addSky(scene: GameScene, p: Palette): void {
  scene.add
    .graphics()
    .setScrollFactor(0)
    .setDepth(DEPTH.sky)
    .fillGradientStyle(p.skyTop, p.skyTop, p.skyBottom, p.skyBottom, 1)
    .fillRect(-VIEW_WIDTH, -VIEW_HEIGHT * 0.6, VIEW_WIDTH * 3, VIEW_HEIGHT * 2.2);
}

/** Sun glow in the sky, barely moving with the camera. */
export function addSun(scene: GameScene, p: Palette, x = 0.75, y = 0.18, scale = 2.2): void {
  const sun = scene.add
    .image(VIEW_WIDTH * x, VIEW_HEIGHT * y, 'sun')
    .setScrollFactor(0.03, 0.03)
    .setDepth(DEPTH.sky + 1)
    .setScale(scale)
    .setTint(p.sun ?? 0xffffff)
    .setBlendMode('ADD');
  scene.tweens.add({ targets: sun, scale: scale * 1.05, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

/**
 * Rolling hill silhouettes. `horizonY` is the world y where the hill bases
 * should sit when the camera looks at `viewY`; parallax keeps them behind.
 */
export function addHills(
  scene: GameScene,
  opts: { color: number; horizonY: number; viewY: number; scroll: number; height: number; width: number; seed?: number },
): void {
  const s = opts.scroll;
  // Screen y of the base when the camera centre is at viewY, converted back to
  // this layer's coordinate space.
  const scrollY0 = opts.viewY - VIEW_HEIGHT / 2;
  const baseY = opts.horizonY - scrollY0 * (1 - s);
  const g = scene.add.graphics().setScrollFactor(s, s).setDepth(s < 0.3 ? DEPTH.hills : DEPTH.hills + 1);
  g.fillStyle(opts.color, 1);
  const x0 = -600;
  const x1 = opts.width * s + VIEW_WIDTH + 600;
  let seed = opts.seed ?? 1;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const a1 = r() * 10;
  const a2 = r() * 10;
  g.beginPath();
  g.moveTo(x0, baseY + 2000);
  for (let x = x0; x <= x1; x += 24) {
    const y =
      baseY -
      opts.height * (0.55 + 0.3 * Math.sin(x * 0.0021 + a1) + 0.15 * Math.sin(x * 0.0067 + a2));
    g.lineTo(x, y);
  }
  g.lineTo(x1, baseY + 2000);
  g.closePath();
  g.fillPath();
}

/** Clouds drifting slowly across a parallax layer. */
export function addClouds(scene: GameScene, opts: { count: number; width: number; viewY: number; tint?: number }): void {
  const s = 0.15;
  const scrollY0 = opts.viewY - VIEW_HEIGHT / 2;
  const clouds: Phaser.GameObjects.Image[] = [];
  const span = opts.width * s + VIEW_WIDTH + 800;
  for (let i = 0; i < opts.count; i++) {
    const c = scene.add
      .image(randRange(-400, span), randRange(30, 220) + scrollY0 * s, 'cloud')
      .setScrollFactor(s, s)
      .setDepth(DEPTH.clouds)
      .setScale(randRange(0.5, 1.2))
      .setAlpha(randRange(0.7, 0.95))
      .setTint(opts.tint ?? 0xffffff);
    c.setData('v', randRange(4, 14));
    clouds.push(c);
  }
  scene.addEntity({
    update(dt) {
      for (const c of clouds) {
        c.x += (c.getData('v') as number) * dt;
        if (c.x > span) c.x = -400;
      }
    },
  });
}

/**
 * The soil cross-section seen behind the water, as in the bear stage:
 * a grassy bank strip whose grass line sits 80 px above `surfaceY`,
 * then sand down to `bottomY`.
 */
export function addRiverbank(scene: GameScene, opts: { x0: number; x1: number; surfaceY: number; bottomY: number }): void {
  const w = opts.x1 - opts.x0;
  const top = opts.surfaceY - 140;
  scene.add.tileSprite(opts.x0, top, w, 512, 'background_sandtoland').setOrigin(0, 0).setDepth(DEPTH.background);
  const sandTop = top + 500;
  if (opts.bottomY > sandTop) {
    scene.add
      .tileSprite(opts.x0, sandTop, w, opts.bottomY - sandTop, 'sand')
      .setOrigin(0, 0)
      .setDepth(DEPTH.background);
  }
}

/** Cartoon trees standing on the bank behind the river. */
export function addTreeline(
  scene: GameScene,
  opts: { x0: number; x1: number; groundY: number; spacing?: [number, number]; colors?: number[]; seed?: number },
): void {
  const g = scene.add.graphics().setDepth(DEPTH.background - 1);
  const colors = opts.colors ?? [0x2f6b3a, 0x3f7f45, 0x285a33, 0x4a8a4a];
  const [smin, smax] = opts.spacing ?? [90, 260];
  let seed = opts.seed ?? 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = opts.x0 + r() * smax; x < opts.x1; x += smin + r() * (smax - smin)) {
    const h = 140 + r() * 220;
    const trunkW = 12 + r() * 10;
    g.fillStyle(0x5a3d26, 1);
    g.fillRect(x - trunkW / 2, opts.groundY - h * 0.5, trunkW, h * 0.5 + 20);
    const c = colors[Math.floor(r() * colors.length)];
    if (r() < 0.45) {
      // Conifer
      g.fillStyle(c, 1);
      for (let k = 0; k < 3; k++) {
        const ty = opts.groundY - h * (0.35 + k * 0.22);
        const tw = h * (0.38 - k * 0.09);
        g.fillTriangle(x - tw, ty + h * 0.12, x + tw, ty + h * 0.12, x, ty - h * 0.25);
      }
    } else {
      // Round canopy
      const cy = opts.groundY - h * 0.75;
      const rad = h * 0.28;
      g.fillStyle(c, 1);
      g.fillCircle(x, cy, rad);
      g.fillCircle(x - rad * 0.7, cy + rad * 0.3, rad * 0.75);
      g.fillCircle(x + rad * 0.7, cy + rad * 0.25, rad * 0.8);
      g.fillStyle(0xffffff, 0.08);
      g.fillCircle(x - rad * 0.3, cy - rad * 0.35, rad * 0.45);
    }
  }
}

/** Leaves drifting down across the screen. */
export function addFallingLeaves(scene: GameScene, perSecond = 0.8): void {
  let timer = 0;
  scene.addEntity({
    update(dt) {
      timer -= dt;
      if (timer > 0) return;
      timer = (1 / perSecond) * randRange(0.5, 1.5);
      const view = scene.cameras.main.worldView;
      scene.fx.leaf(randRange(view.x, view.right + 200), view.y - 30);
    },
  });
}

/**
 * The first time the fish passes `triggerX`, swing the camera over to show
 * something (a predator, the goal) for a moment, with a banner.
 */
export function addReveal(
  scene: GameScene,
  opts: { triggerX: number; x: number; y: number; zoom?: number; seconds?: number; banner?: string; onReveal?: () => void },
): void {
  // Don't replay reveals the player has already seen this attempt.
  if (session.checkpoint && session.checkpoint.x > opts.triggerX) return;
  let state: 'waiting' | 'showing' | 'done' = 'waiting';
  let left = opts.seconds ?? 1.6;
  scene.addEntity({
    update(_dt, realDt) {
      const fish = scene.fish;
      if (!fish || state === 'done') return;
      if (state === 'waiting' && fish.x > opts.triggerX) {
        state = 'showing';
        scene.camera.override = { x: opts.x, y: opts.y, zoom: opts.zoom ?? 0.85 };
        if (opts.banner) bus.emit(EV.boss, opts.banner);
        opts.onReveal?.();
      }
      if (state === 'showing') {
        left -= realDt;
        if (left <= 0) {
          state = 'done';
          scene.camera.override = null;
        }
      }
    },
  });
}
