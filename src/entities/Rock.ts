// A heavy boulder (rock.tscn). Not in the "physics" group, so water ignores it.

import type { Pt } from '../physics/shapes';
import { transformPoints } from '../physics/shapes';
import type { GameScene } from '../scenes/GameScene';

const ROCK_SCALE = 2;
const ROCK_POLYGON: Pt[] = [
  [93, 51.5], [69.5, 73], [45, 85.5], [-57, 85.5], [-75.5, 76.5], [-88.5, 63.5],
  [-102.5, 30], [-106.5, 14.5], [-101, -28.5], [-88.5, -61], [-67.5, -81.5], [-41.5, -87.5],
  [-6, -79.5], [36.5, -59], [51.5, -56.5], [79, -30], [105.5, 13], [102.5, 32.5],
];

export interface RockOptions {
  x: number;
  y: number;
  rot?: number;
  /** rock.tscn uses 0.57; a PhysicsMaterial override (e.g. Rock2) uses Godot's default 1. */
  friction?: number;
  depth: number;
}

export function createRock(scene: GameScene, opts: RockOptions): void {
  const body = scene.phys.createBody(
    { x: opts.x, y: opts.y, rot: opts.rot, mass: 180, friction: opts.friction ?? 0.57, groups: ['rock'] },
    [{ type: 'poly', points: transformPoints(ROCK_POLYGON, 0, 0, ROCK_SCALE) }],
  );
  scene.attach(body, opts.depth, [scene.add.image(0, 0, 'rock_2').setScale(ROCK_SCALE)]);
}
