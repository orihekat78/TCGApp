import { beforeEach, describe, expect, it } from 'vitest';
import { PR099 } from '@/cards/pr-01/PR099';
import { PR105 } from '@/cards/pr-01/PR105';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import {
  canActivateDeclaredAbility,
  useDeclaredAbility,
} from '@/engine/flow/main/declared-ability';
import { mutate } from '@/engine/mutate';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { CardDef, GameState } from '@/engine/types';

const ALLOWED_NAME = '毛利小五郎';
const EVENT_NAME = '黒の組織の事件';

function fixture(id: string, kind: CardDef['kind'], name: string): CardDef {
  return {
    id,
    no: id,
    kind,
    names: [name],
    colors: ['青'],
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...(kind === 'character' ? { level: 1, ap: 1000, lp: 1 } : {}),
  } as CardDef;
}

function board(card: CardDef): { state: GameState; uid: string } {
  const state = createEmptyGameState();
  state.turn = {
    number: 2,
    player: 'self',
    phase: 'main',
    isFirstPlayerFirstTurn: false,
  };
  const source = mutate.scene.enter(state, 'self', card.id, { active: true });
  return { state, uid: source.uid };
}

describe('PR099 registered-character name declaration', () => {
  beforeEach(() => {
    _resetRegistry();
    event._resetRegistry();
    _resetUidCounter();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    [
      PR099,
      PR105,
      fixture('ALLOWED', 'character', ALLOWED_NAME),
      fixture('MOURI_KOGORO', 'character', '毛利小五郎'),
      fixture('MOURI_RAN', 'character', '毛利蘭'),
      fixture('EVENT', 'event', EVENT_NAME),
    ].forEach(register);
  });

  it('canonicalizes a uniquely identifying abbreviation before applying the name', () => {
    const { state, uid } = board(PR099);
    expect(canActivateDeclaredAbility(state, uid, 'a2', { declaredName: '  小五郎  ' })).toBe(true);
    activateDeclaredAbility(state, uid, 'a2', { declaredName: '  小五郎  ' });
    runAllUntilEmpty(state);
    expect(readChar.names(state, uid)).toEqual(['毛利小五郎']);
  });

  it('rejects an abbreviation that can identify multiple character names', () => {
    const { state, uid } = board(PR099);
    expect(canActivateDeclaredAbility(state, uid, 'a2', { declaredName: '毛利' })).toBe(false);
    activateDeclaredAbility(state, uid, 'a2', { declaredName: '毛利' });
    expect(readChar.declaredUseCount(state, uid, 'a2', { abilityOrigin: 'printed', abilityIndex: 1 })).toBe(0);
    expect(state.pendingEffects).toHaveLength(0);
  });

  it('accepts a registered character name and applies AP/name changes', () => {
    const { state, uid } = board(PR099);
    expect(canActivateDeclaredAbility(state, uid, 'a2', { declaredName: ALLOWED_NAME })).toBe(true);
    activateDeclaredAbility(state, uid, 'a2', { declaredName: ALLOWED_NAME });
    runAllUntilEmpty(state);
    expect(readChar.ap(state, uid)).toBe(6000);
    expect(readChar.names(state, uid)).toEqual([ALLOWED_NAME]);
    expect(readChar.declaredUseCount(state, uid, 'a2', { abilityOrigin: 'printed', abilityIndex: 1 })).toBe(1);
  });

  it('allows the optional declaration to be skipped while retaining AP+1000', () => {
    const { state, uid } = board(PR099);
    expect(canActivateDeclaredAbility(state, uid, 'a2')).toBe(true);
    activateDeclaredAbility(state, uid, 'a2');
    runAllUntilEmpty(state);
    expect(readChar.ap(state, uid)).toBe(6000);
    expect(readChar.names(state, uid)).toEqual(PR099.names);
  });

  it('normalizes whitespace-only optional input to a public skip without a name mutation', () => {
    const { state, uid } = board(PR105);
    expect(canActivateDeclaredAbility(state, uid, 'a2', { declaredName: '   ' })).toBe(true);
    activateDeclaredAbility(state, uid, 'a2', { declaredName: '   ' });
    runAllUntilEmpty(state);
    expect(readChar.ap(state, uid)).toBe(6000);
    expect(readChar.names(state, uid)).toEqual(PR105.names);
    expect(readChar.declaredUseCount(state, uid, 'a2', { abilityOrigin: 'printed', abilityIndex: 1 })).toBe(1);
    expect(state.players.self.scene.find((candidate) => candidate.uid === uid)?.turnEffects?.nameOverride)
      .toBeUndefined();
  });

  it.each([EVENT_NAME, '未登録の名前'])(
    'rejects %s before count, log, event, or queue mutation',
    (invalidName) => {
      const { state, uid } = board(PR099);
      expect(canActivateDeclaredAbility(state, uid, 'a2', { declaredName: invalidName })).toBe(false);
      const beforeLog = state.log.length;
      activateDeclaredAbility(state, uid, 'a2', { declaredName: invalidName });
      expect(readChar.ap(state, uid)).toBe(5000);
      expect(readChar.declaredUseCount(state, uid, 'a2', { abilityOrigin: 'printed', abilityIndex: 1 })).toBe(0);
      expect(state.pendingEffects).toHaveLength(0);
      expect(state.log).toHaveLength(beforeLog);

      useDeclaredAbility(state, uid, 'a2', { dyn: { declaredName: invalidName } });
      expect(readChar.declaredUseCount(state, uid, 'a2', { abilityOrigin: 'printed', abilityIndex: 1 })).toBe(0);
      expect(state.pendingEffects).toHaveLength(0);
      expect(state.log).toHaveLength(beforeLog);
    },
  );

  it('keeps PR099 and PR105 on one constrained declaration descriptor', () => {
    const pr099 = PR099.abilities.find((ability) => ability.id === 'a2');
    const pr105 = PR105.abilities.find((ability) => ability.id === 'a2');
    expect(pr099?.effect).toEqual(pr105?.effect);
  });
});
