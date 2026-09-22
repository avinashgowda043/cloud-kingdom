import { CONFIG } from './config.js';

/**
 * Pure gameplay physics helpers. Everything here works on plain objects so it
 * can be unit tested without a browser or a renderer.
 */

/** Returns the (possibly animated) centre of a platform at a given time. */
export function platformCenterAt(platform, time = 0) {
  const { x, y, z, motion } = platform;
  if (!motion) return { x, y, z };
  const offset = Math.sin(time * motion.speed + (motion.phase || 0)) * motion.amplitude;
  return {
    x: x + (motion.axis === 'x' ? offset : 0),
    y: y + (motion.axis === 'y' ? offset : 0),
    z: z + (motion.axis === 'z' ? offset : 0)
  };
}

/** Axis aligned bounds of a platform at a given time. */
export function platformBoundsAt(platform, time = 0) {
  const c = platformCenterAt(platform, time);
  return {
    minX: c.x - platform.w / 2,
    maxX: c.x + platform.w / 2,
    minY: c.y - platform.h / 2,
    maxY: c.y + platform.h / 2,
    minZ: c.z - platform.d / 2,
    maxZ: c.z + platform.d / 2
  };
}

/** Axis aligned bounds of the player capsule approximation. */
export function playerBounds(position, config = CONFIG) {
  return {
    minX: position.x - config.playerHalfWidth,
    maxX: position.x + config.playerHalfWidth,
    minY: position.y - config.playerHalfHeight,
    maxY: position.y + config.playerHalfHeight,
    minZ: position.z - config.playerHalfWidth,
    maxZ: position.z + config.playerHalfWidth
  };
}

export function boxesOverlap(a, b) {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
}

export function distanceXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

export function distance3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function createPlayerState(spawn) {
  return {
    position: { x: spawn.x, y: spawn.y, z: spawn.z },
    velocity: { x: 0, y: 0, z: 0 },
    grounded: false,
    coyote: 0,
    jumpBuffer: 0,
    jumpsUsed: 0,
    facing: 0,
    standingOn: null
  };
}

function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return current;
}

function resolveVertical(state, platforms, time, config, events) {
  const bounds = playerBounds(state.position, config);
  state.standingOn = null;
  for (const platform of platforms) {
    const pb = platformBoundsAt(platform, time);
    if (!boxesOverlap(bounds, pb)) continue;
    if (state.velocity.y <= 0) {
      state.position.y = pb.maxY + config.playerHalfHeight;
      if (!state.grounded) events.push('land');
      state.velocity.y = 0;
      state.grounded = true;
      state.jumpsUsed = 0;
      state.coyote = config.coyoteTime;
      state.standingOn = platform.id ?? null;
    } else {
      state.position.y = pb.minY - config.playerHalfHeight;
      state.velocity.y = 0;
    }
    bounds.minY = state.position.y - config.playerHalfHeight;
    bounds.maxY = state.position.y + config.playerHalfHeight;
  }
}

function resolveHorizontal(state, platforms, time, config, axis) {
  const key = axis === 'x' ? 'x' : 'z';
  const minKey = axis === 'x' ? 'minX' : 'minZ';
  const maxKey = axis === 'x' ? 'maxX' : 'maxZ';
  const bounds = playerBounds(state.position, config);
  for (const platform of platforms) {
    const pb = platformBoundsAt(platform, time);
    if (!boxesOverlap(bounds, pb)) continue;
    if (state.velocity[key] > 0) {
      state.position[key] = pb[minKey] - config.playerHalfWidth;
    } else if (state.velocity[key] < 0) {
      state.position[key] = pb[maxKey] + config.playerHalfWidth;
    } else {
      continue;
    }
    state.velocity[key] = 0;
    bounds[minKey] = state.position[key] - config.playerHalfWidth;
    bounds[maxKey] = state.position[key] + config.playerHalfWidth;
  }
}

/**
 * Advances the player by one fixed step.
 *
 * @param {object} state player state created by {@link createPlayerState}
 * @param {object} input `{ moveX, moveZ, jumpPressed, jumpHeld }`
 * @param {Array} platforms level platform descriptors
 * @param {number} dt delta time in seconds
 * @param {number} time absolute level time (drives moving platforms)
 * @returns {string[]} list of events emitted this step (`jump`, `doubleJump`, `land`)
 */
export function stepPlayer(state, input, platforms, dt, time, config = CONFIG) {
  const events = [];
  const control = state.grounded ? 1 : config.airControl;
  const targetX = (input.moveX || 0) * config.moveSpeed;
  const targetZ = (input.moveZ || 0) * config.moveSpeed;
  const moving = Math.abs(input.moveX || 0) > 0.01 || Math.abs(input.moveZ || 0) > 0.01;
  const rate = (moving ? config.acceleration : config.friction) * control * dt;
  state.velocity.x = approach(state.velocity.x, targetX, rate);
  state.velocity.z = approach(state.velocity.z, targetZ, rate);
  if (moving) {
    state.facing = Math.atan2(input.moveX, input.moveZ);
  }

  state.jumpBuffer = input.jumpPressed
    ? config.jumpBufferTime
    : Math.max(0, state.jumpBuffer - dt);

  if (state.jumpBuffer > 0 && (state.grounded || state.coyote > 0)) {
    state.velocity.y = config.jumpSpeed;
    state.grounded = false;
    state.coyote = 0;
    state.jumpBuffer = 0;
    state.jumpsUsed = 1;
    events.push('jump');
  } else if (state.jumpBuffer > 0 && !state.grounded && state.jumpsUsed === 1) {
    state.velocity.y = config.doubleJumpSpeed;
    state.jumpBuffer = 0;
    state.jumpsUsed = 2;
    events.push('doubleJump');
  }

  // Shorter hops when the jump key is released early.
  if (!input.jumpHeld && state.velocity.y > 0) {
    state.velocity.y += config.gravity * dt;
  }

  state.velocity.y = Math.max(state.velocity.y + config.gravity * dt, config.maxFallSpeed);

  // Ride moving platforms.
  if (state.standingOn !== null && state.standingOn !== undefined) {
    const platform = platforms.find((p) => p.id === state.standingOn);
    if (platform && platform.motion) {
      const now = platformCenterAt(platform, time);
      const before = platformCenterAt(platform, time - dt);
      state.position.x += now.x - before.x;
      state.position.y += now.y - before.y;
      state.position.z += now.z - before.z;
    }
  }

  const wasGrounded = state.grounded;
  state.grounded = false;
  state.position.y += state.velocity.y * dt;
  resolveVertical(state, platforms, time, config, events);

  state.position.x += state.velocity.x * dt;
  resolveHorizontal(state, platforms, time, config, 'x');
  state.position.z += state.velocity.z * dt;
  resolveHorizontal(state, platforms, time, config, 'z');

  if (!state.grounded) {
    state.coyote = wasGrounded ? config.coyoteTime : Math.max(0, state.coyote - dt);
    if (state.jumpsUsed === 0 && state.coyote === 0) state.jumpsUsed = 1;
  }

  return events;
}

/** Position of a patrolling enemy at a given time. */
export function enemyPositionAt(enemy, time = 0) {
  const t = (Math.sin(time * enemy.speed + (enemy.phase || 0)) + 1) / 2;
  return {
    x: enemy.from.x + (enemy.to.x - enemy.from.x) * t,
    y: enemy.from.y + (enemy.to.y - enemy.from.y) * t,
    z: enemy.from.z + (enemy.to.z - enemy.from.z) * t
  };
}
