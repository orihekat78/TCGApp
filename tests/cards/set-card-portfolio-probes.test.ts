import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B06064 } from '@/cards/ct-p06/B06064';
import { B06064P } from '@/cards/ct-p06/B06064P';
import { B07033 } from '@/cards/ct-p07/B07033';
import { B07033P } from '@/cards/ct-p07/B07033P';
import { B07033P2 } from '@/cards/ct-p07/B07033P2';
import { B09113 } from '@/cards/ct-p09/B09113';
import { B09113P } from '@/cards/ct-p09/B09113P';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { mutate } from '@/engine/mutate';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { char as readChar } from '@/engine/read/char';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { evalCond } from '@/engine/cond/eval';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { partnerColorKeyword } from '@/cards/_shared/partnerColorKeyword';
import type { CardDef, EffectCtx } from '@/engine/types';

const ctx = (player: 'self' | 'opp' = 'self'): EffectCtx => ({ source: { player, cardId: 'SRC', uid: 'src' }, bindings: {} } as EffectCtx);
const char = (id: string, color: string, level = 1): CardDef => ({ id, no: id, kind: 'character', names: [id], colors: [color], level, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
const serializedAbilities = (def: CardDef) => JSON.stringify(def.abilities, (_key, value) => typeof value === 'function' ? '[function]' : value);

beforeEach(() => {
  resetDefRegistry(); event._resetRegistry(); _resetTriggeredRegistered();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  registerCardDef(B06064); registerCardDef(B07033); registerCardDef(B09113);
  registerCardDef(char('RED', '赤')); registerCardDef(char('BLACK', '黒')); registerCardDef(char('SLEEP7', '白', 7));
  registerCardDef({ ...char('HOST', '白'), traits: ['YAIBA'], level: 8 });
  registerCardDef({ ...char('YAIBA5', '白', 5), traits: ['YAIBA'] });
  registerCardDef({ id: 'PW', no: 'PW', kind: 'partner', names: ['PW'], colors: ['白'], ap: undefined, lp: 2, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
  registerCardDef({ id: 'PB', no: 'PB', kind: 'partner', names: ['PB'], colors: ['青'], ap: undefined, lp: 2, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
  registerCardDef({ id: 'JE1', no: 'JE1', kind: 'event', names: ['JE1'], colors: ['白'], level: 1, traits: ['ビッグジュエル'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
  registerCardDef({ id: 'JE2', no: 'JE2', kind: 'event', names: ['JE2'], colors: ['白'], level: 1, traits: ['ビッグジュエル'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
  registerCardDef({ id: 'DECK', no: 'DECK', kind: 'event', names: ['DECK'], colors: ['白'], level: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
  registerTriggeredListener();
});

afterEach(() => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('deferred set-card portfolio — CI probes', () => {
  it('B06064/P preserve face-up host grant and opponent-turn leave reanimate contracts', () => {
    expect(serializedAbilities(B06064P)).toBe(serializedAbilities(B06064));
    expect(B06064.abilities[0]).toMatchObject({ trigger: { hook: 'effect:declared', selfOnly: true }, effect: { kind: 'atom', verb: 'charSetCard', args: { filter: { trait: 'YAIBA', levelMin: 8 } } } });
    expect(B06064.abilities[1]).toMatchObject({ scope: 'on-set-host', continuousModifier: { grantKeywords: expect.any(Function) } });
    expect(B06064.abilities[2]).toMatchObject({ scope: 'on-set-self', trigger: { hook: 'setcard:leave' }, condition: { kind: 'turn', player: 'opp' }, effect: { kind: 'atom', verb: 'sceneEnter', args: { enterSleep: true, filter: { trait: 'YAIBA', levelMax: 5 } } } });
  });

  it('B06064 production setcard:leave path reanimates asleep only for a face-up opponent-turn leave', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const after = produce(createEmptyGameState(), draft => {
      draft.turn.player = 'opp';
      const host = mutate.scene.enter(draft, 'self', 'HOST', {});
      mutate.char.setCard(draft, host.uid, 'B06064', true);
      draft.players.self.remove = ['YAIBA5'];
      mutate.char.removeOneSetCard(draft, host.uid, { setCardInstanceId: host.setCards[0]!.instanceId });
      runAllUntilEmpty(draft);
      const pending = _drainPendingEffectPickSide();
      const candidate = pending?.candidates.find(item => item.cardId === 'YAIBA5');
      expect(candidate?.uid).toBeTruthy();
      applyPickAndContinuation(draft, pending!, candidate!.uid!);
      runAllUntilEmpty(draft);
    });
    expect(after.players.self.scene.find(c => c.cardId === 'YAIBA5')?.state).toBe('sleep');
  });

  it('B06064 excludes face-down and own-turn set-card leaves from the listener path', () => {
    for (const [turn, faceUp] of [['self', true], ['opp', false]] as const) {
      const after = produce(createEmptyGameState(), draft => {
        draft.turn.player = turn;
        const host = mutate.scene.enter(draft, 'self', 'HOST', {});
        mutate.char.setCard(draft, host.uid, 'B06064', faceUp);
        draft.players.self.remove = ['YAIBA5'];
        mutate.char.removeOneSetCard(draft, host.uid, { setCardInstanceId: host.setCards[0]!.instanceId });
        runAllUntilEmpty(draft);
      });
      expect(after.players.self.scene.some(c => c.cardId === 'YAIBA5')).toBe(false);
    }
  });

  it('B07033 family keeps partner-white assault conditional and exact PA threshold', () => {
    expect(serializedAbilities(B07033P)).toBe(serializedAbilities(B07033));
    expect(serializedAbilities(B07033P2)).toBe(serializedAbilities(B07033));
    expect(B07033.keywords).toEqual([]);
    expect(JSON.stringify(B07033.abilities[0], (_key, value) => typeof value === 'function' ? '[function]' : value)).toBe(JSON.stringify(partnerColorKeyword({ color: '白', kw: '突撃', abilityId: 'a0' }), (_key, value) => typeof value === 'function' ? '[function]' : value));
    expect(B07033.abilities[1]).toMatchObject({ condition: { kind: 'and', cs: [{ kind: 'turn', player: 'self' }, { kind: 'sceneHas', query: { area: 'partner-area', side: 'self', filter: { trait: 'ビッグジュエル' } }, nMin: 2 }] }, continuousModifier: { apDelta: 2000 } });
    expect(B07033.abilities[2]).toMatchObject({ trigger: { hook: 'disguise:into', selfOnly: true }, effect: { kind: 'atom', verb: 'toPartnerArea', args: { max: 1, filter: { kind: 'event', trait: 'ビッグジュエル' } } } });
  });

  it('B07033 reads partner-white assault, exact two-card AP threshold, and disguise-to-PA production hook', () => {
    const after = produce(createEmptyGameState(), draft => {
      draft.turn.player = 'self';
      draft.players.self.partner.cardId = 'PW';
      draft.players.self.partnerAreaCards = ['JE1'];
      const kid = mutate.scene.enter(draft, 'self', 'B07033', {});
      expect(readChar.ap(draft, kid.uid)).toBe(6000);
      expect(readChar.keywords(draft, kid.uid)).toContain('突撃');
      draft.players.self.partnerAreaCards.push('JE2');
      expect(readChar.ap(draft, kid.uid)).toBe(8000);
      draft.players.self.remove = ['JE1'];
      event.emit(draft, 'disguise:into', { player: 'self', uid: kid.uid }, { player: 'self', uid: kid.uid, cardId: 'B07033' });
      runAllUntilEmpty(draft);
    });
    expect(after.players.self.partnerAreaCards).toEqual(expect.arrayContaining(['JE1', 'JE2', 'JE1']));
    expect(after.players.self.remove).not.toContain('JE1');
  });

  it('B09113/P retains Q&A choice no-op gates and sleep-only remove branch', () => {
    expect(serializedAbilities(B09113P)).toBe(serializedAbilities(B09113));
    const effect = B09113.abilities[1]!.effect!;
    expect(effect).toMatchObject({ kind: 'choice', chooser: 'self' });
    const options = (effect as Extract<typeof effect, { kind: 'choice' }>).options;
    expect(options[0]).toMatchObject({ kind: 'conditional', if: { kind: 'scratchTrace', player: 'self', v: '未発見' } });
    expect(options[1]).toMatchObject({ kind: 'conditional', then: { kind: 'sequence', steps: [expect.anything(), { kind: 'conditional', then: { kind: 'atom', verb: 'sceneRemove', args: { state: ['sleep'], filter: { levelMax: 7 } } } }] } });
  });

  it('B09113 second choice is unavailable at resolution without discovered trace and red/black scene', () => {
    const s = createEmptyGameState();
    const second = (B09113.abilities[1]!.effect as Extract<NonNullable<typeof B09113.abilities[1]['effect']>, { kind: 'choice' }>).options[1]!;
    expect(second.kind).toBe('conditional');
    expect(evalCond(s, second.if, ctx())).toBe(false);
  });

  it('B09113 AI choice flips evidence then mills only after an actual flip', () => {
    const effect = B09113.abilities[1]!.effect!;
    const policy = new HeuristicPolicy();
    const after = produce(createEmptyGameState(), draft => {
      draft.scratchTrace.self = '未発見';
      draft.players.self.evidence = [{ cardId: 'DECK', faceUp: false, origin: { turn: 1, via: 'effect' } }];
      draft.players.opp.deck = ['DECK', 'DECK', 'DECK'];
      const c = { ...ctx(), dyn: { choiceIndex: 0 } };
      const walked = resolveEffectPicks(draft, effect, c, { byPlayer: 'self', humanChooser: false, chooseAtomTarget: policy.chooseAtomTarget?.bind(policy), source: { cardId: 'B09113', abilityId: 'a2' } });
      runEffect(draft, walked, c);
    });
    expect(after.players.self.evidence[0]?.faceUp).toBe(true);
    expect(after.players.opp.remove).toHaveLength(2);
  });

  it('B09113 AI choice with zero evidence does not mill or leave a pending continuation', () => {
    const effect = B09113.abilities[1]!.effect!;
    const policy = new HeuristicPolicy();
    const after = produce(createEmptyGameState(), draft => {
      draft.scratchTrace.self = '未発見';
      draft.players.opp.deck = ['DECK', 'DECK'];
      const c = { ...ctx(), dyn: { choiceIndex: 0 } };
      const walked = resolveEffectPicks(draft, effect, c, { byPlayer: 'self', humanChooser: false, chooseAtomTarget: policy.chooseAtomTarget?.bind(policy), source: { cardId: 'B09113', abilityId: 'a2' } });
      runEffect(draft, walked, c);
      runAllUntilEmpty(draft);
    });
    expect(after.players.opp.remove).toEqual([]);
    expect(after.pendingEffects).toEqual([]);
  });
});
