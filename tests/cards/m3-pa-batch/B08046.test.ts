// tests/cards/m3-pa-batch/B08046 — 赤井秀一＆ジョディ・スターリング (character / MR / 赤 / FBI・赤井家)
//  手書き probe (engine 実評価で全 novel 句を踏む)
//
// 公式テキスト:
//   a1 【パートナー赤】【宣言】【ターン1】レベル9以下のキャラを1枚まで選び、リムーブする。
//      この能力は自分の現場に〚特徴［FBI］〛のキャラが2枚以上いる場合に宣言できる。
//   a2 【宣言】【ターン1】〚手札から特徴［FBI］のキャラを1枚リムーブする〛：カードを1枚引く。
//      この【宣言】能力のコストによってレベル8以上のキャラをリムーブした場合、カードを1枚引く。
//      この能力はパートナーエリアでも宣言できる。
//   a3 【カットイン】AP＋2000
//
// novel 句 → engine 実評価:
//   a1 (declared on-scene): condition and[partnerColor 赤, sceneHas{FBI,nMin2}] (自身も FBI に数える=Q&A)、
//      sceneRemove levelMax9 side either。
//   a2 (declared on-partner-area): cost removeFromHand{FBI,n1} → draw1 +
//      conditional costRemovedMatches{key removeFromHand, levelMin8} → draw1 (計2)。
//   a3 (【カットイン】): shape のみ。
//
// production dispatch: activateDeclaredAbility + runAllUntilEmpty、a1 pick = human 経路。owner=opp pin。
// rules: 15-abilities-effects.md, 17-icons.md, 18-mr.md, 21-declared-ability-cost.md, 25-qa-effects-resolution.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canPay } from '@/engine/cost/index';
import { cutIn, canCutIn } from '@/engine/flow/contact';
import { mutate } from '@/engine/mutate/index';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import {
  _drainPendingEffectPickSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
  _clearPendingEffectChoiceSide,
} from '@/engine/effect/resolve-picks';
import { sceneChar } from '../../helpers/fixtures';
import { B08046 } from '@/cards/ct-p08/B08046';
import type { CardDef, EffectCtx, GameState, Player, ActionContext } from '@/engine/types';

function partner(id: string, color: string): CardDef {
  return { id, no: `9/${id}`, kind: 'partner', names: [id], colors: [color], level: 0, ap: 0, lp: 2, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const P_RED = partner('PRED', '赤');
const P_BLUE = partner('PBLUE', '青');
const FBI = 'DEC_B08046_FBI';       // 現場 FBI (a1 sceneHas 用)
const V9 = 'DEC_B08046_V9';         // level9 = 除去可
const V10 = 'DEC_B08046_V10';       // level10 = decoy (levelMax9 超過)
const HAND_FBI8 = 'DEC_B08046_H8';  // 手札 FBI level8 (a2 cost, ≥8 分岐)
const HAND_FBI7 = 'DEC_B08046_H7';  // 手札 FBI level7 (a2 cost, <8 分岐)
const HAND_NONFBI = 'DEC_B08046_HN'; // 手札 非FBI (cost 候補外)
const D1 = 'DEC_B08046_D1';
const D2 = 'DEC_B08046_D2';
const D3 = 'DEC_B08046_D3';

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
  registerCardDef(B08046);
  registerCardDef(P_RED); registerCardDef(P_BLUE);
  registerCardDef(ch(FBI, { traits: ['FBI'] }));
  registerCardDef(ch(V9, { level: 9 }));
  registerCardDef(ch(V10, { level: 10 }));
  registerCardDef(ch(HAND_FBI8, { traits: ['FBI'], level: 8 }));
  registerCardDef(ch(HAND_FBI7, { traits: ['FBI'], level: 7 }));
  registerCardDef(ch(HAND_NONFBI, { level: 8 }));
  for (const d of [D1, D2, D3]) registerCardDef(ch(d));
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
describe('B08046 — shape', () => {
  it('赤/Lv9/AP8000/LP2/MR/FBI・赤井家 + a1 declared(on-scene) / a2 declared(on-partner-area) / a3 cutin', () => {
    expect(B08046.no).toBe('0884/B08046');
    expect(B08046.colors).toEqual(['赤']);
    expect(B08046.traits).toEqual(['FBI', '赤井家']);
    expect(B08046.rarity).toBe('MR');
    expect(B08046.names).toEqual(['赤井秀一＆ジョディ・スターリング', '赤井秀一', 'ジョディ・スターリング']);
    const [a1, a2, a3] = B08046.abilities;
    expect(a1).toMatchObject({ id: 'a1', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 } });
    expect(a1.condition).toMatchObject({ kind: 'and', cs: [{ kind: 'partnerColor', color: '赤' }, { kind: 'sceneHas', nMin: 2 }] });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'sceneRemove', args: { max: 1, side: 'either', filter: { levelMax: 9 } } });
    expect(a2).toMatchObject({ id: 'a2', type: 'declared', scope: 'on-partner-area', limit: { kind: 'turn', n: 1 } });
    expect(a2.cost).toMatchObject({ kind: 'removeFromHand', n: 1 });
    expect(a3).toMatchObject({ id: 'a3', type: 'triggered', trigger: { hook: 'effect:declared' } });
  });
});

// ============================================================
// a1 — partnerColor赤 + sceneHas{FBI≥2} gate → sceneRemove levelMax9
// ============================================================
describe('B08046 a1 — 【パートナー赤】+ FBI2枚以上 gate → レベル9以下1枚まで除去', () => {
  function board(): GameState {
    const s = base();
    s.players.self.partner.cardId = 'PRED';
    // B08046 自身(FBI) + FBI char = 2枚 (Q&A: 自身も数える)
    s.players.self.scene = [sceneChar('B08046', 'sh'), sceneChar(FBI, 'fbi')];
    s.players.opp.scene = [sceneChar(V9, 'v9'), sceneChar(V10, 'v10')];
    return s;
  }

  it('S1 happy: 赤 + FBI2枚(自身含む) → 宣言可 → level9 除去 / level10 は decoy', () => {
    setHuman('self');
    const s = board();
    expect(canDeclaredAbility(s, 'sh', 'a1'), 'FBI2枚(自身含む) → 宣言可').toBe(true);
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'sh', 'a1');
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'sceneRemove pick surface').not.toBeNull();
      expect(pick!.nMin).toBe(0);
      const cand = pick!.candidates.map((c) => c.cardId);
      expect(cand, 'level9 は候補').toContain(V9);
      expect(cand, 'level10 は decoy → 候補外').not.toContain(V10);
      applyPickAndContinuation(d, pick!, 'v9');
    });
    expect(after.players.opp.scene.some((c) => c.uid === 'v9'), 'level9 除去').toBe(false);
    expect(after.players.opp.remove, 'level9 は opp.remove へ').toContain(V9);
    expect(canDeclaredAbility(after, 'sh', 'a1'), '【ターン1】消費').toBe(false);
  });

  it('S2 gate: パートナー青 → 宣言不可 / FBI 1枚のみ (自身のみ) → sceneHas{≥2} 不成立で宣言不可', () => {
    const blue = board();
    blue.players.self.partner.cardId = 'PBLUE';
    expect(canDeclaredAbility(blue, 'sh', 'a1'), '青 → 宣言不可').toBe(false);
    const oneFbi = base();
    oneFbi.players.self.partner.cardId = 'PRED';
    oneFbi.players.self.scene = [sceneChar('B08046', 'sh')]; // FBI は自身1枚のみ
    expect(canDeclaredAbility(oneFbi, 'sh', 'a1'), 'FBI 1枚 → 宣言不可').toBe(false);
  });

  it('S3 owner=opp pin (BUG-174): opp 所有 a1 → self 現場キャラを除去 (反転しない)', () => {
    setHuman('opp');
    const s = base('opp');
    s.players.opp.partner.cardId = 'PRED';
    s.players.opp.scene = [sceneChar('B08046', 'osh'), sceneChar(FBI, 'ofbi')];
    s.players.self.scene = [sceneChar(V9, 'v9')];
    expect(canDeclaredAbility(s, 'osh', 'a1')).toBe(true);
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
// a2 — PA-MR declared: cost removeFromHand{FBI} → draw1 + (level8以上なら) draw1
// ============================================================
describe('B08046 a2 — PA 宣言: FBI手札リムーブ → draw、レベル8以上なら追加draw', () => {
  function paBase(handFbi: string, side: Player = 'self'): GameState {
    const s = base(side);
    s.players[side].partnerAreaMR = { ...sceneChar('B08046', `partnerMR:${side}`) };
    s.players[side].hand = [handFbi, HAND_NONFBI];
    s.players[side].deck = [D1, D2, D3];
    return s;
  }

  it('S4 level8 リムーブ → draw2 (base + costRemovedMatches{≥8})', () => {
    setHuman('self');
    const s = paBase(HAND_FBI8);
    expect(canDeclaredAbility(s, 'partnerMR:self', 'a2')).toBe(true);
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:self', 'a2');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.deck, 'level8 → 2枚 draw (deck 3→1)').toEqual([D3]);
    expect(after.players.self.remove, 'cost で FBI level8 が remove へ').toContain(HAND_FBI8);
  });

  it('S5 level7 リムーブ → draw1 のみ (costRemovedMatches{≥8} 不成立)', () => {
    setHuman('self');
    const s = paBase(HAND_FBI7);
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:self', 'a2');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.deck, 'level7 → 1枚 draw のみ (deck 3→2)').toEqual([D2, D3]);
  });

  it('S6 cost gate: 手札に FBI キャラ無し → canPay=false (非FBIは候補外)', () => {
    const cost = B08046.abilities.find((a) => a.id === 'a2')!.cost!;
    const mkCtx = (): EffectCtx => ({ source: { player: 'self', uid: 'partnerMR:self', cardId: 'B08046', abilityId: 'a2', area: 'partner-area' }, bindings: {} } as EffectCtx);
    const noFbi = base();
    noFbi.players.self.partnerAreaMR = { ...sceneChar('B08046', 'partnerMR:self') };
    noFbi.players.self.hand = [HAND_NONFBI];
    expect(canPay(noFbi, cost, mkCtx()), 'FBI 無 → cost 不可').toBe(false);
    const withFbi = paBase(HAND_FBI8);
    expect(canPay(withFbi, cost, mkCtx()), 'FBI 有 → cost 可').toBe(true);
  });

  it('S7 owner=opp pin (BUG-174): opp PA-MR で a2 → opp が draw2', () => {
    const s = paBase(HAND_FBI8, 'opp');
    expect(canDeclaredAbility(s, 'partnerMR:opp', 'a2')).toBe(true);
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, 'partnerMR:opp', 'a2');
      runAllUntilEmpty(d);
    });
    expect(after.players.opp.deck, 'opp deck 3→1 (draw2)').toEqual([D3]);
    expect(after.players.self.deck.length, 'self は draw しない').toBe(0);
  });
});

// ============================================================
// lens 追補 pin (意味等価 lens 2026-07-10: cutin 機能 probe 漏れ回収)
// ============================================================
describe('B08046 【カットイン】AP+2000 — cutIn production 経路 (lens 追補)', () => {
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
      atk = mutate.scene.enter(d, 'self', FBI, {}).uid;
      const defUid = mutate.scene.enter(d, 'opp', V9, {}).uid;
      d.players.self.hand = ['B08046'];
      const ax = mkAx(atk, defUid);
      expect(canCutIn(d, ax, 'self', 'B08046'), '手札の B08046 は cutin 可').toBe(true);
      cutIn(d, ax, 'self', 'B08046');
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, atk), '3000+2000').toBe(5000);
    expect(after.players.self.remove.includes('B08046'), '使用後 remove へ').toBe(true);
  });
});
