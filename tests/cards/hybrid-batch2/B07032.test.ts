// hybrid-batch2 probe — B07032 白馬探 (character / 白 / 探偵・高校生 / SR)
//
// 公式テキスト (declared ability a1):
//   【宣言】【スリープ】〚手札を1枚リムーブする〛：AP8000以下のキャラを1枚まで選び、リムーブする。
//   自分のパートナーエリアにある〚特徴［ビッグジュエル］〛のカードを1枚リムーブしてもよい。
//   そうした場合、カードを2枚引く。
//
// DSL:
//   cost pay[sleepSelf, removeFromHand pick n1]
//   → effect sequence[
//        sceneRemove{player:self, max:1, side:either, filter:{apMax:8000}},   ← 「1枚まで」= nMin:0
//        optional{chain[
//          partnerAreaRemove{n:1, filter:{trait:ビッグジュエル}},              ← 候補<1 → chainStepNoApply
//          draw{n:2}                                                          ← 「そうした場合」gate
//        ]}
//      ]
//
// production dispatch (BUG-171): activateDeclaredAbility (= cost.pay + useDeclaredAbility) + runAllUntilEmpty。
//   pick 解決は production 経路のみ:
//     - human: setHuman + _drainPendingEffectPickSide + applyPickAndContinuation / applyPickSkipAndContinuation
//     - optional: _drainPendingEffectOptionalSide + applyOptionalAndContinuation(run)
//   ※ sequence[pick, optional] の初期 walk で optional は declare 時に hoist され pending optional が surface
//     する (resolve-picks sequence case は choice のみ early-break、optional は非 break)。よって drain 順は
//     sceneRemove-pick → optional → (take 時) partnerAreaRemove-pick。実測で確定 (探索 probe)。
//
// 検証面 (BUG-117/118: DSL に filter/条件を書いても engine 実評価は別 → outcome で 1対1 証明):
//   a. cost gate: sleep 状態 (sleepSelf 不可) / 空手札 (removeFromHand 不可) は canPay=false。
//   b. 成功 declare: self→sleep / hand-1 (remove へ) / sceneRemove が apMax:8000 を honor
//      (AP9000 decoy は候補外) / side:either 両陣候補 / owner='opp' pin (opp キャラ除去→opp.remove、BUG-174)。
//   c. 「1枚まで」= 0 可 (sceneRemove human skip: applyPickSkipAndContinuation run=false)。
//   d. optional take (human): PA に[ビッグジュエル]あり → partnerAreaRemove で remove へ + draw 2。
//   e. optional decline (human): draw なし・PA カード残る。
//   f. optional take だが PA に[ビッグジュエル]なし (他特徴) → chain gate (chainStepNoApply) → draw なし。
// rules: 15-abilities-effects.md (「〜まで」=0可 / 「そうした場合」gate), 21-declared-ability-cost.md
//        (sleepSelf は active のみ / 全部行えなければ使用不可), 17-icons.md (【宣言】), 03-field-areas.md (PA).

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canPay } from '@/engine/cost/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  _drainPendingEffectPickSide,
  _peekPendingEffectPickQueueLength,
  _drainPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/resolve-picks';
import {
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
  applyOptionalAndContinuation,
} from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar } from '../../helpers/fixtures';
import type { GameState, SceneCharacter, CardDef, EffectCtx } from '@/engine/types';
import { B07032 } from '@/cards/ct-p07/B07032';

const setHuman = (s: 'self' | 'opp' | null) => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
};
const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  sceneChar(cardId, uid, { state });

function cdef(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 5000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

// fixtures
const OPPLOW = cdef('OPPLOW', { ap: 5000 });                                  // sceneRemove 対象 (AP≤8000)
const DECOY9000 = cdef('DECOY9000', { ap: 9000 });                            // apMax:8000 外 decoy
const JEWEL = cdef('JEWEL', { names: ['ビッグジュエル'], traits: ['ビッグジュエル'] }); // PA optional 対象
const OTHERTRAIT = cdef('OTHERTRAIT', { names: ['他探偵'], traits: ['探偵'] });        // PA だが trait 外 decoy
const HAND = cdef('HAND');                                                    // removeFromHand cost fodder
const D1 = cdef('D1');
const D2 = cdef('D2');
const D3 = cdef('D3');
const FIXTURES = [OPPLOW, DECOY9000, JEWEL, OTHERTRAIT, HAND, D1, D2, D3];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  setHuman(null);
  registerCardDef(B07032);
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
});

// ============================================================
// a. cost gate — pay[sleepSelf, removeFromHand] は canPay 直接判定 (canDeclaredAbility は cost を見ない)
// ============================================================
describe('B07032 a1 — cost gate pay[sleepSelf, removeFromHand] (rules/21)', () => {
  const cost = B07032.abilities[0].cost!;
  const mkCtx = () =>
    ({ source: { player: 'self', uid: 'sh', cardId: 'B07032', abilityId: 'a1' }, bindings: {} } as unknown as EffectCtx);

  it('active + 手札1枚以上 → cost 払える', () => {
    const s = base();
    s.players.self.scene = [sc('B07032', 'sh')];
    s.players.self.hand = ['HAND'];
    expect(canPay(s, cost, mkCtx())).toBe(true);
  });

  it('self が sleep → sleepSelf 不可で cost 払えず (宣言不可)', () => {
    const s = base();
    s.players.self.scene = [sc('B07032', 'sh', 'sleep')];
    s.players.self.hand = ['HAND'];
    expect(canPay(s, cost, mkCtx())).toBe(false);
  });

  it('手札が空 → removeFromHand 不可で cost 払えず (宣言不可)', () => {
    const s = base();
    s.players.self.scene = [sc('B07032', 'sh')];
    s.players.self.hand = [];
    expect(canPay(s, cost, mkCtx())).toBe(false);
  });
});

// ============================================================
// b. 成功 declare — cost 支払い + sceneRemove apMax:8000 honor + owner='opp' pin (BUG-174)
// ============================================================
describe('B07032 a1 — 宣言成功: cost + sceneRemove(apMax 8000, side either) opp キャラ除去', () => {
  it('self→sleep / hand-1(remove へ) / AP9000 は候補外 / opp キャラ除去→opp.remove (両陣 side:either)', () => {
    setHuman('self');
    const s = base();
    s.players.self.scene = [sc('B07032', 'sh')];       // 自身 AP8000 (= apMax:8000 の境界、候補になる)
    s.players.self.hand = ['HAND'];
    s.players.opp.scene = [sc('OPPLOW', 'olow'), sc('DECOY9000', 'odec')]; // olow AP5000 / odec AP9000
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'sh', 'a1');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'sceneRemove pick surface').not.toBeNull();
      expect(pick!.atomVerb).toBe('sceneRemove');
      expect(pick!.nMin, '「1枚まで」→ nMin 0 (skip 可)').toBe(0);
      expect(pick!.nMax).toBe(1);
      // apMax:8000 — AP9000 decoy は候補外、境界 AP8000 の自身と AP5000 の opp は候補
      const candIds = pick!.candidates.map((c) => c.cardId);
      expect(candIds, 'AP9000 decoy は apMax:8000 で候補外').not.toContain('DECOY9000');
      expect(candIds, 'side:either → 自陣 AP8000 も候補').toContain('B07032');
      expect(candIds, 'side:either → 相手 AP5000 も候補').toContain('OPPLOW');
      // owner='opp' pin (BUG-174): 相手キャラを除去する
      applyPickAndContinuation(d, pick!, 'olow');
      // 後続の optional は take しない (このケースの検証対象外) → decline
      const opt = _drainPendingEffectOptionalSide();
      if (opt) applyOptionalAndContinuation(d, opt, false);
    });
    // cost 効果
    expect(after.players.self.scene.find((c) => c.uid === 'sh')!.state, 'sleepSelf → self sleep').toBe('sleep');
    expect(after.players.self.hand, 'removeFromHand → hand から 1 枚抜ける').toEqual([]);
    expect(after.players.self.remove, 'リムーブした手札は remove へ').toContain('HAND');
    // sceneRemove: opp キャラを opp.remove へ (BUG-174 owner='opp')
    expect(after.players.opp.scene.map((c) => c.cardId), 'OPPLOW は opp.scene から除去').toEqual(['DECOY9000']);
    expect(after.players.opp.remove, 'OPPLOW は所有者 (opp) の remove へ').toContain('OPPLOW');
    expect(after.players.self.scene.some((c) => c.uid === 'olow'), 'self 側には現れない').toBe(false);
  });
});

// ============================================================
// c. 「1枚まで」= 0 可 — sceneRemove human skip (applyPickSkipAndContinuation run=false)
// ============================================================
describe('B07032 a1 — sceneRemove 0枚 skip (「1枚まで」rules/15)', () => {
  it('sceneRemove を skip → キャラ除去なし / cost は支払済 (self sleep, hand-1)', () => {
    setHuman('self');
    const s = base();
    s.players.self.scene = [sc('B07032', 'sh')];
    s.players.self.hand = ['HAND'];
    s.players.opp.scene = [sc('OPPLOW', 'olow')];
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'sh', 'a1');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'sceneRemove pick surface').not.toBeNull();
      // sequence-origin decline (skipResolvesAtom 無し) → runDeclinedAtom=false (production dispatch と同一)
      applyPickSkipAndContinuation(d, pick!, false);
      const opt = _drainPendingEffectOptionalSide();
      if (opt) applyOptionalAndContinuation(d, opt, false);
    });
    expect(after.players.opp.scene.map((c) => c.cardId), 'skip → OPPLOW は除去されない').toEqual(['OPPLOW']);
    expect(after.players.opp.remove, 'opp.remove 空').toEqual([]);
    // cost はコスト先払いなので支払済
    expect(after.players.self.scene.find((c) => c.uid === 'sh')!.state, 'cost: self sleep').toBe('sleep');
    expect(after.players.self.remove, 'cost: 手札 remove へ').toContain('HAND');
  });
});

// ============================================================
// d/e/f. optional{chain[partnerAreaRemove, draw 2]} — take/decline/gate
// ============================================================
describe('B07032 a1 — optional{partnerAreaRemove[ビッグジュエル] → draw 2}', () => {
  // sceneRemove は共通で skip、optional のみを検証。deck=['D1','D2','D3']、cost で HAND を消費し hand は空。
  function run(paCards: string[], optionalRun: boolean, jewelUid?: string): GameState {
    setHuman('self');
    const s = base();
    s.players.self.scene = [sc('B07032', 'sh')];
    s.players.self.hand = ['HAND'];
    s.players.self.partnerAreaCards = paCards;
    s.players.self.deck = ['D1', 'D2', 'D3'];
    s.players.opp.scene = [sc('OPPLOW', 'olow')];
    return produce(s, (d) => {
      activateDeclaredAbility(d, 'sh', 'a1');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      applyPickSkipAndContinuation(d, pick!, false); // sceneRemove skip (optional に集中)
      const opt = _drainPendingEffectOptionalSide();
      expect(opt, 'optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, opt!, optionalRun);
      if (optionalRun) {
        // take: PA に[ビッグジュエル]候補があれば partnerAreaRemove pick が surface する
        const paPick = _drainPendingEffectPickSide();
        if (paPick) {
          const cand = paPick.candidates.find((c) => c.cardId === (jewelUid ?? 'JEWEL'))!;
          applyPickAndContinuation(d, paPick, cand.uid);
        }
      }
    });
  }

  it('d. take: PA に[ビッグジュエル] → remove へ + カードを2枚引く', () => {
    const after = run(['JEWEL'], true);
    expect(after.players.self.partnerAreaCards, 'JEWEL は PA から除去').toEqual([]);
    expect(after.players.self.remove, 'JEWEL は remove へ').toContain('JEWEL');
    expect(after.players.self.hand, 'draw 2 → deck top 2 枚 (cost で HAND 消費済ゆえ 2 枚ちょうど)').toEqual(['D1', 'D2']);
    expect(after.players.self.deck, 'deck 3→1').toEqual(['D3']);
  });

  it('e. decline: draw なし・PA カード残る', () => {
    const after = run(['JEWEL'], false);
    expect(after.players.self.partnerAreaCards, 'decline → JEWEL 残る').toEqual(['JEWEL']);
    expect(after.players.self.remove.includes('JEWEL'), 'JEWEL は remove へ行かない').toBe(false);
    expect(after.players.self.hand, 'draw なし → hand 空 (cost で HAND 消費済)').toEqual([]);
    expect(after.players.self.deck, 'deck 不変').toEqual(['D1', 'D2', 'D3']);
    expect(_peekPendingEffectPickQueueLength(), 'PA pick は surface しない').toBe(0);
  });

  it('f. take だが PA に[ビッグジュエル]なし (他特徴) → chain gate → draw なし', () => {
    const after = run(['OTHERTRAIT'], true);
    // partnerAreaRemove 候補 0 → chainStepNoApply で chain break → draw 不発
    expect(after.players.self.partnerAreaCards, '他特徴カードは trait 不一致で残る').toEqual(['OTHERTRAIT']);
    expect(after.players.self.remove.includes('OTHERTRAIT'), '除去されない').toBe(false);
    expect(after.players.self.hand, '「そうした場合」gate → draw なし → hand 空').toEqual([]);
    expect(after.players.self.deck, 'deck 不変').toEqual(['D1', 'D2', 'D3']);
    expect(_peekPendingEffectPickQueueLength(), '候補0 → PA pick は surface しない').toBe(0);
  });
});
