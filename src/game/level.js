/**
 * Level data for Cloud Kingdom. Pure data + helpers, no rendering code, so the
 * level can be validated by unit tests.
 */

let nextId = 0;
const id = () => `p${nextId++}`;

/** Creates a platform whose *top* surface sits at `top`. */
function island(x, top, z, w, d, options = {}) {
  const h = options.h ?? 1.2;
  return {
    id: id(),
    x,
    y: top - h / 2,
    z,
    w,
    d,
    h,
    color: options.color ?? 0x6fd3ff,
    grassColor: options.grassColor ?? 0xa8f0a0,
    motion: options.motion ?? null
  };
}

function coin(x, y, z) {
  return { id: id(), x, y, z, collected: false };
}

function enemy(from, to, speed, phase = 0) {
  return { id: id(), from, to, speed, phase, alive: true };
}

function hazard(x, y, z, options = {}) {
  return {
    id: id(),
    x,
    y,
    z,
    radius: options.radius ?? 0.9,
    motion: options.motion ?? null
  };
}

function checkpoint(x, y, z) {
  return { id: id(), x, y, z, reached: false };
}

/**
 * Builds a fresh, mutable copy of the level. Call it again to restart a run.
 */
export function createLevel() {
  nextId = 0;

  const platforms = [
    island(0, 0, 0, 12, 12),
    island(0, 0, 13, 7, 7),
    island(0, 1.5, 21, 6, 6),
    island(-3.5, 3, 28, 5, 5),
    island(0, 3, 35, 4.5, 4.5, {
      motion: { axis: 'x', amplitude: 4.5, speed: 0.8 }
    }),
    island(3.5, 4.5, 42, 5, 5),
    island(0, 6, 48, 3.4, 3.4),
    island(-4, 7.5, 53, 3.4, 3.4),
    island(0, 7.5, 59, 7, 7),
    island(0, 7.5, 66, 4.2, 4.2, {
      motion: { axis: 'y', amplitude: 2.6, speed: 0.9 }
    }),
    island(4.5, 9, 72, 4.5, 4.5),
    island(1.5, 9.5, 78, 3, 3),
    island(-2, 10.5, 83, 3, 3),
    island(1, 11, 88, 3, 3),
    island(0, 11, 94, 7, 7),
    island(-4.5, 12.5, 101, 4, 4),
    island(0, 14, 107, 4, 4, {
      motion: { axis: 'x', amplitude: 3.5, speed: 1.05, phase: Math.PI / 2 }
    }),
    island(4.5, 15.5, 113, 4, 4),
    island(0, 16.5, 120, 9, 9, { color: 0xffd479, grassColor: 0xffe9a8 })
  ];

  const coins = [
    coin(0, 1.6, 6),
    coin(-1.5, 1.6, 13),
    coin(1.5, 1.6, 13),
    coin(0, 3.2, 21),
    coin(-3.5, 4.6, 28),
    coin(0, 5.2, 31.5),
    coin(0, 4.8, 35),
    coin(3.5, 6.2, 42),
    coin(0, 7.7, 48),
    coin(-4, 9.2, 53),
    coin(-2, 9.2, 59),
    coin(2, 9.2, 59),
    coin(0, 10.4, 66),
    coin(4.5, 10.7, 72),
    coin(1.5, 11.2, 78),
    coin(-2, 12.2, 83),
    coin(1, 12.7, 88),
    coin(0, 12.7, 94),
    coin(-4.5, 14.2, 101),
    coin(0, 15.7, 107),
    coin(4.5, 17.2, 113),
    coin(-2, 18.2, 120),
    coin(2, 18.2, 120),
    coin(0, 18.2, 124)
  ];

  const enemies = [
    enemy({ x: -2, y: 0.9, z: 13 }, { x: 2, y: 0.9, z: 13 }, 1.1),
    enemy({ x: 2, y: 5.4, z: 42 }, { x: 5, y: 5.4, z: 42 }, 1.3, 1.2),
    enemy({ x: -2.5, y: 8.4, z: 57 }, { x: 2.5, y: 8.4, z: 61 }, 0.9),
    enemy({ x: -2.5, y: 11.9, z: 92 }, { x: 2.5, y: 11.9, z: 96 }, 1.25, 0.6),
    enemy({ x: 3, y: 9.9, z: 72 }, { x: 6, y: 9.9, z: 72 }, 1.5, 2.1)
  ];

  const hazards = [
    hazard(0, 3.6, 24.5, { motion: { axis: 'x', amplitude: 3, speed: 1.4 } }),
    hazard(0, 8.6, 62.5, { motion: { axis: 'x', amplitude: 3.4, speed: 1.6 } }),
    hazard(2.5, 12, 85.5, { motion: { axis: 'y', amplitude: 1.6, speed: 1.8 } }),
    hazard(-2, 15.5, 110, { motion: { axis: 'x', amplitude: 3.2, speed: 1.7 } })
  ];

  const checkpoints = [
    checkpoint(-3.5, 3.9, 28),
    checkpoint(0, 8.4, 59),
    checkpoint(0, 11.9, 94)
  ];

  return {
    spawn: { x: 0, y: 1.5, z: -3 },
    platforms,
    coins,
    enemies,
    hazards,
    checkpoints,
    goal: { x: 0, y: 18, z: 122 },
    totalCoins: coins.length
  };
}

/** Resets a level in place so a new run can start without rebuilding meshes. */
export function resetLevel(level) {
  level.coins.forEach((c) => {
    c.collected = false;
  });
  level.enemies.forEach((e) => {
    e.alive = true;
  });
  level.checkpoints.forEach((cp) => {
    cp.reached = false;
  });
  return level;
}
