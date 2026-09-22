/**
 * Keyboard + touch input. Produces a normalised movement vector and jump
 * edge/hold flags that the game loop consumes once per frame.
 */

const MOVE_KEYS = {
  ArrowUp: ['z', 1],
  KeyW: ['z', 1],
  ArrowDown: ['z', -1],
  KeyS: ['z', -1],
  ArrowLeft: ['x', -1],
  KeyA: ['x', -1],
  ArrowRight: ['x', 1],
  KeyD: ['x', 1]
};

const JUMP_KEYS = new Set(['Space', 'KeyZ', 'KeyJ']);

export class InputController {
  constructor() {
    this.keys = new Set();
    this.touch = { x: 0, z: 0 };
    this.jumpHeld = false;
    this.jumpQueued = false;
    this.listeners = [];
    this.onPause = null;
    this.onInteract = null;
  }

  attach(target = window) {
    const keyDown = (event) => {
      if (event.repeat) return;
      if (MOVE_KEYS[event.code] || JUMP_KEYS.has(event.code)) event.preventDefault();
      if (JUMP_KEYS.has(event.code)) {
        this.jumpHeld = true;
        this.jumpQueued = true;
      }
      if (event.code === 'KeyP' || event.code === 'Escape') this.onPause?.();
      this.keys.add(event.code);
      this.onInteract?.();
    };
    const keyUp = (event) => {
      if (JUMP_KEYS.has(event.code)) this.jumpHeld = false;
      this.keys.delete(event.code);
    };
    const blur = () => {
      this.keys.clear();
      this.jumpHeld = false;
      this.touch.x = 0;
      this.touch.z = 0;
    };
    target.addEventListener('keydown', keyDown);
    target.addEventListener('keyup', keyUp);
    target.addEventListener('blur', blur);
    this.listeners.push(() => {
      target.removeEventListener('keydown', keyDown);
      target.removeEventListener('keyup', keyUp);
      target.removeEventListener('blur', blur);
    });
  }

  detach() {
    this.listeners.forEach((off) => off());
    this.listeners = [];
  }

  /** Called by the on-screen stick. Values are clamped to the unit circle. */
  setTouchAxis(x, z) {
    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }
    this.touch.x = x;
    this.touch.z = z;
  }

  setTouchJump(down) {
    if (down && !this.jumpHeld) this.jumpQueued = true;
    this.jumpHeld = down;
  }

  /** Drops queued edges, e.g. when the game is paused or a menu is shown. */
  clearEdges() {
    this.jumpQueued = false;
  }

  /** Reads and clears per-frame edge state. */
  sample() {
    let x = this.touch.x;
    let z = this.touch.z;
    for (const code of this.keys) {
      const mapping = MOVE_KEYS[code];
      if (mapping) {
        if (mapping[0] === 'x') x += mapping[1];
        else z += mapping[1];
      }
    }
    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }
    const jumpPressed = this.jumpQueued;
    this.jumpQueued = false;
    return { moveX: x, moveZ: z, jumpPressed, jumpHeld: this.jumpHeld };
  }
}
