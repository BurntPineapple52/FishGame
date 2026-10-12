// Keyboard input with named actions.
//
// Each action matches either a physical key position (KeyboardEvent.code) or the
// character the key types (KeyboardEvent.key). That mirrors the Godot input map,
// which bound F/L/O/P both by position and by the letter so Colemak/Dvorak
// players get the letters printed on their keys.

export type Action = 'f' | 'l' | 'o' | 'p' | 'restart' | 'debug';

const BINDINGS: Record<Action, { codes: string[]; keys: string[] }> = {
  f: { codes: ['KeyF'], keys: ['f'] },
  l: { codes: ['KeyL'], keys: ['l'] },
  o: { codes: ['KeyO'], keys: ['o'] },
  p: { codes: ['KeyP'], keys: ['p'] },
  restart: { codes: ['Escape'], keys: ['escape'] },
  debug: { codes: ['Backquote'], keys: ['`'] },
};

const ACTIONS = Object.keys(BINDINGS) as Action[];

function matches(action: Action, code: string, key: string): boolean {
  const b = BINDINGS[action];
  return b.codes.includes(code) || b.keys.includes(key);
}

class Input {
  /** Held keys: physical code -> lowercased character it produced on keydown. */
  private held = new Map<string, string>();
  private pressed = new Set<Action>();

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      this.held.set(e.code, key);
      for (const a of ACTIONS) if (matches(a, e.code, key)) this.pressed.add(a);
    });
    target.addEventListener('keyup', (e) => this.held.delete(e.code));
    // Releasing keys while the tab is unfocused never sends keyup.
    target.addEventListener('blur', () => this.held.clear());
  }

  isDown(action: Action): boolean {
    for (const [code, key] of this.held) if (matches(action, code, key)) return true;
    return false;
  }

  /** Same as Godot's Input.get_axis(negative, positive). */
  axis(negative: Action, positive: Action): number {
    return (this.isDown(positive) ? 1 : 0) - (this.isDown(negative) ? 1 : 0);
  }

  /** True once per key press (like is_action_just_pressed), then cleared. */
  consumePressed(action: Action): boolean {
    return this.pressed.delete(action);
  }

  clearPressed(): void {
    this.pressed.clear();
  }
}

export const input = new Input();
