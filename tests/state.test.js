import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/game/config.js';
import { enemyPositionAt } from '../src/game/physics.js';
import { createLevel, resetLevel } from '../src/game/level.js';
import { computeScore, createGameState, levelProgress, updateGame } from '../src/game/state.js';

const idle = { moveX: 0, moveZ: 0, jumpPressed: false, jumpHeld: false };

function place(state, position) {
  state.player.position = { ...position };
  state.player.velocity = { x: 0, y: 0, z: 0 };
}

describe('level data', () => {
  it('describes a complete, forward-moving course', () => {
    const level = createLevel();
    expect(level.platforms.length).toBeGreaterThan(10);
    expect(level.totalCoins).toBe(level.coins.length);
    expect(level.checkpoints.length).toBeGreaterThanOrEqual(3);
    expect(level.goal.z).toBeGreaterThan(level.spawn.z);
    const ids = level.platforms.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resets collectibles, enemies and checkpoints in place', () => {
    const level = createLevel();
    level.coins[0].collected = true;
    level.enemies[0].alive = false;
    level.checkpoints[0].reached = true;
    resetLevel(level);
    expect(level.coins.every((c) => !c.collected)).toBe(true);
    expect(level.enemies.every((e) => e.alive)).toBe(true);
    expect(level.checkpoints.every((c) => !c.reached)).toBe(true);
  });
});

describe('updateGame', () => {
  it('collects a coin once', () => {
    const level = createLevel();
    const state = createGameState(level, CONFIG);
    const coin = level.coins[0];
    place(state, { x: coin.x, y: coin.y, z: coin.z });
    const events = updateGame(state, idle, 1 / 60);
    expect(events.some((e) => e.type === 'coin')).toBe(true);
    expect(state.coinsCollected).toBe(1);

    place(state, { x: coin.x, y: coin.y, z: coin.z });
    const again = updateGame(state, idle, 1 / 60);
    expect(again.some((e) => e.type === 'coin')).toBe(false);
    expect(state.coinsCollected).toBe(1);
  });

  it('activates checkpoints and respawns there after a fall', () => {
    const level = createLevel();
    const state = createGameState(level, CONFIG);
    const cp = level.checkpoints[0];
    place(state, { x: cp.x, y: cp.y, z: cp.z });
    updateGame(state, idle, 1 / 60);
    expect(cp.reached).toBe(true);

    place(state, { x: 0, y: CONFIG.killPlaneY - 5, z: 20 });
    const events = updateGame(state, idle, 1 / 60);
    expect(events.some((e) => e.type === 'death' && e.cause === 'fall')).toBe(true);
    expect(state.deaths).toBe(1);
    expect(state.player.position.z).toBeCloseTo(cp.z, 5);
  });

  it('defeats an enemy when stomped from above and hurts otherwise', () => {
    const dt = 1 / 60;
    const level = createLevel();
    const state = createGameState(level, CONFIG);
    const enemy = level.enemies[0];
    const spot = enemyPositionAt(enemy, dt);
    place(state, { x: spot.x, y: spot.y + 0.9, z: spot.z });
    state.player.velocity.y = -8;
    const events = updateGame(state, idle, dt);
    expect(events.some((e) => e.type === 'stomp')).toBe(true);
    expect(enemy.alive).toBe(false);
    expect(state.player.velocity.y).toBe(CONFIG.bounceSpeed);
  });

  it('hurts the player when walking into an enemy', () => {
    const dt = 1 / 60;
    const state = createGameState(createLevel(), CONFIG);
    const enemy = state.level.enemies[0];
    const spot = enemyPositionAt(enemy, dt);
    place(state, { x: spot.x, y: spot.y, z: spot.z });
    const events = updateGame(state, idle, dt);
    expect(events.some((e) => e.type === 'death' && e.cause === 'enemy')).toBe(true);
    expect(enemy.alive).toBe(true);
  });

  it('kills the player on hazards', () => {
    const level = createLevel();
    const state = createGameState(level, CONFIG);
    const hazard = level.hazards[0];
    place(state, { x: hazard.x, y: hazard.y, z: hazard.z });
    const events = updateGame(state, idle, 1 / 60);
    expect(events.some((e) => e.type === 'death' && e.cause === 'hazard')).toBe(true);
  });

  it('wins when the goal is reached and then ignores further updates', () => {
    const level = createLevel();
    const state = createGameState(level, CONFIG);
    place(state, { x: level.goal.x, y: level.goal.y, z: level.goal.z });
    const events = updateGame(state, idle, 1 / 60);
    expect(events.some((e) => e.type === 'victory')).toBe(true);
    expect(state.status).toBe('victory');
    expect(updateGame(state, idle, 1 / 60)).toEqual([]);
  });

  it('reports progress between 0 and 1', () => {
    const level = createLevel();
    const state = createGameState(level, CONFIG);
    expect(levelProgress(state)).toBe(0);
    place(state, { x: 0, y: 0, z: level.goal.z + 20 });
    expect(levelProgress(state)).toBe(1);
    place(state, { x: 0, y: 0, z: (level.goal.z + level.spawn.z) / 2 });
    expect(levelProgress(state)).toBeCloseTo(0.5, 2);
  });
});

describe('computeScore', () => {
  it('rewards coins and punishes deaths', () => {
    const level = createLevel();
    const fast = createGameState(level, CONFIG);
    fast.coinsCollected = 10;
    fast.elapsed = 60;
    const sloppy = createGameState(level, CONFIG);
    sloppy.coinsCollected = 10;
    sloppy.elapsed = 60;
    sloppy.deaths = 4;
    expect(computeScore(fast)).toBeGreaterThan(computeScore(sloppy));
    expect(computeScore(fast)).toBeGreaterThan(0);
  });

  it('never returns a negative score', () => {
    const state = createGameState(createLevel(), CONFIG);
    state.elapsed = 10_000;
    state.deaths = 500;
    expect(computeScore(state)).toBe(0);
  });
});
