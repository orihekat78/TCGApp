// Phase 4 Task 4.3 — flow.main.useDeclaredAbility
// rules: 17-icons.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { canDeclaredAbility, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState } from '@/engine/types';

function makeStateWithChar(opts: { named?: boolean; state?: 'active' | 'sleep' | 'stun' } = {}): { s: GameState; uid: string } {
  _resetUidCounter();
  const initial = createEmptyGameState();
  let uid = '';
  const s = produce(initial, draft => {
    const c = mutate.scene.enter(draft, 'self', 'C1', { named: opts.named, active: opts.state !== 'sleep' });
    uid = c.uid;
    if (opts.state === 'stun') {
      mutate.scene.setState(draft, c.uid, 'stun');
    } else if (opts.state === 'sleep') {
      mutate.scene.setState(draft, c.uid, 'sleep');
    }
  });
  return { s, uid };
}

describe('engine.flow.main.useDeclaredAbility', () => {
  beforeEach(() => {
    event._resetRegistry();
  });

  it('場にキャラがいる → canDeclaredAbility=true', () => {
    const { s, uid } = makeStateWithChar();
    expect(canDeclaredAbility(s, uid, 'A')).toBe(true);
  });

  it('場にキャラがいない uid → false', () => {
    const initial = createEmptyGameState();
    expect(canDeclaredAbility(initial, 'nonexistent', 'A')).toBe(false);
  });

  it('名乗り状態でも canDeclaredAbility=true (rules/24)', () => {
    const { s, uid } = makeStateWithChar({ named: true });
    expect(canDeclaredAbility(s, uid, 'A')).toBe(true);
  });

  it('スリープ状態でも canDeclaredAbility=true (cost 別判定 rules/21)', () => {
    const { s, uid } = makeStateWithChar({ state: 'sleep' });
    expect(canDeclaredAbility(s, uid, 'A')).toBe(true);
  });

  it('useDeclaredAbility で declaredUseCount がインクリメント', () => {
    const { s, uid } = makeStateWithChar();
    const after = produce(s, draft => {
      useDeclaredAbility(draft, uid, 'A');
    });
    const c = after.players.self.scene.find(c => c.uid === uid)!;
    expect(c.declaredUseCount['A']).toBe(1);
  });

  it('useDeclaredAbility で effect:declared が emit される', () => {
    const { s, uid } = makeStateWithChar();
    let fired = false;
    event.on('effect:declared', (_st, payload) => {
      const p = payload as { kind?: string };
      if (p && p.kind === 'declaredAbility') fired = true;
    });
    produce(s, draft => {
      useDeclaredAbility(draft, uid, 'A');
    });
    expect(fired).toBe(true);
  });

  it('場にいない uid に対して useDeclaredAbility → throw', () => {
    expect(() =>
      produce(createEmptyGameState(), draft => {
        useDeclaredAbility(draft, 'nonexistent', 'A');
      }),
    ).toThrow(/not on board/);
  });
});
