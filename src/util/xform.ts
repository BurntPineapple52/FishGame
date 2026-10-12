// 2D transform helpers for laying out levels the way Godot scenes nest nodes.

export interface Vec {
  x: number;
  y: number;
}

/** Position, rotation (radians, clockwise on screen) and scale, like a Node2D. */
export interface Xform {
  x: number;
  y: number;
  rot?: number;
  sx?: number;
  sy?: number;
}

/** Local point -> world point through `xf` (scale, then rotate, then translate). */
export function toWorld(xf: Xform, lx: number, ly: number): Vec {
  const px = lx * (xf.sx ?? 1);
  const py = ly * (xf.sy ?? 1);
  const c = Math.cos(xf.rot ?? 0);
  const s = Math.sin(xf.rot ?? 0);
  return { x: xf.x + px * c - py * s, y: xf.y + px * s + py * c };
}

/** World transform of a child node given its parent's world transform. */
export function compose(parent: Xform, child: Xform): Xform {
  const p = toWorld(parent, child.x, child.y);
  return {
    x: p.x,
    y: p.y,
    rot: (parent.rot ?? 0) + (child.rot ?? 0),
    sx: (parent.sx ?? 1) * (child.sx ?? 1),
    sy: (parent.sy ?? 1) * (child.sy ?? 1),
  };
}

const TAU = Math.PI * 2;

/** Godot's angle_difference(from, to): shortest signed angle from `from` to `to`. */
export function angleDifference(from: number, to: number): number {
  const d = (to - from) % TAU;
  return ((2 * d) % TAU) - d;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function randRange(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
