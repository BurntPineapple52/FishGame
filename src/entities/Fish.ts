// The player: three rigid bodies (head, body, tail) pinned together.
// Port of fish_guy5/6.tscn with FishHeadOnLandTweaking.gd,
// FishTailOnLandTweaking.gd and testing_damage_animations.gd.
//
// Controls: F/P bend the tail, L/O bend the head. On land that's all you get
// (flop around). In water, wiggling the tail past ~22° gives a kick, and the
// head pushes forward in proportion to how fast the tail is spinning.
//
// On top of the original controls this adds the feedback: kick bubbles and
// squash, impact sounds by material, drying out of water, breaching, and the
// damage / heal / death presentation.

import type * as Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { synth } from '../audio/synth';
import { LAYER_1, LAYER_2, PHYSICS_DT } from '../config';
import { input } from '../input';
import type { PhysBody } from '../physics/PhysicsWorld';
import type { GameScene } from '../scenes/GameScene';
import { Gore, Scars } from '../fx/Wounds';
import { bus, EV, session } from '../session';
import { angleDifference, clamp, pick, toWorld } from '../util/xform';
import type { Entity } from './Entity';

const HEAD_TORQUE = 530_000;
const HEAD_THRUST = 65_000;
const TAIL_TORQUE = 600_000;
const FLOP_THRUST = 3_600;

const PART_MASS = 5;
const PART_ANGULAR_DAMP = 25;
const JOINT_LIMIT = 0.523599; // ±30°

export const MAX_HP = 100;
const UNDEAD_HP = 60;
/** Below this fraction of HP the sprites blend from zombified stage 1 to stage 2. */
const SWITCH_FRACTION = 0.5;
const INVULN_MS = 450;
/** An old salmon at the end of its run: every source of damage hurts this much more. */
const FRAGILITY = 1.5;


const IMPACT_MIN_SPEED = 260;
const BREACH_SPEED = 520;
const BIG_AIR_SPEED = 950;
/** Bumping a rock, log or the ground faster than this bruises the fish. */
const BRUISE_MIN_SPEED = 380;
const BRUISE_MIN_DAMAGE = 4;
const BRUISE_MAX_DAMAGE = 18;
/** Every this much damage tears a chunk off the fish. */
const CHUNK_DAMAGE = 12;

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

const SMASHED_HEADS = ['fish_head_smashed', 'fish_head_smashed_2', 'fish_head_smashed_3'];

interface Part {
  def: PartDef;
  phys: PhysBody;
  view: Phaser.GameObjects.Container;
  base: Phaser.GameObjects.Image;
  /** Zombified sprite drawn over the base, faded in as HP drops. */
  overlay: Phaser.GameObjects.Image;
  flash: Phaser.GameObjects.Image;
  /** Bites torn out of this part; all its textures go through these. */
  scars: Scars;
  /** Base and overlay, for tearing chunks off. */
  layers: Phaser.GameObjects.Image[];
  /** Velocity before the latest physics step, for impact strength. */
  preVx: number;
  preVy: number;
}

export interface FishOptions {
  x: number;
  y: number;
  rot?: number;
  depth: number;
}

export class Fish implements Entity {
  readonly maxHp: number;
  hp: number;
  /** False during cutscenes, results and death: keys do nothing. */
  controllable = true;
  dead = false;
  /** Set by the eagle while carrying the fish. */
  grabbed = false;
  private switched = false;
  private invulnerable = false;
  /** Side the tail last kicked from (FishTail.last_dir). */
  private lastDir = 0;
  private dryTime = 0;
  private gaspTimer = 0;
  private wasDrying = false;
  private bodyWasInWater = false;
  private wakeTimer = 0;
  private lastImpact = 0;
  readonly head: Part;
  readonly tail: Part;
  readonly body: Part;
  private readonly gore: Gore;
  /** Damage dealt since the last chunk came off. */
  private tearDamage = 0;

  constructor(
    private scene: GameScene,
    opts: FishOptions,
  ) {
    this.maxHp = session.undead ? UNDEAD_HP : MAX_HP;
    this.hp = this.maxHp;
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
      const scars = new Scars(scene);
      const base = scene.add.image(def.spriteX, 0, scars.tex(t.base));
      const overlay = scene.add.image(def.spriteX, 0, scars.tex(t.zombie1)).setAlpha(0);
      const flash = scene.add.image(def.spriteX, 0, scars.tex(t.flash)).setAlpha(0);
      const view = scene.attach(phys, opts.depth, [base, overlay, flash]);
      const part: Part = { def, phys, view, base, overlay, flash, scars, layers: [base, overlay], preVx: 0, preVy: 0 };
      phys.onEnter = (other) => this.onContact(part, other);
      return part;
    };
    // Creation order = draw order, same as the Godot scene tree.
    this.head = makePart(PARTS.head);
    this.tail = makePart(PARTS.tail);
    this.body = makePart(PARTS.body);
    this.gore = new Gore(scene, opts.depth);

    const limit: [number, number] = [-JOINT_LIMIT, JOINT_LIMIT];
    const neck = toWorld(xf, PARTS.head.x, 0);
    scene.phys.createPin(this.body.phys, this.head.phys, neck.x, neck.y, { limit, collideConnected: true });
    const hip = toWorld(xf, PARTS.tail.x, 0);
    scene.phys.createPin(this.tail.phys, this.body.phys, hip.x, hip.y, { limit, collideConnected: true });

    if (session.undead) {
      // Undead Run starts fully decayed.
      this.switched = true;
      for (const p of this.parts) {
        p.base.setTexture(p.scars.tex(p.def.textures.zombie1));
        p.overlay.setTexture(p.scars.tex(p.def.textures.zombie2)).setAlpha(0.8);
      }
    }
  }

  get parts(): Part[] {
    return [this.head, this.tail, this.body];
  }

  /** Rendered (interpolated) centre of the fish. */
  get x(): number {
    return this.body.view.x;
  }
  get y(): number {
    return this.body.view.y;
  }
  get vx(): number {
    return this.body.phys.vx;
  }
  get vy(): number {
    return this.body.phys.vy;
  }
  get speed(): number {
    return Math.hypot(this.vx, this.vy);
  }
  get inWater(): boolean {
    return this.parts.some((p) => p.phys.inWater);
  }

  /** The camera followed FishBody in Godot. */
  get cameraTarget(): Phaser.GameObjects.Container {
    return this.body.view;
  }

  cameraInfo(): { x: number; y: number; vx: number; vy: number } {
    return { x: this.x, y: this.y, vx: this.vx, vy: this.vy };
  }

  physicsUpdate(dt: number): void {
    for (const p of this.parts) {
      p.preVx = p.phys.vx;
      p.preVy = p.phys.vy;
    }
    this.updateDrying(dt);
    this.updateBreach();
    if (!this.controllable || this.dead) return;

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
      this.onKick();
    }
  }

  update(dt: number): void {
    if (dt <= 0 || this.dead) return;
    // Wake: a trickle of bubbles behind a fast-swimming fish.
    if (this.tail.phys.inWater && this.speed > 220) {
      this.wakeTimer -= dt;
      if (this.wakeTimer <= 0) {
        this.wakeTimer = 0.07;
        this.scene.fx.bubbles(this.tail.view.x, this.tail.view.y, 1);
      }
    }
  }

  // ---- Feedback ---------------------------------------------------------

  private onKick(): void {
    const t = this.tail.view;
    this.scene.fx.bubbles(t.x, t.y, 4);
    audio.sfx('water_swish', { volume: 0.25, rate: 0.9 + clamp(this.speed / 1500, 0, 0.5), throttleMs: 110 });
    // Squash and stretch along the body.
    for (const p of this.parts) {
      this.scene.tweens.add({
        targets: p.view,
        scaleX: 1.14,
        scaleY: 0.84,
        duration: 70,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
  }

  private onContact(part: Part, other: PhysBody): void {
    if (other.sensor || other.owner === this || other.is('gore')) return;
    const speed = Math.hypot(part.preVx - other.vx, part.preVy - other.vy);
    if (speed < IMPACT_MIN_SPEED) return;
    const now = this.scene.time.now;
    if (now - this.lastImpact < 90) return;
    this.lastImpact = now;

    const strength = clamp((speed - IMPACT_MIN_SPEED) / 900, 0, 1);
    const x = part.view.x;
    const y = part.view.y;
    if (other.is('rock')) {
      audio.sfx('rock_knock', { volume: 0.2 + strength * 0.6 });
      this.scene.fx.dust(x, y, 4 + Math.round(strength * 8));
    } else if (other.is('log')) {
      audio.sfx('wood_knock', { volume: 0.3 + strength * 0.7 });
    } else if (part.phys.inWater) {
      synth.thud(0.1 + strength * 0.25);
    } else {
      audio.sfx('splat', { volume: 0.15 + strength * 0.5, rate: 1.1 });
      this.scene.fx.dust(x, y + 8, 6 + Math.round(strength * 10));
    }
    this.scene.shake(strength * 0.25);

    // The fish is fragile: hard knocks against the scenery hurt.
    if (speed > BRUISE_MIN_SPEED && this.controllable && !this.scene.stage.isTitle) {
      if (other.is('rock') || other.is('log') || other.is('ground')) {
        const bruise = clamp((speed - BRUISE_MIN_SPEED) / 700, 0, 1);
        this.takeDamage(BRUISE_MIN_DAMAGE + bruise * (BRUISE_MAX_DAMAGE - BRUISE_MIN_DAMAGE), 'bruise', part.phys);
      }
    }
  }

  /** Leaving the water fast: spray, and a slow-mo beat for really big leaps. */
  private updateBreach(): void {
    const inWater = this.body.phys.inWater;
    if (this.bodyWasInWater && !inWater && !this.dead) {
      const speed = this.speed;
      if (speed > BREACH_SPEED && this.vy < 0) {
        this.scene.fx.sparkle(this.x, this.y, 5, 0xffffff);
        if (speed > BIG_AIR_SPEED && !this.scene.stage.isTitle) {
          this.scene.slowMotion(0.55, 500);
          this.scene.camera.zoomPunch(0.06);
          this.scene.fx.text(this.x, this.y - 50, pick(['BIG AIR!', 'WHOOSH!', 'LEAP!']), { color: '#bfe9ff', size: 26 });
        }
      }
    }
    this.bodyWasInWater = inWater;
  }

  private updateDrying(dt: number): void {
    const rate = session.undead ? 0 : this.scene.stage.drying ?? 0;
    const heal = this.scene.stage.waterHeal ?? 0;
    if (heal > 0 && this.inWater && !this.dead && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + heal * dt);
      this.updateDecay();
      bus.emit(EV.healed, { hp: this.hp, max: this.maxHp, amount: 0 });
    }
    if (this.inWater || rate <= 0 || this.dead || !this.controllable) {
      this.dryTime = 0;
      if (this.wasDrying) {
        this.wasDrying = false;
        bus.emit(EV.drying, 0);
      }
      return;
    }
    this.dryTime += dt;
    const grace = this.scene.stage.dryGrace ?? 3;
    if (this.dryTime < grace) {
      bus.emit(EV.drying, (this.dryTime / grace) * 0.5);
      this.wasDrying = true;
      return;
    }
    this.wasDrying = true;
    bus.emit(EV.drying, 1);
    this.hp -= rate * FRAGILITY * dt;
    this.updateDecay();
    bus.emit(EV.damaged, { hp: this.hp, max: this.maxHp, amount: 0 });
    this.gaspTimer -= dt;
    if (this.gaspTimer <= 0) {
      this.gaspTimer = 1.1;
      synth.gasp();
      this.scene.fx.bubbles(this.head.view.x + 20, this.head.view.y, 2);
      for (const p of this.parts) {
        this.scene.tweens.add({ targets: p.base, scaleY: 1.15, duration: 120, yoyo: true });
      }
    }
    if (this.hp <= 0) this.scene.killFish('dry');
  }

  /** Knock one part of the fish around (BearPaw calls this on contact). */
  smack(part: PhysBody, fx: number, fy: number, torque: number, damage = 0, cause = 'default'): void {
    part.applyImpulse(fx, fy);
    // Godot's apply_torque lasts one physics step.
    part.applyTorqueImpulse(torque * PHYSICS_DT);
    if (damage) this.takeDamage(damage, cause, part);
  }

  heal(amount: number): void {
    if (this.dead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.updateDecay();
    bus.emit(EV.healed, { hp: this.hp, max: this.maxHp, amount });
  }

  /** `at` is the part that got hit, if known; chunks come off there first. */
  takeDamage(damage: number, cause = 'default', at?: PhysBody): void {
    if (this.invulnerable || this.dead || this.scene.finished) return;
    damage *= FRAGILITY;
    this.invulnerable = true;
    this.scene.time.delayedCall(INVULN_MS, () => (this.invulnerable = false));
    this.hp -= damage;
    bus.emit(EV.damaged, { hp: this.hp, max: this.maxHp, amount: damage });

    // Juice: freeze frame, shake, scales flying off.
    const strength = clamp(damage / 40, 0.3, 1);
    this.scene.hitstop(60 + strength * 70);
    this.scene.shake(0.3 + strength * 0.35);
    this.scene.camera.zoomPunch(0.05 * strength);
    this.scene.flash(0xff3030, 0.22 * strength, 160);
    this.scene.fx.shards(this.x, this.y, 8 + Math.round(strength * 10));
    this.scene.fx.glow(this.x, this.y, 4, 0xff4040);
    this.scene.fx.text(this.x, this.y - 40, `-${Math.round(damage)}`, { color: '#ff6b5a', size: 30 });
    synth.thud(0.4);
    this.tearChunks(damage, at);

    const flashes = this.parts.map((p) => p.flash);
    const intensity = clamp(damage / 50 + 0.3, 0, 1);
    this.scene.tweens.add({
      targets: flashes,
      alpha: intensity,
      duration: 80,
      onComplete: () => {
        this.updateDecay();
        this.scene.tweens.add({ targets: flashes, alpha: 0, duration: 300 });
      },
    });
    if (this.hp <= 0) this.scene.killFish(cause);
  }

  /** A chunk comes off for every CHUNK_DAMAGE dealt, at least one per real hit. */
  private tearChunks(damage: number, at?: PhysBody): void {
    this.tearDamage += damage;
    let n = Math.floor(this.tearDamage / CHUNK_DAMAGE);
    if (n === 0 && damage >= CHUNK_DAMAGE / 2) n = 1;
    this.tearDamage = Math.max(0, this.tearDamage - n * CHUNK_DAMAGE);
    const hit = this.parts.find((p) => p.phys === at);
    for (let i = 0; i < Math.min(n, 3); i++) {
      // The struck part first, then anywhere that still has something to lose.
      const order = [...(hit && i === 0 ? [hit] : []), ...this.parts.sort(() => Math.random() - 0.5)];
      if (order.some((p) => this.gore.tear(p))) {
        this.scene.fx.shards(this.x, this.y, 4, 0x8c2a33);
      }
    }
  }

  /** Blend toward the zombified sprites as HP drops. */
  private updateDecay(): void {
    const threshold = this.maxHp * SWITCH_FRACTION;
    if (!this.switched && this.hp < threshold) {
      this.switched = true;
      for (const p of this.parts) {
        p.base.setTexture(p.scars.tex(p.def.textures.zombie1));
        p.overlay.setTexture(p.scars.tex(p.def.textures.zombie2));
      }
    } else if (this.switched && !session.undead && this.hp >= threshold) {
      this.switched = false;
      for (const p of this.parts) {
        p.base.setTexture(p.scars.tex(p.def.textures.base));
        p.overlay.setTexture(p.scars.tex(p.def.textures.zombie1));
      }
    }
    // Overlay alpha goes 0..1 over full..half HP, then again over half..zero HP.
    const range = this.switched ? threshold : this.maxHp - threshold;
    const top = this.switched ? threshold : this.maxHp;
    const alpha = clamp((top - this.hp) / range, 0, 1);
    for (const p of this.parts) p.overlay.setAlpha(session.undead ? Math.max(alpha, 0.8) : alpha);
  }

  /** Death pose: smashed head, limp body. */
  die(): void {
    this.dead = true;
    this.controllable = false;
    this.hp = 0;
    this.head.base.setTexture(this.head.scars.tex(pick(SMASHED_HEADS)));
    this.head.overlay.setAlpha(0);
    for (const p of this.parts) {
      p.flash.setAlpha(0.6);
      this.scene.tweens.add({ targets: p.flash, alpha: 0, duration: 600 });
      p.phys.angularDamp = 2;
    }
    this.scene.fx.shards(this.x, this.y, 22);
    this.scene.fx.ring(this.x, this.y, 1.6, 0xff5050, 600);
  }
}
