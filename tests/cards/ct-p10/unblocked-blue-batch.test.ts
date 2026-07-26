import { beforeEach, describe, expect, it } from 'vitest';
import { B10005, B10005P } from '@/cards/ct-p10/B10005';
import { B10009 } from '@/cards/ct-p10/B10009';
import { B10011 } from '@/cards/ct-p10/B10011';
import { B10014, B10014P } from '@/cards/ct-p10/B10014';
import { applyOptionalAndContinuation, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue, _drainPendingEffectOptionalSide, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';

const RAN: CardDef = {
  id: 'B10009-RAN', no: 'B10009-RAN', kind: 'character', names: ['毛利蘭'], colors: ['青'], level: 1, ap: 1000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

const globals = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };

function enteringB10009State(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.hand = [RAN.id];
  state.players.self.scene = [{
    cardId: B10009.id, uid: 'b10009', state: 'active', isNamed: false,
    enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: [],
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  } as SceneCharacter];
  return state;
}

function resolveB10009HumanEnter(revealRan: boolean): GameState {
  const state = enteringB10009State();
  event.emit(
    state,
    'enter',
    { uid: 'b10009', viaEffect: false, enterOrder: 1, enterOrderThisTurn: 1, sourceCardId: undefined },
    { player: 'self', uid: 'b10009', cardId: B10009.id },
  );
  runAllUntilEmpty(state);

  const optional = _drainPendingEffectOptionalSide();
  expect(optional).toBeTruthy();
  applyOptionalAndContinuation(state, optional!, true);
  runAllUntilEmpty(state);

  const pick = _drainPendingEffectPickSide();
  expect(pick).toMatchObject({ atomVerb: 'handReveal', nMin: 0, candidates: [{ cardId: RAN.id }] });
  if (revealRan) applyPickAndContinuation(state, pick!, pick!.candidates[0]!.uid);
  else applyPickSkipAndContinuation(state, pick!);
  runAllUntilEmpty(state);
  return state;
}

beforeEach(() => {
  globals.__humanPlayerSide = 'self';
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  register(B10009);
  register(RAN);
  registerTriggeredListener();
});

describe('CT-P10 unblocked blue batch', () => {
  it('B10005/P counts three footballers at own turn end and makes its entry line optional', () => {
    expect(B10005.abilities[0]).toMatchObject({
      trigger: { hook: 'phase:end:start' },
      condition: { kind: 'and', cs: [
        { kind: 'turn', player: 'self' },
        { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: 'サッカー選手' } }, nMin: 3 },
      ] },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    });
    expect(B10005.abilities[1]).toMatchObject({
      trigger: { hook: 'enter', selfOnly: true },
      effect: { kind: 'optional', effect: { kind: 'chain', steps: [
        { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
        { kind: 'atom', verb: 'sceneEnter', args: {
          player: 'self', from: 'hand', viaEffect: true, bind: '$entered',
          target: { n: { min: 0, max: 1 }, query: { area: 'hand', side: 'self', filter: { kind: 'character', trait: 'サッカー選手', levelMax: 6 } } },
        } },
        { kind: 'conditional', if: { kind: 'boundAnyMatchesFilter', bindKey: '$entered', filter: { cardName: '比護隆佑' } } },
      ] } },
    });
    expect(B10005P).toMatchObject({ id: 'B10005P', rarity: 'RP' });
  });

  it('B10009 grants assault only after an optional Ran reveal and only gets AP from a character-effect entry', () => {
    expect(B10009.abilities[0]).toMatchObject({
      type: 'continuous', scope: 'on-scene',
      condition: { kind: 'partnerColor', color: '青' },
      continuousModifier: { grantKeywords: expect.any(Function) },
    });
    expect(B10009.abilities[1]).toMatchObject({
      trigger: { hook: 'enter', selfOnly: true },
      effect: { kind: 'optional', effect: { kind: 'chain', steps: [
        { kind: 'atom', verb: 'handReveal', args: { player: 'self', max: 1, bind: '$revealed', filter: { kind: 'character', cardName: '毛利蘭' } } },
        { kind: 'conditional', if: { kind: 'boundAnyMatchesFilter', bindKey: '$revealed', filter: { kind: 'character', cardName: '毛利蘭' } }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } } },
      ] } },
    });
    expect(B10009.abilities[2]).toMatchObject({
      condition: { kind: 'enterSource', viaEffect: true, side: 'self', sourceFilter: { kind: 'character' } },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
    });
  });

  it('B10009 human continuation does not grant assault after selecting zero Ran cards', () => {
    const state = resolveB10009HumanEnter(false);

    expect(readChar.keywords(state, 'b10009')).not.toContain('突撃');
  });

  it('B10009 human continuation grants assault after revealing one Ran card', () => {
    const state = resolveB10009HumanEnter(true);

    expect(readChar.keywords(state, 'b10009')).toContain('突撃');
  });

  it('B10011 prevents only opponent event removal and gates its cut-in boost to Shinichi or Ran', () => {
    expect(B10011.abilities[0]).toMatchObject({
      type: 'continuous', scope: 'on-scene', condition: { kind: 'bond', cardName: '工藤新一' },
      continuousModifier: { opponentEventRestrict: ['remove'] },
    });
    expect(B10011.abilities[1]).toMatchObject({
      type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
      condition: { kind: 'contactCharMatches', who: 'byUid', filter: { cardName: ['工藤新一', '毛利蘭'] } },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
    });
  });

  it('B10014/P grants the scene-only trait, counts four distinct names, and permits a zero-target hirameki', () => {
    expect(B10014.abilities[0]).toMatchObject({ type: 'continuous', scope: 'on-scene', continuousModifier: { grantTraits: ['毛利探偵事務所'] } });
    expect(B10014.abilities[1]).toMatchObject({
      type: 'continuous', scope: 'on-scene',
      condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', distinctNames: true, filter: { trait: '毛利探偵事務所' } }, nMin: 4 },
      continuousModifier: { lpDelta: 1 },
    });
    expect(B10014.abilities[2]).toMatchObject({
      scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true },
      effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', trait: '毛利探偵事務所' } } },
    });
    expect(B10014P).toMatchObject({ id: 'B10014P', rarity: 'CP' });
  });
});
