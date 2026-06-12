// forEach over:{kind:'all'} primitive verification — applies an atom to EACH matched char.
// The current-item binding is a Candidate, referenced via `$each.uid` (NOT bare `$each`).
// No card used forEach before 2026-06-05; this documents/guards the pattern now relied on by
// "すべて/全員" all-targeting cards (e.g. B06071「閃光弾!?」, B02032「立てや坂田ァ!!」).
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { run } from '@/engine/effect/resolver';
import type { EffectCtx, GameState, SceneCharacter, Effect } from '@/engine/types';
import { makeChar as baseChar } from '../../helpers/fixtures';

function makeChar(o: Partial<SceneCharacter> = {}): SceneCharacter {
  return baseChar({ cardId: 'C', uid: 'u', ...o });
}
const ctx: EffectCtx = { source: { player: 'self', area: 'hand' }, bindings: {} };

describe('forEach over:{kind:all} + $each.uid', () => {
  it('applies sceneSetState(stun) to ALL sleep chars on both sides, leaving active ones', () => {
    let s = createEmptyGameState();
    s = {
      ...s,
      players: {
        ...s.players,
        self: { ...s.players.self, scene: [makeChar({ uid: 's1', state: 'sleep' }), makeChar({ uid: 's2', state: 'active' })] },
        opp: { ...s.players.opp, scene: [makeChar({ uid: 'o1', state: 'sleep' }), makeChar({ uid: 'o2', state: 'sleep' })] },
      },
    };
    const eff: Effect = {
      kind: 'forEach',
      over: { kind: 'all', query: { area: 'scene', side: 'either', state: ['sleep'] } },
      do: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$each.uid', state: 'stun' } },
    } as Effect;
    const r = produce(s, d => { run(d, eff, ctx); });
    const g = (uid: string) => [...r.players.self.scene, ...r.players.opp.scene].find(c => c.uid === uid)!;
    expect([g('s1').state, g('o1').state, g('o2').state]).toEqual(['stun', 'stun', 'stun']);
    expect(g('s2').state).toBe('active');
  });
});
