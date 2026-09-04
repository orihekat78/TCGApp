// qa: card:B04018:a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae
// qa: card:B05052:a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae
// qa: card:B05055:a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae
// qa: card:B05112:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B07069:43880971e2664248b7392f8218efc59b88a7a1812214721e4828dbe6ca9c2cbc
// qa: card:B08009:a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae
// qa: card:B08056:a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae
// qa: card:B09044:a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae
// Rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md,
// 21-declared-ability-cost.md, 25-qa-effects-resolution.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B04018 } from '@/cards/ct-p04/B04018';
import { B05052 } from '@/cards/ct-p05/B05052';
import { B05055 } from '@/cards/ct-p05/B05055';
import { B05112 } from '@/cards/ct-p05/B05112';
import { B07069 } from '@/cards/ct-p07/B07069';
import { B08009 } from '@/cards/ct-p08/B08009';
import { B08056 } from '@/cards/ct-p08/B08056';
import { B09044 } from '@/cards/ct-p09/B09044';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = {
  B04018: 'a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae',
  B05052: 'a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae',
  B05055: 'a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae',
  B05112: 'd8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa',
  B07069: '43880971e2664248b7392f8218efc59b88a7a1812214721e4828dbe6ca9c2cbc',
  B08009: 'a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae',
  B08056: 'a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae',
  B09044: 'a96985ed96d005b04cd0c44c2dadf206fac63c8bd49e8c42cef6ea4c73808dae',
} as const;
const DRAW = 'QA_W27_DECLARED_DRAW';
const FILLER = 'QA_W27_DECLARED_FILLER';
const HAND_COST = 'QA_W27_DECLARED_HAND_COST';
const DECK_COST_A = 'QA_W27_DECLARED_DECK_COST_A';
const DECK_COST_B = 'QA_W27_DECLARED_DECK_COST_B';
const GREEN_PARTNER = 'QA_W27_DECLARED_GREEN_PARTNER';

function character(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['緑'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  };
}

function eventCard(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'event', names: [id], colors: ['緑'], level: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  };
}

const enterDraw: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};

const TREASURE_ENTRY = character('QA_W27_TREASURE_ENTRY', {
  traits: ['鈴木財閥'], level: 5, abilities: [enterDraw],
});
const TREASURE_DECOY = character('QA_W27_TREASURE_DECOY', {
  traits: ['鈴木財閥'], level: 6,
});
const CUTIN_ENTRY = character('QA_W27_CUTIN_ENTRY', {
  colors: ['黒'], level: 5, keywords: ['カットイン'], abilities: [enterDraw],
});
const CUTIN_EVENT = eventCard('QA_W27_CUTIN_EVENT', {
  colors: ['黒'], level: 5, keywords: ['カットイン'],
});
const KIDS_ENTRY = character('QA_W27_KIDS_ENTRY', {
  traits: ['少年探偵団'], level: 4, abilities: [enterDraw],
});
const KIDS_DECOY = character('QA_W27_KIDS_DECOY', {
  traits: ['少年探偵団'], level: 5,
});
const MIYANO_ENTRY = character('QA_W27_MIYANO_ENTRY', {
  names: ['宮野明美'], level: 7, abilities: [enterDraw],
});
const MIYANO_DECOY = character('QA_W27_MIYANO_DECOY', {
  names: ['宮野明美'], level: 8,
});
const MIYANO_NAME_DECOY = character('QA_W27_MIYANO_NAME_DECOY', {
  names: ['灰原哀'], level: 7,
});
const MIYANO_EVENT_DECOY = eventCard('QA_W27_MIYANO_EVENT_DECOY', {
  names: ['宮野明美'], level: 7,
});
const BLUE_ENTRY = character('QA_W27_BLUE_ENTRY', {
  colors: ['青'], level: 6, abilities: [enterDraw],
});
const BLUE_DECOY = character('QA_W27_BLUE_DECOY', {
  colors: ['緑'], level: 6,
});
const HEIJI_ENTRY = character('QA_W27_HEIJI_ENTRY', {
  names: ['服部平次'], level: 5, abilities: [enterDraw],
});
const HEIJI_DECOY = character('QA_W27_HEIJI_DECOY', {
  names: ['服部平次'], level: 6,
});
const LOW_ENTRY = character('QA_W27_LOW_ENTRY', { level: 3, abilities: [enterDraw] });
const LOW_DECOY = eventCard('QA_W27_LOW_DECOY', { level: 3 });
const RED_ENTRY = character('QA_W27_RED_ENTRY', {
  colors: ['赤'], level: 7, abilities: [enterDraw],
});
const RED_DECOY = character('QA_W27_RED_DECOY', { colors: ['赤'], level: 8 });
const SHINICHI = character('QA_W27_SHINICHI', { names: ['工藤新一'] });

const fixtures: CardDef[] = [
  character(DRAW), character(FILLER), character(HAND_COST),
  character(DECK_COST_A), character(DECK_COST_B),
  character(GREEN_PARTNER, { kind: 'partner', colors: ['緑'] }),
  TREASURE_ENTRY, TREASURE_DECOY, CUTIN_ENTRY, CUTIN_EVENT,
  KIDS_ENTRY, KIDS_DECOY, MIYANO_ENTRY, MIYANO_DECOY, MIYANO_NAME_DECOY, MIYANO_EVENT_DECOY,
  BLUE_ENTRY, BLUE_DECOY, HEIJI_ENTRY, HEIJI_DECOY,
  LOW_ENTRY, LOW_DECOY, RED_ENTRY, RED_DECOY, SHINICHI,
];

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function base(source: CardDef): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [...source.colors];
  state.players.self.case.status = '解決編';
  state.players.self.scene = [makeChar({ cardId: source.id, uid: 'source', state: 'active' })];
  state.players.self.deck = [DRAW, FILLER];
  return state;
}

function install(state: GameState, label: string): void {
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(source: CardDef, abilityId: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${source.id}: sceneEnter authority`).toMatchObject({
    player: 'self', atomVerb: 'sceneEnter',
    source: { cardId: source.id, uid: 'source', abilityId },
  });
  return pending!;
}

function resolveEntry(source: CardDef, abilityId: string, target: CardDef): void {
  const pending = pendingPick(source, abilityId);
  const candidate = pending.candidates.find(item => item.cardId === target.id);
  expect(candidate, `${source.id}: ${target.id} eligible`).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: candidate!.uid,
  }))).toEqual({ ok: true });
}

function resolveSameTimingFirst(cardId: string): void {
  const group = pendingOwnerOrderGroup(current(), 'self');
  expect(group, `${cardId}: owner ordering surfaced`).toHaveLength(2);
  const first = group.find(entry => entry.source.cardId === cardId);
  expect(first, `${cardId}: ordered effect found`).toBeTruthy();
  expect(dispatchEngineAction({
    type: 'setEffectOrder', entryId: first!.id, order: 0, player: 'self',
  })).toEqual({ ok: true });
  const ordered = pendingOwnerOrderGroup(current(), 'self');
  const orderedIds = ordered.map(entry => entry.id); expect(orderedIds[0], `${cardId}: selected effect moved first`).toBe(first!.id);
  const resolutionOrder: string[] = [];
  const stop = event.on('effect:resolve:start', (_state, payload) => {
    const effectId = (payload as { effectId?: unknown }).effectId;
    if (typeof effectId === 'string' && orderedIds.includes(effectId)) resolutionOrder.push(effectId);
  });
  try {
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder', entryIds: orderedIds, player: 'self',
    })).toEqual({ ok: true });
  } finally {
    stop();
  }
  expect(resolutionOrder, `${cardId}: effects resolved in chosen order`).toEqual(orderedIds);
}

function expectEntryFired(source: CardDef, target: CardDef): void {
  const state = current();
  expect(state.players.self.scene.some(item => item.cardId === target.id), `${source.id}: target entered`).toBe(true);
  const targetEffects = state.pendingEffects.filter(entry =>
    entry.source.cardId === target.id && entry.source.abilityId === enterDraw.id
  );
  expect(targetEffects, `${source.id}: target enter effect queued once`).toHaveLength(1);
  expect(targetEffects[0]?.state, `${source.id}: target enter effect resolved`).toBe('resolved');
  const actions = state.log.map(entry => entry.action);
  expect(actions.filter(action => action === 'effect:draw'), `${source.id}: target drew once`).toHaveLength(1);
  expect(actions.lastIndexOf('effect:draw'), `${source.id}: enter trigger follows sceneEnter`)
    .toBeGreaterThan(actions.lastIndexOf('effect:sceneEnter'));
}

function expectSettled(source: CardDef): void {
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick, `${source.id}: pick cleared`).toBeNull();
  expect(store.pendingEffectChoice, `${source.id}: choice cleared`).toBeNull();
  expect(store.pendingEffectOptional, `${source.id}: optional cleared`).toBeNull();
  expect(store.pendingDeckReveal, `${source.id}: reveal cleared`).toBeNull();
  expect(store.pendingDeckReorder, `${source.id}: reorder cleared`).toBeNull();
  expect(store.activeActionId, `${source.id}: action cleared`).toBeNull();
  expect(current().pendingEffects.every(entry => entry.state === 'resolved'), `${source.id}: effects resolved`).toBe(true);
  expect(current().pendingRuntimeState, `${source.id}: runtime cleared`).toBeUndefined();
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null });
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('effect entry official Q&A — Wave 27 declared public paths', () => {
  it(`card:B05055:${QA.B05055}: hand entry fires the entered Suzuki character`, () => {
    const state = base(B05055);
    state.players.self.hand = [TREASURE_ENTRY.id, TREASURE_DECOY.id];
    install(state, 'qa-w27-B05055');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' })).toEqual({ ok: true });
    const pending = pendingPick(B05055, 'a1');
    expect(pending.candidates.map(item => item.cardId)).not.toContain(TREASURE_DECOY.id);
    resolveEntry(B05055, 'a1', TREASURE_ENTRY);

    expect(current().players.self.scene.find(item => item.uid === 'source')?.state).toBe('sleep');
    expectEntryFired(B05055, TREASURE_ENTRY);
    expect(current().players.self.hand.filter(cardId => cardId === DRAW), 'B05055: entered ability drew once').toHaveLength(1);
    expectSettled(B05055);
  });

  it(`card:B05112:${QA.B05112}: keyword-filtered hand entry excludes events and fires the character`, () => {
    const state = base(B05112);
    state.players.self.hand = [CUTIN_ENTRY.id, CUTIN_EVENT.id];
    install(state, 'qa-w27-B05112');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' })).toEqual({ ok: true });
    const pending = pendingPick(B05112, 'a1');
    expect(pending.candidates.map(item => item.cardId)).not.toContain(CUTIN_EVENT.id);
    resolveEntry(B05112, 'a1', CUTIN_ENTRY);

    expectEntryFired(B05112, CUTIN_ENTRY);
    expect(current().players.self.hand.filter(cardId => cardId === DRAW), 'B05112: entered ability drew once').toHaveLength(1);
    expectSettled(B05112);
  });

  it(`card:B08009:${QA.B08009}: paid deck-removal declaration enters from hand and fires`, () => {
    const state = base(B08009);
    state.players.self.deck = [DECK_COST_A, DECK_COST_B, DRAW];
    state.players.self.hand = [KIDS_ENTRY.id, KIDS_DECOY.id];
    install(state, 'qa-w27-B08009');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' })).toEqual({ ok: true });
    const pending = pendingPick(B08009, 'a1');
    expect(current().players.self.remove).toEqual(expect.arrayContaining([DECK_COST_A, DECK_COST_B]));
    expect(pending.candidates.map(item => item.cardId)).not.toContain(KIDS_DECOY.id);
    resolveEntry(B08009, 'a1', KIDS_ENTRY);

    expectEntryFired(B08009, KIDS_ENTRY);
    expect(current().players.self.hand.filter(cardId => cardId === DRAW), 'B08009: entered ability drew once').toHaveLength(1);
    expectSettled(B08009);
  });

  it(`card:B08056:${QA.B08056}: FILE-gated named hand entry fires the entered character`, () => {
    const state = base(B08056);
    state.players.self.file = Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
    state.players.self.hand = [MIYANO_ENTRY.id, MIYANO_DECOY.id, MIYANO_NAME_DECOY.id, MIYANO_EVENT_DECOY.id];
    install(state, 'qa-w27-B08056');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' })).toEqual({ ok: true });
    const pending = pendingPick(B08056, 'a1');
    expect(pending.candidates.map(item => item.cardId)).toEqual([MIYANO_ENTRY.id]);
    resolveEntry(B08056, 'a1', MIYANO_ENTRY);

    expectEntryFired(B08056, MIYANO_ENTRY);
    expect(current().players.self.hand.filter(cardId => cardId === DRAW), 'B08056: entered ability drew once').toHaveLength(1);
    expectSettled(B08056);
  });

  it(`card:B09044:${QA.B09044}: self-to-deck cost still resolves hand entry and its trigger`, () => {
    const state = base(B09044);
    state.players.self.hand = [BLUE_ENTRY.id, BLUE_DECOY.id];
    install(state, 'qa-w27-B09044');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' })).toEqual({ ok: true });
    const pending = pendingPick(B09044, 'a1');
    expect(current().players.self.scene.some(item => item.uid === 'source')).toBe(false);
    expect(current().players.self.deck).toContain(B09044.id);
    expect(pending.candidates.map(item => item.cardId)).not.toContain(BLUE_DECOY.id);
    resolveEntry(B09044, 'a1', BLUE_ENTRY);

    expectEntryFired(B09044, BLUE_ENTRY);
    expect(current().players.self.hand.filter(cardId => cardId === DRAW), 'B09044: entered ability drew once').toHaveLength(1);
    expectSettled(B09044);
  });

  it(`card:B04018:${QA.B04018}: paid hand cost reanimates Hattori and fires his enter ability`, () => {
    const state = base(B04018);
    state.players.self.partner = { cardId: GREEN_PARTNER, state: 'active', location: 'partner-area' };
    state.players.self.hand = [HAND_COST];
    state.players.self.remove = [HEIJI_ENTRY.id, HEIJI_DECOY.id];
    install(state, 'qa-w27-B04018');

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a3',
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: true });
    const pending = pendingPick(B04018, 'a3');
    expect(pending.candidates.map(item => item.cardId)).not.toContain(HEIJI_DECOY.id);
    resolveEntry(B04018, 'a3', HEIJI_ENTRY);
    resolveSameTimingFirst(HEIJI_ENTRY.id);

    expect(current().players.self.remove).toContain(HAND_COST);
    expectEntryFired(B04018, HEIJI_ENTRY);
    expect(current().players.self.hand.filter(cardId => cardId === DRAW), 'B04018: entered ability drew once').toHaveLength(1);
    expectSettled(B04018);
  });

  it(`card:B05052:${QA.B05052}: selected hand-cost branch reanimates a low-level character and fires`, () => {
    const state = base(B05052);
    state.players.self.scene.push(makeChar({ cardId: SHINICHI.id, uid: 'bond', state: 'active' }));
    state.players.self.hand = [HAND_COST];
    state.players.self.remove = [LOW_ENTRY.id, LOW_DECOY.id];
    install(state, 'qa-w27-B05052');

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2',
      costParams: { costChoice: 0, removeFromHand: { indices: [0] } },
    })).toEqual({ ok: true });
    const pending = pendingPick(B05052, 'a2');
    expect(pending.candidates.map(item => item.cardId)).not.toContain(LOW_DECOY.id);
    resolveEntry(B05052, 'a2', LOW_ENTRY);

    expect(current().players.self.remove).toContain(HAND_COST);
    expectEntryFired(B05052, LOW_ENTRY);
    expect(current().players.self.hand.filter(cardId => cardId === DRAW), 'B05052: entered ability drew once').toHaveLength(1);
    expectSettled(B05052);
  });

  it(`card:B07069:${QA.B07069}: all declared costs precede remove-area entry and its enter trigger`, () => {
    const state = base(B07069);
    state.players.self.file = Array.from({ length: 8 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
    state.players.self.hand = [HAND_COST];
    state.players.self.remove = [RED_ENTRY.id, RED_DECOY.id];
    install(state, 'qa-w27-B07069');

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2',
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: true });
    const pending = pendingPick(B07069, 'a2');
    expect(current().players.self.file).toHaveLength(7);
    expect(current().players.self.remove).toEqual(expect.arrayContaining([HAND_COST, FILLER]));
    expect(pending.candidates.map(item => item.cardId)).not.toContain(RED_DECOY.id);
    resolveEntry(B07069, 'a2', RED_ENTRY);

    expectEntryFired(B07069, RED_ENTRY);
    expect(current().players.self.hand.filter(cardId => cardId === DRAW), 'B07069: entered ability drew once').toHaveLength(1);
    expectSettled(B07069);
  });

  it('optional hand entry can be declined and settles without firing the candidate', () => {
    const state = base(B08056);
    state.players.self.file = Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
    state.players.self.hand = [MIYANO_ENTRY.id];
    install(state, 'qa-w27-B08056-decline');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' })).toEqual({ ok: true });
    const pending = pendingPick(B08056, 'a1');
    expect(pending.nMin).toBe(0);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });

    expect(current().players.self.scene.some(item => item.cardId === MIYANO_ENTRY.id)).toBe(false);
    expect(current().players.self.hand).toContain(MIYANO_ENTRY.id);
    expectSettled(B08056);
  });

  it('optional remove entry with zero candidates auto-skips and settles after costs', () => {
    const state = base(B07069);
    state.players.self.file = Array.from({ length: 8 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
    state.players.self.hand = [HAND_COST];
    state.players.self.remove = [];
    install(state, 'qa-w27-B07069-empty');

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2',
      costParams: { removeFromHand: { indices: [0] } },
    })).toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

    expect(current().players.self.scene.some(item => item.cardId === RED_ENTRY.id)).toBe(false);
    expect(current().players.self.remove).toEqual(expect.arrayContaining([HAND_COST, FILLER]));
    expectSettled(B07069);
  });
});
