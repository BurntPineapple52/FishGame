// Floating logs carried by the current, and the spawner that drops them in.
// Port of Log.gd and LogSpawner.gd. Each log floats at its own "water height",
// so logs end up at different depths (some even hover above the surface).

import { GRAVITY } from '../config';
import type { PhysBody } from '../physics/PhysicsWorld';
import type { Pt } from '../physics/shapes';
import type { GameScene } from '../scenes/GameScene';
import type { Entity } from './Entity';
import { Fish } from './Fish';

const LOG_HIT_SPEED = 650;
const LOG_DAMAGE = 12;

const LOG_POLYGON: Pt[] = [
  [153, -29], [158, -12], [158, 24], [155, 34], [147, 37], [104, 38], [97, 37], [89, 42],
  [83, 41], [32, 32], [-18, 31], [-58, 30], [-80, 29], [-108, 28], [-126, 27], [-142, 18],
  [-159, 1], [-158, -4], [-149, -14], [-143, -14], [-142, -29], [-135, -33], [-124, -40],
  [20, -37], [58, -36], [86, -39],
];

export interface LogOptions {
  x: number;
  y: number;
  /** The log floats so that its centre settles somewhat below this y. */
  waterHeight: number;
  floatForce?: number;
  /** Fraction of velocity lost per tick while submerged (0 = none, 1 = all). */
  drag?: number;
  angularDrag?: number;
  depth: number;
}

export class Log implements Entity {
  removed = false;
  readonly body: PhysBody;
  private readonly waterHeight: number;
  private readonly floatForce: number;
  private readonly drag: number;
  private readonly angularDrag: number;

  constructor(
    private scene: GameScene,
    opts: LogOptions,
  ) {
    this.waterHeight = opts.waterHeight;
    this.floatForce = opts.floatForce ?? 1;
    this.drag = opts.drag ?? 0.08;
    this.angularDrag = opts.angularDrag ?? 0.05;
    this.body = scene.phys.createBody(
      { x: opts.x, y: opts.y, mass: 55, groups: ['buoyant', 'physics', 'log'], owner: this },
      [{ type: 'poly', points: LOG_POLYGON }],
    );
    scene.attach(this.body, opts.depth, [scene.add.image(0, 0, 'log_4')]);

    // A log ramming the fish hard enough hurts.
    this.body.onEnter = (other) => {
      if (!(other.owner instanceof Fish)) return;
      const rel = Math.hypot(this.body.vx - other.vx, this.body.vy - other.vy);
      if (rel > LOG_HIT_SPEED) other.owner.takeDamage(LOG_DAMAGE, 'log');
    };
  }

  physicsUpdate(): void {
    const [minX, maxX] = this.scene.stage.xBounds;
    if (this.body.x < minX || this.body.x > maxX) {
      this.scene.phys.destroyBody(this.body);
      this.removed = true;
      return;
    }
    const depth = this.body.y - this.waterHeight;
    if (depth > 0) {
      this.body.applyForce(0, -this.floatForce * GRAVITY * depth);
      this.body.scaleVelocity(1 - this.drag, 1 - this.angularDrag);
    }
  }
}

export interface LogSpawnerOptions {
  x: number;
  y: number;
  /** Seconds between logs (spawn_rate). */
  interval?: number;
  /** Float heights, used in order and repeated. */
  heights?: readonly number[];
  depth: number;
}

export class LogSpawner implements Entity {
  /** The Godot Timer started with its default 1 s before spawn_rate applied. */
  private timer = 1;
  private spawned = 0;

  constructor(
    private scene: GameScene,
    private opts: LogSpawnerOptions,
  ) {}

  physicsUpdate(dt: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer += this.opts.interval ?? 3;

    const heights = this.opts.heights ?? [300, 150, 300, 10, 600, 200, 600, 200, 1000, 40];
    this.scene.addEntity(
      new Log(this.scene, {
        x: this.opts.x,
        y: this.opts.y,
        waterHeight: heights[this.spawned % heights.length],
        floatForce: 0.5,
        drag: 0.08,
        depth: this.opts.depth,
      }),
    );
    this.spawned++;
  }
}
