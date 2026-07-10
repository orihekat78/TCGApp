// tests/cards/m3-pa-batch/B06037 — 服部平次＆沖田総司 (character / MR / 緑 / 探偵・高校生)
//  手書き probe (engine 実評価で全 novel 句を踏む)
//
// 公式テキスト:
//   a1 【自分ターン中】【ターン1】自分の現場にこのキャラ以外の〚特徴［高校生］〛のキャラが登場したとき、
//      AP8000以下のキャラを1枚まで選び、リムーブする。
//   a2 【宣言】【ターン1】〚手札を1枚リムーブする〛：自分の現場にいるキャラを1枚まで選び、ターン終了時まで
//      AP＋1000し、「相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。
//      この能力はパートナーエリアでも宣言できる。
//   a3 【カットイン】AP＋2000
//
// novel 句 → engine 実評価:
//   a1 (triggered on-scene, hook enter observer): matcher triggerCharMatches{side:self,trait:高校生,
//      excludeSource} + condition turn:self (【自分ターン中】) + limit turn1 → sceneRemove apMax8000。
//      実 emit 経路 = mutate.scene.enter + event.emit('enter') → triggered listener (B05027 a2 同型)。
//   a2 (declared on-partner-area, uid='partnerMR:self'): cost removeFromHand n1 (任意手札) /
//      charModifyAP 短縮形 side:self 1枚まで +1000 (bind $picked) → charSetTurnEffect actionTargetsActive。
//   a3 (【カットイン】): $contact.byUid +2000 (shape のみ、B07065/B06003 同型で cutin dispatch 済)。
//
// production dispatch: a2 = activateDeclaredAbility + runAllUntilEmpty (BUG-171)、pick は human 経路
//   (_drainPendingEffectPickSide + applyPickAndContinuation, setHuman('self'))。owner=opp pin (BUG-174)。
//
// rules: 07-action-flow.md, 15-abilities-effects.md (「〜まで」=0可), 17-icons.md, 18-mr.md, 21-declared-ability-cost.md

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
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import {
  _drainPendingEffectPickSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
  _clearPendingEffectChoiceSide,
} from '@/engine/effect/resolve-picks';
import { sceneChar, makeChar } from '../../helpers/fixtures';
import { B06037 } from '@/cards/ct-p06/B06037';
import type { CardDef, EffectCtx, GameState, Player, ActionContext } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const HS = 'DEC_B06037_HS';       // 特徴[高校生] 登場キャラ (a1 トリガ)
const NOTHS = 'DEC_B06037_NOTHS'; // 非高校生 (a1 off-variant)
const V8000 = 'DEC_B06037_V8000'; // AP8000 = 除去可 (apMax8000 境界内)
const V9000 = 'DEC_B06037_V9000'; // AP9000 = decoy (apMax 超過)
const HAND = 'DEC_B06037_HAND';   // a2 cost fodder
const SELFT = 'DEC_B06037_SELFT'; // a2 自現場 pick 対象

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
  registerCardDef(B06037);
  registerCardDef(ch(HS, { traits: ['高校生'] }));
  registerCardDef(ch(NOTHS, { traits: ['刑事'] }));
  registerCardDef(ch(V8000, { ap: 8000 }));
  registerCardDef(ch(V9000, { ap: 9000 }));
  registerCardDef(ch(HAND));
  registerCardDef(ch(SELFT));
  registerTriggeredListener();
});

function base(turnPlayer: Player = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  return s;
}

// enter 実 emit 経路 (B05027 a2 同型)。emit 後の sceneRemove pick は呼び出し側で human 解決する。
function emitEnter(d: GameState, side: Player, cardId: string, ord: number): void {
  const c = mutate.scene.enter(d, side, cardId, {});
  event.emit(d, 'enter', { uid: c.uid, player: side, enterOrder: ord, enterOrderThisTurn: ord }, { player: side, cardId, uid: c.uid });
  runAllUntilEmpty(d);
}

// ============================================================
// shape
// ============================================================
describe('B06037 — shape', () => {
  it('緑/Lv9/AP8000/LP2/MR/探偵・高校生 + a1 triggered(enter observer) / a2 declared(on-partner-area) / a3 cutin', () => {
    expect(B06037.id).toBe('B06037');
    expect(B06037.no).toBe('0660/B06037');
    expect(B06037.colors).toEqual(['緑']);
    expect(B06037.level).toBe(9);
    expect(B06037.ap).toBe(8000);
    expect(B06037.lp).toBe(2);
    expect(B06037.rarity).toBe('MR');
    expect(B06037.names).toEqual(['服部平次＆沖田総司', '服部平次', '沖田総司']);
    const [a1, a2, a3] = B06037.abilities;
    expect(a1).toMatchObject({ id: 'a1', type: 'triggered', scope: 'on-scene', condition: { kind: 'turn', player: 'self' }, limit: { kind: 'turn', n: 1 } });
    expect(a1.trigger).toMatchObject({ hook: 'enter', matcherCondition: { kind: 'triggerCharMatches', side: 'self', excludeSource: true, filter: { trait: '高校生', kind: 'character' } } });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'sceneRemove', args: { max: 1, side: 'either', filter: { apMax: 8000 } } });
    expect(a2).toMatchObject({ id: 'a2', type: 'declared', scope: 'on-partner-area', limit: { kind: 'turn', n: 1 } });
    expect(a2.cost).toMatchObject({ kind: 'removeFromHand', n: 1 });
    expect(a3).toMatchObject({ id: 'a3', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared' } });
    expect(a3.effect).toMatchObject({ kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } });
  });
});

// ============================================================
// a1 — 【自分ターン中】enter observer (高校生, excludeSource) → sceneRemove apMax8000
// ============================================================
describe('B06037 a1 — [高校生] 登場時 AP8000以下を除去 (自分ターン中 / ターン1)', () => {
  function board(turnPlayer: Player = 'self'): GameState {
    const s = base(turnPlayer);
    s.players.self.scene = [sceneChar('B06037', 'sh')]; // observer 本体
    s.players.opp.scene = [sceneChar(V8000, 'v8'), sceneChar(V9000, 'v9')];
    return s;
  }

  it('S1 高校生 登場 → sceneRemove pick surface → AP8000 除去 / AP9000 は候補外(decoy)', () => {
    setHuman('self');
    const after = produce(board(), (d) => {
      emitEnter(d, 'self', HS, 2);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'a1 発火 → sceneRemove pick surface').not.toBeNull();
      expect(pick!.nMin, '「1枚まで」→ 0 可').toBe(0);
      const cand = pick!.candidates.map((c) => c.cardId);
      expect(cand, 'AP8000 は候補').toContain(V8000);
      expect(cand, 'AP9000(>8000) は decoy → 候補外').not.toContain(V9000);
      applyPickAndContinuation(d, pick!, 'v8');
    });
    expect(after.players.opp.scene.some((c) => c.uid === 'v8'), 'AP8000 は除去').toBe(false);
    expect(after.players.opp.scene.some((c) => c.uid === 'v9'), 'AP9000 は残る').toBe(true);
  });

  it('S2 off: 相手ターン中は 自分ターン中 condition 不成立 → 不発 (pick surface しない)', () => {
    setHuman('self');
    produce(board('opp'), (d) => {
      emitEnter(d, 'self', HS, 2);
      expect(_drainPendingEffectPickSide(), '相手ターン → a1 不発').toBeNull();
    });
  });

  it('S3 off: 非高校生 登場では matcher(trait 高校生) 不一致 → 不発', () => {
    setHuman('self');
    produce(board(), (d) => {
      emitEnter(d, 'self', NOTHS, 2);
      expect(_drainPendingEffectPickSide(), '非高校生 → a1 不発').toBeNull();
    });
  });

  it('S4 limit turn1: 同ターン2回目の高校生登場では再発動しない (pick surface しない)', () => {
    setHuman('self');
    const s1 = produce(board(), (d) => {
      emitEnter(d, 'self', HS, 2);
      const pick = _drainPendingEffectPickSide();
      expect(pick, '1回目は発火').not.toBeNull();
      applyPickAndContinuation(d, pick!, 'v8');
    });
    expect(s1.players.opp.scene.some((c) => c.uid === 'v8')).toBe(false);
    produce(s1, (d) => {
      emitEnter(d, 'self', HS, 3);
      expect(_drainPendingEffectPickSide(), 'limit turn1 消費済 → 2回目不発').toBeNull();
    });
  });
});

// ============================================================
// a2 — PA-MR declared: removeFromHand cost + 自現場 1枚まで AP+1000 + actionTargetsActive
// ============================================================
describe('B06037 a2 — PA 宣言: 手札1リムーブ → 自現場キャラ AP+1000 + actionTargetsActive', () => {
  function paBase(side: Player = 'self'): GameState {
    const s = base(side);
    s.players[side].partnerAreaMR = makeChar({ cardId: 'B06037', uid: `partnerMR:${side}` });
    s.players[side].hand = [HAND];
    s.players[side].scene = [sceneChar(SELFT, 't', { ap: 3000 })];
    return s;
  }

  it('S5 happy: PA から宣言可 → cost 手札1 remove → 自現場 pick(1枚まで) AP 3000→4000 + actionTargetsActive', () => {
    setHuman('self');
    const s = paBase();
    expect(canDeclaredAbility(s, 'partnerMR:self', 'a2'), 'PA から宣言可').toBe(true);
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:self', 'a2');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'charModifyAP pick surface').not.toBeNull();
      expect(pick!.nMin, '「1枚まで」→ 0 可').toBe(0);
      applyPickAndContinuation(d, pick!, 't');
    });
    expect(engine.read.char.ap(after, 't'), 'AP 3000+1000=4000').toBe(4000);
    expect(engine.read.char.hasTextAbility(after, 't', 'actionTargetsActive'), 'actionTargetsActive 付与 ($picked.uid 経由)').toBe(true);
    expect(after.players.self.hand, 'cost 手札消費').toEqual([]);
    expect(after.players.self.remove, 'cost 手札は remove へ').toContain(HAND);
    expect(canDeclaredAbility(after, 'partnerMR:self', 'a2'), '【ターン1】消費').toBe(false);
  });

  it('S6 cost gate (rules/21): 手札0 → canDeclaredAbility=true だが canPay=false', () => {
    const cost = B06037.abilities.find((a) => a.id === 'a2')!.cost!;
    const mkCtx = (): EffectCtx => ({ source: { player: 'self', uid: 'partnerMR:self', cardId: 'B06037', abilityId: 'a2', area: 'partner-area' }, bindings: {} } as EffectCtx);
    const s0 = paBase();
    s0.players.self.hand = [];
    expect(canPay(s0, cost, mkCtx()), '手札0 → cost 不可').toBe(false);
    const s1 = paBase();
    expect(canPay(s1, cost, mkCtx()), '手札1 → cost 可').toBe(true);
  });

  it('S7 owner=opp pin (BUG-174): opp PA-MR → side:self は所有者(opp) 現場を対象', () => {
    setHuman('opp');
    const s = paBase('opp');
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:opp', 'a2');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick!.player, 'chooser = opp').toBe('opp');
      applyPickAndContinuation(d, pick!, 't');
    });
    expect(engine.read.char.ap(after, 't'), 'opp 現場キャラ AP+1000').toBe(4000);
    expect(after.players.opp.remove, 'opp の cost 手札は opp.remove へ').toContain(HAND);
  });

  it('S8 「1枚まで」=0選択: pick skip → AP 不変 / cost は支払済', () => {
    setHuman('self');
    const s = paBase();
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:self', 'a2');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      applyPickSkipAndContinuation(d, pick!, false); // 0枚辞退
    });
    expect(engine.read.char.ap(after, 't'), '0枚 → AP 不変').toBe(3000);
    expect(after.players.self.remove, 'cost 先払い済').toContain(HAND);
  });
});

// ============================================================
// lens 追補 pin (意味等価 lens 2026-07-10: cutin 機能 probe 漏れ回収)
// ============================================================
describe('B06037 【カットイン】AP+2000 — cutIn production 経路 (lens 追補)', () => {
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
      atk = mutate.scene.enter(d, 'self', NOTHS, {}).uid;
      const defUid = mutate.scene.enter(d, 'opp', HS, {}).uid;
      d.players.self.hand = ['B06037'];
      const ax = mkAx(atk, defUid);
      expect(canCutIn(d, ax, 'self', 'B06037'), '手札の B06037 は cutin 可').toBe(true);
      cutIn(d, ax, 'self', 'B06037');
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, atk), '3000+2000').toBe(5000);
    expect(after.players.self.remove.includes('B06037'), '使用後 remove へ').toBe(true);
  });
});

// lens 追補: excludeSource 境界 — 「このキャラ以外の」= observer 自身の登場では不発 (uid 基準)
describe('B06037 a1 — excludeSource 境界 (lens 追補)', () => {
  it('S9 B06037 自身 (特徴[高校生]) の登場 enter では a1 不発', () => {
    setHuman('self');
    produce(base(), (d) => {
      d.players.opp.scene = [makeChar({ cardId: V8000, uid: 'v8' })];
      const c = mutate.scene.enter(d, 'self', 'B06037', {});
      event.emit(d, 'enter', { uid: c.uid, player: 'self', enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId: 'B06037', uid: c.uid });
      runAllUntilEmpty(d);
      expect(_drainPendingEffectPickSide(), '自身の登場 →「このキャラ以外」不成立 → 不発').toBeNull();
    });
  });
});
