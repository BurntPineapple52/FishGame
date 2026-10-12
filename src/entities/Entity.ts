/** Anything in a stage that needs per-step or per-frame logic. */
export interface Entity {
  /** Runs before every fixed physics step (Godot's _physics_process). */
  physicsUpdate?(dt: number): void;
  /** Runs once per rendered frame, after physics (Godot's _process). */
  update?(dt: number): void;
  /** Set to true and the scene drops the entity after the current step. */
  removed?: boolean;
}
