// BUG-091: D11019「15の受難」a1 が deckRevealUntil で matched した黄キャラを現場に登場
// させない (sceneEnter silent no-op) + charGrantKeyword ($matched.uid) も発火しない 回帰テスト。
//
// rules: 13-keywords.md, 20-color-and-switch.md, 26-qa-deck-refresh.md
//
// 根本原因: deckRevealUntil は ctx.bindings['$matched'] ($込みキー) に格納するが、
//   resolveBindRef は value.slice(1,dot)='matched' ($無し) で lookup → 未解決 →
//   sceneEnter が cardId.startsWith('$') で silent no-op。sceneEnter の uid write-back も
//   '$matched'.slice(1)='matched' で binding を見つけられず $matched.uid が後続で解決不能。

import { describe, it, expect, beforeAll } from 'vitest';
import { run as runEffect } from '@/engine/effect/resolver';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import { D11019 } from '@/cards/ct-d11/D11019';
import type { EffectCtx } from '@/engine/types';

function ctxFor(): EffectCtx {
  return { source: { player: 'self', cardId: 'D11019', abilityId: 'a1', area: 'hand' }, bindings: {} } as unknown as EffectCtx;
}

describe('D11019 a1 — 公開した黄キャラを現場に登場 (BUG-091)', () => {
  beforeAll(() => registerAll());

  it('deckRevealUntil で matched した黄キャラ(D11013)が現場に登場する', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
    s.players.self.deck = ['D11013']; // 即マッチ (萩原千速: 黄 lv2 character)

    runEffect(s, D11019.abilities[0].effect as never, ctxFor());

    const sceneIds = s.players.self.scene.map((c) => c.cardId);
    expect(sceneIds, 'matched 黄キャラが現場に登場すべき').toContain('D11013');
  });

  it('リムーブに黄20枚以上のとき、$matched.uid が解決され登場キャラに突撃[事件]が付与される', () => {
    // BUG-091 write-back 検証: sceneEnter が登場キャラの新 uid を $matched binding に書き戻し、
    // 後続 charGrantKeyword が `$matched.uid` で「その登場キャラ」を正しく対象にできること。
    // ※ scope='turn' の付与先は turnEffects['grantedKeywords']。read.char.keywords() で読まれるか/
    //    名乗り例外で効くかは BUG-092/093 修正後の D11019.charge-keyword.test.ts で別途検証。
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
    s.players.self.deck = ['D11013'];
    s.players.self.remove = Array.from({ length: 20 }, () => 'D11013'); // 黄 20 枚

    runEffect(s, D11019.abilities[0].effect as never, ctxFor());

    const entered = s.players.self.scene.find((c) => c.cardId === 'D11013');
    expect(entered, '登場キャラが存在').toBeTruthy();
    const granted = (entered?.turnEffects as Record<string, unknown> | undefined)?.['grantedKeywords'] as string[] | undefined;
    expect(granted, '$matched.uid で対象解決され突撃[事件]が登場キャラに付与される').toContain('突撃[事件]');
  });
});
