import { afterEach, describe, expect, it } from 'vitest';

import { withHeadlessDecisionContext } from '@/ai/headless-decision-context.js';

describe('withHeadlessDecisionContext', () => {
  afterEach(() => {
    delete globalThis.__humanPlayerSide;
  });

  it('temporarily clears and restores an existing human side', () => {
    globalThis.__humanPlayerSide = 'self';

    const observed = withHeadlessDecisionContext(() => globalThis.__humanPlayerSide);

    expect(observed).toBeNull();
    expect(globalThis.__humanPlayerSide).toBe('self');
  });

  it('restores an explicitly present undefined property', () => {
    Object.defineProperty(globalThis, '__humanPlayerSide', {
      configurable: true,
      value: undefined,
      writable: true,
    });

    withHeadlessDecisionContext(() => undefined);

    expect('__humanPlayerSide' in globalThis).toBe(true);
    expect(globalThis.__humanPlayerSide).toBeUndefined();
  });

  it('removes the temporary property when none existed', () => {
    delete globalThis.__humanPlayerSide;

    withHeadlessDecisionContext(() => undefined);

    expect('__humanPlayerSide' in globalThis).toBe(false);
  });

  it('does not treat an inherited human side as caller-owned state', () => {
    const prototype = Object.prototype as Record<string, unknown>;
    const previous = Object.getOwnPropertyDescriptor(prototype, '__humanPlayerSide');
    Object.defineProperty(prototype, '__humanPlayerSide', {
      configurable: true,
      value: 'opp',
      writable: true,
    });

    try {
      const observed = withHeadlessDecisionContext(() => globalThis.__humanPlayerSide);

      expect(observed).toBeNull();
      expect(Object.prototype.hasOwnProperty.call(globalThis, '__humanPlayerSide')).toBe(false);
      expect(globalThis.__humanPlayerSide).toBe('opp');
    } finally {
      delete globalThis.__humanPlayerSide;
      if (previous) Object.defineProperty(prototype, '__humanPlayerSide', previous);
      else delete prototype.__humanPlayerSide;
    }
  });
});
