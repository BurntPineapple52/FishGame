// Checkpoints (glowing stone cairns on the riverbed) and the stage goal.

import type * as Phaser from 'phaser';
import { synth } from '../audio/synth';
import { DEPTH, LAYER_2 } from '../config';
import type { GameScene } from '../scenes/GameScene';
import { bus, EV, session } from '../session';
import { addZone } from './Terrain';
import type { Entity } from './Entity';
import { Fish } from './Fish';

const fishOnly = { layer: LAYER_2, mask: LAYER_2 };

export interface CheckpointOptions {
  /** Base of the cairn (on the riverbed). */
  x: number;
  y: number;
  /** Where the fish respawns (should be in water). Defaults to x. */
  spawnY: number;
  spawnX?: number;
  /** Order along the stage; a checkpoint only counts if it's further than the current one. */
  order: number;
}

export class Checkpoint implements Entity {
  private active: boolean;
  private readonly orb: Phaser.GameObjects.Image;
  private readonly halo: Phaser.GameObjects.Image;
  private t = Math.random() * 10;

  constructor(
    private scene: GameScene,
    private opts: CheckpointOptions,
  ) {
    this.active = (session.checkpoint?.order ?? -1) >= opts.order;
    const { x, y } = opts;
    scene.add.image(x, y - 14, 'stone').setScale(1.3, 1.1).setDepth(DEPTH.environment);
    scene.add.image(x + 4, y - 40, 'stone').setScale(0.95, 0.85).setDepth(DEPTH.environment).setRotation(0.1);
    scene.add.image(x - 2, y - 60, 'stone').setScale(0.6).setDepth(DEPTH.environment).setRotation(-0.15);
    this.halo = scene.add.image(x, y - 92, 'glow').setScale(2.2).setBlendMode('ADD').setDepth(DEPTH.waterFx);
    this.orb = scene.add.image(x, y - 92, 'egg').setScale(1.6).setDepth(DEPTH.waterFx);
    this.applyLook();

    addZone(scene, { x, y: y - 400, w: 200, h: 1000 }, fishOnly, (b) => {
      if (b.owner instanceof Fish) this.activate();
    });
  }

  private applyLook(): void {
    this.orb.setTint(this.active ? 0xffffff : 0x7a8a99);
    this.halo.setTint(this.active ? 0xffc04a : 0x5a7a99).setAlpha(this.active ? 0.9 : 0.35);
  }

  private activate(): void {
    if (this.active) return;
    this.active = true;
    session.checkpoint = { x: this.opts.spawnX ?? this.opts.x, y: this.opts.spawnY, order: this.opts.order };
    this.applyLook();
    const { x, y } = this.opts;
    synth.chime();
    this.scene.fx.ring(x, y - 92, 3, 0xffd25a, 700);
    this.scene.fx.sparkle(x, y - 92, 16);
    this.scene.fx.glow(x, y - 92, 8);
    this.scene.tweens.add({ targets: this.orb, scale: 2.6, duration: 160, yoyo: true, ease: 'Back.easeOut' });
    bus.emit(EV.checkpoint);
    bus.emit(EV.toast, 'Checkpoint');
  }

  update(dt: number): void {
    this.t += dt;
    const bob = Math.sin(this.t * 2) * 5;
    this.orb.y = this.opts.y - 92 + bob;
    this.halo.y = this.orb.y;
    this.halo.setScale((this.active ? 2.4 : 1.8) + Math.sin(this.t * 3) * 0.2);
  }
}

export interface GoalOptions {
  x: number;
  /** Vertical extent of the trigger. */
  top: number;
  bottom: number;
  /** Where to draw the marker. */
  markerY: number;
  /** Extra flourish when the fish arrives (before the results). */
  onReach?: () => void;
}

/** End of the stage: a column of light with a bobbing arrow. */
export class Goal implements Entity {
  private readonly arrow: Phaser.GameObjects.Image;
  private t = 0;
  private sparkleTimer = 0;

  constructor(
    private scene: GameScene,
    private opts: GoalOptions,
  ) {
    const h = opts.bottom - opts.top;
    scene.add
      .image(opts.x, opts.top, 'ray')
      .setOrigin(0.5, 0)
      .setScale(2.4, h / 512)
      .setTint(0xffe08a)
      .setAlpha(0.45)
      .setBlendMode('ADD')
      .setDepth(DEPTH.rays);
    this.arrow = scene.add.image(opts.x, opts.markerY, 'arrow').setTint(0xffd25a).setDepth(DEPTH.waterFx).setScale(1.1);
    addZone(scene, { x: opts.x + 60, y: (opts.top + opts.bottom) / 2, w: 120, h }, fishOnly, (b) => {
      if (!(b.owner instanceof Fish) || scene.finished) return;
      opts.onReach?.();
      scene.completeStage();
    });
  }

  update(dt: number): void {
    this.t += dt;
    this.arrow.x = this.opts.x - 70 + Math.sin(this.t * 4) * 12;
    this.sparkleTimer -= dt;
    if (this.sparkleTimer <= 0) {
      this.sparkleTimer = 0.25;
      this.scene.fx.sparkle(this.opts.x + (Math.random() - 0.5) * 80, this.opts.markerY + (Math.random() - 0.5) * 300, 1, 0xffe08a);
    }
  }
}
