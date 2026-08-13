// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md
// Official rule manual Ver.2.5: pp.21, 25.

import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetRegistry, register } from '@/engine/read/def';
import { candidates } from '@/engine/target/candidates';
import { cardOccurrenceUid, cardOccurrenceWitness } from '@/engine/target/card-occurrence';
import { targetFilterToPredicateWithCtx } from '@/engine/effect/atom-handlers/_shared';
import { evalCond } from '@/engine/cond/eval';
import { D09006 } from '@/cards/ct-d09/D09006';
import { B04020 } from '@/cards/ct-p04/B04020';
import { D10003 } from '@/cards/ct-d10/D10003';
import { D11013 } from '@/cards/ct-d11/D11013';
import { B08059 } from '@/cards/ct-p08/B08059';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { useGameStateStore } from '@/ui/state/store';
import type { AbilityDef, CardDef, EffectCtx } from '@/engine/types';
import { sceneChar } from '../helpers/fixtures';
import { dispatchCurrentDecision } from '../helpers/dispatch-current-decision';

const invalidHirameki: CardDef = {
  id: 'VER25-HIRAMEKI', no: 'TEST/VER25-HIRAMEKI', kind: 'event', names: ['Ver.2.5 ヒラメキ'], colors: [], level: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-evidence',
    trigger: { hook: 'evidence:remove-by-action', optional: true },
    condition: { kind: 'fileAtLeast', n: 1 },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: '【FILE1】【ヒラメキ】カードを1枚引く。', ruleRefs: [],
  } as AbilityDef],
};

const yellowPartner: CardDef = {
  id: 'VER25_PARTNER_YELLOW', no: 'TEST/VER25_PARTNER_YELLOW', kind: 'character', names: ['黄色パートナー'], colors: ['黄'], level: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [],
};

const greenPartner: CardDef = {
  id: 'VER25_PARTNER_GREEN', no: 'TEST/VER25_PARTNER_GREEN', kind: 'character', names: ['緑パートナー'], colors: ['緑'], level: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [],
};

const caseTraitCase: CardDef = {
  id: 'VER25-CASE-TRAIT', no: 'TEST/VER25-CASE-TRAIT', kind: 'case', names: ['事件特徴'], colors: [], traits: [], caseTraits: ['シャッフルロマンス'],
  rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [],
};

const conditionalAssault: CardDef = {
  id: 'VER25_CONDITIONAL_ASSAULT', no: 'TEST/VER25_CONDITIONAL_ASSAULT', kind: 'character', names: ['条件付き突撃'], colors: [], level: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [{
    id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'partnerColor', color: '黄' },
    continuousModifier: { grantKeywords: () => ['突撃'], printedKeywordWhenIconValid: true }, description: '【パートナー黄】〚突撃〛', ruleRefs: [],
  } as AbilityDef],
};

const textGrantedAssault: CardDef = {
  id: 'VER25_TEXT_GRANTED_ASSAULT', no: 'TEST/VER25_TEXT_GRANTED_ASSAULT', kind: 'character', names: ['テキスト付与'], colors: [], level: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [{
    id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'partnerColor', color: '黄' },
    continuousModifier: { grantKeywords: () => ['突撃'] }, description: '条件を満たす場合、〚突撃〛を持つ。', ruleRefs: [],
  } as AbilityDef],
};

const printedCutin: CardDef = {
  id: 'VER25_PRINTED_CUTIN', no: 'TEST/VER25_PRINTED_CUTIN', kind: 'character', names: ['カットイン持ち'], colors: [], level: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true },
    effect: { kind: 'atom', verb: 'noop', args: {} }, description: '【カットイン】AP＋1000', ruleRefs: [],
  } as AbilityDef],
};

const targetCtx: EffectCtx = { source: { player: 'self', area: 'scene', cardId: 'SOURCE', abilityId: 'a1' }, bindings: {} };

describe('official rule manual Ver.2.5', () => {
  beforeEach(() => {
    _resetRegistry();
    _resetTriggeredRegistered();
    _resetPendingHirameki();
    register(invalidHirameki);
    register(yellowPartner);
    register(greenPartner);
    register(caseTraitCase);
    register(conditionalAssault);
    register(textGrantedAssault);
    register(printedCutin);
    register(D09006);
    register(B04020);
    register(D10003);
    register(D11013);
    register(B08059);
    registerTriggeredListener();
    useGameStateStore.setState({ gameState: null, pendingHirameki: null });
  });

  it('keeps an invalid optional Hirameki activatable but resolves no effect', () => {
    const state = createEmptyGameState();
    state.players.self.evidence = [{ cardId: invalidHirameki.id, faceUp: true, origin: { turn: 0, via: 'opening' } }];
    state.players.self.deck = ['DRAWN'];
    state.turn = { number: 1, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.scene = [sceneChar(D11013.id, 'opp-attacker')];
    state.players.opp.deck = ['ACTION-GAIN'];
    state.players.self.case.cardId = caseTraitCase.id;
    const sessionId = 'rule-manual-ver25-hirameki';
    startCausalSession(state, sessionId);
    resetPresentationQueue(sessionId);
    expect(useGameStateStore.getState().setGameState(state)).toBe(true);
    expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'opp-attacker', targetPlayer: 'self' })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null }).ok).toBe(true);
    expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! }).ok).toBe(true);

    const pending = useGameStateStore.getState().pendingHirameki;
    expect(pending).toMatchObject({ player: 'self', cardId: invalidHirameki.id, abilityId: 'a1', effectValid: false });
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' }).ok).toBe(true);
    expect(useGameStateStore.getState().gameState!.players.self.deck).toEqual(['DRAWN']);
    expect(useGameStateStore.getState().gameState!.log).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'activate', tags: expect.arrayContaining(['hirameki']) }),
    ]));
  });

  it('recognises an icon-valid printed keyword from hand, but not when its condition fails', () => {
    const state = createEmptyGameState();
    state.players.self.hand = [conditionalAssault.id];
    const query = { area: 'hand' as const, side: 'self' as const, filter: { keyword: '突撃' } };

    expect(candidates(state, { kind: 'all', query }, targetCtx)).toEqual([]);
    state.players.self.partner.cardId = yellowPartner.id;
    expect(candidates(state, { kind: 'all', query }, targetCtx)).toEqual([
      expect.objectContaining({ kind: 'card', area: 'hand', cardId: conditionalAssault.id }),
    ]);
    state.players.self.deck = [conditionalAssault.id, textGrantedAssault.id];
    const deckMatches = targetFilterToPredicateWithCtx(state, { keyword: '突撃' }, targetCtx, 'self');
    expect(deckMatches(conditionalAssault.id)).toBe(true);
    expect(deckMatches(textGrantedAssault.id)).toBe(false);

    const boundCtx: EffectCtx = {
      ...targetCtx,
      bindings: { revealed: [{ kind: 'card', cardId: conditionalAssault.id, area: 'deck', player: 'self', index: 0 }] },
    };
    expect(evalCond(state, { kind: 'boundMatchesFilter', bindKey: 'revealed', filter: { keyword: '突撃' } }, boundCtx)).toBe(true);

    state.players.self.partner.cardId = greenPartner.id;
    state.players.opp.partner.cardId = yellowPartner.id;
    state.players.opp.remove = [conditionalAssault.id];
    const opponentBoundCtx: EffectCtx = {
      ...targetCtx,
      bindings: { revealed: [{
        kind: 'card',
        uid: cardOccurrenceUid('opp', 'remove', conditionalAssault.id, 0),
        cardId: conditionalAssault.id,
        area: 'remove',
        player: 'opp',
        index: 0,
        occurrenceWitness: cardOccurrenceWitness(state, 'opp', 'remove'),
      }] },
    };
    const keywordFilter = { keyword: '突撃' };
    expect(evalCond(state, { kind: 'boundMatchesFilter', bindKey: 'revealed', filter: keywordFilter }, opponentBoundCtx)).toBe(true);
    expect(evalCond(state, { kind: 'boundAnyMatchesFilter', bindKey: 'revealed', filter: keywordFilter }, opponentBoundCtx)).toBe(true);
    expect(evalCond(state, { kind: 'boundMatchCountAtLeast', bindKey: 'revealed', filter: keywordFilter, n: 1 }, opponentBoundCtx)).toBe(true);
  });

  it('keeps an invalid original ability icon referencable, but not its printed text', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [{
      uid: 'disabled-cutin', cardId: printedCutin.id, state: 'active', isNamed: false, enterOrder: 1,
      setCards: [], stackedCards: [], keywordOverrides: { granted: [], disabledOriginal: true },
      apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
    }];
    const iconQuery = { area: 'scene' as const, side: 'self' as const, filter: { keyword: 'カットイン' } };
    const textQuery = { area: 'scene' as const, side: 'self' as const, filter: { cutinTextIncludes: 'AP＋' } };

    expect(candidates(state, { kind: 'all', query: iconQuery }, targetCtx)).toHaveLength(1);
    expect(candidates(state, { kind: 'all', query: textQuery }, targetCtx)).toEqual([]);
  });

  it('does not carry ordinary text keyword grants outside the scene', () => {
    const state = createEmptyGameState();
    state.turn.player = 'self';
    state.players.self.hand = [D09006.id, B04020.id, B08059.id];
    state.players.self.remove = [D09006.id, D09006.id];
    state.players.self.scene = [0, 1, 2].map(index => ({
      uid: `police-${index}`, cardId: D09006.id, state: 'active' as const, isNamed: false, enterOrder: index,
      setCards: [], stackedCards: [], keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
    }));
    const query = { area: 'hand' as const, side: 'self' as const, filter: { keyword: '突撃' } };

    expect(candidates(state, { kind: 'all', query }, targetCtx)).toEqual([]);
  });

  it('recognises a case-trait icon keyword but not a conditional text keyword', () => {
    const state = createEmptyGameState();
    state.players.self.case.cardId = caseTraitCase.id;
    state.players.self.hand = [D10003.id];
    const query = { area: 'hand' as const, side: 'self' as const, filter: { keyword: '突撃' } };

    expect(candidates(state, { kind: 'all', query }, targetCtx)).toEqual([
      expect.objectContaining({ cardId: D10003.id }),
    ]);
  });

  it('does not let a condition-invalid cutin text satisfy a text filter', () => {
    const state = createEmptyGameState();
    state.players.self.partner.cardId = greenPartner.id;
    state.players.self.remove = [D11013.id];
    const textQuery = { area: 'remove' as const, side: 'self' as const, filter: { cutinTextIncludes: 'AP＋' } };
    const iconQuery = { area: 'remove' as const, side: 'self' as const, filter: { cutinTextIncludes: '' } };

    expect(candidates(state, { kind: 'all', query: textQuery }, targetCtx)).toEqual([]);
    expect(candidates(state, { kind: 'all', query: iconQuery }, targetCtx)).toHaveLength(1);
    state.players.self.partner.cardId = yellowPartner.id;
    expect(candidates(state, { kind: 'all', query: textQuery }, targetCtx)).toHaveLength(1);
  });
});
