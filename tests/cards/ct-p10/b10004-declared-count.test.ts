import { beforeEach, describe, expect, it } from 'vitest';
import { REUSE_CARDS } from '@/cards';
import { B10004, B10004P } from '@/cards/ct-p10/B10004';
import { applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canActivateDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { _resetRegistry, register } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';

const PARTNER: CardDef = {
  id: 'B10004_PARTNER', no: 'B10004_PARTNER', kind: 'partner', names: ['Blue partner'], colors: ['青'], level: 0, ap: 0, lp: 3,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

const SOCCER: CardDef = {
  id: 'B10004_SOCCER', no: 'B10004_SOCCER', kind: 'character', names: ['Soccer teammate'], colors: ['青'], level: 1, ap: 1000, lp: 1,
  traits: ['サッカー選手'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

function stateFor(card: CardDef = B10004, includeAssist = true): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner = { cardId: PARTNER.id, state: 'sleep', location: 'file-area' };
  state.players.self.file = [
    ...Array.from({ length: 4 }, (_value, index) => ({ type: 'card-back' as const, cardId: `FILE_${index}` })),
    ...(includeAssist ? [{ type: 'assisted-partner' as const, cardId: PARTNER.id }] : []),
  ];
  state.players.self.scene = [
    sceneChar(card.id, 'host'),
    sceneChar(SOCCER.id, 'teammate'),
  ];
  return state;
}

function addSetCard(state: GameState, instance: number): void {
  state.players.self.scene[0]!.setCards.push({ cardId: `SET_${instance}`, faceUp: false, instanceId: `set-${instance}` });
}

function canActivate(state: GameState): boolean {
  return canActivateDeclaredAbility(state, 'host', 'a2', undefined, { allowImplicitPhysicalCostSelection: true });
}

function activateWithZeroTarget(state: GameState, instance: number): void {
  addSetCard(state, instance);
  expect(canActivate(state)).toBe(true);
  activateDeclaredAbility(state, 'host', 'a2');
  runAllUntilEmpty(state);
  const pending = _drainPendingEffectPickSide();
  expect(pending).toMatchObject({ atomVerb: 'sceneRemove', nMin: 0 });
  applyPickSkipAndContinuation(state, pending!, false);
  runAllUntilEmpty(state);
}

beforeEach(() => {
  _resetRegistry();
  _clearPendingEffectPickQueue();
  [B10004, B10004P, PARTNER, SOCCER].forEach(register);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('CT-P10 B10004 declared-use evidence threshold', () => {
  it('counts zero-target declarations and gains evidence exactly on the third use', () => {
    expect(B10004.abilities.find((ability) => ability.id === 'a2')).toMatchObject({ limit: { kind: 'turn', n: 3 } });
    const state = stateFor();

    activateWithZeroTarget(state, 1);
    expect(readChar.declaredUseCount(state, 'host', 'a2')).toBe(1);
    expect(state.players.self.evidence).toHaveLength(0);

    activateWithZeroTarget(state, 2);
    expect(readChar.declaredUseCount(state, 'host', 'a2')).toBe(2);
    expect(state.players.self.evidence).toHaveLength(0);

    activateWithZeroTarget(state, 3);
    expect(readChar.declaredUseCount(state, 'host', 'a2')).toBe(3);
    expect(state.players.self.evidence).toHaveLength(1);

    addSetCard(state, 4);
    expect(canActivate(state)).toBe(false);
  });

  it('counts an assisted partner toward FILE5 and requires another soccer player', () => {
    const assisted = stateFor();
    addSetCard(assisted, 1);
    // qa: card:B10004:0b717e7ed550284fdf464f7f33e6c412c355fb6b492d66373c2469c1fb4f771b
    expect(canActivate(assisted)).toBe(true);

    const noAssist = stateFor(B10004, false);
    addSetCard(noAssist, 1);
    expect(canActivate(noAssist)).toBe(false);

    const noTeammate = stateFor();
    addSetCard(noTeammate, 1);
    noTeammate.players.self.scene = [noTeammate.players.self.scene[0]!];
    expect(canActivate(noTeammate)).toBe(false);
  });

  it('keeps the P printing behavior-identical while preserving its metadata', () => {
    expect({ ...B10004P, id: B10004.id, no: B10004.no, rarity: B10004.rarity, imageUrl: B10004.imageUrl }).toEqual(B10004);
    expect(B10004P).toMatchObject({ id: 'B10004P', no: '1066/B10004P', rarity: 'RP', imageUrl: '1783904055275337.jpg' });
  });

  it('registers each printed ID exactly once', () => {
    const printings = REUSE_CARDS.filter((card) => card.id === 'B10004' || card.id === 'B10004P');
    expect(printings.map((card) => card.id)).toEqual(['B10004', 'B10004P']);
  });
});
