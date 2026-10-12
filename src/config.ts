// Global constants. All gameplay values are in Godot-style pixel units
// (px, px/s, kg·px/s² ...) so numbers can be copied straight from the old
// Godot scripts; the physics layer converts to meters internally.

/** Logical resolution (Godot's default window size). The canvas scales to fit. */
export const VIEW_WIDTH = 1152;
export const VIEW_HEIGHT = 648;

/** Fixed physics rate, matching Godot's default 60 ticks/s. */
export const PHYSICS_HZ = 60;
export const PHYSICS_DT = 1 / PHYSICS_HZ;
/** Never simulate more than this many steps in one frame (avoids spiral of death). */
export const MAX_STEPS_PER_FRAME = 5;

/** Pixels per physics meter. Only the physics layer should care about this. */
export const PPM = 50;

/** Godot project defaults (physics/2d/default_*). */
export const GRAVITY = 980;
export const DEFAULT_LINEAR_DAMP = 0.1;
export const DEFAULT_ANGULAR_DAMP = 1.0;

/** Collision layer bits, same numbering as Godot's layer 1 / layer 2. */
export const LAYER_1 = 0b01;
export const LAYER_2 = 0b10;

export const COLORS = {
  sky: 0x3a8cd5, // rendering/environment/defaults/default_clear_color
  ground: 0x917e60,
  black: 0x000000,
  water: 0x072c59,
  waterAlpha: 0.698,
};
