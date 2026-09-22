import { CONFIG } from './config.js';
import {
  createPlayerState,
  distance3,
  distanceXZ,
  enemyPositionAt,
  platformCenterAt,
  stepPlayer
} from './physics.js';

/**
 * Game rules layered on top of the physics step: collectibles, checkpoints,
 * enemies, hazards, respawning and the win condition. Rendering-free so it can
 * be unit tested.
 */

export function createGameState(level, config = CONFIG) {
  return {
    level,
    config,
    time: 0,
    player: createPlayerState(level.spawn),
    respawn: { ...level.spawn },
    coinsCollected: 0,
    deaths: 0,
    status: 'playing',
    elapsed: 0
  };
}

function respawnPlayer(state) {
  state.player.position = { ...state.respawn };
  state.player.velocity = { x: 0, y: 0, z: 0 };
  state.player.grounded = false;
  state.player.jumpsUsed = 0;
  state.player.coyote = 0;
  state.player.jumpBuffer = 0;
  state.player.standingOn = null;
  state.deaths += 1;
}

/**
 * Advances the whole simulation by `dt` seconds.
 *
 * @returns {Array<{type: string, [key: string]: any}>} events for UI/audio
 */
export function updateGame(state, input, dt) {
  const events = [];
  if (state.status !== 'playing') return events;

  const { config, level, player } = state;
  state.time += dt;
  state.elapsed += dt;

  for (const name of stepPlayer(player, input, level.platforms, dt, state.time, config)) {
    events.push({ type: name });
  }

  for (const c of level.coins) {
    if (c.collected) continue;
    if (distance3(player.position, c) < config.coinRadius + config.playerHalfWidth) {
      c.collected = true;
      state.coinsCollected += 1;
      events.push({ type: 'coin', coin: c });
    }
  }

  for (const cp of level.checkpoints) {
    if (cp.reached) continue;
    if (
      distanceXZ(player.position, cp) < config.checkpointRadius &&
      Math.abs(player.position.y - cp.y) < 3
    ) {
      cp.reached = true;
      state.respawn = { x: cp.x, y: cp.y + 1, z: cp.z };
      events.push({ type: 'checkpoint', checkpoint: cp });
    }
  }

  for (const e of level.enemies) {
    if (!e.alive) continue;
    const pos = enemyPositionAt(e, state.time);
    if (distance3(player.position, pos) > config.enemyRadius + config.playerHalfHeight) continue;
    const stomping =
      player.velocity.y < config.stompVelocity &&
      player.position.y > pos.y + config.enemyRadius * 0.4;
    if (stomping) {
      e.alive = false;
      player.velocity.y = config.bounceSpeed;
      player.jumpsUsed = 1;
      events.push({ type: 'stomp', enemy: e });
    } else {
      respawnPlayer(state);
      events.push({ type: 'death', cause: 'enemy' });
      return events;
    }
  }

  for (const h of level.hazards) {
    const pos = platformCenterAt(h, state.time);
    if (distance3(player.position, pos) < h.radius + config.playerHalfWidth) {
      respawnPlayer(state);
      events.push({ type: 'death', cause: 'hazard' });
      return events;
    }
  }

  if (player.position.y < config.killPlaneY) {
    respawnPlayer(state);
    events.push({ type: 'death', cause: 'fall' });
    return events;
  }

  if (
    distanceXZ(player.position, level.goal) < config.goalRadius &&
    Math.abs(player.position.y - level.goal.y) < 4
  ) {
    state.status = 'victory';
    events.push({ type: 'victory' });
  }

  return events;
}

/** Computes a 0..1 progress value based on how far along the level the player is. */
export function levelProgress(state) {
  const goalZ = state.level.goal.z;
  const startZ = state.level.spawn.z;
  const raw = (state.player.position.z - startZ) / (goalZ - startZ);
  return Math.min(1, Math.max(0, raw));
}

/** Score used for the local best-run record. */
export function computeScore(state) {
  const coinPoints = state.coinsCollected * 100;
  const timeBonus = Math.max(0, Math.round(600 - state.elapsed * 2));
  const deathPenalty = state.deaths * 50;
  return Math.max(0, coinPoints + timeBonus - deathPenalty);
}
