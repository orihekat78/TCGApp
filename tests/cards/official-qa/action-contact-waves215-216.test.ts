import { beforeEach, describe, expect, it } from 'vitest';
import { B01028 } from '@/cards/ct-p01/B01028';
import { B01032 } from '@/cards/ct-p01/B01032';
import { B02012 } from '@/cards/ct-p02/B02012';
import { B02022 } from '@/cards/ct-p02/B02022';
import { B02047 } from '@/cards/ct-p02/B02047';
import { B02068 } from '@/cards/ct-p02/B02068';
import { B02079 } from '@/cards/ct-p02/B02079';
import { B03017 } from '@/cards/ct-p03/B03017';
import { B03030 } from '@/cards/ct-p03/B03030';
import { B03047 } from '@/cards/ct-p03/B03047';
import { B03073 } from '@/cards/ct-p03/B03073';
import { B04037 } from '@/cards/ct-p04/B04037';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { advance, declare, passGuard, tryGuard } from '@/engine/flow/action/state-machine';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { makeChar } from '../../helpers/fixtures';

const TARGET = 'W215_TARGET';
const DRAW = 'W215_DRAW';
const MOURI = 'W215_MOURI';
const WHITE_LP2 = 'W215_WHITE_LP2';
const KYOGOKU = 'W215_KYOGOKU';
const ENTRY = 'W216_ENTRY';
const BOND = 'W216_BOND';
const BOY = 'W216_BOY';
const RED = 'W215_RED';

function fixture(id: string, patch: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...patch,
  };
}

const FIXTURES = [
  fixture(TARGET, { ap: 1000 }), fixture(DRAW),
  fixture(MOURI, { traits: ['毛利探偵事務所'] }),
  fixture(WHITE_LP2, { colors: ['白'], lp: 2 }),
  fixture(KYOGOKU, { names: ['京極真'], ap: 7000 }),
  fixture(ENTRY, { colors: ['緑'], level: 6 }),
  fixture(BOND, { names: ['大岡紅葉'] }), fixture(BOY, { traits: ['少年探偵団'] }),
  fixture(RED, { colors: ['赤'] }),
];

function state(): GameState {
  const value = createEmptyGameState();
  value.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  value.players.self.deck = [DRAW, DRAW, DRAW, DRAW];
  value.players.opp.deck = [DRAW, DRAW];
  value.players.self.case.colors = ['白', '赤'];
  value.players.self.file = Array.from({ length: 7 }, () => ({ type: 'card-back' as const, cardId: DRAW }));
  value.players.opp.case = { cardId: 'W215_CASE', status: '事件編', requiredEvidence: 6, colors: ['青'], declaredUseCount: {} };
  return value;
}

function emit(value: GameState, hook: string, payload: object, uid: string, player: 'self' | 'opp' = 'self'): void {
  event.emit(value, hook as never, payload as never, { player, uid });
  runAllUntilEmpty(value);
}

function declareAndResolve(value: GameState, byUid: string, targetUid: string) {
  const action = declare(value, byUid, { kind: 'char', uid: targetUid });
  runAllUntilEmpty(value);
  return action;
}

function startContact(value: GameState, action: ReturnType<typeof declare>): void {
  passGuard(value, action);
  advance(value, action);
  advance(value, action);
  runAllUntilEmpty(value);
}

beforeEach(() => {
  resetPendingRuntimeState();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  for (const card of [B01028, B01032, B02012, B02022, B02047, B02068, B02079, B03017, B03030, B03047, B03073, B04037, ...FIXTURES]) register(card);
  registerTriggeredListener();
});

describe('official QA Wave215: action/contact contracts', () => {
  it('starts B01028 contact effects only after target selection and excludes that target from guarding', () => {
    const value = state();
    value.players.self.scene = [makeChar({ cardId: B01028.id, uid: 'heiji' })];
    value.players.opp.scene = [makeChar({ cardId: TARGET, uid: 'active-target', state: 'active' })];
    emit(value, 'action:pre-target', { byUid: 'heiji' }, 'heiji');
    const action = declareAndResolve(value, 'heiji', 'active-target');
    // qa: card:B01028:c07c3f8ad74eff2c29025e058e4559422062b44dae7e59dbe57af843b2fadb0a
    expect(() => tryGuard(value, action, 'active-target')).toThrow('invalid guard');
    value.players.opp.scene[0]!.state = 'sleep';
    startContact(value, action);
    // qa: card:B01028:f8f92580279cc9760dae09ab4c6c90d61a91bdde20c47a6cb140b1f46bec648a
    expect(readChar.ap(value, 'heiji')).toBe(8000);
  });

  it('resolves action declaration triggers before the guard window', () => {
    const value = state();
    value.players.self.scene = [makeChar({ cardId: B01032.id, uid: 'source' })];
    value.players.opp.scene = [makeChar({ cardId: TARGET, uid: 'target', state: 'sleep' })];
    const action = declareAndResolve(value, 'source', 'target');
    // qa: card:B01032:1abf59f7026ebf3a0a1a1da2de531586be8c76dad0a136b6cb2be1a3dc9e07a9
    expect({ ap: readChar.ap(value, 'source'), phase: action.phase }).toEqual({ ap: 4000, phase: 'guard-window' });
  });

  it('draws for B02012 when its qualifying scene character declares an action', () => {
    const value = state();
    value.players.self.scene = [makeChar({ cardId: B02012.id, uid: 'kogoro' }), makeChar({ cardId: MOURI, uid: 'actor' })];
    value.players.opp.scene = [makeChar({ cardId: TARGET, uid: 'target', state: 'sleep' })];
    const handBefore = value.players.self.hand.length;
    const action = declareAndResolve(value, 'actor', 'target');
    // qa: card:B02012:7bb83a4dd3d868ca118ca398cb342dc81f74acde2b3fbde7bcac3783bb378d33
    expect({ hand: value.players.self.hand.length - handBefore, phase: action.phase }).toEqual({ hand: 1, phase: 'guard-window' });
  });

  it('limits B02047 contact immunity to AP judgement in its current action', () => {
    const value = state();
    value.players.self.scene = [makeChar({ cardId: B02047.id, uid: 'yukiko' })];
    emit(value, 'disguise:into', { player: 'self', replacedChar: makeChar({ cardId: WHITE_LP2, uid: 'old' }), replacedEffective: { lp: 2 } }, 'yukiko');
    // qa: card:B02047:398a5969fe581da3a0acd13503e5ba93ff177775f17125cca57fe30166b6ce7f
    expect(value.players.self.scene[0]!.turnEffects.contactImmune_action).toBe(true);
    mutate.scene.removeToRemove(value, 'yukiko', 'effect');
    // qa: card:B02047:999748daa6842b2bbf95ddf662d797a9128a1ba78a53900a9459d6f028384d0f
    expect(value.players.self.remove).toContain(B02047.id);
  });

  it('grants B02068 action-case ability at declaration before any guard decision', () => {
    const value = state();
    value.players.self.scene = [makeChar({ cardId: RED, uid: 'event-host' })];
    runEffect(value, B02068.abilities[0]!.effect, { source: { player: 'self', area: 'hand', cardId: B02068.id }, bindings: {} } as never);
    runAllUntilEmpty(value);
    const pick = _drainPendingEffectPickSide();
    expect(pick?.candidates.map(candidate => candidate.uid)).toContain('event-host');
    applyPickAndContinuation(value, pick!, 'event-host');
    runAllUntilEmpty(value);
    // qa: card:B02068:1d608f5d9e57b3e1737fa4f79c511a62a995fc109cd42e67c5b024b0bfe34bd0
    expect(value.players.self.scene[0]!.turnEffects.grantedAbilities).toEqual(expect.any(Array));
  });

  it('fires B02079 for its own police participant at contact start', () => {
    const value = state();
    value.players.self.scene = [makeChar({ cardId: B02079.id, uid: 'chiba' })];
    value.players.opp.scene = [makeChar({ cardId: TARGET, uid: 'target', state: 'sleep' })];
    emit(value, 'contact:start', { aUid: 'chiba', bUid: 'target' }, 'chiba');
    const pick = _drainPendingEffectPickSide();
    // qa: card:B02079:80cadd9219ae958dbd33f6eaa15d64043ae89fb1922a6c9a48432e0e0d39f0d8
    // qa: card:B02079:aa4581716c88c17fd1da109a5f5c363a6b8acebe0c8bf0803e8798822e32b9a3
    expect(pick?.source).toMatchObject({ cardId: B02079.id, abilityId: 'a1' });
  });
});

describe('official QA Wave216: action/contact contracts', () => {
  it('does not require an active B02022 as an action target', () => {
    const value = state();
    value.players.self.scene = [makeChar({ cardId: TARGET, uid: 'actor' })];
    value.players.opp.scene = [makeChar({ cardId: B02022.id, uid: 'onimaru', state: 'active' }), makeChar({ cardId: TARGET, uid: 'sleep', state: 'sleep' })];
    emit(value, 'action:pre-target', { byUid: 'actor' }, 'actor');
    // qa: card:B02022:e0bb761f96db8f55d74b27f173698215cd297b32509c87b6f75f8cf2b5c78fd4
    expect(() => declareAndResolve(value, 'actor', 'sleep')).not.toThrow();
  });

  it('cannot reopen the guard choice after B03017 activates during contact', () => {
    const value = state();
    value.turn.player = 'opp';
    value.players.self.scene = [makeChar({ cardId: BOY, uid: 'boy', state: 'sleep' })];
    value.players.self.hand = [B03017.id];
    value.players.opp.scene = [makeChar({ cardId: TARGET, uid: 'actor' }), makeChar({ cardId: TARGET, uid: 'target', state: 'sleep' })];
    const action = declareAndResolve(value, 'actor', 'boy');
    startContact(value, action);
    runEffect(value, B03017.abilities[0]!.effect, { source: { player: 'self', area: 'hand', cardId: B03017.id }, bindings: {} } as never);
    runAllUntilEmpty(value);
    const pick = _drainPendingEffectPickSide();
    applyPickAndContinuation(value, pick!, 'boy');
    runAllUntilEmpty(value);
    // qa: card:B03017:f17a420b5c1d0966358e78a89070da5f71c3cc0cf6fdacbeeda23133ab33557c
    expect({ state: value.players.self.scene[0]!.state, phase: action.phase }).toEqual({ state: 'active', phase: 'action-1' });
  });

  it('keeps B03030 protected from opponent effects, declares before guard, and offers a scene switch at five', () => {
    const value = state();
    value.players.self.scene = [makeChar({ cardId: B03030.id, uid: 'iori' }), makeChar({ cardId: BOND, uid: 'bond' }), makeChar({ cardId: TARGET, uid: 'fill-1' }), makeChar({ cardId: TARGET, uid: 'fill-2' }), makeChar({ cardId: TARGET, uid: 'fill-3' })];
    value.players.self.hand = [ENTRY];
    value.players.opp.scene = [makeChar({ cardId: TARGET, uid: 'target', state: 'sleep' })];
    const action = declareAndResolve(value, 'iori', 'target');
    // qa: card:B03030:b203c71c5a2ca8e57b36312ceddefe99ca091d50acdc98837bcbc27a0703471a
    // qa: card:B03030:e2cb37e2c028ff918b6b633c47ea158ba3011ae3224e50c5e12a27b93a41c1ae
    expect(action.phase, B03030.id).toBe('guard-window');
    const pick = _drainPendingEffectPickSide();
    // qa: card:B03030:231ae172911d4f51971229ee61c6c2835feb5f0b64c3dc2c776ee3f083d4688b
    expect(pick?.candidates.map(candidate => candidate.cardId)).toContain(ENTRY);
  });

  it('reactivates B03047 after a qualifying guard so it can action again', () => {
    const value = state();
    value.players.self.scene = [makeChar({ cardId: B03047.id, uid: 'kyogoku' })];
    value.players.opp.scene = [makeChar({ cardId: TARGET, uid: 'target', state: 'sleep' }), makeChar({ cardId: TARGET, uid: 'guard', state: 'active' })];
    const action = declareAndResolve(value, 'kyogoku', 'target');
    tryGuard(value, action, 'guard');
    runAllUntilEmpty(value);
    // qa: card:B03047:544903ac7c42c348bfd3ce1d6aff8ba6055ff49dc3d98b253b602eef8bf1c80f
    expect(value.players.self.scene[0]!.state).toBe('active');
  });

  it('enforces B03073 action-end removal, optional entry, and source presence', () => {
    const value = state();
    value.players.self.scene = [makeChar({ cardId: B03073.id, uid: 'ethan' })];
    value.players.self.deck = [ENTRY];
    emit(value, 'action:end', { byUid: 'ethan', result: 'completed' }, 'ethan');
    const pick = _drainPendingEffectPickSide();
    // qa: card:B03073:23ca5ab05a35a61111b742d4dcee854a3644821d1d990917d59cfbfa41d59dc3
    expect(value.players.self.remove).toContain(B03073.id);
    // qa: card:B03073:44777d8ba382ec95367567c446334659fa629da64b9950df4bc3ccb54f141551
    expect(pick?.nMin).toBe(0);
    applyPickSkipAndContinuation(value, pick!, true);
    const absent = state();
    absent.players.self.deck = [ENTRY];
    emit(absent, 'action:end', { byUid: 'gone', result: 'completed' }, 'gone');
    // qa: card:B03073:5442976d1b52dceda3abfa3d2d5b67e7dbc4ed09cf0fadc016471f828ca488dd
    expect(absent.players.self.remove).toEqual([]);
  });

  it('keeps B04037 immunity scoped to one contact and spends the trigger when declined', () => {
    const value = state();
    value.turn.player = 'opp';
    value.players.self.scene = [makeChar({ cardId: B04037.id, uid: 'sonoko' }), makeChar({ cardId: KYOGOKU, uid: 'kyogoku' })];
    value.players.self.hand = [B04037.id];
    value.players.opp.scene = [makeChar({ cardId: TARGET, uid: 'opponent' })];
    emit(value, 'contact:start', { aUid: 'opponent', bUid: 'kyogoku' }, 'opponent', 'opp');
    const removedBefore = value.players.self.remove.filter(cardId => cardId === B04037.id).length;
    emit(value, 'contact:start', { aUid: 'opponent', bUid: 'kyogoku' }, 'opponent', 'opp');
    // qa: card:B04037:7b53030ada2a07e81d7ea1dfdce5a719dc40f33758dfd5f6de7dd5468b58d8eb
    expect(value.players.self.remove.filter(cardId => cardId === B04037.id).length).toBe(removedBefore);
    value.players.self.scene[1]!.turnEffects.contactImmune_action = true;
    mutate.scene.removeToRemove(value, 'kyogoku', 'effect');
    // qa: card:B04037:0e1cb2486a3695db853b8bc36c238c581c33fbcf2389274f56a4f35b7dcfdfdc
    expect(value.players.self.remove).toContain(KYOGOKU);
    // qa: card:B04037:ef4ee81a3ed597a8c981851f7a9daac5c657a4a2f1cf2d9a1440637e60fca9bb
    expect(value.players.self.scene.some(card => card.uid === 'kyogoku')).toBe(false);
  });
});
