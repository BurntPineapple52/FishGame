// On-screen key that darkens while its key is held (Keycap.gd).

import type * as Phaser from 'phaser';
import { input, type Action } from '../input';
import type { GameScene } from '../scenes/GameScene';
import type { Entity } from './Entity';

const PRESSED_LEVEL = 0x62 / 0xff; // Color("626262")
const FADE_SPEED = 1 / 0.3; // full fade in 0.3 s

export interface KeycapOptions {
  action: Action;
  texture: string;
  x: number;
  y: number;
  rot?: number;
  scale?: number;
  depth: number;
}

export class Keycap implements Entity {
  private readonly image: Phaser.GameObjects.Image;
  private level = 1;

  constructor(
    scene: GameScene,
    private opts: KeycapOptions,
  ) {
    this.image = scene.add
      .image(opts.x, opts.y, opts.texture)
      .setRotation(opts.rot ?? 0)
      .setScale(opts.scale ?? 1)
      .setDepth(opts.depth);
  }

  update(dt: number): void {
    const target = input.isDown(this.opts.action) ? PRESSED_LEVEL : 1;
    const step = FADE_SPEED * dt;
    this.level = this.level < target ? Math.min(target, this.level + step) : Math.max(target, this.level - step);
    const c = Math.round(this.level * 255);
    this.image.setTint((c << 16) | (c << 8) | c);
  }
}
