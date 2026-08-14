// qaId=card:D06003:e918d066190b75a908b8154f185c9c4291e8387cb2fc4797f5744acc49a362d5
// qaId=card:D06004:e918d066190b75a908b8154f185c9c4291e8387cb2fc4797f5744acc49a362d5
// qaId=card:D06010:e918d066190b75a908b8154f185c9c4291e8387cb2fc4797f5744acc49a362d5
// qaId=card:D06011:e918d066190b75a908b8154f185c9c4291e8387cb2fc4797f5744acc49a362d5
// qaId=card:D06021:e918d066190b75a908b8154f185c9c4291e8387cb2fc4797f5744acc49a362d5
// qaId=card:D06022:e918d066190b75a908b8154f185c9c4291e8387cb2fc4797f5744acc49a362d5
// qaId=card:D06023:e918d066190b75a908b8154f185c9c4291e8387cb2fc4797f5744acc49a362d5
// qaId=card:D06024:e918d066190b75a908b8154f185c9c4291e8387cb2fc4797f5744acc49a362d5
// Rules: 05, 07, 13, 15, 17, 22. This intentionally uses the public UI dispatch
// and decision path; pending-state/resolver helpers are not test drivers here.

import { beforeEach, describe, expect, it } from 'vitest';
import { D06003 } from '@/cards/ct-d06/D06003';
import { D06004 } from '@/cards/ct-d06/D06004';
import { D06010 } from '@/cards/ct-d06/D06010';
import { D06011 } from '@/cards/ct-d06/D06011';
import { D06021 } from '@/cards/ct-d06/D06021';
import { D06022 } from '@/cards/ct-d06/D06022';
import { D06023 } from '@/cards/ct-d06/D06023';
import { D06024 } from '@/cards/ct-d06/D06024';
import { B01097 } from '@/cards/ct-p01/B01097';
import { B06084 } from '@/cards/ct-p06/B06084';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = 'e918d066190b75a908b8154f185c9c4291e8387cb2fc4797f5744acc49a362d5';
const RETRIEVAL = [D06003, D06004, D06021, D06023] as const;
const DRAW = [D06010, D06011, D06022, D06024] as const;

function def(id: string, color: string, kind: 'partner' | 'character' = 'character', ap = 1000): CardDef {
  return {
    id, no: id, kind, names: [id], colors: [color], level: kind === 'character' ? 1 : 0,
    ap: kind === 'character' ? ap : 0, lp: kind === 'character' ? 1 : 3,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function stateFor(source: CardDef, partnerColor: string, caseColors = [D06003.colors[0]!, D06010.colors[0]!]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case = { cardId: 'CASE', status: 'case', requiredEvidence: 7, colors: caseColors, declaredUseCount: {} } as never;
  state.players.opp.case = { cardId: 'OPP_CASE', status: 'case', requiredEvidence: 7, colors: [], declaredUseCount: {} } as never;
  const partnerId = partnerColor === D06003.colors[0]!
    ? 'PARTNER_RED'
    : partnerColor === D06010.colors[0]!
      ? 'PARTNER_WHITE'
      : 'PARTNER_BAD';
  state.players.self.partner = { cardId: partnerId, state: 'active', location: 'partner-area' } as never;
  state.players.opp.partner = { cardId: 'OPP_PARTNER', state: 'active', location: 'partner-area' } as never;
  state.players.self.scene = [
    makeChar({ uid: 'source', cardId: source.id, state: 'active' }),
    makeChar({ uid: 'actor', cardId: 'ACTOR', state: 'active' }),
  ];
  state.players.opp.scene = [makeChar({ uid: 'target', cardId: 'TARGET', state: 'sleep' })];
  state.players.self.deck = ['DRAWN', 'REMAIN'];
  return state;
}

function declareThroughPublicUi(): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'target' })).toEqual({ ok: true });
}

function install(state: GameState): void {
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function finishActionThroughPublicUi(): void {
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  for (const card of [...RETRIEVAL, ...DRAW]) register(card);
  register(B06084);
  register(B01097);
  register(def('PARTNER_RED', D06003.colors[0]!, 'partner'));
  register(def('PARTNER_WHITE', D06010.colors[0]!, 'partner'));
  register(def('PARTNER_BAD', 'not-matching', 'partner'));
  register(def('OPP_PARTNER', 'opp', 'partner'));
  register(def('ACTOR', 'actor'));
  // AP ties still remove the defender; it takes the first contact step.
  register(def('TARGET', 'target', 'character', 7000));
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null, pendingEffectPick: null, activeActionId: null });
});

describe('D06003-D06024 official-QA public dispatch', () => {
  it(`${QA}: each a1 grants the keyword only with both case colors`, () => {
    for (const card of [...RETRIEVAL, ...DRAW]) {
      const both = stateFor(card, card === D06010 || card === D06011 || card === D06022 || card === D06024 ? D06010.colors[0]! : D06003.colors[0]!);
      expect(readChar.hasKeyword(both, 'source', '突撃'), `${card.id}:${QA}: both colors`).toBe(true);
      const onlyRed = stateFor(card, D06003.colors[0]!, [D06003.colors[0]!]);
      expect(readChar.hasKeyword(onlyRed, 'source', '突撃'), `${card.id}:${QA}: asymmetric missing white`).toBe(false);
    }
  });

  it(`${QA}: D06003/D06004/D06021/D06023 expose only the eligible AP-text cut-in and move it through the public decision`, () => {
    for (const card of RETRIEVAL) {
      const state = stateFor(card, D06003.colors[0]!);
      state.players.self.remove = ['B06084', 'B01097'];
      install(state);
      declareThroughPublicUi();
      const pending = useGameStateStore.getState().pendingEffectPick;
      expect(pending?.candidates.map((candidate) => candidate.cardId), `${card.id}:${QA}: eligible plus decoy`).toEqual(['B06084']);
      expect(dispatchEngineAction(bindPendingDecision(pending!, { type: 'effectPickResolve', pickedUid: pending!.candidates[0]!.uid })), `${card.id}:${QA}: public selection`).toEqual({ ok: true });
      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.hand, `${card.id}:${QA}: selected card enters hand`).toContain('B06084');
      expect(after.players.self.remove, `${card.id}:${QA}: decoy remains removed`).toContain('B01097');
      finishActionThroughPublicUi();
    }
  });

  it(`${QA}: retrieval printings allow public decline and honor partner color`, () => {
    for (const card of RETRIEVAL) {
      const state = stateFor(card, D06003.colors[0]!);
      state.players.self.remove = ['B06084'];
      install(state);
      declareThroughPublicUi();
      const pending = useGameStateStore.getState().pendingEffectPick;
      expect(pending?.nMin, `${card.id}:${QA}: up-to-one`).toBe(0);
      expect(dispatchEngineAction(bindPendingDecision(pending!, { type: 'effectPickResolve', pickedUid: null })), `${card.id}:${QA}: public decline`).toEqual({ ok: true });
      expect(useGameStateStore.getState().gameState?.players.self.hand, `${card.id}:${QA}: decline adds nothing`).toEqual([]);
      finishActionThroughPublicUi();

      const zero = stateFor(card, D06003.colors[0]!);
      install(zero);
      declareThroughPublicUi();
      expect(useGameStateStore.getState().pendingEffectPick, `${card.id}:${QA}: zero eligible cards needs no decision`).toBeNull();
      expect(useGameStateStore.getState().gameState?.players.self.hand, `${card.id}:${QA}: zero cards adds nothing`).toEqual([]);
      finishActionThroughPublicUi();

      const wrong = stateFor(card, 'not-matching');
      wrong.players.self.remove = ['B06084'];
      install(wrong);
      declareThroughPublicUi();
      expect(useGameStateStore.getState().pendingEffectPick, `${card.id}:${QA}: invalid partner color`).toBeNull();
      finishActionThroughPublicUi();
    }
  });

  it(`${QA}: D06010/D06011/D06022/D06024 draw one normally, deck-out empty decks, and reject wrong partner color`, () => {
    for (const card of DRAW) {
      const normal = stateFor(card, D06010.colors[0]!);
      install(normal);
      declareThroughPublicUi();
      expect(useGameStateStore.getState().gameState?.players.self.hand, `${card.id}:${QA}: draw one`).toEqual(['DRAWN']);
      expect(useGameStateStore.getState().gameState?.gameResult, `${card.id}:${QA}: nonempty draw stays nonterminal`).toBeUndefined();
      expect(useGameStateStore.getState().activeActionId, `${card.id}:${QA}: action remains publicly active`).not.toBeNull();
      finishActionThroughPublicUi();

      const empty = stateFor(card, D06010.colors[0]!);
      empty.players.self.deck = [];
      empty.players.self.remove = [];
      install(empty);
      declareThroughPublicUi();
      expect(useGameStateStore.getState().gameState?.gameResult, `${card.id}:${QA}: empty deck`).toEqual({ winner: 'opp', reason: 'deck-out' });

      const wrong = stateFor(card, 'not-matching');
      install(wrong);
      declareThroughPublicUi();
      expect(useGameStateStore.getState().gameState?.players.self.hand, `${card.id}:${QA}: invalid partner color`).toEqual([]);
      finishActionThroughPublicUi();
    }
  });

  it(`${QA}: both cohorts fire once per turn through the public action dispatcher`, () => {
    for (const card of [...RETRIEVAL, ...DRAW]) {
      const partnerColor = RETRIEVAL.includes(card as typeof RETRIEVAL[number])
        ? D06003.colors[0]!
        : D06010.colors[0]!;
      const state = stateFor(card, partnerColor);
      state.players.self.remove = ['B06084'];
      state.players.self.deck = ['DRAWN', 'NOT_DRAWN'];
      install(state);
      declareThroughPublicUi();
      const first = useGameStateStore.getState().pendingEffectPick;
      if (first) {
        expect(dispatchEngineAction(bindPendingDecision(first, { type: 'effectPickResolve', pickedUid: null })), `${card.id}:${QA}: first public resolution`).toEqual({ ok: true });
      }
      finishActionThroughPublicUi();
      const replay = structuredClone(useGameStateStore.getState().gameState!);
      // A separate effect can ready the bearer and deploy a target during this
      // turn. Preserve the bearer and its per-turn counters; the public dispatcher
      // must still reject a second trigger.
      replay.players.self.scene.find((entry) => entry.uid === 'source')!.state = 'active';
      replay.players.opp.scene = [makeChar({ uid: 'target-2', cardId: 'TARGET', state: 'sleep' })];
      install(replay);
      expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'target-2' }), `${card.id}:${QA}: second public declaration`).toEqual({ ok: true });
      expect(useGameStateStore.getState().pendingEffectPick, `${card.id}:${QA}: no second pick`).toBeNull();
      if (DRAW.includes(card as typeof DRAW[number])) {
        expect(useGameStateStore.getState().gameState?.players.self.hand, `${card.id}:${QA}: no second draw`).toEqual(['DRAWN']);
      }
      finishActionThroughPublicUi();
    }
  });
});
