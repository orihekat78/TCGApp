// tests/cards/night-wA3/B08002-removed-dyn — engine A3 wave (2026-07-11)
//   新 primitive: $removed.<field> static snapshot dyn + sceneRemove{bind} 実効値 snapshot。
//   B08002 コナン&灰原 a1「リムーブしたキャラのレベルと同じ枚数 mill」の core mechanic。
//   公式Q&A: 「能力や効果によってレベルが増減しているキャラをリムーブした場合 → リムーブした時点の
//            （増減した状態の）レベルを参照」= 印字ではなく **実効** level を除去**前**に snapshot。
//   ※ B08002 CARD 本体は a2 (リムーブの[少年探偵団]を picked【青】host の下に重ねる = dual-pick host≠source)
//      が charStackCard 未対応のため DEFER。本 probe は $removed dyn 単体を合成 exemplar で検証。
// rules: 11 (LP/level 下限なし) / 14 (refresh) / 19 (level 増減・下限なし) / 25 (逐次).

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { evalDyn } from '@/engine/dyn/eval';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { AtomVerb, CardDef, EffectCtx, GameState } from '@/engine/types';

function ch(id: string, level: number): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['青'], level, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
const DECK = Array.from({ length: 12 }, (_, i) => `DEC_WA3_D${i}`);

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
  registerCardDef(ch('TGT3', 3));
  for (const id of DECK) registerCardDef(ch(id, 1));
});

function ctxOf(s: GameState): EffectCtx {
  return { source: { player: 'self', area: 'scene', cardId: 'SRC' }, bindings: {} } as EffectCtx;
}
function boardWith(levelDelta: number): { s: GameState; uid: string } {
  const s = createEmptyGameState();
  s.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  const c = mutate.scene.enter(s, 'opp', 'TGT3', {}); // 相手現場の Lv3 キャラ
  if (levelDelta !== 0) mutate.char.modifyLevel(s, c.uid, levelDelta, 'turn');
  s.players.self.deck = [...DECK];
  return { s, uid: c.uid };
}

describe('$removed.level — 除去前の実効 level を静的 snapshot', () => {
  it('修正なし: printed Lv3 → snapshot 3', () => {
    const { s, uid } = boardWith(0);
    const after = produce(s, (d) => {
      const ctx = ctxOf(d);
      runAtom(d, 'sceneRemove' as AtomVerb, { uid, bind: '$removed' }, ctx);
      expect(evalDyn(d, '$removed.level', ctx), 'snapshot=3').toBe(3);
      expect((ctx.bindings as Record<string, unknown>)['$removed']).toBeTruthy();
    });
    expect(after.players.opp.scene.length, 'キャラ除去済').toBe(0);
  });

  it('レベル+2 修正 → snapshot 5 (印字3ではなく実効値、公式Q&A)', () => {
    const { s, uid } = boardWith(2);
    produce(s, (d) => {
      const ctx = ctxOf(d);
      runAtom(d, 'sceneRemove' as AtomVerb, { uid, bind: '$removed' }, ctx);
      // 除去後は $bound.level だと印字3に落ちるが、$removed は snapshot ゆえ実効5
      expect(evalDyn(d, '$removed.level', ctx), '実効 3+2=5').toBe(5);
    });
  });

  it('レベル-4 修正 → snapshot -1 (下限なし rules/19)', () => {
    const { s, uid } = boardWith(-4);
    produce(s, (d) => {
      const ctx = ctxOf(d);
      runAtom(d, 'sceneRemove' as AtomVerb, { uid, bind: '$removed' }, ctx);
      expect(evalDyn(d, '$removed.level', ctx), '3-4=-1 (負値可)').toBe(-1);
    });
  });

  it('unbound ($removed 未設定) → 0 ($discarded 同 posture)', () => {
    const { s } = boardWith(0);
    const ctx = ctxOf(s);
    expect(evalDyn(s, '$removed.level', ctx)).toBe(0);
  });
});

describe('B08002 a1 mechanic — sceneRemove{bind:$removed} → mill n:{dyn:$removed.level} (実効値枚数)', () => {
  it('Lv3+2=5 のキャラを除去 → デッキ上5枚 mill', () => {
    const { s, uid } = boardWith(2);
    const after = produce(s, (d) => {
      const ctx = ctxOf(d);
      // chain 相当: 除去 (bind snapshot) → mill by 実効 level
      runAtom(d, 'sceneRemove' as AtomVerb, { uid, bind: '$removed' }, ctx);
      runAtom(d, 'mill' as AtomVerb, { player: 'self', n: { dyn: '$removed.level' } }, ctx);
    });
    expect(after.players.self.deck.length, '12 - 5 = 7').toBe(7);
    expect(after.players.self.remove.length, 'mill 5枚 (TGT3 は opp.remove なので self.remove は5)').toBe(5);
  });

  it('印字レベルで mill しない証拠: Lv3 に -1 で実効2 → 2枚 mill (印字3ではない)', () => {
    const { s, uid } = boardWith(-1);
    const after = produce(s, (d) => {
      const ctx = ctxOf(d);
      runAtom(d, 'sceneRemove' as AtomVerb, { uid, bind: '$removed' }, ctx);
      runAtom(d, 'mill' as AtomVerb, { player: 'self', n: { dyn: '$removed.level' } }, ctx);
    });
    expect(after.players.self.deck.length, '12 - 2 = 10 (実効2枚、印字3ではない)').toBe(10);
  });
});
