// B06058 庄之介 (engine変更0, DEFERRED-INDEX 誤分類訂正) — gate5 実 engine probe (BUG-117/118 lesson)。
//
// a1【解決編】【登場時】optional{chain[discard{n:1}, sceneSetState{side:'self', state:'active',
//   filter:{cardName:'鉄刃', lpMin:0, lpMax:0}}]} の load-bearing:
//   (1) 構造 = optional ラッパ (「してもよい」)。(2) side:'self' → 相手現場の LP0 鉄刃 は非対象。
//   (3) lpMin:0/lpMax:0 → 有効LP1 の 鉄刃 は非対象。(4) cardName 鉄刃 → 非鉄刃 LP0 は非対象。
//   (5) chain「そうした場合」gate = 手札0 で discard 不成立 → activate 不発 (over-fire 防止)。
// a2【ヒラメキ】handAddFromRemove{filter:{kind:'event', trait:'YAIBA'}}:
//   YAIBA イベントのみ手札へ。非YAIBA イベント / YAIBA キャラ (kind:'event' 除外) は残置。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { run as runEffect } from '@/engine/effect/resolver';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { makeChar } from '../../helpers/fixtures';
import type { CardDef, GameState, EffectCtx, Effect, SceneCharacter } from '@/engine/types';
import { B06058 } from '@/cards/ct-p06/B06058';

function pchar(id: string, names: string[], lp: number, traits: string[] = []): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names, colors: ['白'], level: 3, ap: 1000, lp,
    traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
function pevent(id: string, names: string[], traits: string[] = []): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names, colors: ['白'], level: 1,
    traits, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
  registerCardDef(B06058);
  registerCardDef(pchar('TETSU0', ['鉄刃'], 0)); // 対象: 鉄刃 LP0
  registerCardDef(pchar('TETSU1', ['鉄刃'], 1)); // decoy: 鉄刃 LP1 (LP0-exact 除外)
  registerCardDef(pchar('MORI', ['毛利蘭'], 0)); // decoy: 非鉄刃 LP0 (cardName 除外)
  registerCardDef(pchar('HANDC', ['手札キャラ'], 1)); // discard 対象
  registerCardDef(pevent('YAIBA_EV', ['ヤイバの剣'], ['YAIBA'])); // hirameki 対象
  registerCardDef(pevent('OTHER_EV', ['別イベント'], [])); // decoy: 非YAIBA イベント
  registerCardDef(pchar('YAIBA_CH', ['刃キャラ'], 1, ['YAIBA'])); // decoy: YAIBA だが キャラ (kind:'event' 除外)
});

const a1 = B06058.abilities.find((a) => a.id === 'a1')!;
const innerChain = (a1.effect as { effect: Effect }).effect; // optional 内の chain
const a2Effect = B06058.abilities.find((a) => a.id === 'a2')!.effect as Effect;

const ctx = (abilityId: string): EffectCtx =>
  ({
    source: { cardId: 'B06058', uid: 'u-shono', abilityId, player: 'self', area: 'scene' },
    bindings: {},
  } as unknown as EffectCtx);

function stateOf(s: GameState, side: 'self' | 'opp', uid: string): SceneCharacter['state'] | undefined {
  return s.players[side].scene.find((c) => c.uid === uid)?.state;
}

describe('B06058 a1 — 構造 + sceneSetState side/LP/cardName filter', () => {
  it('a1.effect は optional{chain} (「してもよい」ラッパ)', () => {
    expect((a1.effect as { kind: string }).kind).toBe('optional');
    expect((innerChain as { kind: string }).kind).toBe('chain');
  });

  it('手札あり → 自現場の鉄刃LP0 のみ active 化、decoy 4種は不変', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [
      makeChar({ uid: 'self-t0', cardId: 'TETSU0', state: 'sleep' }), // 対象
      makeChar({ uid: 'self-t1', cardId: 'TETSU1', state: 'sleep' }), // LP1 decoy
      makeChar({ uid: 'self-m', cardId: 'MORI', state: 'sleep' }), // cardName decoy
    ];
    s.players.opp.scene = [
      makeChar({ uid: 'opp-t0', cardId: 'TETSU0', state: 'sleep' }), // side:'self' decoy
    ];
    s.players.self.hand = ['HANDC'];
    const after = produce(s, (d) => {
      runEffect(d, innerChain, ctx('a1'));
      _drainAllEffectPicksForTest(d);
    });
    expect(stateOf(after, 'self', 'self-t0')).toBe('active'); // ← 対象 active 化
    expect(stateOf(after, 'self', 'self-t1')).toBe('sleep'); // LP1 除外
    expect(stateOf(after, 'self', 'self-m')).toBe('sleep'); // cardName 除外
    expect(stateOf(after, 'opp', 'opp-t0')).toBe('sleep'); // 相手現場 除外
    expect(after.players.self.hand).not.toContain('HANDC'); // discard 成立
    expect(after.players.self.remove).toContain('HANDC');
  });

  it('手札0 → discard 不成立 → chain break → 鉄刃 active 化しない (over-fire防止)', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [makeChar({ uid: 'self-t0', cardId: 'TETSU0', state: 'sleep' })];
    s.players.self.hand = [];
    const after = produce(s, (d) => {
      runEffect(d, innerChain, ctx('a1'));
      _drainAllEffectPicksForTest(d);
    });
    expect(stateOf(after, 'self', 'self-t0')).toBe('sleep'); // ← 不発
  });
});

describe('B06058 a1 — 公式Q&A エッジ (有効LP / スタン / discard空振り)', () => {
  // Q&A: 元LP0 が効果で LP1以上/マイナスになっている鉄刃は選べない (解決時 有効LP=0 のみ)。
  //   candidates.ts:339 が lpOverride + lpMod 群 + continuous + aura を合算 → 印字LPでなく有効LPで判定。
  it('有効LP が +1 にシフトした鉄刃 (lpOverride:1) は非対象', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [makeChar({ uid: 'boosted', cardId: 'TETSU0', state: 'sleep', lpOverride: 1 })];
    s.players.self.hand = ['HANDC'];
    const after = produce(s, (d) => {
      runEffect(d, innerChain, ctx('a1'));
      _drainAllEffectPicksForTest(d);
    });
    expect(stateOf(after, 'self', 'boosted')).toBe('sleep'); // 有効LP1 → lpMax:0 除外
    expect(after.players.self.hand).not.toContain('HANDC'); // ただし discard は成立 (opt-in 済)
  });

  it('有効LP が マイナスの鉄刃 (lpOverride:-2) は非対象', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [makeChar({ uid: 'neg', cardId: 'TETSU0', state: 'sleep', lpOverride: -2 })];
    s.players.self.hand = ['HANDC'];
    const after = produce(s, (d) => {
      runEffect(d, innerChain, ctx('a1'));
      _drainAllEffectPicksForTest(d);
    });
    expect(stateOf(after, 'self', 'neg')).toBe('sleep'); // 有効LP-2 → lpMin:0 除外
  });

  // Q&A: スタン状態を active 化 → スリープになる (rules/03、スタン解除されアクティブの代わりにスリープ)。
  it('スタン状態の鉄刃LP0 を選択 → アクティブ化の代わりにスリープ', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [makeChar({ uid: 'stun', cardId: 'TETSU0', state: 'stun' })];
    s.players.self.hand = ['HANDC'];
    const after = produce(s, (d) => {
      runEffect(d, innerChain, ctx('a1'));
      _drainAllEffectPicksForTest(d);
    });
    expect(stateOf(after, 'self', 'stun')).toBe('sleep'); // スタン→active 指定→sleep
  });

  // 「してもよい」で opt-in → discard 成立、しかし鉄刃 不在 → 「1枚まで」=0 (空振りは合法、rules/15)。
  it('opt-in で discard 成立だが鉄刃不在 → 何も active 化しない (空振り合法)', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [makeChar({ uid: 'self-m', cardId: 'MORI', state: 'sleep' })];
    s.players.self.hand = ['HANDC'];
    const after = produce(s, (d) => {
      runEffect(d, innerChain, ctx('a1'));
      _drainAllEffectPicksForTest(d);
    });
    expect(after.players.self.remove).toContain('HANDC'); // discard 成立
    expect(stateOf(after, 'self', 'self-m')).toBe('sleep'); // 非鉄刃 は対象外
  });
});

describe('B06058 a2 — ヒラメキ handAddFromRemove {kind:event, trait:YAIBA}', () => {
  it('YAIBA イベントのみ手札へ、非YAIBA イベント / YAIBA キャラは残置', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.remove = ['YAIBA_EV', 'OTHER_EV', 'YAIBA_CH'];
    const after = produce(s, (d) => {
      runEffect(d, a2Effect, ctx('a2'));
      _drainAllEffectPicksForTest(d);
    });
    expect(after.players.self.hand).toContain('YAIBA_EV'); // 対象
    expect(after.players.self.hand).not.toContain('OTHER_EV'); // 非YAIBA 除外
    expect(after.players.self.hand).not.toContain('YAIBA_CH'); // キャラ (kind:event) 除外
    expect(after.players.self.remove).toContain('OTHER_EV');
    expect(after.players.self.remove).toContain('YAIBA_CH');
    expect(after.players.self.remove).not.toContain('YAIBA_EV');
  });
});
