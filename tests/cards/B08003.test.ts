import { afterEach, describe, expect, it } from 'vitest';
import { B08003 } from '@/cards/ct-p08/B08003';
import { B08003P } from '@/cards/ct-p08/B08003P';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { sceneChar } from '../helpers/fixtures';
import { runCardScenario } from '../helpers/card-probe-harness';
import type { CardDef } from '@/engine/types';

const character = (id: string, level: number, traits: string[] = []): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['青'], level, ap: 0, lp: 1,
  traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});

describe('B08003 阿笠博士', () => {
  beforeEach(() => {
    _resetRegistry(); _clearPendingEffectPickQueue();
    (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
    (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
  });
  afterEach(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });
  it('uses stacked occurrence cost, opponent-owned choice, and the printed conditional branch', () => {
    const [a1, a2] = B08003.abilities;
    expect(a1).toMatchObject({
      type: 'triggered', trigger: { hook: 'enter', selfOnly: true },
      effect: { kind: 'atom', verb: 'charStackCard', args: {
        uid: '$self', cardIds: '$pick.cardIds', target: { query: { distinctNames: true }, n: { min: 0, max: 3 } },
      } },
    });
    expect(a2).toMatchObject({
      type: 'declared', scope: 'always', limit: { kind: 'turn', n: 1 },
      condition: { kind: 'partnerColor', color: '青' },
      cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeStackedCards', n: 3 }] },
    });
    const steps = (a2!.effect as { steps: Array<{ kind?: string; args?: unknown; if?: unknown }> }).steps;
    expect(steps[0]).toMatchObject({ kind: 'atom', args: {
      cardIds: '$pick.cardIds', bind: '$chosen', target: { chooser: 'opp-of-owner', query: { fromCostPaidCards: 'removeStackedCards' } },
    } });
    expect(steps[1]).toMatchObject({ kind: 'conditional', if: {
      kind: 'boundMatchesFilter', bindKey: '$chosen', filter: { kind: 'character', levelMax: 8, trait: '少年探偵団' },
    } });
  });

  it('has identical printed abilities in the P variant', () => {
    expect(B08003P.abilities).toEqual(B08003.abilities);
    expect(B08003P.abilities.map(ability => ability.description)).toEqual(B08003.abilities.map(ability => ability.description));
  });

  it('production enter dispatch stacks only distinct level-8 少年探偵団 remove cards', () => {
    const first = character('STACK_A', 8, ['少年探偵団']);
    const second = character('STACK_B', 8, ['少年探偵団']);
    const decoy = character('STACK_DECOY', 7, ['少年探偵団']);
    const state = runCardScenario(B08003, [first, second, decoy], {
      name: 'B08003 a1 enter stacks distinct level-8 candidates',
      setup: { selfScene: [{ cardId: 'B08003', uid: 'agasa' }], remove: ['STACK_A', 'STACK_B', 'STACK_DECOY'] },
      drive: { kind: 'enter', cardId: 'B08003', uid: 'agasa' },
      script: [{ pickCardIds: ['STACK_A', 'STACK_B'], candidatesExclude: ['STACK_DECOY'] }],
      expect: [
        { kind: 'zone', side: 'self', zone: 'remove', cardId: 'STACK_A', present: false },
        { kind: 'zone', side: 'self', zone: 'remove', cardId: 'STACK_B', present: false },
        { kind: 'zone', side: 'self', zone: 'remove', cardId: 'STACK_DECOY', present: true },
      ],
    });
    expect(state.players.self.scene[0]!.stackedCards).toEqual(expect.arrayContaining([
      expect.objectContaining({ cardId: 'STACK_A' }), expect.objectContaining({ cardId: 'STACK_B' }),
    ]));
  });

  it('production dispatch lets the AI opponent choose, then surfaces only the human discard in printed order', () => {
    const good = character('GOOD', 8, ['少年探偵団']);
    const other = character('OTHER', 9, ['少年探偵団']);
    const filler = character('FILLER', 1);
    const partner = { ...character('BLUE_PARTNER', 0), kind: 'partner' as const, colors: [...B08003.colors] };
    [B08003, good, other, filler, partner].forEach(registerCardDef);
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene.push(sceneChar('B08003', 'agasa'));
    mutate.partner.init(state, 'self', 'BLUE_PARTNER');
    state.players.self.scene[0]!.stackedCards = [
      { cardId: 'GOOD', instanceId: 'stack:agasa:a' },
      { cardId: 'OTHER', instanceId: 'stack:agasa:b' },
      { cardId: 'FILLER', instanceId: 'stack:agasa:c' },
    ];
    state.players.self.hand = ['FILLER'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    activateDeclaredAbility(state, 'agasa', 'a2', { removeStackedCards: { instanceIds: ['stack:agasa:a', 'stack:agasa:b', 'stack:agasa:c'] } });
    runAllUntilEmpty(state);
    const discard = _drainPendingEffectPickSide();
    expect(discard).toMatchObject({ player: 'self', atomVerb: 'discard' });
    applyPickAndContinuation(state, discard!, 'FILLER#0');

    expect(state.players.self.scene.map(card => card.cardId)).toEqual(['GOOD']);
    expect(state.players.self.remove).toEqual(['OTHER', 'FILLER', 'B08003', 'FILLER']);
  });
});
