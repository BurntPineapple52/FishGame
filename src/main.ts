import * as Phaser from 'phaser';
import { COLORS, VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { input } from './input';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

input.attach(window);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_WIDTH,
  height: VIEW_HEIGHT,
  backgroundColor: COLORS.black,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, GameScene],
});

// Handy for poking at the game from the browser console during development.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
