// Thin wrapper around Planck.js (a Box2D port) that behaves like Godot 2D physics
// where it matters for this game:
//  - the API takes Godot pixel units; conversion to meters happens only here
//  - linear/angular damping uses Godot's formula, not Box2D's
//  - bodies have groups, a constant force, and enter/exit callbacks per body
//    pair (like RigidBody2D.body_entered / Area2D.body_entered)
//  - sensor bodies act as Area2D

import * as planck from 'planck';
import {
  DEFAULT_ANGULAR_DAMP,
  DEFAULT_LINEAR_DAMP,
  GRAVITY,
  LAYER_1,
  PPM,
} from '../config';
import { signedArea, shapePieces, type Pt, type ShapeDef } from './shapes';

export type BodyType = 'static' | 'dynamic' | 'kinematic';

export interface BodyOptions {
  type?: BodyType;
  x: number;
  y: number;
  rot?: number;
  /** kg. Spread over the shapes by area, like Godot. Default 1. */
  mass?: number;
  gravityScale?: number;
  linearDamp?: number;
  angularDamp?: number;
  /** Godot PhysicsMaterial defaults: friction 1, bounce 0. */
  friction?: number;
  bounce?: number;
  /** Godot collision_layer / collision_mask bits. Default layer 1 / mask 1. */
  layer?: number;
  mask?: number;
  /** Detects overlaps without colliding (Area2D). */
  sensor?: boolean;
  groups?: readonly string[];
  /** Back-reference to the game entity that owns this body. */
  owner?: unknown;
}

export interface JointOptions {
  /** Angle limits in radians, relative to the angle at creation. */
  limit?: [lower: number, upper: number];
  motorSpeed?: number;
  /** Godot-style units (kg·px²/s²). */
  maxMotorTorque?: number;
  enableMotor?: boolean;
  collideConnected?: boolean;
}

/** Per-fixture data kept for debug drawing and AABB queries. */
interface FixtureData {
  points: Pt[]; // body-local px
}

let nextBodyId = 1;

export class PhysBody {
  readonly id = nextBodyId++;
  readonly groups: Set<string>;
  readonly type: BodyType;
  readonly layer: number;
  readonly sensor: boolean;
  linearDamp: number;
  angularDamp: number;
  /** Like Godot's add_constant_central_force: applied every step until changed. */
  readonly constantForce = { x: 0, y: 0 };
  /** Set by Water while the body overlaps it. */
  inWater = false;
  owner: unknown;
  destroyed = false;
  /** First contact with another body (Godot's body_entered). */
  onEnter?: (other: PhysBody) => void;
  /** Last contact with another body ended (Godot's body_exited). */
  onExit?: (other: PhysBody) => void;
  /** Transform at the start of the latest step, for render interpolation. */
  prevX: number;
  prevY: number;
  prevRot: number;

  constructor(
    readonly body: planck.Body,
    opts: BodyOptions,
  ) {
    this.groups = new Set(opts.groups ?? []);
    this.type = opts.type ?? 'dynamic';
    this.layer = opts.layer ?? LAYER_1;
    this.sensor = opts.sensor ?? false;
    this.linearDamp = opts.linearDamp ?? 0;
    this.angularDamp = opts.angularDamp ?? 0;
    this.owner = opts.owner;
    this.prevX = opts.x;
    this.prevY = opts.y;
    this.prevRot = opts.rot ?? 0;
  }

  is(group: string): boolean {
    return this.groups.has(group);
  }

  get x(): number {
    return this.body.getPosition().x * PPM;
  }
  get y(): number {
    return this.body.getPosition().y * PPM;
  }
  get rot(): number {
    return this.body.getAngle();
  }
  get vx(): number {
    return this.body.getLinearVelocity().x * PPM;
  }
  get vy(): number {
    return this.body.getLinearVelocity().y * PPM;
  }
  get angularVelocity(): number {
    return this.body.getAngularVelocity();
  }
  get mass(): number {
    return this.body.getMass();
  }

  setVelocity(vx: number, vy: number): void {
    this.body.setLinearVelocity(planck.Vec2(vx / PPM, vy / PPM));
  }

  /** Multiply velocities, e.g. for custom drag. */
  scaleVelocity(linear: number, angular = linear): void {
    const v = this.body.getLinearVelocity();
    this.body.setLinearVelocity(planck.Vec2(v.x * linear, v.y * linear));
    this.body.setAngularVelocity(this.body.getAngularVelocity() * angular);
  }

  /** One-step force at the centre of mass (Godot apply_central_force). */
  applyForce(fx: number, fy: number): void {
    if (fx === 0 && fy === 0) return;
    this.body.applyForceToCenter(planck.Vec2(fx / PPM, fy / PPM), true);
  }

  /** Godot apply_central_impulse. */
  applyImpulse(ix: number, iy: number): void {
    this.body.applyLinearImpulse(planck.Vec2(ix / PPM, iy / PPM), this.body.getWorldCenter(), true);
  }

  /** One-step torque (Godot apply_torque). */
  applyTorque(torque: number): void {
    if (torque === 0) return;
    this.body.applyTorque(torque / (PPM * PPM), true);
  }

  /** Godot apply_torque_impulse. */
  applyTorqueImpulse(impulse: number): void {
    this.body.applyAngularImpulse(impulse / (PPM * PPM), true);
  }

  /** Tight world-space bounding box in px. */
  aabb(): { minX: number; minY: number; maxX: number; maxY: number } {
    const p = this.body.getPosition();
    const c = Math.cos(this.rot);
    const s = Math.sin(this.rot);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let f = this.body.getFixtureList(); f; f = f.getNext()) {
      for (const [lx, ly] of (f.getUserData() as FixtureData).points) {
        const x = p.x * PPM + lx * c - ly * s;
        const y = p.y * PPM + lx * s + ly * c;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return { minX, minY, maxX, maxY };
  }

  /** Convex pieces in world px (for debug drawing). */
  worldPieces(): Pt[][] {
    const out: Pt[][] = [];
    const c = Math.cos(this.rot);
    const s = Math.sin(this.rot);
    const px = this.x;
    const py = this.y;
    for (let f = this.body.getFixtureList(); f; f = f.getNext()) {
      const pts = (f.getUserData() as FixtureData).points;
      out.push(pts.map(([x, y]) => [px + x * c - y * s, py + x * s + y * c] as const));
    }
    return out;
  }
}

/** A revolute joint (Godot PinJoint2D) whose motor takes Godot-style units. */
export class PinJoint {
  constructor(readonly joint: planck.RevoluteJoint) {}

  /** Angle of body B relative to body A, radians, since creation (not wrapped). */
  get angle(): number {
    return this.joint.getJointAngle();
  }

  /** Drive the joint at `speed` rad/s using up to `maxTorque` (kg·px²/s²). */
  setMotor(enabled: boolean, speed = 0, maxTorque = 0): void {
    this.joint.enableMotor(enabled);
    this.joint.setMotorSpeed(speed);
    this.joint.setMaxMotorTorque(maxTorque / (PPM * PPM));
  }
}

type ContactEvent = { kind: 'enter' | 'exit'; a: PhysBody; b: PhysBody };

export class PhysicsWorld {
  readonly world: planck.World;
  readonly bodies = new Set<PhysBody>();
  /** Touching fixture count per body pair, so enter/exit fire once per body pair. */
  private pairCounts = new Map<string, number>();
  private events: ContactEvent[] = [];

  constructor() {
    this.world = new planck.World({ gravity: planck.Vec2(0, GRAVITY / PPM) });
    this.world.on('begin-contact', (c) => this.countContact(c, 1));
    this.world.on('end-contact', (c) => this.countContact(c, -1));
  }

  private countContact(contact: planck.Contact, delta: 1 | -1): void {
    const a = contact.getFixtureA().getBody().getUserData() as PhysBody | null;
    const b = contact.getFixtureB().getBody().getUserData() as PhysBody | null;
    if (!a || !b || a === b) return;
    const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
    const before = this.pairCounts.get(key) ?? 0;
    const after = before + delta;
    if (after > 0) this.pairCounts.set(key, after);
    else this.pairCounts.delete(key);
    if (before === 0 && after === 1) this.events.push({ kind: 'enter', a, b });
    if (before === 1 && after === 0) this.events.push({ kind: 'exit', a, b });
  }

  createBody(opts: BodyOptions, shapes: readonly ShapeDef[]): PhysBody {
    const type = opts.type ?? 'dynamic';
    const body = this.world.createBody({
      type,
      position: planck.Vec2(opts.x / PPM, opts.y / PPM),
      angle: opts.rot ?? 0,
      gravityScale: opts.gravityScale ?? 1,
      // Damping is applied by step() using Godot's formula.
      linearDamping: 0,
      angularDamping: 0,
    });

    const pieces = shapes.flatMap(shapePieces);
    const areaPx = pieces.reduce((sum, p) => sum + signedArea(p), 0);
    const density =
      type === 'dynamic' && areaPx > 0 ? (opts.mass ?? 1) / (areaPx / (PPM * PPM)) : 0;

    for (const points of pieces) {
      const data: FixtureData = { points };
      body.createFixture({
        shape: new planck.Polygon(points.map(([x, y]) => planck.Vec2(x / PPM, y / PPM))),
        density,
        friction: opts.friction ?? 1,
        restitution: opts.bounce ?? 0,
        filterCategoryBits: opts.layer ?? LAYER_1,
        filterMaskBits: opts.mask ?? LAYER_1,
        isSensor: opts.sensor ?? false,
        userData: data,
      });
    }

    const pb = new PhysBody(body, opts);
    body.setUserData(pb);
    this.bodies.add(pb);
    return pb;
  }

  /** Godot PinJoint2D: `a` and `b` rotate around the world point (x, y). */
  createPin(a: PhysBody, b: PhysBody, x: number, y: number, opts: JointOptions = {}): PinJoint {
    const joint = new planck.RevoluteJoint(
      {
        enableLimit: !!opts.limit,
        lowerAngle: opts.limit?.[0] ?? 0,
        upperAngle: opts.limit?.[1] ?? 0,
        enableMotor: opts.enableMotor ?? false,
        motorSpeed: opts.motorSpeed ?? 0,
        maxMotorTorque: (opts.maxMotorTorque ?? 0) / (PPM * PPM),
        collideConnected: opts.collideConnected ?? false,
      },
      a.body,
      b.body,
      planck.Vec2(x / PPM, y / PPM),
    );
    this.world.createJoint(joint);
    return new PinJoint(joint);
  }

  destroyBody(pb: PhysBody): void {
    if (pb.destroyed) return;
    pb.destroyed = true;
    this.bodies.delete(pb);
    this.world.destroyBody(pb.body);
  }

  step(dt: number): void {
    for (const pb of this.bodies) {
      pb.prevX = pb.x;
      pb.prevY = pb.y;
      pb.prevRot = pb.rot;
      if (pb.type !== 'dynamic') continue;

      // Godot damps velocity before integrating forces: v *= 1 - dt * damp.
      if (pb.body.isAwake()) {
        const lin = Math.max(0, 1 - dt * (DEFAULT_LINEAR_DAMP + pb.linearDamp));
        const ang = Math.max(0, 1 - dt * (DEFAULT_ANGULAR_DAMP + pb.angularDamp));
        pb.scaleVelocity(lin, ang);
      }
      pb.applyForce(pb.constantForce.x, pb.constantForce.y);
    }

    this.world.step(dt, 10, 8);

    // Dispatch after the step, when it is safe to change the world.
    const events = this.events;
    this.events = [];
    for (const { kind, a, b } of events) {
      if (kind === 'enter') {
        a.onEnter?.(b);
        b.onEnter?.(a);
      } else {
        a.onExit?.(b);
        b.onExit?.(a);
      }
    }
  }
}
