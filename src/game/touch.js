/**
 * Pure helpers for translating on-screen stick geometry into a clamped
 * movement axis. Kept free of DOM/Three.js dependencies so it can be unit
 * tested without a browser.
 *
 * On some mobile browsers the stick can receive a `pointerdown`/`pointermove`
 * before layout has produced a non-zero size (for example immediately after
 * an overlay becomes visible, mid-orientation-change, or while the browser
 * chrome is animating away). Dividing by a zero/near-zero radius would
 * otherwise produce `Infinity`/`NaN`, which then poisons the simulation and
 * camera state permanently (the scene renders nothing while the DOM control
 * overlay stays visible). This module guards against that.
 */

/**
 * @param {{width: number}} rect
 * @returns {number} the usable stick radius, or 0 if the rect is invalid
 */
export function stickRadius(rect) {
  const radius = (rect?.width || 0) / 2;
  return Number.isFinite(radius) && radius > 0 ? radius : 0;
}

/**
 * @param {{left: number, top: number, width: number, height: number}} rect
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{x: number, z: number, radius: number}} clamped axis in the range
 *   [-1, 1] plus the stick radius used, so callers (e.g. the knob transform)
 *   don't need to recompute it from the rect.
 */
export function computeStickAxis(rect, clientX, clientY) {
  const radius = stickRadius(rect);
  if (radius <= 0) return { x: 0, z: 0, radius };
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return { x: 0, z: 0, radius };

  const dx = (clientX - (rect.left + radius)) / radius;
  const dy = (clientY - (rect.top + radius)) / radius;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { x: 0, z: 0, radius };

  const x = Math.max(-1, Math.min(1, dx));
  const z = Math.max(-1, Math.min(1, dy));
  return { x, z, radius };
}
