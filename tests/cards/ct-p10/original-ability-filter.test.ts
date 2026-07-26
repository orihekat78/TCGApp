// CT-P10 B10074 / B10102: official Q&A says original abilities are printed
// metadata. Disabled text still counts; granted text never counts.
import { describe, expect, it } from 'vitest';
import { B10074 } from '@/cards/ct-p10/B10074';
import { B10102 } from '@/cards/ct-p10/B10102';
import { B10102P } from '@/cards/ct-p10/B10102P';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import { runCardScenario } from '../../helpers/card-probe-harness';
import type { CardDef } from '@/engine/types';

const vanilla: CardDef = {
  id: 'CTP10_VANILLA', no: 'CTP10/VANILLA', kind: 'character', names: ['バニラ'],
  colors: ['黄'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const printedAbility: CardDef = {
  ...vanilla,
  id: 'CTP10_PRINTED_ABILITY', no: 'CTP10/PRINTED', names: ['印字能力あり'],
  abilities: [{ id: 'a1', type: 'continuous', scope: 'on-scene', description: '印字能力' }],
};
const cutIn: CardDef = { ...vanilla, id: 'CTP10_CUTIN', no: 'CTP10/CUTIN', keywords: ['カットイン'] };
const hirameki: CardDef = { ...vanilla, id: 'CTP10_HIRAMEKI', no: 'CTP10/HIRAMEKI', keywords: ['ヒラメキ'] };

describe('CT-P10 original-ability cards', () => {
  it('B10074 excludes ordinary printed abilities but permits CutIn/Hirameki-only characters', () => {
    const state = runCardScenario(B10074, [vanilla, printedAbility, cutIn, hirameki], {
      name: 'B10074: enter only a legal remove-area character',
      setup: {
        selfScene: [{ cardId: 'B10074', uid: 'kazami' }],
        remove: ['CTP10_VANILLA', 'CTP10_PRINTED_ABILITY', 'CTP10_CUTIN', 'CTP10_HIRAMEKI'],
      },
      drive: { kind: 'enter', cardId: 'B10074', uid: 'kazami' },
      script: [{ pickCardId: 'CTP10_VANILLA' }],
      expect: [
        { kind: 'zone', cardId: 'CTP10_VANILLA', zone: 'scene', side: 'self', present: true },
        { kind: 'candidatesExclude', pickIndex: 0, cardId: 'CTP10_PRINTED_ABILITY' },
      ],
    });
    expect(state.players.self.remove).toContain('CTP10_PRINTED_ABILITY');
  });

  it('B10102 maps its declared cost and repeated look to the eligible-character filter', () => {
    const declared = B10102.abilities.find((a) => a.id === 'a2');
    expect(declared).toMatchObject({
      type: 'declared', scope: 'always', condition: { kind: 'caseStatus', status: '解決編' },
      limit: { kind: 'turn', n: 1 }, cost: { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } },
      effect: { kind: 'forEach', over: { kind: 'all', query: { area: 'scene', side: 'self', filter: { kind: 'character', hasNoOriginalAbilityExceptIcons: ['カットイン', 'ヒラメキ'] } } } },
    });
    expect(B10102.abilities[0]).toMatchObject({
      type: 'triggered', scope: 'always', trigger: { hook: 'case:to-resolved', selfOnly: true },
      effect: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    });
    expect({ ...B10102P, id: B10102.id, no: B10102.no, rarity: B10102.rarity, imageUrl: B10102.imageUrl }).toEqual(B10102);
  });

  it('B10102 resolves each eligible character in order; disabled or external text does not change printed-ability eligibility', () => {
    const lookOne = { ...vanilla, id: 'CTP10_LOOK_ONE', no: 'CTP10/LOOK_ONE' };
    const lookTwo = { ...vanilla, id: 'CTP10_LOOK_TWO', no: 'CTP10/LOOK_TWO' };
    _resetRegistry(); event._resetRegistry(); _resetTriggeredRegistered(); _clearPendingEffectPickQueue();
    [B10102, vanilla, printedAbility, cutIn, lookOne, lookTwo].forEach(register);
    registerTriggeredListener();

    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case = { cardId: 'B10102', status: '解決編', requiredEvidence: 6, colors: ['赤', '黄'], declaredUseCount: {} } as typeof state.players.self.case;
    state.players.self.evidence = [
      { cardId: 'CTP10_LOOK_ONE', faceUp: false, origin: { turn: 1, via: 'opening' } },
      { cardId: 'CTP10_LOOK_TWO', faceUp: false, origin: { turn: 1, via: 'opening' } },
    ];
    state.players.self.scene = [
      sceneChar('CTP10_VANILLA', 'vanilla-1'), sceneChar('CTP10_VANILLA', 'vanilla-2'),
      sceneChar('CTP10_PRINTED_ABILITY', 'printed-disabled', { keywordOverrides: { granted: [], disabledOriginal: true } }),
      sceneChar('CTP10_CUTIN', 'cut-in'),
    ];
    state.players.self.scene[1]!.turnEffects['grantedAbilities'] = [
      { id: 'external-a1', type: 'continuous', scope: 'on-scene', description: '外部から与えられた能力' },
    ];
    state.players.self.deck = ['CTP10_LOOK_ONE', 'CTP10_LOOK_TWO'];

    activateDeclaredAbility(state, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1] } });
    runAllUntilEmpty(state);
    const first = _drainPendingEffectPickSide();
    expect(first?.atomVerb).toBe('deckRevealUntil');
    expect((first?.candidates as Array<{ cardId: string }>).map((c) => c.cardId)).toEqual(['CTP10_LOOK_ONE']);
    applyPickAndContinuation(state, first!, (first!.candidates as Array<{ uid: string }>)[0]!.uid);
    runAllUntilEmpty(state);

    const second = _drainPendingEffectPickSide();
    expect(second?.atomVerb).toBe('deckRevealUntil');
    expect((second?.candidates as Array<{ cardId: string }>).map((c) => c.cardId)).toEqual(['CTP10_LOOK_TWO']);
    applyPickAndContinuation(state, second!, (second!.candidates as Array<{ uid: string }>)[0]!.uid);
    runAllUntilEmpty(state);
    expect(state.players.self.hand).toEqual(['CTP10_LOOK_ONE', 'CTP10_LOOK_TWO']);
  });
});
