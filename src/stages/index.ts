// Stages in play order (game.gd `stages`). Add new stages here.
// Index 0 is the title screen; finishing the last stage plays the ending.

import { bearStage } from './bearStage';
import { dryCreek } from './dryCreek';
import { falls } from './falls';
import { logJam } from './logJam';
import { mainMenu } from './mainMenu';
import { shallows } from './shallows';
import { spawningGrounds } from './spawningGrounds';
import { talonRidge } from './talonRidge';
import type { StageDef } from './types';

export type { StageDef } from './types';

export const STAGES: readonly StageDef[] = [
  mainMenu,
  shallows,
  logJam,
  bearStage,
  talonRidge,
  falls,
  dryCreek,
  spawningGrounds,
];
