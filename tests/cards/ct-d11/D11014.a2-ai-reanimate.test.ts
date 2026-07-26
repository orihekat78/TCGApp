// BUG-106: D11014 a2 の AI/CPU 経路で単一 Pattern B pick (sceneEnter cardId:'$pick.cardId')
// が resolve-picks の AI walk で解決されず silent no-op になる回帰テスト (D08021 multi-pick BUG-103 と同根)。
//
// rules: 15-abilities-effects.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
//
// 根本原因: substituteAtomPick の AI 経路 (Pattern B) は target:[pickValue] のみ substitute し
//   cardId:'$pick.cardId' を解決しない → sceneEnter handler が cardId 未解決 + target=array で
//   awaiting-pick 分岐 → tryRePickFromAtom は target が pick-query でないため push せず silent no-op。
//   結果 CPU の D11014 a2 はリムーブ警察を登場させられず、萩原千速 登場時の 1 ドローも不発。

import { describe, it, expect, beforeAll } from 'vitest';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { D11014 } from '@/cards/ct-d11/D11014';
import type { EffectCtx } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';


function aiCtx(): EffectCtx {
  return {
    source: { player: 'self', cardId: 'D11014', uid: 'shigo', abilityId: 'a2', area: 'scene' },
    bindings: {},
  } as unknown as EffectCtx;
}

// flow.useDeclaredAbility (declared-ability.ts:164) が AI 経路で渡す opts を再現する。
function aiResolveAndRun(effect: unknown, s: ReturnType<typeof createEmptyGameState>): void {
  const policy = new HeuristicPolicy();
  const ctx = aiCtx();
  const resolved = resolveEffectPicks(s, effect as never, ctx, {
    chooseAtomTarget: policy.chooseAtomTarget?.bind(policy),
    byPlayer: 'self',
    humanChooser: false,
    source: { cardId: 'D11014', abilityId: 'a2' },
  });
  runEffect(s, resolved as never, ctx);
}

describe('D11014 a2 — AI 経路の単一 PB pick (sceneEnter) 解決 (BUG-106)', () => {
  beforeAll(() => registerAll());

  it('リムーブの 萩原千速(D11011, 警察 Lv5) を登場させ、萩原千速 なので 1 ドローする', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['D08013']; // step1 discard 用フィラー (少年探偵団 = 非警察)
    s.players.self.remove = ['D11011']; // step2 reanimate 対象 (萩原千速 黄 Lv5 警察)
    s.players.self.deck = ['D08014']; // step3 draw 対象

    aiResolveAndRun(D11014.abilities[1].effect, s);

    const sceneIds = s.players.self.scene.map((c) => c.cardId);
    expect(sceneIds, 'リムーブの 萩原千速 が現場に登場').toContain('D11011');
    expect(s.players.self.remove, '登場した 萩原千速 はリムーブから除去').not.toContain('D11011');
    expect(s.players.self.hand, 'discard 1 + draw 1 → ドローしたカードが手札').toEqual(['D08014']);
    expect(s.players.self.deck, 'draw の exact exhaustion → discard カードを即 refresh').toEqual(['D08013']);
    expect(s.players.self.remove).toHaveLength(0);
    expect(s.refreshCount.self).toBe(1);
    expect(s.players.opp.evidence).toHaveLength(1);
  });

  it('萩原千速 以外の 警察 Lv5以下(D11012, 警察 Lv4) を登場させた場合は 1 ドローしない', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['D08013'];
    s.players.self.remove = ['D11012']; // 横溝重悟 (警察 Lv4, 非 萩原千速)
    s.players.self.deck = ['D08014'];

    aiResolveAndRun(D11014.abilities[1].effect, s);

    const sceneIds = s.players.self.scene.map((c) => c.cardId);
    expect(sceneIds, 'リムーブの 警察 が現場に登場').toContain('D11012');
    expect(s.players.self.remove, '登場した 警察 はリムーブから除去').not.toContain('D11012');
    expect(s.players.self.deck.length, '萩原千速 以外なのでドローなし → デッキ据え置き').toBe(1);
  });

  it('現場が満杯(5枚)のときは effect 登場を crash させず skip する (rules/15 可能な限り)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    // 現場 5 枚 (満杯)
    s.players.self.scene = Array.from({ length: 5 }, (_, i) => sceneChar('D11014', `c${i}`));
    s.players.self.hand = ['D08013'];
    s.players.self.remove = ['D11011'];
    s.players.self.deck = ['D08014'];

    expect(() => aiResolveAndRun(D11014.abilities[1].effect, s)).not.toThrow();

    // skip: 登場せず、リムーブにカードが残る (消失バグ防止)、ドローもなし
    expect(s.players.self.scene.length, '現場満杯のため登場 skip → 5 枚のまま').toBe(5);
    expect(s.players.self.remove, '登場 skip 時はカードがリムーブに残る').toContain('D11011');
    expect(s.players.self.deck.length, '萩原千速 未登場なのでドローなし').toBe(1);
  });
});
