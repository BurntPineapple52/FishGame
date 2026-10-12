// Runs one stage: owns the physics world, the entity list and the fixed-step loop.
// Restarting or advancing a stage restarts this scene with a different stage index
// (the equivalent of game.gd's restart_stage / next_stage).

import * as Phaser from 'phaser';
import { COLORS, MAX_STEPS_PER_FRAME, PHYSICS_DT } from '../config';
import type { Entity } from '../entities/Entity';
import { input } from '../input';
import { PhysicsWorld, type PhysBody } from '../physics/PhysicsWorld';
import { STAGES, type StageDef } from '../stages';
import { angleDifference } from '../util/xform';

interface BodyView {
  body: PhysBody;
  obj: Phaser.GameObjects.Container;
}

export interface GameSceneData {
  stage?: number;
  fadeIn?: boolean;
}

export class GameScene extends Phaser.Scene {
  /** Toggled with the backquote key; persists across restarts. */
  static debugDraw = false;

  phys!: PhysicsWorld;
  stage!: StageDef;
  private stageIndex = 0;
  private entities: Entity[] = [];
  private views: BodyView[] = [];
  private accumulator = 0;
  private debugGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('game');
  }

  create(data: GameSceneData): void {
    this.stageIndex = data.stage ?? 0;
    this.stage = STAGES[this.stageIndex];
    this.phys = new PhysicsWorld();
    this.entities = [];
    this.views = [];
    this.accumulator = 0;
    input.clearPressed();

    const cam = this.cameras.main;
    cam.stopFollow();
    cam.removeBounds();
    cam.resetFX();
    cam.setBackgroundColor(COLORS.sky);

    this.stage.build(this);

    if (data.fadeIn) cam.fadeIn(1000, 0, 0, 0);
    this.debugGfx = this.add.graphics().setDepth(10_000);
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

  restartStage(): void {
    this.scene.restart({ stage: this.stageIndex } satisfies GameSceneData);
  }

  nextStage(): void {
    const next = this.stageIndex + 1;
    if (next >= STAGES.length) return;
    this.scene.restart({ stage: next, fadeIn: true } satisfies GameSceneData);
  }

  update(_time: number, deltaMs: number): void {
    if (input.consumePressed('restart')) {
      this.restartStage();
      return;
    }
    if (input.consumePressed('debug')) GameScene.debugDraw = !GameScene.debugDraw;

    const dt = Math.min(deltaMs, 250) / 1000;
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
    for (const e of this.entities) e.update?.(dt);
    this.drawDebug();
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
    if (!GameScene.debugDraw) return;
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
