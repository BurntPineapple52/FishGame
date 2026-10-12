// A strand of river weed: a chain of light segments pinned to a static root,
// with random sideways nudges so it sways. Port of rivergrass.gd.
// Underwater, buoyancy holds the strand upright.

import type { PhysBody } from '../physics/PhysicsWorld';
import type { GameScene } from '../scenes/GameScene';
import { pick, randRange } from '../util/xform';
import type { Entity } from './Entity';

const SEGMENT_TEXTURES = ['riverweed_segment_1', 'riverweed_segment_2', 'riverweed_segment_3'];
const END_TEXTURES = ['riverweed_end_1', 'riverweed_end_2'];
const SEGMENT_HEIGHT = 36;
const IMPULSE_STRENGTH = 200;
const NUDGE_INTERVAL = 0.2;
const NUDGE_RANDOM = 0.2;
/** Strands further than this outside the view stop swaying, so the physics can put them to sleep. */
const SWAY_MARGIN = 500;

export interface RivergrassOptions {
  /** Root of the strand (the bottom). */
  x: number;
  y: number;
  /** Number of segments, including the end piece. */
  length?: number;
  depth: number;
}

export class Rivergrass implements Entity {
  private readonly segments: PhysBody[] = [];
  /** Godot Timer default wait_time is 1 s for the first nudge. */
  private timer = 1;
  private nudgePending = false;
  private readonly x: number;
  private readonly bottom: number;
  private readonly top: number;

  constructor(
    private scene: GameScene,
    opts: RivergrassOptions,
  ) {
    const length = opts.length ?? 4;
    this.x = opts.x;
    this.bottom = opts.y;
    this.top = opts.y - SEGMENT_HEIGHT * length;
    let last = scene.phys.createBody({ type: 'static', x: opts.x, y: opts.y }, [{ type: 'rect', w: 2, h: 2 }]);

    for (let n = 0; n < length; n++) {
      const segment = scene.phys.createBody(
        {
          x: opts.x,
          y: opts.y - SEGMENT_HEIGHT * n - SEGMENT_HEIGHT / 2,
          mass: 0.8,
          gravityScale: 0.3,
          groups: ['physics', 'waterplant'],
        },
        [{ type: 'rect', w: 4, h: SEGMENT_HEIGHT }],
      );
      scene.phys.createPin(last, segment, opts.x, opts.y - SEGMENT_HEIGHT * n, {
        limit: [-Math.PI / 4, Math.PI / 4],
      });
      const texture = pick(n === length - 1 ? END_TEXTURES : SEGMENT_TEXTURES);
      scene.attach(segment, opts.depth, [scene.add.image(0, 0, texture)]);
      this.segments.push(segment);
      last = segment;
    }
  }

  physicsUpdate(dt: number): void {
    if (this.nudgePending) {
      this.nudgePending = false;
      pick(this.segments).applyImpulse(-IMPULSE_STRENGTH, 0);
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer += NUDGE_INTERVAL + randRange(0, NUDGE_RANDOM);
      this.nudgePending = this.nearView();
    }
  }

  private nearView(): boolean {
    const v = this.scene.cameras.main.worldView;
    return (
      this.x > v.x - SWAY_MARGIN &&
      this.x < v.right + SWAY_MARGIN &&
      this.bottom > v.y - SWAY_MARGIN &&
      this.top < v.bottom + SWAY_MARGIN
    );
  }
}
