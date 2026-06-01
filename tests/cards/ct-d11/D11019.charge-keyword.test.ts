// BUG-092 / BUG-093: D11019 a1 の登場キャラの「名乗り + 突撃[事件] 付与」挙動。
//
// rules: 06-card-types.md / 17-icons.md (効果登場も同ターン登場=名乗り) /
//        13-keywords.md (突撃[事件] = 名乗り例外) / 24-qa-naming-stun.md
//
// 検証:
//   - 効果で登場したキャラは「名乗り状態」(BUG-093: sceneEnter 既定 named:true)。
//   - リムーブ黄 < 20: 突撃[事件] 付与されず → action[事件] 不可 (名乗りのまま)。
//   - リムーブ黄 >= 20: 突撃[事件] 付与され read.char.keywords() で読まれる (BUG-092) → action[事件] 可。
//   - turn 終了で突撃[事件] が解除される (BUG-092: turnEffects 清掃)。

import { describe, it, expect, beforeAll } from 'vitest';
import { run as runEffect } from '@/engine/effect/resolver';
import * as flow from '@/engine/flow';
import { read } from '@/engine/read';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import { D11019 } from '@/cards/ct-d11/D11019';
import type { EffectCtx, GameState } from '@/engine/types';

function setup(removeYellow: number): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
  s.players.self.deck = ['D11013']; // 即マッチ (萩原千速: 黄 lv2 char)
  s.players.self.remove = Array.from({ length: removeYellow }, () => 'D11013'); // 黄
  // opp の事件は証拠 1 以上ないと action[事件] 対象にできない (rules/07)
  s.players.opp.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
  s.players.opp.evidence = [{ cardId: 'D08017', faceUp: false }];
  return s;
}

function runA1(s: GameState): string {
  const ctx = { source: { player: 'self', cardId: 'D11019', abilityId: 'a1', area: 'hand' }, bindings: {} } as unknown as EffectCtx;
  runEffect(s, D11019.abilities[0].effect as never, ctx);
  const ch = s.players.self.scene.find((c) => c.cardId === 'D11013');
  return ch?.uid ?? '';
}

describe('D11019 a1 — 名乗り + 突撃[事件] 付与 (BUG-092/093)', () => {
  beforeAll(() => registerAll());

  it('効果で登場したキャラは名乗り状態 (BUG-093)', () => {
    const s = setup(0);
    const uid = runA1(s);
    const ch = s.players.self.scene.find((c) => c.uid === uid);
    expect(ch?.isNamed, '効果登場キャラは名乗り').toBe(true);
  });

  it('リムーブ黄<20: 突撃[事件]なし → 名乗りのまま action[事件] 不可', () => {
    const s = setup(0); // 黄 0 枚
    const uid = runA1(s);
    expect(read.char.hasKeyword(s, uid, '突撃[事件]'), '突撃[事件] 付与されない').toBe(false);
    expect(flow.canActionAgainstCase(s, uid, 'opp'), '名乗りで action[事件] 不可').toBe(false);
  });

  it('リムーブ黄>=20: 突撃[事件] 付与 (BUG-092 で読まれる) → action[事件] 可', () => {
    const s = setup(20); // 黄 20 枚
    const uid = runA1(s);
    expect(read.char.hasKeyword(s, uid, '突撃[事件]'), '突撃[事件] が keywords() で読まれる').toBe(true);
    expect(flow.canActionAgainstCase(s, uid, 'opp'), '突撃[事件] で action[事件] 可').toBe(true);
  });

  it('turn 終了で突撃[事件] が解除される (BUG-092 turnEffects 清掃)', () => {
    const s = setup(20);
    const uid = runA1(s);
    expect(read.char.hasKeyword(s, uid, '突撃[事件]')).toBe(true);
    flow.endTurn(s, 'self');
    expect(read.char.hasKeyword(s, uid, '突撃[事件]'), 'turn 終了で突撃[事件] 解除').toBe(false);
  });
});
