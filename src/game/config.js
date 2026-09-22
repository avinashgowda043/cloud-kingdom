/**
 * Tunable gameplay constants. Kept free of Three.js imports so that the pure
 * gameplay logic (and its unit tests) can run in plain Node.
 */
export const CONFIG = {
  gravity: -26,
  maxFallSpeed: -32,
  moveSpeed: 8.5,
  airControl: 0.55,
  acceleration: 55,
  friction: 14,
  jumpSpeed: 11,
  doubleJumpSpeed: 9.5,
  bounceSpeed: 12,
  coyoteTime: 0.12,
  jumpBufferTime: 0.14,
  playerHalfWidth: 0.38,
  playerHalfHeight: 0.7,
  killPlaneY: -22,
  goalRadius: 1.8,
  coinRadius: 1.0,
  checkpointRadius: 1.6,
  enemyRadius: 0.75,
  stompVelocity: -1.5,
  cameraDistance: 11,
  cameraHeight: 5.5,
  cameraLerp: 6
};
