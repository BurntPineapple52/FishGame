// On-screen key that darkens while its key is held (Keycap.gd).
// Pressing it also squashes the cap and plays a note, so the title's
// F L O P keys double as a tiny instrument.

import type * as Phaser from 'phaser';
import { synth } from '../audio/synth';
import { input, type Action } from '../input';
import type { GameScene } from '../scenes/GameScene';
import type { Entity } from './Entity';

const PRESSED_LEVEL = 0x62 / 0xff; // Color("626262")
const FADE_SPEED = 1 / 0.3; // full fade in 0.3 s

/** F L O P play C E G C. */
const NOTES: Partial<Record<Action, number>> = { f: 523, l: 659, o: 784, p: 1047 };

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
  private wasDown = false;
  private t = Math.random() * 10;

  constructor(
    private scene: GameScene,
    private opts: KeycapOptions,
  ) {
    this.image = scene.add
      .image(opts.x, opts.y, opts.texture)
      .setRotation(opts.rot ?? 0)
      .setScale(opts.scale ?? 1)
      .setDepth(opts.depth);
  }

  update(_dt: number, realDt: number): void {
    const down = input.isDown(this.opts.action);
    const target = down ? PRESSED_LEVEL : 1;
    const step = FADE_SPEED * realDt;
    this.level = this.level < target ? Math.min(target, this.level + step) : Math.max(target, this.level - step);
    const c = Math.round(this.level * 255);
    this.image.setTint((c << 16) | (c << 8) | c);

    const base = this.opts.scale ?? 1;
    if (down && !this.wasDown) {
      const note = NOTES[this.opts.action];
      if (note) synth.note(note);
      this.scene.tweens.add({ targets: this.image, scaleX: base * 1.12, scaleY: base * 0.82, duration: 60, yoyo: true, ease: 'Quad.easeOut' });
    }
    this.wasDown = down;
    // Gentle idle bob
    this.t += realDt;
    this.image.y = this.opts.y + Math.sin(this.t * 1.6 + this.opts.x * 0.02) * 3;
  }
}
