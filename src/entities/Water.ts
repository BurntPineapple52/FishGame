// A body of water with a springy surface.
// Port of water_container.tscn: Water_Container_efficiencyattempt.gd (surface
// springs), Water.gd (area forces) and Water_Spring.gd (splashes).
//
// Bodies in the "physics" group that touch the water get heavy damping,
// a constant buoyancy force (unless "buoyant", which float themselves) and
// get pushed by the current.
//
// Also draws the polish: a depth gradient, a light band and foam line at the
// surface, sunbeams, current streaks, floating leaves, splash spray and sound.

import type * as Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { COLORS, DEPTH, LAYER_1 } from '../config';
import type { PhysBody } from '../physics/PhysicsWorld';
import type { GameScene } from '../scenes/GameScene';
import { clamp, pick, randRange } from '../util/xform';
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
/** Minimum vertical speed for spray and sound. */
const SPRAY_SPEED = 160;

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
  /** Fill colour and opacity (defaults to the original deep blue). */
  color?: number;
  alpha?: number;
  /** Sunbeams under the surface. */
  rays?: boolean;
  /** Leaves drifting on the surface. */
  floaters?: number;
  /** Faint lines showing the current. Default on when there is a current. */
  streaks?: boolean;
  /** Strength of the constant surface chop (default 12). */
  chop?: number;
}

interface Floater {
  x: number;
  img: Phaser.GameObjects.Image;
  phase: number;
}

export class Water implements Entity {
  private readonly x: number;
  private readonly top: number;
  private readonly spacing: number;
  private readonly count: number;
  private readonly depth: number;
  readonly current: WaterOptions['current'];
  /** Spring offsets from the rest surface, velocities, and heights at tick start. */
  private readonly offset: Float64Array;
  private readonly velocity: Float64Array;
  private readonly height: Float64Array;
  private t = 1;
  /** Bodies overlapping each spring's splash area last tick. */
  private overlaps = new Map<number, Set<PhysBody>>();
  /** Last body that splashed each spring (it can't splash it again until another does). */
  private readonly lastSplasher: (PhysBody | null)[];
  /** Last time each spring threw spray (ms). */
  private readonly lastFx: Float64Array;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly surface: number[] = [];
  private readonly color: number;
  private readonly alpha: number;
  private readonly rays: Phaser.GameObjects.Image[] = [];
  private readonly floaters: Floater[] = [];
  private readonly streaks: boolean;
  private readonly chop: number;
  private time = 0;
  private bubbleTimer = 0;

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
    this.lastFx = new Float64Array(this.count);
    this.color = opts.color ?? COLORS.water;
    this.alpha = opts.alpha ?? COLORS.waterAlpha;
    this.streaks = opts.streaks ?? !!this.current;
    this.chop = opts.chop ?? CHOP;
    this.gfx = scene.add.graphics().setDepth(opts.renderDepth);
    scene.waters.push(this);

    const width = this.width;

    // Darker toward the bottom: a static gradient under the animated surface.
    scene.add
      .graphics()
      .setDepth(opts.renderDepth)
      .fillGradientStyle(0x000814, 0x000814, 0x000814, 0x000814, 0, 0, 0.3, 0.3)
      .fillRect(this.x, this.top + 120, width, this.depth - 120);

    if (opts.rays) {
      for (let rx = this.x + 120; rx < this.x + width - 60; rx += randRange(220, 380)) {
        const ray = scene.add
          .image(rx, this.top, 'ray')
          .setOrigin(0.5, 0)
          .setDepth(DEPTH.rays)
          .setBlendMode('ADD')
          .setTint(0xcff3ff)
          .setScale(randRange(1.2, 2.4), Math.min(this.depth, 700) / 512)
          .setRotation(randRange(-0.25, 0.1));
        ray.setData('phase', Math.random() * Math.PI * 2);
        this.rays.push(ray);
      }
    }
    for (let n = 0; n < (opts.floaters ?? 0); n++) {
      const img = scene.add
        .image(0, 0, pick(['leaf1', 'leaf2']))
        .setDepth(opts.renderDepth + 1)
        .setScale(randRange(0.9, 1.4));
      this.floaters.push({ x: this.x + Math.random() * width, img, phase: Math.random() * 10 });
    }

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

  get width(): number {
    return this.spacing * (this.count - 1);
  }

  get left(): number {
    return this.x;
  }

  get right(): number {
    return this.x + this.width;
  }

  get surfaceY(): number {
    return this.top;
  }

  get bottomY(): number {
    return this.top + this.depth;
  }

  /** Does this water span x? */
  coversX(x: number): boolean {
    return x >= this.x && x <= this.right;
  }

  /** Is the point inside the water (below the animated surface)? */
  contains(x: number, y: number): boolean {
    return this.coversX(x) && y >= this.surfaceAt(x) && y <= this.bottomY;
  }

  /** Surface height at x, following the springs. */
  surfaceAt(x: number): number {
    const f = clamp((x - this.x) / this.spacing, 0, this.count - 1);
    const i = Math.floor(f);
    const j = Math.min(this.count - 1, i + 1);
    const t = f - i;
    return this.top + this.offset[i] * (1 - t) + this.offset[j] * t;
  }

  /** Push the surface around x, e.g. when the bear's paw slaps in. */
  disturb(x: number, amount: number): void {
    const i = Math.round((x - this.x) / this.spacing);
    for (let k = i - 2; k <= i + 2; k++) {
      if (k >= 0 && k < this.count) this.velocity[k] += amount * (1 - Math.abs(k - i) * 0.3);
    }
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
        0.2 * this.chop * Math.sin(2 * i + t) +
        0.3 * this.chop * Math.sin(i + 2 * t) +
        0.2 * this.chop * Math.sin(0.5 * i + 1.5 * t);
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

    // Spray and sound for things crossing the surface with some vertical speed.
    const vy = Math.abs(b.vy);
    if (vy < SPRAY_SPEED) return;
    const now = this.scene.time.now;
    if (now - this.lastFx[i] < 250) return;
    for (let k = Math.max(0, i - 2); k <= Math.min(this.count - 1, i + 2); k++) this.lastFx[k] = now;
    const power = clamp((vy - SPRAY_SPEED) / 900, 0, 1);
    this.scene.fx.splash(this.sx(i), this.sy(i), power);
    const heavy = b.mass > 30;
    audio.sfx('water_swish', {
      volume: 0.15 + power * 0.5 + (heavy ? 0.2 : 0),
      rate: heavy ? 0.65 : 1.15 - power * 0.3,
      throttleMs: 120,
    });
    if (power > 0.6) this.scene.shake(power * 0.15);
  }

  update(dt: number): void {
    const g = this.gfx;
    g.clear();
    this.time += dt;

    // Only draw the part of the surface that's on screen.
    const view = this.scene.cameras.main.worldView;
    this.updateDecor(dt, view);
    const first = Math.max(0, Math.floor((view.x - this.x) / this.spacing) - 1);
    const last = Math.min(this.count - 1, Math.ceil((view.right - this.x) / this.spacing) + 1);
    if (last <= first || view.bottom < this.top - 40 || view.y > this.top + this.depth) return;

    const pts = this.surface;
    pts.length = 0;
    for (let i = first; i < last; i++) this.sampleSegment(i, pts);
    pts.push(this.sx(last), this.sy(last));

    const bottom = Math.min(this.top + this.depth, view.bottom + 20);
    g.fillStyle(this.color, this.alpha);
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) g.lineTo(pts[k], pts[k + 1]);
    g.lineTo(pts[pts.length - 2], bottom);
    g.lineTo(pts[0], bottom);
    g.closePath();
    g.fillPath();

    // Lighter band just under the surface.
    g.fillStyle(0x9fdcff, 0.16);
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) g.lineTo(pts[k], pts[k + 1]);
    for (let k = pts.length - 2; k >= 0; k -= 2) g.lineTo(pts[k], pts[k + 1] + 16);
    g.closePath();
    g.fillPath();

    g.lineStyle(2.5, 0xffffff, 0.95);
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) g.lineTo(pts[k], pts[k + 1]);
    g.strokePath();
  }

  /** Sunbeams, current streaks, drifting leaves and the odd bubble. */
  private updateDecor(dt: number, view: Phaser.Geom.Rectangle): void {
    if (dt <= 0) return;
    for (const ray of this.rays) {
      const phase = ray.getData('phase') as number;
      ray.setAlpha(0.12 + 0.1 * Math.sin(this.time * 0.7 + phase));
      ray.setVisible(ray.x > view.x - 300 && ray.x < view.right + 300);
    }

    const x0 = Math.max(view.x, this.x);
    const x1 = Math.min(view.right, this.right);
    const y0 = Math.max(view.y, this.top + 20);
    const y1 = Math.min(view.bottom, this.bottomY - 10);
    if (x1 > x0 && y1 > y0) {
      if (this.streaks && this.current) {
        const rate = ((this.current.speed / 6000) * ((x1 - x0) * (y1 - y0))) / 40_000;
        const expected = rate * dt;
        const n = Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
        const v = this.current.speed / 22;
        for (let k = 0; k < n; k++) {
          this.scene.fx.streak(randRange(x0, x1), randRange(y0, y1), this.current.dir[0] * v, this.current.dir[1] * v);
        }
      }
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) {
        this.bubbleTimer = randRange(0.15, 0.5);
        this.scene.fx.bubbles(randRange(x0, x1), y1, 1);
      }
    }

    const drift = this.current ? (this.current.speed / 50) * this.current.dir[0] : 8;
    const width = this.width;
    for (const f of this.floaters) {
      f.x += drift * dt;
      if (f.x < this.x) f.x += width;
      if (f.x > this.right) f.x -= width;
      f.phase += dt;
      f.img.setPosition(f.x, this.surfaceAt(f.x) - 3).setRotation(Math.sin(f.phase * 1.3) * 0.3);
    }
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
