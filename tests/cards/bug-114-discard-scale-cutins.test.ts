// BUG-114: B05040 / B08055 カットイン — discard-bind dyn で「リムーブしたカードの level/AP で AP スケール」。
// rules: 09-cutin-disguise.md, 15-abilities-effects.md
import { describe, it, expect, beforeAll } from 'vitest';
import { B05040 } from '@/cards/ct-p05/B05040';
import { B08055 } from '@/cards/ct-p08/B08055';
import { B08055P } from '@/cards/ct-p08/B08055P';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { char as charRead } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import type { EffectCtx, GameState } from '@/engine/types';
import { sceneChar } from '../helpers/fixtures';

function contactCtx(): EffectCtx {
  return {
    source: { player: 'self', cardId: 'X', abilityId: 'a1', area: 'remove' },
    bindings: { contact: [{ byUid: 'atk', targetUid: 'def', attackerSide: 'self' }] },
  } as unknown as EffectCtx;
}

describe('BUG-114 discard-scale cutins', () => {
  beforeAll(() => registerAll());

  it('B05040: 手札 D11012(level4) を discard → atk AP += 4*1000 = 4000', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [sceneChar('D11013', 'atk')]; // printed AP 1000
    s.players.self.hand = ['D11012']; // level 4
    const ctx = contactCtx();
    runEffect(s, B05040.abilities[0]!.effect!, ctx);
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('discard');
    applyPickAndContinuation(s, pending!, pending!.candidates[0]!.uid);
    expect(charRead.ap(s, 'atk')).toBe(5000); // 1000 + 4000
    expect(s.players.self.hand).not.toContain('D11012');
  });

  it('B05040: discard を skip → AP+ 無し (continuation drop)', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [sceneChar('D11013', 'atk')];
    s.players.self.hand = ['D11012'];
    const ctx = contactCtx();
    runEffect(s, B05040.abilities[0]!.effect!, ctx);
    runAllUntilEmpty(s);
    // skip (max:1 の任意 pick を 0 枚): BUG-111 で continuation は pending 本体に同梱されるため、
    // applyPickAndContinuation を呼ばず pending を drop すれば step2 (charModifyAP) も実行されない
    // (useEngineDispatch effectPickResolve の picked===null 経路と同挙動)。
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('discard');
    runAllUntilEmpty(s); // 何も queue されていない
    expect(charRead.ap(s, 'atk')).toBe(1000); // 修正なし (step2 不実行)
    expect(s.players.self.hand).toContain('D11012'); // discard していない
  });

  it('B08055: 手札キャラ D11012(AP4000) を discard → atk AP += 4000', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [sceneChar('D11013', 'atk')];
    s.players.self.hand = ['D11012']; // character, AP 4000
    const ctx = contactCtx();
    runEffect(s, B08055.abilities[0]!.effect!, ctx);
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('discard');
    applyPickAndContinuation(s, pending!, pending!.candidates[0]!.uid);
    expect(charRead.ap(s, 'atk')).toBe(5000); // 1000 + 4000
  });

  it('B08055P は B08055 の abilities を継承', () => {
    expect(B08055P.abilities).toBe(B08055.abilities);
    expect(B08055P.id).toBe('B08055P');
  });
});
