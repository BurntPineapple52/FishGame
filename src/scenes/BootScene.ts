// Loads every texture once, then starts the first stage.
// Texture keys are the file names without extension.

import * as Phaser from 'phaser';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import type { GameSceneData } from './GameScene';

const IMAGES = [
  'player/fish_head.png',
  'player/fish_head_zombified1v2.png',
  'player/fish_head_zombified2v5.png',
  'player/fish_head_damage_flash.png',
  'player/fish_center.png',
  'player/fish_center_zombified1v2.png',
  'player/fish_center_zombified2v2.png',
  'player/fish_center_damage_flash.png',
  'player/fish_tail.png',
  'player/fish_tail_zombified1.png',
  'player/fish_tail_zombified2.png',
  'player/fish_tail_damageflash.png',
  'environment/background_sandtoland.png',
  'environment/sand.png',
  'environment/log_4.png',
  'environment/rock_2.png',
  'environment/riverweed_segment_1.png',
  'environment/riverweed_segment_2.png',
  'environment/riverweed_segment_3.png',
  'environment/riverweed_end_1.png',
  'environment/riverweed_end_2.png',
  'enemies/bear_legs.png',
  'enemies/bearclaw_arm.png',
  'enemies/bearclaw_paw.png',
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
    const label = this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 'Loading…', { fontFamily: 'sans-serif', fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => label.setText(`Loading… ${Math.round(p * 100)}%`));

    this.load.setPath('assets/sprites/');
    for (const file of IMAGES) {
      const key = file.slice(file.lastIndexOf('/') + 1, file.lastIndexOf('.'));
      this.load.image(key, file);
    }
  }

  create(): void {
    this.scene.start('game', { stage: 0 } satisfies GameSceneData);
  }
}
