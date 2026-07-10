// tests/cards/m3-pa-batch/B08093 — 灰原哀＆シェリー (character / MR / 青・黒 / 少年探偵団・科学者・黒ずくめの組織)
//  手書き probe (engine 実評価で全 novel 句を踏む)
//
// 公式テキスト:
//   a1 【宣言】【ターン1】〚手札から【現場リムーブ時】を持つ【青】か【黒】のキャラを1枚公開する〛：
//      レベル9以下のキャラを1枚まで選び、リムーブする。
//   a2 【相手ターン中】【現場リムーブ時】自分の手札が2枚以下の場合、カードを1枚引く。
//   a3 【宣言】【ターン1】【青】のキャラを1枚まで選び、ターン終了時までAP＋1000する。
//      【黒】のキャラを1枚まで選び、ターン終了時までAP＋1000する。この能力はパートナーエリアでも宣言できる。
//   a4 【カットイン】AP＋2000
//
// novel 句 → engine 実評価:
//   a1 (declared on-scene): cost revealFromHand{keyword 現場リムーブ時 + color[青,黒] + kind character, n1}
//      (no-op reveal, rules/21) → sceneRemove levelMax9。
//   a2 (triggered leave:to-remove selfOnly): condition and[turn opp, handAtMost{self,2}] → draw1。
//      実 emit = mutate.scene.removeToRemove (B08082 a2 同型)。
//   a3 (declared on-partner-area): 2 独立 pick charModifyAP {青}/{黒} side either +1000 (Q&A: 各独立)。
//   a4 (【カットイン】): shape のみ。
//
// production dispatch: activateDeclaredAbility + runAllUntilEmpty、pick=human 経路。owner=opp pin (BUG-174)。
// rules: 13-keywords.md, 14-refresh.md, 15-abilities-effects.md (「〜まで」=0可), 17-icons.md, 18-mr.md, 21-declared-ability-cost.md

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
import { cutIn, canCutIn } from '@/engine/flow/contact';
import { drainAiEffectPicks, applyPickAndContinuation, applyPickSkipAndContinuation, _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import {
  _drainPendingEffectPickSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
  _clearPendingEffectChoiceSide,
} from '@/engine/effect/resolve-picks';
import { sceneChar, makeChar } from '../../helpers/fixtures';
import { B08093 } from '@/cards/ct-p08/B08093';
import type { AbilityDef, CardDef, EffectCtx, GameState, Player, ActionContext } from '@/engine/types';

// 現場リムーブ時 (selfOnly leave:to-remove) を持つ char fixture (B08082 test 同型)
function mkRemoveTrigger(id: string, color: string, kind: 'character' | 'event' = 'character'): CardDef {
  const ab: AbilityDef = { id: 'r', type: 'triggered', scope: 'on-scene', trigger: { hook: 'leave:to-remove', selfOnly: true }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } } as unknown as AbilityDef;
  return { id, no: `9/${id}`, kind, names: [id], colors: [color], level: 3, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [ab], ruleRefs: [] } as unknown as CardDef;
}
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const REV_BLUE = 'DEC_B08093_REVB';   // 青 + 現場リムーブ時 → cost valid
const REV_BLACK = 'DEC_B08093_REVK';  // 黒 + 現場リムーブ時 → cost valid
const REV_YELLOW = 'DEC_B08093_REVY'; // 黄 + 現場リムーブ時 → color decoy
const PLAIN_BLUE = 'DEC_B08093_PB';   // 青 (現場リムーブ時なし) → keyword decoy
const V9 = 'DEC_B08093_V9';           // level9 = 除去可
const V10 = 'DEC_B08093_V10';         // level10 = decoy
const BLUEC = 'DEC_B08093_BLUEC';     // a3 青 pick
const BLACKC = 'DEC_B08093_BLACKC';   // a3 黒 pick
const YEL = 'DEC_B08093_YEL';         // a3 色 decoy
const D1 = 'DEC_B08093_D1';

const setHuman = (s: Player | null) => { (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = s; };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectChoiceSide();
  setHuman(null);
  registerCardDef(B08093);
  registerCardDef(mkRemoveTrigger(REV_BLUE, '青'));
  registerCardDef(mkRemoveTrigger(REV_BLACK, '黒'));
  registerCardDef(mkRemoveTrigger(REV_YELLOW, '黄'));
  registerCardDef(ch(PLAIN_BLUE, { colors: ['青'] }));
  registerCardDef(ch(V9, { level: 9 }));
  registerCardDef(ch(V10, { level: 10 }));
  registerCardDef(ch(BLUEC, { colors: ['青'], ap: 3000 }));
  registerCardDef(ch(BLACKC, { colors: ['黒'], ap: 3000 }));
  registerCardDef(ch(YEL, { colors: ['黄'], ap: 3000 }));
  registerCardDef(ch(D1));
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
describe('B08093 — shape', () => {
  it('青黒/Lv9/AP8000/LP2/MR + a1 declared(revealFromHand) / a2 triggered(leave) / a3 declared(on-partner-area) / a4 cutin', () => {
    expect(B08093.no).toBe('0929/B08093');
    expect(B08093.colors).toEqual(['青', '黒']);
    expect(B08093.traits).toEqual(['少年探偵団', '科学者', '黒ずくめの組織']);
    expect(B08093.rarity).toBe('MR');
    expect(B08093.names).toEqual(['灰原哀＆シェリー', '灰原哀', 'シェリー']);
    const [a1, a2, a3, a4] = B08093.abilities;
    expect(a1).toMatchObject({ id: 'a1', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 } });
    expect(a1.cost).toMatchObject({ kind: 'revealFromHand' });
    expect((a1.cost as { target: { query: { filter: unknown } } }).target.query.filter).toMatchObject({ keyword: '現場リムーブ時', color: ['青', '黒'], kind: 'character' });
    expect(a2).toMatchObject({ id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'leave:to-remove', selfOnly: true } });
    expect(a2.condition).toMatchObject({ kind: 'and', cs: [{ kind: 'turn', player: 'opp' }, { kind: 'handAtMost', player: 'self', n: 2 }] });
    expect(a3).toMatchObject({ id: 'a3', type: 'declared', scope: 'on-partner-area', limit: { kind: 'turn', n: 1 } });
    expect(a4).toMatchObject({ id: 'a4', type: 'triggered', trigger: { hook: 'effect:declared' } });
  });
});

// ============================================================
// a1 — cost revealFromHand{現場リムーブ時 + 青/黒} → sceneRemove levelMax9
// ============================================================
describe('B08093 a1 — 手札公開 cost + レベル9以下1枚まで除去', () => {
  function board(): GameState {
    const s = base();
    s.players.self.scene = [sceneChar('B08093', 'sh')];
    s.players.self.hand = [REV_BLUE];
    s.players.opp.scene = [sceneChar(V9, 'v9'), sceneChar(V10, 'v10')];
    return s;
  }

  it('S1 happy: 青+現場リムーブ時 手札公開 → level9 除去 (公開カードは手札に残る) / level10 decoy', () => {
    setHuman('self');
    const s = board();
    expect(canDeclaredAbility(s, 'sh', 'a1')).toBe(true);
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'sh', 'a1');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'sceneRemove pick surface').not.toBeNull();
      expect(pick!.nMin).toBe(0);
      const cand = pick!.candidates.map((c) => c.cardId);
      expect(cand).toContain(V9);
      expect(cand, 'level10 decoy').not.toContain(V10);
      applyPickAndContinuation(d, pick!, 'v9');
    });
    expect(after.players.opp.scene.some((c) => c.uid === 'v9'), 'level9 除去').toBe(false);
    expect(after.players.self.hand, '公開 cost はカードを手札に残す (rules/21 no-op reveal)').toEqual([REV_BLUE]);
    expect(canDeclaredAbility(after, 'sh', 'a1'), '【ターン1】消費').toBe(false);
  });

  it('S2 cost gate: 色不一致(黄+現場リムーブ時) / keyword不一致(青のみ) は候補外 → canPay=false', () => {
    const cost = B08093.abilities.find((a) => a.id === 'a1')!.cost!;
    const mkCtx = (): EffectCtx => ({ source: { player: 'self', uid: 'sh', cardId: 'B08093', abilityId: 'a1', area: 'scene' }, bindings: {} } as EffectCtx);
    const yellow = base();
    yellow.players.self.scene = [sceneChar('B08093', 'sh')];
    yellow.players.self.hand = [REV_YELLOW];
    expect(canPay(yellow, cost, mkCtx()), '黄+現場リムーブ時 → color 不一致 → 不可').toBe(false);
    const plain = base();
    plain.players.self.scene = [sceneChar('B08093', 'sh')];
    plain.players.self.hand = [PLAIN_BLUE];
    expect(canPay(plain, cost, mkCtx()), '青だが現場リムーブ時なし → 不可').toBe(false);
    const ok = base();
    ok.players.self.scene = [sceneChar('B08093', 'sh')];
    ok.players.self.hand = [REV_BLACK];
    expect(canPay(ok, cost, mkCtx()), '黒+現場リムーブ時 → 可').toBe(true);
  });

  it('S3 owner=opp pin (BUG-174): opp 所有 a1 → self 現場を除去 (反転しない)', () => {
    setHuman('opp');
    const s = base('opp');
    s.players.opp.scene = [sceneChar('B08093', 'osh')];
    s.players.opp.hand = [REV_BLUE];
    s.players.self.scene = [sceneChar(V9, 'v9')];
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'osh', 'a1');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      const cand = pick!.candidates.find((c) => c.cardId === V9)!;
      applyPickAndContinuation(d, pick!, cand.uid);
    });
    expect(after.players.self.remove, 'self 側 v9 は所有者(self) remove へ').toContain(V9);
  });
});

// ============================================================
// a2 — 【相手ターン中】【現場リムーブ時】手札≤2 → draw1
// ============================================================
describe('B08093 a2 — leave:to-remove + turn opp + handAtMost{2} → draw1', () => {
  function board(owner: Player, turnPlayer: Player, handN: number): { s: GameState; uid: string } {
    const s = base(turnPlayer);
    const c = mutate.scene.enter(s, owner, 'B08093', {}); // enter() は emit しない → 他能力非発火
    s.players[owner].hand = Array.from({ length: handN }, () => PLAIN_BLUE);
    s.players[owner].deck = [D1, 'TAIL'];
    return { s, uid: c.uid };
  }
  function fire(b: { s: GameState; uid: string }): GameState {
    return produce(b.s, (d) => {
      mutate.scene.removeToRemove(d, b.uid, 'effect');
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
  }

  it('S4 相手ターン中 + 手札2枚 → 除去で draw1', () => {
    const b = board('self', 'opp', 2);
    const after = fire(b);
    expect(after.players.self.hand.includes(D1), 'draw1 (deck top D1)').toBe(true);
  });

  it('S5 off: 自分ターン中 → turn:opp 不成立 → draw しない', () => {
    const b = board('self', 'self', 2);
    const after = fire(b);
    expect(after.players.self.hand.includes(D1), '自ターン → 不発').toBe(false);
  });

  it('S6 off: 相手ターン中でも手札3枚 → handAtMost{2} 不成立 → draw しない', () => {
    const b = board('self', 'opp', 3);
    const after = fire(b);
    expect(after.players.self.hand.includes(D1), '手札3枚 → 不発').toBe(false);
  });
});

// ============================================================
// a3 — PA-MR declared: 青1枚まで + 黒1枚まで それぞれ AP+1000 (2 独立 pick)
// ============================================================
describe('B08093 a3 — PA 宣言: 青キャラ+1000 と 黒キャラ+1000 (独立 pick)', () => {
  function paBase(side: Player = 'self'): GameState {
    const s = base(side);
    s.players[side].partnerAreaMR = makeChar({ cardId: 'B08093', uid: `partnerMR:${side}` });
    s.players[side].scene = [sceneChar(BLUEC, 'b'), sceneChar(BLACKC, 'k'), sceneChar(YEL, 'y')];
    return s;
  }

  it('S7 happy: 青pick→b AP+1000 / 黒pick→k AP+1000 / 黄は両 pick とも候補外', () => {
    setHuman('self');
    const s = paBase();
    expect(canDeclaredAbility(s, 'partnerMR:self', 'a3')).toBe(true);
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:self', 'a3');
      runAllUntilEmpty(d);
      // pick1: 青
      const p1 = _drainPendingEffectPickSide();
      expect(p1, '青 pick surface').not.toBeNull();
      expect(p1!.candidates.map((c) => c.cardId), '青候補').toContain(BLUEC);
      expect(p1!.candidates.map((c) => c.cardId), '黄は青候補外').not.toContain(YEL);
      applyPickAndContinuation(d, p1!, 'b');
      // pick2: 黒
      const p2 = _drainPendingEffectPickSide();
      expect(p2, '黒 pick surface').not.toBeNull();
      expect(p2!.candidates.map((c) => c.cardId), '黒候補').toContain(BLACKC);
      applyPickAndContinuation(d, p2!, 'k');
    });
    expect(engine.read.char.ap(after, 'b'), '青 AP 3000+1000').toBe(4000);
    expect(engine.read.char.ap(after, 'k'), '黒 AP 3000+1000').toBe(4000);
    expect(engine.read.char.ap(after, 'y'), '黄 は不変').toBe(3000);
    expect(canDeclaredAbility(after, 'partnerMR:self', 'a3'), '【ターン1】消費').toBe(false);
  });

  it('S8 「1枚まで」: 青 pick を 0枚辞退 → 青不変、黒のみ +1000 (各 pick 独立)', () => {
    setHuman('self');
    const s = paBase();
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:self', 'a3');
      runAllUntilEmpty(d);
      const p1 = _drainPendingEffectPickSide();
      applyPickSkipAndContinuation(d, p1!, false); // 青 0枚辞退
      const p2 = _drainPendingEffectPickSide();
      expect(p2, '黒 pick は独立に surface').not.toBeNull();
      applyPickAndContinuation(d, p2!, 'k');
    });
    expect(engine.read.char.ap(after, 'b'), '青辞退 → 不変').toBe(3000);
    expect(engine.read.char.ap(after, 'k'), '黒 +1000').toBe(4000);
  });

  it('S9 owner=opp pin (BUG-174): opp PA-MR で a3 → opp 現場 青/黒 が +1000', () => {
    setHuman('opp');
    const s = paBase('opp');
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:opp', 'a3');
      runAllUntilEmpty(d);
      const p1 = _drainPendingEffectPickSide();
      expect(p1!.player, 'chooser=opp').toBe('opp');
      applyPickAndContinuation(d, p1!, 'b');
      const p2 = _drainPendingEffectPickSide();
      applyPickAndContinuation(d, p2!, 'k');
    });
    expect(engine.read.char.ap(after, 'b')).toBe(4000);
    expect(engine.read.char.ap(after, 'k')).toBe(4000);
  });
});

// ============================================================
// lens 追補 pin (意味等価 lens 2026-07-10: cutin 機能 probe 漏れ回収)
// ============================================================
describe('B08093 【カットイン】AP+2000 — cutIn production 経路 (lens 追補)', () => {
  function mkAx(attackerUid: string, defUid: string): ActionContext {
    return {
      id: 'ax', byUid: attackerUid, byPlayer: 'self', target: { kind: 'char', uid: defUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: attackerUid, aAP: 3000, bUid: defUid, bAP: 3000 }, contactImmune: false,
    };
  }
  it('コンタクト中に手札から cutIn → 自コンタクトキャラ(攻撃者) AP+2000 → 使用後 remove', () => {
    let atk = '';
    const after = produce(base(), (d) => {
      atk = mutate.scene.enter(d, 'self', PLAIN_BLUE, {}).uid;
      const defUid = mutate.scene.enter(d, 'opp', REV_BLUE, {}).uid;
      d.players.self.hand = ['B08093'];
      const ax = mkAx(atk, defUid);
      expect(canCutIn(d, ax, 'self', 'B08093'), '手札の B08093 は cutin 可').toBe(true);
      cutIn(d, ax, 'self', 'B08093');
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, atk), '3000+2000').toBe(5000);
    expect(after.players.self.remove.includes('B08093'), '使用後 remove へ').toBe(true);
  });
});

// lens 追補: a3 自己 2 回選択 (公式 Q&A: 現場使用時、自身(青黒2色)を青1枚+黒1枚の両方で選び AP+2000 可)
describe('B08093 a3 — 自己 2 回選択 Q&A (lens 追補)', () => {
  it('現場の B08093 (青黒) を両 pick で選択 → AP 合計 +2000', () => {
    setHuman('self');
    const s = base();
    s.players.self.scene = [sceneChar('B08093', 'sh')];
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'sh', 'a3');
      runAllUntilEmpty(d);
      const p1 = _drainPendingEffectPickSide();
      expect(p1, '青 pick surface').not.toBeNull();
      expect(p1!.candidates.map((c) => c.uid), '青黒の自身が青候補').toContain('sh');
      applyPickAndContinuation(d, p1!, 'sh');
      const p2 = _drainPendingEffectPickSide();
      expect(p2, '黒 pick surface').not.toBeNull();
      expect(p2!.candidates.map((c) => c.uid), '青黒の自身が黒候補').toContain('sh');
      applyPickAndContinuation(d, p2!, 'sh');
    });
    const baseAp = B08093.ap!;
    expect(engine.read.char.ap(after, 'sh'), '青+1000 と 黒+1000 の両方 = +2000').toBe(baseAp + 2000);
  });
});
