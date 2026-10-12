import type { MusicSpec } from '../audio/Audio';
import type { GameScene } from '../scenes/GameScene';

export interface StageDef {
  /** Stable key for save data. */
  id: string;
  name: string;
  /** Small line under the name on the title card ("Chapter 2"). */
  chapter?: string;
  /** Narration lines typed out on the title card. */
  story?: string[];
  music?: MusicSpec | null;
  ambience?: MusicSpec | null;
  /** Things that drift outside this x range get deleted (stage.gd stage_xbounds). */
  xBounds: readonly [number, number];
  /** Target time in seconds for the results star. */
  par?: number;
  /** Golden roe hidden in the stage. */
  roeCount?: number;
  /** HP lost per second once the fish has been out of water for `dryGrace` seconds. */
  drying?: number;
  dryGrace?: number;
  /** HP regained per second while in water (Dry Creek's puddles). */
  waterHeal?: number;
  /** The title screen: no HUD, timer or results. */
  isTitle?: boolean;
  /** Colour behind everything (the sky). */
  sky?: number;
  /** Create everything in the stage. Called on every (re)start. */
  build(scene: GameScene): void;
}
