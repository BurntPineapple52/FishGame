// A bald eagle hunting the shallows (uses the unused eagle.png, cawcaw.mp3 and
// eagle_scream.mp3 from the jam build).
//
//   idle -> telegraph -> dive -> grab (carry) -> leave
//                             \-> miss -------/
//
// Telegraph: it caws, its shadow sweeps the water and a reticle locks onto the
// fish. Being deep, or under a log or weed cover, when it strikes makes it
// miss. If caught, mash F/L/O/P to wriggle free before it carries you off.

import type * as Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { synth } from '../audio/synth';
import { DEPTH } from '../config';
import { input } from '../input';
import type { GameScene } from '../scenes/GameScene';
import { bus, EV, session } from '../session';
import { clamp, pick, randRange } from '../util/xform';
import type { Entity } from './Entity';

const TELEGRAPH = 1.5;
const DIVE = 0.55;
const CARRY = 2.4;
const LEAVE = 1.4;
const GRAB_RADIUS = 120;
/** Deeper than this below the surface is safe. */
const SAFE_DEPTH = 170;
const MASH_NEEDED = 8;
const GRAB_DAMAGE = 12;
const DROP_DAMAGE = 30;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EagleOptions {
  /** Hunt only while the fish is between these x positions. */
  x0: number;
  x1: number;
  /** Seconds between attacks. */
  interval?: [number, number];
  /** Extra hiding spots (weed beds) as world rects. */
  cover?: Rect[];
}

type State = 'idle' | 'telegraph' | 'dive' | 'grab' | 'miss' | 'leave';

export class Eagle implements Entity {
  private state: State = 'idle';
  private timer: number;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly reticle: Phaser.GameObjects.Image;
  private x = 0;
  private y = -2000;
  private fromX = 0;
  private fromY = 0;
  private targetX = 0;
  private targetY = 0;
  private mashStart = 0;
  private t = 0;
  private announced = false;

  constructor(
    private scene: GameScene,
    private opts: EagleOptions,
  ) {
    this.timer = randRange(2, 3.5);
    this.sprite = scene.add.image(0, -2000, 'eagle').setDepth(DEPTH.waterFx).setScale(0.85).setVisible(false);
    this.shadow = scene.add.image(0, 0, 'glow').setTint(0x000000).setAlpha(0).setDepth(DEPTH.water + 1);
    this.reticle = scene.add.image(0, 0, 'reticle').setDepth(DEPTH.overlay).setVisible(false);
  }

  private get interval(): number {
    const [a, b] = this.opts.interval ?? [4, 7];
    return randRange(a, b) * (session.undead ? 0.6 : 1);
  }

  /** Is the fish catchable right now? */
  private exposed(): boolean {
    const f = this.scene.fish;
    if (!f || f.dead) return false;
    const water = this.scene.waterAt(f.x);
    if (water && f.y - water.surfaceAt(f.x) > SAFE_DEPTH) return false;
    for (const c of this.opts.cover ?? []) {
      if (Math.abs(f.x - c.x) < c.w / 2 && Math.abs(f.y - c.y) < c.h / 2) return false;
    }
    for (const b of this.scene.phys.bodies) {
      if (!b.is('log')) continue;
      if (Math.abs(b.x - f.x) < 160 && b.y < f.y + 10 && b.y > f.y - 220) return false;
    }
    return true;
  }

  physicsUpdate(): void {
    if (this.state !== 'grab') return;
    const f = this.scene.fish;
    if (!f || f.dead) {
      this.release(false);
      return;
    }
    // Drag the fish to the talons.
    const tx = this.x - 10;
    const ty = this.y + 55;
    for (const p of f.parts) {
      const vx = clamp((tx - p.phys.x) * 12, -1400, 1400);
      const vy = clamp((ty - p.phys.y) * 12, -1400, 1400);
      p.phys.setVelocity(vx, vy);
    }
  }

  update(dt: number): void {
    if (dt <= 0) return;
    this.t += dt;
    const f = this.scene.fish;
    const view = this.scene.cameras.main.worldView;
    this.timer -= dt;

    switch (this.state) {
      case 'idle': {
        const ready = f && !f.dead && !this.scene.finished && f.x > this.opts.x0 && f.x < this.opts.x1;
        if (!ready) {
          this.timer = Math.max(this.timer, 1);
          break;
        }
        if (this.timer <= 0) this.startTelegraph();
        break;
      }
      case 'telegraph': {
        if (!f) break;
        const p = 1 - this.timer / TELEGRAPH;
        // Circle high above, sweeping in from the right.
        this.x = f.x + Math.cos(this.t * 2.2) * 260 + (1 - p) * 300;
        this.y = view.y + 40 + Math.sin(this.t * 2.2) * 25;
        this.targetX = f.x;
        this.targetY = f.y;
        this.reticle
          .setVisible(true)
          .setPosition(f.x, f.y)
          .setScale(2.2 - p * 1.3)
          .setAlpha(0.4 + 0.6 * Math.abs(Math.sin(this.t * (6 + p * 14))))
          .setRotation(this.t * 2);
        this.sprite.setFlipX(Math.sin(this.t * 2.2) < 0);
        if (this.timer <= 0) this.startDive();
        break;
      }
      case 'dive': {
        const p = clamp(1 - this.timer / DIVE, 0, 1);
        const e = p * p;
        this.x = this.fromX + (this.targetX - this.fromX) * e;
        this.y = this.fromY + (this.targetY - 30 - this.fromY) * e;
        this.sprite.setFlipX(this.targetX > this.fromX).setRotation((this.targetX > this.fromX ? 1 : -1) * 0.5 * p);
        if (this.timer <= 0) this.strike();
        break;
      }
      case 'grab': {
        // Flap away downstream and up.
        this.x -= 120 * dt;
        this.y -= 140 * dt;
        this.sprite.setRotation(Math.sin(this.t * 20) * 0.1);
        const progress = (input.flopPresses - this.mashStart) / MASH_NEEDED;
        bus.emit(EV.wriggle, clamp(progress, 0, 1));
        if (input.consumePressed('f') || input.consumePressed('l') || input.consumePressed('o') || input.consumePressed('p')) {
          synth.wriggle();
          if (f) this.scene.fx.shards(f.x, f.y, 2, 0xffffff);
        }
        if (progress >= 1) this.release(true);
        else if (this.timer <= 0) this.release(false);
        break;
      }
      case 'miss':
      case 'leave': {
        this.x += 380 * dt;
        this.y -= 420 * dt;
        this.sprite.setFlipX(true).setRotation(-0.3);
        if (this.timer <= 0) {
          this.state = 'idle';
          this.timer = this.interval;
          this.sprite.setVisible(false);
        }
        break;
      }
    }

    this.sprite.setPosition(this.x, this.y);
    // Wing beat
    if (this.state !== 'dive') this.sprite.scaleY = 0.85 * (0.9 + 0.1 * Math.sin(this.t * 14));

    // Shadow on the water under the eagle.
    const water = this.scene.waterAt(this.x);
    if (water && this.sprite.visible) {
      const alt = clamp((water.surfaceAt(this.x) - this.y) / 700, 0, 1);
      this.shadow
        .setPosition(this.x, water.surfaceAt(this.x) + 6)
        .setScale(4 - alt * 2, 0.5)
        .setAlpha(0.45 * (1 - alt * 0.6));
    } else {
      this.shadow.setAlpha(0);
    }
  }

  private startTelegraph(): void {
    this.state = 'telegraph';
    this.timer = TELEGRAPH;
    this.sprite.setVisible(true).setRotation(0);
    audio.sfx('cawcaw', { volume: 0.7, pitchVar: 0.05 });
    if (!this.announced) {
      this.announced = true;
      bus.emit(EV.boss, 'THE EAGLE');
    }
    bus.emit(EV.toast, 'Eagle! Dive deep or hide!');
  }

  private startDive(): void {
    this.state = 'dive';
    this.timer = DIVE;
    this.fromX = this.x;
    this.fromY = this.y;
    this.reticle.setScale(0.9).setAlpha(1);
    audio.sfx('eagle_scream', { volume: 0.75, pitchVar: 0.04 });
    synth.whoosh(0.5, 0.15);
  }

  private strike(): void {
    this.reticle.setVisible(false);
    const f = this.scene.fish;
    const water = this.scene.waterAt(this.x);
    if (water && this.y + 40 > water.surfaceAt(this.x)) {
      this.scene.fx.splash(this.x, water.surfaceAt(this.x), 1);
      water.disturb(this.x, 20);
    }
    const dist = f ? Math.hypot(f.x - this.targetX, f.y - this.targetY) : Infinity;
    if (f && dist < GRAB_RADIUS && this.exposed()) {
      this.state = 'grab';
      this.timer = CARRY;
      this.mashStart = input.flopPresses;
      input.consumePressed('f');
      f.grabbed = true;
      f.takeDamage(GRAB_DAMAGE, 'eagle');
      this.scene.shake(0.5);
      this.scene.hitstop(90);
      this.scene.fx.text(f.x, f.y - 70, 'MASH F L O P!', { color: '#ff7a5c', size: 34, duration: 1200 });
      bus.emit(EV.wriggle, 0);
      return;
    }
    this.state = 'miss';
    this.timer = LEAVE;
    if (f && dist < 320) {
      this.scene.fx.text(f.x, f.y - 60, pick(['CLOSE ONE!', 'MISSED!', 'NOPE!']), { color: '#bfe9ff', size: 30 });
      this.scene.slowMotion(0.5, 400);
    }
  }

  private release(escaped: boolean): void {
    const f = this.scene.fish;
    bus.emit(EV.wriggle, -1);
    this.state = 'leave';
    this.timer = LEAVE;
    if (!f) return;
    f.grabbed = false;
    if (f.dead) return;
    if (escaped) {
      this.scene.fx.text(f.x, f.y - 60, 'WRIGGLED FREE!', { color: '#7dff9a', size: 32 });
      this.scene.fx.shards(f.x, f.y, 12, 0xffffff);
      this.scene.slowMotion(0.45, 500);
      synth.pop();
    } else {
      f.takeDamage(DROP_DAMAGE, 'eagle');
    }
    for (const p of f.parts) p.phys.setVelocity(randRange(-80, 80), 120);
  }
}
