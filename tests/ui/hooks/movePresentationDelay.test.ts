import { describe, expect, it } from 'vitest';
import { movePresentationDelay } from '@/ui/hooks/movePresentationDelay';

describe('movePresentationDelay', () => {
  it.each([
    'handUseCard',
    'handUseCardSwitch',
    'declaredAbility',
    'partnerAbility',
    'actionAgainstChar',
    'actionAgainstCase',
    'assist',
    'solveCase',
  ] as const)('keeps the configured dwell after important move %s', (kind) => {
    expect(movePresentationDelay(kind, 400)).toBe(400);
  });

  it.each(['reasoning', 'startNextHint', 'endTurn'] as const)(
    'yields without fixed dwell after routine move %s',
    (kind) => {
      expect(movePresentationDelay(kind, 400)).toBe(0);
    },
  );

  it('does not delay before the first move', () => {
    expect(movePresentationDelay(null, 400)).toBe(0);
  });
});
