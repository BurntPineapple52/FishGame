// Static terrain from a polygon outline in world pixels. Concave outlines are
// fine (shapes.ts splits them into convex pieces). Drawn once into a Graphics
// object: a fill, speckles, a darker outline, and a decorated top edge.

import * as Phaser from 'phaser';
import { DEPTH, LAYER_1, LAYER_2 } from '../config';
import type { PhysBody } from '../physics/PhysicsWorld';
import type { Pt } from '../physics/shapes';
import type { GameScene } from '../scenes/GameScene';

export type GroundEdge = 'grass' | 'pebbles' | 'sand' | 'moss' | 'none';

export interface GroundOptions {
  points: readonly Pt[];
  color?: number;
  /** Speckle colours scattered through the fill. */
  speckles?: number[];
  edge?: GroundEdge;
  depth?: number;
  friction?: number;
  /** Collide with logs and debris too (layer 1), not just the fish. */
  solidForAll?: boolean;
  /** Only draw it (background cliffs). */
  decorOnly?: boolean;
}

/** Seeded RNG so a stage looks the same every time it's rebuilt. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100_000) / 100_000;
  };
}

export function pointInPolygon(x: number, y: number, pts: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function shade(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((color & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

export function addGround(scene: GameScene, opts: GroundOptions): PhysBody | null {
  const pts = opts.points;
  const both = LAYER_1 | LAYER_2;
  const body = opts.decorOnly
    ? null
    : scene.phys.createBody(
    {
      type: 'static',
      x: 0,
      y: 0,
      friction: opts.friction ?? 0.8,
      layer: both,
      mask: opts.solidForAll === false ? LAYER_2 : both,
      groups: ['ground'],
    },
    [{ type: 'poly', points: pts }],
  );

  const color = opts.color ?? 0x917e60;
  const g = scene.add.graphics().setDepth(opts.depth ?? DEPTH.ground);
  g.fillStyle(color, 1);
  g.fillPoints(pts.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);

  // Speckles inside the shape.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const rand = rng(Math.round(minX * 7 + minY * 13 + pts.length));
  const speckles = opts.speckles ?? [shade(color, 0.8), shade(color, 1.15), shade(color, 0.65)];
  const count = Math.min(1600, ((maxX - minX) * (maxY - minY)) / 1800);
  for (let i = 0; i < count; i++) {
    const x = minX + rand() * (maxX - minX);
    const y = minY + rand() * (maxY - minY);
    if (!pointInPolygon(x, y, pts)) continue;
    g.fillStyle(speckles[Math.floor(rand() * speckles.length)], 0.8);
    const r = 1.5 + rand() * 4;
    g.fillEllipse(x, y, r * 2.2, r * 1.4);
  }

  // Outline
  g.lineStyle(4, shade(color, 0.55), 1);
  g.strokePoints(pts.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true, true);

  // Decorate edges that face up (outward normal pointing up).
  const edge = opts.edge ?? 'grass';
  if (edge !== 'none') {
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 1) continue;
      let nx = (by - ay) / len;
      let ny = -(bx - ax) / len;
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      if (pointInPolygon(mx + nx * 3, my + ny * 3, pts)) {
        nx = -nx;
        ny = -ny;
      }
      if (ny > -0.45) continue;
      decorateEdge(g, edge, ax, ay, bx, by, len, rand);
    }
  }
  return body;
}

function decorateEdge(
  g: Phaser.GameObjects.Graphics,
  edge: GroundEdge,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  len: number,
  rand: () => number,
): void {
  const dx = (bx - ax) / len;
  const dy = (by - ay) / len;
  switch (edge) {
    case 'grass':
    case 'moss': {
      const dark = edge === 'grass' ? 0x3f8a2a : 0x3c6b3a;
      const light = edge === 'grass' ? 0x6cc040 : 0x5e9a52;
      g.lineStyle(12, dark, 1);
      g.lineBetween(ax, ay + 4, bx, by + 4);
      g.lineStyle(5, light, 1);
      g.lineBetween(ax, ay, bx, by);
      for (let d = 0; d < len; d += 6 + rand() * 10) {
        const x = ax + dx * d;
        const y = ay + dy * d;
        const h = 6 + rand() * (edge === 'grass' ? 14 : 6);
        g.lineStyle(2.5, rand() < 0.5 ? dark : light, 1);
        g.lineBetween(x, y + 2, x + (rand() - 0.5) * 8, y - h);
      }
      break;
    }
    case 'pebbles': {
      for (let d = 0; d < len; d += 7 + rand() * 12) {
        const x = ax + dx * d;
        const y = ay + dy * d;
        const w = 8 + rand() * 16;
        const c = [0x8b8781, 0x6d6a66, 0xa49c90, 0x7a6f62][Math.floor(rand() * 4)];
        g.fillStyle(c, 1);
        g.fillEllipse(x, y + 2, w, w * 0.6);
        g.fillStyle(0xffffff, 0.18);
        g.fillEllipse(x - w * 0.15, y - w * 0.05, w * 0.4, w * 0.18);
      }
      break;
    }
    case 'sand': {
      g.lineStyle(6, 0xe8cf9a, 1);
      g.lineBetween(ax, ay + 2, bx, by + 2);
      for (let d = 0; d < len; d += 20 + rand() * 40) {
        const x = ax + dx * d;
        const y = ay + dy * d;
        g.fillStyle(0xb79b6a, 1);
        g.fillCircle(x, y + 6, 1.5 + rand() * 2);
      }
      break;
    }
  }
}
