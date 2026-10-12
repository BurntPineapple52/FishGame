# FishGame
It's about fish

An HTML5 game built with [Phaser 4](https://phaser.io) for rendering and
[Planck.js](https://piqnt.com/planck.js/) (a Box2D port) for physics, written in
TypeScript and bundled with [Vite](https://vite.dev).

## Controls

| Key | Action |
| --- | --- |
| F / P | Bend the tail |
| L / O | Bend the head |
| Esc | Restart the stage |
| ` (backquote) | Toggle physics debug outlines |

F/L/O/P work by key position and by letter, so Colemak/Dvorak layouts work too.

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
any static host such as GitHub Pages.

## Project layout

```
index.html            page shell
public/assets/        sprites and audio, served as-is
src/
  main.ts             Phaser game config
  config.ts           resolution, physics rate, gravity, colors
  input.ts            F/L/O/P/Esc input actions
  physics/
    PhysicsWorld.ts   Planck wrapper with Godot-like behavior (see below)
    shapes.ts         rect/polygon shapes, convex decomposition
  entities/           fish, water, bear, logs, rocks, rivergrass, keycaps, terrain helpers
  stages/             one file per level, plus the play order in index.ts
  scenes/
    BootScene.ts      asset loading
    GameScene.ts      runs a stage: fixed 60 Hz physics, entities, camera
godot/                the original Godot 4.2 project, kept for reference
```

### Adding a stage

1. Create `src/stages/myStage.ts` exporting a `StageDef` with a `build(scene)`
   function that creates its entities (see `bearStage.ts`).
2. Add it to the `STAGES` list in `src/stages/index.ts`.
3. Load any new textures in `src/scenes/BootScene.ts` (key = file name without extension).

Call `scene.nextStage()` to advance and `scene.restartStage()` to restart.

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
stage). Known differences:

- **Bear:** Bear.gd's 360° swipe with a 2 s cooldown is driven by a shoulder
  motor. Between swipes the arm hangs in the water. Godot's version was a free
  pendulum flailing from an uncapped wrist motor.
- **Fish on land:** a steady tail wiggle moves the fish about half as far as
  in the Godot build (measured with identical scripted input). Swimming,
  falling and landing match closely. Box2D's joint limits are stiffer than
  Godot's, so tune `TAIL_TORQUE`/`JOINT_LIMIT` in `src/entities/Fish.ts` if
  flopping feels sluggish.
- The bear stage has no exit yet, the same as the Godot build.
