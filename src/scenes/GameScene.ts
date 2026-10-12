// Runs one stage: owns the physics world, the entity list and the fixed-step loop.
// Restarting or advancing a stage restarts this scene with a different stage index
// (the equivalent of game.gd's restart_stage / next_stage).
//
// Also the home of "game feel" timing: slow motion, hitstop, the death sequence
// and stage completion. Overlays (HUD, cards, iris wipes) live in UIScene.

import * as Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { synth } from '../audio/synth';
import { COLORS, MAX_STEPS_PER_FRAME, PHYSICS_DT } from '../config';
import type { Entity } from '../entities/Entity';
import { Fish, type FishOptions } from '../entities/Fish';
import type { Water } from '../entities/Water';
import { FishCamera } from '../fx/FishCamera';
import { Fx } from '../fx/Particles';
import { input } from '../input';
import { PhysicsWorld, type PhysBody } from '../physics/PhysicsWorld';
import { save } from '../save';
import { bus, EV, session } from '../session';
import { STAGES, type StageDef } from '../stages';
import { angleDifference, clamp, pick } from '../util/xform';
import type { UIScene } from './UIScene';

interface BodyView {
  body: PhysBody;
  obj: Phaser.GameObjects.Container;
}

export interface GameSceneData {
  stage?: number;
  /** Rebuild after a death or a restart-from-checkpoint (no title card). */
  respawn?: boolean;
}

export interface StageStartInfo {
  stage: StageDef;
  index: number;
  fresh: boolean;
}

export interface StageResult {
  stage: StageDef;
  index: number;
  time: number;
  par?: number;
  roe: boolean[];
  roeCount: number;
  flies: number;
  deaths: number;
  newBest: boolean;
  last: boolean;
}

const RESTART_HOLD = 0.6;
const DEATH_DELAY = 1.6;

const EPITAPHS: Record<string, string[]> = {
  bear: ['Became bear brunch.', 'Swiped left. Permanently.', 'The bear sends its regards.', 'Unbearable.'],
  eagle: ["Eagle's takeout order.", 'Air mail, one way.', 'Talons: 1, Salmon: 0.'],
  dry: ['Turned into jerky.', 'Sun-dried salmon.', 'Forgot to breathe water.'],
  log: ['Flattened by driftwood.', 'Log: 1, Fish: 0.'],
  bruise: ['Bruised like an old peach.', 'Too frail for this river.', 'One bump too many.'],
  default: ['Sleeps with the fishes. Wait.', 'Gone belly-up.', 'Swam its last.'],
};

export class GameScene extends Phaser.Scene {
  /** Toggled with the backquote key; persists across restarts. */
  static debugDraw = false;

  phys!: PhysicsWorld;
  stage!: StageDef;
  fx!: Fx;
  camera!: FishCamera;
  fish: Fish | null = null;
  readonly waters: Water[] = [];
  stageIndex = 0;
  /** Gameplay is held still (title card showing). */
  frozen = false;
  finished = false;
  dying = false;
  /** An iris is closing toward another stage or a respawn: ignore input and freeze the timer. */
  transitioning = false;
  /** Info from the latest create, for a UI that launches after the start event. */
  startInfo: StageStartInfo | null = null;
  /** Slow motion factor applied to physics and tweens. */
  timeScale = 1;

  private entities: Entity[] = [];
  private views: BodyView[] = [];
  private accumulator = 0;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private fpsText: Phaser.GameObjects.Text | null = null;
  private hitstopLeft = 0;
  private slowmo: { scale: number; left: number; total: number } | null = null;
  private deathTimer = 0;
  private restartHeld = 0;

  constructor() {
    super('game');
  }

  get ui(): UIScene {
    return this.scene.get('ui') as UIScene;
  }

  create(data: GameSceneData): void {
    this.stageIndex = clamp(data.stage ?? 0, 0, STAGES.length - 1);
    this.stage = STAGES[this.stageIndex];
    const fresh = !data.respawn || session.stageIndex !== this.stageIndex;
    if (fresh) session.resetStage(this.stageIndex);

    this.phys = new PhysicsWorld();
    this.entities = [];
    this.views = [];
    this.waters.length = 0;
    this.fish = null;
    this.accumulator = 0;
    this.frozen = false;
    this.finished = false;
    this.dying = false;
    this.transitioning = false;
    this.deathTimer = Infinity;
    this.timeScale = 1;
    this.hitstopLeft = 0;
    this.slowmo = null;
    this.restartHeld = 0;
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;
    input.clearPressed();

    const cam = this.cameras.main;
    cam.stopFollow();
    cam.removeBounds();
    cam.resetFX();
    cam.setZoom(1).setRotation(0);
    cam.setBackgroundColor(this.stage.sky ?? COLORS.sky);

    this.fx = new Fx(this);
    this.camera = new FishCamera(cam);
    this.stage.build(this);
    this.camera.snap();

    const music = session.undead && !this.stage.isTitle ? { key: 'thriller', volume: 0.8 } : this.stage.music;
    audio.playMusic(music ?? null);
    audio.playAmbience(this.stage.ambience ?? null);

    this.debugGfx = this.add.graphics().setDepth(10_000);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.fpsText = null;
    });

    if (!this.scene.isActive('ui')) this.scene.launch('ui');
    this.scene.bringToTop('ui');
    this.frozen = fresh && !!this.stage.story?.length;
    this.startInfo = { stage: this.stage, index: this.stageIndex, fresh };
    bus.emit(EV.stageStart, this.startInfo);
  }

  addEntity<T extends Entity>(entity: T): T {
    this.entities.push(entity);
    return entity;
  }

  /**
   * Create a container that follows `body` every frame. Children are positioned in
   * the body's local space, like sprites under a RigidBody2D in Godot.
   * The container is destroyed when the body is.
   */
  attach(body: PhysBody, depth: number, children: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Container {
    const obj = this.add.container(body.x, body.y, children).setRotation(body.rot).setDepth(depth);
    this.views.push({ body, obj });
    return obj;
  }

  /** Create the player, at the last checkpoint if there is one, and follow it. */
  spawnFish(opts: FishOptions): Fish {
    const cp = session.checkpoint;
    const fish = new Fish(this, cp ? { ...opts, x: cp.x, y: cp.y, rot: 0 } : opts);
    this.fish = this.addEntity(fish);
    this.camera.target = () => fish.cameraInfo();
    this.camera.offsetY = -70;
    return fish;
  }

  /** The water body under or around `x`, if any. */
  waterAt(x: number): Water | undefined {
    return this.waters.find((w) => w.coversX(x));
  }

  // ---- Feel -------------------------------------------------------------

  /** Freeze the simulation for a few frames to sell an impact. */
  hitstop(ms: number): void {
    this.hitstopLeft = Math.max(this.hitstopLeft, ms / 1000);
  }

  /** Slow time to `scale`, easing back to normal over the last part of `ms`. */
  slowMotion(scale: number, ms: number): void {
    if (this.slowmo && this.slowmo.scale < scale && this.slowmo.left > 0.1) return;
    this.slowmo = { scale, left: ms / 1000, total: ms / 1000 };
  }

  shake(amount: number): void {
    this.camera.shake(amount);
  }

  /** Full-screen colour flash (drawn by the UI). */
  flash(color = 0xffffff, alpha = 0.6, ms = 180): void {
    bus.emit(EV.flash, color, alpha, ms);
  }

  // ---- Flow -------------------------------------------------------------

  /** Restart the whole stage from the beginning (fresh timer and title card skipped). */
  restartStage(): void {
    session.resetStage(this.stageIndex);
    this.scene.restart({ stage: this.stageIndex, respawn: true } satisfies GameSceneData);
  }

  /** Rebuild the stage and put the fish back at the last checkpoint. */
  respawn(): void {
    this.scene.restart({ stage: this.stageIndex, respawn: true } satisfies GameSceneData);
  }

  goToStage(index: number): void {
    if (index >= STAGES.length) {
      this.scene.start('ending');
      return;
    }
    this.scene.restart({ stage: index } satisfies GameSceneData);
  }

  nextStage(): void {
    this.goToStage(this.stageIndex + 1);
  }

  /** Close the iris on the fish, then run `then`. */
  transition(then: () => void): void {
    this.transitioning = true;
    const pos = this.fishScreenPos();
    this.ui.irisClose(pos.x, pos.y, then);
  }

  fishScreenPos(): { x: number; y: number } {
    const cam = this.cameras.main;
    const f = this.fish;
    if (!f) return { x: cam.width / 2, y: cam.height / 2 };
    return {
      x: (f.x - cam.midPoint.x) * cam.zoom + cam.width / 2,
      y: (f.y - cam.midPoint.y) * cam.zoom + cam.height / 2,
    };
  }

  /** HP hit zero. Plays the death sequence, then respawns at the checkpoint. */
  killFish(cause = 'default'): void {
    if (this.dying || this.finished || this.transitioning || !this.fish) return;
    this.dying = true;
    session.deaths++;
    session.lastCause = cause;
    save.data.deaths++;
    save.write();
    this.fish.die();
    this.hitstop(140);
    this.slowMotion(0.25, 1400);
    this.camera.zoomPunch(0.3);
    this.camera.baseZoom = 1.25;
    this.shake(0.6);
    this.flash(0xff2a2a, 0.35, 260);
    synth.deathSting();
    const epitaph = pick(EPITAPHS[cause] ?? EPITAPHS.default);
    bus.emit(EV.died, { cause, epitaph });
    this.deathTimer = DEATH_DELAY;
  }

  /** The fish reached the goal. */
  completeStage(): void {
    if (this.finished || this.dying || this.transitioning) return;
    this.finished = true;
    const fish = this.fish;
    if (fish) {
      fish.controllable = false;
      this.fx.sparkle(fish.x, fish.y, 24);
      this.fx.ring(fish.x, fish.y, 2.5, 0xffe08a, 700);
    }

    if (this.stage.isTitle) {
      this.transition(() => this.nextStage());
      return;
    }

    synth.fanfare();
    this.slowMotion(0.4, 900);
    this.camera.zoomPunch(0.15);
    const last = this.stageIndex === STAGES.length - 1;
    const roeCount = this.stage.roeCount ?? 0;
    const roe = Array.from({ length: roeCount }, (_, i) => !!session.roe[i]);
    const { newBest } = save.completeStage(this.stage.id, this.stageIndex, session.time, roe, session.undead);
    if (last) {
      save.data.undeadUnlocked = true;
      save.write();
    }
    const result: StageResult = {
      stage: this.stage,
      index: this.stageIndex,
      time: session.time,
      par: this.stage.par,
      roe,
      roeCount,
      flies: session.flies,
      deaths: session.deaths,
      newBest,
      last,
    };
    bus.emit(EV.complete, result);
  }

  // ---- Loop -------------------------------------------------------------

  update(_time: number, deltaMs: number): void {
    const realDt = Math.min(deltaMs, 100) / 1000;

    if (input.consumePressed('pause') && !this.finished && !this.transitioning) {
      this.ui.openPause();
      return;
    }
    if (input.consumePressed('debug')) GameScene.debugDraw = !GameScene.debugDraw;
    if (import.meta.env.DEV && input.consumePressed('skip') && !this.frozen) this.completeStage();
    this.updateRestartHold(realDt);

    // Time dilation
    if (this.slowmo) {
      this.slowmo.left -= realDt;
      const ease = this.slowmo.total * 0.4;
      const t = this.slowmo.left > ease ? 0 : 1 - Math.max(0, this.slowmo.left) / ease;
      this.timeScale = this.slowmo.scale + (1 - this.slowmo.scale) * t * t;
      if (this.slowmo.left <= 0) {
        this.slowmo = null;
        this.timeScale = 1;
      }
    }
    this.tweens.timeScale = this.timeScale;

    let dt = realDt * this.timeScale;
    if (this.hitstopLeft > 0) {
      this.hitstopLeft -= realDt;
      dt = 0;
    }
    if (this.frozen) dt = 0;

    if (!this.frozen && !this.finished && !this.dying && !this.transitioning && !this.stage.isTitle) session.time += realDt;

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= PHYSICS_DT) {
      if (steps === MAX_STEPS_PER_FRAME) {
        this.accumulator = 0; // too far behind; drop the backlog
        break;
      }
      for (const e of this.entities) e.physicsUpdate?.(PHYSICS_DT);
      this.phys.step(PHYSICS_DT);
      this.entities = this.entities.filter((e) => !e.removed);
      this.accumulator -= PHYSICS_DT;
      steps++;
    }

    this.syncViews(this.accumulator / PHYSICS_DT);
    for (const e of this.entities) e.update?.(dt, realDt);
    this.camera.update(realDt);
    this.drawDebug();

    if (this.dying) {
      this.deathTimer -= realDt;
      if (this.deathTimer <= 0) {
        this.deathTimer = Infinity;
        this.transition(() => this.respawn());
      }
    }
  }

  private updateRestartHold(dt: number): void {
    if (this.stage.isTitle || this.finished || this.dying || this.frozen || this.transitioning) return;
    if (input.isDown('restart')) {
      this.restartHeld += dt;
      bus.emit(EV.restartHold, this.restartHeld / RESTART_HOLD);
      if (this.restartHeld >= RESTART_HOLD) {
        this.restartHeld = 0;
        bus.emit(EV.restartHold, 0);
        synth.back();
        this.transition(() => this.respawn());
      }
    } else if (this.restartHeld > 0) {
      this.restartHeld = 0;
      bus.emit(EV.restartHold, 0);
    }
  }

  /** Move containers to their bodies, interpolating between the last two steps. */
  private syncViews(alpha: number): void {
    this.views = this.views.filter((v) => {
      if (v.body.destroyed) {
        v.obj.destroy();
        return false;
      }
      return true;
    });
    for (const { body, obj } of this.views) {
      obj.setPosition(
        body.prevX + (body.x - body.prevX) * alpha,
        body.prevY + (body.y - body.prevY) * alpha,
      );
      obj.setRotation(body.prevRot + angleDifference(body.prevRot, body.rot) * alpha);
    }
  }

  private drawDebug(): void {
    const g = this.debugGfx;
    g.clear();
    if (!GameScene.debugDraw) {
      this.fpsText?.setVisible(false);
      return;
    }
    if (!this.fpsText) {
      this.fpsText = this.add
        .text(8, 8, '', { fontFamily: 'monospace', fontSize: '14px', color: '#7dff9a', backgroundColor: '#000a' })
        .setScrollFactor(0)
        .setDepth(10_001);
    }
    this.fpsText
      .setVisible(true)
      .setText(`${Math.round(this.game.loop.actualFps)} fps  bodies ${this.phys.bodies.size}  x ${Math.round(this.fish?.x ?? 0)} y ${Math.round(this.fish?.y ?? 0)}`);
    for (const body of this.phys.bodies) {
      const color = body.sensor ? 0xffe14d : body.type === 'dynamic' ? 0x4dff88 : 0xb0b0b0;
      g.lineStyle(1, color, body.body.isAwake() ? 1 : 0.4);
      for (const piece of body.worldPieces()) {
        g.beginPath();
        g.moveTo(piece[0][0], piece[0][1]);
        for (let i = 1; i < piece.length; i++) g.lineTo(piece[i][0], piece[i][1]);
        g.closePath();
        g.strokePath();
      }
    }
  }
}
