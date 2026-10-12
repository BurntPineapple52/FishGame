// The player: three rigid bodies (head, body, tail) pinned together.
// Port of fish_guy5/6.tscn with FishHeadOnLandTweaking.gd,
// FishTailOnLandTweaking.gd and testing_damage_animations.gd.
//
// Controls: F/P bend the tail, L/O bend the head. On land that's all you get
// (flop around). In water, wiggling the tail past ~22° gives a kick, and the
// head pushes forward in proportion to how fast the tail is spinning.

import type * as Phaser from 'phaser';
import { LAYER_1, LAYER_2, PHYSICS_DT } from '../config';
import { input } from '../input';
import type { PhysBody } from '../physics/PhysicsWorld';
import type { GameScene } from '../scenes/GameScene';
import { angleDifference, clamp, toWorld } from '../util/xform';
import type { Entity } from './Entity';

const HEAD_TORQUE = 530_000;
const HEAD_THRUST = 50_000;
const TAIL_TORQUE = 600_000;
const FLOP_THRUST = 2_800;

const PART_MASS = 5;
const PART_ANGULAR_DAMP = 25;
const JOINT_LIMIT = 0.523599; // ±30°

const MAX_HP = 100;
/** Below this HP the sprites blend from zombified stage 1 to stage 2. */
const SWITCH_THRESHOLD = 50;
const INVULN_MS = 300;

type PartName = 'head' | 'body' | 'tail';

interface PartDef {
  /** Body origin, relative to the fish. */
  x: number;
  /** Collision box and sprite centre, relative to the part's body. */
  shapeX: number;
  spriteX: number;
  textures: { base: string; zombie1: string; zombie2: string; flash: string };
}

const PARTS: Record<PartName, PartDef> = {
  head: {
    x: 26,
    shapeX: 26,
    spriteX: 29,
    textures: {
      base: 'fish_head',
      zombie1: 'fish_head_zombified1v2',
      zombie2: 'fish_head_zombified2v5',
      flash: 'fish_head_damage_flash',
    },
  },
  body: {
    x: 0,
    shapeX: 0,
    spriteX: 0,
    textures: {
      base: 'fish_center',
      zombie1: 'fish_center_zombified1v2',
      zombie2: 'fish_center_zombified2v2',
      flash: 'fish_center_damage_flash',
    },
  },
  tail: {
    x: -26,
    shapeX: -26,
    spriteX: -29,
    textures: {
      base: 'fish_tail',
      zombie1: 'fish_tail_zombified1',
      zombie2: 'fish_tail_zombified2',
      flash: 'fish_tail_damageflash',
    },
  },
};

interface Part {
  def: PartDef;
  phys: PhysBody;
  view: Phaser.GameObjects.Container;
  base: Phaser.GameObjects.Image;
  /** Zombified sprite drawn over the base, faded in as HP drops. */
  overlay: Phaser.GameObjects.Image;
  flash: Phaser.GameObjects.Image;
}

export interface FishOptions {
  x: number;
  y: number;
  rot?: number;
  depth: number;
}

export class Fish implements Entity {
  hp = MAX_HP;
  private switched = false;
  private invulnerable = false;
  /** Side the tail last kicked from (FishTail.last_dir). */
  private lastDir = 0;
  readonly head: Part;
  readonly tail: Part;
  readonly body: Part;

  constructor(
    private scene: GameScene,
    opts: FishOptions,
  ) {
    const xf = { x: opts.x, y: opts.y, rot: opts.rot ?? 0 };
    const makePart = (def: PartDef): Part => {
      const pos = toWorld(xf, def.x, 0);
      const phys = scene.phys.createBody(
        {
          x: pos.x,
          y: pos.y,
          rot: xf.rot,
          mass: PART_MASS,
          angularDamp: PART_ANGULAR_DAMP,
          layer: LAYER_1 | LAYER_2,
          mask: LAYER_1 | LAYER_2,
          groups: ['physics', 'player'],
          owner: this,
        },
        [{ type: 'rect', w: 48, h: 20, x: def.shapeX }],
      );
      const t = def.textures;
      const base = scene.add.image(def.spriteX, 0, t.base);
      const overlay = scene.add.image(def.spriteX, 0, t.zombie1).setAlpha(0);
      const flash = scene.add.image(def.spriteX, 0, t.flash).setAlpha(0);
      const view = scene.attach(phys, opts.depth, [base, overlay, flash]);
      return { def, phys, view, base, overlay, flash };
    };
    // Creation order = draw order, same as the Godot scene tree.
    this.head = makePart(PARTS.head);
    this.tail = makePart(PARTS.tail);
    this.body = makePart(PARTS.body);

    const limit: [number, number] = [-JOINT_LIMIT, JOINT_LIMIT];
    const neck = toWorld(xf, PARTS.head.x, 0);
    scene.phys.createPin(this.body.phys, this.head.phys, neck.x, neck.y, { limit, collideConnected: true });
    const hip = toWorld(xf, PARTS.tail.x, 0);
    scene.phys.createPin(this.tail.phys, this.body.phys, hip.x, hip.y, { limit, collideConnected: true });
  }

  get parts(): Part[] {
    return [this.head, this.tail, this.body];
  }

  /** The camera followed FishBody in Godot. */
  get cameraTarget(): Phaser.GameObjects.Container {
    return this.body.view;
  }

  physicsUpdate(): void {
    const head = this.head.phys;
    const body = this.body.phys;
    const tail = this.tail.phys;

    // Head: L/O
    let angDif = angleDifference(head.rot, body.rot);
    let axis = input.axis('l', 'o');
    if (!head.inWater) {
      head.applyTorque(HEAD_TORQUE * axis);
    } else {
      if (Math.abs(angDif) < Math.PI / 9 || Math.sign(angDif) === axis) {
        head.applyTorque(HEAD_TORQUE * axis);
      }
      const thrust = (HEAD_THRUST * Math.abs(tail.angularVelocity)) / 7;
      head.applyForce(thrust * Math.cos(head.rot), thrust * Math.sin(head.rot));
    }

    // Tail: F/P
    angDif = angleDifference(tail.rot, body.rot);
    axis = input.axis('f', 'p');
    if (!tail.inWater) {
      tail.applyTorque(TAIL_TORQUE * axis);
    } else if (Math.abs(angDif) < Math.PI / 8 || Math.sign(angDif) === axis) {
      tail.applyTorque(TAIL_TORQUE * axis);
    } else if (Math.sign(angDif) !== this.lastDir) {
      body.applyImpulse(FLOP_THRUST * Math.cos(body.rot), FLOP_THRUST * Math.sin(body.rot));
      this.lastDir = Math.sign(angDif);
    }
  }

  /** Knock one part of the fish around (BearPaw calls this on contact). */
  smack(part: PhysBody, fx: number, fy: number, torque: number, damage = 0): void {
    part.applyImpulse(fx, fy);
    // Godot's apply_torque lasts one physics step.
    part.applyTorqueImpulse(torque * PHYSICS_DT);
    if (damage) this.takeDamage(damage);
  }

  takeDamage(damage: number): void {
    if (this.invulnerable) return;
    this.invulnerable = true;
    this.scene.time.delayedCall(INVULN_MS, () => (this.invulnerable = false));
    this.hp -= damage;

    const flashes = this.parts.map((p) => p.flash);
    const intensity = clamp(damage / 50 + 0.3, 0, 1);
    this.scene.tweens.add({
      targets: flashes,
      alpha: intensity,
      duration: 100,
      onComplete: () => {
        if (!this.switched && this.hp < SWITCH_THRESHOLD) {
          this.switched = true;
          for (const p of this.parts) {
            p.base.setTexture(p.def.textures.zombie1);
            p.overlay.setTexture(p.def.textures.zombie2);
          }
        }
        // Overlay alpha goes 0..1 over full..half HP, then again over half..zero HP.
        const range = this.switched ? MAX_HP / 2 : MAX_HP;
        const alpha = clamp(1 - this.hp / range, 0, 1);
        for (const p of this.parts) p.overlay.setAlpha(alpha);

        this.scene.tweens.add({
          targets: flashes,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            if (this.hp <= 0) this.scene.restartStage();
          },
        });
      },
    });
  }
}
