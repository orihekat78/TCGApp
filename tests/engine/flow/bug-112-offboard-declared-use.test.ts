// BUG-112: 「自身を場外へ移すコスト」(selfToDeckBottom 等) の宣言能力で incrDeclaredUseCount が
// no-op → declaredUseCount が増えず【ターン①】等の limit が常に pass。
//
// 原因: declaredUseCount の保持先 = scene char object (uid 単位)。selfToDeckBottom はコスト支払いで
// source を scene→deck へ移すため、increment 時に uid が scene/case に居らず silent no-op。
// 読み取り (read.char.declaredUseCount) も scene.byUid のみ → off-board uid では 0 を返す。
//
// 修正: off-board (scene/case 不在) の場合は player 単位の turnState.declaredAbilityUseCount[uid:abilId]
// に fallback 記録し、read も同 fallback を参照する (per-instance=uid 単位の意味は維持、複数コピーは別 uid)。
//
// rules: 17-icons.md (【ターン①/②】), 21-declared-ability-cost.md (selfToDeckBottom)
import { describe, it, expect } from 'vitest';
import { flag } from '@/engine/mutate/flag';
import { char as charRead } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';

describe('BUG-112 — off-board uid の declaredUseCount を player 単位 fallback で追跡', () => {
  it('scene/case に居ない uid への increment が read に反映される (旧: silent no-op で 0)', () => {
    const s = createEmptyGameState();
    // 'ghost' は scene にも case にも居ない (= selfToDeckBottom 後の off-board uid を模す)
    flag.incrDeclaredUseCount(s, 'ghost', 'a1', 'self');
    expect(charRead.declaredUseCount(s, 'ghost', 'a1')).toBe(1);
  });

  it('2 回 increment で 2、別 abilId は独立カウント', () => {
    const s = createEmptyGameState();
    flag.incrDeclaredUseCount(s, 'ghost', 'a1', 'self');
    flag.incrDeclaredUseCount(s, 'ghost', 'a1', 'self');
    flag.incrDeclaredUseCount(s, 'ghost', 'a2', 'self');
    expect(charRead.declaredUseCount(s, 'ghost', 'a1')).toBe(2);
    expect(charRead.declaredUseCount(s, 'ghost', 'a2')).toBe(1);
  });

  it('回帰: turn 境界 resetTurnFlags で off-board fallback もクリアされる', () => {
    const s = createEmptyGameState();
    flag.incrDeclaredUseCount(s, 'ghost', 'a1', 'self');
    flag.resetTurnFlags(s, 'self');
    expect(charRead.declaredUseCount(s, 'ghost', 'a1')).toBe(0);
  });
});
