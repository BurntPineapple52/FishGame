import type { GameScene } from '../scenes/GameScene';

export interface StageDef {
  name: string;
  /** Things that drift outside this x range get deleted (stage.gd stage_xbounds). */
  xBounds: readonly [number, number];
  /** Create everything in the stage. Called on every (re)start. */
  build(scene: GameScene): void;
}
