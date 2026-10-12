// Camera that follows a target with smoothing and velocity look-ahead, eases
// its zoom, and layers trauma-based screen shake and zoom punches on top.
// Replaces Phaser's startFollow so effects can't fight the follow logic.

import type * as Phaser from 'phaser';
import { save } from '../save';
import { clamp } from '../util/xform';

export interface CameraTarget {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

export interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const LOOKAHEAD_TIME = 0.35;
const LOOKAHEAD_MAX = 220;
const FOLLOW_RATE = 5;
const ZOOM_RATE = 2;
const MAX_SHAKE = 22;
const MAX_SHAKE_ROT = 0.035;

export class FishCamera {
  /** What to follow; null keeps the camera where it is. */
  target: (() => CameraTarget) | null = null;
  /** Temporarily frame a fixed point instead (cinematic reveals). */
  override: { x: number; y: number; zoom?: number } | null = null;
  baseZoom = 1;
  /** Zoom out a little at speed. */
  speedZoom = true;
  /** Vertical offset of the framing (positive looks lower). */
  offsetY = 0;
  bounds: Bounds | null = null;

  private x = 0;
  private y = 0;
  private lookX = 0;
  private lookY = 0;
  private zoom = 1;
  private trauma = 0;
  private punch = 0;
  private time = 0;

  constructor(private cam: Phaser.Cameras.Scene2D.Camera) {
    this.x = cam.midPoint.x;
    this.y = cam.midPoint.y;
    this.zoom = cam.zoom;
  }

  /** Jump straight to the target (no easing), e.g. after a respawn. */
  snap(): void {
    const t = this.override ?? this.target?.();
    if (!t) return;
    this.x = t.x;
    this.y = t.y + this.offsetY;
    this.lookX = 0;
    this.lookY = 0;
    this.zoom = this.override?.zoom ?? this.baseZoom;
    this.apply(0);
  }

  centerOn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.apply(0);
  }

  /** Add screen shake. 0.2 = a bump, 0.5 = a hit, 1 = a catastrophe. */
  shake(amount: number): void {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  /** Brief zoom-in pulse. */
  zoomPunch(amount: number): void {
    this.punch += amount;
  }

  update(dt: number): void {
    this.time += dt;
    const k = 1 - Math.exp(-FOLLOW_RATE * dt);
    let targetZoom = this.baseZoom;

    if (this.override) {
      this.x += (this.override.x - this.x) * k * 0.6;
      this.y += (this.override.y - this.y) * k * 0.6;
      if (this.override.zoom) targetZoom = this.override.zoom;
    } else if (this.target) {
      const t = this.target();
      const vx = t.vx ?? 0;
      const vy = t.vy ?? 0;
      const lx = clamp(vx * LOOKAHEAD_TIME, -LOOKAHEAD_MAX, LOOKAHEAD_MAX);
      const ly = clamp(vy * LOOKAHEAD_TIME * 0.5, -LOOKAHEAD_MAX / 2, LOOKAHEAD_MAX / 2);
      const kl = 1 - Math.exp(-1.6 * dt);
      this.lookX += (lx - this.lookX) * kl;
      this.lookY += (ly - this.lookY) * kl;
      this.x += (t.x + this.lookX - this.x) * k;
      this.y += (t.y + this.offsetY + this.lookY - this.y) * k;
      if (this.speedZoom) {
        const speed = Math.hypot(vx, vy);
        targetZoom = this.baseZoom * (1 - clamp((speed - 300) / 900, 0, 1) * 0.1);
      }
    }

    this.zoom += (targetZoom - this.zoom) * (1 - Math.exp(-ZOOM_RATE * dt));
    this.punch *= Math.exp(-8 * dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    this.apply(dt);
  }

  private apply(_dt: number): void {
    const cam = this.cam;
    const zoom = this.zoom * (1 + this.punch);
    cam.setZoom(zoom);

    const strength = save.data.settings.shake;
    const s = this.trauma * this.trauma * strength;
    const t = this.time * 40;
    const sx = s * MAX_SHAKE * noise1(t);
    const sy = s * MAX_SHAKE * noise1(t + 71.3);
    cam.setRotation(s * MAX_SHAKE_ROT * noise1(t + 13.7));

    let cx = this.x;
    let cy = this.y;
    if (this.bounds) {
      const halfW = cam.width / zoom / 2;
      const halfH = cam.height / zoom / 2;
      const b = this.bounds;
      cx = b.right - b.left < halfW * 2 ? (b.left + b.right) / 2 : clamp(cx, b.left + halfW, b.right - halfW);
      cy = b.bottom - b.top < halfH * 2 ? (b.top + b.bottom) / 2 : clamp(cy, b.top + halfH, b.bottom - halfH);
    }
    // Shake is applied after clamping so it still reads at the level edges.
    cam.centerOn(cx + sx, cy + sy);
  }
}

/** Cheap smooth noise in [-1, 1]. */
function noise1(t: number): number {
  return (Math.sin(t) * 0.6 + Math.sin(t * 2.31 + 1.7) * 0.3 + Math.sin(t * 4.83 + 0.4) * 0.1);
}
