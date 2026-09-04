import { beforeEach, describe, expect, it } from 'vitest';
import { B10031 } from '@/cards/ct-p10/B10031';
import { B10037, B10037P } from '@/cards/ct-p10/B10037';
import { B10091 } from '@/cards/ct-p10/B10091';
import { event } from '@/engine/event';
import { mutate } from '@/engine/mutate';
import { endTurn } from '@/engine/flow/turn';
import { runAllUntilEmpty } from '@/engine/resolve';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';

const character = (id: string, extra: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['青'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...extra,
});

const VICTIM = character('HISTORY_VICTIM');
const OTHER_10000 = character('HISTORY_OTHER_10000', { ap: 10000 });
const OTHER_9999 = character('HISTORY_OTHER_9999', { ap: 9999 });
const BLACK_CUTIN = character('HISTORY_BLACK_CUTIN', {
  colors: ['黒'], level: 8,
  abilities: [{ id: 'cutin', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 0 } }, description: '【カットイン】', ruleRefs: [] } as never],
});

function settle(state: GameState): void {
  for (let i = 0; i < 8; i += 1) {
    runAllUntilEmpty(state);
    const queue = (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue ?? [];
    if (queue.length === 0) return;
    drainAiEffectPicks(state, new HeuristicPolicy());
  }
  runAllUntilEmpty(state);
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  [B10031, B10037, B10037P, B10091, VICTIM, OTHER_10000, OTHER_9999, BLACK_CUTIN].forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('CT-P10 contact and CutIn turn-history cards', () => {
  it('B10031 converts itself to face-up evidence only after its own contact removal, before turn cleanup', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar('B10031', 'minowa')];
    state.players.opp.scene = [sceneChar('HISTORY_VICTIM', 'victim')];

    mutate.scene.removeToRemove(state, 'victim', 'contact-ap', 'minowa');
    endTurn(state, 'self');
    settle(state);

    expect(state.players.self.scene).toEqual([]);
    expect(state.players.self.evidence).toContainEqual(expect.objectContaining({ cardId: 'B10031', faceUp: true }));
  });

  it('B10037 only observes another non-Kyogoku AP10000 attacker, and its declared ability requires its own history flag', () => {
    const observer = B10037.abilities[0]!;
    expect(observer.condition).toMatchObject({
      kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap',
      by: { excludeSource: true, filter: { cardNameNot: '京極真', apMin: 10000 } },
    });
    expect(B10037P.abilities).toEqual(B10037.abilities);

    const legal = createEmptyGameState();
    legal.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    legal.players.self.case = { cardId: 'CASE', status: '事件編', requiredEvidence: 6, colors: ['緑', '白'], declaredUseCount: {} };
    legal.players.self.scene = [sceneChar('B10037', 'kyogoku', { turnEffects: { contactImmune: false, removeOnTurnEnd: false, apMod_turn: 4000, removedOpponentByContactThisTurn: true } })];
    expect(canDeclaredAbility(legal, 'kyogoku', 'a2')).toBe(true);

    legal.players.self.scene[0]!.turnEffects.removedOpponentByContactThisTurn = false;
    expect(canDeclaredAbility(legal, 'kyogoku', 'a2')).toBe(false);
  });

  it('B10037 excludes AP9999, same-name attackers, and source UID while retaining a distinct matching attacker', () => {
    const condition = B10037.abilities[0]!.condition as { by: { filter: { apMin: number; cardNameNot: string }; excludeSource: boolean } };
    expect(condition.by.filter.apMin).toBe(10000);
    expect(condition.by.filter.cardNameNot).toBe('京極真');
    expect(condition.by.excludeSource).toBe(true);
  });

  it('B10037 fires immediately only for the distinct AP10000 contact remover', () => {
    const firesFor = (attackerCardId: string, attackerUid: string): boolean => {
      const state = createEmptyGameState();
      state.players.self.scene = [
        sceneChar('B10037', 'kyogoku'),
        sceneChar(attackerCardId, attackerUid),
      ];
      state.players.opp.scene = [sceneChar('HISTORY_VICTIM', 'victim')];
      mutate.scene.removeToRemove(state, 'victim', 'contact-ap', attackerUid);
      return state.pendingEffects.some(effect => effect.triggeredBy?.hook === 'leave:to-remove' && effect.source?.uid === 'kyogoku');
    };

    expect(firesFor('HISTORY_OTHER_10000', 'other')).toBe(true);
    expect(firesFor('HISTORY_OTHER_9999', 'low')).toBe(false);
    expect(firesFor('B10037', 'same-name')).toBe(false);
    const sourceIsAttacker = createEmptyGameState();
    sourceIsAttacker.players.self.scene = [sceneChar('B10037', 'kyogoku')];
    sourceIsAttacker.players.opp.scene = [sceneChar('HISTORY_VICTIM', 'victim')];
    mutate.scene.removeToRemove(sourceIsAttacker, 'victim', 'contact-ap', 'kyogoku');
    expect(sourceIsAttacker.pendingEffects).toHaveLength(0);
  });

  it('B10037 evaluates the attacker after contact AP modifiers are applied', () => {
    const firesFor = (baseAp: number, contactBoost: number): boolean => {
      const state = createEmptyGameState();
      state.players.self.scene = [
        sceneChar('B10037', 'kyogoku'),
        sceneChar('HISTORY_OTHER_9999', 'boosted', {
          apOverride: baseAp,
          turnEffects: {
            contactImmune: false,
            removeOnTurnEnd: false,
            apMod_contact: contactBoost,
          },
        }),
      ];
      state.players.opp.scene = [sceneChar('HISTORY_VICTIM', 'victim')];
      mutate.scene.removeToRemove(state, 'victim', 'contact-ap', 'boosted');
      return state.pendingEffects.some(effect => effect.source?.uid === 'kyogoku');
    };

    // qa: card:B10037:493f9def1e5c5cf3dd006d9db402e0eaf8b16963ea72011060c09a7e794c6d90
    expect(firesFor(9999, 1), 'AP9999 + contact AP1 = AP10000').toBe(true);
    expect(firesFor(9998, 1), 'contact modifier after AP remains below 10000').toBe(false);
  });

  it('B10091 grants Assault at four black CutIn characters and only bottom-decks on the entry-history turn', () => {
    const continuous = B10091.abilities[0]!;
    expect(continuous).toMatchObject({
      type: 'continuous',
      condition: { kind: 'sceneHas', nMin: 4, query: { area: 'scene', side: 'self', filter: { color: '黒', cutinTextIncludes: '' } } },
    });
    expect(B10091.abilities[1]!.condition).toEqual({ kind: 'charTurnEffect', key: 'enteredByCutinEffectThisTurn' });

    const entered = createEmptyGameState();
    entered.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    entered.players.self.scene = [sceneChar('B10091', 'calvados', { turnEffects: { contactImmune: false, removeOnTurnEnd: false, enteredByCutinEffectThisTurn: true } })];
    endTurn(entered, 'self');
    settle(entered);
    expect(entered.players.self.deck).toContain('B10091');

    const ordinary = createEmptyGameState();
    ordinary.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    ordinary.players.self.scene = [sceneChar('B10091', 'ordinary')];
    endTurn(ordinary, 'self');
    settle(ordinary);
    expect(ordinary.players.self.scene.map(char => char.uid)).toEqual(['ordinary']);
    expect(ordinary.players.self.scene[0]!.turnEffects.enteredByCutinEffectThisTurn).toBeUndefined();
  });
});
