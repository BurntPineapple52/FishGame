// Chunks of the fish tearing off as it takes damage.
//
// Every texture a fish part shows (fresh, zombified, damage flash, smashed
// head) is drawn through a canvas copy with that part's bites cut out, so the
// holes survive texture swaps. A bite is a jagged notch on the edge of the
// part's silhouette, rimmed with raw flesh; the pixels that were there are
// thrown off as a small physics body that tumbles, sinks and fades.

import type * as Phaser from 'phaser';
import { LAYER_1 } from '../config';
import type { PhysBody } from '../physics/PhysicsWorld';
import type { GameScene } from '../scenes/GameScene';
import { randRange, toWorld } from '../util/xform';

type Poly = [number, number][];
type Image = Phaser.GameObjects.Image;
type CanvasTexture = Phaser.Textures.CanvasTexture;

const FLESH = '#8c2a33';
/** Past this a part stops losing pieces, so there's still a fish to steer. */
const MAX_BITES = 5;
const MAX_CHUNKS = 14;
/** Chunk textures are drawn centred in a square this big; bites must fit. */
const CHUNK_SIZE = 24;
const BITE_RADIUS: [number, number] = [5, 9];
const CHUNK_LIFE_MS: [number, number] = [5000, 8000];

/** One fish part as the wounds need it. */
export interface WoundedPart {
  scars: Scars;
  phys: PhysBody;
  view: Phaser.GameObjects.Container;
  /** Visible layers, bottom first. */
  layers: Image[];
}

function tracePoly(ctx: CanvasRenderingContext2D, poly: Poly, dx = 0, dy = 0): void {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
  ctx.closePath();
}

/** Remove `poly` from the canvas and paint a meaty rim where it was torn. */
function cut(ctx: CanvasRenderingContext2D, poly: Poly): void {
  ctx.save();
  tracePoly(ctx, poly);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.strokeStyle = FLESH;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

/** A rough circle, like something bit it. */
function jagged(cx: number, cy: number, r: number): Poly {
  const n = 9;
  const spin = Math.random() * Math.PI * 2;
  const poly: Poly = [];
  for (let i = 0; i < n; i++) {
    const a = spin + (i / n) * Math.PI * 2;
    const d = r * randRange(0.6, 1.15);
    poly.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
  }
  return poly;
}

/** The bites taken out of one part, and its bitten texture copies. */
export class Scars {
  private readonly bites: Poly[] = [];
  /** Source keys whose copies are up to date for this fish. */
  private readonly copies = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {}

  get full(): boolean {
    return this.bites.length >= MAX_BITES;
  }

  /** Key of `key`'s bitten copy, to pass to setTexture. */
  tex(key: string): string {
    const copyKey = `${key}~bitten`;
    if (this.copies.has(key)) return copyKey;
    this.copies.add(key);
    const textures = this.scene.textures;
    const src = textures.get(key).getSourceImage() as HTMLImageElement;
    // Copies are reused between lives: one fish exists at a time.
    const copy = (textures.exists(copyKey) ? textures.get(copyKey) : textures.createCanvas(copyKey, src.width, src.height)) as CanvasTexture;
    copy.context.clearRect(0, 0, src.width, src.height);
    copy.context.drawImage(src, 0, 0);
    for (const b of this.bites) cut(copy.context, b);
    copy.refresh();
    return copyKey;
  }

  /**
   * Bite a notch out of the silhouette of `layers` (bottom first, all the same
   * size), draw what was bitten off into `chunk`, and return where it was in
   * texture pixels plus the outward direction.
   */
  tear(layers: Image[], chunk: CanvasTexture): { x: number; y: number; nx: number; ny: number; r: number } | null {
    const base = this.scene.textures.get(layers[0].texture.key) as CanvasTexture;
    const { width: w, height: h } = base;
    const alpha = base.context.getImageData(0, 0, w, h).data;
    const solid = (x: number, y: number): boolean => alpha[(y * w + x) * 4 + 3] > 128;

    // Find the top or bottom edge of a random column that has some fish in it.
    for (let attempt = 0; attempt < 12; attempt++) {
      const x = Math.floor(randRange(6, w - 6));
      const fromTop = Math.random() < 0.5;
      let y = fromTop ? 0 : h - 1;
      while (y >= 0 && y < h && !solid(x, y)) y += fromTop ? 1 : -1;
      if (y < 0 || y >= h) continue;

      const r = randRange(...BITE_RADIUS);
      const ny = fromTop ? -1 : 1;
      const cx = x;
      const cy = y - ny * r * 0.4;
      const poly = jagged(cx, cy, r);

      // The chunk: every visible layer, clipped to the bite.
      const ctx = chunk.context;
      const off = CHUNK_SIZE / 2;
      ctx.clearRect(0, 0, CHUNK_SIZE, CHUNK_SIZE);
      ctx.save();
      tracePoly(ctx, poly, off - cx, off - cy);
      ctx.clip();
      for (const layer of layers) {
        if (layer.alpha <= 0) continue;
        ctx.globalAlpha = layer.alpha;
        ctx.drawImage(this.scene.textures.get(layer.texture.key).getSourceImage() as HTMLCanvasElement, off - cx, off - cy);
      }
      ctx.restore();
      // Torn side faces the fish.
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = FLESH;
      ctx.beginPath();
      ctx.arc(off, off - ny * r * 1.1, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      chunk.refresh();

      this.bites.push(poly);
      for (const key of this.copies) {
        const copy = this.scene.textures.get(`${key}~bitten`) as CanvasTexture;
        cut(copy.context, poly);
        copy.refresh();
      }
      return { x: cx, y: cy, nx: 0, ny, r };
    }
    return null;
  }
}

/** Throws torn-off chunks into the world; owns a small pool of them per fish. */
export class Gore {
  private readonly chunks: (PhysBody | null)[] = new Array(MAX_CHUNKS).fill(null);
  private next = 0;

  constructor(
    private readonly scene: GameScene,
    private readonly depth: number,
  ) {}

  /** Tear a chunk off `part` and fling it. Returns false if there was nothing to tear. */
  tear(part: WoundedPart): boolean {
    if (part.scars.full) return false;
    const slot = this.next;
    this.next = (this.next + 1) % MAX_CHUNKS;
    const old = this.chunks[slot];
    if (old) this.scene.phys.destroyBody(old);

    const key = `gore_chunk_${slot}`;
    const textures = this.scene.textures;
    const tex = (textures.exists(key) ? textures.get(key) : textures.createCanvas(key, CHUNK_SIZE, CHUNK_SIZE)) as CanvasTexture;
    const bite = part.scars.tear(part.layers, tex);
    if (!bite) return false;

    // Texture pixels -> world, through the sprite and the part's container.
    const top = part.layers[0];
    const v = part.view;
    const pos = toWorld({ x: v.x, y: v.y, rot: v.rotation }, top.x - top.width / 2 + bite.x, top.y - top.height / 2 + bite.y);
    const c = Math.cos(v.rotation);
    const s = Math.sin(v.rotation);
    const nx = bite.nx * c - bite.ny * s;
    const ny = bite.nx * s + bite.ny * c;

    const size = bite.r * 1.3;
    const phys = this.scene.phys.createBody(
      {
        x: pos.x,
        y: pos.y,
        rot: v.rotation,
        mass: 0.4,
        bounce: 0.3,
        friction: 0.8,
        layer: LAYER_1,
        mask: LAYER_1,
        // Sinks slowly in water instead of floating like the fish.
        groups: ['physics', 'buoyant', 'litter', 'gore'],
      },
      [{ type: 'rect', w: size, h: size }],
    );
    const kick = randRange(160, 320);
    phys.setVelocity(part.phys.vx + nx * kick + randRange(-60, 60), part.phys.vy + ny * kick - 120);
    phys.body.setAngularVelocity(randRange(-14, 14));
    this.chunks[slot] = phys;

    const img = this.scene.add.image(0, 0, key);
    this.scene.attach(phys, this.depth, [img]);
    this.scene.time.delayedCall(randRange(...CHUNK_LIFE_MS), () => {
      if (this.chunks[slot] !== phys) return;
      this.scene.tweens.add({
        targets: img,
        alpha: 0,
        duration: 600,
        onComplete: () => {
          if (this.chunks[slot] !== phys) return;
          this.scene.phys.destroyBody(phys);
          this.chunks[slot] = null;
        },
      });
    });
    return true;
  }
}
