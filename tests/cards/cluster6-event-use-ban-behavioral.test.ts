// cluster6 — usage-restriction (event-use ban) を実 engine 経路で駆動する挙動テスト
// (engine拡張 wave#2 cluster6, 2026-06-14)。B09034/B09034P は非 MVP のため smoke:1000 では踏めない
// (BUG-132 教訓: smoke green は no-op 回帰のみ保証 / 新挙動は専用テストで実証) ため必須。
//
// 検証 (公式テキスト + qAndA と 1対1):
//   M3 setEventUseBan (turnState.eventUseBanned):
//     - 手札の使用ゲート (canHandUseCard) で event のみ阻止 / キャラは阻止しない
//     - ネクストヒント (runNextHint) で event 使用は throw / キャラは不可ではない (step1 FILE→手札は阻害なし)
//     - 【カットイン】(canCutIn) は ban の影響を受けない (qAndA: カットインは制限外)
//     - 【ヒラメキ】(B09034 a2 handAddFromRemove) は ban 中でも event を回収できる (qAndA: ヒラメキは制限外)
//     - ban は resetTurnFlags (ターン境界) で解除される
//   B09034 a1 clause1 multi-pick「リムーブのイベントを2枚まで」: 0 / 1 / 3(→2上限) 枚を AI 経路で実証 +
//     非 event (キャラ) は filter:{kind:'event'} で除外 + clause2 ban は 0 枚 pick でも発火 (sequence)。
// rules: 06 / 12 / 15 / 25 (公式 Q&A) + cards-data ct-p09 event.tsv qAndA

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { canHandUseCard } from '@/engine/flow/main/hand-use-card';
import { runNextHint } from '@/engine/flow/main/next-hint';
import { canCutIn } from '@/engine/flow/contact';
import { flag } from '@/engine/mutate/flag';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { event } from '@/engine/event/index';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B09034 } from '@/cards/ct-p09/B09034';
import type { CardDef, GameState, EffectCtx, ActionContext } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

/** 色なし・低レベルの synthetic event (色/レベルゲートを素通りさせ ban のみを isolate) */
function ev(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'event', names: [id], colors: [], level: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
/** 色なし・低レベルの synthetic character */
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: [], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

function turnSelfMain(s: GameState): void {
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

function aiCtx(cardId: string, abilityId: string): EffectCtx {
  return { source: { player: 'self', cardId, uid: 'src', abilityId, area: 'hand' }, bindings: {} } as unknown as EffectCtx;
}
/** D11014.a2-ai-reanimate.test.ts と同型: AI 経路 (greedy pick) で effect を解決→実行 */
function aiResolveAndRun(effect: unknown, s: GameState, cardId: string, abilityId: string): void {
  const policy = new HeuristicPolicy();
  const ctx = aiCtx(cardId, abilityId);
  const resolved = resolveEffectPicks(s, effect as never, ctx, {
    chooseAtomTarget: policy.chooseAtomTarget?.bind(policy),
    byPlayer: 'self',
    humanChooser: false,
    source: { cardId, abilityId },
  });
  runEffect(s, resolved as never, ctx);
}

describe('cluster6 — event-use ban (setEventUseBan / turnState.eventUseBanned)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetCardDefRegistry();
    _clearPendingEffectPickQueue();
    registerAll();
    registerCardDef(ev('TESTEV'));
    registerCardDef(ch('TESTCH'));
    registerCardDef(ev('EV1'));
    registerCardDef(ev('EV2'));
    registerCardDef(ev('EV3'));
    registerCardDef(ch('CHX'));
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ---- 手札の使用ゲート ----
  it('canHandUseCard: ban 中は event 不可・キャラは可 / ban 無しは event 可', () => {
    const s = createEmptyGameState();
    turnSelfMain(s);
    s.players.self.hand = ['TESTEV', 'TESTCH'];
    s.players.self.file = [FB, FB]; // level 1 ≤ FILE 2

    // ban 無し
    expect(canHandUseCard(s, 'self', 'TESTEV'), 'ban 無し → event 可').toBe(true);
    expect(canHandUseCard(s, 'self', 'TESTCH'), 'ban 無し → character 可').toBe(true);

    // ban 有り
    s.turnState.self.eventUseBanned = true;
    expect(canHandUseCard(s, 'self', 'TESTEV'), 'ban → event 不可').toBe(false);
    expect(canHandUseCard(s, 'self', 'TESTCH'), 'ban → character は影響なし (可)').toBe(true);

    // 相手の ban は自分の使用に影響しない (per-player flag)
    const s2 = createEmptyGameState();
    turnSelfMain(s2);
    s2.players.self.hand = ['TESTEV'];
    s2.players.self.file = [FB, FB];
    s2.turnState.opp.eventUseBanned = true;
    expect(canHandUseCard(s2, 'self', 'TESTEV'), '相手の ban は自分に無関係').toBe(true);
  });

  // ---- ネクストヒントゲート ----
  // 注: runNextHint は mutate.file.popTop が Immer current() を呼ぶため、draft (produce) 内で駆動する。
  it('runNextHint: ban 中の event 使用は ban gate で throw / キャラは throw せず登場 (step1 は gate 対象外)', () => {
    const evBase = createEmptyGameState();
    turnSelfMain(evBase);
    evBase.players.self.hand = ['TESTEV'];
    evBase.players.self.file = [FB, FB, FB]; // postPopCount=2 ≥ level1
    evBase.turnState.self.eventUseBanned = true;

    // event: ban gate で throw。メッセージで ban 由来を確認 (= step1 pop + 色 + level を通過した step2 の throw、
    //   popTop の current() や level throw ではない) → step1/前段は阻害されていないことの裏付け。
    expect(() => produce(evBase, (d) => { runNextHint(d, 'self', 'TESTEV'); }), 'ban event NH は ban gate で throw')
      .toThrow(/event-use banned/);

    // character: ban 中でも throw せず登場 (step1 FILE pop + step2 character 登場いずれも阻害なし)
    const chBase = createEmptyGameState();
    turnSelfMain(chBase);
    chBase.players.self.hand = ['TESTCH'];
    chBase.players.self.file = [FB, FB, FB];
    chBase.turnState.self.eventUseBanned = true;
    const after = produce(chBase, (d) => { runNextHint(d, 'self', 'TESTCH'); });
    expect(after.players.self.scene.map((c) => c.cardId), 'character は ban 影響なく登場').toContain('TESTCH');
    expect(after.players.self.file.length, 'step1 で FILE 1 枚 pop 済').toBe(2);
  });

  // ---- setEventUseBan verb + reset ----
  it('setEventUseBan verb が flag をセット / resetTurnFlags で解除', () => {
    const s = createEmptyGameState();
    turnSelfMain(s);
    expect(s.turnState.self.eventUseBanned ?? false, '初期は ban 無し').toBe(false);

    runEffect(s, { kind: 'atom', verb: 'setEventUseBan', args: { player: 'self' } } as never, aiCtx('B09034', 'a1'));
    expect(s.turnState.self.eventUseBanned, 'verb 実行で ban=true').toBe(true);
    expect(s.turnState.opp.eventUseBanned ?? false, '相手側は影響なし').toBe(false);

    flag.resetTurnFlags(s, 'self');
    expect(s.turnState.self.eventUseBanned, 'resetTurnFlags で ban 解除').toBe(false);
  });

  // ---- カットイン exempt ----
  it('canCutIn: event-use ban の影響を受けない (qAndA: カットインは制限外)', () => {
    const s = createEmptyGameState();
    turnSelfMain(s);
    s.players.self.scene = [];
    s.players.opp.scene = [];
    s.players.opp.hand = ['B03129']; // カットイン持ち
    const ax: ActionContext = {
      id: 'ax', byUid: 'atk', byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: 'atk', aAP: 4000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
    };
    expect(canCutIn(s, ax, 'opp', 'B03129'), 'ban 無し → カットイン可').toBe(true);
    // 両者 ban をセットしても canCutIn は不変 (cutin は gate されない)
    s.turnState.self.eventUseBanned = true;
    s.turnState.opp.eventUseBanned = true;
    expect(canCutIn(s, ax, 'opp', 'B03129'), 'ban 中でもカットインは可 (exempt)').toBe(true);
  });

  // ---- B09034 a1: multi-pick 0/1/3(→2) 枚 + clause2 ban (AI 経路) ----
  it('B09034 a1: remove に event 0 枚 → 0 枚回収 + ban 発火 (sequence で 0 pick でも clause2 が走る)', () => {
    const s = createEmptyGameState();
    turnSelfMain(s);
    s.players.self.remove = ['CHX']; // event 0 (キャラのみ)
    aiResolveAndRun(B09034.abilities[0].effect, s, 'B09034', 'a1');
    expect(s.players.self.hand, '0 枚回収 → 手札空').toEqual([]);
    expect(s.players.self.remove, 'キャラ decoy は filter:{kind:event} で対象外 → remove に残る').toEqual(['CHX']);
    expect(s.turnState.self.eventUseBanned, '0 枚 pick でも clause2 ban は発火').toBe(true);
  });

  it('B09034 a1: remove に event 1 枚 → 1 枚回収 + キャラ decoy 不動 + ban 発火', () => {
    const s = createEmptyGameState();
    turnSelfMain(s);
    s.players.self.remove = ['CHX', 'EV1'];
    aiResolveAndRun(B09034.abilities[0].effect, s, 'B09034', 'a1');
    expect(s.players.self.hand, 'EV1 を手札へ').toEqual(['EV1']);
    expect(s.players.self.remove, 'EV1 は remove から除去 / CHX は残る').toEqual(['CHX']);
    expect(s.turnState.self.eventUseBanned, 'ban 発火').toBe(true);
  });

  it('B09034 a1: remove に event 3 枚 → 上限 2 枚のみ回収 + 残り 1 枚は remove に残る + ban 発火', () => {
    const s = createEmptyGameState();
    turnSelfMain(s);
    s.players.self.remove = ['EV1', 'EV2', 'EV3', 'CHX'];
    aiResolveAndRun(B09034.abilities[0].effect, s, 'B09034', 'a1');
    expect(s.players.self.hand.length, '「2枚まで」上限 2 枚').toBe(2);
    expect(s.players.self.hand, '先頭 2 枚 (EV1,EV2) を回収').toEqual(['EV1', 'EV2']);
    expect(s.players.self.remove.sort(), '残り EV3 + キャラ CHX は remove に残る').toEqual(['CHX', 'EV3']);
    expect(s.turnState.self.eventUseBanned, 'ban 発火').toBe(true);
  });

  // ---- B09034 a2 (ヒラメキ) exempt ----
  it('B09034 a2 (ヒラメキ): ban 中でも remove の event を 1 枚回収できる (qAndA: ヒラメキは制限外)', () => {
    const s = createEmptyGameState();
    turnSelfMain(s);
    s.players.self.remove = ['EV1'];
    s.turnState.self.eventUseBanned = true; // ban 中
    aiResolveAndRun(B09034.abilities[1].effect, s, 'B09034', 'a2');
    expect(s.players.self.hand, 'ヒラメキは ban 影響外 → EV1 回収').toEqual(['EV1']);
    expect(s.players.self.remove, 'EV1 は remove から除去').toEqual([]);
  });
});
