// Stages in play order (game.gd `stages`). Add new stages here.

import { bearStage } from './bearStage';
import { mainMenu } from './mainMenu';
import type { StageDef } from './types';

export type { StageDef } from './types';

export const STAGES: readonly StageDef[] = [mainMenu, bearStage];
