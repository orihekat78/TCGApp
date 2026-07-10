// tests/cards/m3-pa-batch/scope-flip — M3 PA batch: 既出荷 6 unit の a2 scope 補正
//   (on-scene → on-partner-area) の engine 実評価 probe。
//
// 対象: B07079/P・B08032/P・B09054/P・B07093/P・B05066/P・B05045/P (P は同型 or spread)
// 印字根拠: 各 TSV「この能力はパートナーエリアでも宣言できる。」(a2 のみ。a1 には句なし)
//
// engine gate: declared-ability.ts:147 — PA からは scope on-partner-area / always のみ宣言可。
// BUG-154 (mutate 層 PA-MR 非解決) 非該当: 6 unit の a2 はいずれも自身を mutate しない
//   (対象 = 現場キャラ / FILE / 手札のみ)。
//
// rules: 18-mr.md §パートナーエリアにいるMRキャラ / 21-declared-ability-cost.md /
//        15-abilities-effects.md (「〜まで」=0可)
// Q&A 根拠 (B09054 TSV): PA で使用したターン中に効果で現場に登場した場合、再びこの能力を
//   使用できる (【ターン1】は uid 単位 = declaredUseCount が char record 付随)。

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
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { sceneChar, makeChar } from '../../helpers/fixtures';
import { B07079 } from '@/cards/ct-p07/B07079';
import { B08032 } from '@/cards/ct-p08/B08032';
import { B09054 } from '@/cards/ct-p09/B09054';
import { B07093 } from '@/cards/ct-p07/B07093';
import { B05066 } from '@/cards/ct-p05/B05066';
import { B05045 } from '@/cards/ct-p05/B05045';
import type { CardDef, EffectCtx, GameState, Player } from '@/engine/types';

const CARDS = [B07079, B08032, B09054, B07093, B05066, B05045] as const;

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const VICTIM = 'DEC_M3_VICTIM';   // B05066 a2 レベル-1 対象 (相手現場)
const AKAI1 = 'DEC_M3_AKAI1';     // B09054 用 特徴[赤井家] (アクティブ)
const HANDF = 'DEC_M3_HANDF';     // B07079 a2 cost fodder

const setHuman = (s: Player | null) => { (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = s; };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  setHuman(null);
  for (const c of CARDS) registerCardDef(c);
  registerCardDef(ch(VICTIM));
  registerCardDef(ch(AKAI1, { traits: ['赤井家'] }));
  registerCardDef(ch(HANDF));
  registerTriggeredListener();
});

function base(turnPlayer: Player = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  return s;
}

function withPaMr(cardId: string, side: Player = 'self'): GameState {
  const s = base(side);
  s.players[side].partnerAreaMR = makeChar({ cardId, uid: `partnerMR:${side}` });
  return s;
}

// ============================================================
// shape — 6 unit とも a2 = on-partner-area / a1 (ある場合) は on-scene のまま
// ============================================================
describe('M3 scope-flip — shape', () => {
  it('a2 scope が on-partner-area (6 unit) / a1 は on-scene 不変', () => {
    for (const c of CARDS) {
      const a2 = c.abilities.find((a) => a.id === 'a2')!;
      expect(a2.scope, `${c.id} a2`).toBe('on-partner-area');
      const a1 = c.abilities.find((a) => a.id === 'a1');
      if (a1 && a1.type === 'declared') {
        expect(a1.scope, `${c.id} a1 (PA 句なし)`).toBe('on-scene');
      }
    }
  });
});

// ============================================================
// canDeclaredAbility — PA から a2 宣言可 / a1 は scope gate で不可
// ============================================================
describe('M3 scope-flip — PA からの宣言可否 (declared-ability.ts:147 gate)', () => {
  it('PA 常駐の 6 unit すべて a2 が PA から宣言可', () => {
    for (const c of CARDS) {
      const s = withPaMr(c.id);
      // B05045 a2 は FILE 操作 — FILE fodder を積む (chain-break 可否は can-check 対象外だが安全側)
      s.players.self.file = [VICTIM, HANDF];
      expect(canDeclaredAbility(s, 'partnerMR:self', 'a2'), `${c.id} a2 PA 宣言可`).toBe(true);
    }
  });

  it('decoy: B08032 a1 (無条件・PA 句なし) は PA から宣言不可 (scope on-scene gate)', () => {
    const s = withPaMr('B08032');
    s.players.self.hand = [HANDF]; // a1 cost fodder — cost 以前に scope で弾かれることの証明
    expect(canDeclaredAbility(s, 'partnerMR:self', 'a1')).toBe(false);
  });

  it('decoy: B09054 a1 は条件 (赤井家3枚以上) 成立でも PA から宣言不可 (失敗要因=scope の証明)', () => {
    const s = withPaMr('B09054');
    s.players.self.scene = [sceneChar(AKAI1, 'k1'), sceneChar(AKAI1, 'k2'), sceneChar(AKAI1, 'k3')];
    expect(canDeclaredAbility(s, 'partnerMR:self', 'a1'), 'PA からは不可').toBe(false);
    // 同条件で現場に居れば a1 宣言可 (条件は成立している対照)
    const s2 = base();
    s2.players.self.scene = [sceneChar('B09054', 'b'), sceneChar(AKAI1, 'k1'), sceneChar(AKAI1, 'k2')];
    expect(canDeclaredAbility(s2, 'b', 'a1'), '現場なら可 (赤井家3枚: 自身含む)').toBe(true);
  });
});

// ============================================================
// 実効果: B05066 a2 を PA から発動 → 相手現場キャラ レベル-1 (human pick 経路)
// ============================================================
describe('M3 scope-flip — B05066 a2 PA 発動 (charModifyLevel -1)', () => {
  it('PA から発動 → pick surface → 相手キャラ レベル 3→2 (ターン終了時まで)', () => {
    setHuman('self');
    const s = withPaMr('B05066');
    s.players.opp.scene = [sceneChar(VICTIM, 'v')];
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:self', 'a2');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'charModifyLevel pick surface').not.toBeNull();
      expect(pick!.nMin, '「1枚まで」→ 0 可').toBe(0);
      applyPickAndContinuation(d, pick!, 'v');
    });
    expect(engine.read.char.level(after, 'v'), 'レベル 3-1=2').toBe(2);
    expect(canDeclaredAbility(after, 'partnerMR:self', 'a2'), '【ターン1】消費').toBe(false);
  });

  it('owner=opp pin (BUG-174): opp の PA-MR B07093 a2 → self 現場キャラがレベル-1 (side:opp は所有者相対)', () => {
    setHuman('self');
    const s = withPaMr('B07093', 'opp');
    s.players.self.scene = [sceneChar(VICTIM, 'v')];
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:opp', 'a2');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'pick surface (opp 所有)').not.toBeNull();
      applyPickAndContinuation(d, pick!, 'v');
    });
    expect(engine.read.char.level(after, 'v'), '所有者(opp) から見た side:opp = self 現場').toBe(2);
  });
});

// ============================================================
// B09054 Q&A: PA で a2 使用 → 同ターン効果登場 → 新 uid で再使用可 (【ターン1】は uid 単位)
// ============================================================
describe('M3 scope-flip — B09054 a2 の【ターン1】は uid 単位 (公式 Q&A)', () => {
  it('PA で使用後、現場登場した B09054 (新 uid) は同ターン再宣言可', () => {
    setHuman('self');
    const s = withPaMr('B09054');
    s.players.self.scene = [sceneChar(AKAI1, 'k1', { state: 'active' })];
    let newUid = '';
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:self', 'a2');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'charGrantAbility pick surface').not.toBeNull();
      applyPickAndContinuation(d, pick!, 'k1');
      // 効果で現場に登場した想定 (《世良真純/0997》Q&A 状況の再現)
      newUid = mutate.scene.enter(d, 'self', 'B09054', { active: true }).uid;
    });
    expect(canDeclaredAbility(after, 'partnerMR:self', 'a2'), 'PA uid 側は【ターン1】消費済').toBe(false);
    expect(canDeclaredAbility(after, newUid, 'a2'), '現場の新 uid は再使用可 (Q&A)').toBe(true);
  });
});

// ============================================================
// B07079 a2 cost gate: PA 宣言でも cost removeFromHand は通常適用 (rules/21)
// ============================================================
describe('M3 scope-flip — B07079 a2 PA 宣言の cost gate', () => {
  it('canDeclaredAbility は hand 0 でも true / canPay が hand 0 → false, 1 → true', () => {
    const a2cost = B07079.abilities.find((a) => a.id === 'a2')!.cost!;
    const mkCtx = (): EffectCtx => ({ source: { player: 'self', uid: 'partnerMR:self', cardId: 'B07079', abilityId: 'a2', area: 'partner-area' }, bindings: {} } as EffectCtx);
    const s0 = withPaMr('B07079');
    expect(canDeclaredAbility(s0, 'partnerMR:self', 'a2')).toBe(true);
    expect(canPay(s0, a2cost, mkCtx()), '手札0 → cost 不可 (rules/21)').toBe(false);
    const s1 = withPaMr('B07079');
    s1.players.self.hand = [HANDF];
    expect(canPay(s1, a2cost, mkCtx()), '手札1 → cost 可').toBe(true);
  });
});
