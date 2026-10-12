// State of the current attempt at a stage. It survives deaths and checkpoint
// respawns (which rebuild the whole stage) and resets when a stage starts fresh.

import * as Phaser from 'phaser';

export interface Checkpoint {
  x: number;
  y: number;
  /** Checkpoint order within the stage; later ones replace earlier ones. */
  order: number;
}

export const session = {
  /** Undead Run: zombified fish, Thriller, faster predators. */
  undead: false,
  stageIndex: 0,
  checkpoint: null as Checkpoint | null,
  /** Seconds spent on this stage, across deaths. */
  time: 0,
  roe: [] as boolean[],
  flies: 0,
  deaths: 0,
  /** HP carried into a checkpoint respawn is reset; this is only for results. */
  lastCause: '',

  resetStage(index: number): void {
    this.stageIndex = index;
    this.checkpoint = null;
    this.time = 0;
    this.roe = [];
    this.flies = 0;
    this.deaths = 0;
  },
};

/**
 * Global event bus between the game, the UI and the audio. Listeners live as
 * long as the page, so scenes that restart can't leave stale handlers behind
 * as long as they remove theirs on shutdown.
 */
export const bus = new Phaser.Events.EventEmitter();

export const EV = {
  stageStart: 'stage-start',
  damaged: 'fish-damaged',
  healed: 'fish-healed',
  died: 'fish-died',
  fly: 'fly-eaten',
  roe: 'roe-collected',
  checkpoint: 'checkpoint',
  complete: 'stage-complete',
  toast: 'toast',
  flash: 'flash',
  drying: 'drying',
  restartHold: 'restart-hold',
  wriggle: 'wriggle',
  boss: 'boss',
} as const;
