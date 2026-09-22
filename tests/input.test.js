import { describe, expect, it } from 'vitest';
import { InputController } from '../src/game/input.js';
import { createPlayerState, stepPlayer } from '../src/game/physics.js';

describe('InputController.sample', () => {
  it('reports no movement by default', () => {
    expect(new InputController().sample()).toEqual({
      moveX: 0,
      moveZ: 0,
      jumpPressed: false,
      jumpHeld: false
    });
  });

  it('combines keyboard keys and cancels opposite directions', () => {
    const input = new InputController();
    input.keys.add('KeyW');
    input.keys.add('ArrowRight');
    const diagonal = input.sample();
    expect(Math.hypot(diagonal.moveX, diagonal.moveZ)).toBeCloseTo(1, 6);

    input.keys.add('KeyS');
    const cancelled = input.sample();
    expect(cancelled.moveZ).toBe(0);
    expect(cancelled.moveX).toBe(-1);
  });

  it('maps left keys to positive world X and right keys to negative world X', () => {
    const input = new InputController();

    for (const code of ['ArrowLeft', 'KeyA']) {
      input.keys.add(code);
      expect(input.sample().moveX).toBe(1);
      input.keys.clear();
    }

    for (const code of ['ArrowRight', 'KeyD']) {
      input.keys.add(code);
      expect(input.sample().moveX).toBe(-1);
      input.keys.clear();
    }
  });

  it('moves physics toward positive world X for left and negative world X for right', () => {
    const leftInput = new InputController();
    const leftPlayer = createPlayerState({ x: 0, y: 1, z: 0 });
    leftInput.keys.add('ArrowLeft');
    stepPlayer(leftPlayer, leftInput.sample(), [], 1 / 60, 0);
    expect(leftPlayer.velocity.x).toBeGreaterThan(0);

    const rightInput = new InputController();
    const rightPlayer = createPlayerState({ x: 0, y: 1, z: 0 });
    rightInput.keys.add('ArrowRight');
    stepPlayer(rightPlayer, rightInput.sample(), [], 1 / 60, 0);
    expect(rightPlayer.velocity.x).toBeLessThan(0);
  });

  it('clamps the touch stick to the unit circle', () => {
    const input = new InputController();
    input.setTouchAxis(3, 4);
    expect(input.touch.x).toBeCloseTo(0.6, 6);
    expect(input.touch.z).toBeCloseTo(0.8, 6);
    const sample = input.sample();
    expect(sample.moveX).toBeCloseTo(-0.6, 6);
    expect(sample.moveZ).toBeCloseTo(0.8, 6);
    input.setTouchAxis(0.3, 0.4);
    expect(input.touch.x).toBeCloseTo(0.3, 6);
  });

  it('merges touch and keyboard input without exceeding full speed', () => {
    const input = new InputController();
    input.setTouchAxis(1, 0);
    input.keys.add('ArrowRight');
    const sample = input.sample();
    expect(sample.moveX).toBeCloseTo(-1, 6);
  });

  it('cancels opposite keyboard and touch horizontal input', () => {
    const input = new InputController();
    input.setTouchAxis(1, 0);
    input.keys.add('ArrowLeft');
    expect(input.sample().moveX).toBe(0);
  });

  it('emits a jump edge exactly once per press', () => {
    const input = new InputController();
    input.setTouchJump(true);
    const first = input.sample();
    expect(first).toMatchObject({ jumpPressed: true, jumpHeld: true });
    const second = input.sample();
    expect(second).toMatchObject({ jumpPressed: false, jumpHeld: true });

    input.setTouchJump(false);
    expect(input.sample().jumpHeld).toBe(false);
  });

  it('drops queued edges when the game leaves play mode', () => {
    const input = new InputController();
    input.setTouchJump(true);
    input.clearEdges();
    expect(input.sample().jumpPressed).toBe(false);
  });

  it('treats non-finite touch axis input as neutral instead of poisoning state with NaN', () => {
    // Guards against a malformed touch-geometry read (e.g. a zero-size stick
    // rect) ever reaching the simulation/camera as NaN/Infinity.
    const input = new InputController();
    input.setTouchAxis(NaN, 0.5);
    expect(input.touch).toEqual({ x: 0, z: 0 });
    expect(input.sample()).toMatchObject({ moveX: 0, moveZ: 0 });

    input.setTouchAxis(Infinity, -Infinity);
    expect(input.touch).toEqual({ x: 0, z: 0 });

    input.setTouchAxis(0.5, 0.5);
    expect(input.touch.x).toBeCloseTo(0.5, 6);
  });
});
