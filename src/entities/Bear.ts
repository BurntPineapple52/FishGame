// A bear standing in the river, swiping its arm through the water.
// Port of bear_base.tscn / bear.tscn with Bear.gd and BearPaw.gd.
//
// Bear.gd's intent is a full 360° swing over 1 s, then a 2 s cooldown. Godot
// approximated that by spinning a static body plus an uncapped wrist motor,
// which doesn't carry over to Box2D. Here a shoulder motor drives the swing,
// and between swings the motor brakes and holds the arm hanging in the water,
// with the paw just clearing the riverbed. The fish has to slip past while
// the arm is up.

import { LAYER_1, LAYER_2 } from '../config';
import type { PhysBody, PinJoint } from '../physics/PhysicsWorld';
import { transformPoints, type Pt } from '../physics/shapes';
import type { GameScene } from '../scenes/GameScene';
import { clamp, compose, toWorld, type Xform } from '../util/xform';
import type { Entity } from './Entity';
import { Fish } from './Fish';

const FIRST_ATTACK_DELAY = 1;
const ATTACK_COOLDOWN = 2;
const SWING_TIME = 1;
const SWING_SPEED = (Math.PI * 2) / SWING_TIME;
/** Shoulder motor strength, kg·px²/s² (Godot units). Strong enough that the fish can't budge it. */
const SHOULDER_TORQUE = 1e9;
/** Hand the swing over to the hold controller this close (radians) to a full turn. */
const SWING_HANDOVER = 0.15;
/** Hold controller gain: motor speed (rad/s) per radian away from the rest angle. */
const HOLD_GAIN = 8;

// BearPaw.gd
const SMACK_FORCE = 20_000;
const SMACK_TORQUE = -100_000;
const SMACK_DIRECTION = [-1, 0] as const;
const SMACK_DAMAGE = 35;

const ARM_POLYGON: Pt[] = [
  [-48, 79], [-34, 63], [-22, 51], [-4, 40], [21, 32], [41, 38], [56, 59], [59, 86], [56, 115],
  [72, 105], [75, 71], [62, 26], [60, -28], [53, -166], [55, -219], [-47, -219], [-17, -181],
  [-14, -66], [-21, 8], [-56, 73],
];

const PAW_POLYGON: Pt[] = [
  [-23.9348, -43.9188], [-26.9348, -25.9188], [-36.9348, 12.0812], [-37.9348, 40.0812],
  [-31.9348, 56.0812], [-32.9348, 75.0812], [-27.9348, 92.0812], [-12.9348, 98.0812],
  [-0.93483, 94.0812], [18.0652, 76.0812], [32.0652, 49.0812], [45.0652, -7.91876],
  [44.0652, -32.9188], [36.0652, -51.9188], [24.0652, -58.9188], [9.06517, -61.9188],
  [-5.93483, -58.9188],
];

/** Arm segment sprites (position, rotation) in the arm's local space. */
const ARM_SPRITES: [number, number, number][] = [
  [7.58639, 241.201, 0],
  [11, 194, 0],
  [19, 145, -0.118682],
  [17, 98, -0.118682],
  [15, 55, -0.118682],
  [13, 8, -0.118682],
];

export interface BearOptions {
  x: number;
  y: number;
  depth: number;
}

export class Bear implements Entity {
  private readonly shoulder: PinJoint;
  private cooldown = FIRST_ATTACK_DELAY;
  private swinging = false;
  /** Shoulder angle the arm returns to; grows by a full turn with every swing. */
  private restAngle = 0;

  constructor(scene: GameScene, opts: BearOptions) {
    const root: Xform = { x: opts.x, y: opts.y };
    scene.add.image(opts.x - 13, opts.y - 54, 'bear_legs').setScale(-1.219, 1.348).setDepth(opts.depth);

    // The arm hangs from a static shoulder block (BearArm). Godot spawned it
    // raised (rotation π) and let gravity drop it; we start it where it settles.
    const shoulderXf = compose(root, { x: 127, y: -257, rot: 0 });
    const shoulderBody = scene.phys.createBody({ type: 'static', ...shoulderXf }, [
      { type: 'rect', w: 86, h: 25, y: -10.5 },
    ]);

    // Arm and paw only collide with layer 2 (the fish and the riverbed floor),
    // so the swing can't jam on the shallow incline under the bear.
    const armCollision = { layer: LAYER_1, mask: LAYER_2 };
    const armXf = compose(shoulderXf, { x: 0, y: 83 });
    const arm = scene.phys.createBody({ ...armXf, ...armCollision, mass: 60, groups: ['smacker'] }, [
      { type: 'poly', points: transformPoints(ARM_POLYGON, 0, 141) },
    ]);

    const pawXf = compose(armXf, { x: 8.93483, y: 241.919 });
    const paw = scene.phys.createBody({ ...pawXf, ...armCollision, mass: 80, bounce: 1, groups: ['smacker'] }, [
      { type: 'poly', points: PAW_POLYGON },
    ]);

    // Paw first so the arm sprites draw over it, as in the Godot tree.
    scene.attach(paw, opts.depth, [scene.add.image(0, 0, 'bearclaw_paw').setFlipX(true)]);
    scene.attach(
      arm,
      opts.depth,
      ARM_SPRITES.map(([x, y, rot]) => scene.add.image(x, y, 'bearclaw_arm').setFlipX(true).setRotation(rot)),
    );

    const shoulderPin = toWorld(shoulderXf, 0, 3);
    this.shoulder = scene.phys.createPin(shoulderBody, arm, shoulderPin.x, shoulderPin.y);

    const wrist = toWorld(armXf, 17.8741, 206.61);
    scene.phys.createPin(arm, paw, wrist.x, wrist.y, { limit: [-0.0872665, 0.349066] });

    const smack = (other: PhysBody) => {
      if (other.owner instanceof Fish) {
        other.owner.smack(
          other,
          SMACK_FORCE * SMACK_DIRECTION[0],
          SMACK_FORCE * SMACK_DIRECTION[1],
          SMACK_TORQUE,
          SMACK_DAMAGE,
        );
      }
    };
    arm.onEnter = smack;
    paw.onEnter = smack;
  }

  physicsUpdate(dt: number): void {
    const angle = this.shoulder.angle;
    if (this.swinging) {
      if (angle < this.restAngle - SWING_HANDOVER) {
        this.shoulder.setMotor(true, SWING_SPEED, SHOULDER_TORQUE);
        return;
      }
      this.swinging = false;
      this.cooldown = ATTACK_COOLDOWN;
    }

    // Hold the arm at its rest angle.
    const speed = clamp((this.restAngle - angle) * HOLD_GAIN, -SWING_SPEED, SWING_SPEED);
    this.shoulder.setMotor(true, speed, SHOULDER_TORQUE);

    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.swinging = true;
      this.restAngle += Math.PI * 2;
    }
  }
}
