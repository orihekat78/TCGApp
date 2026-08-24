// qa: card:B06020:84ecdea6c10bc908728749deacc797a85529c42aef7daa60ffe67827bc5ce34f
// qa: card:B07001:00f5ba9da78640f9b3426e46dd546e290c33fac6003248fd1ccb12ba153358b6
// qa: card:B10085:84ecdea6c10bc908728749deacc797a85529c42aef7daa60ffe67827bc5ce34f
// qa: card:B10089:84ecdea6c10bc908728749deacc797a85529c42aef7daa60ffe67827bc5ce34f
// qa: card:PR292:84ecdea6c10bc908728749deacc797a85529c42aef7daa60ffe67827bc5ce34f
// qa: card:PR298:84ecdea6c10bc908728749deacc797a85529c42aef7daa60ffe67827bc5ce34f
// Rules: 14-refresh and 21-declared-ability-cost. Exact-three costs reject partial payment.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { applyMove } from '@/ai/policy';
import { registerAll } from '@/cards';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type BaseId = 'B06020' | 'B07001' | 'B10085' | 'B10089' | 'PR292' | 'PR298';
type Row = {
  cardId: string;
  baseId: BaseId;
  abilityId: 'a1' | 'a2';
  abilityIndex: 0 | 1;
  sleeps: boolean;
  limited: boolean;
};

const PRINTINGS: Row[] = [
  { cardId: 'B06020', baseId: 'B06020', abilityId: 'a2', abilityIndex: 1, sleeps: true, limited: false },
  { cardId: 'B07001', baseId: 'B07001', abilityId: 'a1', abilityIndex: 0, sleeps: false, limited: true },
  { cardId: 'B07001P', baseId: 'B07001', abilityId: 'a1', abilityIndex: 0, sleeps: false, limited: true },
  { cardId: 'B07001P2', baseId: 'B07001', abilityId: 'a1', abilityIndex: 0, sleeps: false, limited: true },
  { cardId: 'B10085', baseId: 'B10085', abilityId: 'a1', abilityIndex: 0, sleeps: false, limited: true },
  { cardId: 'B10085P', baseId: 'B10085', abilityId: 'a1', abilityIndex: 0, sleeps: false, limited: true },
  { cardId: 'B10089', baseId: 'B10089', abilityId: 'a1', abilityIndex: 0, sleeps: false, limited: true },
  { cardId: 'PR292', baseId: 'PR292', abilityId: 'a1', abilityIndex: 0, sleeps: true, limited: false },
  { cardId: 'PR298', baseId: 'PR298', abilityId: 'a1', abilityIndex: 0, sleeps: true, limited: false },
];

const PARTNER = 'W73-PARTNER';
const SOURCE_UID = 'W73-SOURCE';
const COST_A = 'W73-COST-A';
const COST_B = 'W73-COST-B';
const COST_C = 'W73-COST-C';
const TAIL = 'W73-TAIL';
const OPP_A = 'W73-OPP-A';
const OPP_B = 'W73-OPP-B';
const OPP_C = 'W73-OPP-C';
const OPP_TAIL = 'W73-OPP-TAIL';
const BLACK_A = 'W73-BLACK-A';
const BLACK_B = 'W73-BLACK-B';
const BLACK_C = 'W73-BLACK-C';

const cutinAbility: AbilityDef = {
  id: 'cutin', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'noop', args: {} },
  description: '【カットイン】AP+1000', ruleRefs: ['rules/09-cutin-disguise.md'],
};

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id, no: id, kind, names: [id], colors: ['青'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  } as CardDef;
}

const FIXTURES: CardDef[] = [
  fixture(PARTNER, { kind: 'partner', colors: ['青', '緑', '白', '黄', '赤', '黒'], lp: 5 }),
  fixture(COST_A), fixture(COST_B), fixture(COST_C), fixture(TAIL),
  fixture(OPP_A), fixture(OPP_B), fixture(OPP_C), fixture(OPP_TAIL),
  fixture(BLACK_A, { colors: ['黒'], abilities: [cutinAbility] }),
  fixture(BLACK_B, { colors: ['黒'], abilities: [cutinAbility] }),
  fixture(BLACK_C, { colors: ['黒'], abilities: [cutinAbility] }),
];

function sourceUid(row: Row, owner: Player): string {
  return row.baseId === 'B10085' ? `partnerMR:${owner}` : SOURCE_UID;
}

function baseState(row: Row, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 7, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner = { cardId: PARTNER, state: 'active', location: 'partner-area' };
  state.players[owner].case = { ...state.players[owner].case, status: '解決編' };
  if (row.baseId === 'B10085') {
    state.players[owner].partnerAreaMR = sceneChar(row.cardId, sourceUid(row, owner));
  } else {
    state.players[owner].scene = [sceneChar(row.cardId, SOURCE_UID)];
  }
  state.players.self.deck = [];
  state.players.opp.deck = [];
  return state;
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave73 state');
  return state;
}

function install(state: GameState, label: string, human: Player): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function dispatch(row: Row, owner: Player) {
  return dispatchEngineAction({
    type: 'declaredAbility', uid: sourceUid(row, owner), abilId: row.abilityId,
    abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
  });
}

function sourceState(state: GameState, row: Row, owner: Player): string | undefined {
  return row.baseId === 'B10085'
    ? state.players[owner].partnerAreaMR?.state
    : state.players[owner].scene.find(entry => entry.uid === sourceUid(row, owner))?.state;
}

function decisionKinds(): string[] {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  return [store.pendingEffectPick, store.pendingEffectChoice, store.pendingEffectOptional]
    .filter(Boolean).map((_entry, index) => String(index));
}

function moveFor(state: GameState, row: Row, owner: Player) {
  return enumerateMoves(state, owner).find(move => (
    move.kind === 'declaredAbility'
    && move.uid === sourceUid(row, owner)
    && move.abilityId === row.abilityId
    && move.abilityOrigin === 'printed'
    && move.abilityIndex === row.abilityIndex
  ));
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

// Card-bound physical rows: B06020 B07001/P/P2 B10085/P B10089 PR292 PR298.
describe('official QA Wave73: exact-three deck costs reject incomplete payment', () => {
  it.each(PRINTINGS)('$cardId removes exactly three owner cards and preserves the tail', row => {
    const state = baseState(row, 'self');
    state.players.self.deck = [COST_A, COST_B, COST_C, TAIL];
    state.players.opp.deck = [OPP_A, OPP_B, OPP_C, OPP_TAIL];
    install(state, `${row.cardId}:wave73-positive`, 'self');

    expect(dispatch(row, 'self')).toEqual({ ok: true });
    expect(current().players.self.remove).toEqual([COST_A, COST_B, COST_C]);
    expect(current().players.self.deck).toEqual([TAIL]);
    expect(current().players.opp.deck).toEqual([OPP_A, OPP_B, OPP_C, OPP_TAIL]);
    expect(sourceState(current(), row, 'self')).toBe(row.sleeps ? 'sleep' : 'active');
  });

  it.each(PRINTINGS)('$cardId rejects owner deck sizes zero, one, and two transactionally', row => {
    for (const ownerDeck of [[], [COST_A], [COST_A, COST_B]]) {
      const state = baseState(row, 'self');
      state.players.self.deck = [...ownerDeck];
      state.players.opp.deck = [OPP_A, OPP_B, OPP_C, OPP_TAIL];
      install(state, `${row.cardId}:wave73-short-${ownerDeck.length}`, 'self');
      const before = current();
      const beforeJson = JSON.stringify(before);

      expect(dispatch(row, 'self')).toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toBe(before);
      expect(JSON.stringify(current())).toBe(beforeJson);
      expect(decisionKinds()).toEqual([]);
      if (row.limited) {
        expect(readChar.declaredUseCount(current(), sourceUid(row, 'self'), row.abilityId, {
          abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
        })).toBe(0);
      }
    }
  });

  it.each(PRINTINGS)('$cardId resolves owner relative to an opponent physical source', row => {
    const state = baseState(row, 'opp');
    state.players.opp.deck = [OPP_A, OPP_B, OPP_C, OPP_TAIL];
    state.players.self.deck = [COST_A, COST_B, COST_C, TAIL];
    install(state, `${row.cardId}:wave73-owner-opp`, 'opp');

    expect(dispatch(row, 'opp')).toEqual({ ok: true });
    expect(current().players.opp.remove).toEqual([OPP_A, OPP_B, OPP_C]);
    expect(current().players.opp.deck).toEqual([OPP_TAIL]);
    expect(current().players.self.remove).toEqual([]);
    expect(current().players.self.deck).toEqual([COST_A, COST_B, COST_C, TAIL]);
  });

  it.each(PRINTINGS)('$cardId CPU omits short payment and executes exact payment', row => {
    const short = baseState(row, 'opp');
    short.players.opp.deck = [OPP_A, OPP_B];
    short.players.self.deck = [COST_A, COST_B, COST_C, TAIL];
    expect(moveFor(short, row, 'opp')).toBeUndefined();

    const exact = baseState(row, 'opp');
    exact.players.opp.deck = [OPP_A, OPP_B, OPP_C, OPP_TAIL];
    exact.players.self.deck = [COST_A, COST_B, COST_C, TAIL];
    const move = moveFor(exact, row, 'opp');
    expect(move).toBeTruthy();
    const after = produce(exact, draft => {
      applyMove(draft, move!, 'opp');
      runAllUntilEmpty(draft);
    });
    expect(after.players.opp.remove).toEqual([OPP_A, OPP_B, OPP_C]);
    expect(after.players.opp.deck).toEqual([OPP_TAIL]);
    expect(after.players.self.deck).toEqual([COST_A, COST_B, COST_C, TAIL]);
  });

  it('B10085 exact-three payment refreshes before its printed draw', () => {
    const row = PRINTINGS.find(entry => entry.cardId === 'B10085')!;
    const state = baseState(row, 'self');
    state.players.self.deck = [BLACK_A, BLACK_B, BLACK_C];
    state.players.opp.deck = [OPP_A, OPP_B, OPP_C, OPP_TAIL];
    state.players.opp.evidence = [
      { cardId: COST_A, faceUp: true, origin: { turn: 2, via: 'effect' } },
      { cardId: COST_B, faceUp: false, origin: { turn: 3, via: 'effect' } },
    ];
    const existingEvidence = structuredClone(state.players.opp.evidence);
    install(state, 'B10085:wave73-refresh', 'self');

    expect(dispatch(row, 'self')).toEqual({ ok: true });
    expect(current().refreshCount.self).toBe(1);
    expect(current().players.self.hand).toHaveLength(1);
    expect(current().players.self.deck).toHaveLength(2);
    expect(current().players.self.remove).toEqual([]);
    expect([...current().players.self.hand, ...current().players.self.deck].sort())
      .toEqual([BLACK_A, BLACK_B, BLACK_C].sort());
    expect(current().players.opp.deck).toEqual([OPP_A, OPP_B, OPP_C, OPP_TAIL]);
    expect(current().players.opp.evidence.slice(0, existingEvidence.length)).toEqual(existingEvidence);
    expect(current().players.opp.evidence.at(-1)).toEqual({
      cardId: 'penalty-card', faceUp: false, origin: { turn: 7, via: 'refresh-penalty' },
    });
    expect(current().scratchTrace.opp).toBe('発見済');
  });
});
