# FLOP: The Last Run
It's about fish

You are Sockeye, an old salmon making the last swim of your life, upstream
from the sea to the gravel where you hatched. Seven stretches of river stand in
the way: driftwood, a bear, an eagle, waterfalls and a drought. As you get
hurt, your body shows the same decay a real spawning salmon goes through.

An HTML5 game built with [Phaser 4](https://phaser.io) for rendering and
[Planck.js](https://piqnt.com/planck.js/) (a Box2D port) for physics, written in
TypeScript and bundled with [Vite](https://vite.dev).

## Controls

| Key | Action |
| --- | --- |
| F / P | Bend the tail (wiggle to swim) |
| L / O | Bend the head (steer) |
| Esc | Pause menu (title menu on the title screen) |
| Hold R | Restart from the last checkpoint |
| Arrows / WASD, Enter / Space | Navigate menus, skip title cards |
| ` (backquote) | Toggle physics debug outlines and an FPS readout |

F/L/O/P work by key position and by letter, so Colemak/Dvorak layouts work too.
Menus also work with the mouse.

## The game

| # | Stage | What's new |
| --- | --- | --- |
| 0 | Title | Flop off the ledge to begin. The F L O P keycaps play notes. |
| 1 | The Shallows | Tutorial hints, flies, checkpoints, other salmon swimming alongside |
| 2 | Log Jam | Strong current, driftwood floating at different depths |
| 3 | Bear Crossing | The original bear stage, now with a swing telegraph, a reveal and an exit |
| 4 | Talon Ridge | An eagle hunts the shallows; hide in deep pools or weed beds, mash F L O P if caught |
| 5 | The Falls | Climb a staircase of pools; bubble jets launch you up each waterfall |
| 6 | Dry Creek | Flop between puddles before you dry out; puddles heal you; reaching the end brings rain |
| 7 | Spawning Grounds | A calm last swim, then the ending |

Each stretch has a par time and three hidden **golden roe**. The results card
awards a star for finishing, one for beating par and one for finding every
roe. **Flies** hover just above the water: leap out to eat one and heal.
Staying out of water too long dries you out. Progress, best times, roe and
settings save to `localStorage`. **Level Select** (M or the button on the
title screen, or the title/pause menu) opens the river map, where any stretch
can be played. Finishing the game unlocks **Undead Run**:
you start fully decayed with 60 HP and no drying, the predators are faster,
and Thriller plays.

## Running

Requires Node.js 20+.

```sh
npm install
npm run dev        # dev server with hot reload at http://localhost:5173
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ locally
```

`dist/` is a self-contained static site with relative paths. Zip its contents
(with `index.html` at the root of the zip) to upload to itch.io, or host it on
any static host such as GitHub Pages. The UI font (Fredoka) loads from Google
Fonts; offline, the game falls back to a system font.

Development helpers (dev server only):

- `?stage=N` in the URL starts on stage N.
- `]` completes the current stage.
- `window.game` is the Phaser game and `window.flop` holds `session`, `save` and `bus`.
  To teleport the fish, set
  `flop.session.checkpoint = { x, y, order: 99 }` then call
  `game.scene.getScene('game').respawn()`.

## Project layout

```
index.html            page shell
public/assets/        sprites and audio, served as-is
src/
  main.ts             Phaser game config, font loading
  config.ts           resolution, physics rate, gravity, colors, draw depths, UI font
  input.ts            named input actions (F/L/O/P, pause, restart, menus)
  save.ts             localStorage progress and settings
  session.ts          state of the current attempt (checkpoint, time, roe) and the event bus
  audio/
    Audio.ts          sample playback, music/ambience crossfades, pause muffling
    synth.ts          WebAudio blips, chimes, growls and jingles (no files needed)
  fx/
    textures.ts       procedurally generated particle and pickup textures
    Particles.ts      bubbles, splashes, dust, shards, sparkles, ripples, pop-up text
    FishCamera.ts     follow camera with look-ahead, zoom, trauma shake, punches
  physics/
    PhysicsWorld.ts   Planck wrapper with Godot-like behavior (see below)
    shapes.ts         rect/polygon shapes, convex decomposition
  entities/           fish, water, bear, eagle, logs, rocks, rivergrass, keycaps,
                      ground polygons, checkpoints/goal, pickups, jets, waterfalls
  stages/             one file per level, kit.ts (shared scenery), play order in index.ts
  scenes/
    BootScene.ts      asset loading
    GameScene.ts      runs a stage: fixed 60 Hz physics, slow-mo, hitstop, death and completion
    UIScene.ts        HUD, title cards, iris wipes, menus, results (runs on top, never pauses)
    MapScene.ts       level select
    EndingScene.ts    ending cutscene and credits
  ui/Menu.ts          keyboard/mouse menu widget
godot/                the original Godot 4.2 project, kept for reference
```

### Adding a stage

1. Create `src/stages/myStage.ts` exporting a `StageDef` (see `shallows.ts`).
   `buildRiver()` from `kit.ts` sets up the sky, parallax, bank, water,
   riverbed polygon, end walls and camera bounds from a bed contour.
2. In `build(scene)`, call `scene.spawnFish(...)` (it respawns at the last
   checkpoint automatically). Then add `Checkpoint`s, `Fly`s, `Roe.create(...)`
   (one per `roeCount`) and a `Goal`.
3. Fill in `name`, `chapter` and `story` (the title card text), plus `music`,
   `par`, `roeCount` and `drying`.
4. Add it to the `STAGES` list in `src/stages/index.ts`, and a map node in
   `src/scenes/MapScene.ts`.
5. Load any new textures in `src/scenes/BootScene.ts` (key = file name without extension).

### Game feel hooks

Entities reach the effects through the scene:
`scene.fx.*` (particles, text pops), `scene.shake(amount)`,
`scene.hitstop(ms)`, `scene.slowMotion(scale, ms)`, `scene.flash(color, alpha, ms)`
and `scene.camera.zoomPunch(amount)`. Sounds go through `audio.sfx(key, ...)`
or `synth.*`. Gameplay events (`EV` in `session.ts`) reach the UI over `bus`.

### Physics conventions

Gameplay code uses **Godot units**: pixels, px/s, and forces in kg·px/s², with
y pointing down and positive angles clockwise. Numbers from the old GDScript
can be copied over unchanged. `PhysicsWorld` converts to meters internally and
mimics Godot where it matters:

- linear/angular damping use Godot's formula (`v *= 1 - dt * damp`);
- bodies have groups (`"physics"`, `"player"`, `"buoyant"`, ...), a constant
  force, and `onEnter`/`onExit` callbacks like `body_entered`;
- `sensor: true` bodies act as `Area2D`;
- `layer`/`mask` match Godot collision layers.

## Porting notes

The game was ported from the Godot project in `godot/` (main menu and bear
stage), then expanded. Known differences from the Godot build:

- **Bear:** Bear.gd's 360° swipe with a 2 s cooldown is driven by a shoulder
  motor. Between swipes the arm hangs in the water. Godot's version was a free
  pendulum flailing from an uncapped wrist motor.
- **Fish on land:** a steady tail wiggle moves the fish about half as far as
  in the Godot build (measured with identical scripted input). Swimming,
  falling and landing match closely. Box2D's joint limits are stiffer than
  Godot's, so tune `TAIL_TORQUE`/`JOINT_LIMIT` in `src/entities/Fish.ts` if
  flopping feels sluggish.
