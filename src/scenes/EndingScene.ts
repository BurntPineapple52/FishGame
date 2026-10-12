// The ending: Sockeye reaches the gravel, lays eggs and rests. The seasons
// turn, a fry hatches and flops at the camera, then credits and totals roll.

import * as Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { synth } from '../audio/synth';
import { FONT, UI, VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { Fx } from '../fx/Particles';
import { input } from '../input';
import { save } from '../save';
import { session } from '../session';
import { STAGES } from '../stages';
import { randRange } from '../util/xform';

const W = VIEW_WIDTH;
const H = VIEW_HEIGHT;
const GRAVEL_Y = 540;

export class EndingScene extends Phaser.Scene {
  private fx!: Fx;
  private caption!: Phaser.GameObjects.Text;
  private tint!: Phaser.GameObjects.Rectangle;
  private canSkip = false;
  private finished = false;
  private snow = false;
  private leafFall = false;
  private eggs: Phaser.GameObjects.Image[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];

  constructor() {
    super('ending');
  }

  create(): void {
    this.canSkip = false;
    this.finished = false;
    this.snow = false;
    this.leafFall = false;
    this.eggs = [];
    this.timers = [];
    input.clearPressed();
    this.cameras.main.fadeIn(1200, 0, 0, 0);
    audio.playMusic({ key: 'fish_theme', rate: 0.8 }, 2);
    audio.playAmbience({ key: 'rushing_water', volume: 0.2 });
    this.fx = new Fx(this);

    // Underwater backdrop
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2f7f9a, 0x2f7f9a, 0x0b2a3a, 0x0b2a3a, 1).fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      this.add
        .image(120 + i * 200 + randRange(-40, 40), -10, 'ray')
        .setOrigin(0.5, 0)
        .setScale(randRange(1.5, 2.5), 1.2)
        .setBlendMode('ADD')
        .setAlpha(0.18)
        .setRotation(randRange(-0.2, 0.1));
    }
    // Gravel bed
    const g = this.add.graphics();
    g.fillStyle(0x5a4a3a, 1).fillRect(0, GRAVEL_Y, W, H - GRAVEL_Y);
    for (let i = 0; i < 420; i++) {
      const c = [0x8b8781, 0x6d6a66, 0xa49c90, 0x7a6f62, 0xb08a5a][Math.floor(Math.random() * 5)];
      const w = randRange(8, 26);
      g.fillStyle(c, 1).fillEllipse(Math.random() * W, GRAVEL_Y + Math.random() * (H - GRAVEL_Y), w, w * 0.6);
    }

    // Sockeye, spent from the journey.
    const sockeye = this.add.container(-200, 380, [
      this.add.image(-29, 0, 'fish_tail_zombified1'),
      this.add.image(0, 0, 'fish_center_zombified1v2'),
      this.add.image(29, 0, 'fish_head_zombified1v2'),
    ]).setScale(2);

    this.tint = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(50);
    this.caption = this.add
      .text(W / 2, 110, '', { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: UI.cream, stroke: UI.ink, strokeThickness: 8, align: 'center' })
      .setOrigin(0.5)
      .setDepth(60);

    // --- Timeline ---
    this.tweens.add({ targets: sockeye, x: W / 2, duration: 4500, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: sockeye, y: 395, duration: 900, yoyo: true, repeat: 4, ease: 'Sine.easeInOut' });
    this.at(1.0, () => this.say('Sockeye made it home.'));
    this.at(1.5, () => (this.canSkip = true));
    this.at(4.8, () => {
      this.tweens.add({ targets: sockeye, y: GRAVEL_Y - 30, rotation: 0.08, duration: 1200, ease: 'Quad.easeOut' });
    });
    this.at(6.2, () => this.layEggs(W / 2, GRAVEL_Y - 20));
    this.at(7.0, () => this.say('Hundreds of tiny promises,\ntucked into the gravel where it all began.'));
    this.at(10.5, () => {
      this.say('The journey ends where it started.');
      this.tweens.add({ targets: sockeye, alpha: 0, duration: 4000, ease: 'Sine.easeIn' });
    });
    this.at(14.5, () => this.season('Autumn.', 0xd97a2a, 0.22, () => (this.leafFall = true)));
    this.at(18.0, () =>
      this.season('Winter. The river sleeps.', 0xcfe6ff, 0.3, () => {
        this.leafFall = false;
        this.snow = true;
      }),
    );
    this.at(21.5, () =>
      this.season('Spring.', 0x9dff7a, 0.12, () => {
        this.snow = false;
      }),
    );
    this.at(23.5, () => this.hatch());
    this.at(30, () => this.rollCredits());
  }

  /** Schedule `fn` at `sec` seconds into the ending. */
  private at(sec: number, fn: () => void): void {
    this.timers.push(this.time.delayedCall(sec * 1000, fn));
  }

  private say(text: string): void {
    this.tweens.killTweensOf(this.caption);
    this.caption.setText(text).setAlpha(0).setY(130);
    this.tweens.add({ targets: this.caption, alpha: 1, y: 110, duration: 600, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: this.caption, alpha: 0, delay: 3000, duration: 500 });
  }

  private layEggs(x: number, y: number): void {
    synth.jingle();
    this.fx.eggs(x, y, 30);
    this.fx.glow(x, y, 12, 0xffa040);
    this.cameras.main.shake(300, 0.004);
    for (let i = 0; i < 26; i++) {
      const egg = this.add
        .image(x + randRange(-90, 90), GRAVEL_Y + randRange(-6, 30), 'egg')
        .setScale(0)
        .setDepth(5);
      this.tweens.add({ targets: egg, scale: randRange(0.8, 1.2), delay: 400 + i * 40, duration: 300, ease: 'Back.easeOut' });
      this.eggs.push(egg);
    }
  }

  private season(label: string, color: number, alpha: number, onStart: () => void): void {
    onStart();
    synth.chime();
    this.setTint(color, alpha, 1200);
    this.say(label);
  }

  /** Fade the season overlay out, swap its colour, and fade it back in. */
  private setTint(color: number, alpha: number, ms: number): void {
    this.tweens.killTweensOf(this.tint);
    this.tweens.add({
      targets: this.tint,
      fillAlpha: 0,
      duration: ms * 0.35,
      onComplete: () => {
        this.tint.setFillStyle(color, 0);
        this.tweens.add({ targets: this.tint, fillAlpha: alpha, duration: ms * 0.65 });
      },
    });
  }

  private hatch(): void {
    this.tweens.add({ targets: this.tint, fillAlpha: 0, duration: 1500 });
    const egg = this.eggs[Math.floor(this.eggs.length / 2)];
    if (!egg) return;
    this.tweens.add({
      targets: egg,
      angle: { from: -15, to: 15 },
      duration: 90,
      yoyo: true,
      repeat: 7,
      onComplete: () => {
        synth.pop();
        this.fx.sparkle(egg.x, egg.y, 12);
        egg.destroy();
        const fry = this.add.image(egg.x, egg.y - 10, 'temp_fish').setScale(0.12).setDepth(30);
        this.say('...flop!');
        // Wiggle, flop right at the camera, then head downstream (left) for the sea.
        this.tweens.add({ targets: fry, angle: { from: -12, to: 12 }, duration: 120, yoyo: true, repeat: -1 });
        this.tweens.add({
          targets: fry,
          scale: 1.6,
          x: W / 2,
          y: H / 2,
          delay: 1200,
          duration: 700,
          ease: 'Back.easeIn',
          onComplete: () => {
            this.cameras.main.shake(250, 0.01);
            audio.sfx('splat', { volume: 0.4, rate: 1.4 });
            fry.setFlipX(true);
            this.tweens.add({ targets: fry, x: -300, scale: 0.4, delay: 600, duration: 1500, ease: 'Quad.easeIn' });
          },
        });
        // Its siblings hatch too.
        for (const e of this.eggs) {
          if (!e.active) continue;
          this.time.delayedCall(randRange(1500, 4000), () => {
            if (!e.active) return;
            const f = this.add.image(e.x, e.y - 6, 'temp_fish').setScale(0.08).setDepth(20).setFlipX(true);
            e.destroy();
            this.tweens.add({ targets: f, x: -100, y: f.y - randRange(50, 300), duration: randRange(3000, 6000), ease: 'Sine.easeIn' });
          });
        }
      },
    });
  }

  private rollCredits(): void {
    if (this.finished) return;
    this.finished = true;
    for (const t of this.timers) t.remove();
    this.setTint(0x050c14, 0.85, 1500);
    this.tweens.killTweensOf(this.caption);
    this.caption.setAlpha(0);

    const records = Object.values(save.data.records);
    const roe = records.reduce((n, r) => n + r.roe.filter(Boolean).length, 0);
    const maxRoe = STAGES.reduce((n, s) => n + (s.roeCount ?? 0), 0);
    const lines = [
      'FLOP',
      'THE LAST RUN',
      '',
      '',
      'A FishFest game by',
      'Kaylee',
      'Max',
      'Sam Ostrander',
      '',
      'Built with Phaser and Planck.js',
      '',
      '',
      `Golden roe found: ${roe} / ${maxRoe}`,
      `Flies eaten: ${save.data.totalFlies}`,
      `Lives lost: ${save.data.deaths}`,
      '',
      session.undead ? 'You finished the Undead Run.\nThe river will tell stories about you.' : 'UNDEAD RUN UNLOCKED\nFind it in the title menu.',
      '',
      '',
      'Thanks for playing.',
    ];
    const credits = this.add
      .text(W / 2, H + 40, lines.join('\n'), {
        fontFamily: FONT,
        fontSize: '30px',
        fontStyle: 'bold',
        color: UI.cream,
        stroke: UI.ink,
        strokeThickness: 6,
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5, 0)
      .setDepth(70);
    this.tweens.add({
      targets: credits,
      y: H / 2 - credits.height + 120,
      duration: 16000,
      ease: 'Linear',
      onComplete: () => {
        const prompt = this.add
          .text(W / 2, H - 50, 'Press Enter', { fontFamily: FONT, fontSize: '24px', color: UI.gold, stroke: UI.ink, strokeThickness: 5 })
          .setOrigin(0.5)
          .setDepth(70);
        this.tweens.add({ targets: prompt, alpha: { from: 0.3, to: 1 }, duration: 600, yoyo: true, repeat: -1 });
      },
    });
  }

  update(): void {
    if (this.leafFall && Math.random() < 0.08) this.fx.leaf(randRange(0, W + 200), -20);
    if (this.snow && Math.random() < 0.5) {
      const s = this.add.image(randRange(0, W + 100), -10, 'dot').setScale(randRange(0.2, 0.5)).setAlpha(0.9).setDepth(55);
      this.tweens.add({ targets: s, y: H + 20, x: s.x - randRange(40, 160), duration: randRange(3000, 6000), onComplete: () => s.destroy() });
    }
    if (!this.canSkip) return;
    if (input.consumePressed('confirm') || input.consumePressed('pause')) {
      if (!this.finished) {
        this.rollCredits();
        return;
      }
      synth.confirm();
      this.canSkip = false;
      this.cameras.main.fadeOut(800, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('game', { stage: 0 }));
    }
  }
}
