// gate5 RUNTIME behavior — B02025 遠山和葉 (character, 緑/高校生, L4 AP3000 LP1)
//
// 公式テキスト:
//   effect (a1) 【相手ターン中】【現場リムーブ時】自分のリムーブエリアにある【カットイン】を持つ
//               【緑】のカードを1枚まで選び、手札に加える。
//   hirameki (a2) 【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある
//               【カットイン】を持つ【緑】のカードを1枚まで選び、手札に加える。
//
// rules: 10-action-event.md (アクション[事件]/ヒラメキ) / 14-refresh.md / 15-abilities-effects.md (「〜まで」=0枚可) /
//        17-icons.md (【相手ターン中】【現場リムーブ時】/ 印字で「〜を持つ」判定) / 20-color-and-switch.md /
//        18-mr.md は無関係。
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   a1 (現場リムーブ時, 相手ターン中):
//     turn.player='opp' / B02025 を self.scene に置く / self.remove に候補+decoy を仕込む。
//     mutate.scene.removeToRemove(d, '<B02025 uid>', 'effect') → 'leave:to-remove' emit →
//     handleLeaveToRemoveSelf が condition{turn:opp} + trigger{leave:to-remove,selfOnly} を gate し、
//     handAddFromRemove{player:'self',max:1,filter} effect を queue → runAllUntilEmpty。
//     setHuman('self') により handAddFromRemove は runtime atom-handler の awaiting-pick 経路
//     (tryRePickFromAtom) で __pendingEffectPickQueue に pick を surface (resolve-picks.ts Pattern B)。
//   a2 (ヒラメキ on 証拠 action[事件] リムーブ):
//     B02025 を self.evidence に置く / emit 'evidence:remove-by-action'{player:'self', ev:{cardId:'B02025'}}
//     → handleEvidenceRemovedHook が trigger{evidence:remove-by-action,optional:true} を検出し
//        pushPendingHirameki → _drainPendingHirameki → store に積み → dispatchEngineAction
//        ({type:'hiramekiResolve', choice:'fire'|'skip'})。fire は handAddFromRemove を解決 (AI auto-pick)、
//        skip は no-op (ヒラメキ「発動するか否かは相手の選択」rules/10 = 0-pick 相当)。
//        (整合ハーネス: tests/integration/bug-140-hirameki-batch.test.ts h-removeYellowToHand B01094)
//
// 検証する filter / 条件 (BUG-117/118 lesson — DSL に書いても engine が評価する保証はない):
//   (a1-A) handAddFromRemove filter {keyword:'カットイン', color:'緑'} を engine が **実評価** するか。
//          candidates.ts matchOneFilter:274-285 (color=def.colors / keyword=defHasKeyword 経由, BUG-122)。
//          kind 省略 = 「カード」(text が 'のキャラ' でない) → イベント/キャラ両方が候補。
//          → DECOY: (b) 緑だが カットイン無し / (c) 青だが カットイン有り は **候補に出ない**。
//          → 緑×カットイン の キャラ (a-char) と イベント (a-event) の **両方** が候補。
//   (a1-B) condition{kind:'turn', player:'opp'} = 【相手ターン中】。自分ターン (turn:self) では a1 非発火。
//   (a1-N) 「1枚まで」(rules/15) human decline (0-pick) → 誰も手札に加わらない (decoy も含め remove 不変)。
//   (a2-A) a2 hirameki も a1 と同一 filter — fire で 緑×カットイン のみ手札へ、decoy (緑非カットイン / 青カットイン)
//          は remove に残る (auto-pick 結果で filter を実証)。kind 非制限 → カットイン緑イベントも対象。
//   (a2-N) ヒラメキ skip (choice:'skip') = 「発動しない」選択 (rules/10) → 何も手札に加わらない (0-pick channel)。
//   (struct) descriptor 構造 sanity (B01062.test.ts と同形 matchObject)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import {
  registerHiramekiListener,
  _resetPendingHirameki,
  _resetHiramekiRegistered,
} from '@/engine/listeners/hirameki';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { mutate } from '@/engine/mutate/index';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../../helpers/fixtures';
import { B02025 } from '@/cards/ct-p02/B02025';
import type { CardDef, GameState } from '@/engine/types';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { openCaseHirameki } from '../../helpers/open-case-hirameki';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- 合成 def 群 (id prefix DEC_B02025_ で衝突回避) ----
// 【カットイン】icon-ability の正準形状 (read/keyword.ts abilityIsCutin, BUG-122):
//   type:'triggered' + scope:'on-hand' + trigger:{hook:'effect:declared', optional:true}。
//   keywords:['カットイン'] では NG (icon-ability は keywords[] ではなく ability 構造で表現)。
function cutinAbility() {
  return {
    id: 'ci',
    type: 'triggered' as const,
    scope: 'on-hand' as const,
    trigger: { hook: 'effect:declared' as const, optional: true },
    effect: { kind: 'atom' as const, verb: 'charModifyAP' as const, args: { delta: 2000 } },
  };
}
function cardDef(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 3, ap: 2000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  } as unknown as CardDef;
}

// remove area の候補/decoy 4 種
const GREEN_CUTIN_CHAR  = 'DEC_B02025_GCUTIN_CHAR';  // 緑×カットイン×キャラ → 候補 (a)
const GREEN_CUTIN_EVENT = 'DEC_B02025_GCUTIN_EVENT'; // 緑×カットイン×イベント → 候補 (a, kind 非制限)
const GREEN_NOCUTIN     = 'DEC_B02025_GNOCUTIN';      // 緑だが カットイン無し → DECOY (b: color ok, keyword 失敗)
const BLUE_CUTIN        = 'DEC_B02025_BCUTIN';        // 青だが カットイン有り → DECOY (c: keyword ok, color 失敗)

function registerDecoys(): void {
  registerCardDef(cardDef(GREEN_CUTIN_CHAR,  { kind: 'character', colors: ['緑'], abilities: [cutinAbility()] as never }));
  registerCardDef(cardDef(GREEN_CUTIN_EVENT, { kind: 'event',     colors: ['緑'], abilities: [cutinAbility()] as never }));
  registerCardDef(cardDef(GREEN_NOCUTIN,     { kind: 'character', colors: ['緑'], abilities: [] }));
  registerCardDef(cardDef(BLUE_CUTIN,        { kind: 'character', colors: ['青'], abilities: [cutinAbility()] as never }));
}

// 4 種を self.remove に仕込む共通配置。
const REMOVE_PILE = [GREEN_CUTIN_CHAR, GREEN_NOCUTIN, BLUE_CUTIN, GREEN_CUTIN_EVENT];

// ---- a1 base: B02025 を self.scene に / self.remove に候補+decoy ----
function a1Base(turnPlayer: 'self' | 'opp'): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 4, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.scene = [sceneChar('B02025', 'kazuha#1', { state: 'active' })];
  s.players.self.remove = [...REMOVE_PILE];
  s.players.self.deck = ['d1', 'd2'];
  s.players.opp.deck = ['e1', 'e2'];
  return s;
}

// ---- a2 base: B02025 を self.evidence に / self.remove に候補+decoy ----
function a2State(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.evidence = [{ cardId: 'B02025', faceUp: false, origin: { turn: 1, via: 'action-case' } }];
  s.players.self.remove = [...REMOVE_PILE];
  s.players.self.deck = Array(6).fill('d');
  return s;
}

// ヒラメキ fire/skip ドライブ (bug-140-hirameki-batch.test.ts と同一ハーネス)。
function finishCaseAction(actionId: string): void {
  for (let i = 0; i < 2 && useGameStateStore.getState().activeActionId === actionId; i++) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function emitHirameki(s: GameState, choice: 'fire' | 'skip'): GameState {
  const { actionId, pending } = openCaseHirameki(s, 'B02025', { humanPlayer: null });
  expect(pending, 'ヒラメキ pending が side-channel に set される').not.toBeNull();
  expect(pending.cardId).toBe('B02025');
  expect(pending.abilityId).toBe('a2');
  const r = dispatchCurrentDecision({ type: 'hiramekiResolve', choice });
  expect(r.ok, `hiramekiResolve ${choice} ok`).toBe(true);
  expect(useGameStateStore.getState().pendingHirameki, 'pending クリア').toBeNull();
  finishCaseAction(actionId);
  return useGameStateStore.getState().gameState!;
}

describe('B02025 遠山和葉 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetHiramekiRegistered();
    _resetActionContexts();
    _resetUidCounter();
    _resetPendingHirameki();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    registerHiramekiListener();
    setHuman(null);
    useGameStateStore.setState({
      gameState: null, activeActionId: null, pendingHirameki: null, pendingMisread: null,
    });
  });

  // ===== a1-A + DECOY: 現場リムーブ時 (相手ターン) で handAddFromRemove pick が surface =====
  it('a1 + DECOY: 相手ターン中の現場リムーブで pick surface — 候補は 緑×カットイン のキャラ+イベントのみ (緑非カットイン / 青カットイン は除外)', () => {
    setHuman('self'); // pending pick を覗いて候補集合を decoy 検証
    let s = a1Base('opp');

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'kazuha#1', 'effect'); // 現場リムーブ → leave:to-remove
      runAllUntilEmpty(d);
    });

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'handAddFromRemove pick が surface (= a1 発火)').toBe('handAddFromRemove');
    expect(pending?.nMin, '「1枚まで」= 0枚可 (decline channel)').toBe(0);
    const cands = pending!.candidates.map((c) => c.cardId).sort();
    // DECOY 主張:
    expect(cands, '(a) 緑×カットイン×キャラ は候補').toContain(GREEN_CUTIN_CHAR);
    expect(cands, '(a) 緑×カットイン×イベント も候補 (kind 非制限 — text=「カード」)').toContain(GREEN_CUTIN_EVENT);
    expect(cands, '(b) 緑だが カットイン無し は候補外 (keyword filter 失敗)').not.toContain(GREEN_NOCUTIN);
    expect(cands, '(c) 青だが カットイン有り は候補外 (color filter 失敗)').not.toContain(BLUE_CUTIN);
    expect(cands.length, '候補は (a) の 2 種のみ').toBe(2);
  });

  it('a1: 緑×カットイン×キャラ (候補) を pick → 手札に加わり remove から抜ける / decoy は remove に残る', () => {
    setHuman('self');
    let s = a1Base('opp');

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'kazuha#1', 'effect');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    const pick = pending.candidates.find((c) => c.cardId === GREEN_CUTIN_CHAR)!;
    g.__pendingEffectPickQueue = [];
    // handAddFromRemove は continuation を持たない単発 pick → apply-pick.ts の else (target=[cardId]) 経路で解決。
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, pick.uid);
    });

    expect(s.players.self.hand, '緑×カットイン×キャラ が手札へ').toContain(GREEN_CUTIN_CHAR);
    expect(s.players.self.remove, 'pick したカードは remove から抜けた').not.toContain(GREEN_CUTIN_CHAR);
    // DECOY は remove に残存
    expect(s.players.self.remove, '緑非カットイン decoy は remove に残る').toContain(GREEN_NOCUTIN);
    expect(s.players.self.remove, '青カットイン decoy は remove に残る').toContain(BLUE_CUTIN);
    expect(s.players.self.hand, '緑非カットイン decoy は手札に入らない').not.toContain(GREEN_NOCUTIN);
    expect(s.players.self.hand, '青カットイン decoy は手札に入らない').not.toContain(BLUE_CUTIN);
  });

  // ===== a1-B: 【相手ターン中】未達 — 自分ターンでは a1 非発火 =====
  it('a1 NEGATIVE (turn:self): 自分ターン中の現場リムーブでは pick が立たない (condition turn:opp gate)', () => {
    setHuman('self');
    let s = a1Base('self'); // 自分ターン → 【相手ターン中】不成立

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'kazuha#1', 'effect');
      runAllUntilEmpty(d);
    });
    expect(pickQueue().length, '自分ターン → a1 非発火 (turn:opp condition gate)').toBe(0);
    // 現場リムーブで B02025 自身は remove へ移るが、a1 が非発火なので候補 pile からは誰も手札へ移らない。
    // (B02025 は カットイン ability を持たないため、仮に発火しても自己選択は起こらない — verify.json 記載)
    expect([...s.players.self.remove].sort(), 'remove pile 不変 (候補は手札へ移動せず) + B02025 自身が追加')
      .toEqual([...REMOVE_PILE, 'B02025'].sort());
    expect(s.players.self.hand.length, '手札 増えない').toBe(0);
  });

  // ===== a1-N: 「1枚まで」(rules/15) human decline (0-pick) =====
  it('a1 NEGATIVE (0-pick): decline で誰も手札に加わらない / remove pile 不変', () => {
    setHuman('self');
    let s = a1Base('opp');

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'kazuha#1', 'effect');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    expect(pending.atomVerb, 'pick surface (decline 前)').toBe('handAddFromRemove');
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending); // 0-pick (「1枚まで」= 0枚可)
    });
    expect(s.players.self.hand.length, 'decline → 手札 増えない').toBe(0);
    // 候補 pile は全て remove に残る (0-pick) + 現場リムーブで B02025 自身も remove に存在。
    expect([...s.players.self.remove].sort(), 'decline → 候補 pile 全残 + B02025 自身')
      .toEqual([...REMOVE_PILE, 'B02025'].sort());
  });

  // ===== a2-A + DECOY: ヒラメキ fire — 緑×カットイン のみ手札へ、decoy は remove に残る =====
  it('a2 + DECOY: 証拠 action[事件] リムーブで ヒラメキ fire → 緑×カットイン のみ手札へ (緑非カットイン / 青カットイン は remove 残留)', () => {
    // ヒラメキ fire は AI auto-pick 経路 (human modal 無し)。filter は「結果」で実証 (B01094 ハーネス同型)。
    const s0 = a2State();
    const startHand = s0.players.self.hand.length;
    const after = emitHirameki(s0, 'fire');

    // 緑×カットイン (キャラ or イベント) のいずれか 1 枚が手札へ (max:1)。
    const movedGreenCutin =
      after.players.self.hand.includes(GREEN_CUTIN_CHAR) || after.players.self.hand.includes(GREEN_CUTIN_EVENT);
    expect(movedGreenCutin, '緑×カットイン のカードが手札へ (filter 該当)').toBe(true);
    expect(after.players.self.hand.length, '手札 +1 (max:1)').toBe(startHand + 1);
    // DECOY: filter 非該当は手札に入らず remove に残る (= filter 実評価の証明)。
    expect(after.players.self.hand, '緑非カットイン decoy は手札に入らない').not.toContain(GREEN_NOCUTIN);
    expect(after.players.self.hand, '青カットイン decoy は手札に入らない').not.toContain(BLUE_CUTIN);
    expect(after.players.self.remove, '緑非カットイン decoy は remove に残る').toContain(GREEN_NOCUTIN);
    expect(after.players.self.remove, '青カットイン decoy は remove に残る').toContain(BLUE_CUTIN);
  });

  // ===== a2-N: ヒラメキ skip = 「発動しない」選択 (rules/10) → no-op =====
  it('a2 NEGATIVE (skip): ヒラメキ skip では何も手札に加わらない / remove pile 不変', () => {
    const s0 = a2State();
    const after = emitHirameki(s0, 'skip');
    expect(after.players.self.hand.length, 'skip → 手札 増えない').toBe(0);
    expect([...after.players.self.remove].sort(), 'skip → action で失った証拠のみ追加').toEqual([...REMOVE_PILE, 'B02025'].sort());
  });

  // ===== descriptor 構造 sanity (B01062.test.ts と同形) =====
  it('descriptor: a1=triggered(turn:opp + leave:to-remove selfOnly) handAddFromRemove{keyword:カットイン,color:緑}, a2=ヒラメキ(evidence:remove-by-action optional) 同 effect', () => {
    const [a1, a2] = B02025.abilities;
    // a1
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-scene');
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'opp' });
    expect(a1.trigger).toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
    expect((a1.effect as { verb: string }).verb).toBe('handAddFromRemove');
    expect((a1.effect as { args: Record<string, unknown> }).args).toMatchObject({
      player: 'self', max: 1, filter: { keyword: 'カットイン', color: '緑' },
    });
    // a2 (hirameki — 同一 effect、kind 制限なし)
    expect(a2.type).toBe('triggered');
    expect(a2.scope).toBe('on-evidence');
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect((a2.effect as { verb: string }).verb).toBe('handAddFromRemove');
    expect((a2.effect as { args: Record<string, unknown> }).args).toMatchObject({
      player: 'self', max: 1, filter: { keyword: 'カットイン', color: '緑' },
    });
    // kind 制限が付いていない (「カード」= イベント/キャラ両対象) ことを確認
    const a1Filter = (a1.effect as { args: { filter: Record<string, unknown> } }).args.filter;
    expect(a1Filter.kind, 'a1 filter に kind 制限なし (text=「カード」)').toBeUndefined();
  });
});
