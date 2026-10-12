// Scenery with a bit of behaviour: tutorial hints, background salmon,
// current/leap jets and waterfalls.

import type * as Phaser from 'phaser';
import { DEPTH, FONT, LAYER_1 } from '../config';
import { input, type Action } from '../input';
import type { PhysBody } from '../physics/PhysicsWorld';
import type { GameScene } from '../scenes/GameScene';
import { randRange } from '../util/xform';
import type { Entity } from './Entity';

/** Keycaps and a caption floating in the world, fading in when the fish is near. */
export class Hint implements Entity {
  private readonly container: Phaser.GameObjects.Container;
  private readonly caps: { action: Action; img: Phaser.GameObjects.Image }[] = [];
  private alpha = 0;

  constructor(
    private scene: GameScene,
    private opts: { x: number; y: number; keys: Action[]; text: string; range?: number },
  ) {
    const children: Phaser.GameObjects.GameObject[] = [];
    const spacing = 64;
    opts.keys.forEach((action, i) => {
      const img = scene.add.image((i - (opts.keys.length - 1) / 2) * spacing, 0, `keycap_${action}`).setScale(0.75);
      this.caps.push({ action, img });
      children.push(img);
    });
    const label = scene.add
      .text(0, opts.keys.length ? 52 : 0, opts.text, {
        fontFamily: FONT,
        fontSize: '24px',
        color: '#fff6e0',
        stroke: '#1b2a3a',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5, 0);
    children.push(label);
    this.container = scene.add.container(opts.x, opts.y, children).setDepth(DEPTH.overlay).setAlpha(0);
  }

  update(_dt: number, realDt: number): void {
    const f = this.scene.fish;
    const near = !!f && Math.hypot(f.x - this.opts.x, f.y - this.opts.y) < (this.opts.range ?? 650);
    this.alpha += ((near ? 1 : 0) - this.alpha) * Math.min(1, realDt * 4);
    this.container.setAlpha(this.alpha);
    this.container.y = this.opts.y + Math.sin(this.scene.time.now / 500) * 4;
    for (const { action, img } of this.caps) {
      const down = input.isDown(action);
      img.setScale(down ? 0.68 : 0.75).setTint(down ? 0x9a9a9a : 0xffffff);
    }
  }
}

/** A background salmon (temp_fish art) swimming lazily, for life and scale. */
export class DecorFish implements Entity {
  private readonly img: Phaser.GameObjects.Image;
  private t = Math.random() * 100;
  private x: number;

  constructor(
    private opts: { scene: GameScene; x0: number; x1: number; y: number; speed?: number; scale?: number; tint?: number; alpha?: number; depth?: number },
  ) {
    this.x = randRange(opts.x0, opts.x1);
    this.img = opts.scene.add
      .image(this.x, opts.y, 'temp_fish')
      .setScale(opts.scale ?? 0.5)
      .setTint(opts.tint ?? 0x223344)
      .setAlpha(opts.alpha ?? 0.55)
      .setDepth(opts.depth ?? DEPTH.environment - 1);
  }

  update(dt: number): void {
    const o = this.opts;
    this.t += dt;
    const speed = o.speed ?? 40;
    this.x += speed * dt;
    if (this.x > o.x1) this.x = o.x0;
    if (this.x < o.x0) this.x = o.x1;
    this.img.setPosition(this.x, o.y + Math.sin(this.t * 0.9) * 12);
    this.img.setFlipX(speed < 0);
    this.img.setRotation(Math.sin(this.t * 0.9 + 1.2) * 0.06);
    this.img.scaleY = (o.scale ?? 0.5) * (1 + Math.sin(this.t * 7) * 0.03);
  }
}

/**
 * A zone pushing physics bodies with an extra force: rapids (sideways) or a
 * leap jet (upward column of bubbles at the foot of a waterfall).
 */
export class Jet implements Entity {
  private readonly inside = new Set<PhysBody>();
  private timer = 0;

  constructor(
    private scene: GameScene,
    private opts: {
      x: number;
      y: number;
      w: number;
      h: number;
      force: [number, number];
      style: 'bubbles' | 'rapids';
      /** Sideways speed added to the player when it shoots out of the top (leap assist). */
      exitBoostX?: number;
    },
  ) {
    const zone = scene.phys.createBody(
      { type: 'static', x: opts.x, y: opts.y, sensor: true, layer: LAYER_1, mask: LAYER_1 },
      [{ type: 'rect', w: opts.w, h: opts.h }],
    );
    zone.onEnter = (b) => {
      if (!b.is('physics') || this.inside.has(b)) return;
      this.inside.add(b);
      b.constantForce.x += opts.force[0];
      b.constantForce.y += opts.force[1];
    };
    zone.onExit = (b) => {
      if (!this.inside.delete(b)) return;
      if (opts.exitBoostX && b.is('player') && b.vy < -300 && b.y < opts.y - opts.h / 2 + 20) {
        b.setVelocity(b.vx + opts.exitBoostX, b.vy);
      }
      b.constantForce.x -= opts.force[0];
      b.constantForce.y -= opts.force[1];
    };
    if (opts.style === 'bubbles') {
      scene.add
        .image(opts.x, opts.y + opts.h / 2, 'ray')
        .setOrigin(0.5, 1)
        .setFlipY(true)
        .setScale(opts.w / 60, opts.h / 512)
        .setTint(0xbff0ff)
        .setAlpha(0.35)
        .setBlendMode('ADD')
        .setDepth(DEPTH.rays);
    }
  }

  update(dt: number): void {
    if (dt <= 0) return;
    const o = this.opts;
    const view = this.scene.cameras.main.worldView;
    if (o.x + o.w / 2 < view.x || o.x - o.w / 2 > view.right) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    if (o.style === 'bubbles') {
      this.timer = 0.04;
      this.scene.fx.bubbles(o.x + randRange(-o.w / 2, o.w / 2), o.y + o.h / 2 - 10, 1);
    } else {
      this.timer = 0.03;
      const len = Math.hypot(o.force[0], o.force[1]) || 1;
      const v = 420;
      this.scene.fx.streak(
        o.x + randRange(-o.w / 2, o.w / 2),
        o.y + randRange(-o.h / 2, o.h / 2),
        (o.force[0] / len) * v,
        (o.force[1] / len) * v,
      );
    }
  }
}

/** A sheet of falling water with mist where it lands. Purely visual. */
export class Waterfall implements Entity {
  private readonly sheet: Phaser.GameObjects.TileSprite;
  private timer = 0;

  constructor(
    private scene: GameScene,
    private opts: { x: number; top: number; bottom: number; width: number },
  ) {
    this.sheet = scene.add
      .tileSprite(opts.x, opts.top, opts.width, opts.bottom - opts.top, 'falls')
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.ground + 1)
      .setAlpha(0.85);
    // Lip of foam at the top
    scene.add
      .image(opts.x, opts.top, 'glow')
      .setScale(opts.width / 40, 0.6)
      .setTint(0xffffff)
      .setAlpha(0.7)
      .setDepth(DEPTH.ground + 2);
  }

  update(dt: number): void {
    if (dt <= 0) return;
    this.sheet.tilePositionY -= 900 * dt;
    const o = this.opts;
    const view = this.scene.cameras.main.worldView;
    if (o.x < view.x - 200 || o.x > view.right + 200) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.06;
      this.scene.fx.splash(o.x + randRange(-o.width / 2, o.width / 2), o.bottom, 0.15);
      if (Math.random() < 0.3) this.scene.fx.glow(o.x + randRange(-o.width, o.width), o.bottom - 20, 1, 0xe8f6ff);
    }
  }
}
