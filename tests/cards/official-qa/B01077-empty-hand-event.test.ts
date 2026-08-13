// qaId=card:B01077:d42cf418c120cd75f5388b9a434fa679d9f97908baa2ffb6eb9152c28dcb8e5a
// Official answer: an empty opposing hand only makes the first effect a no-op;
// the executable optional character selection and Bullet grant still resolve.
import { beforeEach, describe, expect, it } from 'vitest';
import { B01077 } from '@/cards/ct-p01/B01077';
import { event } from '@/engine/event';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';

const QA_ID = 'card:B01077:d42cf418c120cd75f5388b9a434fa679d9f97908baa2ffb6eb9152c28dcb8e5a';
const FILE_BACK = { type: 'card-back' as const, cardId: 'FILE' };

function def(id: string, kind: 'partner' | 'character', color: string): CardDef {
  return {
    id,
    no: id,
    kind,
    names: [id],
    colors: [color],
    level: kind === 'character' ? 3 : 0,
    ap: kind === 'character' ? 3000 : 0,
    lp: kind === 'character' ? 1 : 3,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  } as CardDef;
}

function state(partnerId: string): GameState {
  const value = createEmptyGameState();
  value.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  value.players.self.case.colors = ['赤'];
  value.players.self.file = [FILE_BACK, FILE_BACK, FILE_BACK, FILE_BACK];
  value.players.self.hand = ['B01077'];
  value.players.self.partner = { cardId: partnerId, state: 'active', location: 'partner-area' } as never;
  return value;
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  register(B01077);
  register(def('PRED', 'partner', '赤'));
  register(def('PBLUE', 'partner', '青'));
  register(def('TGT', 'character', '赤'));
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('B01077 official Q&A — empty opposing hand does not gate the later effect', () => {
  it(`${QA_ID}: positive production handUseCard still grants Bullet`, () => {
    const value = state('PRED');
    value.players.opp.hand = [];
    const target = mutate.scene.enter(value, 'opp', 'TGT', {});

    handUseCard(value, 'self', 'B01077');
    runAllUntilEmpty(value);

    expect(value.players.self.remove, `${QA_ID}: event follows public hand-use lifecycle`).toContain('B01077');
    expect(value.players.opp.hand, `${QA_ID}: empty discard is a no-op`).toEqual([]);
    const pick = _drainPendingEffectPickSide();
    expect(pick, `${QA_ID}: executable later effect surfaces`).toBeTruthy();
    applyPickAndContinuation(value, pick!, target.uid, [target.uid]);
    runAllUntilEmpty(value);
    expect(readChar.hasKeyword(value, target.uid, 'ブレット'), `${QA_ID}: later effect resolves`).toBe(true);
  });

  it(`${QA_ID}: optional zero selection resolves without granting Bullet`, () => {
    const value = state('PRED');
    const target = mutate.scene.enter(value, 'opp', 'TGT', {});
    handUseCard(value, 'self', 'B01077');
    runAllUntilEmpty(value);
    const pick = _drainPendingEffectPickSide();
    expect(pick?.nMin, `${QA_ID}: 1枚まで permits zero`).toBe(0);
    applyPickSkipAndContinuation(value, pick!, false);
    runAllUntilEmpty(value);
    expect(readChar.hasKeyword(value, target.uid, 'ブレット'), `${QA_ID}: declined optional branch`).toBe(false);
  });

  it(`${QA_ID}: negative partner-color control suppresses the whole printed ability`, () => {
    const value = state('PBLUE');
    mutate.scene.enter(value, 'opp', 'TGT', {});
    handUseCard(value, 'self', 'B01077');
    runAllUntilEmpty(value);
    expect(_drainPendingEffectPickSide(), `${QA_ID}: 【パートナー赤】 is not satisfied`).toBeNull();
  });
});
