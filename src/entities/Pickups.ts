// Things to collect: mayflies (heal, hover just above the water so you have
// to leap for them) and golden roe (three hidden per stage).

import type * as Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { synth } from '../audio/synth';
import { DEPTH, LAYER_2 } from '../config';
import type { PhysBody } from '../physics/PhysicsWorld';
import type { GameScene } from '../scenes/GameScene';
import { save } from '../save';
import { bus, EV, session } from '../session';
import { pick } from '../util/xform';
import type { Entity } from './Entity';
import { Fish } from './Fish';

const FLY_HEAL = 15;
const fishOnly = { layer: LAYER_2, mask: LAYER_2 };

function sensor(scene: GameScene, x: number, y: number, size: number): PhysBody {
  return scene.phys.createBody({ type: 'static', x, y, sensor: true, ...fishOnly }, [{ type: 'rect', w: size, h: size }]);
}

export class Fly implements Entity {
  removed = false;
  private readonly img: Phaser.GameObjects.Image;
  private readonly body: PhysBody;
  private t = Math.random() * 10;

  constructor(
    private scene: GameScene,
    private x: number,
    private y: number,
  ) {
    this.img = scene.add.image(x, y, 'fly').setDepth(DEPTH.waterFx).setScale(1.2);
    this.body = sensor(scene, x, y, 56);
    this.body.onEnter = (b) => {
      if (b.owner instanceof Fish && !this.removed) this.eat(b.owner);
    };
  }

  private eat(fish: Fish): void {
    this.removed = true;
    this.scene.phys.destroyBody(this.body);
    fish.heal(FLY_HEAL);
    session.flies++;
    save.data.totalFlies++;
    audio.sfx('chomp', { volume: 0.7 });
    this.scene.fx.sparkle(this.x, this.y, 8, 0xcfffb0);
    this.scene.fx.text(this.x, this.y - 30, pick(['CHOMP!', 'NOM!', 'GULP!']), { color: '#cfffb0', size: 26 });
    this.scene.fx.text(this.x + 30, this.y + 10, `+${FLY_HEAL}`, { color: '#7dff9a', size: 20, rise: 50 });
    this.scene.hitstop(40);
    bus.emit(EV.fly, session.flies);
    this.img.destroy();
  }

  update(dt: number): void {
    if (this.removed) return;
    this.t += dt;
    this.img.setPosition(this.x + Math.sin(this.t * 1.7) * 14, this.y + Math.sin(this.t * 3.1) * 8);
    // Wing flutter
    this.img.setScale(1.2, 1.2 * (0.85 + 0.15 * Math.abs(Math.sin(this.t * 30))));
    this.img.setFlipX(Math.cos(this.t * 1.7) < 0);
  }
}

export class Roe implements Entity {
  removed = false;
  private readonly img: Phaser.GameObjects.Image;
  private readonly halo: Phaser.GameObjects.Image;
  private readonly body: PhysBody;
  private t = Math.random() * 10;
  private sparkleTimer = 0;

  /** Returns null if this roe was already collected during the current attempt. */
  static create(scene: GameScene, x: number, y: number, index: number): Roe | null {
    if (session.roe[index]) return null;
    return scene.addEntity(new Roe(scene, x, y, index));
  }

  private constructor(
    private scene: GameScene,
    private x: number,
    private y: number,
    private index: number,
  ) {
    const owned = !!save.record(scene.stage.id, session.undead).roe[index];
    this.halo = scene.add.image(x, y, 'glow').setTint(0xffc21a).setBlendMode('ADD').setDepth(DEPTH.waterFx).setScale(2);
    this.img = scene.add.image(x, y, 'roe').setDepth(DEPTH.waterFx);
    if (owned) {
      // Found on an earlier run: still collectable, but shown as a ghost.
      this.img.setAlpha(0.45);
      this.halo.setAlpha(0.3);
    }
    this.body = sensor(scene, x, y, 70);
    this.body.onEnter = (b) => {
      if (b.owner instanceof Fish && !this.removed) this.collect();
    };
  }

  private collect(): void {
    this.removed = true;
    this.scene.phys.destroyBody(this.body);
    session.roe[this.index] = true;
    synth.jingle();
    this.scene.fx.sparkle(this.x, this.y, 22);
    this.scene.fx.glow(this.x, this.y, 10, 0xffc21a);
    this.scene.fx.ring(this.x, this.y, 2.2, 0xffd25a, 600);
    this.scene.fx.text(this.x, this.y - 50, 'GOLDEN ROE!', { color: '#ffd25a', size: 32, duration: 1000 });
    this.scene.slowMotion(0.4, 500);
    this.scene.camera.zoomPunch(0.08);
    bus.emit(EV.roe, this.index);
    this.scene.tweens.add({
      targets: [this.img, this.halo],
      scale: 0,
      alpha: 0,
      duration: 300,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.img.destroy();
        this.halo.destroy();
      },
    });
  }

  update(dt: number): void {
    if (this.removed) return;
    this.t += dt;
    const y = this.y + Math.sin(this.t * 2.2) * 6;
    this.img.setY(y).setRotation(Math.sin(this.t * 1.3) * 0.15);
    this.halo.setY(y).setScale(1.8 + Math.sin(this.t * 3) * 0.3);
    this.sparkleTimer -= dt;
    if (this.sparkleTimer <= 0) {
      this.sparkleTimer = 0.4 + Math.random() * 0.4;
      this.scene.fx.sparkle(this.x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 50, 1, 0xfff2a8);
    }
  }
}
