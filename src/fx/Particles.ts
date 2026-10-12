// One-shot visual effects for a stage: bubbles, splashes, dust, shards,
// sparkles, ripples and floating text. Emitters are created once per scene and
// fired on demand, so effects cost nothing while idle.

import type * as Phaser from 'phaser';
import { DEPTH, FONT } from '../config';
import { randRange } from '../util/xform';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;
type EmitterConfig = Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;

export class Fx {
  private readonly bubble: Emitter;
  private readonly droplet: Emitter;
  private readonly dustE: Emitter;
  private readonly shard: Emitter;
  private readonly spark: Emitter;
  private readonly glowE: Emitter;
  private readonly streakE: Emitter;
  private readonly eggE: Emitter;
  private readonly leafE: Emitter;

  constructor(private scene: Phaser.Scene) {
    const add = (texture: string, depth: number, cfg: EmitterConfig): Emitter =>
      scene.add.particles(0, 0, texture, { emitting: false, ...cfg }).setDepth(depth);

    this.bubble = add('bubble', DEPTH.fx, {
      lifespan: { min: 700, max: 1500 },
      speedX: { min: -40, max: 40 },
      speedY: { min: -60, max: -140 },
      accelerationY: -120,
      scale: { start: 0.55, end: 0.15 },
      alpha: { start: 0.9, end: 0 },
    });
    this.droplet = add('droplet', DEPTH.waterFx, {
      lifespan: { min: 450, max: 900 },
      speed: { min: 120, max: 420 },
      angle: { min: -160, max: -20 },
      gravityY: 1300,
      scale: { start: 0.9, end: 0.3 },
      alpha: { start: 0.95, end: 0.2 },
      tint: [0xd8f0ff, 0xffffff, 0xa8d8ff],
    });
    this.dustE = add('dot', DEPTH.waterFx, {
      lifespan: { min: 300, max: 650 },
      speed: { min: 40, max: 180 },
      angle: { min: -170, max: -10 },
      gravityY: 300,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0x9b8466, 0xc2ab86, 0x7d6a52],
    });
    this.shard = add('shard', DEPTH.waterFx, {
      lifespan: { min: 600, max: 1100 },
      speed: { min: 180, max: 520 },
      angle: { min: 0, max: 360 },
      rotate: { min: 0, max: 360 },
      gravityY: 700,
      scale: { start: 1, end: 0.4 },
      alpha: { start: 1, end: 0 },
    });
    this.spark = add('sparkle', DEPTH.waterFx, {
      lifespan: { min: 300, max: 700 },
      speed: { min: 30, max: 220 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      rotate: { min: 0, max: 180 },
      blendMode: 'ADD',
    });
    this.glowE = add('glow', DEPTH.waterFx, {
      lifespan: { min: 400, max: 800 },
      speed: { min: 10, max: 80 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 0.6, end: 0 },
      blendMode: 'ADD',
    });
    this.streakE = add('streak', DEPTH.fx, {
      lifespan: { min: 600, max: 1100 },
      alpha: { start: 0, end: 0, ease: 'Sine.easeInOut' },
      scaleX: { min: 0.6, max: 1.6 },
    });
    this.eggE = add('egg', DEPTH.waterFx, {
      lifespan: { min: 900, max: 1600 },
      speed: { min: 60, max: 260 },
      angle: { min: -150, max: -30 },
      gravityY: 500,
      scale: { start: 1.1, end: 0.8 },
    });
    this.leafE = add('leaf1', DEPTH.foreground, {
      lifespan: 9000,
      speedX: { min: -50, max: 30 },
      speedY: { min: 40, max: 80 },
      rotate: { start: 0, end: 540 },
      scale: { min: 0.8, max: 1.3 },
      alpha: { start: 1, end: 0.6 },
    });
    // Streaks fade in and out; Phaser's alpha {start,end} can't express that,
    // so drive it from particle life.
    this.streakE.addParticleProcessor({
      active: true,
      update: (p: Phaser.GameObjects.Particles.Particle) => {
        const t = 1 - p.lifeCurrent / p.life;
        p.alpha = Math.sin(t * Math.PI) * 0.35;
        return false;
      },
    } as unknown as Phaser.GameObjects.Particles.ParticleProcessor);
  }

  bubbles(x: number, y: number, n = 3): void {
    this.bubble.explode(n, x, y);
  }

  /** Water entry/exit. `power` 0..1 scales the droplet count. */
  splash(x: number, y: number, power: number, tint?: number): void {
    const n = Math.round(4 + power * 18);
    if (tint !== undefined) this.droplet.setParticleTint(tint);
    else this.droplet.setParticleTint([0xd8f0ff, 0xffffff, 0xa8d8ff] as unknown as number);
    this.droplet.explode(n, x, y);
    this.ripple(x, y, 0.25 + power * 0.5, 0xffffff);
    if (power > 0.5) this.bubbles(x, y + 20, Math.round(power * 6));
  }

  dust(x: number, y: number, n = 8): void {
    this.dustE.explode(n, x, y);
  }

  shards(x: number, y: number, n = 10, tint = 0xffb0a0): void {
    this.shard.setParticleTint(tint);
    this.shard.explode(n, x, y);
  }

  sparkle(x: number, y: number, n = 8, tint = 0xfff2a8): void {
    this.spark.setParticleTint(tint);
    this.spark.explode(n, x, y);
  }

  glow(x: number, y: number, n = 6, tint = 0xffd25a): void {
    this.glowE.setParticleTint(tint);
    this.glowE.explode(n, x, y);
  }

  eggs(x: number, y: number, n = 20): void {
    this.eggE.explode(n, x, y);
  }

  /** A faint line drifting with the current. */
  streak(x: number, y: number, vx: number, vy: number): void {
    const p = this.streakE.emitParticleAt(x, y, 1);
    if (p) {
      p.velocityX = vx * randRange(0.7, 1.3);
      p.velocityY = vy * randRange(0.7, 1.3);
      p.rotation = Math.atan2(vy, vx);
    }
  }

  leaf(x: number, y: number): void {
    this.leafE.setTexture(Math.random() < 0.5 ? 'leaf1' : 'leaf2');
    this.leafE.explode(1, x, y);
  }

  ripple(x: number, y: number, scale = 0.5, tint = 0xffffff, depth = DEPTH.waterFx): void {
    const ring = this.scene.add.image(x, y, 'ring').setTint(tint).setScale(scale * 0.2, scale * 0.06).setAlpha(0.8).setDepth(depth);
    this.scene.tweens.add({
      targets: ring,
      scaleX: scale * 1.6,
      scaleY: scale * 0.45,
      alpha: 0,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  /** Expanding circle, e.g. checkpoint or pickup shockwave. */
  ring(x: number, y: number, scale = 1, tint = 0xffffff, duration = 500): void {
    const ring = this.scene.add.image(x, y, 'ring').setTint(tint).setScale(0.1).setAlpha(0.9).setDepth(DEPTH.waterFx).setBlendMode('ADD');
    this.scene.tweens.add({
      targets: ring,
      scale,
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  /** Comic text that pops up and floats away ("CHOMP!", "+15"). */
  text(x: number, y: number, msg: string, opts: { color?: string; size?: number; rise?: number; duration?: number } = {}): void {
    const t = this.scene.add
      .text(x, y, msg, {
        fontFamily: FONT,
        fontSize: `${opts.size ?? 28}px`,
        fontStyle: 'bold',
        color: opts.color ?? '#ffffff',
        stroke: '#1b2a3a',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.overlay)
      .setScale(0.2)
      .setRotation(randRange(-0.15, 0.15));
    this.scene.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: t,
      y: y - (opts.rise ?? 70),
      alpha: 0,
      delay: (opts.duration ?? 700) * 0.5,
      duration: opts.duration ?? 700,
      ease: 'Quad.easeIn',
      onComplete: () => t.destroy(),
    });
  }
}
