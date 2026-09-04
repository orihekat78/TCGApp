// qa: card:B08048:3053f6462e12a9e2865b2025bb9466d188a73da0b7fe642edc6b5118575c89e9
// qa: card:B08048:723965466bac2e32665651b8d1aa327a67370ee59523610b9f9324ea4a24c202
// qa: card:B08048:7744747aea8bdeea154ceec0441efede03509bcb560cff3382ed5c8c8235ff4d
// qa: card:B08051:2f338c8af1f1fbae63949a5fbaed1e2483276b330fad2cfcca904087ca10e13c
// qa: card:B08051:43e0680a7f73c9e7e26ee84d8c2481068fbd10f53075d29105babebb8219bde7
// qa: card:B08051:c77e68990a513ea014c37efafcffe0643d79b6c1b9be0ac90bf6d4f0f42f0610
// qa: card:B08051:f4a642b51d9e6a3f15c26aaa09c523c9650a98ad925d4c237ba629a31033bea5
// qa: card:B08055:e4a36acb6bbbb1c8b11eac5e65600d839bba033d5a2b7f0e5ecfc84bacd47a4c

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B08048 } from '@/cards/ct-p08/B08048';
import { B08051 } from '@/cards/ct-p08/B08051';
import { B08055 } from '@/cards/ct-p08/B08055';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['赤'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const LEVEL_SEVEN = fixture('W180_LEVEL_SEVEN', { level: 7, colors: ['青'] });
const FBI_ALLY = fixture('W180_FBI_ALLY', { traits: ['FBI'] });
const AKEMI = fixture('W180_AKEMI', { names: ['宮野明美'] });
const MOROBOSHI = fixture('W180_MOROBOSHI', { names: ['諸星大'] });
const REMOVE_DECOY = fixture('W180_REMOVE_DECOY', { names: ['別人'] });
const DISCARD_AP4000 = fixture('W180_DISCARD_AP4000', { ap: 4000 });
const CONTACT_ATTACKER = fixture('W180_CONTACT_ATTACKER', { ap: 5000, colors: ['青'] });
const CONTACT_TARGET = fixture('W180_CONTACT_TARGET', { ap: 3000 });
const FILLER = fixture('W180_FILLER', { kind: 'event' });
const SWITCH_IN = fixture('W180_SWITCH_IN');
const SWITCH_FILLERS = [
  fixture('W180_SWITCH_FILLER_A'),
  fixture('W180_SWITCH_FILLER_B'),
  fixture('W180_SWITCH_FILLER_C'),
  fixture('W180_SWITCH_FILLER_D'),
] as const;
const AKEMI_MOVER = fixture('W180_AKEMI_MOVER', {
  abilities: [{
    id: 'a1', type: 'declared', scope: 'on-scene',
    cost: {
      kind: 'removeAreaToDeckBottom',
      target: {
        kind: 'pick', query: { area: 'remove', side: 'self', filter: { cardName: '宮野明美' } },
        n: { min: 1, max: 1 }, chooser: 'owner',
      },
      n: 1,
    },
    effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 0, scope: 'turn' } },
    description: 'Move one Miyano Akemi from the owner remove area to deck bottom.', ruleRefs: [],
  }],
});

const FIXTURES = [
  LEVEL_SEVEN, FBI_ALLY, AKEMI, MOROBOSHI, REMOVE_DECOY, DISCARD_AP4000,
  CONTACT_ATTACKER, CONTACT_TARGET, FILLER, SWITCH_IN, AKEMI_MOVER, ...SWITCH_FILLERS,
];

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave180 game state');
  return state;
}

function fileCards(n: number) {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: FILLER.id }));
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave180-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function playableState(player: Player = 'self'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 180, player, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[player].case.colors = ['赤'];
  state.players[player].file = fileCards(7);
  state.players.self.deck = [FILLER.id, FILLER.id];
  state.players.opp.deck = [FILLER.id, FILLER.id];
  return state;
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave180: B08048 action declaration and one-shot enter check', () => {
  function installAction(): void {
    const state = playableState('self');
    state.players.self.scene = [sceneChar(B08048.id, 'camel')];
    state.players.opp.scene = [sceneChar(LEVEL_SEVEN.id, 'target', { state: 'sleep' })];
    install(state, 'self', 'B08048-action');
  }

  it('applies level -1 before the level-6 check, so a printed level-7 target grants AP +3000', () => {
    installAction();

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'camel', targetUid: 'target' }))
      .toEqual({ ok: true });

    expect(read.char.level(current(), 'target')).toBe(6);
    expect(read.char.ap(current(), 'camel')).toBe((B08048.ap ?? 0) + 3000);
  });

  it('resolves after the actor sleeps and before the public guard decision', () => {
    installAction();

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'camel', targetUid: 'target' }))
      .toEqual({ ok: true });

    expect(current().players.self.scene.find(character => character.uid === 'camel')?.state).toBe('sleep');
    expect(read.char.level(current(), 'target')).toBe(6);
    expect(read.char.ap(current(), 'camel')).toBe((B08048.ap ?? 0) + 3000);
    expect(useGameStateStore.getState().activeActionId).toBeTruthy();
  });

  it('does not grant Assault retroactively when another FBI character enters later', () => {
    const state = playableState('self');
    state.players.self.hand = [B08048.id, FBI_ALLY.id];
    install(state, 'self', 'B08048-enter-snapshot');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B08048.id }))
      .toEqual({ ok: true });
    const camelUid = current().players.self.scene.find(character => character.cardId === B08048.id)?.uid;
    expect(camelUid).toBeTruthy();
    expect(read.char.hasKeyword(current(), camelUid!, '突撃')).toBe(false);

    const later = structuredClone(current());
    const entered = mutate.scene.enter(later, 'self', FBI_ALLY.id, {});
    event.emit(later, 'enter', {
      uid: entered.uid, viaEffect: false,
      enterOrder: entered.enterOrder, enterOrderThisTurn: entered.enterOrderThisTurn,
    }, { player: 'self', uid: entered.uid, cardId: FBI_ALLY.id });
    runAllUntilEmpty(later);
    expect(useGameStateStore.getState().setGameState(later)).toBe(true);
    expect(read.char.hasKeyword(current(), camelUid!, '突撃')).toBe(false);
  });
});

describe('official QA Wave180: B08051 remove ownership and enter-time grant', () => {
  it('cannot pay from the opponent remove area, then succeeds from the owner remove area only', () => {
    const state = playableState('self');
    state.players.self.scene = [sceneChar(B08051.id, 'akai')];
    state.players.self.remove = [REMOVE_DECOY.id];
    state.players.opp.remove = [MOROBOSHI.id];
    install(state, 'self', 'B08051-owner-remove');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'akai', abilId: 'a2' }))
      .toEqual({ ok: false, reason: 'not-allowed' });

    const next = structuredClone(current());
    next.players.self.remove.push(MOROBOSHI.id);
    expect(useGameStateStore.getState().setGameState(next)).toBe(true);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'akai', abilId: 'a2' }))
      .toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

    expect(current().players.self.remove).not.toContain(MOROBOSHI.id);
    expect(current().players.self.deck.at(-1)).toBe(MOROBOSHI.id);
    expect(current().players.opp.remove).toEqual([MOROBOSHI.id]);
  });

  it('removes switch-out Akemi before evaluating the entering B08051 condition', () => {
    const state = playableState('self');
    state.players.self.hand = [B08051.id];
    state.players.self.scene = [
      sceneChar(AKEMI.id, 'akemi'),
      ...SWITCH_FILLERS.map((card, index) => sceneChar(card.id, `filler-${index}`)),
    ];
    install(state, 'self', 'B08051-switch-order');

    expect(dispatchEngineAction({
      type: 'handUseCardSwitch', player: 'self', cardId: B08051.id, removeUid: 'akemi',
    })).toEqual({ ok: true });

    const akaiUid = current().players.self.scene.find(character => character.cardId === B08051.id)?.uid;
    expect(current().players.self.remove).toContain(AKEMI.id);
    expect(akaiUid).toBeTruthy();
    expect(read.char.hasKeyword(current(), akaiUid!, '突撃')).toBe(true);
  });

  it('does not grant Assault when Akemi reaches remove only after B08051 entered', () => {
    const state = playableState('self');
    state.players.self.hand = [SWITCH_IN.id];
    state.players.self.scene = [
      sceneChar(B08051.id, 'akai'),
      sceneChar(AKEMI.id, 'akemi'),
      ...SWITCH_FILLERS.slice(0, 3).map((card, index) => sceneChar(card.id, `filler-${index}`)),
    ];
    install(state, 'self', 'B08051-late-akemi');

    expect(read.char.hasKeyword(current(), 'akai', '突撃')).toBe(false);

    expect(dispatchEngineAction({
      type: 'handUseCardSwitch', player: 'self', cardId: SWITCH_IN.id, removeUid: 'akemi',
    })).toEqual({ ok: true });
    expect(current().players.self.remove).toContain(AKEMI.id);
    expect(read.char.hasKeyword(current(), 'akai', '突撃')).toBe(false);
  });

  it('keeps the granted Assault after Akemi leaves the remove area', () => {
    const state = playableState('self');
    state.players.self.hand = [B08051.id];
    state.players.self.scene = [sceneChar(AKEMI_MOVER.id, 'mover')];
    state.players.self.remove = [AKEMI.id];
    install(state, 'self', 'B08051-grant-persists');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B08051.id }))
      .toEqual({ ok: true });
    const akaiUid = current().players.self.scene.find(character => character.cardId === B08051.id)?.uid;
    expect(akaiUid).toBeTruthy();
    expect(read.char.hasKeyword(current(), akaiUid!, '突撃')).toBe(true);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'mover', abilId: 'a1' }))
      .toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.remove).not.toContain(AKEMI.id);
    expect(read.char.hasKeyword(current(), akaiUid!, '突撃')).toBe(true);
  });
});

describe('official QA Wave180: B08055 opponent-turn Cut-In', () => {
  it('is usable on the opponent turn, but only removes the Cut-In itself and changes no AP', () => {
    const state = playableState('opp');
    state.players.opp.scene = [sceneChar(CONTACT_ATTACKER.id, 'attacker')];
    state.players.self.scene = [sceneChar(CONTACT_TARGET.id, 'target', { state: 'sleep' })];
    state.players.self.hand = [B08055.id, DISCARD_AP4000.id];
    install(state, 'self', 'B08055-opponent-turn');

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'target' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(current().actionContexts?.[actionId]).toMatchObject({ phase: 'action-1', firstUid: 'target' });
    const attackerAP = read.char.ap(current(), 'attacker');
    const targetAP = read.char.ap(current(), 'target');

    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: 'self',
      choice: { kind: 'cutin', cardId: B08055.id },
    })).toEqual({ ok: true });

    expect(current().players.self.remove).toEqual([B08055.id]);
    expect(current().players.self.hand).toEqual([DISCARD_AP4000.id]);
    expect(read.char.ap(current(), 'attacker')).toBe(attackerAP);
    expect(read.char.ap(current(), 'target')).toBe(targetAP);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});

describe('official QA Wave180: owner=opp public mirrors', () => {
  it('mirrors B08048 action sequencing and its one-shot FBI enter condition', () => {
    const actionState = playableState('opp');
    actionState.players.opp.scene = [sceneChar(B08048.id, 'opp-camel')];
    actionState.players.self.scene = [sceneChar(LEVEL_SEVEN.id, 'self-target', { state: 'sleep' })];
    install(actionState, 'opp', 'B08048-opp-action');

    expect(dispatchEngineAction({
      type: 'actionDeclareChar', byUid: 'opp-camel', targetUid: 'self-target',
    })).toEqual({ ok: true });
    expect(read.char.level(current(), 'self-target')).toBe(6);
    expect(read.char.ap(current(), 'opp-camel')).toBe((B08048.ap ?? 0) + 3000);

    const enterState = playableState('opp');
    enterState.players.opp.hand = [B08048.id];
    install(enterState, 'opp', 'B08048-opp-enter');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'opp', cardId: B08048.id }))
      .toEqual({ ok: true });
    const camelUid = current().players.opp.scene.find(character => character.cardId === B08048.id)?.uid;
    expect(camelUid).toBeTruthy();

    const later = structuredClone(current());
    const entered = mutate.scene.enter(later, 'opp', FBI_ALLY.id, {});
    event.emit(later, 'enter', {
      uid: entered.uid, viaEffect: false,
      enterOrder: entered.enterOrder, enterOrderThisTurn: entered.enterOrderThisTurn,
    }, { player: 'opp', uid: entered.uid, cardId: FBI_ALLY.id });
    runAllUntilEmpty(later);
    expect(useGameStateStore.getState().setGameState(later)).toBe(true);
    expect(read.char.hasKeyword(current(), camelUid!, '突撃')).toBe(false);
  });

  it('mirrors B08051 remove ownership and switch-before-enter ordering', () => {
    const costState = playableState('opp');
    costState.players.opp.scene = [sceneChar(B08051.id, 'opp-akai')];
    costState.players.opp.remove = [REMOVE_DECOY.id];
    costState.players.self.remove = [MOROBOSHI.id];
    install(costState, 'opp', 'B08051-opp-cost');

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'opp-akai', abilId: 'a2' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    const payable = structuredClone(current());
    payable.players.opp.remove.push(MOROBOSHI.id);
    expect(useGameStateStore.getState().setGameState(payable)).toBe(true);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'opp-akai', abilId: 'a2' }))
      .toEqual({ ok: true });
    expect(current().players.opp.deck.at(-1)).toBe(MOROBOSHI.id);
    expect(current().players.self.remove).toEqual([MOROBOSHI.id]);

    const switchState = playableState('opp');
    switchState.players.opp.hand = [B08051.id];
    switchState.players.opp.scene = [
      sceneChar(AKEMI.id, 'opp-akemi'),
      ...SWITCH_FILLERS.map((card, index) => sceneChar(card.id, `opp-filler-${index}`)),
    ];
    install(switchState, 'opp', 'B08051-opp-switch');
    expect(dispatchEngineAction({
      type: 'handUseCardSwitch', player: 'opp', cardId: B08051.id, removeUid: 'opp-akemi',
    })).toEqual({ ok: true });
    const enteredAkai = current().players.opp.scene.find(character => character.cardId === B08051.id)?.uid;
    expect(current().players.opp.remove).toContain(AKEMI.id);
    expect(read.char.hasKeyword(current(), enteredAkai!, '突撃')).toBe(true);
  });

  it('mirrors B08055 inactive Cut-In with the card owner on opp', () => {
    const state = playableState('self');
    state.players.self.scene = [sceneChar(CONTACT_ATTACKER.id, 'self-attacker')];
    state.players.opp.scene = [sceneChar(CONTACT_TARGET.id, 'opp-target', { state: 'sleep' })];
    state.players.opp.hand = [B08055.id, DISCARD_AP4000.id];
    install(state, 'opp', 'B08055-opp-owner');

    expect(dispatchEngineAction({
      type: 'actionDeclareChar', byUid: 'self-attacker', targetUid: 'opp-target',
    })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    const attackerAP = read.char.ap(current(), 'self-attacker');

    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: 'opp',
      choice: { kind: 'cutin', cardId: B08055.id },
    })).toEqual({ ok: true });
    expect(current().players.opp.remove).toEqual([B08055.id]);
    expect(current().players.opp.hand).toEqual([DISCARD_AP4000.id]);
    expect(read.char.ap(current(), 'self-attacker')).toBe(attackerAP);
  });
});
