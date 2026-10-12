// Loads every texture and sound once, generates the procedural textures,
// then starts the first stage (or ?stage=N in development).
// Texture keys are the file names without extension.

import * as Phaser from 'phaser';
import { AUDIO_FILES } from '../audio/Audio';
import { FONT, UI, VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { generateTextures } from '../fx/textures';
import { STAGES } from '../stages';
import type { GameSceneData } from './GameScene';

const IMAGES = [
  'player/fish_head.png',
  'player/fish_head_zombified1v2.png',
  'player/fish_head_zombified2v5.png',
  'player/fish_head_damage_flash.png',
  'player/fish_head_smashed.png',
  'player/fish_head_smashed_2.png',
  'player/fish_head_smashed_3.png',
  'player/fish_center.png',
  'player/fish_center_zombified1v2.png',
  'player/fish_center_zombified2v2.png',
  'player/fish_center_damage_flash.png',
  'player/fish_tail.png',
  'player/fish_tail_zombified1.png',
  'player/fish_tail_zombified2.png',
  'player/fish_tail_damageflash.png',
  'player/temp_fish.png',
  'environment/background_sandtoland.png',
  'environment/sand.png',
  'environment/log_4.png',
  'environment/rock_1.png',
  'environment/rock_2.png',
  'environment/rock_3.png',
  'environment/leaf1.png',
  'environment/leaf2.png',
  'environment/riverweed_segment_1.png',
  'environment/riverweed_segment_2.png',
  'environment/riverweed_segment_3.png',
  'environment/riverweed_end_1.png',
  'environment/riverweed_end_2.png',
  'enemies/bear_legs.png',
  'enemies/bearclaw_arm.png',
  'enemies/bearclaw_paw.png',
  'enemies/eagle.png',
  'ui/keycap_f.png',
  'ui/keycap_l.png',
  'ui/keycap_o.png',
  'ui/keycap_p.png',
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    const cx = VIEW_WIDTH / 2;
    const cy = VIEW_HEIGHT / 2;
    const label = this.add
      .text(cx, cy - 40, 'FLOP', { fontFamily: FONT, fontSize: '64px', fontStyle: 'bold', color: UI.cream })
      .setOrigin(0.5);
    const barBg = this.add.rectangle(cx, cy + 30, 360, 14, 0x1b2a3a).setStrokeStyle(2, 0xfff6e0);
    const bar = this.add.rectangle(cx - 178, cy + 30, 0, 10, 0xff7a5c).setOrigin(0, 0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      bar.width = 356 * p;
      label.setScale(1 + Math.sin(p * 20) * 0.03);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => barBg.destroy());

    this.load.setPath('assets/sprites/');
    for (const file of IMAGES) {
      const key = file.slice(file.lastIndexOf('/') + 1, file.lastIndexOf('.'));
      this.load.image(key, file);
    }
    this.load.setPath('assets/audio/');
    for (const [key, file] of Object.entries(AUDIO_FILES)) this.load.audio(key, encodeURI(file));
  }

  create(): void {
    generateTextures(this);
    let stage = 0;
    if (import.meta.env.DEV) {
      const param = new URLSearchParams(location.search).get('stage');
      if (param !== null) stage = Math.max(0, Math.min(STAGES.length - 1, Number(param) || 0));
    }
    this.warmShaders();
    // Start once the warm-up frame has been drawn.
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () => this.scene.start('game', { stage } satisfies GameSceneData));
  }

  /**
   * WebGL batches compile a shader variant per number of distinct textures in
   * the batch, the first time that count comes up. Each compile freezes the
   * game for up to a few hundred ms (worst on integrated GPUs), so draw one
   * nearly invisible frame here that uses every count, rather than hitching
   * mid-stage when a hit or the eagle first brings in more textures.
   */
  private warmShaders(): void {
    const renderer = this.game.renderer;
    if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return;
    const keys = this.textures.getTextureKeys();
    const objects: Phaser.GameObjects.GameObject[] = [];
    // A Graphics between groups ends the batch, so each group is its own batch.
    const breakBatch = () => objects.push(this.add.graphics().fillStyle(0, 0.01).fillRect(0, 0, 1, 1));
    for (let count = 1; count <= Math.min(renderer.maxTextures, keys.length); count++) {
      for (let i = 0; i < count; i++) objects.push(this.add.image(0, 0, keys[i]).setAlpha(0.001));
      breakBatch();
    }
    for (let count = 1; count <= 3; count++) {
      for (let i = 0; i < count; i++) objects.push(this.add.tileSprite(0, 0, 4, 4, keys[i]).setAlpha(0.001));
      breakBatch();
    }
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () => objects.forEach((o) => o.destroy()));
  }
}
