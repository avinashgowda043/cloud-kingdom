import { describe, expect, it } from 'vitest';
import { computeStickAxis, stickRadius } from '../src/game/touch.js';

const rect = (overrides = {}) => ({ left: 100, top: 100, width: 120, height: 120, ...overrides });

describe('computeStickAxis', () => {
  it('returns a centred neutral axis when the pointer is at the stick centre', () => {
    const r = rect();
    expect(computeStickAxis(r, 160, 160)).toEqual({ x: 0, z: 0, radius: 60 });
  });

  it('clamps to the unit circle at the edges and beyond', () => {
    const r = rect();
    expect(computeStickAxis(r, 220, 160)).toEqual({ x: 1, z: 0, radius: 60 });
    expect(computeStickAxis(r, 1000, 160)).toEqual({ x: 1, z: 0, radius: 60 });
    expect(computeStickAxis(r, 100, 40)).toEqual({ x: -1, z: -1, radius: 60 });
  });

  it('returns neutral instead of NaN/Infinity when the rect has zero width', () => {
    // Reproduces a pointerdown/pointermove landing before layout has run
    // (e.g. right after the overlay becomes visible, or mid orientation
    // change) which previously divided by a zero radius.
    expect(computeStickAxis(rect({ width: 0 }), 160, 160)).toEqual({ x: 0, z: 0, radius: 0 });
  });

  it('returns neutral for a missing/undefined rect', () => {
    expect(computeStickAxis(undefined, 160, 160)).toEqual({ x: 0, z: 0, radius: 0 });
  });

  it('returns neutral for non-finite pointer coordinates', () => {
    const r = rect();
    expect(computeStickAxis(r, NaN, 160)).toEqual({ x: 0, z: 0, radius: 60 });
    expect(computeStickAxis(r, Infinity, 160)).toEqual({ x: 0, z: 0, radius: 60 });
    expect(computeStickAxis(r, 160, -Infinity)).toEqual({ x: 0, z: 0, radius: 60 });
  });

  it('returns neutral for a negative/non-finite rect width', () => {
    expect(computeStickAxis(rect({ width: -10 }), 160, 160)).toEqual({ x: 0, z: 0, radius: 0 });
    expect(computeStickAxis(rect({ width: NaN }), 160, 160)).toEqual({ x: 0, z: 0, radius: 0 });
  });
});

describe('stickRadius', () => {
  it('returns half the rect width', () => {
    expect(stickRadius(rect())).toBe(60);
  });

  it('returns 0 for invalid or missing rects', () => {
    expect(stickRadius(rect({ width: 0 }))).toBe(0);
    expect(stickRadius(rect({ width: -10 }))).toBe(0);
    expect(stickRadius(rect({ width: NaN }))).toBe(0);
    expect(stickRadius(undefined)).toBe(0);
  });
});
