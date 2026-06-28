// wave certify-0628 — B03035 大滝悟郎 / B04037 鈴木園子 (engine変更0, Task A green候補)。
// 敵対 verify (verifyOk) 済だが、gate5 として実 engine 挙動を probe する (BUG-117/118 lesson)。
//
// B04037 a1 の load-bearing 部:【相手ターン中】〚京極真〛がコンタクトしたとき → 手札の〚鈴木園子〛を
//   1枚リムーブしてもよい → そうした場合 京極真は「コンタクトによってリムーブされない」。
//   検証:(1) chain[discard{鈴木園子}, charSetTurnEffect contactImmune_action] が gate される
//   (鈴木園子 不在で step2 不発)、(2) discard 成立で京極真が read.char.hasTextAbility(contactImmune)=true
//   (= state-machine.ts:293 snapshotAP が AP判定で読む免疫トークン)、(3) $trigger.bUid 解決。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { run as runEffect } from '@/engine/effect/resolver';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read/index';
import { makeChar } from '../helpers/fixtures';
import type { CardDef, GameState, EffectCtx, Effect } from '@/engine/types';
import { B03035 } from '@/cards/ct-p03/B03035';
import { B04037 } from '@/cards/ct-p04/B04037';

function pchar(id: string, names: string[], traits: string[] = []): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names, colors: ['白'], level: 3, ap: 1000, lp: 1,
    traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
  registerCardDef(B03035);
  registerCardDef(B04037); // 鈴木園子 (names:['鈴木園子'])
  registerCardDef(pchar('KYOGOKU', ['京極真'], ['格闘家']));
  registerCardDef(pchar('OTHER', ['毛利蘭'], ['高校生']));
});

const a1Effect = B04037.abilities.find((a) => a.id === 'a1')!.effect as Effect;
const ctxA1 = (): EffectCtx => ({
  source: { cardId: 'B04037', uid: 'u-sonoko', abilityId: 'a1', player: 'self', area: 'scene' },
  bindings: {},
  triggerPayload: { bUid: 'u-kyo' },
} as unknown as EffectCtx);

describe('B04037 a1 — 京極真 contactImmune (chain-gate + $trigger.bUid + hasTextAbility)', () => {
  it('手札に〚鈴木園子〛あり → discard 成立 → 京極真 contactImmune=true', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [
      makeChar({ uid: 'u-kyo', cardId: 'KYOGOKU' }),
      makeChar({ uid: 'u-sonoko', cardId: 'B04037' }),
    ];
    s.players.self.hand = ['B04037', 'OTHER']; // 鈴木園子 1枚 + decoy
    const after = produce(s, (d) => { runEffect(d, a1Effect, ctxA1()); _drainAllEffectPicksForTest(d); });
    // 京極真が「コンタクトによってリムーブされない」= AP判定が読む contactImmune トークン
    expect(read.char.hasTextAbility(after, 'u-kyo', 'contactImmune')).toBe(true);
    // 鈴木園子 を手札から1枚リムーブした (decoy OTHER は残る)
    expect(after.players.self.hand).not.toContain('B04037');
    expect(after.players.self.hand).toContain('OTHER');
    expect(after.players.self.remove).toContain('B04037');
  });

  it('手札に〚鈴木園子〛なし → discard 0 → chain break → 京極真 contactImmune は付かない (over-fire防止)', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [
      makeChar({ uid: 'u-kyo', cardId: 'KYOGOKU' }),
      makeChar({ uid: 'u-sonoko', cardId: 'B04037' }),
    ];
    s.players.self.hand = ['OTHER']; // 鈴木園子 なし
    const after = produce(s, (d) => { runEffect(d, a1Effect, ctxA1()); _drainAllEffectPicksForTest(d); });
    expect(read.char.hasTextAbility(after, 'u-kyo', 'contactImmune')).toBe(false);
    expect(after.players.self.hand).toEqual(['OTHER']); // discard されない
  });
});

describe('B03035 a1/a2 — draw 効果', () => {
  it('a1 effect = カードを1枚引く', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.deck = ['DK1', 'DK2'];
    const eff = B03035.abilities.find((a) => a.id === 'a1')!.effect as Effect;
    const ctx = { source: { cardId: 'B03035', uid: 'u-otaki', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const after = produce(s, (d) => { runEffect(d, eff, ctx); });
    expect(after.players.self.hand).toContain('DK1');
    expect(after.players.self.deck).toEqual(['DK2']);
  });

  it('a2 (ヒラメキ) effect = カードを1枚引く', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.deck = ['DK1'];
    const eff = B03035.abilities.find((a) => a.id === 'a2')!.effect as Effect;
    const ctx = { source: { cardId: 'B03035', uid: 'u-otaki', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const after = produce(s, (d) => { runEffect(d, eff, ctx); });
    expect(after.players.self.hand).toContain('DK1');
  });
});
