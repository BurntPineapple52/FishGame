// Phaser re-tessellates every Graphics command on every frame, even when
// nothing changed. Scenery drawn once (riverbeds, treelines) is baked into
// canvas textures here and shown as plain images instead.

import * as Phaser from 'phaser';
import type { Bounds } from './FishCamera';

/** Largest texture side; well within every GPU's limit. */
const TILE = 2048;
let nextKey = 0;

/** Graphics' canvas renderer, which Phaser's typings leave out. */
interface CanvasDrawable {
  renderCanvas(
    renderer: Phaser.Renderer.Canvas.CanvasRenderer | Phaser.Renderer.WebGL.WebGLRenderer,
    src: Phaser.GameObjects.Graphics,
    camera: Phaser.Cameras.Scene2D.Camera,
    parentMatrix: null,
    ctx: CanvasRenderingContext2D,
    allowClip: boolean,
  ): void;
}

/**
 * Replace `g` (positioned at the origin) with images of what it draws inside
 * `area`, in world px. The textures are freed when the scene shuts down.
 */
export function bake(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, area: Bounds): void {
  const left = Math.floor(area.left);
  const top = Math.floor(area.top);
  const right = Math.ceil(area.right);
  const bottom = Math.ceil(area.bottom);
  if (right <= left || bottom <= top) return;

  const renderer = scene.sys.game.renderer;
  // Phaser's generateTexture camera. Its scroll is ignored (it never runs
  // preRender), so each tile is offset by moving the Graphics instead.
  const cam = Phaser.GameObjects.Graphics.TargetCamera;
  cam.setScene(scene);
  cam.scrollX = 0;
  cam.scrollY = 0;
  const list = scene.children;
  let index = list.getIndex(g);
  for (let y = top; y < bottom; y += TILE) {
    for (let x = left; x < right; x += TILE) {
      const w = Math.min(TILE, right - x);
      const h = Math.min(TILE, bottom - y);
      const key = `baked_${nextKey++}`;
      const tex = scene.textures.createCanvas(key, w, h);
      if (!tex) continue;
      cam.setViewport(0, 0, w, h);
      g.setPosition(-x, -y);
      // Same canvas path as Graphics.generateTexture, but for one tile.
      (g as unknown as CanvasDrawable).renderCanvas(renderer, g, cam, null, tex.context, false);
      tex.refresh();
      const img = scene.add.image(x, y, key).setOrigin(0).setDepth(g.depth).setAlpha(g.alpha);
      // Keep g's place in the draw order among objects at the same depth.
      list.moveTo(img, ++index);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.textures.remove(key));
    }
  }
  g.destroy();
}
