// qa: card:B07073:257729bded9735287561b957a296000c9fdd1c284ccc9cac5e5c978452befe69
// qa: card:B08020:257729bded9735287561b957a296000c9fdd1c284ccc9cac5e5c978452befe69
// qa: card:B08071:035b6b0e1e54080eb5aa7a0608114bc0c89e8901359b53714c37e416fed9e98b
// qa: card:B08075:59a856a1d72daa0022faa757fb164e31426c4854723043edfe6a1079450740ad
// qa: card:B09074:257729bded9735287561b957a296000c9fdd1c284ccc9cac5e5c978452befe69
// qa: card:B10010:257729bded9735287561b957a296000c9fdd1c284ccc9cac5e5c978452befe69
// qa: card:B10039:257729bded9735287561b957a296000c9fdd1c284ccc9cac5e5c978452befe69
// qa: card:B10054:657dafe95083ad08981b7610e34d651ff4ade221a78bb2a0482884c4475c0ff7
// qa: card:B10096:c34fb03dbba3939eb1b2e8e0666f56e3b7fc1073dbdb3535cda372611db4dc52
// Rules: 14-refresh.md, 15-abilities-effects.md, 26-qa-deck-refresh.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
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

type Row = {
  baseId: string;
  printings: readonly string[];
  qaId: string;
  abilityId: string;
  target: Partial<CardDef>;
  caseColors?: readonly string[];
  preDiscard?: boolean;
  simultaneous?: boolean;
  extraRefresh?: boolean;
};

const REFRESH = 'W65-REFRESH';
const REFRESH_TWO = 'W65-REFRESH-TWO';
const SENTINEL = 'W65-SENTINEL';
const PAY = 'W65-PAY';
const OPP_DECK = ['W65-OPP-1', 'W65-OPP-2', 'W65-OPP-3'] as const;

const ROWS: readonly Row[] = [
  {
    baseId: 'B07073', printings: ['B07073', 'B07073P'],
    qaId: 'card:B07073:257729bded9735287561b957a296000c9fdd1c284ccc9cac5e5c978452befe69',
    abilityId: 'a2', target: { colors: ['赤'] }, preDiscard: true,
  },
  {
    baseId: 'B08020', printings: ['B08020', 'B08020P'],
    qaId: 'card:B08020:257729bded9735287561b957a296000c9fdd1c284ccc9cac5e5c978452befe69',
    abilityId: 'a1', target: { kind: 'event', colors: ['緑'], ap: undefined, lp: undefined },
  },
  {
    baseId: 'B09074', printings: ['B09074', 'B09074P', 'B09074P2'],
    qaId: 'card:B09074:257729bded9735287561b957a296000c9fdd1c284ccc9cac5e5c978452befe69',
    abilityId: 'a2', target: { keywords: ['疾風'] }, simultaneous: true, extraRefresh: true,
  },
  {
    baseId: 'B10010', printings: ['B10010'],
    qaId: 'card:B10010:257729bded9735287561b957a296000c9fdd1c284ccc9cac5e5c978452befe69',
    abilityId: 'a2', target: { names: ['工藤新一'] },
  },
  {
    baseId: 'B10039', printings: ['B10039', 'B10039P'],
    qaId: 'card:B10039:257729bded9735287561b957a296000c9fdd1c284ccc9cac5e5c978452befe69',
    abilityId: 'a1', target: { colors: ['緑'] }, caseColors: ['緑', '白'],
  },
  {
    baseId: 'B10054', printings: ['B10054', 'B10054P'],
    qaId: 'card:B10054:657dafe95083ad08981b7610e34d651ff4ade221a78bb2a0482884c4475c0ff7',
    abilityId: 'a1', target: { colors: ['赤'], level: 1 }, caseColors: ['赤', '黄'],
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
  if (!state) throw new Error('Wave65 game state missing');
  return state;
}

function install(state: GameState, label: string): void {
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
  [card(REFRESH), card(REFRESH_TWO), card(SENTINEL), card(PAY), ...OPP_DECK.map(id => card(id))].forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

function startPhysicalRow(row: Row, sourceId: string) {
  const targetId = `W65-TARGET-${sourceId}`;
  register(card(targetId, row.target));
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = row.caseColors ? [...row.caseColors] : ['赤', '青', '緑', '黄', '白', '黒'];
  state.players.self.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
  state.players.self.hand = [sourceId, PAY, SENTINEL];
  state.players.self.deck = [targetId];
  state.players.self.remove = row.extraRefresh ? [REFRESH, REFRESH_TWO] : [REFRESH];
  state.players.opp.deck = [...OPP_DECK];
  install(state, `qa-wave65-${sourceId}-short-one`);

  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: sourceId })).toEqual({ ok: true });
  const entered = current().players.self.scene.find(item => item.cardId === sourceId);
  if (!entered) throw new Error(`${sourceId}: public enter failed`);

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

  if (row.preDiscard) {
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional?.source).toMatchObject({ cardId: sourceId, abilityId: row.abilityId, uid: entered.uid });
    expect(dispatchEngineAction(bindPendingDecision(optional!, { type: 'optionalResolve', run: true }))).toEqual({ ok: true });
    const payment = useGameStateStore.getState().pendingEffectPick;
    expect(payment?.atomVerb).toBe('discard');
    const pay = payment?.candidates.find(candidate => candidate.cardId === PAY);
    expect(dispatchEngineAction(bindPendingDecision(payment!, {
      type: 'effectPickResolve', pickedUid: pay!.uid,
    }))).toEqual({ ok: true });
  }

  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.atomVerb, `${sourceId}: real source reaches deck look`).toBe('deckRevealUntil');
  expect(pick?.source, `${sourceId}: physical source authority`).toMatchObject({
    cardId: sourceId, abilityId: row.abilityId, uid: entered.uid, area: 'scene',
  });
  expect([pick?.nMin, pick?.nMax]).toEqual([0, 1]);
  expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([targetId]);
  expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
    player: 'self', visibility: 'private', viewer: 'self', revealed: [targetId], awaitingPick: true,
    source: { cardId: sourceId, abilityId: row.abilityId },
  });
  expect(current().players.self.deck, `${sourceId}: viewed occurrence stays in deck`).toEqual([targetId]);
  expect(current().refreshCount.self, `${sourceId}: look cannot refresh`).toBe(0);
  return { targetId, pick: pick! };
}

function proveSelectedPhysicalRow(row: Row, sourceId: string) {
  const { targetId, pick } = startPhysicalRow(row, sourceId);
  expect(dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve', pickedUid: pick.candidates[0]!.uid,
  }))).toEqual({ ok: true });
  // Card-bound physical rows: B07073/P B08020/P B09074/P/P2 B10010 B10039/P B10054/P.
  const publicReveal = useGameStateStore.getState().pendingPublicHandReveal;
  expect(publicReveal, `${sourceId}: selected card becomes public`).toMatchObject({
    owner: 'self', audience: 'all', cardIds: [targetId], lifetime: 'presentation',
    origin: 'deck-selected-card', source: { cardId: sourceId, abilityId: row.abilityId },
  });
  expect(publicReveal?.cardIds, `${sourceId}: private remainder stays hidden`).toEqual([targetId]);

  const discard = useGameStateStore.getState().pendingEffectPick;
  expect(discard?.atomVerb, `${sourceId}: selected-only discard tail`).toBe('discard');
  const selected = discard?.candidates.find(candidate => candidate.cardId === targetId);
  expect(dispatchEngineAction(bindPendingDecision(discard!, {
    type: 'effectPickResolve', pickedUid: selected!.uid,
  }))).toEqual({ ok: true });

  const result = current();
  expect(result.refreshCount.self, `B08020 cohort ${sourceId}: selected sole card refreshes`).toBe(1);
  expect(result.players.opp.evidence, `${sourceId}: refresh gives opponent evidence`).toHaveLength(1);
  if (row.extraRefresh) {
    const seeds = [...result.players.self.deck, ...result.players.self.hand]
      .filter(id => id === REFRESH || id === REFRESH_TWO)
      .sort();
    expect(seeds).toEqual([REFRESH, REFRESH_TWO].sort());
    expect(result.players.self.deck).toHaveLength(1);
  } else if (row.preDiscard) {
    expect([...result.players.self.deck].sort()).toEqual([REFRESH, PAY].sort());
  } else {
    expect(result.players.self.deck).toEqual([REFRESH]);
  }
  expect(result.players.self.remove).toContain(targetId);
  expect(result.players.self.hand).toContain(SENTINEL);
  if (row.preDiscard) expect(result.players.self.remove).not.toContain(PAY);

  useGameStateStore.getState().setPendingDeckReveal(null);
  if (useGameStateStore.getState().pendingPublicHandReveal) useGameStateStore.getState().setPendingPublicHandReveal(null);
  expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  expect(useGameStateStore.getState().pendingDeckReorder).toBeNull();
  expect(current().pendingEffects.every(entry => entry.state === 'resolved')).toBe(true);
  return sourceId;
}

describe('official QA Wave65: every physical top-four enter source handles a one-card deck', () => {
  for (const row of ROWS) {
    it(row.qaId, () => {
      expect(row.printings.map(sourceId => proveSelectedPhysicalRow(row, sourceId))).toEqual([...row.printings]);
    });
  }
});

function proveB08075Event(sourceId: 'B08075' | 'B08075P') {
  const targetId = `W65-TARGET-${sourceId}`;
  register(card(targetId, { names: ['佐藤美和子'] }));
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['黄'];
  state.players.self.file = Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
  state.players.self.hand = [sourceId];
  state.players.self.deck = [targetId];
  state.players.self.remove = [REFRESH];
  state.players.opp.deck = [...OPP_DECK];
  install(state, `qa-wave65-${sourceId}-event-short-one`);

  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: sourceId })).toEqual({ ok: true });
  for (let option = 0; option < 3; option += 1) {
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional?.source, `${sourceId}: option ${option + 1} source`).toMatchObject({
      cardId: sourceId, abilityId: 'a1', area: 'hand', resolutionKind: 'normal-event',
    });
    expect(dispatchEngineAction(bindPendingDecision(optional!, {
      type: 'optionalResolve', run: option === 2,
    }))).toEqual({ ok: true });
  }

  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.atomVerb).toBe('deckRevealUntil');
  expect(pick?.source).toMatchObject({
    cardId: sourceId, abilityId: 'a1', area: 'hand', resolutionKind: 'normal-event',
  });
  expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([targetId]);
  expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
    player: 'self', visibility: 'private', viewer: 'self', revealed: [targetId], awaitingPick: true,
  });
  expect(current().players.self.deck).toEqual([targetId]);
  expect(current().refreshCount.self).toBe(0);
  // Card-bound physical rows: B08075 B08075P.
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: pick!.candidates[0]!.uid,
  }))).toEqual({ ok: true });
  const publication = useGameStateStore.getState().pendingPublicHandReveal;
  expect(publication).toMatchObject({
    owner: 'self', audience: 'all', cardIds: [targetId], lifetime: 'presentation',
    origin: 'deck-selected-card', source: { cardId: sourceId, abilityId: 'a1' },
  });
  expect(publication?.cardIds).toEqual([targetId]);
  expect(current().players.self.hand).toContain(targetId);
  expect(current().players.self.deck).toEqual([REFRESH]);
  expect(current().players.self.remove).toContain(sourceId);
  expect(current().refreshCount.self).toBe(1);
  expect(current().players.opp.evidence).toHaveLength(1);

  useGameStateStore.getState().setPendingDeckReveal(null);
  useGameStateStore.getState().setPendingPublicHandReveal(null);
  expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  expect(current().pendingEffects.every(entry => entry.state === 'resolved')).toBe(true);
  return sourceId;
}

describe('official QA Wave65: B08075 reaches the top-four look through its real third option', () => {
  it('card:B08075:59a856a1d72daa0022faa757fb164e31426c4854723043edfe6a1079450740ad', () => {
    expect(['B08075', 'B08075P'].map(sourceId => proveB08075Event(sourceId as 'B08075' | 'B08075P')))
      .toEqual(['B08075', 'B08075P']);
  });
});

describe('official QA Wave65 horizontal: B08071 self-removal preserves the short-deck ruling', () => {
  it('card:B08071:035b6b0e1e54080eb5aa7a0608114bc0c89e8901359b53714c37e416fed9e98b', () => {
    const target = 'W65-TARGET-B08071';
    register(card(target, { names: ['佐藤美和子'] }));
    const state = createEmptyGameState();
    state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case.colors = ['黄'];
    state.players.self.scene = [makeChar({ cardId: 'B08071', uid: 'source', state: 'active' })];
    state.players.self.deck = [target];
    state.players.self.remove = [REFRESH];
    state.players.opp.deck = [...OPP_DECK];
    install(state, 'qa-wave65-B08071-short-one');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' })).toEqual({ ok: true });
    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick).toMatchObject({
      atomVerb: 'deckRevealUntil', nMin: 0, nMax: 1,
      source: { cardId: 'B08071', abilityId: 'a1', uid: 'source', area: 'scene' },
    });
    expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([target]);
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      revealed: [target], awaitingPick: true, visibility: 'private', viewer: 'self',
    });
    expect(current().players.self.deck).toEqual([target]);
    expect(current().refreshCount.self).toBe(0);

    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve', pickedUid: pick!.candidates[0]!.uid,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      owner: 'self', audience: 'all', cardIds: [target], origin: 'deck-selected-card',
      source: { cardId: 'B08071', abilityId: 'a1', uid: 'source' },
    });
    expect(current().players.self.hand).toContain(target);
    expect([...current().players.self.deck].sort()).toEqual([REFRESH, 'B08071'].sort());
    expect(current().refreshCount.self).toBe(1);
    expect(current().players.opp.evidence).toHaveLength(1);
  });
});

function proveB10096Event(sourceId: 'B10096' | 'B10096P') {
  const partnerId = `W65-PARTNER-${sourceId}`;
  const target = `W65-TARGET-${sourceId}`;
  const mills = [0, 1, 2].map(index => `W65-MILL-${sourceId}-${index}`);
  register({ ...card(partnerId), kind: 'partner', colors: ['黒'], level: 0, ap: 0, lp: 3 });
  register(card(target, { kind: 'event', colors: ['黒'], keywords: ['カットイン'], ap: undefined, lp: undefined }));
  for (const id of mills) {
    register(card(id, { kind: 'event', colors: ['黒'], keywords: ['カットイン'], ap: undefined, lp: undefined }));
  }

  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['黒'];
  state.players.self.partner.cardId = partnerId;
  state.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
  state.players.self.hand = [sourceId];
  state.players.self.deck = [...mills, target];
  state.players.self.remove = [REFRESH];
  state.players.opp.deck = [...OPP_DECK];
  install(state, `qa-wave65-${sourceId}-event-short-one`);

  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: sourceId })).toEqual({ ok: true });
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional?.source).toMatchObject({
    cardId: sourceId, abilityId: 'a1', area: 'hand', resolutionKind: 'normal-event',
  });
  expect(dispatchEngineAction(bindPendingDecision(optional!, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });

  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toMatchObject({
    atomVerb: 'deckRevealUntil', nMin: 0, nMax: 1,
    source: { cardId: sourceId, abilityId: 'a1', area: 'hand', resolutionKind: 'normal-event' },
  });
  expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([target]);
  expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
    revealed: [target], awaitingPick: true, visibility: 'private', viewer: 'self',
  });
  expect(current().players.self.deck).toEqual([target]);
  expect(current().players.self.remove).toEqual([REFRESH, sourceId, ...mills]);
  expect(current().refreshCount.self).toBe(0);
  // Card-bound physical rows: B10096 B10096P.
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: pick!.candidates[0]!.uid,
  }))).toEqual({ ok: true });
  expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
    owner: 'self', audience: 'all', cardIds: [target], origin: 'deck-selected-card',
    source: { cardId: sourceId, abilityId: 'a1' },
  });
  const enter = useGameStateStore.getState().pendingEffectPick;
  if (enter) {
    expect(enter).toMatchObject({ atomVerb: 'sceneEnter', nMin: 0, nMax: 0, candidates: [] });
    expect(dispatchEngineAction(bindPendingDecision(enter, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
  }

  const result = current();
  expect(result.players.self.hand).toContain(target);
  expect([...result.players.self.deck].sort()).toEqual([REFRESH, ...mills].sort());
  expect(result.players.self.remove).toContain(sourceId);
  expect(result.refreshCount.self).toBe(1);
  expect(result.players.opp.evidence).toHaveLength(1);
  return sourceId;
}

describe('official QA Wave65 horizontal: B10096 mills into the one-card look', () => {
  it('card:B10096:c34fb03dbba3939eb1b2e8e0666f56e3b7fc1073dbdb3535cda372611db4dc52', () => {
    expect(['B10096', 'B10096P'].map(sourceId => proveB10096Event(sourceId as 'B10096' | 'B10096P')))
      .toEqual(['B10096', 'B10096P']);
  });
});

// qa: card:B08020:34b5e50478a370f3ee9ce8bf309eeb4e4825d1b3115ec9eeab3024bdaf99dfa9
