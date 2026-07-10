// tests/cards/m1-megasweep/B07065.manual — 世良真純＆メアリー (character / MR / 赤 / 探偵・高校生・赤井家)
//  手書き probe (engine 実評価で全 novel 句を踏む)
//
// 公式テキスト:
//   a1 【パートナー赤】【宣言】【ターン1】〚手札を1枚リムーブする〛：キャラを1枚まで選び、リムーブする。
//   a2 【宣言】【ターン1】カードを1枚引く。この能力は自分の手札が2枚以下の場合に宣言できる。
//      この能力はパートナーエリアでも宣言できる。
//   a3 【カットイン】AP＋2000
//
// novel 句 → engine 実評価:
//   a1 (scope on-scene declared): condition partnerColor{赤} (canDeclaredAbility 実評価) /
//      cost removeFromHand pick n1 (rules/21 全部行えなければ使用不可、pay で hand→remove) /
//      effect sceneRemove{player:self, max:1, side:either} = 「キャラを1枚まで選び、リムーブ」
//      (nMin:0 = 0枚可 rules/15 / side:either = 両陣候補 / filter なし = 任意キャラ)。
//   a2 (scope on-partner-area declared, uid='partnerMR:self'): condition handAtMost{self,2}
//      (自分の手札2枚以下でのみ宣言可) / effect draw n1 / limit turn1 (【ターン1】)。
//      パートナーエリア常駐 MR の宣言能力 (rules/18/21:10)。
//   a3 (【カットイン】= triggered on-hand effect:declared): charModifyAP +2000 → $contact.byUid
//      (コンタクト中の自分のキャラ = 攻撃者) を cutIn() production 経路で実 emit。
//
// production dispatch:
//   a1/a2 = activateDeclaredAbility(uid, abilId) + runAllUntilEmpty (BUG-171)。
//     a1 sceneRemove pick は human 経路 (_drainPendingEffectPickSide → applyPick / applyPickSkip)。
//     cost removeFromHand は pickCandidates 先頭 n 枚を自動消費 (surface しない) → 手札1枚固定で決定論化。
//   a3 = canCutIn/cutIn (flow/contact) の実 cutin dispatch。
//   BUG-174 owner='opp' pin: a1 を opp 所有で 1 scenario (相手キャラ除去 → 所有者 remove、反転しない)。
//
// rules: 09-cutin-disguise.md, 15-abilities-effects.md (「〜まで」=0可), 17-icons.md
//        (【パートナー(色)】/【ターン1】条件未達=能力を持たない扱い), 18-mr.md, 21-declared-ability-cost.md,
//        22-qa-action-contact.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canPay } from '@/engine/cost/index';
import {
  _drainPendingEffectPickSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/resolve-picks';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { cutIn, canCutIn } from '@/engine/flow/contact';
import { sceneChar, makeChar } from '../../helpers/fixtures';
import { B07065 } from '@/cards/ct-p07/B07065';
import type { CardDef, GameState, EffectCtx, ActionContext, Player } from '@/engine/types';

// --- fixtures ---
function partner(id: string, color: string): CardDef {
  return { id, no: `9/${id}`, kind: 'partner', names: [id], colors: [color], level: 0, ap: 0, lp: 2, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const P_RED = partner('PRED', '赤');
const P_BLUE = partner('PBLUE', '青');
const VICTIM = 'DEC_B07065_VICTIM'; // sceneRemove 対象 (相手キャラ)
const SELFCH = 'DEC_B07065_SELFCH'; // side:either 証明 (自陣キャラ)
const HAND = 'DEC_B07065_HAND';     // removeFromHand cost fodder
const H2 = 'DEC_B07065_H2';         // a2 手札枚数用
const D1 = 'DEC_B07065_D1';         // a2 draw 対象
const ATK = 'DEC_B07065_ATK';       // a3 攻撃者
const DEF = 'DEC_B07065_DEF';       // a3 対象

const setHuman = (s: Player | null) => { (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = s; };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  setHuman(null);
  registerCardDef(B07065);
  registerCardDef(P_RED); registerCardDef(P_BLUE);
  for (const d of [VICTIM, SELFCH, HAND, H2, D1, ATK, DEF]) registerCardDef(ch(d));
  registerTriggeredListener();
});

function base(turnPlayer: Player = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  return s;
}

// ============================================================
// shape
// ============================================================
describe('B07065 世良真純＆メアリー — shape', () => {
  it('赤/Lv9/AP8000/LP2/MR/探偵・高校生・赤井家 + a1 declared(on-scene) / a2 declared(on-partner-area) / a3 cutin', () => {
    expect(B07065.id).toBe('B07065');
    expect(B07065.no).toBe('0794/B07065');
    expect(B07065.colors).toEqual(['赤']);
    expect(B07065.level).toBe(9);
    expect(B07065.ap).toBe(8000);
    expect(B07065.lp).toBe(2);
    expect(B07065.rarity).toBe('MR');
    expect(B07065.traits).toEqual(['探偵', '高校生', '赤井家']);

    const [a1, a2, a3] = B07065.abilities;
    expect(a1).toMatchObject({ id: 'a1', type: 'declared', scope: 'on-scene', condition: { kind: 'partnerColor', color: '赤' }, limit: { kind: 'turn', n: 1 } });
    expect(a1.cost).toMatchObject({ kind: 'removeFromHand', n: 1 });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either' } });
    expect(a2).toMatchObject({ id: 'a2', type: 'declared', scope: 'on-partner-area', condition: { kind: 'handAtMost', player: 'self', n: 2 }, limit: { kind: 'turn', n: 1 } });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } });
    expect(a3).toMatchObject({ id: 'a3', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true } });
    expect(a3.effect).toMatchObject({ kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, scope: 'contact', uid: '$contact.byUid' } });
  });
});

// ============================================================
// a1 — 【パートナー赤】declared / removeFromHand cost / sceneRemove 1枚まで
// ============================================================
describe('B07065 a1 — partnerColor{赤} gate + removeFromHand cost + sceneRemove(side either, 1枚まで)', () => {
  it('S1 happy: partner赤 → 宣言可 / cost 手札1→remove / sceneRemove で相手キャラ除去 (両陣候補) → opp.remove', () => {
    setHuman('self');
    const s = base();
    s.players.self.partner.cardId = 'PRED';
    s.players.self.scene = [sceneChar('B07065', 'sh'), sceneChar(SELFCH, 'selfc')]; // 自陣にも候補 (side:either 証明)
    s.players.self.hand = [HAND];
    s.players.opp.scene = [sceneChar(VICTIM, 'v')];
    expect(canDeclaredAbility(s, 'sh', 'a1'), '赤パートナー → 宣言可').toBe(true);

    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'sh', 'a1');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'sceneRemove pick surface').not.toBeNull();
      expect(pick!.atomVerb).toBe('sceneRemove');
      expect(pick!.nMin, '「1枚まで」→ nMin 0').toBe(0);
      expect(pick!.nMax).toBe(1);
      const candIds = pick!.candidates.map((c) => c.cardId);
      expect(candIds, 'side:either → 自陣キャラも候補').toContain(SELFCH);
      expect(candIds, 'side:either → 相手キャラも候補').toContain(VICTIM);
      applyPickAndContinuation(d, pick!, 'v'); // 相手キャラを除去
    });
    // cost: 手札1枚 → remove
    expect(after.players.self.hand, 'removeFromHand → 手札から抜ける').toEqual([]);
    expect(after.players.self.remove, 'リムーブした手札は所有者 remove へ').toContain(HAND);
    // sceneRemove: 相手キャラを opp.remove へ
    expect(after.players.opp.scene.some((c) => c.uid === 'v'), 'VICTIM は opp.scene から除去').toBe(false);
    expect(after.players.opp.remove, 'VICTIM は所有者(opp) remove へ').toContain(VICTIM);
    expect(after.players.self.remove.includes(VICTIM), 'VICTIM は self 側 remove には入らない').toBe(false);
  });

  it('S2 gate: partner青 → canDeclaredAbility=false (条件未達=持たない扱い) / 空手札 → canPay=false', () => {
    const cost = B07065.abilities[0].cost!;
    const mkCtx = () => ({ source: { player: 'self', uid: 'sh', cardId: 'B07065', abilityId: 'a1' }, bindings: {} } as unknown as EffectCtx);

    // partner青 → partnerColor{赤} 不成立
    const blue = base();
    blue.players.self.partner.cardId = 'PBLUE';
    blue.players.self.scene = [sceneChar('B07065', 'sh')];
    blue.players.self.hand = [HAND];
    expect(canDeclaredAbility(blue, 'sh', 'a1'), '青パートナー → 宣言不可').toBe(false);

    // partner赤 + 手札あり → 宣言可 & cost 払える
    const ok = base();
    ok.players.self.partner.cardId = 'PRED';
    ok.players.self.scene = [sceneChar('B07065', 'sh')];
    ok.players.self.hand = [HAND];
    expect(canDeclaredAbility(ok, 'sh', 'a1')).toBe(true);
    expect(canPay(ok, cost, mkCtx()), '手札1枚 → cost 払える').toBe(true);

    // partner赤 + 手札空 → removeFromHand 不可 (rules/21 全部行えなければ使用不可)
    const empty = base();
    empty.players.self.partner.cardId = 'PRED';
    empty.players.self.scene = [sceneChar('B07065', 'sh')];
    empty.players.self.hand = [];
    expect(canPay(empty, cost, mkCtx()), '空手札 → cost 払えず').toBe(false);
  });

  it('S3 「1枚まで」= 0 選択: sceneRemove skip → キャラ除去なし / cost は支払済', () => {
    setHuman('self');
    const s = base();
    s.players.self.partner.cardId = 'PRED';
    s.players.self.scene = [sceneChar('B07065', 'sh')];
    s.players.self.hand = [HAND];
    s.players.opp.scene = [sceneChar(VICTIM, 'v')];
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'sh', 'a1');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'sceneRemove pick surface').not.toBeNull();
      applyPickSkipAndContinuation(d, pick!, false); // 0枚辞退 (sequence-origin と同一 run=false)
    });
    expect(after.players.opp.scene.map((c) => c.cardId), 'skip → VICTIM 残る').toEqual([VICTIM]);
    expect(after.players.opp.remove, 'opp.remove 空').toEqual([]);
    expect(after.players.self.remove, 'cost は先払い → 手札 remove へ').toContain(HAND);
    expect(after.players.self.hand, 'cost で手札消費').toEqual([]);
  });

  it('S4 owner=opp pin (BUG-174): opp 所有 B07065 が自陣(self)キャラを除去 → self.remove、反転しない', () => {
    setHuman('opp');
    const s = base('opp'); // opp ターン
    s.players.opp.partner.cardId = 'PRED';
    s.players.opp.scene = [sceneChar('B07065', 'osh')];
    s.players.opp.hand = [HAND];
    s.players.self.scene = [sceneChar(VICTIM, 'v')]; // 除去される self 側キャラ
    expect(canDeclaredAbility(s, 'osh', 'a1')).toBe(true);
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'osh', 'a1');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick!.player, 'chooser = opp').toBe('opp');
      const cand = pick!.candidates.find((c) => c.cardId === VICTIM)!;
      applyPickAndContinuation(d, pick!, cand.uid);
    });
    expect(after.players.self.scene.some((c) => c.uid === 'v'), 'self 側 VICTIM は除去').toBe(false);
    expect(after.players.self.remove, 'VICTIM は所有者(self) remove へ (反転しない)').toContain(VICTIM);
    expect(after.players.opp.hand, 'opp の cost 手札消費').toEqual([]);
    expect(after.players.opp.remove, 'opp の手札は opp.remove へ').toContain(HAND);
  });
});

// ============================================================
// a2 — PA-MR declared: handAtMost{self,2} gate + draw1 + 【ターン1】
// ============================================================
describe('B07065 a2 — handAtMost{self≤2} gate + draw1 (パートナーエリア宣言, rules/18)', () => {
  function paBase(handN: number, turnPlayer: Player = 'self', side: Player = 'self'): GameState {
    const s = base(turnPlayer);
    const p = s.players[side];
    p.partnerAreaMR = makeChar({ cardId: 'B07065', uid: `partnerMR:${side}` });
    p.hand = Array.from({ length: handN }, (_, i) => (i === 0 ? HAND : H2)); // 枚数のみ意味あり
    p.deck = [D1, 'TAIL'];
    return s;
  }

  it('S5 手札2枚 → 宣言可 → draw1 (deck top → 手札) / 宣言後【ターン1】で2回目不可', () => {
    const s = paBase(2);
    expect(canDeclaredAbility(s, 'partnerMR:self', 'a2'), '手札2枚 (≤2) → 宣言可').toBe(true);
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:self', 'a2');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.includes(D1), 'draw1 → deck top D1 が手札へ').toBe(true);
    expect(after.players.self.hand.length, '手札 2→3').toBe(3);
    expect(after.players.self.deck, 'deck 先頭 D1 が抜ける').toEqual(['TAIL']);
    expect(canDeclaredAbility(after, 'partnerMR:self', 'a2'), '【ターン1】→ 同ターン2回目は宣言不可').toBe(false);
  });

  it('S6 off-variant: 手札3枚 → handAtMost{2} 不成立 → 宣言不可 (2枚以下でのみ宣言可)', () => {
    expect(canDeclaredAbility(paBase(3), 'partnerMR:self', 'a2'), '手札3枚 → 宣言不可').toBe(false);
    expect(canDeclaredAbility(paBase(0), 'partnerMR:self', 'a2'), '手札0枚 → 宣言可').toBe(true);
  });

  it('S7 owner=opp pin (BUG-174): opp PA-MR が opp 手札2枚で宣言 → opp が draw (自分側 draw しない)', () => {
    const s = paBase(2, 'opp', 'opp');
    expect(canDeclaredAbility(s, 'partnerMR:opp', 'a2')).toBe(true);
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:opp', 'a2');
      runAllUntilEmpty(d);
    });
    expect(after.players.opp.hand.includes(D1), 'opp が draw').toBe(true);
    expect(after.players.self.hand.length, '自分側は draw しない').toBe(0);
  });
});

// ============================================================
// a3 — 【カットイン】AP＋2000 (cutIn production 経路 / $contact.byUid = 攻撃者)
// ============================================================
describe('B07065 a3 — 【カットイン】AP+2000 → $contact.byUid', () => {
  function mkAx(attackerUid: string, defUid: string): ActionContext {
    return {
      id: 'ax', byUid: attackerUid, byPlayer: 'self', target: { kind: 'char', uid: defUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: attackerUid, aAP: 3000, bUid: defUid, bAP: 3000 }, contactImmune: false,
    };
  }

  it('S8 コンタクト中に手札から cutIn → 自コンタクトキャラ(攻撃者) AP+2000', () => {
    let atk = '';
    let def = '';
    const after = produce(base(), (d) => {
      atk = mutate.scene.enter(d, 'self', ATK, {}).uid;
      def = mutate.scene.enter(d, 'opp', DEF, {}).uid;
      d.players.self.hand = ['B07065'];
      const ax = mkAx(atk, def);
      expect(canCutIn(d, ax, 'self', 'B07065'), '手札の B07065 は cutin 可').toBe(true);
      cutIn(d, ax, 'self', 'B07065');
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, atk), 'ATK 3000 + cutin 2000 = 5000').toBe(5000);
    expect(after.players.self.remove.includes('B07065'), 'cutin 使用後 B07065 は remove へ').toBe(true);
  });
});
