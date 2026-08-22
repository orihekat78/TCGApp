// qa: card:B01039:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B01057:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B02013:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B02031:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B02052:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B02067:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B02084:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B03041:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B05117:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B06012:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B06062:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B06064:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// Rules: 15, 16, 25. Public hand use attaches the physical event to one host;
// public self-side effect removal then moves both the host and attached event to remove.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B01039 } from '@/cards/ct-p01/B01039';
import { B01057 } from '@/cards/ct-p01/B01057';
import { B01057P } from '@/cards/ct-p01/B01057P';
import { B02013 } from '@/cards/ct-p02/B02013';
import { B02013P } from '@/cards/ct-p02/B02013P';
import { B02031 } from '@/cards/ct-p02/B02031';
import { B02031P } from '@/cards/ct-p02/B02031P';
import { B02052 } from '@/cards/ct-p02/B02052';
import { B02052P } from '@/cards/ct-p02/B02052P';
import { B02067 } from '@/cards/ct-p02/B02067';
import { B02067P } from '@/cards/ct-p02/B02067P';
import { B02084 } from '@/cards/ct-p02/B02084';
import { B02084P } from '@/cards/ct-p02/B02084P';
import { B03041 } from '@/cards/ct-p03/B03041';
import { B03041P } from '@/cards/ct-p03/B03041P';
import { B05117 } from '@/cards/ct-p05/B05117';
import { B05117P } from '@/cards/ct-p05/B05117P';
import { B06012 } from '@/cards/ct-p06/B06012';
import { B06012P } from '@/cards/ct-p06/B06012P';
import { B06062 } from '@/cards/ct-p06/B06062';
import { B06062P } from '@/cards/ct-p06/B06062P';
import { B06064 } from '@/cards/ct-p06/B06064';
import { B06064P } from '@/cards/ct-p06/B06064P';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function character(id: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['黄'], level: 1,
    ap: 9000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...overrides,
  };
}

const HOST_L7 = character('W34-HOST-L7', {
  colors: ['青', '緑', '赤', '白', '黒', '黄'],
  level: 7,
  traits: ['探偵', '怪盗', '少年探偵団'],
});
const HOST_L8 = character('W34-HOST-L8', {
  colors: ['白'],
  level: 8,
  traits: ['YAIBA'],
});
const REMOVER = character('W34-REMOVER', {
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'atom', verb: 'sceneRemove',
      args: { player: 'self', max: 1, side: 'self', cause: 'effect', filter: { kind: 'character' } },
    },
    description: '自分のキャラ1枚までをリムーブする。',
    ruleRefs: ['rules/15-abilities-effects.md'],
  }],
});
const FIXTURES = [HOST_L7, HOST_L8, REMOVER];

const CASES = [
  { source: B01039, hostDef: HOST_L7 },
  { source: B01057, hostDef: HOST_L7 },
  { source: B02013, hostDef: HOST_L7 },
  { source: B02031, hostDef: HOST_L7 },
  { source: B02052, hostDef: HOST_L7 },
  { source: B02067, hostDef: HOST_L7 },
  { source: B02084, hostDef: HOST_L7 },
  { source: B03041, hostDef: HOST_L7 },
  { source: B05117, hostDef: HOST_L7 },
  { source: B06012, hostDef: HOST_L7 },
  { source: B06062, hostDef: HOST_L8 },
  { source: B06064, hostDef: HOST_L8 },
] as const;

const PRINTING_PAIRS = [
  { baseCard: B01057, parallel: B01057P },
  { baseCard: B02013, parallel: B02013P },
  { baseCard: B02031, parallel: B02031P },
  { baseCard: B02052, parallel: B02052P },
  { baseCard: B02067, parallel: B02067P },
  { baseCard: B02084, parallel: B02084P },
  { baseCard: B03041, parallel: B03041P },
  { baseCard: B05117, parallel: B05117P },
  { baseCard: B06012, parallel: B06012P },
  { baseCard: B06062, parallel: B06062P },
  { baseCard: B06064, parallel: B06064P },
] as const;

function mechanics(card: CardDef): unknown {
  const normalized = { ...card, id: '', no: '', rarity: '', imageUrl: '' };
  return JSON.parse(JSON.stringify(normalized, (_key, value: unknown) => (
    typeof value === 'function' ? value.toString() : value
  ))) as unknown;
}

function base(source: CardDef, hostDef: CardDef): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [...source.colors];
  state.players.self.file = Array.from(
    { length: 9 },
    () => ({ type: 'card-back' as const, cardId: 'W34-FILE' }),
  );
  state.players.self.hand = [source.id];
  state.players.self.deck = ['W34-DECK-1', 'W34-DECK-2', 'W34-DECK-3', 'W34-DECK-4'];
  state.players.self.scene = [
    makeChar({ cardId: hostDef.id, uid: 'host' }),
    makeChar({ cardId: REMOVER.id, uid: 'remover' }),
  ];
  return state;
}

function install(state: GameState, label: string): void {
  resetPresentationQueue(`qa-wave34-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function pending(verb: string): PendingPick {
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toBeTruthy();
  expect(pick?.atomVerb).toBe(verb);
  return pick!;
}

function resolvePick(pick: PendingPick, uids: string[]): void {
  expect(dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve',
    pickedUid: uids[0] ?? null,
    ...(uids.length > 1 ? { pickedUids: uids } : {}),
  }))).toEqual({ ok: true });
}

function host(): SceneCharacter {
  const result = current().players.self.scene.find(character => character.uid === 'host');
  if (!result) throw new Error('missing set-card host');
  return result;
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

const QA_CARD_IDS = [
  'B01039', 'B01057', 'B02013', 'B02031', 'B02052', 'B02067',
  'B02084', 'B03041', 'B05117', 'B06012', 'B06062', 'B06064',
] as const;

describe('Wave34 official-QA public set-card lifecycle', () => {
  it('binds the exact official-QA group', () => {
    expect(CASES.map(({ source }) => source.id).sort()).toEqual([...QA_CARD_IDS].sort());
  });

  it.each(PRINTING_PAIRS)('keeps $baseCard.id and $parallel.id mechanically identical', ({ baseCard, parallel }) => {
    expect(mechanics(parallel)).toEqual(mechanics(baseCard));
  });

  it.each(CASES)('$source.id attaches itself publicly and leaves with its host', ({ source, hostDef }) => {
    install(base(source, hostDef), source.id);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: source.id }))
      .toEqual({ ok: true });
    const firstPick = useGameStateStore.getState().pendingEffectPick;
    if (firstPick?.atomVerb === 'sceneRemove') resolvePick(firstPick, []);

    const setPick = pending('charSetCard');
    expect(setPick.candidates.map(candidate => candidate.uid)).toEqual(['host']);
    resolvePick(setPick, ['host']);
    if (source.id === B02084.id) resolvePick(pending('sceneRemove'), []);

    expect(host().setCards).toEqual([
      expect.objectContaining({ cardId: source.id, faceUp: true, instanceId: expect.any(String) }),
    ]);
    expect(current().players.self.remove).not.toContain(source.id);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' }))
      .toEqual({ ok: true });
    const leavePick = pending('sceneRemove');
    expect(leavePick.candidates.map(candidate => candidate.uid).sort()).toEqual(['host', 'remover']);
    resolvePick(leavePick, ['host']);

    expect(current().players.self.scene.map(character => character.uid)).toEqual(['remover']);
    expect(current().players.self.remove).toContain(source.id);
    expect(current().players.self.remove).toContain(hostDef.id);
    expect(current().players.self.scene.every(character => character.setCards.length === 0)).toBe(true);
  });

  it('offers B02067 only its controller red characters through the public hand-use path', () => {
    const oppRed = character('W34-OPP-RED', { colors: ['赤'] });
    register(oppRed);
    const state = base(B02067, HOST_L7);
    state.players.opp.scene = [makeChar({ cardId: oppRed.id, uid: 'opp-red' })];
    install(state, 'B02067-target-filter');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B02067.id }))
      .toEqual({ ok: true });
    expect(pending('charSetCard').candidates.map(candidate => candidate.uid)).toEqual(['host']);
  });

  it('keeps an older identical remove copy and preserves the attached instance through host leave', () => {
    const state = base(B02067, HOST_L7);
    state.players.self.remove = [B02067.id];
    let leaveInstanceId: string | undefined;
    event.on('setcard:leave', (_draft, payload) => {
      if (payload.setCardId === B02067.id) leaveInstanceId = payload.setCardInstanceId;
    });
    install(state, 'B02067-physical-instance');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B02067.id }))
      .toEqual({ ok: true });
    resolvePick(pending('charSetCard'), ['host']);

    const attachedInstanceId = host().setCards[0]?.instanceId;
    expect(attachedInstanceId).toEqual(expect.any(String));
    expect(current().players.self.remove).toEqual([B02067.id]);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' }))
      .toEqual({ ok: true });
    resolvePick(pending('sceneRemove'), ['host']);

    expect(current().players.self.remove.filter(cardId => cardId === B02067.id)).toHaveLength(2);
    expect(leaveInstanceId).toBe(attachedInstanceId);
  });
});
