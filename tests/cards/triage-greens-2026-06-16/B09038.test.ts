// gate5 RUNTIME behavior — B09038 黒羽盗一 (character, 白/L7 AP5000 LP1, 特徴[マジシャン], R)
//
// 公式テキスト:
//   a1 【変装時】自分のリムーブエリアにある〚カード名［工藤優作］〛を1枚まで選び、手札に加える。
//   a2 【登場時】このキャラをスリープさせてもよい。そうした場合、手札からレベル6以下の〚カード名［工藤優作］〛を
//        1枚まで登場させ、自分のデッキのカードを上から1枚裏向きでそのキャラにセットし、カードを1枚引く。
//   a3 【変装】【FILE7】（手札から、コンタクト中のキャラと入れ替わる。入れ替わったキャラはデッキの下に移す）
//
// rules:
//   09-cutin-disguise.md (変装 = コンタクト中のキャラと入替 / 変装は「登場」ではない →【登場時】不発火 / 【変装時】発火),
//   15-abilities-effects.md (「〜まで」=0枚可 / 「〜する」=必須 / 「そうした場合」=前段適用後の後段 / sequence 各 step は独立),
//   16-card-set.md (カードを裏向きでセット),
//   17-icons.md (【変装時】/【登場時】= trigger / 【FILE7】= ability.condition fileAtLeast / 条件未達=持たない扱い),
//   19-special-rules.md (カード名は分割名すべてで判定 — names[] component),
//   20-color-and-switch.md (handUseCard は事件の色制限 / 効果による「登場させる」は色制限を受けない),
//   23-qa-disguise-cutin.md (変装の引継ぎ / 変装時効果はコンタクト中に解決),
//   25-qa-effects-resolution.md (BUG-111 #2: sequence-origin の 0-pick decline は mandatory tail を実行).
//
// 検証の核 (BUG-117/118 教訓: DSL に filter/condition を書いても engine が評価する保証はない — 実機で踏む):
//   ★ a2 human-decline で draw が発火 (BUG-111 #2 修正の主目的の証明):
//      handUseCard で B09038 登場 → enter で optional surface → optionalResolve{run:true} で opt-in →
//      $self sleep → sceneEnter pick が surface (工藤優作 を登場) → 0体 decline (「1枚まで」=0可) →
//      **draw が発火する** (hand+1/deck-1) かつ charSetCard が起きない ($entered 空 → conditional skip)。
//      これが修正前は continuation 一律 drop で mandatory draw が消えていた箇所 (a682b20b で修正)。
//   a2 human-resolve: 工藤優作Lv6 を登場 → 登場キャラに deck top 1枚 裏向き set → draw。全 step 実行。
//   a2 optional 非 opt-in (run=false): 何も起きない (sleep もしない、draw もしない、pick も surface しない)。
//   a2 sceneEnter filter: 工藤優作 かつ levelMax:6 かつ kind:character のみ候補
//      (Lv7工藤優作 decoy / 別名Lv6 decoy / 工藤優作Lv6 event decoy は候補外)。rules/19 分割名は names component で判定。
//   a1 【変装時】 disguise:into hook → handAddFromRemove: リムーブの工藤優作 (cardName+kind:character) を手札へ。
//      別名 decoy / event decoy は加えない。「1枚まで」=0可 (候補無で no-op)。
//   a3 fileAtLeast:7 — FILE7 で canDisguise=true / FILE6 で false (条件アイコン実評価)。
//
// driver:
//   a2: setHuman('self') → dispatchEngineAction({handUseCard}) → ({optionalResolve,run}) → ({effectPickResolve})。
//       optional は AI auto-skip なので human surface が必須 (resolve-picks optional case)。
//   a1: disguise(state, ax, 'self', 'B09038') → disguise:into emit → triggered listener → runAllUntilEmpty +
//       drainAiEffectPicks (handAddFromRemove の AI auto-pick) (B02038.test.ts と同型ハーネス)。
//   a3: canDisguise(state, ax, 'self', 'B09038') が a3.condition=fileAtLeast:7 を評価する。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { canDisguise, disguise } from '@/engine/flow/contact';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B09038 } from '@/cards/ct-p09/B09038';
import type { AbilityDef, CardDef, GameState, ActionContext } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

const FB = { type: 'card-back' as const, cardId: 'FB' };

// ---- synthetic decoy defs (prefix DEC_B09038_ で id 衝突回避。abilities:[] で再帰トリガー無し) ----
function ch(id: string, names: string[], level: number, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names, colors: ['白'], level,
    ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...over,
  } as unknown as CardDef;
}

// a2 sceneEnter (手札) 候補 / decoy
const YUSAKU_L6 = 'DEC_B09038_YUSAKU_L6';     // 工藤優作 / L6 character = 唯一の有効 sceneEnter 候補
const YUSAKU_L7 = 'DEC_B09038_YUSAKU_L7';     // 工藤優作 / L7 → levelMax:6 超で非対象
const OTHER_L6 = 'DEC_B09038_OTHER_L6';       // 別人   / L6 → cardName:工藤優作 違反で非対象
const YUSAKU_SPLIT = 'DEC_B09038_YUSAKU_SPLIT'; // 工藤優作&工藤新一 / L6 → rules/19 分割名で「工藤優作」を持つ = 有効
const YUSAKU_EVENT = 'DEC_B09038_YUSAKU_EVENT'; // 工藤優作 / L6 event → kind:character 違反で非対象
// a1 remove 候補 / decoy
const YUSAKU_CHAR = 'DEC_B09038_YUSAKU_CHAR'; // 工藤優作 / character = a1 の唯一の有効候補
const OTHER_CHAR = 'DEC_B09038_OTHER_CHAR';   // 別人 character → cardName 違反
const YUSAKU_EV2 = 'DEC_B09038_YUSAKU_EV2';   // 工藤優作 event → kind:character 違反

function registerDecoys(): void {
  registerCardDef(ch(YUSAKU_L6, ['工藤優作'], 6));
  registerCardDef(ch(YUSAKU_L7, ['工藤優作'], 7));
  registerCardDef(ch(OTHER_L6, ['別人'], 6));
  registerCardDef(ch(YUSAKU_SPLIT, ['工藤優作&工藤新一'], 6));
  registerCardDef(ch(YUSAKU_EVENT, ['工藤優作'], 6, { kind: 'event' }));
  registerCardDef(ch(YUSAKU_CHAR, ['工藤優作'], 5));
  registerCardDef(ch(OTHER_CHAR, ['別人'], 5));
  registerCardDef(ch(YUSAKU_EV2, ['工藤優作'], 5, { kind: 'event' }));
}

const inScene = (s: GameState, id: string) => s.players.self.scene.some((c) => c.cardId === id);
const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inRemove = (s: GameState, id: string) => s.players.self.remove.includes(id);

// ---- a2 driver: handUseCard で B09038 登場 → enter で optional surface ----
// B09038 は白/L7 → 事件白 + FILE7 で handUseCard 可 (rules/20 色制限 + rules/12 FILE≥level)。
function a2Base(handExtra: string[], deck: string[]): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 8, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.hand = ['B09038', ...handExtra];
  s.players.self.case.colors = ['白'];
  s.players.self.file = [FB, FB, FB, FB, FB, FB, FB]; // FILE7 ≥ level7
  s.players.self.deck = [...deck];
  return s;
}

/** handUseCard → optionalResolve(run) → (run=true 時) sceneEnter pick が surface。store に gameState を反映済の前提。 */
function fireA2(s: GameState, optRun: boolean): void {
  useGameStateStore.getState().setGameState(s);
  const r0 = dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: 'B09038' });
  expect(r0.ok, 'handUseCard ok').toBe(true);
  expect(useGameStateStore.getState().pendingEffectOptional, 'enter で optional surface (human)').not.toBeNull();
  const r1 = dispatchEngineAction({ type: 'optionalResolve', run: optRun });
  expect(r1.ok, `optionalResolve run=${optRun} ok`).toBe(true);
}

// ---- a1 用: self atk(uid='atk') が opp dft(uid='dft') に action 中の ActionContext ----
function makeAx(): ActionContext {
  return {
    id: 'ax', byUid: 'atk', byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
    phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
    apSnapshot: { aUid: 'atk', aAP: 5000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
  } as unknown as ActionContext;
}

// ---- a1 base: コンタクト中の atk + 変装ゲート (事件白不問 — a3 は FILE7 のみ) ----
function a1Base(remove: string[]): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 8, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.scene = [sceneChar('Atk0', 'atk', { state: 'active' })]; // コンタクト中の自キャラ
  s.players.opp.scene = [sceneChar('Def0', 'dft', { state: 'sleep' })];   // 攻撃対象
  s.players.self.hand = ['B09038'];
  s.players.self.file = [FB, FB, FB, FB, FB, FB, FB]; // FILE7 → a3 gate 達成
  s.players.self.deck = ['d1', 'd2', 'd3'];
  s.players.self.remove = [...remove];
  return s;
}

describe('B09038 黒羽盗一 — gate5 runtime behavior', () => {
  beforeEach(() => {
    (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
    (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    setHuman(null);
    useGameStateStore.setState({
      gameState: null, pendingEffectOptional: null, pendingEffectPick: null,
      pendingEffectChoice: null, pendingHirameki: null, pendingMisread: null,
    } as never);
  });

  // ===================================================================================
  // ★ a2 human-decline で draw が発火 (BUG-111 #2 修正の主目的の証明)
  // ===================================================================================
  it('★ a2 human-decline: 0体 decline (「1枚まで」=0可) でも mandatory draw が発火 (hand+1/deck-1) / charSetCard は起きない', () => {
    setHuman('self');
    // 手札に有効候補 (YUSAKU_L6) を置くが、human は 0体を decline する。deck top=SET_TOP は set されず draw 候補に残る。
    const s = a2Base([YUSAKU_L6], ['SET_TOP', 'DRAW_TOP', 'd3', 'd4']);
    fireA2(s, true); // opt-in → $self sleep + sceneEnter pick が surface

    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending?.atomVerb, 'sceneEnter pick が surface (= sequence head)').toBe('sceneEnter');
    expect(pending?.nMin, '「1枚まで」=0枚可 (decline channel)').toBe(0);
    expect(pending?.nMax, '上限1枚').toBe(1);
    // この時点で $self sleep 済 (chain step0 適用)
    const beforePick = useGameStateStore.getState().gameState!;
    expect(beforePick.players.self.scene.find((c) => c.cardId === 'B09038')?.state, 'opt-in で B09038 は sleep 済').toBe('sleep');
    const handBefore = beforePick.players.self.hand.length;
    const deckBefore = beforePick.players.self.deck.length;

    // 0体 decline
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });

    const after = useGameStateStore.getState().gameState!;
    // ★ BUG-111 #2: sequence-origin continuation の decline は mandatory tail (draw) を実行する。
    expect(after.players.self.hand.length, '★ mandatory draw 発火 → hand +1 (decline でも実行)').toBe(handBefore + 1);
    expect(after.players.self.deck.length, '★ deck -1 (draw した分)').toBe(deckBefore - 1);
    expect(inHand(after, 'SET_TOP'), '★ deck top (SET_TOP) を 1 枚 draw した').toBe(true);
    // charSetCard は起きない: $entered 空 → conditional(boundMatchesFilter) not-matched で skip
    expect(inScene(after, YUSAKU_L6), '0体 decline: 工藤優作は登場していない').toBe(false);
    expect(inHand(after, YUSAKU_L6), '工藤優作は手札に残る (登場しなかった)').toBe(true);
    // 現場は B09038 のみ (sleep)。set されたキャラが居ないので setCards は誰にも付かない。
    const entered = after.players.self.scene.filter((c) => c.cardId !== 'B09038');
    expect(entered.length, '現場に新規登場キャラ無し (B09038 のみ)').toBe(0);
    expect(useGameStateStore.getState().pendingEffectPick, 'pick は消化済 (queue 空)').toBeNull();
    setHuman(null);
  });

  it('★ a2 (有効候補ゼロ): sceneEnter 候補 0 を明示辞退 → mandatory draw は発火 (sequence tail 維持)', () => {
    setHuman('self');
    // 手札に有効候補を入れない (decoy のみ手札に) → sceneEnter 候補 0。
    // 候補0 の n:0-1 pick も human に surface し、明示辞退で解決する。
    // それでも sequence の mandatory tail (draw) は実行される (= BUG-111 #2 の sequence-tail 保持の別経路証明)。
    const s = a2Base([YUSAKU_L7, OTHER_L6], ['SET_TOP', 'd2', 'd3']);
    const deckBefore = s.players.self.deck.length;
    fireA2(s, true); // opt-in → $self sleep + sceneEnter(候補0) の明示決定で pause

    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending?.atomVerb, '候補0でも任意の sceneEnter 決定を surface').toBe('sceneEnter');
    expect(pending?.candidates, '選択可能候補は0件').toEqual([]);
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });
    const after = useGameStateStore.getState().gameState!;
    // ★ 候補0 でも mandatory draw が発火 (deck top を手札へ)
    expect(inHand(after, 'SET_TOP'), '★ 候補0 でも mandatory draw 発火 (deck top を手札へ)').toBe(true);
    expect(after.players.self.deck.length, '★ deck -1').toBe(deckBefore - 1);
    expect(after.players.self.scene.find((c) => c.cardId === 'B09038')?.state, 'B09038 は opt-in で sleep 済').toBe('sleep');
    // 工藤優作は登場していない (候補0 → sceneEnter 0体)
    expect(after.players.self.scene.filter((c) => c.cardId !== 'B09038').length, '新規登場キャラ無し').toBe(0);
    setHuman(null);
  });

  // ===================================================================================
  // a2 human-resolve: 工藤優作Lv6 登場 → set → draw (全 step 実行)
  // ===================================================================================
  it('a2 human-resolve: 工藤優作Lv6 を登場 → 登場キャラに deck top 1枚 裏向き set → draw (全 step 実行)', () => {
    setHuman('self');
    // deck top=SET_TOP は登場キャラに裏向き set される。次の DRAW_TOP が draw で手札へ。
    const s = a2Base([YUSAKU_L6], ['SET_TOP', 'DRAW_TOP', 'd3', 'd4']);
    fireA2(s, true);

    const pending = useGameStateStore.getState().pendingEffectPick!;
    const cand = pending.candidates.find((c) => c.cardId === YUSAKU_L6)!;
    expect(cand, 'YUSAKU_L6 が sceneEnter 候補').toBeTruthy();
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: cand.uid });

    const after = useGameStateStore.getState().gameState!;
    // sceneEnter: 工藤優作Lv6 が現場に登場 (active = 「登場させ」default、enterSleep 無し)
    const entered = after.players.self.scene.find((c) => c.cardId === YUSAKU_L6);
    expect(entered, '工藤優作Lv6 が現場に登場').toBeTruthy();
    expect(entered?.state, '登場は active (enterSleep 無し)').toBe('active');
    expect(inHand(after, YUSAKU_L6), '工藤優作は手札から消費').toBe(false);
    // charSetCard: 登場キャラに deck top 1枚を裏向き set (rules/16)
    expect(entered?.setCards?.length, '登場キャラに 1 枚 set').toBe(1);
    expect(entered?.setCards?.[0]?.cardId, 'set されたのは deck top (SET_TOP)').toBe('SET_TOP');
    expect(entered?.setCards?.[0]?.faceUp, '裏向き set (faceUp:false)').toBe(false);
    expect(inHand(after, 'SET_TOP'), 'SET_TOP は手札ではなく set されている').toBe(false);
    // draw: deck の次 (DRAW_TOP) を手札へ
    expect(inHand(after, 'DRAW_TOP'), 'mandatory draw で DRAW_TOP が手札へ').toBe(true);
    // deck: SET_TOP(set) + DRAW_TOP(draw) を消費 → d3, d4 残
    expect([...after.players.self.deck], 'deck = [d3, d4] (set+draw で上2枚消費)').toEqual(['d3', 'd4']);
    expect(after.players.self.scene.find((c) => c.cardId === 'B09038')?.state, 'B09038 は sleep').toBe('sleep');
    setHuman(null);
  });

  // ===================================================================================
  // a2 optional 非 opt-in (run=false): 何も起きない
  // ===================================================================================
  it('a2 optional NOT opt-in (run=false): sleep もしない / draw もしない / pick も surface しない (「〜してもよい」decline)', () => {
    setHuman('self');
    const s = a2Base([YUSAKU_L6], ['SET_TOP', 'DRAW_TOP', 'd3', 'd4']);
    fireA2(s, false); // opt-out

    const after = useGameStateStore.getState();
    expect(after.pendingEffectPick, 'run=false: sceneEnter pick は surface しない').toBeNull();
    const gs = after.gameState!;
    expect(gs.players.self.scene.find((c) => c.cardId === 'B09038')?.state, 'B09038 は active 維持 (sleep していない)').toBe('active');
    expect(inHand(gs, YUSAKU_L6), '工藤優作は手札に残る (登場していない)').toBe(true);
    expect([...gs.players.self.deck], 'deck 不変 (set も draw も無し)').toEqual(['SET_TOP', 'DRAW_TOP', 'd3', 'd4']);
    expect(inHand(gs, 'SET_TOP'), 'draw 不発').toBe(false);
    setHuman(null);
  });

  // ===================================================================================
  // a2 sceneEnter filter (cardName / levelMax / kind) — decoy は候補外
  // ===================================================================================
  it('a2 sceneEnter filter + DECOY: 候補は 工藤優作 & L6以下 & character のみ (Lv7工藤優作 / 別名L6 / 工藤優作event は候補外、分割名は候補)', () => {
    setHuman('self');
    // 手札に 有効2 (YUSAKU_L6, YUSAKU_SPLIT) + decoy3 (YUSAKU_L7=levelMax違反, OTHER_L6=cardName違反, YUSAKU_EVENT=kind違反)
    const s = a2Base([YUSAKU_L6, YUSAKU_SPLIT, YUSAKU_L7, OTHER_L6, YUSAKU_EVENT], ['SET_TOP', 'DRAW_TOP', 'd3']);
    fireA2(s, true);

    const pending = useGameStateStore.getState().pendingEffectPick!;
    const candIds = pending.candidates.map((c) => c.cardId);
    expect(candIds, '工藤優作 L6 は候補').toContain(YUSAKU_L6);
    expect(candIds, '工藤優作&工藤新一 L6 は候補 (rules/19 分割名で 工藤優作 を持つ)').toContain(YUSAKU_SPLIT);
    expect(candIds, '工藤優作 L7 は候補外 (levelMax:6 超)').not.toContain(YUSAKU_L7);
    expect(candIds, '別人 L6 は候補外 (cardName:工藤優作 違反)').not.toContain(OTHER_L6);
    expect(candIds, '工藤優作 event は候補外 (kind:character 違反)').not.toContain(YUSAKU_EVENT);
    expect(candIds.length, '有効候補は YUSAKU_L6 + YUSAKU_SPLIT の 2 件').toBe(2);
    setHuman(null);
  });

  // ===================================================================================
  // a1 【変装時】 disguise:into → handAddFromRemove (cardName:工藤優作, kind:character)
  // ===================================================================================
  it('a1 変装時 + DECOY: disguise で B09038 に入替 → リムーブの 工藤優作character を手札へ / 別名・event decoy は加えない', () => {
    // remove に 有効1 (YUSAKU_CHAR) + decoy2 (OTHER_CHAR=cardName違反, YUSAKU_EV2=kind違反)
    let s = a1Base([YUSAKU_CHAR, OTHER_CHAR, YUSAKU_EV2]);

    expect(canDisguise(s, makeAx(), 'self', 'B09038'), 'FILE7 → 変装可 (a3 gate)').toBe(true);

    s = produce(s, (d) => {
      disguise(d, makeAx(), 'self', 'B09038');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy()); // handAddFromRemove の AI auto-pick
    });

    // 変装で atk uid の cardId が B09038 に差替わる (rules/09)
    const disguised = s.players.self.scene.find((c) => c.uid === 'atk');
    expect(disguised?.cardId, '変装で atk uid の cardId が B09038 に').toBe('B09038');
    // 【変装時】 a1: 工藤優作character を手札へ (max:1)
    expect(inHand(s, YUSAKU_CHAR), '工藤優作character を手札へ (filter 該当)').toBe(true);
    expect(inRemove(s, YUSAKU_CHAR), 'YUSAKU_CHAR は remove から抜けた').toBe(false);
    // DECOY: cardName 違反 / kind 違反は加えない & remove に残る (= filter 実評価の証明)
    expect(inHand(s, OTHER_CHAR), '別人character decoy は手札に入らない (cardName 違反)').toBe(false);
    expect(inRemove(s, OTHER_CHAR), '別人character decoy は remove に残る').toBe(true);
    expect(inHand(s, YUSAKU_EV2), '工藤優作event decoy は手札に入らない (kind:character 違反)').toBe(false);
    expect(inRemove(s, YUSAKU_EV2), '工藤優作event decoy は remove に残る').toBe(true);
  });

  it('a1 変装時 NEGATIVE (候補無): remove に 工藤優作character が無い → 何も手札に加わらない (「1枚まで」=0可)', () => {
    let s = a1Base([OTHER_CHAR, YUSAKU_EV2]); // すべて非該当
    expect(canDisguise(s, makeAx(), 'self', 'B09038'), 'FILE7 → 変装可').toBe(true);

    s = produce(s, (d) => {
      disguise(d, makeAx(), 'self', 'B09038');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    const disguised = s.players.self.scene.find((c) => c.uid === 'atk');
    expect(disguised?.cardId, '変装自体は成立 (B09038 に入替)').toBe('B09038');
    expect(s.players.self.hand.length, '手札は増えない (有効候補無)').toBe(0);
    expect([...s.players.self.remove].sort(), 'remove の 2 decoy はそのまま').toEqual([OTHER_CHAR, YUSAKU_EV2].sort());
  });

  // ===================================================================================
  // a3 【変装】【FILE7】 — fileAtLeast:7 条件アイコン実評価
  // ===================================================================================
  it('a3 canDisguise: FILE7 → true / FILE6 → false (fileAtLeast:7 条件アイコン実評価)', () => {
    const base = createEmptyGameState();
    base.players.self.scene = [sceneChar('Atk0', 'atk', { state: 'active' })];
    base.players.opp.scene = [sceneChar('Def0', 'dft', { state: 'sleep' })];
    base.players.self.hand = ['B09038'];
    const ax = makeAx();

    const file7 = produce(base, (d) => { d.players.self.file = Array.from({ length: 7 }, () => ({ ...FB })); });
    expect(canDisguise(file7, ax, 'self', 'B09038'), 'FILE7 → 変装可').toBe(true);

    const file6 = produce(base, (d) => { d.players.self.file = Array.from({ length: 6 }, () => ({ ...FB })); });
    expect(canDisguise(file6, ax, 'self', 'B09038'), 'FILE6 (7未満) → 不可 (fileAtLeast:7 未達)').toBe(false);

    const file0 = produce(base, (d) => { d.players.self.file = []; });
    expect(canDisguise(file0, ax, 'self', 'B09038'), 'FILE0 → 不可').toBe(false);
  });

  // ===================================================================================
  // descriptor 構造 sanity
  // ===================================================================================
  it('descriptor: a1=disguise:into(selfOnly) handAddFromRemove{工藤優作,char,max1}, a2=enter(selfOnly) optional[chain[sleep, sequence[sceneEnter{工藤優作,levelMax6,char,n0-1}, conditional[charSetCard fromDeckTop faceUp:false], draw]]], a3=icon-disguise fileAtLeast7', () => {
    const [a1, a2, a3] = B09038.abilities as [AbilityDef, AbilityDef, AbilityDef];
    // a1
    expect(a1.type, 'a1 triggered').toBe('triggered');
    expect(a1.trigger, 'a1 disguise:into selfOnly').toMatchObject({ hook: 'disguise:into', selfOnly: true });
    expect(a1.effect, 'a1 handAddFromRemove 工藤優作 character max1').toMatchObject({
      kind: 'atom', verb: 'handAddFromRemove',
      args: { player: 'self', max: 1, filter: { cardName: '工藤優作', kind: 'character' } },
    });
    // a2
    expect(a2.type, 'a2 triggered').toBe('triggered');
    expect(a2.trigger, 'a2 enter selfOnly').toMatchObject({ hook: 'enter', selfOnly: true });
    const opt = a2.effect as { kind: string; effect: { kind: string; steps: Array<Record<string, unknown>> } };
    expect(opt.kind, 'a2 effect optional').toBe('optional');
    const chain = opt.effect;
    expect(chain.kind, 'a2 inner chain').toBe('chain');
    expect(chain.steps[0], 'chain step0 sceneSetState $self sleep').toMatchObject({
      kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' },
    });
    const seq = chain.steps[1] as { kind: string; steps: Array<Record<string, unknown>> };
    expect(seq.kind, 'chain step1 sequence (各 step 独立 = BUG-111 #2 mandatory-tail 維持)').toBe('sequence');
    expect(seq.steps[0], 'seq step0 sceneEnter from:hand 工藤優作/levelMax6/char n:0-1 bind:$entered').toMatchObject({
      kind: 'atom', verb: 'sceneEnter',
      args: {
        player: 'self', from: 'hand', cardId: '$pick.cardId', viaEffect: true, bind: '$entered',
        target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { cardName: '工藤優作', levelMax: 6, kind: 'character' } }, n: { min: 0, max: 1 }, chooser: 'self' },
      },
    });
    expect(seq.steps[1], 'seq step1 conditional(boundMatchesFilter $entered char) → charSetCard fromDeckTop faceUp:false').toMatchObject({
      kind: 'conditional',
      if: { kind: 'boundMatchesFilter', bindKey: '$entered', filter: { kind: 'character' } },
      then: { kind: 'atom', verb: 'charSetCard', args: { uid: '$entered.uid', fromDeckTop: true, faceUp: false } },
    });
    expect(seq.steps[2], 'seq step2 draw n:1 (mandatory tail — sequence 末尾)').toMatchObject({
      kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 },
    });
    // a3
    expect(a3.type, 'a3 icon-disguise').toBe('icon-disguise');
    expect(a3.condition, 'a3 fileAtLeast:7').toMatchObject({ kind: 'fileAtLeast', n: 7 });
  });
});
