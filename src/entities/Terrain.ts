// Level-building helpers that mirror simple Godot nodes:
// StaticBody2D + RectangleShape2D, ColorRect, Area2D triggers, and sprite lists.

import { LAYER_1 } from '../config';
import type { PhysBody } from '../physics/PhysicsWorld';
import type { GameScene } from '../scenes/GameScene';
import { toWorld, type Xform } from '../util/xform';

export interface Rect {
  /** Centre and size, in the parent's local (unscaled) space. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A StaticBody2D with one rectangle shape. The body's scale scales the shape, as in Godot. */
export function addStaticRect(
  scene: GameScene,
  body: Xform,
  shape: Rect,
  opts: { layer?: number; mask?: number } = {},
): PhysBody {
  const sx = body.sx ?? 1;
  const sy = body.sy ?? 1;
  return scene.phys.createBody(
    { type: 'static', x: body.x, y: body.y, rot: body.rot, layer: opts.layer ?? LAYER_1, mask: opts.mask ?? LAYER_1 },
    [{ type: 'rect', x: shape.x * sx, y: shape.y * sy, w: shape.w * Math.abs(sx), h: shape.h * Math.abs(sy) }],
  );
}

/** A ColorRect given by its offsets (left, top, right, bottom) inside `parent`. */
export function addColorRect(
  scene: GameScene,
  parent: Xform,
  [left, top, right, bottom]: readonly [number, number, number, number],
  color: number,
  depth: number,
): void {
  const c = toWorld(parent, (left + right) / 2, (top + bottom) / 2);
  const w = (right - left) * Math.abs(parent.sx ?? 1);
  const h = (bottom - top) * Math.abs(parent.sy ?? 1);
  scene.add.rectangle(c.x, c.y, w, h, color).setRotation(parent.rot ?? 0).setDepth(depth);
}

/** An Area2D trigger. `onEnter` fires for each body that starts overlapping it. */
export function addZone(
  scene: GameScene,
  shape: Rect,
  opts: { layer?: number; mask?: number },
  onEnter: (body: PhysBody) => void,
): PhysBody {
  const zone = scene.phys.createBody(
    { type: 'static', x: shape.x, y: shape.y, sensor: true, layer: opts.layer ?? LAYER_1, mask: opts.mask ?? LAYER_1 },
    [{ type: 'rect', w: shape.w, h: shape.h }],
  );
  zone.onEnter = onEnter;
  return zone;
}

/** Place the same texture at many [x, y] positions (Godot Sprite2D, centred). */
export function addSprites(scene: GameScene, texture: string, positions: readonly (readonly [number, number])[], depth: number): void {
  for (const [x, y] of positions) scene.add.image(x, y, texture).setDepth(depth);
}
