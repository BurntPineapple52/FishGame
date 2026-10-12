// Level select: a hand-drawn-looking river map winding upstream from the
// first stretch (bottom left) to the spawning grounds (top right). Every
// stage can be picked, whatever the save's progress.

import * as Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { synth } from '../audio/synth';
import { FONT, UI, VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { input } from '../input';
import { save } from '../save';
import { session } from '../session';
import { STAGES } from '../stages';
import { formatTime } from './UIScene';

const W = VIEW_WIDTH;
const H = VIEW_HEIGHT;

/** Node positions for stages 1..N (index 0, the title, isn't on the map). */
const NODES: [number, number][] = [
  [140, 520], [310, 440], [470, 500], [620, 380], [760, 300], [900, 360], [1020, 170],
];

export class MapScene extends Phaser.Scene {
  private index = 1;
  private cursor!: Phaser.GameObjects.Image;
  private info!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private roeIcons: Phaser.GameObjects.Image[] = [];
  private river: Phaser.Math.Vector2[] = [];
  private streaks: { u: number; img: Phaser.GameObjects.Image }[] = [];
  private nodes: Phaser.GameObjects.Container[] = [];
  private leaving = false;

  constructor() {
    super('map');
  }

  private get maxIndex(): number {
    return STAGES.length - 1;
  }

  create(): void {
    this.leaving = false;
    const furthest = Math.min(save.data.unlocked, this.maxIndex);
    this.index = Math.max(1, Math.min(session.stageIndex || furthest, this.maxIndex));
    this.cameras.main.setBackgroundColor(0x6aa86a);
    this.cameras.main.fadeIn(400, 0, 0, 0);
    audio.playMusic({ key: 'fish_theme', rate: 0.95 });
    audio.playAmbience({ key: 'rushing_water', volume: 0.25 });
    input.clearPressed();

    this.drawLand();
    this.drawRiver();
    this.drawNodes();

    const title = this.add
      .text(W / 2, 46, 'THE RIVER HOME', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: UI.cream, stroke: UI.ink, strokeThickness: 9 })
      .setOrigin(0.5)
      .setLetterSpacing(4);
    this.tweens.add({ targets: title, y: { from: 20, to: 46 }, alpha: { from: 0, to: 1 }, duration: 500, ease: 'Back.easeOut' });

    const panel = this.add.graphics();
    const px = W - 444;
    panel.fillStyle(0x0d1d2c, 0.85).fillRoundedRect(px, H - 116, 420, 96, 18);
    panel.lineStyle(3, 0xffd25a, 1).strokeRoundedRect(px, H - 116, 420, 96, 18);
    this.info = this.add.text(px + 20, H - 104, '', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: UI.cream });
    this.sub = this.add.text(px + 20, H - 64, '', { fontFamily: FONT, fontSize: '18px', color: '#c8d6e2' });
    for (let i = 0; i < 3; i++) this.roeIcons.push(this.add.image(px + 306 + i * 34, H - 52, 'roe').setScale(0.5));
    this.add
      .text(24, H - 24, '←/→ choose   Enter swim   Esc title', { fontFamily: FONT, fontSize: '18px', color: UI.cream, stroke: UI.ink, strokeThickness: 4 })
      .setOrigin(0, 1);

    this.cursor = this.add.image(0, 0, 'temp_fish').setScale(0.42).setDepth(10);
    const [x, y] = NODES[this.index - 1];
    this.cursor.setPosition(x, y - 46);
    this.refresh();
  }

  private drawLand(): void {
    const g = this.add.graphics();
    // Mountains toward the source
    g.fillStyle(0x8fa9b8, 1);
    g.fillTriangle(820, 230, 1000, 20, 1180, 230);
    g.fillTriangle(700, 260, 860, 60, 1000, 260);
    g.fillStyle(0xffffff, 0.9);
    g.fillTriangle(960, 66, 1000, 20, 1040, 66);
    g.fillTriangle(830, 96, 860, 60, 892, 96);
    // Fields and blobs of forest
    let seed = 3;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const x = r() * W;
      const y = 120 + r() * (H - 160);
      g.fillStyle([0x3f7f45, 0x2f6b3a, 0x4a8a4a][Math.floor(r() * 3)], 1);
      g.fillCircle(x, y, 10 + r() * 16);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle(0x8fd07a, 0.35);
      g.fillEllipse(r() * W, r() * H, 60 + r() * 120, 20 + r() * 30);
    }
  }

  private drawRiver(): void {
    const pts = [new Phaser.Math.Vector2(-40, 600), ...NODES.map(([x, y]) => new Phaser.Math.Vector2(x, y)), new Phaser.Math.Vector2(1180, 80)];
    const curve = new Phaser.Curves.Spline(pts);
    this.river = curve.getPoints(200);
    const g = this.add.graphics();
    g.lineStyle(34, 0x2a5f8f, 1);
    g.strokePoints(this.river, false, false);
    g.lineStyle(24, 0x3f8fd0, 1);
    g.strokePoints(this.river, false, false);
    g.lineStyle(4, 0xbfe9ff, 0.6);
    g.strokePoints(this.river, false, false);
    for (let i = 0; i < 26; i++) {
      const img = this.add.image(0, 0, 'streak').setAlpha(0.7).setScale(0.6, 1.5);
      this.streaks.push({ u: Math.random(), img });
    }
  }

  private drawNodes(): void {
    STAGES.forEach((stage, i) => {
      if (i === 0) return;
      const [x, y] = NODES[i - 1];
      const rec = save.record(stage.id, session.undead);
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      g.fillStyle(0x0b1622, 0.4).fillCircle(3, 5, 26);
      g.fillStyle(0xfff6e0, 1).fillCircle(0, 0, 24);
      g.lineStyle(5, rec.completed ? 0xffd25a : 0x1b2a3a, 1).strokeCircle(0, 0, 24);
      const label = this.add
        .text(0, 0, `${i}`, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: UI.ink })
        .setOrigin(0.5);
      c.add([g, label]);
      if (rec.completed) {
        const stars = 1 + (stage.par !== undefined && rec.bestTime !== undefined && rec.bestTime <= stage.par ? 1 : 0) + (rec.roe.filter(Boolean).length >= (stage.roeCount ?? 0) && (stage.roeCount ?? 0) > 0 ? 1 : 0);
        c.add(this.add.text(0, 34, '★'.repeat(stars) + '☆'.repeat(3 - stars), { fontFamily: FONT, fontSize: '16px', color: UI.gold, stroke: UI.ink, strokeThickness: 4 }).setOrigin(0.5));
      }
      c.setSize(60, 60).setInteractive({ useHandCursor: true });
      c.on(Phaser.Input.Events.POINTER_DOWN, () => {
        if (this.index === i) this.start();
        else this.select(i);
      });
      c.setScale(0);
      this.tweens.add({ targets: c, scale: 1, duration: 350, delay: 100 + i * 70, ease: 'Back.easeOut' });
      this.nodes.push(c);
    });
  }

  private select(i: number): void {
    if (i < 1 || i > this.maxIndex || i === this.index) return;
    this.index = i;
    synth.select();
    const [x, y] = NODES[i - 1];
    this.tweens.killTweensOf(this.cursor);
    this.cursor.setFlipX(x < this.cursor.x);
    this.tweens.add({ targets: this.cursor, x, y: y - 46, duration: 350, ease: 'Sine.easeInOut' });
    this.refresh();
  }

  private refresh(): void {
    const stage = STAGES[this.index];
    const rec = save.record(stage.id, session.undead);
    this.info.setText(`${this.index}. ${stage.name}`);
    this.sub.setText(rec.bestTime !== undefined ? `Best ${formatTime(rec.bestTime)}${stage.par ? `  ·  par ${formatTime(stage.par)}` : ''}` : stage.chapter ?? '');
    this.roeIcons.forEach((img, i) => {
      const show = i < (stage.roeCount ?? 0);
      img.setVisible(show).setTint(rec.roe[i] ? 0xffffff : 0x223344).setAlpha(rec.roe[i] ? 1 : 0.6);
    });
  }

  private start(): void {
    if (this.leaving) return;
    this.leaving = true;
    synth.confirm();
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('game', { stage: this.index }));
  }

  update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (const s of this.streaks) {
      s.u -= dt * 0.03;
      if (s.u < 0) s.u += 1;
      const n = this.river.length - 1;
      const k = Math.floor(s.u * n);
      const a = this.river[k];
      const b = this.river[Math.min(n, k + 1)];
      s.img.setPosition(a.x + Math.sin(s.u * 90) * 6, a.y + Math.cos(s.u * 70) * 4).setRotation(Math.atan2(b.y - a.y, b.x - a.x));
    }
    this.cursor.setRotation(Math.sin(this.time.now / 200) * 0.1);
    if (this.leaving) return;
    if (input.consumePressed('left') || input.consumePressed('down')) this.select(this.index - 1);
    if (input.consumePressed('right') || input.consumePressed('up')) this.select(this.index + 1);
    if (input.consumePressed('confirm')) this.start();
    if (input.consumePressed('pause')) {
      this.leaving = true;
      synth.back();
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('game', { stage: 0 }));
    }
  }
}
