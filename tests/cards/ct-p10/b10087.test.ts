import { beforeEach, describe, expect, it } from 'vitest';
import { B10087 } from '@/cards/ct-p10/B10087';
import { REUSE_CARDS, registerAll } from '@/cards';
import { event } from '@/engine/event';
import { applyOptionalAndContinuation, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectOptionalSide, _drainPendingEffectPickSide, _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { _drainPendingContactStartAxId } from '@/engine/effect/atom-handlers/_shared';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';

const CUTIN: CardDef = {
  id: 'B10087_TEST_CUTIN', no: 'B10087_TEST_CUTIN', kind: 'character', names: ['Cut-in'], colors: ['黒'],
  level: 1, ap: 1000, lp: 1, traits: [], keywords: ['カットイン'], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const FILLER: CardDef = { ...CUTIN, id: 'B10087_TEST_FILLER', no: 'B10087_TEST_FILLER', keywords: [] };
const TARGET: CardDef = { ...FILLER, id: 'B10087_TEST_TARGET', no: 'B10087_TEST_TARGET', names: ['Target'] };

function enterState(deck: string[], withTarget = true): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner.cardId = 'B10087';
  state.players.self.scene = [sceneChar('B10087', 'gin')];
  state.players.self.deck = [...deck];
  state.players.opp.scene = withTarget ? [sceneChar(TARGET.id, 'target')] : [];
  return state;
}

function triggerEnter(state: GameState): void {
  event.emit(state, 'enter', { uid: 'gin', viaEffect: false, enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId: 'B10087', uid: 'gin' });
  runAllUntilEmpty(state);
  const optional = _drainPendingEffectOptionalSide();
  expect(optional?.player).toBe('self');
  applyOptionalAndContinuation(state, optional!, true);
  runAllUntilEmpty(state);
}

beforeEach(() => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  event._resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  _drainPendingContactStartAxId();
  _resetRegistry();
  registerAll();
  [B10087, CUTIN, FILLER, TARGET].forEach(register);
  registerTriggeredListener();
});

describe('B10087 ジン', () => {
  it('keeps its printed metadata and its separate cut-in', () => {
    expect(B10087).toMatchObject({
      id: 'B10087', no: '1142/B10087', kind: 'character', names: ['ジン'],
      colors: ['黒'], level: 8, ap: 8000, lp: 2, traits: ['黒ずくめの組織'],
      keywords: [], rarity: 'R', imageUrl: '1783904232315186.jpg',
    });
    expect(B10087.abilities.find((ability) => ability.id === 'a3')).toMatchObject({
      type: 'triggered', scope: 'on-hand', condition: { kind: 'turn', player: 'self' },
      trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
    });
  });

  it('registers one base printing with metadata parity and no duplicate id', () => {
    expect(REUSE_CARDS.filter((card) => card.id === 'B10087')).toEqual([B10087]);
    expect(new Set(REUSE_CARDS.map((card) => card.id)).size).toBe(REUSE_CARDS.length);
  });

  it('draws only after this exact Gin participates in its controller cut-in', () => {
    expect(B10087.abilities.find((ability) => ability.id === 'a1')).toMatchObject({
      type: 'triggered', scope: 'on-scene', trigger: {
        hook: 'cutin:used', matcherCondition: { kind: 'and', cs: [
          { kind: 'triggerPlayerIs', side: 'self' },
          { kind: 'contactCharMatches', who: 'byUid', requireSource: true, filter: { kind: 'character' } },
        ] },
      },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    });
  });

  it('draws once for an attacking, targeted, or guarding Gin but not a same-name observer', () => {
    for (const contact of [
      { byUid: 'gin', targetUid: 'target' },
      { byUid: 'gin', targetUid: 'target', guardUid: 'gin' },
      { byUid: 'gin', targetUid: 'target', attackerSide: 'opp' },
    ]) {
      const state = createEmptyGameState();
      state.players.self.scene = [sceneChar('B10087', 'gin'), sceneChar('B10087', 'same-name-observer')];
      state.players.opp.scene = [sceneChar(TARGET.id, 'target')];
      state.players.self.deck = [FILLER.id];
      event.emit(state, 'cutin:used', { player: 'self', cardId: CUTIN.id }, {
        player: 'self', cardId: CUTIN.id, bindings: { contact: [contact] },
      });
      runAllUntilEmpty(state);
      expect(state.players.self.hand).toEqual([FILLER.id]);
    }
  });

  it('gates the optional mill at three cards and creates contact from its source uid', () => {
    const enter = B10087.abilities.find((ability) => ability.id === 'a2')!;
    expect(enter).toMatchObject({
      type: 'triggered', scope: 'on-scene',
      condition: { kind: 'partnerColor', color: '黒' }, trigger: { hook: 'enter', selfOnly: true },
      effect: { kind: 'optional', effect: { kind: 'sequence' } },
    });
    expect(enter.effect).toMatchObject({
      kind: 'optional', effect: { kind: 'sequence', steps: [
        { kind: 'atom', verb: 'mill', args: { player: 'self', n: 3, gate: true, bind: '$removed' } },
        { kind: 'conditional', if: { kind: 'boundMatchCountAtLeast', bindKey: '$removed', filter: { color: '黒', keyword: 'カットイン' }, n: 3 }, then: { kind: 'sequence', steps: [
          { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'opp', max: 1, bind: 'target' } },
          { kind: 'atom', verb: 'startContact', args: { targetUid: '$target.uid' } },
        ] } },
      ] },
    });
  });

  it('runs the three-card bound removal, accepts zero targets, and rejects stale targets without refresh', () => {
    const qualified = enterState([CUTIN.id, CUTIN.id, CUTIN.id]);
    triggerEnter(qualified);
    const target = _drainPendingEffectPickSide();
    expect(target?.atomVerb).toBe('bindPick');
    applyPickAndContinuation(qualified, target!, 'target');
    runAllUntilEmpty(qualified);
    expect(qualified.log.map((entry) => `${entry.action}:${entry.result ?? ''}`)).toContain('effect:mill:3');
    expect(qualified.refreshCount.self).toBe(1);
    const actionId = _drainPendingContactStartAxId();
    expect(actionId).not.toBeNull();

    const zero = enterState([CUTIN.id, CUTIN.id, CUTIN.id], false);
    triggerEnter(zero);
    const zeroTarget = _drainPendingEffectPickSide();
    if (zeroTarget) applyPickSkipAndContinuation(zero, zeroTarget);
    expect(_drainPendingContactStartAxId()).toBeNull();

    const stale = enterState([CUTIN.id, CUTIN.id, CUTIN.id]);
    triggerEnter(stale);
    const staleTarget = _drainPendingEffectPickSide();
    stale.players.opp.scene = [];
    applyPickAndContinuation(stale, staleTarget!, 'target');
    expect(_drainPendingContactStartAxId()).toBeNull();

    const shortDeck = enterState([CUTIN.id, CUTIN.id]);
    shortDeck.players.self.remove = [FILLER.id];
    triggerEnter(shortDeck);
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(shortDeck.players.self.deck).toEqual([CUTIN.id, CUTIN.id]);
    expect(shortDeck.players.self.remove).toEqual([FILLER.id]);
    expect(shortDeck.log.some((entry) => entry.action === 'refresh')).toBe(false);
  });
});
