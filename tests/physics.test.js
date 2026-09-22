import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config.js';
import {
  boxesOverlap,
  createPlayerState,
  enemyPositionAt,
  platformBoundsAt,
  platformCenterAt,
  playerBounds,
  stepPlayer
} from '../src/game/physics.js';

const ground = { id: 'ground', x: 0, y: -0.5, z: 0, w: 20, h: 1, d: 20 };
const idle = { moveX: 0, moveZ: 0, jumpPressed: false, jumpHeld: false };

function simulate(state, input, steps, platforms = [ground], dt = 1 / 120) {
  const events = [];
  for (let i = 0; i < steps; i += 1) {
    events.push(...stepPlayer(state, input, platforms, dt, i * dt));
  }
  return events;
}

describe('platform helpers', () => {
  it('keeps static platforms still', () => {
    expect(platformCenterAt(ground, 3.2)).toEqual({ x: 0, y: -0.5, z: 0 });
  });

  it('animates moving platforms along a single axis', () => {
    const moving = { ...ground, motion: { axis: 'x', amplitude: 2, speed: 1, phase: 0 } };
    expect(platformCenterAt(moving, 0).x).toBeCloseTo(0, 5);
    expect(platformCenterAt(moving, Math.PI / 2).x).toBeCloseTo(2, 5);
    expect(platformCenterAt(moving, Math.PI / 2).z).toBe(0);
  });

  it('computes bounds from centre and size', () => {
    const bounds = platformBoundsAt(ground, 0);
    expect(bounds).toMatchObject({ minX: -10, maxX: 10, minY: -1, maxY: 0, minZ: -10, maxZ: 10 });
  });

  it('detects overlaps only when boxes intersect', () => {
    const player = playerBounds({ x: 0, y: 0.7, z: 0 });
    expect(boxesOverlap(player, platformBoundsAt(ground, 0))).toBe(false);
    expect(boxesOverlap(playerBounds({ x: 0, y: 0.2, z: 0 }), platformBoundsAt(ground, 0))).toBe(true);
  });
});

describe('stepPlayer', () => {
  it('falls under gravity and lands on top of a platform', () => {
    const state = createPlayerState({ x: 0, y: 6, z: 0 });
    const events = simulate(state, idle, 300);
    expect(state.grounded).toBe(true);
    expect(state.position.y).toBeCloseTo(CONFIG.playerHalfHeight, 5);
    expect(state.velocity.y).toBe(0);
    expect(events).toContain('land');
  });

  it('never tunnels through the floor while falling from high up', () => {
    const state = createPlayerState({ x: 0, y: 40, z: 0 });
    simulate(state, idle, 900);
    expect(state.position.y).toBeGreaterThan(0);
  });

  it('jumps when grounded and returns to the ground', () => {
    const state = createPlayerState({ x: 0, y: 0.7, z: 0 });
    simulate(state, idle, 10);
    const events = simulate(state, { ...idle, jumpPressed: true, jumpHeld: true }, 1);
    expect(events).toContain('jump');
    expect(state.velocity.y).toBeGreaterThan(0);
    simulate(state, { ...idle, jumpHeld: true }, 60);
    expect(state.position.y).toBeGreaterThan(1.5);
    simulate(state, idle, 400);
    expect(state.grounded).toBe(true);
  });

  it('allows exactly one mid-air double jump', () => {
    const state = createPlayerState({ x: 0, y: 0.7, z: 0 });
    simulate(state, idle, 10);
    simulate(state, { ...idle, jumpPressed: true, jumpHeld: true }, 1);
    simulate(state, { ...idle, jumpHeld: true }, 20);
    const second = simulate(state, { ...idle, jumpPressed: true, jumpHeld: true }, 1);
    expect(second).toContain('doubleJump');
    simulate(state, { ...idle, jumpHeld: true }, 20);
    const third = simulate(state, { ...idle, jumpPressed: true, jumpHeld: true }, 1);
    expect(third).toEqual([]);
  });

  it('moves horizontally and stops at a wall', () => {
    const wall = { id: 'wall', x: 4, y: 1.5, z: 0, w: 1, h: 4, d: 10 };
    const state = createPlayerState({ x: 0, y: 0.7, z: 0 });
    simulate(state, { ...idle, moveX: 1 }, 300, [ground, wall]);
    expect(state.position.x).toBeLessThanOrEqual(3.5 - CONFIG.playerHalfWidth + 1e-6);
    expect(state.position.x).toBeGreaterThan(2);
  });

  it('carries the player along a moving platform', () => {
    const moving = { id: 'm', x: 0, y: -0.5, z: 0, w: 6, h: 1, d: 6, motion: { axis: 'x', amplitude: 3, speed: 1 } };
    const state = createPlayerState({ x: 0, y: 0.7, z: 0 });
    simulate(state, idle, 120, [moving]);
    expect(state.standingOn).toBe('m');
    expect(Math.abs(state.position.x)).toBeGreaterThan(1);
  });

  it('clamps the fall speed', () => {
    const state = createPlayerState({ x: 0, y: 500, z: 0 });
    simulate(state, idle, 600, []);
    expect(state.velocity.y).toBe(CONFIG.maxFallSpeed);
  });
});

describe('enemyPositionAt', () => {
  it('stays on the patrol segment', () => {
    const enemy = { from: { x: -2, y: 1, z: 0 }, to: { x: 2, y: 1, z: 0 }, speed: 1, phase: 0 };
    for (let t = 0; t < 10; t += 0.25) {
      const pos = enemyPositionAt(enemy, t);
      expect(pos.x).toBeGreaterThanOrEqual(-2.0001);
      expect(pos.x).toBeLessThanOrEqual(2.0001);
      expect(pos.y).toBeCloseTo(1, 6);
    }
  });
});
