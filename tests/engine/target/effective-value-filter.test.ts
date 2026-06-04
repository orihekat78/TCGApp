// 数値フィルタ (apMin/apMax/lpMin/lpMax) は「効果解決時点の有効値」= turnEffects の ±修正を
// 合算した値で判定する (rules/15,19,22)。旧実装は override?printed のみで turn 修正を無視していた。
//   - 「APX以下」リムーブ (D08003/D11003/D11020 等) は debuff されたキャラを正しく対象に含む。
//   - D11012「LP0の警察」は buff 済 (有効 LP>0) のキャラを誤って含めない。
//
// rules: 19-special-rules.md (AP/LP は ±修正で変動・下限なし), 22-qa-action-contact.md (AP 参照)

import { describe, it, expect, beforeAll } from 'vitest';
import { matchOneFilter } from '@/engine/target/candidates';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import type { SceneCharacter, Candidate, GameState } from '@/engine/types';

function sceneChar(cardId: string, uid: string, over?: Partial<SceneCharacter>): SceneCharacter {
  return {
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
    ...over,
  };
}
function charCand(uid: string, cardId: string): Candidate {
  return { kind: 'char', uid, cardId, player: 'self' } as unknown as Candidate;
}
function withChar(ch: SceneCharacter): GameState {
  const s = createEmptyGameState();
  s.players.self.scene = [ch];
  return s;
}

describe('effective-value-filter — 数値フィルタは有効値 (±修正込み) で判定', () => {
  beforeAll(() => registerAll());

  it('apMax: debuff (apMod_turn -2000) で有効 AP がしきい値以下に下がると対象に含まれる', () => {
    const ch = sceneChar('D11013', 'x', { apOverride: 7000, turnEffects: { contactImmune: false, removeOnTurnEnd: false, apMod_turn: -2000 } });
    const s = withChar(ch);
    // 有効 AP = 7000 + (-2000) = 5000 ≤ 6000 → match (旧実装は printed 7000 で対象外だった)
    expect(matchOneFilter(s, 'D11013', { apMax: 6000 }, ch, charCand('x', 'D11013'))).toBe(true);
  });

  it('apMax: 修正なしの高 AP キャラはしきい値超で対象外 (回帰)', () => {
    const ch = sceneChar('D11013', 'y', { apOverride: 7000 });
    const s = withChar(ch);
    expect(matchOneFilter(s, 'D11013', { apMax: 6000 }, ch, charCand('y', 'D11013'))).toBe(false);
  });

  it('D11012「LP0の」: buff (lpMod_turn +1) で有効 LP=1 の警察は lpMin0/lpMax0 に含まれない', () => {
    const ch = sceneChar('D11012', 'z', { lpOverride: 0, turnEffects: { contactImmune: false, removeOnTurnEnd: false, lpMod_turn: 1 } });
    const s = withChar(ch);
    // 有効 LP = 0 + 1 = 1 → 「LP0の」に該当しない (旧実装は lpOverride 0 で誤って含めた)
    expect(matchOneFilter(s, 'D11012', { trait: '警察', lpMin: 0, lpMax: 0 }, ch, charCand('z', 'D11012'))).toBe(false);
  });

  it('D11012「LP0の」: 修正なし (printed LP0) の警察は対象に含まれる', () => {
    const ch = sceneChar('D11012', 'w'); // printed lp:0
    const s = withChar(ch);
    expect(matchOneFilter(s, 'D11012', { trait: '警察', lpMin: 0, lpMax: 0 }, ch, charCand('w', 'D11012'))).toBe(true);
  });
});
