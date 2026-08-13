import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B05058 } from '@/cards/ct-p05/B05058';
import { B05116 } from '@/cards/ct-p05/B05116';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { run as runEffect } from '@/engine/effect/resolver';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { runAllUntilEmpty } from '@/engine/resolve';
import { char as charRead } from '@/engine/read/char';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { candidates } from '@/engine/target/candidates';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import type { Effect, EffectCtx } from '@/engine/types';

const setHuman = (side: 'self' | 'opp' | null) => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = side;
};

const removeOne = (filter: Record<string, unknown> = { kind: 'character' }): Effect => (
  { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter } } as never
);

const eventCtx = (cardId = 'B05062', player: 'self' | 'opp' = 'self'): EffectCtx => (
  {
    source: { cardId, uid: `${cardId}#source`, abilityId: 'a1', player, area: 'remove' },
    bindings: {},
    triggerPayload: { kind: 'event-use', cardId, player },
  } as unknown as EffectCtx
);

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerAll();
  registerTriggeredListener();
  setHuman(null);
});

afterEach(() => {
  setHuman(null);
});

describe('B05058 富沢雄三 a1', () => {
  it('grants 鈴木財閥 only to its scene occurrence, not to an off-scene copy or disguise successor', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('B05058', 'tomizawa')];
    s.players.self.remove = ['B05058'];

    expect(charRead.traits(s, 'tomizawa')).toContain('鈴木財閥');
    expect(candidates(s, {
      kind: 'all',
      query: { side: 'self', area: 'remove', filter: { trait: ['鈴木財閥'] } },
    } as never, makeCtx())).toHaveLength(0);

    mutate.char.disguiseInto(s, 'tomizawa', 'B05116');
    expect(charRead.traits(s, 'tomizawa')).not.toContain('鈴木財閥');
  });

  it('does not let the removed source select itself, while a printed trait card can be selected', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', firstPlayer: 'self' };
    s.players.self.scene = [sceneChar('B05058', 'tomizawa')];
    s.players.self.remove = ['B05057'];

    mutate.scene.removeToRemove(s, 'tomizawa', 'effect');
    runAllUntilEmpty(s);
    drainAiEffectPicks(s, new HeuristicPolicy());

    expect(s.players.self.hand).toContain('B05057');
    expect(s.players.self.hand).not.toContain('B05058');
    expect(s.players.self.remove).toContain('B05058');
  });
});

describe('B05116 火傷の男 a1', () => {
  it('forces an eligible opposing B05116 into a real event-effect pick only', () => {
    setHuman('self');

    const sceneOnly = createEmptyGameState();
    const sceneSource = mutate.scene.enter(sceneOnly, 'opp', 'B05116', {});
    expect(charRead.selfContinuousFlag(sceneOnly, sceneSource.uid, 'mustBeSelectedByOppEvent')).toBe(true);
    mutate.scene.removeToRemove(sceneOnly, sceneSource.uid, 'effect');
    expect(charRead.selfContinuousFlag(sceneOnly, sceneSource.uid, 'mustBeSelectedByOppEvent')).toBe(false);

    const eligible = createEmptyGameState();
    const forced = mutate.scene.enter(eligible, 'opp', 'B05116', {});
    mutate.scene.enter(eligible, 'opp', 'B05057', {});
    runEffect(eligible, removeOne(), eventCtx());
    runAllUntilEmpty(eligible);
    expect(_drainPendingEffectPickSide()?.forcedUids).toEqual([forced.uid]);

    const ineligible = createEmptyGameState();
    const ineligibleForced = mutate.scene.enter(ineligible, 'opp', 'B05116', {});
    mutate.scene.enter(ineligible, 'opp', 'B05057', {});
    runEffect(ineligible, removeOne({ kind: 'character', levelMax: 4 }), eventCtx());
    runAllUntilEmpty(ineligible);
    expect(_drainPendingEffectPickSide()?.forcedUids ?? []).not.toContain(ineligibleForced.uid);

    const ownEvent = createEmptyGameState();
    const own = mutate.scene.enter(ownEvent, 'self', 'B05116', {});
    mutate.scene.enter(ownEvent, 'opp', 'B05057', {});
    runEffect(ownEvent, removeOne(), eventCtx());
    runAllUntilEmpty(ownEvent);
    expect(_drainPendingEffectPickSide()?.forcedUids ?? []).not.toContain(own.uid);

    const nonEvent = createEmptyGameState();
    const nonEventForced = mutate.scene.enter(nonEvent, 'opp', 'B05116', {});
    mutate.scene.enter(nonEvent, 'opp', 'B05057', {});
    runEffect(nonEvent, removeOne(), eventCtx('B05058'));
    runAllUntilEmpty(nonEvent);
    expect(_drainPendingEffectPickSide()?.forcedUids ?? []).not.toContain(nonEventForced.uid);
  });

  it('keeps the existing a2 sleeping scene-enter trigger intact', () => {
    const a2 = B05116.abilities.find(ability => ability.id === 'a2');
    expect(a2?.effect).toMatchObject({
      kind: 'atom',
      verb: 'sceneEnter',
      args: { player: 'self', from: 'remove', max: 1, viaEffect: true, enterSleep: true },
    });
  });
});
