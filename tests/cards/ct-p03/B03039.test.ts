// BUG-114: B03039 長島茂雄 カットイン実装 (task-C charRemoveSetCard + side 分離で engine変更0 化)。
// 【カットイン】AP＋1000、相手の現場にいるキャラに裏向きでセットされているカードを1枚選び、
//   リムーブしてもよい。そうした場合、代わりにAP＋3000
// chain semantics: step1 AP+1000(base) → step2 charRemoveSetCard{side:opp}(してもよい) →
//   step3 AP+2000(そうした場合 = remove 適用時のみ continuation 実行 → 計+3000)。
// rules: 09-cutin-disguise.md, 16-card-set.md
import { describe, it, expect, beforeAll } from 'vitest';
import { B03039 } from '@/cards/ct-p03/B03039';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { char as charRead } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import type { EffectCtx, GameState } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';


describe('B03039 長島茂雄 — カットイン (AP+1000 / 相手セット除去で+3000)', () => {
  beforeAll(() => registerAll());

  it('shape: cutin ability (effect:declared optional, chain 3 steps)', () => {
    expect(B03039.abilities.length).toBe(1);
    const a = B03039.abilities[0]!;
    expect(a.type).toBe('triggered');
    expect(a.trigger?.hook).toBe('effect:declared');
    expect(a.trigger?.optional).toBe(true);
    expect(a.scope).toBe('on-hand');
    expect(a.effect?.kind).toBe('chain');
  });

  it('runtime: 相手にセットカードが無い → AP+1000 のみ (chain break)', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [sceneChar('B03039', 'atk')]; // 攻撃キャラ (cutin user)
    s.players.opp.scene = [sceneChar('D11013', 'def')];  // 相手キャラ (setCards 無し)
    // contact binding は ctx.bindings['contact'] = [{byUid,...}] の array 形 (BUG-091, atom-handlers:168-174)
    const ctx: EffectCtx = {
      source: { player: 'self', cardId: 'B03039', abilityId: 'a1', area: 'remove' },
      bindings: { contact: [{ byUid: 'atk', targetUid: 'def', attackerSide: 'self' }] },
    } as unknown as EffectCtx;
    runEffect(s, B03039.abilities[0]!.effect!, ctx);
    runAllUntilEmpty(s);
    // atk の AP は printed 4000 + 1000 = 5000 (相手セット無し → +3000 にならない)
    expect(charRead.ap(s, 'atk')).toBe(5000);
  });

  it('runtime: 相手セットを除去 → AP+3000 + セットカード除去 (chain continuation)', async () => {
    const { applyPickAndContinuation } = await import('@/engine/effect/apply-pick');
    const { _drainPendingEffectPickSide } = await import('@/engine/effect/resolve-picks');
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [sceneChar('B03039', 'atk')];
    // 相手キャラに裏向きセットカード 1 枚
    s.players.opp.scene = [sceneChar('D11013', 'def', { setCards: [{ cardId: 'SET1', faceUp: false }] })];
    const ctx: EffectCtx = {
      source: { player: 'self', cardId: 'B03039', abilityId: 'a1', area: 'remove' },
      bindings: { contact: [{ byUid: 'atk', targetUid: 'def', attackerSide: 'self' }] },
    } as unknown as EffectCtx;

    runEffect(s, B03039.abilities[0]!.effect!, ctx);
    runAllUntilEmpty(s);
    // step2 で charRemoveSetCard の pick が enqueue される → 自分が相手 'def' のセットを選んで除去
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('charRemoveSetCard');
    const setCardOccurrence = pending!.candidates.find(candidate => candidate.hostUid === 'def');
    expect(setCardOccurrence).toMatchObject({ kind: 'card', area: 'set-card', hidden: true });
    applyPickAndContinuation(s, pending!, setCardOccurrence!.uid);

    // 除去された → continuation(step3 AP+2000) 実行 → 計 +3000、セットカードも除去
    expect(charRead.ap(s, 'atk')).toBe(7000); // 4000 + 1000 + 2000
    expect(s.players.opp.scene[0]!.setCards.length).toBe(0);
  });
});
