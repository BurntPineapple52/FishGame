// A vertical text menu driven by the keyboard (arrows/WASD, Enter/Space,
// left/right to adjust values, Esc to go back) or the mouse.

import * as Phaser from 'phaser';
import { synth } from '../audio/synth';
import { FONT, UI } from '../config';
import { input } from '../input';

export interface MenuItem {
  label: string | (() => string);
  action?: () => void;
  /** Left/right changes a value (settings). */
  adjust?: (dir: -1 | 1) => void;
  disabled?: () => boolean;
}

export interface MenuOptions {
  x: number;
  y: number;
  spacing?: number;
  size?: number;
  onBack?: () => void;
  depth?: number;
}

export class Menu {
  readonly container: Phaser.GameObjects.Container;
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly cursor: Phaser.GameObjects.Image;
  private index = 0;
  private t = 0;
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    private items: MenuItem[],
    private opts: MenuOptions,
  ) {
    const spacing = opts.spacing ?? 54;
    const size = opts.size ?? 34;
    this.container = scene.add.container(opts.x, opts.y).setDepth(opts.depth ?? 100);
    items.forEach((_item, i) => {
      const t = scene.add
        .text(0, i * spacing, '', {
          fontFamily: FONT,
          fontSize: `${size}px`,
          fontStyle: 'bold',
          color: UI.cream,
          stroke: UI.ink,
          strokeThickness: 7,
        })
        .setOrigin(0.5);
      t.setInteractive({ useHandCursor: true });
      t.on(Phaser.Input.Events.POINTER_OVER, () => this.select(i));
      t.on(Phaser.Input.Events.POINTER_DOWN, () => {
        this.select(i);
        this.activate();
      });
      this.texts.push(t);
      this.container.add(t);
    });
    this.cursor = scene.add.image(0, 0, 'temp_fish').setScale(0.32);
    this.container.add(this.cursor);
    while (this.items[this.index]?.disabled?.() && this.index < items.length - 1) this.index++;
    this.refresh();
    input.clearPressed();

    // Pop in.
    this.container.setScale(0.9).setAlpha(0);
    scene.tweens.add({ targets: this.container, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
  }

  private select(i: number): void {
    if (i === this.index || this.items[i].disabled?.()) return;
    this.index = i;
    synth.select();
    this.refresh();
  }

  private activate(): void {
    const item = this.items[this.index];
    if (item.disabled?.()) return;
    if (item.action) {
      synth.confirm();
      item.action();
    } else if (item.adjust) {
      item.adjust(1);
      synth.select();
    }
    if (!this.destroyed) this.refresh();
  }

  refresh(): void {
    this.items.forEach((item, i) => {
      const t = this.texts[i];
      const label = typeof item.label === 'function' ? item.label() : item.label;
      const selected = i === this.index;
      t.setText(item.adjust && selected ? `‹  ${label}  ›` : label);
      t.setColor(item.disabled?.() ? '#6d7d8c' : selected ? UI.gold : UI.cream);
      t.setScale(selected ? 1.08 : 1);
    });
    const sel = this.texts[this.index];
    if (sel) this.cursor.setPosition(sel.x - sel.displayWidth / 2 - 50, sel.y);
  }

  /** Call every frame while the menu is open. */
  update(dt: number): void {
    if (this.destroyed) return;
    this.t += dt;
    const sel = this.texts[this.index];
    if (sel) {
      this.cursor.x = sel.x - sel.displayWidth / 2 - 50 + Math.sin(this.t * 8) * 5;
      this.cursor.setRotation(Math.sin(this.t * 8) * 0.12);
    }

    const n = this.items.length;
    const move = (dir: number) => {
      let i = this.index;
      for (let k = 0; k < n; k++) {
        i = (i + dir + n) % n;
        if (!this.items[i].disabled?.()) break;
      }
      this.select(i);
    };
    if (input.consumePressed('up')) move(-1);
    if (input.consumePressed('down')) move(1);
    const item = this.items[this.index];
    if (item?.adjust) {
      if (input.consumePressed('left')) {
        item.adjust(-1);
        synth.select();
        this.refresh();
      }
      if (input.consumePressed('right')) {
        item.adjust(1);
        synth.select();
        this.refresh();
      }
    }
    if (input.consumePressed('confirm')) this.activate();
    else if (input.consumePressed('pause') && this.opts.onBack) {
      synth.back();
      this.opts.onBack();
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.container.destroy();
  }
}
