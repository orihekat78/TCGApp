// qa: card:B10065:132b6ee607cc3a33eb9e91d1f3bda4dc39dfcf54b0a2f045cc2168294ce8a923
// qa: card:B10065:15e4cae14b711705c2941e1bfebdcb912404db008f6e717734d1aefdb943637c
// qa: card:B10065:210502ad3cfac2ac045c7e17b3c7d5905db9ed5babf58abb6d8e4242e762dcf6
// qa: card:B10065:9c441855706df3f753667676379bd111b02d84359e06984992af27ef8b8afe73
// qa: card:B10065:a8246c5912c217b14fb5dc111466d1e0056d3e58153a80b1af842ba1f1ecaf67
// qa: card:B10065:f0e393b3a47afbeb95a14a91a8c573bd540fb08877f11528e5ae7dcd501b1a98

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B10065, B10065P, B10065P2 } from '@/cards/ct-p10/B10065';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const ROWS = [B10065, B10065P, B10065P2] as const;
const CASES = ROWS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner })));
const YELLOW_PARTNER = fixture('W134_YELLOW_PARTNER', { kind: 'partner', colors: ['黄'], ap: undefined, lp: undefined });
const BLUE_PARTNER = fixture('W134_BLUE_PARTNER', { kind: 'partner', colors: ['青'], ap: undefined, lp: undefined });
const BOND_FURUYA = fixture('W134_BOND_FURUYA', { names: ['降谷零'], traits: ['警察'], level: 4 });
const LOW_FURUYA = fixture('W134_LOW_FURUYA', { names: ['降谷零'], traits: ['警察'], level: 3 });
const FILLER = fixture('W134_FILLER', { level: 10 });
const DISCARD = fixture('W134_DISCARD', { kind: 'event', ap: undefined, lp: undefined });
const TAIL = fixture('W134_TAIL', { kind: 'event', ap: undefined, lp: undefined });
const LATE_ENTER = fixture('W134_LATE_ENTER', {
  abilities: [{
    id: 'late-enter', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'phase:end:start' },
    condition: { kind: 'turn', player: 'self' },
    effect: {
      kind: 'atom', verb: 'sceneEnter',
      args: { player: 'self', from: 'remove', viaEffect: true, max: 1, filter: { cardName: '降谷零', kind: 'character' } },
    },
    description: 'Wave134 late bond sentinel.', ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['黄'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave134 state');
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave134-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function base(card: CardDef, owner: Player, partner = YELLOW_PARTNER.id): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 21, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['黄'];
  state.players[owner].partner = { cardId: partner, state: 'active', location: 'partner-area' };
  state.players[owner].deck = [TAIL.id, TAIL.id, TAIL.id, TAIL.id];
  state.players[other(owner)].deck = [TAIL.id, TAIL.id, TAIL.id, TAIL.id];
  state.players[owner].scene = [sceneChar(card.id, 'source')];
  return state;
}

function pendingOptional() {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toBeTruthy();
  return pending!;
}

function pendingPick(verb?: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toBeTruthy();
  if (verb) expect(pending?.atomVerb).toBe(verb);
  return pending!;
}

function choose(uid: string | null, switchRemoveUid?: string): void {
  const pending = pendingPick();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: uid, ...(switchRemoveUid ? { switchRemoveUid } : {}),
  }))).toEqual({ ok: true });
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [YELLOW_PARTNER, BLUE_PARTNER, BOND_FURUYA, LOW_FURUYA, FILLER, DISCARD, TAIL, LATE_ENTER]) {
    register(card);
  }
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave134: entry trigger excludes only the physical source occurrence', () => {
  it.each(CASES)('$card.id owner $owner does not react to its own public hand entry', ({ card, owner }) => {
    const state = base(card, owner);
    state.players[owner].scene = [];
    state.players[owner].hand = [card.id];
    state.players[owner].file = Array.from({ length: 9 }, (_value, index) => ({
      type: 'card-back' as const, cardId: `file-${index}`,
    }));
    install(state, owner, `${card.id}-${owner}-self-enter`);
    expect(ROWS.map(row => row.id)).toContain(card.id);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
      .toEqual({ ok: true });
    expect(current().players[owner].scene.some(character => character.cardId === card.id)).toBe(true);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});

describe('official QA Wave134: fired bond effect survives bond loss and reuses the discarded card', () => {
  it.each(CASES)('$card.id owner $owner re-enters the discarded police and fires its entry reaction', ({ card, owner }) => {
    const state = base(card, owner);
    state.players[owner].scene.push(sceneChar(BOND_FURUYA.id, 'bond'));
    state.players[owner].hand = [LOW_FURUYA.id];
    state.players[other(owner)].scene = [sceneChar(FILLER.id, 'opponent-level10')];
    install(state, owner, `${card.id}-${owner}-reuse-discard`);
    expect(ROWS.map(row => row.id)).toContain(card.id);

    expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
    const optional = pendingOptional();
    expect(optional.source).toMatchObject({ uid: 'source', cardId: card.id, abilityId: 'a2' });

    const withoutBond = structuredClone(current());
    mutate.scene.removeToRemove(withoutBond, 'bond', 'effect');
    expect(useGameStateStore.getState().setGameState(withoutBond)).toBe(true);
    expect(useGameStateStore.getState().pendingEffectOptional?.source.cardId).toBe(card.id);
    expect(dispatchEngineAction(bindPendingDecision(pendingOptional(), {
      type: 'optionalResolve', run: true,
    }))).toEqual({ ok: true });

    const discard = pendingPick('discard');
    const discarded = discard.candidates.find(candidate => candidate.cardId === LOW_FURUYA.id)!;
    choose(discarded.uid);
    expect(current().players[owner].remove).toContain(LOW_FURUYA.id);

    const entry = pendingPick('sceneEnter');
    const sameCard = entry.candidates.find(candidate => candidate.cardId === LOW_FURUYA.id)!;
    choose(sameCard.uid);
    expect(current().players[owner].scene.find(character => character.cardId === LOW_FURUYA.id))
      .toMatchObject({ state: 'sleep' });

    const removal = pendingPick('sceneRemove');
    expect(removal.source).toMatchObject({ uid: 'source', cardId: card.id, abilityId: 'a1' });
    expect(removal.candidates.map(candidate => candidate.uid)).not.toContain('opponent-level10');
    choose(null);
  });
});

describe('official QA Wave134: timing and full-scene switch boundaries', () => {
  it.each(CASES)('$card.id owner $owner does not retroactively gain its turn-end bond trigger', ({ card, owner }) => {
    const state = base(card, owner, BLUE_PARTNER.id);
    state.players[owner].scene.push(sceneChar(LATE_ENTER.id, 'late-source'));
    state.players[owner].remove = [BOND_FURUYA.id];
    install(state, owner, `${card.id}-${owner}-late-bond`);

    expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
    const entry = pendingPick('sceneEnter');
    expect(entry.source).toMatchObject({ uid: 'late-source', cardId: LATE_ENTER.id, abilityId: 'late-enter' });
    choose(entry.candidates[0]!.uid);
    expect(current().players[owner].scene.some(character => character.cardId === BOND_FURUYA.id)).toBe(true);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });

  it.each(CASES)('$card.id owner $owner may switch out the observer before the effect entry', ({ card, owner }) => {
    const state = base(card, owner);
    state.players[owner].scene.push(
      sceneChar(BOND_FURUYA.id, 'bond'),
      sceneChar(FILLER.id, 'filler-1'),
      sceneChar(FILLER.id, 'filler-2'),
      sceneChar(FILLER.id, 'filler-3'),
    );
    state.players[owner].hand = [DISCARD.id];
    state.players[owner].remove = [LOW_FURUYA.id];
    install(state, owner, `${card.id}-${owner}-switch-source`);

    expect(dispatchEngineAction({ type: 'endTurn', player: owner })).toEqual({ ok: true });
    expect(dispatchEngineAction(bindPendingDecision(pendingOptional(), {
      type: 'optionalResolve', run: true,
    }))).toEqual({ ok: true });
    const discard = pendingPick('discard');
    choose(discard.candidates.find(candidate => candidate.cardId === DISCARD.id)!.uid);
    const entry = pendingPick('sceneEnter');
    choose(entry.candidates.find(candidate => candidate.cardId === LOW_FURUYA.id)!.uid, 'source');

    expect(current().players[owner].remove).toContain(card.id);
    expect(current().players[owner].scene.find(character => character.cardId === LOW_FURUYA.id))
      .toMatchObject({ state: 'sleep' });
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});
