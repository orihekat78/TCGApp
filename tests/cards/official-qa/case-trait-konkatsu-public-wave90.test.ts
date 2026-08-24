// qa: card:D11003:8a2311865e16f466ee83cb439f6283f6196812688ac3da8d1b8d1173290c37dc
// qa: card:D11004:8a2311865e16f466ee83cb439f6283f6196812688ac3da8d1b8d1173290c37dc
// qa: card:D11005:8a2311865e16f466ee83cb439f6283f6196812688ac3da8d1b8d1173290c37dc
// qa: card:D11006:8a2311865e16f466ee83cb439f6283f6196812688ac3da8d1b8d1173290c37dc
// Rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { D11003 } from '@/cards/ct-d11/D11003';
import { D11004 } from '@/cards/ct-d11/D11004';
import { D11005 } from '@/cards/ct-d11/D11005';
import { D11006 } from '@/cards/ct-d11/D11006';
import { D11021 } from '@/cards/ct-d11/D11021';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { candidates } from '@/engine/target/candidates';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar, sceneChar } from '../../helpers/fixtures';

const EXACT_CASE = 'QA_W90_EXACT_CASE';
const SHORT_ALIAS_CASE = 'QA_W90_SHORT_ALIAS_CASE';
const PLAIN_CASE = 'QA_W90_PLAIN_CASE';
const POLICE = 'QA_W90_POLICE';
const VICTIM = 'QA_W90_VICTIM';

function fixture(id: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `QA/${id}`, kind: 'character', names: [id], colors: ['黄'],
    level: 1, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...overrides,
  };
}

const FIXTURES = [
  fixture(EXACT_CASE, { kind: 'case', level: undefined, ap: undefined, lp: undefined, caseLevel: 7, traits: ['婚活パーティー'], caseTraits: ['婚活パーティー'] }),
  fixture(SHORT_ALIAS_CASE, { kind: 'case', level: undefined, ap: undefined, lp: undefined, caseLevel: 7, traits: ['婚活'], caseTraits: ['婚活'] }),
  fixture(PLAIN_CASE, { kind: 'case', level: undefined, ap: undefined, lp: undefined, caseLevel: 7, traits: [], caseTraits: [] }),
  fixture(POLICE, { traits: ['警察'] }),
  fixture(VICTIM),
];

function fileCards(count: number) {
  return Array.from({ length: count }, (_value, index) => ({ type: 'card-back' as const, cardId: `QA_W90_FILE_${index}` }));
}

function base(caseCardId: string): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case = { cardId: caseCardId, status: 'unresolved', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
  state.players.opp.scene = [makeChar({ cardId: VICTIM, uid: 'victim', state: 'active' })];
  return state;
}

function install(state: GameState, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(`qa-wave90-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave90 game state');
  return state;
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetPendingRuntimeState();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('Wave90 exact 婚活パーティー case-feature public behavior', () => {
  it('publishes the official exact case feature on D11021', () => {
    expect(D11021.traits).toContain('婚活パーティー');
    expect(D11021.caseTraits).toEqual(['婚活パーティー']);
  });

  it.each([D11003, D11004])('$id declaration accepts the exact feature and pays sleep', card => {
    const state = base(EXACT_CASE);
    state.players.self.scene = [
      makeChar({ cardId: card.id, uid: 'source', state: 'active' }),
      makeChar({ cardId: POLICE, uid: 'police', state: 'active' }),
    ];
    install(state, `${card.id}-exact`);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a2' })).toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(current().players.self.scene.find(entry => entry.uid === 'source')?.state).toBe('sleep');
    expect(useGameStateStore.getState().pendingEffectPick).toMatchObject({ source: { cardId: card.id, abilityId: 'a2' } });
  });

  it.each([D11003, D11004])('$id declaration rejects shortened and unrelated case features atomically', card => {
    for (const caseCardId of [SHORT_ALIAS_CASE, PLAIN_CASE]) {
      const state = base(caseCardId);
      state.players.self.scene = [
        makeChar({ cardId: card.id, uid: 'source', state: 'active' }),
        makeChar({ cardId: POLICE, uid: 'police', state: 'active' }),
      ];
      install(state, `${card.id}-${caseCardId}`);
      const before = current();

      expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a2' }))
        .toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toBe(before);
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    }
  });

  it.each([D11005, D11006])('$id entry opens its real removal only for the exact feature', card => {
    const state = base(EXACT_CASE);
    state.players.self.file = fileCards(8);
    state.players.self.hand = [card.id];
    install(state, `${card.id}-exact`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: card.id })).toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toMatchObject({ source: { cardId: card.id, abilityId: 'a1' } });
    expect(useGameStateStore.getState().pendingEffectPick?.candidates.some(entry => entry.uid === 'victim')).toBe(true);
  });

  it.each([D11005, D11006])('$id entry queues nothing for shortened and unrelated case features', card => {
    for (const caseCardId of [SHORT_ALIAS_CASE, PLAIN_CASE]) {
      const state = base(caseCardId);
      state.players.self.file = fileCards(8);
      state.players.self.hand = [card.id];
      install(state, `${card.id}-${caseCardId}`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: card.id })).toEqual({ ok: true });
      surfacePendingSideChannels();
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(current().players.opp.scene.map(entry => entry.uid)).toEqual(['victim']);
    }
  });

  it.each([D11005, D11006])('$id resolves its removal threshold from the source effective AP', card => {
    const state = base(EXACT_CASE);
    state.players.self.scene = [sceneChar(card.id, 'source', { apOverride: 7000, turnEffects: { apMod_turn: -2000 } })];
    state.players.opp.scene = [
      sceneChar(VICTIM, 'equal', { apOverride: 5000 }),
      sceneChar(VICTIM, 'above', { apOverride: 6000 }),
    ];
    const effect = card.abilities[0]?.effect;
    if (!effect || effect.kind !== 'atom' || !effect.args.filter) throw new Error(`${card.id} a1 filter missing`);
    const ctx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: card.id, uid: 'source', abilityId: 'a1' }, bindings: {} };
    const ref = { kind: 'pick' as const, query: { area: 'scene' as const, side: 'either' as const, filter: effect.args.filter } };

    expect(candidates(state, ref, ctx).map(entry => entry.uid).sort()).toEqual(['equal', 'source']);
  });
});
