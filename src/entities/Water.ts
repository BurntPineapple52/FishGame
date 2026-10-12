// A body of water with a springy surface.
// Port of water_container.tscn: Water_Container_efficiencyattempt.gd (surface
// springs), Water.gd (area forces) and Water_Spring.gd (splashes).
//
// Bodies in the "physics" group that touch the water get heavy damping,
// a constant buoyancy force (unless "buoyant", which float themselves) and
// get pushed by the current.

import type * as Phaser from 'phaser';
import { COLORS, LAYER_1 } from '../config';
import type { PhysBody } from '../physics/PhysicsWorld';
import type { GameScene } from '../scenes/GameScene';
import { clamp } from '../util/xform';
import type { Entity } from './Entity';

// Surface springs (per physics tick, not per second, as in Godot)
const SPRING_K = 0.015;
const SPRING_DAMP = 0.03;
const SPREAD = 0.0002 / 1000;
/** Strength of the constant sine chop added to the surface every tick. */
const CHOP = 12;
/** Water_Border path smoothing (SmoothPath.spline_length). */
const SURFACE_SPLINE = 15;
const SAMPLES_PER_SEGMENT = 8;

// Splashes (Water_Spring.gd)
const SPLASH_FACTOR = 0.2;
const SPRING_AREA_HEIGHT = 10;

// Area forces (Water.gd)
const BUOYANCY = -2000;
const WATER_ANGULAR_DAMP = 50;
const WATER_LINEAR_DAMP = 4;
const LAND_ANGULAR_DAMP = 25;
const LAND_LINEAR_DAMP = 0;

export interface WaterOptions {
  /** Top-left of the water surface. */
  x: number;
  y: number;
  springSpacing?: number;
  springCount?: number;
  depth?: number;
  /** Set to null for still water. */
  current?: { speed: number; dir: readonly [number, number] } | null;
  renderDepth: number;
}

export class Water implements Entity {
  private readonly x: number;
  private readonly top: number;
  private readonly spacing: number;
  private readonly count: number;
  private readonly depth: number;
  private readonly current: WaterOptions['current'];
  /** Spring offsets from the rest surface, velocities, and heights at tick start. */
  private readonly offset: Float64Array;
  private readonly velocity: Float64Array;
  private readonly height: Float64Array;
  private t = 1;
  /** Bodies overlapping each spring's splash area last tick. */
  private overlaps = new Map<number, Set<PhysBody>>();
  /** Last body that splashed each spring (it can't splash it again until another does). */
  private readonly lastSplasher: (PhysBody | null)[];
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly surface: number[] = [];

  constructor(
    private scene: GameScene,
    opts: WaterOptions,
  ) {
    this.x = opts.x;
    this.top = opts.y;
    this.spacing = opts.springSpacing ?? 32;
    this.count = opts.springCount ?? 50;
    this.depth = opts.depth ?? 1000;
    this.current = opts.current === undefined ? { speed: 6000, dir: [-1, 0] } : opts.current;
    this.offset = new Float64Array(this.count);
    this.velocity = new Float64Array(this.count);
    this.height = new Float64Array(this.count);
    this.lastSplasher = new Array(this.count).fill(null);
    this.gfx = scene.add.graphics().setDepth(opts.renderDepth);

    const width = this.spacing * (this.count - 1);
    const area = scene.phys.createBody(
      {
        type: 'static',
        x: this.x + width / 2,
        y: this.top + this.depth / 2,
        sensor: true,
        layer: LAYER_1,
        mask: LAYER_1,
      },
      [{ type: 'rect', w: width, h: this.depth }],
    );
    area.onEnter = (b) => this.bodyEntered(b);
    area.onExit = (b) => this.bodyExited(b);
  }

  private currentMultiplier(b: PhysBody): number {
    if (b.is('litter')) return 0.2;
    if (b.is('waterplant')) return 0.07;
    if (b.mass > 30) return b.mass / 2;
    return 1;
  }

  /** Force the water applies to `b` while it's inside. */
  private forceOn(b: PhysBody): [number, number] {
    let fx = 0;
    let fy = b.is('buoyant') ? 0 : BUOYANCY;
    if (this.current) {
      const m = this.current.speed * this.currentMultiplier(b);
      fx += m * this.current.dir[0];
      fy += m * this.current.dir[1];
    }
    return [fx, fy];
  }

  private bodyEntered(b: PhysBody): void {
    if (!b.is('physics')) return;
    const [fx, fy] = this.forceOn(b);
    b.constantForce.x += fx;
    b.constantForce.y += fy;
    b.angularDamp = WATER_ANGULAR_DAMP;
    b.linearDamp = WATER_LINEAR_DAMP;
    b.inWater = true;
  }

  private bodyExited(b: PhysBody): void {
    if (!b.is('physics')) return;
    const [fx, fy] = this.forceOn(b);
    b.constantForce.x -= fx;
    b.constantForce.y -= fy;
    b.angularDamp = LAND_ANGULAR_DAMP;
    b.linearDamp = LAND_LINEAR_DAMP;
    b.inWater = false;
  }

  physicsUpdate(dt: number): void {
    const n = this.count;
    const { offset, velocity, height } = this;

    // Hooke's law on every spring.
    for (let i = 0; i < n; i++) {
      height[i] = offset[i];
      velocity[i] += -SPRING_K * offset[i] - SPRING_DAMP * velocity[i];
      offset[i] += velocity[i];
    }
    // Constant chop, plus (very weak) spreading to neighbours.
    const t = this.t;
    for (let i = 0; i < n; i++) {
      offset[i] +=
        0.2 * CHOP * Math.sin(2 * i + t) +
        0.3 * CHOP * Math.sin(i + 2 * t) +
        0.2 * CHOP * Math.sin(0.5 * i + 1.5 * t);
      if (i > 0) velocity[i - 1] += SPREAD * (height[i] - height[i - 1]);
      if (i < n - 1) velocity[i + 1] += SPREAD * (height[i] - height[i + 1]);
    }
    this.t += dt;

    this.detectSplashes();
  }

  /** Each spring has a small area; a body entering it pushes the spring down. */
  private detectSplashes(): void {
    const halfW = this.spacing / 4;
    const halfH = SPRING_AREA_HEIGHT / 2;
    const now = new Map<number, Set<PhysBody>>();

    for (const b of this.scene.phys.bodies) {
      if (b.type !== 'dynamic' || b.sensor || !(b.layer & LAYER_1)) continue;
      const bb = b.aabb();
      if (bb.maxY < this.top - 40 || bb.minY > this.top + 40) continue;
      const i0 = Math.max(0, Math.ceil((bb.minX - this.x - halfW) / this.spacing));
      const i1 = Math.min(this.count - 1, Math.floor((bb.maxX - this.x + halfW) / this.spacing));
      for (let i = i0; i <= i1; i++) {
        const sy = this.top + this.offset[i];
        if (bb.maxY < sy - halfH || bb.minY > sy + halfH) continue;
        let set = now.get(i);
        if (!set) now.set(i, (set = new Set()));
        set.add(b);
        if (!this.overlaps.get(i)?.has(b)) this.splash(i, b);
      }
    }
    this.overlaps = now;
  }

  private splash(i: number, b: PhysBody): void {
    if (this.lastSplasher[i] === b) return;
    this.lastSplasher[i] = b;
    this.velocity[i] += clamp(clamp(b.vy, 0, 1000) / 30, 10, 80) * SPLASH_FACTOR;
  }

  update(): void {
    const g = this.gfx;
    g.clear();

    // Only draw the part of the surface that's on screen.
    const view = this.scene.cameras.main.worldView;
    const first = Math.max(0, Math.floor((view.x - this.x) / this.spacing) - 1);
    const last = Math.min(this.count - 1, Math.ceil((view.right - this.x) / this.spacing) + 1);
    if (last <= first || view.bottom < this.top - 40 || view.y > this.top + this.depth) return;

    const pts = this.surface;
    pts.length = 0;
    for (let i = first; i < last; i++) this.sampleSegment(i, pts);
    pts.push(this.sx(last), this.sy(last));

    const bottom = this.top + this.depth;
    g.fillStyle(COLORS.water, COLORS.waterAlpha);
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) g.lineTo(pts[k], pts[k + 1]);
    g.lineTo(pts[pts.length - 2], bottom);
    g.lineTo(pts[0], bottom);
    g.closePath();
    g.fillPath();

    g.lineStyle(1, 0xffffff, 1);
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) g.lineTo(pts[k], pts[k + 1]);
    g.strokePath();
  }

  private sx(i: number): number {
    return this.x + i * this.spacing;
  }
  private sy(i: number): number {
    return this.top + this.offset[i];
  }

  /** Bezier handle at spring i: along the direction from i-1 to i+1 (none at the ends). */
  private handle(i: number): [number, number] {
    if (i <= 0 || i >= this.count - 1) return [0, 0];
    const dx = this.sx(i + 1) - this.sx(i - 1);
    const dy = this.sy(i + 1) - this.sy(i - 1);
    const len = Math.hypot(dx, dy) || 1;
    return [(dx / len) * SURFACE_SPLINE, (dy / len) * SURFACE_SPLINE];
  }

  /** Push points for the curve from spring i to i+1, excluding the end point. */
  private sampleSegment(i: number, out: number[]): void {
    const x0 = this.sx(i);
    const y0 = this.sy(i);
    const x3 = this.sx(i + 1);
    const y3 = this.sy(i + 1);
    const [ox, oy] = this.handle(i);
    const [ix, iy] = this.handle(i + 1);
    const x1 = x0 + ox;
    const y1 = y0 + oy;
    const x2 = x3 - ix;
    const y2 = y3 - iy;
    for (let s = 0; s < SAMPLES_PER_SEGMENT; s++) {
      const u = s / SAMPLES_PER_SEGMENT;
      const v = 1 - u;
      const a = v * v * v;
      const b = 3 * v * v * u;
      const c = 3 * v * u * u;
      const d = u * u * u;
      out.push(a * x0 + b * x1 + c * x2 + d * x3, a * y0 + b * y1 + c * y2 + d * y3);
    }
  }
}
