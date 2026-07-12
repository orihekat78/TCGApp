// s1-defer probe — B09109 怪盗キッド&安室透 (MR, 白+黄, deckRevealUntil chain + revealFromHand nameOverride)
//
// 公式テキスト (dossier B09109):
//   a1: 【宣言】【ターン1】現場のレベル8以下のキャラを1枚選んでもよい。そうした場合、デッキ上からその
//       キャラと同 level・同名のキャラが出るまで公開→登場、ターン終了時まで「ターン終了時、このキャラを
//       現場からデッキの下に移す。」を与える。残りをデッキ下→シャッフル。
//       公式Q&A: 同名なしで全公開 → 何も登場せず全部戻してシャッフル。
//   a2: 【宣言】【ターン1】〚手札からレベル8以下のキャラを1枚公開〛：現場のキャラ1枚まで選び、ターン終了
//       時までカード名を公開したキャラのカード名に書き換える。この能力はパートナーエリアでも宣言できる。
//       公式Q&A: 元のカード名は持っていない扱い / 公開した手札は解決に入ればもとに戻せる (= zone 不変)。
//
// production dispatch (BUG-171): activateDeclaredAbility + runAllUntilEmpty。human 経路で pick を
//   _drainPendingEffectPickSide + applyPickAndContinuation で pin。owner='opp' pin (BUG-174)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
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
import { B09109 } from '@/cards/ct-p09/B09109';
import type { CardDef, GameState } from '@/engine/types';

// --- fixtures ---
const DECOY_KID = 'S1_B09109_DECOYKID'; // lv5 名[怪盗キッド] (a1 で選ぶ現場キャラ)
const DK_KID5 = 'S1_B09109_DKKID5';     // lv5 名[怪盗キッド] deck (同 level+同名 match)
const FILL_L3 = 'S1_B09109_FILLL3';     // lv3 filler (非match、先頭で公開される)
const FILL_L8 = 'S1_B09109_FILLL8';     // lv8 filler (deck 下に残る)
const TGT = 'S1_B09109_TGT';            // 名[毛利蘭] (a2 で書き換え対象)
const KYOGOKU = 'S1_B09109_KYOGOKU';    // lv8 名[京極真] 手札 (revealFromHand cost)

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

function registerFixtures(): void {
  registerCardDef(B09109);
  registerCardDef(ch(DECOY_KID, { level: 5, names: ['怪盗キッド'] }));
  registerCardDef(ch(DK_KID5, { level: 5, names: ['怪盗キッド'] }));
  registerCardDef(ch(FILL_L3, { level: 3 }));
  registerCardDef(ch(FILL_L8, { level: 8 }));
  registerCardDef(ch(TGT, { names: ['毛利蘭'] }));
  registerCardDef(ch(KYOGOKU, { level: 8, names: ['京極真'] }));
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
// a1 — bindPick → deckRevealUntil (同 level+同名) → sceneEnter + toDeckBottomOnTurnEnd rider → 残り下+shuffle
// ============================================================
describe('B09109 a1 — 選んだキャラと同 level・同名を公開まで→登場 + rider + 残りデッキ下', () => {
  it('① lv5[怪盗キッド]選択 → deck の DK_KID5 登場 + toDeckBottomOnTurnEnd rider + FILL_L3 デッキ下', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B09109', 'kid#1'), sceneChar(DECOY_KID, 'dk1')];
    s.players.self.deck = [FILL_L3, DK_KID5, FILL_L8];
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'kid#1', 'a1');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'bindPick surface (「選んでもよい」)').not.toBeNull();
      applyPickAndContinuation(d, pick!, 'dk1'); // lv5[怪盗キッド] を選ぶ
    });
    const entered = after.players.self.scene.find((c) => c.cardId === DK_KID5);
    expect(entered, '同 level+同名 DK_KID5 が登場').not.toBeUndefined();
    expect(entered!.turnEffects['toDeckBottomOnTurnEnd'], 'rider 付与 (ターン終了でデッキ下)').toBe(true);
    // 残りの公開カード (FILL_L3) はデッキ下 / FILL_L8 は未公開で残る → deck 2枚
    expect(after.players.self.deck.length, '残り2枚 (FILL_L3 + FILL_L8)').toBe(2);
    expect(after.players.self.deck.includes(DK_KID5), 'DK_KID5 は deck から抜けた').toBe(false);
    expect(after.players.self.deck.includes(FILL_L3), 'FILL_L3 はデッキ下へ').toBe(true);
    expect(after.players.self.deck.includes(FILL_L8), 'FILL_L8 は残る').toBe(true);
  });
});

// ============================================================
// a2 — revealFromHand cost (cardName) → charSetTurnEffect nameOverride (完全置換) + zone 不変 + turn-end 復元
// ============================================================
describe('B09109 a2 — 手札公開キャラ名で現場キャラのカード名を書き換え', () => {
  function drainAll(d: GameState, chosenUid: string): void {
    // cost/effect pick を順に排出 (revealFromHand cost pick が surface する場合も含む)
    for (let i = 0; i < 4; i++) {
      const pick = _drainPendingEffectPickSide();
      if (!pick) break;
      const cand = pick.candidates.find((c) => c.uid === chosenUid) ?? pick.candidates.find((c) => c.cardId === KYOGOKU);
      applyPickAndContinuation(d, pick, cand ? cand.uid : (pick.candidates[0]?.uid ?? chosenUid));
    }
  }

  it('②③ 京極真 公開 → tgt の names が [京極真] に完全置換 / 公開手札は手札に残る / turn 終了で復元', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B09109', 'kid#1'), sceneChar(TGT, 'tgt')];
    s.players.self.hand = [KYOGOKU];
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'kid#1', 'a2');
      runAllUntilEmpty(d);
      drainAll(d, 'tgt');
    });
    expect(read.char.names(after, 'tgt'), 'tgt の名は京極真に完全置換 (元の毛利蘭は持たない)').toEqual(['京極真']);
    expect(after.players.self.hand.includes(KYOGOKU), '③ 公開した手札は手札に残る (zone 不変)').toBe(true);
    // turn 終了で復元 (scope:'turn' nameOverride)
    const cleared = produce(after, (d) => { mutateChar.clearTurnEffects(d, 'tgt', 'turn'); });
    expect(read.char.names(cleared, 'tgt'), 'turn 終了で元の名に復元').toEqual(['毛利蘭']);
  });

  it('④ owner=opp — opp が a2 宣言 → opp 現場キャラの名を書き換え', () => {
    setHuman('opp');
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [sceneChar('B09109', 'okid'), sceneChar(TGT, 'otgt')];
    s.players.opp.hand = [KYOGOKU];
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'okid', 'a2');
      runAllUntilEmpty(d);
      drainAll(d, 'otgt');
    });
    expect(read.char.names(after, 'otgt'), 'opp 現場キャラの名を京極真に置換').toEqual(['京極真']);
    expect(after.players.opp.hand.includes(KYOGOKU), 'opp の公開手札は残る').toBe(true);
  });

  it('⑤ パートナーエリア (partnerMR:self) 経路でも a2 発動 (scope on-partner-area)', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partnerAreaMR = makeChar({ cardId: 'B09109', uid: 'partnerMR:self' });
    s.players.self.scene = [sceneChar(TGT, 'tgt')];
    s.players.self.hand = [KYOGOKU];
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:self', 'a2');
      runAllUntilEmpty(d);
      drainAll(d, 'tgt');
    });
    expect(read.char.names(after, 'tgt'), 'PA 経路でも名を京極真に置換').toEqual(['京極真']);
  });
});
