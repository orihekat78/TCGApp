import { beforeEach, describe, expect, it } from 'vitest';
import { B02039 } from '@/cards/ct-p02/B02039';
import { registerAll } from '@/cards/index';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../helpers/fixtures';
import { useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide, _drainPendingSetCardChoiceSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation, applySetCardChoiceAndContinuation } from '@/engine/effect/apply-pick';

beforeEach(() => {
  resetDefRegistry(); registerAll(); _clearPendingEffectPickQueue();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('B02039 set-card evidence transfer', () => {
  it('selects one opaque occurrence, gives its host owner face-up evidence, then continues', () => {
    const s = createEmptyGameState();
    const yusaku = sceneChar('B02039', 'yusaku');
    const host = sceneChar('HOST', 'host');
    host.setCards = [{ cardId: 'SECRET_A', faceUp: false }, { cardId: 'SECRET_B', faceUp: false }];
    s.players.self.scene = [yusaku];
    s.players.opp.scene = [host];
    useDeclaredAbility(s, 'yusaku', 'a1'); runAllUntilEmpty(s);
    const hostPick = _drainPendingEffectPickSide();
    expect(hostPick?.candidates.map((c) => c.uid)).toContain('host');
    applyPickAndContinuation(s, hostPick!, 'host');
    runAllUntilEmpty(s);
    const setPick = _drainPendingSetCardChoiceSide();
    expect(setPick?.entries).toHaveLength(2);
    expect(JSON.stringify(setPick)).not.toContain('SECRET_A');
    applySetCardChoiceAndContinuation(s, setPick!, setPick!.entries[1]!.instanceId);
    expect(s.players.opp.evidence).toEqual([{ cardId: 'SECRET_B', faceUp: true, origin: { turn: 0, via: 'effect', sourceCardId: 'B02039' } }]);
    expect(s.players.opp.scene.find((c) => c.uid === 'host')?.setCards).toHaveLength(1);
    const removePick = _drainPendingEffectPickSide();
    expect(removePick?.candidates.map((c) => c.uid)).toContain('host');
    applyPickAndContinuation(s, removePick!, 'host');
    expect(s.players.opp.scene.find((c) => c.uid === 'host')).toBeUndefined();
  });
});
