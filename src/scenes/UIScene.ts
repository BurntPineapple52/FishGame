// Everything drawn in screen space on top of the game: the HUD, title cards,
// iris wipes, flashes and vignette, toasts, the pause/settings/title menus and
// the results card. Runs in parallel with GameScene and never pauses, so it
// also drives audio fades.

import * as Phaser from 'phaser';
import { audio } from '../audio/Audio';
import { synth } from '../audio/synth';
import { FONT, UI, VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { input } from '../input';
import { save } from '../save';
import { bus, EV, session } from '../session';
import { STAGES } from '../stages';
import { Menu, type MenuItem } from '../ui/Menu';
import { clamp } from '../util/xform';
import type { GameScene, StageResult, StageStartInfo } from './GameScene';

type Mode = 'play' | 'card' | 'pause' | 'settings' | 'results' | 'titleMenu' | 'credits';

const W = VIEW_WIDTH;
const H = VIEW_HEIGHT;
const IRIS_MAX = Math.hypot(W, H);
const BAR_W = 260;
const BAR_H = 20;

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
}

function textStyle(size: number, color: string = UI.cream, extra: Phaser.Types.GameObjects.Text.TextStyle = {}): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color,
    stroke: UI.ink,
    strokeThickness: Math.max(3, Math.round(size / 5)),
    align: 'center',
    ...extra,
  };
}

export class UIScene extends Phaser.Scene {
  private mode: Mode = 'play';
  private menu: Menu | null = null;

  // Overlays
  private vignette!: Phaser.GameObjects.Image;
  private redPulse!: Phaser.GameObjects.Image;
  private flashRect!: Phaser.GameObjects.Rectangle;
  private iris!: Phaser.GameObjects.Graphics;
  private irisR = IRIS_MAX;
  private irisX = W / 2;
  private irisY = H / 2;
  private irisTween: Phaser.Tweens.Tween | null = null;

  // HUD
  private hud!: Phaser.GameObjects.Container;
  private bar!: Phaser.GameObjects.Graphics;
  private hp = 1;
  private hpShown = 1;
  private hpGhost = 1;
  private barFlash = 0;
  private flyText!: Phaser.GameObjects.Text;
  private flyIcon!: Phaser.GameObjects.Image;
  private roeIcons: Phaser.GameObjects.Image[] = [];
  private timerText!: Phaser.GameObjects.Text;
  private stageLabel!: Phaser.GameObjects.Text;
  private dryText!: Phaser.GameObjects.Text;
  private drying = 0;
  private heartTimer = 0;

  private holdGfx!: Phaser.GameObjects.Graphics;
  private holdText!: Phaser.GameObjects.Text;
  private holdProgress = 0;
  private wriggleGfx!: Phaser.GameObjects.Graphics;
  private wriggleText!: Phaser.GameObjects.Text;
  private wriggle = -1;

  private toastText!: Phaser.GameObjects.Text;
  private bannerText!: Phaser.GameObjects.Text;
  private epitaph!: Phaser.GameObjects.Text;

  // Title screen
  private titleLayer!: Phaser.GameObjects.Container;

  // Transient panels
  private panel: Phaser.GameObjects.Container | null = null;
  private card: {
    root: Phaser.GameObjects.Container;
    story: Phaser.GameObjects.Text;
    prompt: Phaser.GameObjects.Text;
    full: string;
    typed: number;
    wait: number;
    done: boolean;
  } | null = null;
  private results: { prompt: Phaser.GameObjects.Text; ready: boolean; result: StageResult } | null = null;

  private listeners: [string, (...args: never[]) => void][] = [];

  constructor() {
    super('ui');
  }

  get game_(): GameScene {
    return this.scene.get('game') as GameScene;
  }

  private get gameRunning(): boolean {
    return this.scene.isActive('game') || this.scene.isPaused('game');
  }

  create(): void {
    this.vignette = this.add.image(W / 2, H / 2, 'vignette').setAlpha(0.28).setDepth(0);
    this.redPulse = this.add.image(W / 2, H / 2, 'vignette').setTint(0xff0000).setAlpha(0).setDepth(1);
    this.flashRect = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 1).setAlpha(0).setDepth(5);

    this.buildHud();
    this.buildTitleLayer();

    this.holdGfx = this.add.graphics().setDepth(20);
    this.holdText = this.add.text(W / 2, H - 70, 'Hold R to restart from checkpoint', textStyle(18)).setOrigin(0.5).setAlpha(0).setDepth(20);
    this.wriggleGfx = this.add.graphics().setDepth(20);
    this.wriggleText = this.add.text(W / 2, H / 2 + 110, 'MASH  F L O P !', textStyle(34, UI.salmon)).setOrigin(0.5).setAlpha(0).setDepth(20);
    this.toastText = this.add.text(W / 2, H - 110, '', textStyle(30, UI.gold)).setOrigin(0.5).setAlpha(0).setDepth(20);
    this.bannerText = this.add.text(W / 2, 150, '', textStyle(64, UI.cream, { strokeThickness: 12 })).setOrigin(0.5).setAlpha(0).setDepth(21);
    this.epitaph = this.add.text(W / 2, H / 2 - 120, '', textStyle(44, UI.cream, { strokeThickness: 10 })).setOrigin(0.5).setAlpha(0).setDepth(22);

    this.iris = this.add.graphics().setDepth(500);

    this.on(EV.stageStart, (info: StageStartInfo) => this.onStageStart(info));
    this.on(EV.damaged, (d: { hp: number; max: number; amount: number }) => this.onHp(d.hp / d.max, d.amount, false));
    this.on(EV.healed, (d: { hp: number; max: number; amount: number }) => this.onHp(d.hp / d.max, d.amount, true));
    this.on(EV.fly, (n: number) => this.onFly(n));
    this.on(EV.roe, (i: number) => this.onRoe(i));
    this.on(EV.toast, (msg: string) => this.toast(msg));
    this.on(EV.boss, (msg: string) => this.banner(msg));
    this.on(EV.flash, (color: number, alpha: number, ms: number) => this.flash(color, alpha, ms));
    this.on(EV.drying, (v: number) => (this.drying = v));
    this.on(EV.restartHold, (p: number) => (this.holdProgress = p));
    this.on(EV.wriggle, (p: number) => (this.wriggle = p));
    this.on(EV.died, (d: { epitaph: string }) => this.onDied(d.epitaph));
    this.on(EV.complete, (r: StageResult) => this.showResults(r));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const [ev, fn] of this.listeners) bus.off(ev, fn);
      this.listeners = [];
    });

    // The game scene launches us from its create(), so we miss its first start event.
    const info = this.gameRunning ? this.game_.startInfo : null;
    if (info) this.onStageStart(info);
  }

  private on<A extends unknown[]>(event: string, fn: (...args: A) => void): void {
    bus.on(event, fn);
    this.listeners.push([event, fn as unknown as (...args: never[]) => void]);
  }

  // ---- HUD --------------------------------------------------------------

  private buildHud(): void {
    this.hud = this.add.container(0, 0).setDepth(10);
    const icon = this.add.image(36, 34, 'fish_head').setScale(0.9);
    this.bar = this.add.graphics();
    this.flyIcon = this.add.image(36, 76, 'fly').setScale(1.2);
    this.flyText = this.add.text(58, 76, '× 0', textStyle(22)).setOrigin(0, 0.5);
    this.dryText = this.add.text(70 + BAR_W, 34, '☀ DRYING!', textStyle(20, '#ffb347')).setOrigin(0, 0.5).setAlpha(0);
    this.timerText = this.add.text(W - 24, 70, '0:00.0', textStyle(22)).setOrigin(1, 0.5);
    this.stageLabel = this.add.text(W / 2, 28, '', textStyle(22, UI.cream)).setOrigin(0.5).setAlpha(0);
    this.hud.add([this.bar, icon, this.flyIcon, this.flyText, this.dryText, this.timerText, this.stageLabel]);
  }

  private setRoeSlots(count: number): void {
    for (const r of this.roeIcons) r.destroy();
    this.roeIcons = [];
    for (let i = 0; i < count; i++) {
      const img = this.add.image(W - 30 - (count - 1 - i) * 44, 32, 'roe').setScale(0.62);
      this.hud.add(img);
      this.roeIcons.push(img);
      this.paintRoe(i, false);
    }
  }

  private paintRoe(i: number, pop: boolean): void {
    const img = this.roeIcons[i];
    if (!img) return;
    const got = !!session.roe[i];
    img.setTint(got ? 0xffffff : 0x223344).setAlpha(got ? 1 : 0.55);
    if (pop) {
      img.setScale(1.3);
      this.tweens.add({ targets: img, scale: 0.62, duration: 450, ease: 'Elastic.easeOut' });
    }
  }

  private drawBar(): void {
    const g = this.bar;
    g.clear();
    const x = 62;
    const y = 24;
    g.fillStyle(0x0b1622, 0.75);
    g.fillRoundedRect(x - 4, y - 4, BAR_W + 8, BAR_H + 8, 10);
    g.fillStyle(0xffffff, 0.75);
    g.fillRoundedRect(x, y, Math.max(0, BAR_W * this.hpGhost), BAR_H, 7);
    // Fresh salmon red -> tired brown -> decaying green.
    const r = this.hpShown;
    const c1 = Phaser.Display.Color.ValueToColor(r > 0.5 ? 0xff5a48 : 0xa8613a);
    const c2 = Phaser.Display.Color.ValueToColor(r > 0.5 ? 0xa8613a : 0x7f9a52);
    const t = r > 0.5 ? (1 - r) / 0.5 : (0.5 - r) / 0.5;
    const mix = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, 100, Math.round(t * 100));
    let color = Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);
    if (this.barFlash > 0) color = 0xffffff;
    g.fillStyle(color, 1);
    g.fillRoundedRect(x, y, Math.max(0, BAR_W * r), BAR_H, 7);
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(x + 4, y + 3, Math.max(0, BAR_W * r - 8), 5, 3);
    const outline = this.drying >= 1 ? (Math.sin(this.time.now / 80) > 0 ? 0xffb347 : 0xff5a48) : 0xfff6e0;
    g.lineStyle(3, outline, 1);
    g.strokeRoundedRect(x - 4, y - 4, BAR_W + 8, BAR_H + 8, 10);
  }

  private onHp(ratio: number, amount: number, healed: boolean): void {
    this.hp = clamp(ratio, 0, 1);
    if (healed) {
      this.hpGhost = Math.max(this.hpGhost, this.hp);
      this.barFlash = 0.12;
      return;
    }
    if (amount > 0) {
      this.barFlash = 0.1;
      this.tweens.add({ targets: this.hud, x: { from: -10, to: 0 }, duration: 260, ease: 'Elastic.easeOut' });
    }
  }

  private onFly(n: number): void {
    this.flyText.setText(`× ${n}`);
    this.tweens.add({ targets: [this.flyIcon, this.flyText], scale: { from: 1.6, to: 1.2 }, duration: 300, ease: 'Back.easeOut' });
  }

  private onRoe(i: number): void {
    this.paintRoe(i, true);
    const got = session.roe.filter(Boolean).length;
    this.toast(`Golden Roe ${got}/${this.roeIcons.length}`);
  }

  toast(msg: string): void {
    this.toastText.setText(msg).setAlpha(1).setY(H - 90).setScale(0.6);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, scale: 1, y: H - 110, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1600, duration: 400 });
  }

  banner(msg: string): void {
    this.bannerText.setText(msg).setAlpha(1).setX(-300).setRotation(-0.05);
    this.tweens.killTweensOf(this.bannerText);
    synth.rumble(0.8);
    this.tweens.add({ targets: this.bannerText, x: W / 2, duration: 350, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.bannerText, x: W + 400, alpha: 0, delay: 1500, duration: 350, ease: 'Back.easeIn' });
  }

  flash(color: number, alpha: number, ms: number): void {
    if (save.data.settings.reducedFlashes) alpha *= 0.25;
    this.flashRect.setFillStyle(color, 1).setAlpha(alpha);
    this.tweens.killTweensOf(this.flashRect);
    this.tweens.add({ targets: this.flashRect, alpha: 0, duration: ms });
  }

  private onDied(text: string): void {
    this.epitaph.setText(text).setAlpha(0).setScale(1.4);
    this.tweens.add({ targets: this.epitaph, alpha: 1, scale: 1, duration: 400, delay: 250, ease: 'Back.easeOut' });
  }

  // ---- Iris -------------------------------------------------------------

  private drawIris(): void {
    const g = this.iris;
    g.clear();
    if (this.irisR >= IRIS_MAX - 1) return;
    g.fillStyle(0x000000, 1);
    const r0 = Math.max(0, this.irisR);
    const r1 = IRIS_MAX * 2;
    const n = 64;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const c0 = Math.cos(a0);
      const s0 = Math.sin(a0);
      const c1 = Math.cos(a1);
      const s1 = Math.sin(a1);
      const x = this.irisX;
      const y = this.irisY;
      g.fillTriangle(x + c0 * r0, y + s0 * r0, x + c0 * r1, y + s0 * r1, x + c1 * r1, y + s1 * r1);
      g.fillTriangle(x + c0 * r0, y + s0 * r0, x + c1 * r1, y + s1 * r1, x + c1 * r0, y + s1 * r0);
    }
  }

  irisClose(x: number, y: number, then: () => void): void {
    this.irisTween?.stop();
    this.irisX = clamp(x, 0, W);
    this.irisY = clamp(y, 0, H);
    synth.whoosh(0.45, 0.08);
    this.irisTween = this.tweens.addCounter({
      from: this.irisR,
      to: 0,
      duration: 480,
      ease: 'Cubic.easeIn',
      onUpdate: (tw) => (this.irisR = tw.getValue() ?? 0),
      onComplete: () => {
        this.irisR = 0;
        this.time.delayedCall(120, then);
      },
    });
  }

  irisOpen(x: number, y: number, delay = 0): void {
    this.irisTween?.stop();
    this.irisX = clamp(x, 0, W);
    this.irisY = clamp(y, 0, H);
    this.irisR = 0;
    this.irisTween = this.tweens.addCounter({
      from: 0,
      to: IRIS_MAX,
      delay,
      duration: 650,
      ease: 'Cubic.easeOut',
      onUpdate: (tw) => (this.irisR = tw.getValue() ?? 0),
      onComplete: () => (this.irisR = IRIS_MAX),
    });
  }

  // ---- Stage start / title card ------------------------------------------

  private onStageStart(info: StageStartInfo): void {
    if (this.card) {
      this.card.root.destroy();
      this.card = null;
    }
    this.closeMenu();
    this.destroyPanel();
    this.results = null;
    this.mode = 'play';
    this.epitaph.setAlpha(0);
    this.wriggle = -1;
    this.drying = 0;
    this.holdProgress = 0;
    this.hp = this.hpShown = this.hpGhost = 1;
    const fish = this.game_.fish;
    if (fish) this.hp = this.hpShown = this.hpGhost = fish.hp / fish.maxHp;
    this.flyText.setText(`× ${session.flies}`);
    this.setRoeSlots(info.stage.roeCount ?? 0);
    this.titleLayer.setVisible(!!info.stage.isTitle);
    if (info.stage.isTitle) this.refreshTitleLayer();

    if (info.fresh && info.stage.story?.length) {
      this.showCard(info);
    } else {
      audio.muffle(false);
      const p = this.game_.fishScreenPos();
      this.irisOpen(p.x, p.y, 80);
      if (info.fresh && !info.stage.isTitle) this.flashStageLabel(info.stage.name);
    }
  }

  private flashStageLabel(name: string): void {
    this.stageLabel.setText(name).setAlpha(1);
    this.tweens.killTweensOf(this.stageLabel);
    this.tweens.add({ targets: this.stageLabel, alpha: 0, delay: 2500, duration: 800 });
  }

  private showCard(info: StageStartInfo): void {
    this.mode = 'card';
    this.irisR = 0;
    audio.muffle(true);
    const root = this.add.container(0, 0).setDepth(600);
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x081420, 1);
    const chapter = this.add
      .text(W / 2, 150, (info.stage.chapter ?? '').toUpperCase(), textStyle(22, UI.gold, { strokeThickness: 0 }))
      .setOrigin(0.5)
      .setLetterSpacing(8);
    const name = this.add.text(W / 2, 215, info.stage.name, textStyle(68, UI.cream, { strokeThickness: 0 })).setOrigin(0.5).setAlpha(0);
    const line = this.add.rectangle(W / 2, 268, 520, 3, 0xffd25a, 1).setScale(0, 1);
    const story = this.add
      .text(W / 2, 310, '', {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#d6e4f0',
        align: 'center',
        lineSpacing: 12,
        wordWrap: { width: 860 },
      })
      .setOrigin(0.5, 0);
    const prompt = this.add.text(W / 2, H - 60, 'Press Enter', textStyle(22, UI.dim, { strokeThickness: 0 })).setOrigin(0.5).setAlpha(0);
    const swimmer = this.add.image(-120, H - 120, 'temp_fish').setScale(0.4).setAlpha(0.35);
    root.add([bg, chapter, name, line, story, prompt, swimmer]);

    this.tweens.add({ targets: name, alpha: 1, y: { from: 170, to: 215 }, duration: 700, ease: 'Bounce.easeOut' });
    this.tweens.add({ targets: line, scaleX: 1, duration: 700, delay: 200, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: swimmer, x: W + 120, duration: 9000, repeat: -1 });
    this.tweens.add({ targets: swimmer, y: H - 110, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    synth.pop();

    this.card = { root, story, prompt, full: (info.stage.story ?? []).join('\n\n'), typed: 0, wait: 0.8, done: false };
  }

  private updateCard(dt: number): void {
    const c = this.card;
    if (!c) return;
    const skip = input.consumePressed('confirm') || input.consumePressed('pause');
    if (!c.done) {
      if (skip) {
        c.typed = c.full.length;
      } else if (c.wait > 0) {
        c.wait -= dt;
      } else {
        const before = Math.floor(c.typed);
        c.typed += dt * 42;
        const after = Math.floor(c.typed);
        if (after > before) {
          const ch = c.full[after - 1];
          if (ch === '\n') c.wait = 0.25;
          else if (ch !== ' ' && after % 2 === 0) synth.type();
        }
      }
      c.story.setText(c.full.slice(0, Math.floor(c.typed)));
      if (c.typed >= c.full.length) {
        c.done = true;
        this.tweens.add({ targets: c.prompt, alpha: { from: 0.2, to: 1 }, duration: 600, yoyo: true, repeat: -1 });
      }
      return;
    }
    if (skip || input.consumePressed('f') || input.consumePressed('p')) this.dismissCard();
  }

  private dismissCard(): void {
    const c = this.card;
    if (!c) return;
    this.card = null;
    synth.confirm();
    audio.muffle(false);
    this.tweens.add({ targets: c.root, alpha: 0, duration: 350, onComplete: () => c.root.destroy() });
    const game = this.game_;
    game.frozen = false;
    input.clearPressed();
    this.mode = 'play';
    const p = game.fishScreenPos();
    this.irisOpen(p.x, p.y, 150);
    this.flashStageLabel(game.stage.name);
  }

  // ---- Title screen -------------------------------------------------------

  private titleSub!: Phaser.GameObjects.Text;
  private titleUndead!: Phaser.GameObjects.Text;

  private buildTitleLayer(): void {
    this.titleLayer = this.add.container(0, 0).setDepth(15).setVisible(false);
    this.titleSub = this.add.text(W / 2, 205, 'THE LAST RUN', textStyle(40, UI.salmon, { strokeThickness: 9 })).setOrigin(0.5).setLetterSpacing(6);
    const prompt = this.add.text(W / 2, H - 70, 'Flop off the ledge to begin', textStyle(26)).setOrigin(0.5);
    const menuHint = this.add.text(W / 2, H - 34, 'Enter / Esc: Menu', textStyle(18, UI.dim)).setOrigin(0.5);
    this.titleUndead = this.add.text(W / 2, 250, '☠ UNDEAD RUN ☠', textStyle(24, '#9dff7a')).setOrigin(0.5);
    this.titleLayer.add([this.titleSub, prompt, menuHint, this.titleUndead]);
    this.tweens.add({ targets: prompt, alpha: { from: 1, to: 0.45 }, duration: 900, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: this.titleSub, scale: { from: 1, to: 1.04 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private refreshTitleLayer(): void {
    this.titleUndead.setVisible(session.undead);
  }

  // ---- Menus --------------------------------------------------------------

  private openMenu(items: MenuItem[], opts: { title?: string; onBack?: () => void; y?: number; dim?: number }): void {
    this.closeMenu();
    this.destroyPanel();
    const panel = this.add.container(0, 0).setDepth(90);
    panel.add(this.add.rectangle(W / 2, H / 2, W, H, 0x050c14, opts.dim ?? 0.6));
    if (opts.title) {
      const title = this.add.text(W / 2, 110, opts.title, textStyle(56, UI.gold, { strokeThickness: 10 })).setOrigin(0.5);
      panel.add(title);
      this.tweens.add({ targets: title, y: { from: 80, to: 110 }, alpha: { from: 0, to: 1 }, duration: 300, ease: 'Back.easeOut' });
    }
    this.panel = panel;
    const spacing = items.length > 6 ? 48 : 56;
    const top = opts.y ?? H / 2 - ((items.length - 1) * spacing) / 2 + 30;
    this.menu = new Menu(this, items, { x: W / 2, y: top, spacing, onBack: opts.onBack, depth: 95 });
  }

  private closeMenu(): void {
    this.menu?.destroy();
    this.menu = null;
  }

  private destroyPanel(): void {
    this.panel?.destroy();
    this.panel = null;
  }

  /** Esc in game: pause menu, or the title menu on the title screen. */
  openPause(): void {
    const game = this.game_;
    if (this.mode !== 'play') return;
    if (game.stage.isTitle) {
      this.openTitleMenu();
      return;
    }
    this.mode = 'pause';
    this.scene.pause('game');
    audio.muffle(true);
    synth.select();
    this.showPauseMenu();
  }

  private showPauseMenu(): void {
    this.mode = 'pause';
    const resume = () => this.resumeGame();
    this.openMenu(
      [
        { label: 'Resume', action: resume },
        {
          label: 'Restart from Checkpoint',
          action: () => this.leavePause(() => this.game_.respawn()),
          disabled: () => !session.checkpoint,
        },
        { label: 'Restart Stretch', action: () => this.leavePause(() => this.game_.restartStage()) },
        { label: 'River Map', action: () => this.leavePause(() => this.openMap()) },
        { label: 'Settings', action: () => this.showSettings(() => this.showPauseMenu()) },
        { label: 'Quit to Title', action: () => this.leavePause(() => this.game_.goToStage(0)) },
      ],
      { title: 'Paused', onBack: resume },
    );
  }

  private resumeGame(): void {
    this.closeMenu();
    this.destroyPanel();
    this.mode = 'play';
    audio.muffle(false);
    input.clearPressed();
    this.scene.resume('game');
  }

  /** Close the pause menu and run `then` behind an iris. */
  private leavePause(then: () => void): void {
    this.closeMenu();
    this.destroyPanel();
    this.mode = 'play';
    audio.muffle(false);
    this.scene.resume('game');
    this.game_.transitioning = true;
    this.irisClose(W / 2, H / 2, then);
  }

  private openMap(): void {
    this.scene.stop('game');
    this.titleLayer.setVisible(false);
    this.irisR = IRIS_MAX;
    this.scene.launch('map');
    this.scene.bringToTop('ui');
  }

  private openTitleMenu(): void {
    this.mode = 'titleMenu';
    const game = this.game_;
    const go = (index: number) => {
      this.closeMenu();
      this.destroyPanel();
      this.mode = 'play';
      game.transitioning = true;
      game.transition(() => game.goToStage(index));
    };
    const close = () => {
      this.closeMenu();
      this.destroyPanel();
      this.mode = 'play';
      input.clearPressed();
    };
    const lastUnlocked = Math.min(save.data.unlocked, STAGES.length - 1);
    this.openMenu(
      [
        { label: () => `Continue  (${STAGES[lastUnlocked].name})`, action: () => go(lastUnlocked), disabled: () => !save.hasProgress() },
        { label: 'New Journey', action: () => go(1) },
        { label: 'River Map', action: () => { close(); game.transitioning = true; this.irisClose(W / 2, H / 2, () => this.openMap()); } },
        {
          label: () => (save.data.undeadUnlocked ? `Undead Run: ${session.undead ? 'ON' : 'OFF'}` : 'Undead Run: ???'),
          action: () => {
            session.undead = !session.undead;
            this.flash(session.undead ? 0x7dff5a : 0xffffff, 0.4, 300);
            if (session.undead) audio.sfx('splat', { volume: 0.4, rate: 0.6 });
            this.refreshTitleLayer();
          },
          disabled: () => !save.data.undeadUnlocked,
        },
        { label: 'Settings', action: () => this.showSettings(() => this.openTitleMenu()) },
        { label: 'Credits', action: () => this.showCredits(() => this.openTitleMenu()) },
        { label: 'Back', action: close },
      ],
      { onBack: close, dim: 0.55, y: 215 },
    );
  }

  private showSettings(back: () => void): void {
    this.mode = 'settings';
    const s = save.data.settings;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const step = (v: number, d: number) => Math.round(clamp(v + d * 0.1, 0, 1) * 10) / 10;
    let resetArmed = false;
    const done = () => {
      save.write();
      back();
    };
    this.openMenu(
      [
        { label: () => `Music  ${pct(s.music)}`, adjust: (d) => (s.music = step(s.music, d)) },
        {
          label: () => `Sound FX  ${pct(s.sfx)}`,
          adjust: (d) => {
            s.sfx = step(s.sfx, d);
            audio.sfx('water_swish', { volume: 0.6 });
          },
        },
        {
          label: () => `Screen Shake  ${pct(s.shake)}`,
          adjust: (d) => {
            s.shake = step(s.shake, d);
            if (this.gameRunning) this.game_.shake(0.5);
          },
        },
        { label: () => `Reduce Flashes  ${s.reducedFlashes ? 'ON' : 'OFF'}`, adjust: () => (s.reducedFlashes = !s.reducedFlashes) },
        {
          label: () => (resetArmed ? 'Really erase progress?' : 'Erase Progress'),
          action: () => {
            if (!resetArmed) {
              resetArmed = true;
              return;
            }
            save.reset();
            session.undead = false;
            resetArmed = false;
            this.toast('Progress erased');
          },
        },
        { label: 'Back', action: done },
      ],
      { title: 'Settings', onBack: done },
    );
  }

  private showCredits(back: () => void): void {
    this.mode = 'credits';
    this.openMenu([{ label: 'Back', action: back }], { title: 'Credits', onBack: back, y: H - 80 });
    const lines = [
      'FLOP: THE LAST RUN',
      '',
      'Made for FishFest by',
      'Kaylee  ·  Max  ·  Sam Ostrander',
      '',
      'Built with Phaser and Planck.js',
      '',
      'For every salmon that ever swam home.',
    ];
    const t = this.add.text(W / 2, H / 2 - 10, lines.join('\n'), textStyle(26, UI.cream, { lineSpacing: 8 })).setOrigin(0.5);
    this.panel?.add(t);
  }

  // ---- Results ----------------------------------------------------------

  private showResults(r: StageResult): void {
    if (r.stage.isTitle) return;
    this.mode = 'results';
    this.destroyPanel();
    const panel = this.add.container(0, 0).setDepth(80);
    this.panel = panel;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x050c14, 0);
    this.tweens.add({ targets: dim, fillAlpha: 0.55, duration: 600 });
    const box = this.add.graphics();
    box.fillStyle(0x0d1d2c, 0.94).fillRoundedRect(W / 2 - 320, 90, 640, 470, 26);
    box.lineStyle(4, 0xffd25a, 1).strokeRoundedRect(W / 2 - 320, 90, 640, 470, 26);
    const header = this.add.text(W / 2, 140, r.last ? 'HOME AT LAST' : 'STRETCH CLEARED!', textStyle(44, UI.gold, { strokeThickness: 8 })).setOrigin(0.5);
    const name = this.add.text(W / 2, 188, r.stage.name, textStyle(24, UI.dim, { strokeThickness: 0 })).setOrigin(0.5);
    panel.add([dim, box, header, name]);
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, duration: 300, delay: 500 });
    this.tweens.add({ targets: header, scale: { from: 0.4, to: 1 }, duration: 500, delay: 500, ease: 'Back.easeOut' });

    const underPar = r.par !== undefined && r.time <= r.par;
    const allRoe = r.roeCount > 0 && r.roe.every(Boolean);
    const rows: [string, string, string?][] = [
      ['Time', formatTime(r.time) + (r.newBest ? '   NEW BEST!' : ''), r.par !== undefined ? `par ${formatTime(r.par)}` : undefined],
      ['Golden Roe', `${r.roe.filter(Boolean).length} / ${r.roeCount}`],
      ['Flies eaten', `${r.flies}`],
      ['Lives lost', `${r.deaths}`],
    ];
    rows.forEach(([label, value, note], i) => {
      const y = 245 + i * 46;
      const l = this.add.text(W / 2 - 250, y, label, textStyle(26, UI.cream, { strokeThickness: 0 })).setOrigin(0, 0.5);
      const v = this.add
        .text(W / 2 + 250, y, value, textStyle(26, value.includes('NEW BEST') ? UI.gold : UI.cream, { strokeThickness: 0 }))
        .setOrigin(1, 0.5);
      panel.add([l, v]);
      if (note) panel.add(this.add.text(W / 2 + 250, y + 22, note, textStyle(15, UI.dim, { strokeThickness: 0 })).setOrigin(1, 0.5));
      for (const o of [l, v]) {
        o.setAlpha(0);
        this.tweens.add({ targets: o, alpha: 1, x: { from: o.x + (o === l ? -40 : 40), to: o.x }, duration: 260, delay: 900 + i * 180, onStart: () => o === l && synth.select() });
      }
    });

    const starsEarned = [true, underPar, allRoe];
    const labels = ['Made it', 'Under par', 'All roe'];
    starsEarned.forEach((got, i) => {
      const x = W / 2 + (i - 1) * 130;
      const star = this.add.text(x, 470, '★', textStyle(70, got ? UI.gold : '#2a3a4a', { strokeThickness: 6 })).setOrigin(0.5).setScale(0);
      const lab = this.add.text(x, 515, labels[i], textStyle(16, got ? UI.cream : UI.dim, { strokeThickness: 0 })).setOrigin(0.5).setAlpha(0);
      panel.add([star, lab]);
      this.tweens.add({
        targets: star,
        scale: 1,
        angle: { from: -90, to: 0 },
        duration: 450,
        delay: 1750 + i * 300,
        ease: 'Back.easeOut',
        onStart: () => (got ? synth.star(i) : synth.back()),
      });
      this.tweens.add({ targets: lab, alpha: 1, duration: 300, delay: 1850 + i * 300 });
    });

    const prompt = this.add.text(W / 2, H - 40, 'Press Enter to swim on', textStyle(24)).setOrigin(0.5).setAlpha(0);
    panel.add(prompt);
    this.results = { prompt, ready: false, result: r };
    this.time.delayedCall(2800, () => {
      if (!this.results) return;
      this.results.ready = true;
      input.clearPressed();
      this.tweens.add({ targets: prompt, alpha: { from: 0.3, to: 1 }, duration: 600, yoyo: true, repeat: -1 });
    });
  }

  private updateResults(): void {
    const r = this.results;
    if (!r || !r.ready) return;
    if (input.consumePressed('confirm') || input.consumePressed('f') || input.consumePressed('p')) {
      this.results = null;
      synth.confirm();
      const game = this.game_;
      game.transition(() => {
        this.destroyPanel();
        game.nextStage();
      });
    }
  }

  // ---- Frame ------------------------------------------------------------

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 100) / 1000;
    audio.update(dt);

    const running = this.gameRunning;
    const game = running ? this.game_ : null;
    const showHud = !!game && !game.stage?.isTitle && this.mode !== 'card' && this.mode !== 'results';
    this.hud.setVisible(showHud);
    if (!running) this.titleLayer.setVisible(false);

    // HP display easing
    this.hpShown += (this.hp - this.hpShown) * Math.min(1, dt * 12);
    if (this.hpGhost > this.hpShown) this.hpGhost = Math.max(this.hpShown, this.hpGhost - dt * 0.35);
    else this.hpGhost = this.hpShown;
    this.barFlash -= dt;
    if (showHud) {
      this.drawBar();
      this.timerText.setText(formatTime(session.time));
      this.dryText.setAlpha(this.drying >= 1 ? 0.6 + 0.4 * Math.sin(this.time.now / 90) : 0);
    }

    // Vignette tightens and pulses red when low on HP.
    const fish = game?.fish;
    const low = showHud && fish && !fish.dead && this.hp < 0.3;
    this.vignette.setAlpha(showHud ? 0.28 + (1 - this.hp) * 0.25 : 0.2);
    if (low && !save.data.settings.reducedFlashes) {
      this.redPulse.setAlpha(0.25 + 0.2 * Math.sin(this.time.now / 140));
    } else {
      this.redPulse.setAlpha(Math.max(0, this.redPulse.alpha - dt * 2));
    }
    if (low && this.mode === 'play') {
      this.heartTimer -= dt;
      if (this.heartTimer <= 0) {
        this.heartTimer = 0.55 + this.hp * 2;
        synth.heartbeat();
      }
    }

    this.drawHold();
    this.drawWriggle();
    this.drawIris();

    switch (this.mode) {
      case 'card':
        this.updateCard(dt);
        break;
      case 'results':
        this.updateResults();
        break;
      case 'pause':
      case 'settings':
      case 'titleMenu':
      case 'credits':
        this.menu?.update(dt);
        break;
      case 'play':
        if (game?.stage?.isTitle && running && input.consumePressed('confirm')) this.openTitleMenu();
        break;
    }
  }

  private drawHold(): void {
    const g = this.holdGfx;
    g.clear();
    const p = this.holdProgress;
    this.holdText.setAlpha(p > 0 ? 1 : 0);
    if (p <= 0) return;
    g.lineStyle(8, 0x0b1622, 0.7).strokeCircle(W / 2, H - 120, 26);
    g.lineStyle(8, 0xffd25a, 1);
    g.beginPath();
    g.arc(W / 2, H - 120, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(p, 0, 1));
    g.strokePath();
  }

  private drawWriggle(): void {
    const g = this.wriggleGfx;
    g.clear();
    const p = this.wriggle;
    if (p < 0) {
      this.wriggleText.setAlpha(0);
      return;
    }
    const x = W / 2;
    const y = H / 2 + 40;
    const shake = Math.sin(this.time.now / 30) * 3;
    this.wriggleText.setAlpha(1).setScale(1 + Math.abs(Math.sin(this.time.now / 120)) * 0.12).setX(x + shake);
    g.lineStyle(14, 0x0b1622, 0.7).strokeCircle(x, y, 44);
    g.lineStyle(14, 0x7dff9a, 1);
    g.beginPath();
    g.arc(x, y, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    g.strokePath();
  }
}
