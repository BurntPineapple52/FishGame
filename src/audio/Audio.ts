// Sound effects, music and ambience on top of Phaser's sound manager.
// Volumes fade in `update`, which UIScene calls every frame (it never pauses),
// so music keeps crossfading while the game scene is paused or restarting.

import * as Phaser from 'phaser';
import { save } from '../save';
import { clamp, randRange } from '../util/xform';

/** Asset key -> file under public/assets/audio/. */
export const AUDIO_FILES: Record<string, string> = {
  water_swish: 'water_swish.mp3',
  splat: 'splat.wav',
  rock_knock: 'rock_knock.wav',
  wood_knock: 'wood_knock.mp3',
  chomp: 'chomp.mp3',
  cawcaw: 'cawcaw.mp3',
  eagle_scream: 'eagle_scream.mp3',
  fish_theme: 'fish_theme.mp3',
  thriller: 'Thriller 16-bit.mp3',
  rushing_water: 'rushing_water.mp3',
  waterfall: 'waterfall.mp3',
};

export interface MusicSpec {
  key: string;
  rate?: number;
  volume?: number;
}

interface Track {
  key: string;
  sound: Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
  /** 0..1 fade level, multiplied by the base volume and the settings. */
  level: number;
  target: number;
  base: number;
  fadePerSec: number;
  kind: 'music' | 'ambience';
}

type Playable = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

class AudioManager {
  private game!: Phaser.Game;
  private tracks: Track[] = [];
  private music: Track | null = null;
  private ambience: Track | null = null;
  private filter: BiquadFilterNode | null = null;
  private lastPlayed = new Map<string, number>();

  init(game: Phaser.Game): void {
    this.game = game;
    const mgr = game.sound;
    if (mgr instanceof Phaser.Sound.WebAudioSoundManager) {
      // Insert a low-pass between the master volume and the speakers so the
      // whole mix can be muffled while paused or in a title card.
      const ctx = mgr.context;
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 22000;
      mgr.masterVolumeNode.disconnect();
      mgr.masterVolumeNode.connect(this.filter);
      this.filter.connect(ctx.destination);
    }
  }

  get context(): AudioContext | null {
    const mgr = this.game?.sound;
    return mgr instanceof Phaser.Sound.WebAudioSoundManager ? mgr.context : null;
  }

  /** Where synthesized sounds connect (goes through the master volume and filter). */
  get destination(): AudioNode | null {
    const mgr = this.game?.sound;
    return mgr instanceof Phaser.Sound.WebAudioSoundManager ? mgr.destination : null;
  }

  /**
   * Play a one-shot sample. `pitchVar` randomizes the playback rate a little so
   * repeated sounds don't machine-gun. `throttleMs` drops plays that come too fast.
   */
  sfx(
    key: string,
    opts: { volume?: number; rate?: number; pitchVar?: number; throttleMs?: number } = {},
  ): void {
    if (!this.game || !this.game.cache.audio.exists(key)) return;
    const now = performance.now();
    if (opts.throttleMs) {
      const last = this.lastPlayed.get(key) ?? -Infinity;
      if (now - last < opts.throttleMs) return;
    }
    this.lastPlayed.set(key, now);
    const vol = clamp((opts.volume ?? 1) * save.data.settings.sfx, 0, 1.5);
    if (vol <= 0.001) return;
    const pv = opts.pitchVar ?? 0.08;
    const rate = (opts.rate ?? 1) * (1 + randRange(-pv, pv));
    this.game.sound.play(key, { volume: vol, rate });
  }

  playMusic(spec: MusicSpec | null, fadeSec = 1.5): void {
    this.music = this.switchTrack(this.music, spec, 'music', fadeSec);
  }

  playAmbience(spec: MusicSpec | null, fadeSec = 1.5): void {
    this.ambience = this.switchTrack(this.ambience, spec, 'ambience', fadeSec);
  }

  /** Scale the ambience loop, e.g. by distance to a waterfall. */
  setAmbienceLevel(level: number): void {
    if (this.ambience) this.ambience.target = clamp(level, 0, 1);
  }

  private switchTrack(
    current: Track | null,
    spec: MusicSpec | null,
    kind: Track['kind'],
    fadeSec: number,
  ): Track | null {
    if (current && spec && current.key === spec.key) {
      current.base = spec.volume ?? current.base;
      current.target = 1;
      current.sound.setRate(spec.rate ?? 1);
      return current;
    }
    if (current) {
      current.target = 0;
      current.fadePerSec = 1 / Math.max(0.05, fadeSec);
    }
    if (!spec || !this.game.cache.audio.exists(spec.key)) return null;
    const sound = this.game.sound.add(spec.key, { loop: true, volume: 0, rate: spec.rate ?? 1 }) as Playable;
    sound.play();
    const track: Track = {
      key: spec.key,
      sound,
      level: 0,
      target: 1,
      base: spec.volume ?? 1,
      fadePerSec: 1 / Math.max(0.05, fadeSec),
      kind,
    };
    this.tracks.push(track);
    return track;
  }

  /** Muffle everything (pause menu, title cards). */
  muffle(on: boolean): void {
    const ctx = this.context;
    if (!this.filter || !ctx) return;
    this.filter.frequency.cancelScheduledValues(ctx.currentTime);
    this.filter.frequency.setTargetAtTime(on ? 700 : 22000, ctx.currentTime, 0.12);
  }

  update(dt: number): void {
    const s = save.data.settings;
    this.tracks = this.tracks.filter((t) => {
      const step = t.fadePerSec * dt;
      t.level = t.level < t.target ? Math.min(t.target, t.level + step) : Math.max(t.target, t.level - step);
      const setting = t.kind === 'music' ? s.music : s.sfx;
      t.sound.setVolume(t.level * t.base * setting);
      const dead = t.level <= 0 && t.target <= 0 && t !== this.music && t !== this.ambience;
      if (dead) {
        t.sound.stop();
        t.sound.destroy();
      }
      return !dead;
    });
  }
}

export const audio = new AudioManager();
