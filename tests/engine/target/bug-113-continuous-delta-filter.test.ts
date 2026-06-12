// BUG-113: 数値ターゲットフィルタ (apMin/apMax/lpMin/lpMax) の有効値が
// continuousModifier.apDelta/lpDelta (継続効果 dyn) を含まない → filter と display で AP/LP がずれる。
//
// 検証カード: D08005 灰原哀 — printed AP 6000、continuous { apDelta: $self.faceUpEvidence * 1000, 条件 turn:self }。
// 自分ターン中に表向き証拠 N 枚あると有効 AP = 6000 + N*1000。
// read.char.ap は continuousDelta を含む (display) が、matchOneFilter は含まなかった (BUG-113)。
//
// rules: 19-special-rules.md (AP は ±修正で変動), 15-abilities-effects.md (効果解決時の有効値), 24 (常時有効型)
import { describe, it, expect, beforeAll } from 'vitest';
import { matchOneFilter } from '@/engine/target/candidates';
import { char as charRead } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import type { SceneCharacter, Candidate, GameState, EvidenceCard } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

const charCand = (uid: string, cardId: string): Candidate =>
  ({ kind: 'char', uid, cardId, player: 'self' } as unknown as Candidate);
const ev = (i: number): EvidenceCard => ({ cardId: `ev${i}`, faceUp: true, origin: { turn: 0, via: 'effect' } });

function withD08005(faceUpCount: number): { s: GameState; ch: SceneCharacter } {
  const s = createEmptyGameState(); // turn.player = 'self' → continuous turn:self 成立
  const ch = sceneChar('D08005', 'h');
  s.players.self.scene = [ch];
  s.players.self.evidence = Array.from({ length: faceUpCount }, (_, i) => ev(i));
  return { s, ch };
}

describe('BUG-113 — matchOneFilter は continuousDelta (継続効果 dyn) を有効値に含める', () => {
  beforeAll(() => registerAll());

  it('apMax: 表向き証拠3枚で有効 AP=9000 は apMax:8000 に含まれない (filter=display 整合)', () => {
    const { s, ch } = withD08005(3);
    // display (read.char.ap) は 9000 を返す — これが正
    expect(charRead.ap(s, 'h')).toBe(9000);
    // filter も同じ有効値で判定すべき: 9000 > 8000 → 対象外
    expect(matchOneFilter(s, 'D08005', { apMax: 8000 }, ch, charCand('h', 'D08005'))).toBe(false);
  });

  it('apMin: 表向き証拠3枚で有効 AP=9000 は apMin:9000 に含まれる', () => {
    const { s, ch } = withD08005(3);
    expect(matchOneFilter(s, 'D08005', { apMin: 9000 }, ch, charCand('h', 'D08005'))).toBe(true);
  });

  it('回帰: 表向き証拠0枚なら continuousDelta=0、有効 AP=6000 は apMax:8000 に含まれる', () => {
    const { s, ch } = withD08005(0);
    expect(charRead.ap(s, 'h')).toBe(6000);
    expect(matchOneFilter(s, 'D08005', { apMax: 8000 }, ch, charCand('h', 'D08005'))).toBe(true);
  });
});
