// gate5 RUNTIME behavior — B03088 松田陣平 (character 黄/警察|警視庁, Lv5 AP5000 LP1)
//   公式テキスト:
//     【宣言】【ターン1】レベル7以下のキャラを1枚まで選び、アクティブにし、AP＋1000し、ターン終了時まで〚突撃〛を
//       与える。カードを1枚引く。この能力は自分の現場に〚カード名［降谷零］〛と〚［諸伏景光］〛と〚［伊達航］〛と
//       〚［萩原研二］〛がいる場合に宣言できる。
//     【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。
//   Q&A: AP＋1000はターン終了で切れない(現場にいる限り持続) / 自身選択可 / アクティブ状態も選択可 / ヒラメキ不発可。
//
// 検証の核 (BUG-117/118: DSL に書いても engine 実評価の保証なし / BUG-158: carrier-reuse human 経路 bind 喪失):
//   - 4名 bond gate (and{bond×4}) を canDeclaredAbility が実評価 (3/4 → 不可、4/4 → 可)。
//   - carrier-reuse: charModifyAP 短縮形 carrier (bind:'$picked') 1枚 pick に sceneSetState active + charGrantKeyword
//     突撃 の 2 rider ($picked.uid) が **human 経路で** 適用される (BUG-158 罠回避の実証)。
//   - AP＋1000 = scope:'permanent' → endTurn の clearTurnEffects('turn') 後も持続 / 突撃 = scope:'turn' → 失効。
//   - levelMax:7 filter を candidates が honor (level8 decoy 除外)。
//   - 「カードを1枚引く」は pick と独立 → 0-pick decline でも draw は必発 (B09056 continuation-drop 非該当の実証)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { cards as engineCards } from '@/engine/cards/index';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import {
  drainAiEffectPicks,
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
} from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectPickQueue,
  _peekPendingEffectPickQueueLength,
} from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { read } from '@/engine/read/index';
import { _resetPendingHirameki, _drainPendingHirameki } from '@/engine/listeners/hirameki';
import { endTurn } from '@/engine/flow/turn';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B03088 } from '@/cards/ct-p03/B03088';
import type { GameState, CardDef, EffectCtx, AbilityDef } from '@/engine/types';

const setHuman = (s: 'self' | 'opp' | null) => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
};
const queue = (): PendingEffectPickSide[] =>
  (globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] }).__pendingEffectPickQueue ?? [];

// 名前付き synthetic キャラ (bond cardName match 用)
function namedChar(id: string, cardName: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9999/${id}`, kind: 'character', names: [cardName], colors: ['黄'],
    level: 5, ap: 4000, lp: 1, traits: ['警察'], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}

function declareCtx(): EffectCtx {
  return { source: { cardId: 'B03088', uid: 'matsuda#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} };
}

// 4名 bond を満たす自現場 + TARGET(level7,sleep,ap5000) + DECOY8(level8) を組んだ盤面
function boardAll4(deckN = 3): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.scene = [
    sceneChar('B03088', 'matsuda#1'),
    sceneChar('DEC_FUKUYA', 'fukuya#1'),
    sceneChar('DEC_MOROFU', 'morofu#1'),
    sceneChar('DEC_DATE', 'date#1'),
    sceneChar('DEC_HAGI', 'hagi#1'),
    sceneChar('DEC_TARGET', 'target#1', { state: 'sleep' }),
    sceneChar('DEC_LV8', 'lv8#1'),
  ];
  // side:'either' 検証用: 相手現場に level≤7 キャラ (carrier 候補に含まれるべき, rules/15 エリア指定なし=両側)
  s.players.opp.scene = [sceneChar('DEC_OPP', 'opp#1')];
  s.players.self.deck = Array.from({ length: deckN }, (_, i) => ({ cardId: 'DEC_FUKUYA', uid: `deck#${i}` }));
  return s;
}

describe('B03088 松田陣平 — gate5 runtime (declared: 4名bond → level≤7に active+AP+1000(permanent)+突撃(turn)+draw / hirameki)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetCardDefRegistry();
    registerAll();
    engineCards.register(namedChar('DEC_FUKUYA', '降谷零'));
    engineCards.register(namedChar('DEC_MOROFU', '諸伏景光'));
    engineCards.register(namedChar('DEC_DATE', '伊達航'));
    engineCards.register(namedChar('DEC_HAGI', '萩原研二'));
    engineCards.register(namedChar('DEC_TARGET', '工藤新一', { level: 7, ap: 5000 }));
    engineCards.register(namedChar('DEC_LV8', '怪盗キッド', { level: 8, ap: 5000 }));
    engineCards.register(namedChar('DEC_OPP', '服部平次', { level: 5, ap: 4000 }));
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    _resetPendingHirameki();
    setHuman(null);
  });

  // ===== bond gate: 4名揃わないと宣言不可 =====
  it('a1 bond gate: 3/4 (萩原研二欠) → 宣言不可 / 4名揃う → 宣言可', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    // 3/4 (萩原研二 無し)
    s.players.self.scene = [
      sceneChar('B03088', 'matsuda#1'),
      sceneChar('DEC_FUKUYA', 'fukuya#1'),
      sceneChar('DEC_MOROFU', 'morofu#1'),
      sceneChar('DEC_DATE', 'date#1'),
    ];
    expect(canDeclaredAbility(s, 'matsuda#1', 'a1'), '3/4 では宣言不可').toBe(false);
    // 4人目を追加
    s = produce(s, (d) => { d.players.self.scene.push(sceneChar('DEC_HAGI', 'hagi#1')); });
    expect(canDeclaredAbility(s, 'matsuda#1', 'a1'), '4名揃えば宣言可').toBe(true);
  });

  // ===== 本道 (human 経路): carrier-reuse で 1pick に active+AP+1000+突撃 + draw、decoy 検証 =====
  it('a1 (human): level≤7 の TARGET を pick → active+AP6000+突撃 + draw1 / level8 は候補外', () => {
    setHuman('self');
    let s = boardAll4(3);
    expect(canDeclaredAbility(s, 'matsuda#1', 'a1'), '4名揃い宣言可').toBe(true);
    const handBefore = s.players.self.hand.length;

    s = produce(s, (d) => {
      useDeclaredAbility(d, 'matsuda#1', 'a1', declareCtx());
      runAllUntilEmpty(d);
    });

    // carrier pick が surface (charModifyAP)、nMin 0 (「1枚まで」)、候補に target 含み level8 除外
    expect(_peekPendingEffectPickQueueLength(), 'pick surface').toBe(1);
    const pending = queue()[0]!;
    expect(pending.atomVerb).toBe('charModifyAP');
    expect(pending.nMin, '「1枚まで」=0枚可').toBe(0);
    const cands = pending.candidates.map((c) => c.uid);
    expect(cands, 'level7 target は候補').toContain('target#1');
    expect(cands, 'level8 は候補外 (levelMax:7)').not.toContain('lv8#1');
    expect(cands, 'side:either — 相手現場の level≤7 も候補 (rules/15 エリア指定なし=両側)').toContain('opp#1');

    // TARGET を pick (human 経路: applyPickAndContinuation)
    _clearPendingEffectPickQueue();
    s = produce(s, (d) => { applyPickAndContinuation(d, pending, 'target#1'); runAllUntilEmpty(d); });

    // carrier-reuse: 3 atom 全てが同一 pick (target#1) に適用された (BUG-158 罠回避の実証)
    expect(read.char.ap(s, 'target#1'), 'AP+1000 → 6000').toBe(6000);
    expect(read.char.state(s, 'target#1'), 'アクティブ化 (sleep→active)').toBe('active');
    expect(read.char.hasKeyword(s, 'target#1', '突撃'), '突撃付与').toBe(true);
    // draw1 (pick と独立)
    expect(s.players.self.hand.length, 'カード1枚引く').toBe(handBefore + 1);
  });

  // ===== AP+1000=permanent (turn越え持続) / 突撃=turn (失効) =====
  it('a1: AP+1000 は endTurn 後も持続 (permanent) / 突撃 は失効 (turn)', () => {
    setHuman('self');
    let s = boardAll4(3);
    s = produce(s, (d) => { useDeclaredAbility(d, 'matsuda#1', 'a1', declareCtx()); runAllUntilEmpty(d); });
    const pending = queue()[0]!;
    _clearPendingEffectPickQueue();
    s = produce(s, (d) => { applyPickAndContinuation(d, pending, 'target#1'); runAllUntilEmpty(d); });
    expect(read.char.ap(s, 'target#1'), 'ターン中 AP6000').toBe(6000);
    expect(read.char.hasKeyword(s, 'target#1', '突撃'), 'ターン中 突撃').toBe(true);

    s = produce(s, (d) => { endTurn(d, 'self'); runAllUntilEmpty(d); });
    expect(read.char.ap(s, 'target#1'), 'ターン終了後も AP+1000 持続 (permanent)').toBe(6000);
    expect(read.char.hasKeyword(s, 'target#1', '突撃'), 'ターン終了後 突撃失効 (turn)').toBe(false);
  });

  // ===== 0-pick decline: buff なし、ただし draw は必発 (「カードを1枚引く」独立) =====
  it('a1: 0-pick decline → active/AP/突撃 なし、ただし draw1 は必発', () => {
    setHuman('self');
    let s = boardAll4(3);
    const handBefore = s.players.self.hand.length;
    s = produce(s, (d) => { useDeclaredAbility(d, 'matsuda#1', 'a1', declareCtx()); runAllUntilEmpty(d); });
    const pending = queue()[0]!;
    _clearPendingEffectPickQueue();
    s = produce(s, (d) => { applyPickSkipAndContinuation(d, pending); runAllUntilEmpty(d); });

    expect(read.char.ap(s, 'target#1'), 'decline: AP 不変').toBe(5000);
    expect(read.char.state(s, 'target#1'), 'decline: sleep のまま').toBe('sleep');
    expect(read.char.hasKeyword(s, 'target#1', '突撃'), 'decline: 突撃なし').toBe(false);
    expect(s.players.self.hand.length, 'decline でも draw1 は必発').toBe(handBefore + 1);
  });

  // ===== AI 経路: flow が完結し、level≤7 のいずれかが buff + draw =====
  it('a1 (AI): drainAiEffectPicks で完結 (draw1 + level≤7 へ active+突撃)', () => {
    setHuman(null);
    let s = boardAll4(3);
    const handBefore = s.players.self.hand.length;
    s = produce(s, (d) => {
      useDeclaredAbility(d, 'matsuda#1', 'a1', declareCtx());
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.hand.length, 'AI: draw1').toBe(handBefore + 1);
    expect(canDeclaredAbility(s, 'matsuda#1', 'a1'), '【ターン1】使用済 → 再宣言不可').toBe(false);
  });

  // ===== a2 hirameki RUNTIME: 証拠から action[事件] でリムーブ → ヒラメキ pending 実発火 =====
  it('a2 hirameki: B03088 が証拠から action[事件] でリムーブされると ヒラメキ pending が {cardId:B03088, a2, player:self} で立つ', () => {
    const s0 = createEmptyGameState();
    s0.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    produce(s0, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B03088' } }, { player: 'opp', uid: 'atk' });
    });
    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ pending が立つ (on-evidence trigger 実発火)').not.toBeNull();
    expect(pending?.cardId, 'pending.cardId = B03088').toBe('B03088');
    expect(pending?.abilityId, 'pending.abilityId = a2').toBe('a2');
    expect(pending?.player, 'pending.player = self (証拠を失った側)').toBe('self');
  });

  it('a2 hirameki NEGATIVE: ヒラメキ無しカードの action リムーブでは B03088 ヒラメキは立たない', () => {
    const s0 = createEmptyGameState();
    s0.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    produce(s0, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'DEC_FUKUYA' } }, { player: 'opp', uid: 'atk' });
    });
    expect(_drainPendingHirameki(), 'ヒラメキ無しカードでは pending 立たない').toBeNull();
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=declared/turn1/and{bond×4}, seq[charModifyAP carrier(permanent,bind$picked) → sceneSetState active → charGrantKeyword 突撃(turn) → draw], a2=hirameki', () => {
    const a1 = B03088.abilities.find((a) => a.id === 'a1') as AbilityDef;
    expect(a1).toMatchObject({ type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 } });
    const cond = a1.condition as { kind: string; cs: Array<{ kind: string; cardName: string }> };
    expect(cond.kind).toBe('and');
    expect(cond.cs.map((c) => c.cardName).sort()).toEqual(['伊達航', '萩原研二', '諸伏景光', '降谷零']);
    const eff = a1.effect as { kind: string; steps: Array<{ verb: string; args: Record<string, unknown> }> };
    expect(eff.kind).toBe('sequence');
    expect(eff.steps[0]).toMatchObject({ verb: 'charModifyAP', args: { max: 1, side: 'either', filter: { levelMax: 7 }, delta: 1000, scope: 'permanent', bind: '$picked' } });
    expect(eff.steps[1]).toMatchObject({ verb: 'sceneSetState', args: { uid: '$picked.uid', state: 'active' } });
    expect(eff.steps[2]).toMatchObject({ verb: 'charGrantKeyword', args: { uid: '$picked.uid', kw: '突撃', scope: 'turn' } });
    expect(eff.steps[3]).toMatchObject({ verb: 'draw', args: { player: 'self', n: 1 } });
    expect(a1.cost, 'コストなし宣言能力 (本文に: 無し)').toBeUndefined();

    const a2 = B03088.abilities.find((a) => a.id === 'a2') as AbilityDef;
    expect(a2).toMatchObject({ type: 'triggered', scope: 'on-evidence' });
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', fromSelf: true } });
  });
});
