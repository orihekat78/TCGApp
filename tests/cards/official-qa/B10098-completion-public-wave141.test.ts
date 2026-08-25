// qa: card:B10098:0022106a43764f3ac81c3e8d5e4d4c1f5bfc49acedbbfb228e454807752361d7
// qa: card:B10098:8270b12479bcdb4866a43f3a480e6571cfb6333ea4f4c3e1c59bbbe659dad545
// qa: card:B10098:93124d913071a04a7dc261334bd1722376911cd4bb21a79cb2f264ed0d2f567d
// qa: card:B10098:aad6b96d24d2f129858d5d76ea0b197267690bcdad3bd82efeacd4af725ff614
// qa: card:B10098:ea0d46011bfcd4c7f085f2edcb82aaaf6f5e6e85905331a6addb18489ca201ff

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { registerAll } from '@/cards';
import { B10098 } from '@/cards/ct-p10/B10098';
import { B10098P } from '@/cards/ct-p10/B10098P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, ActionContext, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['緑'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const iconAssault: AbilityDef = {
  id: 'icon-assault', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '緑' },
  continuousModifier: { grantKeywords: () => ['突撃'], printedKeywordWhenIconValid: true },
  description: '【パートナー緑】〚突撃〛', ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};
const ordinaryAssault: AbilityDef = {
  id: 'ordinary-assault', type: 'continuous', scope: 'on-scene',
  continuousModifier: { grantKeywords: () => ['突撃'] },
  description: '条件成立中、このキャラは突撃を持つ。', ruleRefs: ['rules/15-abilities-effects.md'],
};

const GREEN_PARTNER = fixture('W141_GREEN_PARTNER', { kind: 'partner', level: undefined, ap: undefined, lp: 3 });
const PRINTED = fixture('W141_PRINTED', { names: ['服部平次'], level: 8, keywords: ['突撃'] });
const ICON_ACTIVE = fixture('W141_ICON_ACTIVE', { names: ['怪盗キッド'], level: 8, abilities: [iconAssault] });
const ICON_INACTIVE = fixture('W141_ICON_INACTIVE', {
  names: ['服部平次'], level: 8,
  abilities: [{ ...iconAssault, condition: { kind: 'partnerColor', color: '赤' } }],
});
const ORDINARY = fixture('W141_ORDINARY', { names: ['怪盗キッド'], level: 8, abilities: [ordinaryAssault] });
const ASSAULT_CHAR = fixture('W141_ASSAULT_CHAR', { names: ['服部平次'], level: 8, keywords: ['突撃[キャラ]'] });
const ASSAULT_CASE = fixture('W141_ASSAULT_CASE', { names: ['怪盗キッド'], level: 8, keywords: ['突撃[事件]'] });
const CONTACT = fixture('W141_CONTACT', { level: 8, ap: 5000 });
const LOW = fixture('W141_LOW', { level: 1, ap: 1000 });
const OPPONENT = fixture('W141_OPPONENT', { level: 7, ap: 3000 });
const TAIL = fixture('W141_TAIL');
const PRINTINGS = [B10098, B10098P] as const;
const PRINTING_OWNERS = PRINTINGS.flatMap(printing =>
  (['self', 'opp'] as const).map(owner => ({ printing, owner })));

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave141 state');
  return state;
}

function actionContext(actionId: string): ActionContext {
  const action = current().actionContexts?.[actionId];
  if (!action) throw new Error(`missing Wave141 action ${actionId}`);
  return action;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave141-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function declaredBoard(printing: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 37, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partner = { cardId: GREEN_PARTNER.id, state: 'active', location: 'partner-area' };
  state.players[owner].scene = [sceneChar(printing.id, 'source')];
  state.players[owner].remove = [PRINTED.id, ICON_ACTIVE.id, ICON_INACTIVE.id, ORDINARY.id, ASSAULT_CHAR.id, ASSAULT_CASE.id];
  state.players[owner].deck = [TAIL.id, TAIL.id];
  state.players[other(owner)].scene = [sceneChar(OPPONENT.id, 'active-target')];
  state.players[other(owner)].deck = [TAIL.id, TAIL.id];
  return state;
}

function contactBoard(printing: CardDef, owner: Player): GameState {
  const opponent = other(owner);
  const state = createEmptyGameState();
  state.players[owner].partnerAreaMR = sceneChar(printing.id, 'mr-source');
  state.players[owner].scene = [
    sceneChar(CONTACT.id, 'own-contact'),
    sceneChar(LOW.id, 'own-low', { state: 'sleep' }),
  ];
  state.players[opponent].scene = [
    sceneChar(OPPONENT.id, 'opp-attacker'),
    sceneChar(OPPONENT.id, 'opp-target', { state: 'sleep' }),
  ];
  state.players[owner].deck = [TAIL.id, TAIL.id];
  state.players[opponent].deck = [TAIL.id, TAIL.id];
  return state;
}

function pendingPick(verb: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending?.atomVerb).toBe(verb);
  return pending!;
}

function choose(pending: NonNullable<ReturnType<typeof pendingPick>>, uid: string): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
}

function startContact(owner: Player, role: 'attacker' | 'target' | 'guard'): string {
  if (role === 'attacker') {
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'own-contact', targetUid: 'opp-target' }))
      .toEqual({ ok: true });
  } else {
    expect(dispatchEngineAction({
      type: 'actionDeclareChar', byUid: 'opp-attacker', targetUid: role === 'target' ? 'own-contact' : 'own-low',
    })).toEqual({ ok: true });
  }
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({
    type: 'actionGuard', actionId, guarderUid: role === 'guard' ? 'own-contact' : null,
  })).toEqual({ ok: true });
  for (let step = 0; step < 8; step += 1) {
    surfacePendingSideChannels();
    if (useGameStateStore.getState().pendingEffectPick) return actionId;
    const action = actionContext(actionId);
    expect(['action-1', 'action-2', 'action-1-redo']).not.toContain(action.phase);
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('Wave141 contact:start did not surface its AP choice');
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
  for (const card of [GREEN_PARTNER, PRINTED, ICON_ACTIVE, ICON_INACTIVE, ORDINARY, ASSAULT_CHAR, ASSAULT_CASE, CONTACT, LOW, OPPONENT, TAIL]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave141: declared entry uses printed or active icon plain Assault only', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner', ({ printing, owner }) => {
    install(declaredBoard(printing, owner), owner, `${printing.id}-${owner}-declared`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    expect(current().players[owner].partnerAreaMR).toMatchObject({ cardId: printing.id, state: 'sleep' });
    const entry = pendingPick('sceneEnter');
    expect(entry.candidates.map(candidate => candidate.cardId)).toEqual([PRINTED.id, ICON_ACTIVE.id]);
    expect(entry.candidates.map(candidate => candidate.cardId)).not.toEqual(expect.arrayContaining([
      ICON_INACTIVE.id, ORDINARY.id, ASSAULT_CHAR.id, ASSAULT_CASE.id,
    ]));
    choose(entry, entry.candidates.find(candidate => candidate.cardId === ICON_ACTIVE.id)!.uid);

    const entered = current().players[owner].scene.find(character => character.cardId === ICON_ACTIVE.id);
    expect(entered).toMatchObject({ state: 'active', isNamed: true });
    expect(enumerateMoves(current(), owner).some(move =>
      move.kind === 'actionAgainstChar' && move.byUid === entered!.uid && move.targetUid === 'active-target'))
      .toBe(true);
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: entered!.uid, targetUid: 'active-target' }))
      .toEqual({ ok: true });
  });
});

describe('official QA Wave141: contact trigger precedes cut-in and covers every own role', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner buffs an attacking Lv8 character before contact choices', ({ printing, owner }) => {
    const state = contactBoard(printing, owner);
    state.turn = { number: 37, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    install(state, owner, `${printing.id}-${owner}-attacker`);
    const before = readChar.ap(current(), 'own-contact');

    const actionId = startContact(owner, 'attacker');
    const pending = pendingPick('charModifyAP');
    expect(actionContext(actionId).phase).toBe('contact-order-pending');
    expect(pending).toMatchObject({
      player: owner, source: { uid: `partnerMR:${owner}`, cardId: printing.id, abilityId: 'a2' },
    });
    expect(pending.candidates.map(candidate => candidate.uid)).toEqual(['own-contact']);
    expect(readChar.ap(current(), 'own-contact')).toBe(before);
    choose(pending, 'own-contact');
    expect(readChar.ap(current(), 'own-contact')).toBe(before + 2000);
  });

  it.each((['self', 'opp'] as const).flatMap(owner =>
    (['target', 'guard'] as const).map(role => ({ owner, role }))))(
    'owner $owner $role', ({ owner, role }) => {
      const state = contactBoard(B10098, owner);
      state.turn = { number: 37, player: other(owner), phase: 'main', isFirstPlayerFirstTurn: false };
      if (role === 'target') state.players[owner].scene.find(character => character.uid === 'own-contact')!.state = 'sleep';
      install(state, owner, `${owner}-${role}`);
      const before = readChar.ap(current(), 'own-contact');

      startContact(owner, role);
      const pending = pendingPick('charModifyAP');
      expect(pending.candidates.map(candidate => candidate.uid)).toEqual(['own-contact']);
      choose(pending, 'own-contact');
      expect(readChar.ap(current(), 'own-contact')).toBe(before + 2000);
      expect(readChar.ap(current(), 'opp-attacker')).toBe(OPPONENT.ap);
    },
  );
});
