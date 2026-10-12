import * as Phaser from 'phaser';
import { audio } from './audio/Audio';
import { COLORS, VIEW_HEIGHT, VIEW_WIDTH } from './config';
import { input } from './input';
import { save } from './save';
import { bus, session } from './session';
import { BootScene } from './scenes/BootScene';
import { EndingScene } from './scenes/EndingScene';
import { GameScene } from './scenes/GameScene';
import { MapScene } from './scenes/MapScene';
import { UIScene } from './scenes/UIScene';

input.attach(window);

/** Wait (briefly) for the web font so the first text isn't drawn in a fallback. */
async function loadFont(): Promise<void> {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('bold 32px "Fredoka"'), document.fonts.load('32px "Fredoka"')]),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    // Offline or blocked: the fallback fonts are fine.
  }
}

void loadFont().then(() => {
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
    scene: [BootScene, GameScene, MapScene, EndingScene, UIScene],
  });
  audio.init(game);

  // Handy for poking at the game from the browser console during development.
  // flop.session.checkpoint = { x, y, order: 99 } then the game scene's respawn() teleports the fish.
  if (import.meta.env.DEV) {
    Object.assign(window, { game, flop: { session, save, bus } });
  }
});
