// Procedurally drawn textures for particles, pickups and UI, generated once at
// boot so the game needs no extra art files.

import type * as Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';

type Ctx = CanvasRenderingContext2D;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.context, w, h);
  tex.refresh();
}

function radial(ctx: Ctx, x: number, y: number, r: number, stops: [number, string][]): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function generateTextures(scene: Phaser.Scene): void {
  make(scene, 'px', 4, 4, (c) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 4, 4);
  });

  make(scene, 'dot', 16, 16, (c) => {
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(8, 8, 7, 0, Math.PI * 2);
    c.fill();
  });

  make(scene, 'glow', 64, 64, (c) =>
    radial(c, 32, 32, 32, [
      [0, 'rgba(255,255,255,1)'],
      [0.35, 'rgba(255,255,255,0.45)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );

  make(scene, 'bubble', 20, 20, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(10, 10, 8, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(7, 7, 2.2, 0, Math.PI * 2);
    c.fill();
  });

  make(scene, 'droplet', 10, 14, (c) => {
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(5, 0);
    c.quadraticCurveTo(10, 8, 9, 10);
    c.arc(5, 9.5, 4, 0, Math.PI);
    c.quadraticCurveTo(0, 8, 5, 0);
    c.fill();
  });

  make(scene, 'shard', 14, 8, (c) => {
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(0, 4);
    c.lineTo(7, 0);
    c.lineTo(14, 4);
    c.lineTo(7, 8);
    c.closePath();
    c.fill();
  });

  make(scene, 'sparkle', 32, 32, (c) => {
    radial(c, 16, 16, 10, [
      [0, 'rgba(255,255,255,0.9)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(16, 0);
    c.quadraticCurveTo(17.5, 14.5, 32, 16);
    c.quadraticCurveTo(17.5, 17.5, 16, 32);
    c.quadraticCurveTo(14.5, 17.5, 0, 16);
    c.quadraticCurveTo(14.5, 14.5, 16, 0);
    c.fill();
  });

  make(scene, 'ring', 128, 128, (c) => {
    c.strokeStyle = '#fff';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(64, 64, 60, 0, Math.PI * 2);
    c.stroke();
  });

  make(scene, 'ray', 96, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(w * 0.35, 0);
    c.lineTo(w * 0.65, 0);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.closePath();
    c.fill();
  });

  make(scene, 'streak', 48, 3, (c, w) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, 3);
  });

  make(scene, 'cloud', 300, 130, (c) => {
    const puffs: [number, number, number][] = [
      [70, 85, 42], [120, 60, 55], [180, 70, 50], [230, 88, 38], [150, 95, 45], [95, 100, 35],
    ];
    c.fillStyle = 'rgba(205,225,240,1)';
    for (const [x, y, r] of puffs) {
      c.beginPath();
      c.arc(x, y + 6, r, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#fff';
    for (const [x, y, r] of puffs) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });

  make(scene, 'vignette', VIEW_WIDTH, VIEW_HEIGHT, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });

  make(scene, 'fly', 36, 24, (c) => {
    // Wings
    c.fillStyle = 'rgba(220,240,255,0.85)';
    c.strokeStyle = 'rgba(120,150,170,0.9)';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(15, 7, 9, 5, -0.5, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.beginPath();
    c.ellipse(21, 7, 8, 4.5, 0.4, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // Body and tail filaments
    c.fillStyle = '#5a3d22';
    c.beginPath();
    c.ellipse(18, 15, 9, 3.2, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#5a3d22';
    c.beginPath();
    c.moveTo(9, 15);
    c.lineTo(1, 11);
    c.moveTo(9, 15.5);
    c.lineTo(1, 17);
    c.stroke();
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(26, 14, 1.6, 0, Math.PI * 2);
    c.fill();
  });

  make(scene, 'egg', 16, 16, (c) => {
    radial(c, 8, 8, 7, [
      [0, '#ffcf6a'],
      [0.6, '#ff8a2a'],
      [1, '#d9541a'],
    ]);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.arc(5.5, 5.5, 2, 0, Math.PI * 2);
    c.fill();
  });

  make(scene, 'roe', 56, 56, (c) => {
    const eggs: [number, number][] = [
      [20, 22], [32, 20], [26, 31], [38, 31], [16, 34], [28, 42], [40, 42], [44, 22],
    ];
    for (const [x, y] of eggs) {
      radial(c, x, y, 8, [
        [0, '#fff3a0'],
        [0.55, '#ffc21a'],
        [1, '#e07a00'],
      ]);
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath();
      c.arc(x - 2.5, y - 2.5, 2, 0, Math.PI * 2);
      c.fill();
    }
  });

  make(scene, 'reticle', 110, 110, (c) => {
    c.strokeStyle = '#ff3b3b';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(55, 55, 42, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 5;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      c.beginPath();
      c.moveTo(55 + Math.cos(a) * 30, 55 + Math.sin(a) * 30);
      c.lineTo(55 + Math.cos(a) * 52, 55 + Math.sin(a) * 52);
      c.stroke();
    }
  });

  make(scene, 'falls', 128, 256, (c, w, h) => {
    c.fillStyle = 'rgba(150,200,235,0.85)';
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const len = 30 + Math.random() * 80;
      c.strokeStyle = `rgba(255,255,255,${0.35 + Math.random() * 0.5})`;
      c.lineWidth = 1 + Math.random() * 3;
      for (const oy of [0, -h, h]) {
        c.beginPath();
        c.moveTo(x, y + oy);
        c.lineTo(x, y + oy + len);
        c.stroke();
      }
    }
  });

  make(scene, 'sun', 256, 256, (c) =>
    radial(c, 128, 128, 128, [
      [0, 'rgba(255,250,220,1)'],
      [0.18, 'rgba(255,240,180,0.95)'],
      [0.3, 'rgba(255,220,140,0.35)'],
      [1, 'rgba(255,200,120,0)'],
    ]),
  );

  make(scene, 'stone', 64, 40, (c) => {
    c.fillStyle = '#6d6a66';
    c.beginPath();
    c.ellipse(32, 22, 30, 17, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#8b8781';
    c.beginPath();
    c.ellipse(28, 18, 22, 11, -0.1, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.beginPath();
    c.ellipse(22, 13, 8, 3.5, -0.2, 0, Math.PI * 2);
    c.fill();
  });

  make(scene, 'arrow', 64, 64, (c) => {
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(8, 22);
    c.lineTo(34, 22);
    c.lineTo(34, 8);
    c.lineTo(60, 32);
    c.lineTo(34, 56);
    c.lineTo(34, 42);
    c.lineTo(8, 42);
    c.closePath();
    c.fill();
  });

  make(scene, 'heart', 32, 32, (c) => {
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(16, 28);
    c.bezierCurveTo(2, 18, 2, 6, 10, 6);
    c.bezierCurveTo(14, 6, 16, 10, 16, 11);
    c.bezierCurveTo(16, 10, 18, 6, 22, 6);
    c.bezierCurveTo(30, 6, 30, 18, 16, 28);
    c.fill();
  });
}
