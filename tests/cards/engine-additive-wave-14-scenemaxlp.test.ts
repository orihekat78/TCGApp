// engine additive wave-14 (2026-07-02, G16 残) — $self.sceneMaxLp dyn の挙動テスト。
//
// $self.sceneMaxLp — ctx.source.player の現場キャラの「実効 LP の最大値」。B08043「手のこんだ悪巧み」
//   (相手の現場にいるキャラを1枚まで選ぶ。そのキャラが自分の現場にいる LP がもっとも高いキャラの LP 以下の
//   LP の場合、リムーブする) の相対 LP フィルタ足場。filter に lpMax:{dyn:'$self.sceneMaxLp'} を置くと
//   resolveFilterDynObj が field-agnostic に literalize → matchOneFilter が対象の実効 LP と突合 (G15 の
//   apMin/apMax:{dyn:'$self.ap'} と同経路、engine 変更は dyn case 追加のみ)。
//   - 実効 LP = charRead.lp (override?base + lpMod各scope + continuous + aura。公式 Q&A: 解決時点の実効 LP)。
//   - 現場 0 枚 = 「もっとも高いキャラ」不在 → max of ∅ = -Infinity を返す (公式 Q&A: 自分の現場にキャラが
//     いない場合はリムーブ不可)。lpMax:-Infinity は matchOneFilter で全候補を除外 (lp > -Infinity 恒真)。
//   - player ベース (uid 不要、oppSceneCount/sceneColorNot と同じ pre-switch 分岐)。
// rules: 03(現場=scene), 11(LP), 15(「〜の場合」/「以下」), 19(LP に下限なし=マイナス可), 22(実効値参照)。

import { describe, it, expect, beforeEach } from 'vitest';
import { evalDyn } from '@/engine/dyn/eval';
import { matchOneFilter } from '@/engine/target/candidates';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import type { CardDef, GameState, EffectCtx, Candidate } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
});

const ctxSelf = (): EffectCtx => makeCtx({ source: { player: 'self', area: 'scene', uid: 'm1' } });

describe('engine-additive-wave-14 $self.sceneMaxLp dyn', () => {
  function setup(): GameState {
    registerCardDef(ch('LP1', { lp: 1 }));
    registerCardDef(ch('LP3', { lp: 3 }));
    registerCardDef(ch('LP2', { lp: 2 }));
    const s = createEmptyGameState();
    s.players.self.scene = [
      sceneChar('LP1', 'm1'),
      sceneChar('LP3', 'm2'),
      sceneChar('LP2', 'm3'),
    ];
    s.players.opp.scene = [sceneChar('LP1', 'o1', { /* decoy */ })];
    // decoy: opp に LP5 を置いても self 集計に影響しないこと
    registerCardDef(ch('LP5', { lp: 5 }));
    s.players.opp.scene.push(sceneChar('LP5', 'o2'));
    return s;
  }

  it('現場 LP {1,3,2} の最大 = 3', () => {
    expect(evalDyn(setup(), '$self.sceneMaxLp', ctxSelf())).toBe(3);
  });

  it('decoy: opp の LP5 は self 集計に含めない (player ベース)', () => {
    expect(evalDyn(setup(), '$self.sceneMaxLp', ctxSelf())).toBe(3);
  });

  it('実効 LP: lpMod_turn で +2 された LP1 が最大値を押し上げる (charRead.lp 経路)', () => {
    registerCardDef(ch('BASE', { lp: 1 }));
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('BASE', 'm1', { turnEffects: { lpMod_turn: 4 } })]; // 1+4=5
    expect(evalDyn(s, '$self.sceneMaxLp', ctxSelf())).toBe(5);
  });

  it('現場 0 枚 → -Infinity (もっとも高いキャラ不在、公式 Q&A: リムーブ不可)', () => {
    const s = createEmptyGameState();
    expect(evalDyn(s, '$self.sceneMaxLp', ctxSelf())).toBe(Number.NEGATIVE_INFINITY);
  });

  it('source.player=opp 視点では opp 現場を集計 (LP {1,5} → 5)', () => {
    const s = setup();
    expect(evalDyn(s, '$self.sceneMaxLp', makeCtx({ source: { player: 'opp', area: 'scene', uid: 'o1' } }))).toBe(5);
  });
});

describe('engine-additive-wave-14 sceneMaxLp を lpMax フィルタに載せた honor (B08043 経路)', () => {
  // matchOneFilter が resolveFilterDynObj literalize 後の lpMax:number を実効 LP と突合することを確認。
  function target(cardId: string, lp: number, over: Partial<CardDef> = {}): { s: GameState; sc: ReturnType<typeof sceneChar>; cand: Candidate } {
    registerCardDef(ch(cardId, { lp, ...over }));
    const s = createEmptyGameState();
    const sc = sceneChar(cardId, `${cardId}#1`);
    s.players.opp.scene = [sc];
    const cand: Candidate = { kind: 'char', uid: `${cardId}#1`, cardId, player: 'opp' };
    return { s, sc, cand };
  }

  it('own sceneMaxLp=3: 相手 LP2 は該当 / LP4 は除外', () => {
    const a = target('T2', 2);
    expect(matchOneFilter(a.s, 'T2', { lpMax: 3 }, a.sc, a.cand)).toBe(true);
    const b = target('T4', 4);
    expect(matchOneFilter(b.s, 'T4', { lpMax: 3 }, b.sc, b.cand)).toBe(false);
  });

  it('own sceneMaxLp=3: 相手 LP3 (境界=以下) は該当', () => {
    const a = target('T3', 3);
    expect(matchOneFilter(a.s, 'T3', { lpMax: 3 }, a.sc, a.cand)).toBe(true);
  });

  it('現場 0 枚 (lpMax=-Infinity): いかなる LP の相手も除外 (LP-2000 の負値含む)', () => {
    const a = target('TNEG', -2000);
    expect(matchOneFilter(a.s, 'TNEG', { lpMax: Number.NEGATIVE_INFINITY }, a.sc, a.cand)).toBe(false);
  });
});
