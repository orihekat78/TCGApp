import { beforeEach, describe, expect, it } from 'vitest';
import { B10101 } from '@/cards/ct-p10/B10101';
import { event } from '@/engine/event';
import { run } from '@/engine/effect/resolver';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { mutate } from '@/engine/mutate';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import type { CardDef, GameState } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

const character = (id: string, extra: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['緑'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...extra,
});

const GREEN = character('B10101_GREEN');
const BLUE = character('B10101_BLUE', { colors: ['青'] });
const ASSAULT = character('B10101_ASSAULT', { keywords: ['突撃'] });
const BRACKET_ASSAULT = character('B10101_BRACKET_ASSAULT', { keywords: ['突撃[キャラ]'] });
const FILLER = character('B10101_FILLER');
const VICTIM = character('B10101_VICTIM', { colors: ['赤'] });

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  [B10101, GREEN, BLUE, ASSAULT, BRACKET_ASSAULT, FILLER, VICTIM].forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

function stateForGrant(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [sceneChar('B10101_GREEN', 'giver')];
  state.players.opp.scene = [sceneChar('B10101_VICTIM', 'victim')];
  state.players.self.deck = ['B10101_BRACKET_ASSAULT', 'B10101_ASSAULT', 'B10101_FILLER'];
  return state;
}

function settle(state: GameState): void {
  for (let i = 0; i < 8; i += 1) {
    runAllUntilEmpty(state);
    const queue = (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue ?? [];
    if (queue.length === 0) return;
    drainAiEffectPicks(state, new HeuristicPolicy());
  }
  runAllUntilEmpty(state);
}

describe('CT-P10 B10101 狙われた唇', () => {
  it('removes one hand card when its own case enters 解決編', () => {
    const state = createEmptyGameState();
    state.players.self.case = { cardId: 'B10101', status: '事件編', requiredEvidence: 6, colors: ['緑', '白'], declaredUseCount: {} };
    state.players.self.hand = ['B10101_FILLER'];

    mutate.case.toResolved(state, 'self');
    settle(state);

    // qa: card:B10101:0fade7ea1c8ab6c20539a9e00411f4a1438268092d409f38ba0f302b3fc83af9
    // qa: card:B10101:3d2620d5280c7dd0be027568ef506702b96a53e467b84d22ded4aad72b2feeba
    // qa: card:B10101:42b4d321f0944b4037dd2ca163b0a52c8a59e69bc129cd1cd6dc581361b03724
    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.remove).toContain('B10101_FILLER');
  });

  it('declared ability has the exact evidence cost, color target, and private top-four look', () => {
    const a2 = B10101.abilities[1]!;
    expect(a2).toMatchObject({
      type: 'declared', scope: 'always', limit: { kind: 'turn', n: 1 },
      condition: { kind: 'caseStatus', status: '解決編' },
      cost: { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } },
    });
    const effect = a2.effect as { args?: { filter?: unknown; ability?: { effect?: { steps?: Array<{ verb?: string; args?: unknown }> } } } };
    expect(effect.args?.filter).toMatchObject({ kind: 'character', color: ['緑', '白'] });
    const reveal = effect.args?.ability?.effect?.steps?.[0];
    expect(reveal).toMatchObject({ verb: 'deckRevealUntil', args: { player: 'self', maxN: 4, chooseMatch: 'upTo', filter: { kind: 'character', keywordFromPrintOrConditionIcon: '突撃' } } });
    expect(reveal?.args).not.toHaveProperty('visibility');
    expect(reveal?.args).not.toHaveProperty('viewer');
  });

  it('grants the contact-remove trigger and only finds the exact 突撃 keyword', () => {
    const state = stateForGrant();
    const grant = B10101.abilities[1]!.effect!;
    // The target-selection atom is exercised through its normal effect resolver.
    run(state, grant, { source: { cardId: 'B10101', abilityId: 'a2', uid: 'case:self', player: 'self', area: 'case' }, bindings: {} });
    settle(state);

    const giver = state.players.self.scene[0]!;
    const granted = giver.turnEffects?.grantedAbilities as Array<{ trigger?: { hook?: string } }> | undefined;
    expect(granted?.[0]?.trigger?.hook).toBe('leave:to-remove');

    const victim = state.players.opp.scene[0]!;
    mutate.scene.removeToRemove(state, victim.uid, 'contact-ap', giver.uid);
    settle(state);
    expect(state.players.self.hand).toContain('B10101_ASSAULT');
    expect(state.players.self.hand).not.toContain('B10101_BRACKET_ASSAULT');
  });
});
