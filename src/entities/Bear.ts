// A bear standing in the river, swiping its arm through the water.
// Port of bear_base.tscn / bear.tscn with Bear.gd and BearPaw.gd.
//
// Bear.gd's intent is a full 360° swing over 1 s, then a 2 s cooldown. Godot
// approximated that by spinning a static body plus an uncapped wrist motor,
// which doesn't carry over to Box2D. Here a shoulder motor drives the swing,
// and between swings the motor brakes and holds the arm hanging in the water,
// with the paw just clearing the riverbed. The fish has to slip past while
// the arm is up.
//
// Telegraph: half a second before each swing the arm draws back and the bear
// growls, so the player can read the rhythm. The paw throws spray as it slaps
// back into the water.

import type * as Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { synth } from '../audio/synth';
import { LAYER_1, LAYER_2 } from '../config';
import type { PhysBody, PinJoint } from '../physics/PhysicsWorld';
import { transformPoints, type Pt } from '../physics/shapes';
import type { GameScene } from '../scenes/GameScene';
import { session } from '../session';
import { clamp, compose, pick, toWorld, type Xform } from '../util/xform';
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
/** Wind-up before each swing: how long, and how far the arm draws back. */
const WINDUP_TIME = 0.55;
const WINDUP_ANGLE = 0.4;
/** Only growl and shake when the fish is this close (px). */
const NOTICE_RANGE = 1300;

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
  /** Multiplier on the pause between swings (lower = angrier bear). */
  cooldownScale?: number;
  /** Seconds before the first swing. */
  firstDelay?: number;
}

export class Bear implements Entity {
  private readonly shoulder: PinJoint;
  private readonly paw: PhysBody;
  private readonly legs: Phaser.GameObjects.Image;
  private readonly cooldownTime: number;
  private cooldown: number;
  private swinging = false;
  private windingUp = false;
  /** Shoulder angle the arm returns to; grows by a full turn with every swing. */
  private restAngle = 0;
  private pawWasUnder = true;
  private breath = 0;

  constructor(
    private scene: GameScene,
    readonly opts: BearOptions,
  ) {
    const root: Xform = { x: opts.x, y: opts.y };
    const scale = session.undead ? 0.6 : 1;
    this.cooldownTime = ATTACK_COOLDOWN * (opts.cooldownScale ?? 1) * scale;
    this.cooldown = opts.firstDelay ?? FIRST_ATTACK_DELAY;
    this.legs = scene.add.image(opts.x - 13, opts.y - 54, 'bear_legs').setScale(-1.219, 1.348).setDepth(opts.depth);

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
    this.paw = paw;

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
        const fish = other.owner;
        fish.smack(
          other,
          SMACK_FORCE * SMACK_DIRECTION[0],
          SMACK_FORCE * SMACK_DIRECTION[1],
          SMACK_TORQUE,
          SMACK_DAMAGE,
          'bear',
        );
        scene.fx.text(fish.x, fish.y - 60, pick(['WHACK!', 'SWAT!', 'THWAP!']), { color: '#ffd25a', size: 40 });
        scene.slowMotion(0.35, 450);
      }
    };
    arm.onEnter = smack;
    paw.onEnter = smack;
  }

  private fishDistance(): number {
    const f = this.scene.fish;
    return f ? Math.hypot(f.x - this.opts.x, f.y - this.opts.y) : Infinity;
  }

  physicsUpdate(dt: number): void {
    const angle = this.shoulder.angle;
    if (this.swinging) {
      if (angle < this.restAngle - SWING_HANDOVER) {
        this.shoulder.setMotor(true, SWING_SPEED, SHOULDER_TORQUE);
        return;
      }
      this.swinging = false;
      this.cooldown = this.cooldownTime;
    }

    // Hold the arm at its rest angle (drawn back while winding up).
    const target = this.restAngle - (this.windingUp ? WINDUP_ANGLE : 0);
    const speed = clamp((target - angle) * HOLD_GAIN, -SWING_SPEED, SWING_SPEED);
    this.shoulder.setMotor(true, speed, SHOULDER_TORQUE);

    this.cooldown -= dt;
    if (!this.windingUp && this.cooldown <= WINDUP_TIME) this.startWindup();
    if (this.cooldown <= 0) {
      this.windingUp = false;
      this.swinging = true;
      this.restAngle += Math.PI * 2;
      if (this.fishDistance() < NOTICE_RANGE) synth.whoosh(0.5, 0.1);
    }
  }

  private startWindup(): void {
    this.windingUp = true;
    const near = this.fishDistance() < NOTICE_RANGE;
    if (near) {
      synth.growl();
      this.scene.shake(0.12);
    }
    // Rear up a little.
    this.scene.tweens.add({ targets: this.legs, scaleY: 1.348 * 1.05, y: this.legs.y - 8, duration: 200, yoyo: true, hold: 250 });
  }

  update(dt: number): void {
    if (dt <= 0) return;
    // Idle breathing.
    this.breath += dt;
    this.legs.setScale(-1.219 * (1 + Math.sin(this.breath * 2.2) * 0.008), this.legs.scaleY);

    // Paw slapping into the water: spray, surface kick and a thump.
    const water = this.scene.waterAt(this.paw.x);
    if (!water) return;
    const under = this.paw.y > water.surfaceAt(this.paw.x);
    if (under && !this.pawWasUnder) {
      const dist = this.fishDistance();
      this.scene.fx.splash(this.paw.x, water.surfaceAt(this.paw.x), 1);
      this.scene.fx.splash(this.paw.x + 40, water.surfaceAt(this.paw.x), 0.7);
      water.disturb(this.paw.x, 25);
      if (dist < NOTICE_RANGE) {
        audio.sfx('water_swish', { volume: 0.7, rate: 0.6 });
        this.scene.shake(clamp(1 - dist / NOTICE_RANGE, 0, 1) * 0.35);
      }
    } else if (!under && this.pawWasUnder) {
      this.scene.fx.splash(this.paw.x, water.surfaceAt(this.paw.x), 0.6);
    }
    this.pawWasUnder = under;
  }
}
