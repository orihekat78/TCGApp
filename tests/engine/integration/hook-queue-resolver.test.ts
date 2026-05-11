// Integration: Hook → Queue → Resolver round-trip
// spec: .claude/specs/engine-api-events.md
// spec: .claude/specs/engine-api-resolver.md
// rules: 15-abilities-effects.md, 17-icons.md
//
// シナリオ:
//   1. 'enter' フックで cardId === 'D08001' が登場したらキャラに AP+1000 (turn) を
//      かける Effect を返す listener を登録する。
//   2. produce() の中で mutate.scene.enter を呼び、続けて event.emit('enter', ...)
//      を呼ぶ。
//   3. emit によって pendingEffects に EffectStackEntry が1件積まれることを確認する。
//   4. resolve.runAllUntilEmpty で全消化する。
//   5. 該当キャラの turnEffects.apMod_turn が 1000 になっていることを確認する。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { resolve } from '@/engine/resolve/index';
import type { Effect, GameState } from '@/engine/types';

describe('integration: Hook → Queue → Resolver round-trip', () => {
  beforeEach(() => {
    event._resetRegistry();
  });

  it('D08001 enter → listener queues charModifyAP → resolver applies +1000', () => {
    // Register the listener.
    event.on('enter', (state, payload, _source) => {
      const p = payload as { uid: string; viaEffect: boolean; enterOrder: number } | undefined;
      if (!p) return;
      // Look up the entered char by uid in either side's scene.
      let cardId: string | undefined;
      for (const side of ['self', 'opp'] as const) {
        const c = state.players[side].scene.find(ch => ch.uid === p.uid);
        if (c) {
          cardId = c.cardId;
          break;
        }
      }
      if (cardId !== 'D08001') return;
      const eff: Effect = {
        kind: 'atom',
        verb: 'charModifyAP',
        args: { uid: p.uid, delta: 1000, scope: 'turn' },
      };
      return eff;
    });

    const initial = createEmptyGameState();

    // Step 1+2: enter the D08001 char and emit 'enter' inside the same produce.
    const afterEnter: GameState = produce(initial, draft => {
      const ch = mutate.scene.enter(draft, 'self', 'D08001', { named: true, viaEffect: false });
      event.emit(draft, 'enter', { uid: ch.uid, viaEffect: false, enterOrder: 1 }, { uid: ch.uid, cardId: 'D08001', player: 'self' });
    });

    // Step 3: confirm the listener queued exactly one EffectStackEntry whose Effect
    // is the expected charModifyAP atom.
    expect(afterEnter.pendingEffects).toHaveLength(1);
    expect(afterEnter.pendingEffects[0].effect.kind).toBe('atom');
    const queuedEff = afterEnter.pendingEffects[0].effect;
    if (queuedEff.kind === 'atom') {
      expect(queuedEff.verb).toBe('charModifyAP');
    }
    expect(afterEnter.pendingEffects[0].state).toBe('pending');
    expect(afterEnter.pendingEffects[0].triggeredBy.hook).toBe('enter');

    // Step 4: drain the stack.
    const afterResolve: GameState = produce(afterEnter, draft => {
      resolve.runAllUntilEmpty(draft);
    });

    // Step 5: verify the effect actually ran.
    const enteredChar = afterResolve.players.self.scene[0];
    expect(enteredChar.cardId).toBe('D08001');
    expect(enteredChar.turnEffects['apMod_turn']).toBe(1000);

    // pendingEffects is not removed but marked 'resolved'.
    expect(afterResolve.pendingEffects).toHaveLength(1);
    expect(afterResolve.pendingEffects[0].state).toBe('resolved');
  });

  it('non-matching cardId yields no queued effect', () => {
    event.on('enter', (state, payload) => {
      const p = payload as { uid: string };
      const c = state.players.self.scene.find(ch => ch.uid === p.uid);
      if (c?.cardId !== 'D08001') return; // only respond to D08001
      return { kind: 'atom', verb: 'noop', args: {} };
    });

    const initial = createEmptyGameState();
    const result = produce(initial, draft => {
      const ch = mutate.scene.enter(draft, 'self', 'OTHER_CARD', { named: true });
      event.emit(draft, 'enter', { uid: ch.uid, viaEffect: false, enterOrder: 1 });
    });
    expect(result.pendingEffects).toHaveLength(0);
  });
});
