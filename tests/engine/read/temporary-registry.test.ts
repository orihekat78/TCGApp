import { beforeEach, describe, expect, it } from 'vitest';
import { engine } from '@/engine';
import { declaredNameCandidates } from '@/engine/effect/declared-name-domain';
import type { CardDef } from '@/engine/types';
import { BUG_274_PARTNER } from '@/ui/fixtures/bug274PartnerFixture';

function deferred(): { promise: Promise<void>; release: () => void } {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

describe('temporary card registry overlays', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
  });

  it('keeps the newest live overlay visible when older async work completes first', async () => {
    const prior = { ...BUG_274_PARTNER, names: ['prior'] } as CardDef;
    const first = { ...BUG_274_PARTNER, names: ['first'] } as CardDef;
    const second = { ...BUG_274_PARTNER, names: ['second'] } as CardDef;
    engine.cards.register(prior);
    const firstDone = deferred();
    const secondDone = deferred();
    const firstRun = engine.cards.withTemporary(first, async () => firstDone.promise);
    const secondRun = engine.cards.withTemporary(second, async () => secondDone.promise);

    expect(engine.cards.get(BUG_274_PARTNER.id)).toBe(second);
    firstDone.release();
    await firstRun;
    expect(engine.cards.get(BUG_274_PARTNER.id)).toBe(second);
    secondDone.release();
    await secondRun;

    expect(engine.cards.get(BUG_274_PARTNER.id)).toBe(prior);
  });

  it('restores absence and hidden name candidates after the final overlapping release', async () => {
    const firstDone = deferred();
    const secondDone = deferred();
    const firstRun = engine.cards.withTemporary(BUG_274_PARTNER, async () => firstDone.promise);
    const secondRun = engine.cards.withTemporary(BUG_274_PARTNER, async () => secondDone.promise);

    firstDone.release();
    await firstRun;
    expect(engine.cards.get(BUG_274_PARTNER.id)).toBe(BUG_274_PARTNER);
    secondDone.release();
    await secondRun;

    expect(engine.cards.get(BUG_274_PARTNER.id)).toBeUndefined();
    expect(declaredNameCandidates('unrestricted')).not.toContain(BUG_274_PARTNER.names[0]);
  });
});
