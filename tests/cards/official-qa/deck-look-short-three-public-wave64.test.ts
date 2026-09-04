// qa: card:B06013:f8f6cc8737bb07a4334459a640a7b7600477d7bfa26bba8ca760517a6601ca7f
// qa: card:B06043:f8f6cc8737bb07a4334459a640a7b7600477d7bfa26bba8ca760517a6601ca7f
// qa: card:B06088:dd70a259653892d9d843c9211270cf79c9cb2eda55d5f30527545ebc60abfd6f
// qa: card:B08016:26d1831c595c626b286619cd94b54f3aa09111639cd842e8c4e06036ce67c7cf
// qa: card:B08024:f8f6cc8737bb07a4334459a640a7b7600477d7bfa26bba8ca760517a6601ca7f
// qa: card:B08094:f8f6cc8737bb07a4334459a640a7b7600477d7bfa26bba8ca760517a6601ca7f
// qa: card:PR180:26d1831c595c626b286619cd94b54f3aa09111639cd842e8c4e06036ce67c7cf
// qa: card:PR186:26d1831c595c626b286619cd94b54f3aa09111639cd842e8c4e06036ce67c7cf
// Rules: 14-refresh.md, 15-abilities-effects.md, 26-qa-deck-refresh.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const TARGET = 'W64-B06088-TARGET';
const REFRESH = 'W64-REFRESH';
const SENTINEL = 'W64-SENTINEL';
const SET_CARD = 'W64-SET-CARD';
const SET_HOST = 'W64-SET-HOST';
const DECOY = 'W64-DECOY';
const OPP_DECK = ['W64-OPP-1', 'W64-OPP-2', 'W64-OPP-3'] as const;

type Row = {
  baseId: string;
  printings: readonly string[];
  qaId: string;
  route: 'case-declared' | 'scene-declared' | 'enter';
  abilityId: string;
  target: Partial<CardDef>;
  conditionNames?: readonly string[];
  discardTail?: boolean;
  simultaneous?: boolean;
};

const ROWS: readonly Row[] = [
  {
    baseId: 'B06013', printings: ['B06013', 'B06013P'],
    qaId: 'card:B06013:f8f6cc8737bb07a4334459a640a7b7600477d7bfa26bba8ca760517a6601ca7f',
    route: 'case-declared', abilityId: 'a2', target: { names: ['工藤新一'] }, conditionNames: ['工藤新一'],
  },
  {
    baseId: 'B06043', printings: ['B06043', 'B06043P'],
    qaId: 'card:B06043:f8f6cc8737bb07a4334459a640a7b7600477d7bfa26bba8ca760517a6601ca7f',
    route: 'case-declared', abilityId: 'a2', target: { names: ['服部平次'] }, conditionNames: ['服部平次'],
  },
  {
    baseId: 'B06088', printings: ['B06088'],
    qaId: 'card:B06088:dd70a259653892d9d843c9211270cf79c9cb2eda55d5f30527545ebc60abfd6f',
    route: 'enter', abilityId: 'a1', target: { traits: ['警視庁'] },
  },
  {
    baseId: 'B08016', printings: ['B08016'],
    qaId: 'card:B08016:26d1831c595c626b286619cd94b54f3aa09111639cd842e8c4e06036ce67c7cf',
    route: 'enter', abilityId: 'a1', target: { colors: ['青'] }, discardTail: true,
  },
  {
    baseId: 'B08024', printings: ['B08024'],
    qaId: 'card:B08024:f8f6cc8737bb07a4334459a640a7b7600477d7bfa26bba8ca760517a6601ca7f',
    route: 'scene-declared', abilityId: 'a2', target: { colors: ['緑'] }, discardTail: true,
  },
  {
    baseId: 'B08094', printings: ['B08094', 'B08094P'],
    qaId: 'card:B08094:f8f6cc8737bb07a4334459a640a7b7600477d7bfa26bba8ca760517a6601ca7f',
    route: 'case-declared', abilityId: 'a2', target: { keywords: ['現場リムーブ時'] }, conditionNames: ['灰原哀'],
  },
  {
    baseId: 'PR180', printings: ['PR180'],
    qaId: 'card:PR180:26d1831c595c626b286619cd94b54f3aa09111639cd842e8c4e06036ce67c7cf',
    route: 'enter', abilityId: 'a2', target: { traits: ['FBI'] }, discardTail: true,
  },
  {
    baseId: 'PR186', printings: ['PR186'],
    qaId: 'card:PR186:26d1831c595c626b286619cd94b54f3aa09111639cd842e8c4e06036ce67c7cf',
    route: 'enter', abilityId: 'a2', target: { traits: ['FBI'] }, discardTail: true,
  },
];

function card(id: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...overrides,
  };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('Wave64 game state missing');
  return state;
}

function install(state: GameState, label = 'qa-wave64-B06088-short-deck'): void {
  endMatchSession();
  beginMatchSession('self');
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  [
    card(TARGET, { traits: ['警視庁'] }),
    card(REFRESH),
    card(SENTINEL),
    card(SET_CARD),
    card(SET_HOST),
    card(DECOY),
    ...OPP_DECK.map(id => card(id)),
  ].forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('official QA Wave64: a short top-three look delays refresh until movement', () => {
  it('publishes only B06088 selected card, then refreshes after taking the sole deck card', () => {
    const state = createEmptyGameState();
    state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case.colors = ['赤', '青', '緑', '黄', '白', '黒'];
    state.players.self.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
    state.players.self.hand = ['B06088'];
    state.players.self.deck = [TARGET];
    state.players.self.remove = [REFRESH];
    state.players.opp.deck = [...OPP_DECK];
    install(state);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: 'B06088' })).toEqual({ ok: true });
    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick?.atomVerb).toBe('deckRevealUntil');
    expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([TARGET]);
    expect(current().players.self.deck, 'looked card remains in deck during the private window').toEqual([TARGET]);
    expect(current().refreshCount.self, 'look itself cannot refresh').toBe(0);

    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve', pickedUid: pick!.candidates[0]!.uid,
    }))).toEqual({ ok: true });

    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      owner: 'self', audience: 'all', cardIds: [TARGET], lifetime: 'presentation',
      origin: 'deck-selected-card', source: { cardId: 'B06088', abilityId: 'a1' },
    });
    expect(current().players.self.hand).toContain(TARGET);
    expect(current().players.self.deck).toEqual([REFRESH]);
    expect(current().refreshCount.self).toBe(1);
    expect(current().players.opp.evidence).toHaveLength(1);
  });
});

function startPhysicalRow(row: Row, sourceId: string) {
  const targetId = `W64-TARGET-${sourceId}`;
  register(card(targetId, row.target));
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['赤', '青', '緑', '黄', '白', '黒'];
  state.players.self.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
  state.players.self.hand = [SENTINEL];
  state.players.self.deck = [targetId];
  state.players.self.remove = [REFRESH];
  state.players.opp.deck = [...OPP_DECK];

  if (row.route === 'case-declared') {
    const conditionId = `W64-CONDITION-${sourceId}`;
    register(card(conditionId, { names: [...row.conditionNames!] }));
    state.players.self.case.cardId = sourceId;
    state.players.self.case.status = '解決編';
    state.players.self.evidence = [0, 1].map(index => ({
      cardId: `W64-EVIDENCE-${sourceId}-${index}`,
      faceUp: false,
      origin: { turn: 1, via: 'effect' as const },
    }));
    state.players.self.scene = [makeChar({ cardId: conditionId, uid: `condition-${sourceId}` })];
  } else if (row.route === 'scene-declared') {
    state.players.self.scene = [
      makeChar({ cardId: sourceId, uid: 'source' }),
      makeChar({
        cardId: SET_HOST,
        uid: 'set-host',
        setCards: [{ cardId: SET_CARD, faceUp: false, instanceId: `set:${sourceId}:0` }],
      }),
    ];
  } else {
    state.players.self.hand.unshift(sourceId);
  }
  install(state, `qa-wave64-${sourceId}-short-one`);

  let authority = { uid: 'source', area: 'scene' };
  if (row.route === 'case-declared') {
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'case:self', abilId: row.abilityId,
      costParams: { flipFaceUpEvidence: { indices: [0, 1] } },
    })).toEqual({ ok: true });
    authority = { uid: 'case:self', area: 'case' };
  } else if (row.route === 'scene-declared') {
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: row.abilityId })).toEqual({ ok: true });
    const setPick = useGameStateStore.getState().pendingEffectPick;
    expect(setPick?.atomVerb).toBe('charRemoveSetCard');
    expect(dispatchEngineAction(bindPendingDecision(setPick!, {
      type: 'effectPickResolve', pickedUid: setPick!.candidates[0]!.uid,
    }))).toEqual({ ok: true });
  } else {
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: sourceId })).toEqual({ ok: true });
    const entered = current().players.self.scene.find(item => item.cardId === sourceId);
    if (!entered) throw new Error(`${sourceId}: public enter failed`);
    authority = { uid: entered.uid, area: 'scene' };
    if (row.baseId === 'PR180' || row.baseId === 'PR186') {
      expect(entered.state, `${sourceId}: inherent entry state precedes the search`).toBe('sleep');
    }
    if (row.simultaneous) {
      const group = pendingOwnerOrderGroup(current(), 'self');
      expect(group.map(entry => entry.source.abilityId).sort(), `${sourceId}: simultaneous entry effects`).toEqual(['a1', 'a2']);
      const deckLook = group.find(entry => entry.source.uid === entered.uid && entry.source.abilityId === row.abilityId)!;
      expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: deckLook.id, order: 0, player: 'self' })).toEqual({ ok: true });
      const ordered = pendingOwnerOrderGroup(current(), 'self');
      expect(dispatchEngineAction({
        type: 'resolveEffectOrder', player: 'self', entryIds: ordered.map(entry => entry.id),
      })).toEqual({ ok: true });
    }
  }

  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.atomVerb, `${sourceId}: real source reaches deck look`).toBe('deckRevealUntil');
  expect(pick?.source, `${sourceId}: physical source authority`).toMatchObject({
    cardId: sourceId, abilityId: row.abilityId, uid: authority.uid, area: authority.area,
  });
  if (row.baseId === 'PR180' || row.baseId === 'PR186') {
    expect(pick?.source, `${sourceId}: persisted search occurrence`).toMatchObject({
      abilityOrigin: 'printed', abilityIndex: 0,
    });
    expect(pendingOwnerOrderGroup(current(), 'self'), `${sourceId}: inherent sleep opens no owner order`).toEqual([]);
  }
  expect([pick?.nMin, pick?.nMax]).toEqual([0, 1]);
  expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([targetId]);
  expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
    player: 'self', visibility: 'private', viewer: 'self', revealed: [targetId], awaitingPick: true,
    source: { cardId: sourceId, abilityId: row.abilityId },
  });
  expect(current().players.self.deck, `${sourceId}: private look retains deck occurrence`).toEqual([targetId]);
  expect(current().refreshCount.self, `${sourceId}: no refresh before movement`).toBe(0);
  return { targetId, pick: pick!, authority };
}

function proveSelectedPhysicalRow(row: Row, sourceId: string) {
  const { targetId, pick, authority } = startPhysicalRow(row, sourceId);
  expect(dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve', pickedUid: pick.candidates[0]!.uid,
  }))).toEqual({ ok: true });
  // Card-bound physical rows: B06013/P B06043/P B06088 B08016 B08024 B08094/P PR180 PR186.
  const publicReveal = useGameStateStore.getState().pendingPublicHandReveal;
  expect(publicReveal, `${sourceId}: selected card becomes public`).toMatchObject({
    owner: 'self', audience: 'all', cardIds: [targetId], lifetime: 'presentation',
    origin: 'deck-selected-card', source: { cardId: sourceId, abilityId: row.abilityId },
  });
  expect(publicReveal?.cardIds, `${sourceId}: no hidden remainder disclosure`).toEqual([targetId]);

  if (row.discardTail) {
    const discard = useGameStateStore.getState().pendingEffectPick;
    expect(discard?.atomVerb, `${sourceId}: selected-only discard tail`).toBe('discard');
    const selected = discard?.candidates.find(candidate => candidate.cardId === targetId);
    expect(dispatchEngineAction(bindPendingDecision(discard!, {
      type: 'effectPickResolve', pickedUid: selected!.uid,
    }))).toEqual({ ok: true });
  }

  const result = current();
  expect(result.refreshCount.self, `${sourceId}: selected sole card refreshes immediately`).toBe(1);
  expect(result.players.opp.evidence, `${sourceId}: opponent gains refresh evidence`).toHaveLength(1);
  const refreshed = row.baseId === 'B08024' ? [REFRESH, SET_CARD] : [REFRESH];
  expect([...result.players.self.deck].sort(), `${sourceId}: remove cards form the refreshed deck`).toEqual([...refreshed].sort());
  if (row.discardTail) expect(result.players.self.remove, `${sourceId}: selected tail resolves`).toContain(targetId);
  else expect(result.players.self.hand, `${sourceId}: selected card reaches hand`).toContain(targetId);
  if (row.route === 'case-declared') expect(result.players.self.evidence.every(item => item.faceUp)).toBe(true);
  if (row.simultaneous) expect(result.players.self.scene.find(item => item.uid === authority.uid)?.state).toBe('sleep');

  useGameStateStore.getState().setPendingDeckReveal(null);
  if (useGameStateStore.getState().pendingPublicHandReveal) useGameStateStore.getState().setPendingPublicHandReveal(null);
  expect(useGameStateStore.getState().pendingEffectPick, `${sourceId}: no unresolved pick`).toBeNull();
  expect(useGameStateStore.getState().pendingDeckReorder, `${sourceId}: no empty remainder reorder`).toBeNull();
  expect(current().pendingEffects.every(entry => entry.state === 'resolved'), `${sourceId}: effect stack resolves`).toBe(true);
  return sourceId;
}

describe('official QA Wave64: every physical top-three source uses the short-deck boundary', () => {
  for (const row of ROWS) {
    it(row.qaId, () => {
      expect(row.printings.map(sourceId => proveSelectedPhysicalRow(row, sourceId))).toEqual([...row.printings]);
    });
  }
});

function startB06088Window(deck: string[], remove: string[] = [REFRESH]) {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['赤', '青', '緑', '黄', '白', '黒'];
  state.players.self.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
  state.players.self.hand = ['B06088'];
  state.players.self.deck = [...deck];
  state.players.self.remove = [...remove];
  state.players.opp.deck = [...OPP_DECK];
  install(state, `qa-wave64-B06088-${deck.join('-')}`);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: 'B06088' })).toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.atomVerb).toBe('deckRevealUntil');
  return pick!;
}

describe('official QA Wave64: representative short-deck boundaries', () => {
  it.each(['PR180', 'PR186'])('%s enters asleep even when an effect requests active entry', sourceId => {
    const state = createEmptyGameState();
    const entered = mutate.scene.enter(state, 'self', sourceId, { active: true });
    expect(entered.state).toBe('sleep');
  });

  it('keeps an eligible sole card in deck when its owner declines', () => {
    const pick = startB06088Window([TARGET]);
    expect(pick.candidates.map(candidate => candidate.cardId)).toEqual([TARGET]);
    expect(dispatchEngineAction(bindPendingDecision(pick, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });

    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
    expect(current().players.self.deck).toEqual([TARGET]);
    expect(current().players.self.hand).not.toContain(TARGET);
    expect(current().players.self.remove).toEqual([REFRESH]);
    expect(current().refreshCount.self).toBe(0);
    expect(current().players.opp.evidence).toHaveLength(0);
  });

  it('returns a one-card no-match window without refresh or a stalled choice', () => {
    const pick = startB06088Window([DECOY]);
    expect([pick.nMin, pick.nMax]).toEqual([0, 0]);
    expect(pick.candidates).toEqual([]);
    expect(dispatchEngineAction(bindPendingDecision(pick, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });

    expect(current().players.self.deck).toEqual([DECOY]);
    expect(current().players.self.hand).not.toContain(DECOY);
    expect(current().refreshCount.self).toBe(0);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it('looks at a two-card short deck and moves only the selected card without refresh', () => {
    const pick = startB06088Window([TARGET, DECOY]);
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      revealed: [TARGET, DECOY], awaitingPick: true,
    });
    expect(dispatchEngineAction(bindPendingDecision(pick, {
      type: 'effectPickResolve', pickedUid: pick.candidates[0]!.uid,
    }))).toEqual({ ok: true });

    expect(useGameStateStore.getState().pendingPublicHandReveal?.cardIds).toEqual([TARGET]);
    expect(current().players.self.hand).toContain(TARGET);
    expect(current().players.self.deck).toEqual([DECOY]);
    expect(current().players.self.remove).toEqual([REFRESH]);
    expect(current().refreshCount.self).toBe(0);
    expect(current().players.opp.evidence).toHaveLength(0);
  });

  it('takes the sole card, then loses when no remove card can refresh the empty deck', () => {
    const pick = startB06088Window([TARGET], []);
    expect(dispatchEngineAction(bindPendingDecision(pick, {
      type: 'effectPickResolve', pickedUid: pick.candidates[0]!.uid,
    }))).toEqual({ ok: true });

    expect(current().players.self.hand).toContain(TARGET);
    expect(current().players.self.deck).toEqual([]);
    expect(current().refreshCount.self).toBe(0);
    expect(current().gameResult).toEqual({ winner: 'opp', reason: 'deck-out' });
  });

  it('keeps a CPU one-card look private but publishes its selected card and refreshes its own deck', () => {
    const target = 'W64-OPP-TARGET';
    register(card(target, { traits: ['警視庁'] }));
    const state = createEmptyGameState();
    state.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.case.colors = ['赤', '青', '緑', '黄', '白', '黒'];
    state.players.opp.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
    state.players.opp.hand = ['B06088'];
    state.players.opp.deck = [target];
    state.players.opp.remove = [REFRESH];
    state.players.self.deck = [...OPP_DECK];
    install(state, 'qa-wave64-B06088-opp-short-one');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'opp', cardId: 'B06088' })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingDeckReveal).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      owner: 'opp', audience: 'all', cardIds: [target], origin: 'deck-selected-card',
      source: { cardId: 'B06088', abilityId: 'a1' },
    });
    expect(current().players.opp.hand).toContain(target);
    expect(current().players.opp.deck).toEqual([REFRESH]);
    expect(current().refreshCount.opp).toBe(1);
    expect(current().players.self.evidence).toHaveLength(1);
  });
});
