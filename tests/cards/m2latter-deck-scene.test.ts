// M2後半 batch probe — B05063 園子のアブない夏物語 (case) / PR265 風見裕也 (character) / B09019 「くさるなよ！」 (event)
//
// first-consumer 検証 (engine primitive は m2latter-dyn-bind.test.ts で unit 済、ここは production 経路):
//   B05063 a2: activateDeclaredAbility('case:self') → cost flipFaceUpEvidence{3,3} → sceneEnter from hand
//     (京極真 levelMax8) bind:'$entered' → charSetTurnEffect toHandOnTurnEnd → endTurn consume で手札へ。
//   PR265 a1: handUseCard 登場 → enter hook → deckRevealUntil maxN:1 upTo(警視庁 character) →
//     handAddFromDeck → mill n:{dyn:'$bound.$matched.level'} (発見カードの印字レベル枚数)。
//   B09019 a1: handUseCard (event-use) → optional → chain[fileRemoveTop, sceneRemove(結成), sequence[
//     sceneEnter cardIds-multi bind:'$entered' (スリープ登場), conditional boundCountCompare eq5,
//     setNextHintBan]]。5枚登場 → 追加 sceneRemove pick / 4枚以下 → なし / FILE0 → chain break。
//
// rules: 05 (endTurn 順序) / 12 (ネクストヒント) / 14-26 (mill refresh Q&A) / 15 (「まで」=0可) /
//        17 (【解決編】条件外=持たない扱い) / 21 (cost 全部行えなければ使用不可) / 23 (turnEffects 引継ぎ系)。
// grounding: .claude/specs/grounding/{B05063,PR265,B09019}.md。
// BUG-174 pin: owner='opp' (case:opp + human opp) 1本。BUG-117/118 decoy: filter 外カードを盤面/デッキに同居。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { endTurn } from '@/engine/flow/turn';
import {
  _drainPendingEffectPickSide,
  _peekPendingEffectPickQueueLength,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
  _drainPendingEffectOptionalSide,
} from '@/engine/effect/resolve-picks';
import { applyPickAndContinuation, applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { cost as engineCost } from '@/engine/cost/index';
import { sceneChar } from '../helpers/fixtures';
import { B05063 } from '@/cards/ct-p05/B05063';
import { PR265 } from '@/cards/pr-01/PR265';
import { B09019 } from '@/cards/ct-p09/B09019';
import type { CardDef, GameState, EffectCtx, EvidenceCard, FileCard } from '@/engine/types';

// --- fixtures (DEC_ prefix で実カードと非衝突) ---
const KYOGOKU = 'DEC_M2L_KYOGOKU';   // names[京極真] Lv8 character — B05063 a2 対象
const KYO9 = 'DEC_M2L_KYO9';         // names[京極真] Lv9 character — levelMax:8 decoy
const OTHER = 'DEC_M2L_OTHER';       // 別名 Lv3 character — cardName decoy
const SUZUKI = 'DEC_M2L_SUZUKI';     // 特徴[鈴木財閥] character — condition 用
const KEI3 = 'DEC_M2L_KEI3';         // 特徴[警視庁] Lv3 character — PR265 a1 match (mill=3)
const KEI_EV = 'DEC_M2L_KEI_EV';     // 特徴[警視庁] event — kind:'character' decoy
const PLAIN = 'DEC_M2L_PLAIN';       // 無特徴 character — 非match
const KESSEI = 'DEC_M2L_KESSEI';     // names[結成 少年探偵団] — B09019 リムーブ対象
const KID = (i: number) => `DEC_M2L_KID${i}`; // 少年探偵団 Lv3 別名 ×5
const KID_L5 = 'DEC_M2L_KID_L5';     // 少年探偵団 Lv5 — levelMax:4 decoy
const NONKID = 'DEC_M2L_NONKID';     // 無特徴 Lv2 — trait decoy
const FB_ID = 'DEC_M2L_FILE';        // FILE filler cardId
const FB: FileCard = { type: 'card-back', cardId: FB_ID }; // FILE filler (FileCard object)
const F = (i: number) => `DEC_M2L_F${i}`; // deck filler

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function registerFixtures(): void {
  registerCardDef(B05063);
  registerCardDef(PR265);
  registerCardDef(B09019);
  registerCardDef(ch(KYOGOKU, { names: ['京極真'], level: 8, colors: ['白'] }));
  registerCardDef(ch(KYO9, { names: ['京極真'], level: 9, colors: ['白'] }));
  registerCardDef(ch(OTHER, { names: ['鈴木園子'], level: 3, colors: ['白'] }));
  registerCardDef(ch(SUZUKI, { names: ['鈴木史郎'], traits: ['鈴木財閥'], colors: ['白'] }));
  registerCardDef(ch(KEI3, { names: ['白鳥任三郎'], traits: ['警察', '警視庁'], level: 3, colors: ['黄'] }));
  registerCardDef(ch(KEI_EV, { kind: 'event', names: ['警視庁イベント'], traits: ['警視庁'], level: 3, colors: ['黄'] }));
  registerCardDef(ch(PLAIN, { names: ['目暮十三'], level: 4, colors: ['黄'] }));
  registerCardDef(ch(KESSEI, { names: ['結成 少年探偵団'], level: 2 }));
  for (let i = 1; i <= 5; i++) registerCardDef(ch(KID(i), { names: [`少年探偵団${i}号`], traits: ['少年探偵団'], level: 3 }));
  registerCardDef(ch(KID_L5, { names: ['少年探偵団5級'], traits: ['少年探偵団'], level: 5 }));
  registerCardDef(ch(NONKID, { names: ['非団員'], level: 2 }));
  registerCardDef(ch(FB_ID));
  for (let i = 1; i <= 6; i++) registerCardDef(ch(F(i)));
}

const setHuman = (s: 'self' | 'opp' | null) =>
  { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };
const ev = (cardId: string, faceUp = false): EvidenceCard => ({ cardId, faceUp, origin: { turn: 1, via: 'opening' } });

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  setHuman(null);
  registerFixtures();
  registerTriggeredListener();
});

// ============================================================
// B05063 a2 — 宣言 production → 京極真登場 + toHandOnTurnEnd → endTurn で手札へ
// ============================================================
function b05063Base(opts: {
  side?: 'self' | 'opp';
  status?: string;
  suzuki?: number;
  facedown?: number;
  hand?: string[];
} = {}): GameState {
  const side = opts.side ?? 'self';
  const s = createEmptyGameState();
  s.turn = { number: 5, player: side, phase: 'main', isFirstPlayerFirstTurn: false };
  const p = s.players[side];
  p.case.cardId = 'B05063';
  p.case.status = (opts.status ?? '解決編') as GameState['players']['self']['case']['status'];
  p.case.colors = ['白'];
  const nSuzuki = opts.suzuki ?? 3;
  p.scene = Array.from({ length: nSuzuki }, (_, i) => sceneChar(SUZUKI, `sz${i}`));
  p.evidence = Array.from({ length: opts.facedown ?? 3 }, (_, i) => ev(`SE${i}`));
  p.hand = opts.hand ?? [KYOGOKU, KYO9, OTHER];
  p.deck = [F(1), F(2)];
  return s;
}

describe('B05063 a2 — declared production (flipFaceUpEvidence 3 → 京極真登場 + toHandOnTurnEnd rider)', () => {
  it('human self: cost 3裏証拠表向き → pick=京極真(Lv8)のみ候補 (Lv9/別名 decoy 除外) → 登場 + flag → endTurn で手札へ', () => {
    setHuman('self');
    const after = produce(b05063Base(), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1, 2] } });
      runAllUntilEmpty(d);
      const pending = _drainPendingEffectPickSide();
      expect(pending, 'sceneEnter from hand の pick が surface').not.toBeNull();
      expect(pending!.nMin, '「1枚まで」= 0枚可').toBe(0);
      const ids = pending!.candidates.map((c) => c.cardId);
      expect(ids, '京極真 Lv8 が候補').toContain(KYOGOKU);
      expect(ids, 'Lv9 京極真は levelMax:8 で除外').not.toContain(KYO9);
      expect(ids, '別名キャラは cardName filter で除外').not.toContain(OTHER);
      const cand = pending!.candidates.find((c) => c.cardId === KYOGOKU)!;
      applyPickAndContinuation(d, pending!, cand.uid);
      runAllUntilEmpty(d);
      // 登場 + rider flag
      const entered = d.players.self.scene.find((c) => c.cardId === KYOGOKU);
      expect(entered, '京極真が現場に登場').toBeTruthy();
      expect(entered!.turnEffects['toHandOnTurnEnd'], 'rider flag セット').toBe(true);
      expect(d.players.self.evidence.every((e) => e.faceUp), 'cost: 裏証拠3つ表向き').toBe(true);
      // endTurn consume: 現場から手札へ (リムーブでない)
      endTurn(d, 'self');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.scene.some((c) => c.cardId === KYOGOKU), 'endTurn 後は現場に居ない').toBe(false);
    expect(after.players.self.hand.includes(KYOGOKU), '手札に戻る').toBe(true);
    expect(after.players.self.remove.includes(KYOGOKU), 'リムーブではない').toBe(false);
  });

  it('owner=opp (case:opp, human opp) → opp 側 hand/evidence/scene で解決 (BUG-174 pin)', () => {
    setHuman('opp');
    const after = produce(b05063Base({ side: 'opp' }), (d) => {
      activateDeclaredAbility(d, 'case:opp', 'a2', { flipFaceUpEvidence: { indices: [0, 1, 2] } });
      runAllUntilEmpty(d);
      const pending = _drainPendingEffectPickSide();
      expect(pending, 'opp owner human → pick surface').not.toBeNull();
      expect(pending!.player, 'chooser = opp').toBe('opp');
      const cand = pending!.candidates.find((c) => c.cardId === KYOGOKU)!;
      applyPickAndContinuation(d, pending!, cand.uid);
      runAllUntilEmpty(d);
    });
    const entered = after.players.opp.scene.find((c) => c.cardId === KYOGOKU);
    expect(entered, '相手現場に登場').toBeTruthy();
    expect(entered!.turnEffects['toHandOnTurnEnd'], 'rider flag は opp 側キャラに').toBe(true);
    expect(after.players.opp.evidence.every((e) => e.faceUp), '相手の裏証拠3つ表向き').toBe(true);
    expect(after.players.self.scene.length, '自分側は無影響').toBe(0);
  });

  it('cost gate: 裏証拠2つ以下 → canPay=false (公式Q&A / rules/21、canDeclaredAbility は cost を見ない)', () => {
    const a2 = B05063.abilities.find((a) => a.id === 'a2')!;
    const ctx: EffectCtx = {
      source: { cardId: 'B05063', uid: 'case:self', abilityId: 'a2', player: 'self', area: 'case' },
      bindings: {},
    };
    expect(engineCost.canPay(b05063Base({ facedown: 2 }), a2.cost!, ctx), '2つでは3つ表向きにできない').toBe(false);
    expect(engineCost.canPay(b05063Base({ facedown: 3 }), a2.cost!, ctx), '3つなら可').toBe(true);
  });

  it('condition gate: 鈴木財閥2枚 / 事件編 → 宣言不可', () => {
    expect(canDeclaredAbility(b05063Base({ suzuki: 2 }), 'case:self', 'a2'), '鈴木財閥3枚未満').toBe(false);
    expect(canDeclaredAbility(b05063Base({ status: '事件編' }), 'case:self', 'a2'), '【解決編】外').toBe(false);
  });
});

// ============================================================
// PR265 a1 — handUseCard 登場 → 警視庁キャラ発見時 mill 枚数 = そのカードの印字レベル
// ============================================================
function pr265Base(deck: string[]): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  const p = s.players.self;
  p.case.cardId = 'DUMMY_CASE';
  p.case.status = '事件編' as GameState['players']['self']['case']['status'];
  p.case.colors = ['黄'];
  p.file = [FB, FB, FB, FB, FB];
  p.hand = ['PR265'];
  p.deck = [...deck];
  return s;
}

describe('PR265 a1 — enter → deckRevealUntil maxN:1 upTo(警視庁) → handAdd → mill = 発見カードの level', () => {
  const use = (s0: GameState) => produce(s0, (d) => {
    handUseCard(d, 'self', 'PR265');
    runAllUntilEmpty(d);
  });

  it('top1 = 警視庁 Lv3 キャラ → 手札へ + デッキ上から3枚リムーブ (AI auto-take)', () => {
    const after = use(pr265Base([KEI3, F(1), F(2), F(3), F(4)]));
    expect(after.players.self.scene.some((c) => c.cardId === 'PR265'), 'PR265 登場').toBe(true);
    expect(after.players.self.hand, '警視庁キャラを手札に').toEqual([KEI3]);
    expect(after.players.self.remove, 'mill 3枚 = KEI3 の印字 level').toEqual([F(1), F(2), F(3)]);
    expect(after.players.self.deck, '残デッキ').toEqual([F(4)]);
  });

  it('top1 = 非該当キャラ → 加えず mill なし、公開1枚はデッキ下へ', () => {
    const after = use(pr265Base([PLAIN, F(1), F(2)]));
    expect(after.players.self.hand.length, '手札に加えない').toBe(0);
    expect(after.players.self.remove.length, 'mill 発生しない').toBe(0);
    expect(after.players.self.deck, '公開1枚をデッキ下へ').toEqual([F(1), F(2), PLAIN]);
  });

  it('top1 = 警視庁 event → kind:character 違反で非該当 (BUG-117/118 decoy)', () => {
    const after = use(pr265Base([KEI_EV, F(1)]));
    expect(after.players.self.hand.length, 'event は加えない').toBe(0);
    expect(after.players.self.remove.length, 'mill 発生しない').toBe(0);
    expect(after.players.self.deck, 'event はデッキ下へ').toEqual([F(1), KEI_EV]);
  });

  it('a2 gate: 【解決編】外 → 宣言不可 / 解決編 → 宣言可', () => {
    const s = pr265Base([F(1)]);
    s.players.self.scene = [sceneChar('PR265', 'kaza#1')];
    s.players.self.hand = [F(2)];
    expect(canDeclaredAbility(s, 'kaza#1', 'a2'), '事件編では不可').toBe(false);
    const s2 = produce(s, (d) => { d.players.self.case.status = '解決編' as GameState['players']['self']['case']['status']; });
    expect(canDeclaredAbility(s2, 'kaza#1', 'a2'), '解決編で可').toBe(true);
  });
});

// ============================================================
// B09019 a1 — event use → optional → chain → 5枚スリープ登場 → eq5 conditional + nextHintBan
// ============================================================
function b09019Base(opts: { file?: number; kessei?: boolean; remove?: string[] } = {}): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  const p = s.players.self;
  p.case.cardId = 'DUMMY_CASE';
  p.case.status = '事件編' as GameState['players']['self']['case']['status'];
  p.case.colors = ['青'];
  p.file = Array.from({ length: opts.file ?? 7 }, () => FB);
  p.hand = ['B09019'];
  p.scene = (opts.kessei ?? true) ? [sceneChar(KESSEI, 'kes#1')] : [];
  p.remove = opts.remove ?? [KID(1), KID(2), KID(3), KID(4), KID(5), KID_L5, NONKID];
  return s;
}

/** handUseCard → optional take → 結成 sceneRemove pick 解決まで進め、multi-pick pending を返す。 */
function driveToMultiPick(d: GameState): NonNullable<ReturnType<typeof _drainPendingEffectPickSide>> {
  handUseCard(d, 'self', 'B09019');
  runAllUntilEmpty(d);
  const opt = _drainPendingEffectOptionalSide();
  expect(opt, '「〜してもよい」optional が surface').not.toBeNull();
  applyOptionalAndContinuation(d, opt!, true);
  runAllUntilEmpty(d);
  // chain step2: 現場の[結成 少年探偵団]を1枚リムーブ (min1)
  const p1 = _drainPendingEffectPickSide();
  expect(p1, '結成リムーブの pick が surface').not.toBeNull();
  expect(p1!.nMin, '「1枚リムーブ」= 必須').toBe(1);
  const kes = p1!.candidates.find((c) => c.cardId === KESSEI)!;
  expect(kes, '結成 少年探偵団 が候補').toBeTruthy();
  applyPickAndContinuation(d, p1!, kes.uid);
  runAllUntilEmpty(d);
  // sequence step1: multi-enter pick
  const p2 = _drainPendingEffectPickSide();
  expect(p2, 'multi-enter の pick が surface').not.toBeNull();
  return p2!;
}

describe('B09019 a1 — optional chain + cardIds-multi sceneEnter + boundCountCompare eq5', () => {
  it('human self: 5枚選択 → 5体スリープ登場 + 追加「キャラ1枚まで」pick + nextHintBan (filter decoy 除外)', () => {
    setHuman('self');
    const after = produce(b09019Base(), (d) => {
      const p2 = driveToMultiPick(d);
      const ids = p2.candidates.map((c) => c.cardId);
      expect(ids, 'Lv5 少年探偵団は levelMax:4 で除外').not.toContain(KID_L5);
      expect(ids, '無特徴キャラは trait filter で除外').not.toContain(NONKID);
      expect(ids, '使用済イベント自身 (remove 所在) は kind:character で除外').not.toContain('B09019');
      const uids = [1, 2, 3, 4, 5].map((i) => p2.candidates.find((c) => c.cardId === KID(i))!.uid);
      applyPickAndContinuation(d, p2, uids[0]!, uids);
      runAllUntilEmpty(d);
      // 5枚登場 → conditional eq5 → 「キャラを1枚まで選び、リムーブする」pick が surface
      const p3 = _drainPendingEffectPickSide();
      expect(p3, 'eq5 成立 → 追加 sceneRemove pick').not.toBeNull();
      expect(p3!.nMin, '「1枚まで」= 0枚可').toBe(0);
      const victim = p3!.candidates.find((c) => c.cardId === KID(1))!;
      applyPickAndContinuation(d, p3!, victim.uid);
      runAllUntilEmpty(d);
    });
    const kids = after.players.self.scene.filter((c) => c.cardId.startsWith('DEC_M2L_KID'));
    expect(kids.length, '5体登場 − 1体リムーブ = 4体').toBe(4);
    expect(kids.every((c) => c.state === 'sleep'), 'スリープ状態で登場').toBe(true);
    expect(after.players.self.scene.some((c) => c.cardId === KESSEI), '結成はリムーブ済').toBe(false);
    expect(after.players.self.file.length, 'FILE 上1リムーブ').toBe(6);
    expect(after.turnState.self.nextHintBanned, 'ネクストヒント禁止').toBe(true);
  });

  it('4枚選択 → conditional 不成立 (追加 pick なし) + nextHintBan は立つ', () => {
    setHuman('self');
    const after = produce(b09019Base(), (d) => {
      const p2 = driveToMultiPick(d);
      const uids = [1, 2, 3, 4].map((i) => p2.candidates.find((c) => c.cardId === KID(i))!.uid);
      applyPickAndContinuation(d, p2, uids[0]!, uids);
      runAllUntilEmpty(d);
      expect(_peekPendingEffectPickQueueLength(), 'eq5 不成立 → 追加 sceneRemove pick なし').toBe(0);
    });
    const kids = after.players.self.scene.filter((c) => c.cardId.startsWith('DEC_M2L_KID'));
    expect(kids.length, '4体登場のまま').toBe(4);
    expect(kids.every((c) => c.state === 'sleep'), 'スリープ登場').toBe(true);
    expect(after.turnState.self.nextHintBanned, 'nextHintBan は 4枚でも立つ').toBe(true);
  });

  it('optional decline → 何も起こらない (FILE/結成/ban 不変)', () => {
    setHuman('self');
    const after = produce(b09019Base(), (d) => {
      handUseCard(d, 'self', 'B09019');
      runAllUntilEmpty(d);
      const opt = _drainPendingEffectOptionalSide();
      expect(opt).not.toBeNull();
      applyOptionalAndContinuation(d, opt!, false);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.file.length, 'FILE 不変').toBe(7);
    expect(after.players.self.scene.some((c) => c.cardId === KESSEI), '結成は現場に残る').toBe(true);
    // ban は optional の外 (無条件) — 印字上「そうした場合」節に属さない独立文 (rules/15「〜する」必須。
    // 2026-07-10 裁定: decline でも ban は立つ)。
    expect(after.turnState.self.nextHintBanned ?? false, 'ban は無条件で立つ').toBe(true);
    expect(_peekPendingEffectPickQueueLength(), 'pick なし').toBe(0);
  });

  it('FILE 0 → fileRemoveTop no-op で chain break (後続不成立、grounding 罠節)', () => {
    setHuman('self');
    const after = produce(b09019Base({ file: 0 }), (d) => {
      // level 7 > FILE 0 のため handUseCard の gate は通らない — event-use emit を直接駆動
      // (handUseCard と同 payload。optional surface は triggered walk 経由でのみ発生する)
      event.emit(d, 'effect:declared', { kind: 'event-use', cardId: 'B09019', player: 'self' }, { player: 'self', cardId: 'B09019' });
      runAllUntilEmpty(d);
      const opt = _drainPendingEffectOptionalSide();
      expect(opt).not.toBeNull();
      applyOptionalAndContinuation(d, opt!, true);
      runAllUntilEmpty(d);
    });
    expect(_peekPendingEffectPickQueueLength(), '結成 pick も enter pick も surface しない').toBe(0);
    expect(after.players.self.scene.some((c) => c.cardId === KESSEI), '結成は現場に残る').toBe(true);
    // ban は chain の外 (無条件) — FILE0 chain break でも立つ (2026-07-10 裁定、上の decline case と同旨)。
    expect(after.turnState.self.nextHintBanned ?? false, 'ban は無条件で立つ (chain break 後も)').toBe(true);
  });
});
