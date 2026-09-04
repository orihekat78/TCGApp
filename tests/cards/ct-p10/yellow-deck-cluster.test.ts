// CT-P10 yellow deck cluster — production dispatch / real resolver coverage.
// rules: 14-refresh, 15-abilities-effects, 17-icons, 21-declared-ability-cost, 26-qa-deck-refresh

import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event';
import { run as runEffect } from '@/engine/effect/resolver';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { read } from '@/engine/read';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { runCardScenario } from '../../helpers/card-probe-harness';
import { B10072 } from '@/cards/ct-p10/B10072';
import { B10073 } from '@/cards/ct-p10/B10073';
import { B10077 } from '@/cards/ct-p10/B10077';
import type { CardDef, EffectCtx, GameState, SceneCharacter } from '@/engine/types';

function character(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黄'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function eventCard(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'event', names: [id], colors: ['黄'], level: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function scene(cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter {
  return {
    cardId, uid, state, isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  } as SceneCharacter;
}

function ctx(cardId: string, uid = 'src#1', area: 'scene' | 'hand' = 'scene'): EffectCtx {
  return { source: { player: 'self', cardId, uid, abilityId: 'a1', area }, bindings: {} } as EffectCtx;
}

function selfMain(s: GameState): void {
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectPickQueue();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(B10072);
  registerCardDef(B10073);
  registerCardDef(B10077);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
});

describe('B10072 アラン・カッセル', () => {
  it('revealed remainder keeps order without a reorder modal, then shuffles', () => {
    const first = character('ALAN_FIRST_DECOY', { level: 3, traits: ['警察'] });
    const second = eventCard('ALAN_SECOND_DECOY', { level: 5, traits: ['警察'] });
    const match = character('ALAN_PRESERVE_MATCH', { level: 4, traits: ['警察'] });
    [first, second, match].forEach(registerCardDef);
    const s = createEmptyGameState();
    selfMain(s);
    s.players.self.deck = [first.id, second.id, match.id];

    runEffect(s, B10072.abilities[0]!.effect!, ctx('B10072', 'alan#1'));

    expect(s.players.self.hand).toEqual([match.id]);
    expect(_drainPendingDeckReorderSide()).toBeNull();
    expect(s.log.some(entry => entry.action === 'effect:deckShuffle')).toBe(true);
  });

  it('declared self-to-bottom: first eligible Lv4/5 cafe/police/boy detective character is forced into hand; decoy is not', () => {
    const match = character('ALAN_MATCH', { level: 4, traits: ['警察'] });
    const wrongLevel = character('ALAN_WRONG_LEVEL', { level: 3, traits: ['警察'] });
    const wrongKind = eventCard('ALAN_EVENT_DECOY', { level: 5, traits: ['警察'] });
    const after = runCardScenario(B10072, [match, wrongLevel, wrongKind], {
      setup: {
        selfScene: [{ cardId: 'B10072', uid: 'alan#1' }],
        deckTop: [wrongLevel.id, wrongKind.id, match.id], deckSize: 1,
      },
      drive: { kind: 'declared', uid: 'alan#1', abilityId: 'a1' },
      expect: [
        { kind: 'zone', cardId: match.id, zone: 'hand', side: 'self', present: true },
        { kind: 'zone', cardId: wrongLevel.id, zone: 'deck', side: 'self', present: true },
        { kind: 'zone', cardId: wrongKind.id, zone: 'deck', side: 'self', present: true },
        { kind: 'zone', cardId: 'B10072', zone: 'deck', side: 'self', present: true },
      ],
    });
    expect(after.players.self.hand).toEqual([match.id]);
  });

  it('declared reveal-until: zero matching cards adds nothing and returns every revealed card to deck', () => {
    const wrongLevel = character('ALAN_ZERO_LEVEL', { level: 2, traits: ['警察'] });
    const wrongTrait = character('ALAN_ZERO_TRAIT', { level: 5, traits: ['FBI'] });
    const after = runCardScenario(B10072, [wrongLevel, wrongTrait], {
      setup: {
        selfScene: [{ cardId: 'B10072', uid: 'alan#1' }],
        deckTop: [wrongLevel.id, wrongTrait.id], deckSize: 1,
      },
      drive: { kind: 'declared', uid: 'alan#1', abilityId: 'a1' },
      expect: [
        { kind: 'zone', cardId: wrongLevel.id, zone: 'deck', side: 'self', present: true },
        { kind: 'zone', cardId: wrongTrait.id, zone: 'deck', side: 'self', present: true },
      ],
    });
    // qa: card:B10072:2db8ec1f638c08e23b42d65f6f30eefe718d29bc0803d402cea6f45014edb6fa
    expect({
      hand: after.players.self.hand,
      deck: [...after.players.self.deck].sort(),
      shuffled: after.log.some(entry => entry.action === 'effect:deckShuffle'),
    }).toEqual({
      hand: [],
      deck: ['ALAN_ZERO_LEVEL', 'ALAN_ZERO_TRAIT', 'B10072', '__DECK_S_0'].sort(),
      shuffled: true,
    });
  });

  it('hirameki can sleep one real scene character, or choose zero', () => {
    const target = character('ALAN_TARGET');
    const decoy = character('ALAN_DECOY');
    registerCardDef(target); registerCardDef(decoy);
    const resolve = (skip: boolean) => produce(createEmptyGameState(), (d) => {
      selfMain(d);
      d.players.self.scene = [scene(target.id, 'target#1')];
      d.players.opp.scene = [scene(decoy.id, 'decoy#1')];
      runEffect(d, B10072.abilities[1]!.effect, ctx('B10072'));
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick).not.toBeNull();
      expect(pick!.candidates.map((c) => c.cardId)).toEqual(expect.arrayContaining([target.id, decoy.id]));
      if (skip) applyPickSkipAndContinuation(d, pick!, false);
      else applyPickAndContinuation(d, pick!, 'target#1');
      runAllUntilEmpty(d);
    });
    expect(resolve(false).players.self.scene[0]!.state).toBe('sleep');
    expect(resolve(true).players.self.scene[0]!.state).toBe('active');
  });
});

describe('B10073 鬼塚八蔵', () => {
  it('draws only in resolve case when a character ability enters it; event source and incident case are decoys', () => {
    const summoner = character('ONIZUKA_SUMMONER');
    const eventSource = eventCard('ONIZUKA_EVENT');
    registerCardDef(summoner); registerCardDef(eventSource);
    const summon = (caseStatus: '事件編' | '解決編', source: CardDef): GameState => produce(createEmptyGameState(), (d) => {
      selfMain(d);
      d.players.self.case.status = caseStatus;
      d.players.self.deck = ['__DRAW__'];
      registerCardDef(character('__DRAW__'));
      d.players.self.remove = ['B10073'];
      if (source.kind === 'character') d.players.self.scene = [scene(source.id, 'summoner#1')];
      runEffect(d, { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'B10073', viaEffect: true, target: { query: { area: 'remove', side: 'self' } } } }, ctx(source.id, 'summoner#1', source.kind === 'event' ? 'hand' : 'scene'));
      runAllUntilEmpty(d);
    });
    expect(summon('解決編', summoner).players.self.hand).toEqual(['__DRAW__']);
    expect(summon('解決編', eventSource).players.self.hand).toEqual([]);
    expect(summon('事件編', summoner).players.self.hand).toEqual([]);
  });

  it('hirameki returns one named police character from remove, excludes event/name decoys, and permits zero', () => {
    const eligible = character('ONIZUKA_ELIGIBLE', { names: ['降谷零'] });
    const wrongName = character('ONIZUKA_WRONG_NAME', { names: ['工藤新一'] });
    const eventDecoy = eventCard('ONIZUKA_EVENT_DECOY', { names: ['降谷零'] });
    [eligible, wrongName, eventDecoy].forEach(registerCardDef);
    const resolve = (skip: boolean) => produce(createEmptyGameState(), (d) => {
      selfMain(d);
      d.players.self.remove = [eligible.id, wrongName.id, eventDecoy.id];
      runEffect(d, B10073.abilities[1]!.effect, ctx('B10073'));
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick).not.toBeNull();
      expect(pick!.candidates.map((c) => c.cardId)).toEqual([eligible.id]);
      if (skip) applyPickSkipAndContinuation(d, pick!, false);
      else applyPickAndContinuation(d, pick!, pick!.candidates[0]!.uid);
      runAllUntilEmpty(d);
    });
    expect(resolve(false).players.self.hand).toEqual([eligible.id]);
    expect(resolve(true).players.self.hand).toEqual([]);
  });
});

describe('B10077 萩原研二', () => {
  it('bond 松田陣平 gives AP+1000 only on own turn', () => {
    const bond = character('MATSDA', { names: ['松田陣平'] });
    registerCardDef(bond);
    const s = createEmptyGameState();
    selfMain(s);
    s.players.self.scene = [scene('B10077', 'hagiwara#1'), scene(bond.id, 'matsuda#1')];
    expect(read.char.ap(s, 'hagiwara#1')).toBe(4000);
    s.turn.player = 'opp';
    expect(read.char.ap(s, 'hagiwara#1')).toBe(3000);
    s.turn.player = 'self';
    s.players.self.scene = [scene('B10077', 'hagiwara#1')];
    expect(read.char.ap(s, 'hagiwara#1')).toBe(3000);
  });

  it('on enter looks at exactly three, may take one named police character, and removes every unchosen card', () => {
    const eligible = character('HAGIWARA_ELIGIBLE', { names: ['伊達航'] });
    const wrongName = character('HAGIWARA_WRONG_NAME', { names: ['工藤新一'] });
    const eventDecoy = eventCard('HAGIWARA_EVENT_DECOY', { names: ['伊達航'] });
    runCardScenario(B10077, [eligible, wrongName, eventDecoy], {
      setup: {
        selfScene: [{ cardId: 'B10077', uid: 'hagiwara#1' }],
        deckTop: [wrongName.id, eventDecoy.id, eligible.id], deckSize: 1,
      },
      drive: { kind: 'enter', cardId: 'B10077', uid: 'hagiwara#1' },
      script: [{ pickCardId: eligible.id }],
      expect: [
        { kind: 'candidatesExclude', pickIndex: 0, cardId: wrongName.id },
        { kind: 'candidatesExclude', pickIndex: 0, cardId: eventDecoy.id },
        { kind: 'zone', cardId: eligible.id, zone: 'hand', side: 'self', present: true },
        { kind: 'zone', cardId: wrongName.id, zone: 'remove', side: 'self', present: true },
        { kind: 'zone', cardId: eventDecoy.id, zone: 'remove', side: 'self', present: true },
      ],
    });
  });

  it('on enter permits declining an eligible card; it is removed with the rest', () => {
    const eligible = character('HAGIWARA_DECLINE', { names: ['萩原研二'] });
    const fillers = ['HAGIWARA_FILL_1', 'HAGIWARA_FILL_2', 'HAGIWARA_FILL_3'].map(character);
    registerCardDef(eligible); fillers.forEach(registerCardDef);
    const after = produce(createEmptyGameState(), (d) => {
      selfMain(d);
      d.players.self.deck = [eligible.id, ...fillers.map((f) => f.id)];
      runEffect(d, B10077.abilities[1]!.effect, ctx('B10077'));
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick?.candidates.map((c) => c.cardId)).toEqual([eligible.id]);
      // deckRevealUntil の「0枚選択」は atom を declined 状態で再実行し、全3枚を残りへ戻す。
      applyPickSkipAndContinuation(d, pick!);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand).not.toContain(eligible.id);
    expect(after.players.self.remove).toContain(eligible.id);
  });
});
