// Phase 4 Task 4.3 — flow.main.runNextHint
// rules: 12-next-hint.md, 20-color-and-switch.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { canStartNextHint, runNextHint } from '@/engine/flow/main/next-hint';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, GameState } from '@/engine/types';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: opts.kind ?? 'event',
    names: opts.names ?? [id],
    colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1,
    traits: opts.traits ?? [],
    rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '',
    abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

function makeStateWithFile(n: number, opts: { caseColors?: string[]; hand?: string[] } = {}): GameState {
  const initial = createEmptyGameState();
  return produce(initial, draft => {
    draft.players.self.case.colors = opts.caseColors ?? ['赤'];
    draft.players.self.case.cardId = 'CASE';
    for (let i = 0; i < n; i++) {
      draft.players.self.file.push({ type: 'card-back' });
    }
    draft.players.self.hand = opts.hand ?? [];
  });
}

describe('engine.flow.main.runNextHint', () => {
  beforeEach(() => {
    event._resetRegistry();
    resetDefRegistry();
  });

  it('FILE ≥ 1 で canStartNextHint=true', () => {
    const s = makeStateWithFile(1);
    expect(canStartNextHint(s, 'self')).toBe(true);
  });

  it('FILE=0 で canStartNextHint=false', () => {
    const s = makeStateWithFile(0);
    expect(canStartNextHint(s, 'self')).toBe(false);
  });

  it('FILE 上のカード (card-back) を手札に加え、フラグをセットする', () => {
    const s = makeStateWithFile(3);
    const after = produce(s, draft => {
      runNextHint(draft, 'self');
    });
    expect(after.players.self.file).toHaveLength(2);
    expect(after.players.self.hand).toContain('card-back');
    expect(after.turnState.self.nextHintUsed).toBe(true);
  });

  it('canStartNextHint=false で runNextHint → throw', () => {
    const s = makeStateWithFile(0);
    expect(() =>
      produce(s, draft => {
        runNextHint(draft, 'self');
      }),
    ).toThrow(/not startable/);
  });

  it('optionalCardId で 1 枚追加使用する (effect:declared 発火)', () => {
    registerCardDef(makeCard('EV1', { colors: ['赤'], level: 1 }));
    let fired = 0;
    event.on('effect:declared', (_s, payload) => {
      const p = payload as { kind: string };
      if (p && p.kind === 'nextHintCardUse') fired++;
    });
    const s = makeStateWithFile(2, { hand: ['EV1'] });
    const after = produce(s, draft => {
      runNextHint(draft, 'self', 'EV1');
    });
    expect(fired).toBe(1);
    expect(after.turnState.self.nextHintUsed).toBe(true);
  });

  it('optionalCardId が手札にない → throw', () => {
    const s = makeStateWithFile(2);
    expect(() =>
      produce(s, draft => {
        runNextHint(draft, 'self', 'NONEXISTENT');
      }),
    ).toThrow(/not in self hand/);
  });

  it('optionalCardId 色違反 → throw (rules/20)', () => {
    registerCardDef(makeCard('EV1', { colors: ['青'], level: 1 }));
    const s = makeStateWithFile(2, { caseColors: ['赤'], hand: ['EV1'] });
    expect(() =>
      produce(s, draft => {
        runNextHint(draft, 'self', 'EV1');
      }),
    ).toThrow(/color violates/);
  });

  it('optionalCardId レベル超過 → throw (rules/12)', () => {
    // FILE=2 だが、1 枚 popした後で 1 枚に減るので、level 2 のカードは使用不可
    registerCardDef(makeCard('EV2', { colors: ['赤'], level: 2 }));
    const s = makeStateWithFile(2, { hand: ['EV2'] });
    expect(() =>
      produce(s, draft => {
        runNextHint(draft, 'self', 'EV2');
      }),
    ).toThrow(/level/);
  });

  it('アシスト中パートナーのみ FILE にあれば canStartNextHint=false', () => {
    const s = makeStateWithFile(0);
    const s1 = produce(s, draft => {
      draft.players.self.file.push({ type: 'assisted-partner', cardId: 'P-SELF' });
    });
    expect(canStartNextHint(s1, 'self')).toBe(false);
  });
});
