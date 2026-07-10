// tests/cards/m2latter-counter — M2後半 mini-wave 出荷カード 3 枚の engine 実評価 probe
//   B07008 小嶋元太  : a1 lvlDeltaInHandPer (per-count union filterAny、hand gate 専用) — 初 live consumer
//   B08047 沖矢昴    : a1 drawUpToHandSize (dormant verb 解禁、自ターン gate) / a2 removeFromHandDownTo cost — 初 live consumer
//   B06066 怪盗キッド＆白馬探 : a2 phase:end:start + sceneHas state:['sleep','stun'] nMin:3 → active 化
//     (スタン→アクティブ = 代わりにスリープ、rules/03/24)
// 駆動 (production dispatch):
//   - B07008 a1 = effectiveHandLevel (hand-use-card.ts、手札の使用/NH/UI 4 site の共有 helper)
//   - B08047 a1 / B06066 a2 = event.emit('phase:end:start', {player}) (flow/turn.ts:72 production 形、
//     B05087.manual 慣行) + registerTriggeredListener
//   - B08047 a2 = pay + useDeclaredAbility (wave2-cluster2 慣行)
//   - emit+drain は単一 produce draft で包む + setAutoFreeze(false) (miniwave3 慣行)
//   - beforeEach: event._resetRegistry + _resetTriggeredRegistered (endTurn 系 handler 累積罠、
//     reference-miniwave4-hand-level)
// rules: 03/05/12/15/17/19/21/24

import { describe, it, expect, beforeEach } from 'vitest';
import { produce, setAutoFreeze } from 'immer';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { effectiveHandLevel } from '@/engine/flow/main/hand-use-card';
import { canDeclaredAbility, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { pay } from '@/engine/cost/pay';
import { canPay } from '@/engine/cost/evaluate';
import { _drainPendingEffectPickSide, _drainPendingEffectOptionalSide, _clearPendingEffectPickQueue, _clearPendingEffectOptionalSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation, applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { sceneChar } from '../helpers/fixtures';
import { B07008 } from '@/cards/ct-p07/B07008';
import { B08047 } from '@/cards/ct-p08/B08047';
import { B06066 } from '@/cards/ct-p06/B06066';
import type { CardDef, EffectCtx, GameState, Player } from '@/engine/types';

function charDef(id: string, opts: { name?: string; traits?: string[]; ap?: number; level?: number } = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [opts.name ?? id], colors: ['青'],
    level: opts.level ?? 3, ap: opts.ap ?? 3000, lp: 1,
    traits: opts.traits ?? [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}
function partnerDef(id: string, colors: string[]): CardDef {
  return { id, no: id, kind: 'partner', names: [id], colors, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

const AGASA = charDef('AGASA', { name: '阿笠博士' });                 // filterAny[0] cardName 一致
const DTB = charDef('DTB', { traits: ['少年探偵団'] });               // filterAny[1] trait 一致
const BOTH = charDef('BOTH', { name: '阿笠博士', traits: ['少年探偵団'] }); // 両該当 (二重計上なし検証)
const OTHER = charDef('OTHER', { traits: ['警視庁'] });               // decoy (非該当)
const TGT = charDef('TGT', { ap: 4000 });                             // sceneRemove 対象
const F1 = charDef('F1'), F2 = charDef('F2'), F3 = charDef('F3'), F4 = charDef('F4'), F5 = charDef('F5');
const S1 = charDef('S1'), S2 = charDef('S2'), ST = charDef('ST');     // B06066 a2 用 (sleep/sleep/stun)
const PBLUE = partnerDef('PBLUE', ['青']);
const PRED = partnerDef('PRED', ['赤']);
const FIXTURES = [AGASA, DTB, BOTH, OTHER, TGT, F1, F2, F3, F4, F5, S1, S2, ST, PBLUE, PRED];

function setHuman(s: Player | null): void {
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = s;
}

function base(turn: Player): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turn, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerCardDef(B07008);
  registerCardDef(B08047);
  registerCardDef(B06066);
  for (const f of FIXTURES) registerCardDef(f);
  registerTriggeredListener();
  setHuman('self');
  setAutoFreeze(false);
});

// ---- B07008 a1: lvlDeltaInHandPer (hand gate 専用 per-count union) ----
describe('B07008 小嶋元太 a1 — 手札内 per-count レベル減 (lvlDeltaInHandPer)', () => {
  function board(turn: Player, scene: string[]): GameState {
    const s = base(turn);
    s.players.self.partner.cardId = 'PBLUE';
    s.players.self.case = { ...s.players.self.case, status: '解決編' } as GameState['players']['self']['case'];
    s.players.self.scene = scene.map((c, i) => sceneChar(c, `${c.toLowerCase()}#${i}`));
    s.players.self.hand = ['B07008'];
    return s;
  }

  it('条件成立 (青P+解決編+自ターン) + 該当2枚 (阿笠博士+少年探偵団、decoy 除外) → effectiveHandLevel = 8-2 = 6', () => {
    const s = board('self', ['AGASA', 'DTB', 'OTHER']);
    expect(effectiveHandLevel(s, 'self', 'B07008')).toBe(6);
  });

  it('両 filter 該当 1 枚は 1 (二重計上なし): AGASA+DTB+BOTH → 8-3 = 5', () => {
    const s = board('self', ['AGASA', 'DTB', 'BOTH']);
    expect(effectiveHandLevel(s, 'self', 'B07008')).toBe(5);
  });

  it('条件不成立 (相手ターン) → 印字レベル 8 のまま', () => {
    const s = board('opp', ['AGASA', 'DTB']);
    expect(effectiveHandLevel(s, 'self', 'B07008')).toBe(8);
  });
});

// ---- B07008 a2: 【FILE5】【登場時】optional (sleep + 相手 lvl≤8 bounce) ----
describe('B07008 小嶋元太 a2 — FILE5 登場時: スリープしてもよい→相手のレベル8以下を手札に', () => {
  it('FILE5 で登場 → optional 承諾 → 自身 sleep + 相手 lvl≤8 のみ候補 (chooser=self) → 相手手札へ bounce', () => {
    const b = base('self');
    b.players.self.file = Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: 'F1' })) as never;
    b.players.opp.scene = [
      sceneChar('TGT', 'tgt#1'),                       // lvl3 ≤ 8 (候補)
      sceneChar('OTHER', 'oth#1'),                     // lvl3 ≤ 8 (候補)
    ];
    b.players.self.scene = [sceneChar('B07008', 'gen#1')];
    let candIds: string[] = [];
    const s = produce(b, (d: GameState) => {
      // 'enter' hook emit (production 形 = atomSceneEnter/handUseCard の emit shape、b03051 慣行)
      event.emit(d, 'enter', { uid: 'gen#1', player: 'self', enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId: 'B07008', uid: 'gen#1' });
      runAllUntilEmpty(d);
      const opt = _drainPendingEffectOptionalSide();
      expect(opt, '【FILE5】成立 → optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, opt!, true);     // スリープさせてもよい → する
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'sceneToHand pick surface (chooser=能力所有者)').not.toBeNull();
      candIds = (pick!.candidates as Array<{ cardId: string }>).map((c) => c.cardId).sort();
      const cands = pick!.candidates as Array<{ uid: string; cardId: string }>;
      const tgt = cands.find((c) => c.cardId === 'TGT')!;
      applyPickAndContinuation(d, pick!, tgt.uid, [tgt.uid]);
      runAllUntilEmpty(d);
    }) as GameState;
    expect(candIds, '候補 = 相手現場の lvl≤8 のみ (自陣 B07008 は候補外 = side:opp)').toEqual(['OTHER', 'TGT']);
    expect(s.players.self.scene.find((c) => c.cardId === 'B07008')!.state, 'そうした場合 → 自身 sleep').toBe('sleep');
    expect(s.players.opp.scene.map((c) => c.cardId), 'TGT が現場から離脱').toEqual(['OTHER']);
    expect(s.players.opp.hand, 'TGT は所有者 (相手) の手札へ').toContain('TGT');
  });

  it('FILE4 (<5) で登場 → 【FILE5】不成立 = 発動しない (公式QA: NH 使用で FILE4 なら不発)', () => {
    const b = base('self');
    b.players.self.file = Array.from({ length: 4 }, () => ({ type: 'card-back' as const, cardId: 'F1' })) as never;
    b.players.self.scene = [sceneChar('B07008', 'gen#1')];
    const s = produce(b, (d: GameState) => {
      event.emit(d, 'enter', { uid: 'gen#1', player: 'self', enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId: 'B07008', uid: 'gen#1' });
      runAllUntilEmpty(d);
      expect(_drainPendingEffectOptionalSide(), 'optional 非 surface').toBeNull();
    }) as GameState;
    expect(s.players.self.scene.find((c) => c.cardId === 'B07008')!.state, '据置 (不発)').toBe('active');
  });
});

// ---- B08047 a1: 自分のターン終了時 drawUpToHandSize ----
describe('B08047 沖矢昴 a1 — 自分のターン終了時、手札2枚まで引く', () => {
  function run(turn: Player, hand: string[]): GameState {
    const b = base(turn);
    b.players.self.scene = [sceneChar('B08047', 'oki#1')];
    b.players.self.hand = [...hand];
    b.players.self.deck = ['F1', 'F2', 'F3', 'F4'];
    return produce(b, (d: GameState) => {
      event.emit(d, 'phase:end:start', { player: turn }, undefined);
      runAllUntilEmpty(d);
    }) as GameState;
  }

  it('自分ターン終了 (手札0) → 2枚まで draw (デッキ4→2)', () => {
    const s = run('self', []);
    expect(s.players.self.hand, '手札 0→2').toEqual(['F1', 'F2']);
    expect(s.players.self.deck, 'デッキ 4→2').toEqual(['F3', 'F4']);
  });

  it('自分ターン終了 (手札3 ≥ 2) → draw 0 (up 方向のみ、捨てない)', () => {
    const s = run('self', ['F1', 'F2', 'F3']);
    expect(s.players.self.hand).toEqual(['F1', 'F2', 'F3']);
    expect(s.players.self.deck.length).toBe(4);
  });

  it('相手ターン終了 → 不発 (turn:self gate、grounding 罠節)', () => {
    const s = run('opp', []);
    expect(s.players.self.hand, '「自分の」指定 → 相手ターン終了時は引かない').toEqual([]);
    expect(s.players.self.deck.length).toBe(4);
  });
});

// ---- B08047 a2: 【宣言】sleepSelf + removeFromHandDownTo(2) → sceneRemove ----
describe('B08047 沖矢昴 a2 — 【パートナー赤】宣言 (手札2枚になるまでリムーブ cost)', () => {
  const a2 = B08047.abilities.find((a) => a.id === 'a2')!;
  function ctxFor(): EffectCtx {
    return { source: { cardId: 'B08047', uid: 'oki#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
  }
  function board(hand: string[]): GameState {
    const s = base('self');
    s.players.self.partner.cardId = 'PRED';
    s.players.self.scene = [sceneChar('B08047', 'oki#1')];
    s.players.self.hand = [...hand];
    s.players.opp.scene = [sceneChar('TGT', 'tgt#1')];
    return s;
  }

  it('手札4 → cost 支払で hand 2 (head 2枚が remove へ) + 自身 sleep → 効果 pick で相手キャラ removal', () => {
    const b = board(['F1', 'F2', 'F3', 'F4']);
    expect(canDeclaredAbility(b, 'oki#1', 'a2'), '赤P → 宣言可').toBe(true);
    const s = produce(b, (d: GameState) => {
      const ctx = ctxFor();
      pay(d, a2.cost!, ctx);
      useDeclaredAbility(d, 'oki#1', 'a2', ctx);
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'sceneRemove pick surface').not.toBeNull();
      const cands = pick!.candidates as Array<{ uid: string; cardId: string }>;
      const tgt = cands.find((c) => c.cardId === 'TGT')!;
      applyPickAndContinuation(d, pick!, tgt.uid, [tgt.uid]);
      runAllUntilEmpty(d);
    }) as GameState;
    expect(s.players.self.hand, 'cost: 手札 4→2 (head-fixed F1,F2)').toEqual(['F3', 'F4']);
    expect(s.players.self.remove.sort(), 'F1/F2 が remove へ (viaCost)').toEqual(['F1', 'F2']);
    expect(s.players.self.scene[0]!.state, 'cost:【スリープ】').toBe('sleep');
    expect(s.players.opp.scene.length, 'TGT removal').toBe(0);
    expect(s.players.opp.remove, 'TGT が相手 remove へ').toContain('TGT');
  });

  it('手札1 (< 2) でも宣言可 (公式QA: コストは【スリープ】だけ) — canPay 恒真 + pay で手札不変', () => {
    const b = board(['F1']);
    expect(canDeclaredAbility(b, 'oki#1', 'a2')).toBe(true);
    expect(canPay(b, a2.cost!, ctxFor()), '手札1 でも canPay true').toBe(true);
    const s = produce(b, (d: GameState) => {
      pay(d, a2.cost!, ctxFor());
    }) as GameState;
    expect(s.players.self.hand, '支払枚数 0 → 手札不変').toEqual(['F1']);
    expect(s.players.self.scene[0]!.state, 'sleepSelf は支払済').toBe('sleep');
  });
});

// ---- B06066 a2: ターン終了時 sleep/stun 3枚以上 → 1枚まで active 化 ----
describe('B06066 怪盗キッド＆白馬探 a2 — sleep+stun 合計3以上で active 化 (スタンは代わりにスリープ)', () => {
  function run(states: Array<'active' | 'sleep' | 'stun'>, pickCardId: string | null): GameState {
    const b = base('self');
    b.players.self.scene = [
      sceneChar('B06066', 'kid#1'),
      sceneChar('S1', 's1#1', { state: states[0] }),
      sceneChar('S2', 's2#1', { state: states[1] }),
      sceneChar('ST', 'st#1', { state: states[2] }),
    ];
    return produce(b, (d: GameState) => {
      event.emit(d, 'phase:end:start', { player: 'self' }, undefined);
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      if (pickCardId === null) {
        expect(pick, '条件不成立 → pick 非 surface').toBeNull();
        return;
      }
      expect(pick, 'sceneSetState active pick surface').not.toBeNull();
      const cands = pick!.candidates as Array<{ uid: string; cardId: string }>;
      const hit = cands.find((c) => c.cardId === pickCardId)!;
      expect(hit, `${pickCardId} が候補に居る`).toBeDefined();
      applyPickAndContinuation(d, pick!, hit.uid, [hit.uid]);
      runAllUntilEmpty(d);
    }) as GameState;
  }

  it('sleep2+stun1 = 3枚 → pick queue surface、スタン対象を選ぶと「代わりにスリープ」(rules/03/24)', () => {
    const s = run(['sleep', 'sleep', 'stun'], 'ST');
    const st = s.players.self.scene.find((c) => c.cardId === 'ST')!;
    expect(st.state, 'スタン→アクティブは代わりにスリープ (スタン解除 → sleep)').toBe('sleep');
  });

  it('sleep2 のみ (合計2 < 3) → 不発 (nMin:3 gate)', () => {
    run(['sleep', 'sleep', 'active'], null);
  });
});
