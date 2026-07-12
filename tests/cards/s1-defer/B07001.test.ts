// s1-defer probe — B07001 毛利蘭＆灰原哀 (MR, 青, cost-dyn traitCountAny + PA宣言)
//
// 公式テキスト (dossier B07001):
//   a1: 【パートナー青】【宣言】【ターン1】〚デッキ上3枚リムーブ〛：リムーブされた〚少年探偵団〛か
//       〚毛利探偵事務所〛のカード1枚につきAP＋1000 (ターン終了時まで) / ターン終了時まで〚突撃〛。
//       公式Q&A: 両特徴持ちも1枚分 / 0枚 match でも突撃は付く。
//   a2: 【宣言】【ターン1】現場の【青】キャラ1枚まで選び LP－1 + 「相手のアクティブ状態のキャラを指定して
//       アクションできる」を与える。この能力はパートナーエリアでも宣言できる。
//
// production dispatch (BUG-171): activateDeclaredAbility (= cost.pay + useDeclaredAbility) + runAllUntilEmpty。
//   a2 の Pattern A 短縮形 pick は human 経路で _drainPendingEffectPickSide + applyPickAndContinuation で pin。
//   owner='opp' pin (BUG-174): a2 を opp が宣言 → opp 現場側で pick 解決 (side:'self' は owner 相対)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import {
  _drainPendingEffectPickSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/resolve-picks';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as mutateChar } from '@/engine/mutate/char';
import { read } from '@/engine/read/index';
import { sceneChar, makeChar } from '../../helpers/fixtures';
import { B07001 } from '@/cards/ct-p07/B07001';
import type { CardDef, GameState } from '@/engine/types';

// --- fixtures (S1_ prefix で実カード非衝突) ---
const BLUEP = 'S1_B07001_BLUEP';   // partner colors[青] (partnerColor 条件)
const SBD = 'S1_B07001_SBD';       // trait[少年探偵団] deck card
const MTJ = 'S1_B07001_MTJ';       // trait[毛利探偵事務所] deck card
const FILL = 'S1_B07001_FILL';     // trait なし filler
const BLUE = 'S1_B07001_BLUE';     // colors[青] character (a2 pick 対象)

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 3, ap: 3000, lp: 2, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

function registerFixtures(): void {
  registerCardDef(B07001);
  registerCardDef({ id: BLUEP, no: `P/${BLUEP}`, kind: 'partner', names: ['青パートナー'], colors: ['青'], level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'P', imageUrl: '', abilities: [], ruleRefs: [] } as CardDef);
  registerCardDef(ch(SBD, { traits: ['少年探偵団'] }));
  registerCardDef(ch(MTJ, { traits: ['毛利探偵事務所'] }));
  registerCardDef(ch(FILL, { traits: [] }));
  registerCardDef(ch(BLUE, { colors: ['青'], lp: 2 }));
}

const setHuman = (s: 'self' | 'opp' | null) =>
  { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

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
// a1 — 【パートナー青】cost removeDeckTop3 → traitCountAny * 1000 AP + 突撃 grant
// ============================================================
describe('B07001 a1 — cost3 中 該当特徴の枚数分 AP＋1000 + 突撃 (ターン終了まで)', () => {
  function base(side: 'self' | 'opp', deckTop: string[]): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: side, phase: 'main', isFirstPlayerFirstTurn: false };
    const p = s.players[side];
    p.partner.cardId = BLUEP; // 【パートナー青】条件
    p.scene = [sceneChar('B07001', 'ran')];
    p.deck = [...deckTop, FILL, FILL]; // removeDeckTop3 に足りる
    return s;
  }

  it('① deck top3 = [少年探偵団, 毛利探偵事務所, filler] → 2枚 match → AP 8000→10000 + 突撃', () => {
    const after = produce(base('self', [SBD, MTJ, FILL]), (d) => {
      activateDeclaredAbility(d, 'ran', 'a1');
      runAllUntilEmpty(d);
    });
    expect(read.char.ap(after, 'ran'), '2 match → +2000').toBe(10000);
    expect(read.char.hasKeyword(after, 'ran', '突撃'), '突撃 付与').toBe(true);
  });

  it('② deck top3 に該当特徴 0枚 → AP 変化なし (8000) だが 突撃 は付く (公式Q&A)', () => {
    const after = produce(base('self', [FILL, FILL, FILL]), (d) => {
      activateDeclaredAbility(d, 'ran', 'a1');
      runAllUntilEmpty(d);
    });
    expect(read.char.ap(after, 'ran'), '0 match → +0').toBe(8000);
    expect(read.char.hasKeyword(after, 'ran', '突撃'), '0枚でも突撃は付く').toBe(true);
  });

  it('両特徴を持つ1枚は1枚分 (any-match count 公式Q&A) — [両特徴, filler, filler] → +1000', () => {
    registerCardDef(ch('S1_B07001_BOTH', { traits: ['少年探偵団', '毛利探偵事務所'] }));
    const after = produce(base('self', ['S1_B07001_BOTH', FILL, FILL]), (d) => {
      activateDeclaredAbility(d, 'ran', 'a1');
      runAllUntilEmpty(d);
    });
    expect(read.char.ap(after, 'ran'), '両特徴も1枚分 → +1000').toBe(9000);
  });

  it('【パートナー青】条件 = canDeclaredAbility gate (青→可 / 非青→不可、rules/17 条件外は持たない扱い)', () => {
    registerCardDef({ id: 'S1_REDP', no: 'P/S1_REDP', kind: 'partner', names: ['赤P'], colors: ['赤'], level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'P', imageUrl: '', abilities: [], ruleRefs: [] } as CardDef);
    const blue = base('self', [SBD, MTJ, FILL]); // partner=青
    expect(canDeclaredAbility(blue, 'ran', 'a1'), 'partner 青 → 宣言可').toBe(true);
    const red = base('self', [SBD, MTJ, FILL]);
    red.players.self.partner.cardId = 'S1_REDP'; // partner=赤
    expect(canDeclaredAbility(red, 'ran', 'a1'), 'partner 非青 → 宣言不可').toBe(false);
  });
});

// ============================================================
// a2 — 現場【青】1枚 LP-1 + actionTargetsActive 付与 (Pattern A short-form pick)
// ============================================================
describe('B07001 a2 — 現場【青】pick → LP－1 + actionTargetsActive', () => {
  it('③ scene の【青】キャラを選択 → LP 2→1 + actionTargetsActive true (現場宣言)', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B07001', 'ran'), sceneChar(BLUE, 'blue')];
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'ran', 'a2');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'charModifyLP pick surface').not.toBeNull();
      expect(pick!.nMin, '「1枚まで」= 0 可').toBe(0);
      applyPickAndContinuation(d, pick!, 'blue');
    });
    expect(read.char.lp(after, 'blue'), 'LP 2→1').toBe(1);
    expect(read.char.hasTextAbility(after, 'blue', 'actionTargetsActive'), 'actionTargetsActive 付与').toBe(true);
    // ターン終了で失効 (scope:'turn')
    const cleared = produce(after, (d) => { mutateChar.clearTurnEffects(d, 'blue', 'turn'); });
    expect(read.char.hasTextAbility(cleared, 'blue', 'actionTargetsActive'), 'turn 終了で失効').toBe(false);
    expect(read.char.lp(cleared, 'blue'), 'LP も復元').toBe(2);
  });

  it('④ パートナーエリア (partnerMR:self) 経路でも a2 発動 (scope on-partner-area)', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partnerAreaMR = makeChar({ cardId: 'B07001', uid: 'partnerMR:self' });
    s.players.self.scene = [sceneChar(BLUE, 'blue')];
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:self', 'a2');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'PA 経路でも pick surface').not.toBeNull();
      applyPickAndContinuation(d, pick!, 'blue');
    });
    expect(read.char.lp(after, 'blue'), 'PA 経路 LP 2→1').toBe(1);
    expect(read.char.hasTextAbility(after, 'blue', 'actionTargetsActive')).toBe(true);
  });

  it('⑤ owner=opp — opp が a2 宣言 → opp 現場の【青】キャラで解決 (side:self は owner 相対)', () => {
    setHuman('opp');
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [sceneChar('B07001', 'oran'), sceneChar(BLUE, 'oblue')];
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'oran', 'a2');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'opp 側 pick surface').not.toBeNull();
      // 候補は opp 現場の【青】キャラ (side:self = owner=opp 相対)
      const candIds = pick!.candidates.map((c) => c.uid);
      expect(candIds, 'opp 現場キャラが候補').toContain('oblue');
      applyPickAndContinuation(d, pick!, 'oblue');
    });
    expect(read.char.lp(after, 'oblue'), 'opp 側 LP 2→1').toBe(1);
    expect(read.char.hasTextAbility(after, 'oblue', 'actionTargetsActive')).toBe(true);
  });
});
