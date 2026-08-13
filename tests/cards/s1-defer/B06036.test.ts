// s1-defer probe — B06036 鬼丸天下統一プロジェクト (case)
//
// 公式テキスト (a2 = novel句):
//   【解決編】【宣言】【ターン1】〚裏向きの証拠を3つ表向きにする〛：この【宣言】能力のコストによって
//   表向きになった【ヒラメキ】を持つ〚特徴［YAIBA］〛のカードを1枚まで選び、その【ヒラメキ】の効果を
//   発動させてもよい。
//
// novel 経路 (S1 wave, invokeHiramekiOfCard $pick.cardId first-consumer):
//   declared (uid='case:self') / cost {pay,[flipFaceUpEvidence n:3]} (S1 wave: pay.ts が $costFlipped bind) /
//   condition caseStatus:解決編 / limit turn 1 /
//   effect atom invokeHiramekiOfCard{ cardId:'$pick.cardId', trait:'YAIBA',
//     target pick{ area:evidence, side:self, faceUp:true, fromGroupCards:'$costFlipped',
//       filter{keyword:ヒラメキ, trait:YAIBA}, n:{min:0,max:1} } }
//
// probe 観点:
//   ① flip 3 (YAIBA∩hirameki 1 + 非YAIBA hirameki decoy 1 + hirameki無 YAIBA decoy 1) →
//      pick 候補が YAIBA∩hirameki の 1枚のみ (candidates.ts fromGroupCards + filter で decoy 除外)。
//   ② pick 解決 → 選んだカードの【ヒラメキ】effect (draw1) が queue され解決。
//   ③ cost 前から表向きだった YAIBA∩hirameki 証拠は候補外 (fromGroupCards='$costFlipped' gate)。
//   ④ 「1枚まで」= decline (0枚) 可 → invoke なし (rules/15)。
//   ⑤ owner=opp (case:opp) で side 反転しない。
//
// rules: 10-action-event (ヒラメキ), 15 (「〜まで」=0枚可), 17 (【ターン1】【解決編】), 21 (cost flip 3)
//
// ⚠ BLOCKED (engine gap, S1 wave 未完): a2 の invoke pick は engine が surface できない。
//   cost pay (src/engine/cost/pay.ts:438) が $costFlipped を **ctx.bindings** に書くが、
//   useDeclaredAbility (src/engine/flow/main/declared-ability.ts:285) は effect 解決用の resolveCtx を
//   `bindings: {}` で構築し cost-pay の ctx.bindings を forward しない。さらに event.queue の 6th 引数
//   (bindings, declared-ability.ts:~305) が undefined ゆえ runtime entryToCtx (resolve/stack.ts:68) も
//   空 bindings を復元する。結果 candidates.ts fromGroupCards='$costFlipped' が空集合 → 候補0 → pick 不発。
//   → 実証: $costFlipped を bindings に手置きすると candidates() は正しく [YH] のみ返す (decoy 除外も機能)。
//   engine 側 3 点 (pay $costFlipped / candidates fromGroupCards evidence / invoke $pick.cardId Pattern B)
//   cost→effect の bindings は declared queue に永続化し、physical occurrence を保つ。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { registerHiramekiListener, _resetPendingHirameki, _resetHiramekiRegistered } from '@/engine/listeners/hirameki';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { cost as engineCost } from '@/engine/cost/index';
import {
  _drainPendingEffectPickSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/resolve-picks';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { B06036 } from '@/cards/ct-p06/B06036';
import type { AbilityDef, CardDef, GameState, EffectCtx, EvidenceCard } from '@/engine/types';

// --- fixtures ---
const YH = 'DEC_B06036_YH';     // YAIBA + 【ヒラメキ】draw → 唯一の候補
const NYH = 'DEC_B06036_NYH';   // 非YAIBA + 【ヒラメキ】draw → trait filter 外 decoy
const YNH = 'DEC_B06036_YNH';   // YAIBA + ヒラメキ無 → keyword filter 外 decoy
const YH2 = 'DEC_B06036_YH2';   // YAIBA + 【ヒラメキ】draw だが cost 前から faceUp → fromGroupCards 外

// 【ヒラメキ】draw1 (abilityIsHirameki: triggered + hook:evidence:remove-by-action + optional)
const hirDraw: AbilityDef = {
  id: 'h1', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】draw1', ruleRefs: [],
};

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function registerFixtures(): void {
  registerCardDef(B06036);
  registerCardDef(ch(YH, { traits: ['YAIBA'], abilities: [hirDraw] }));
  registerCardDef(ch(NYH, { traits: [], abilities: [hirDraw] }));
  registerCardDef(ch(YNH, { traits: ['YAIBA'], abilities: [] }));
  registerCardDef(ch(YH2, { traits: ['YAIBA'], abilities: [hirDraw] }));
}

const setHuman = (s: 'self' | 'opp' | null) =>
  { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };
const evd = (cardId: string, faceUp = false): EvidenceCard => ({ cardId, faceUp, origin: { turn: 1, via: 'reasoning' } });

// case:side を【解決編】+ 裏証拠 (fixtures) + deck をセットした base。
function base(opts: { side?: 'self' | 'opp'; status?: string; evidence?: EvidenceCard[] } = {}): GameState {
  const side = opts.side ?? 'self';
  const s = createEmptyGameState();
  s.turn = { number: 5, player: side, phase: 'main', isFirstPlayerFirstTurn: false };
  const p = s.players[side];
  p.case.cardId = 'B06036';
  p.case.status = (opts.status ?? '解決編') as GameState['players']['self']['case']['status'];
  p.case.colors = ['緑'];
  p.evidence = opts.evidence ?? [evd(YH), evd(NYH), evd(YNH)];
  p.deck = ['DK1', 'DK2', 'DK3', 'DK4'];
  return s;
}

const uidFor = (side: 'self' | 'opp') => (side === 'self' ? 'case:self' : 'case:opp');

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetHiramekiRegistered();
  _resetPendingHirameki();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  setHuman(null);
  for (const id of ['DK1', 'DK2', 'DK3', 'DK4']) registerCardDef(ch(id));
  registerFixtures();
  registerTriggeredListener();
  registerHiramekiListener();
});

// ============================================================
// a2 cost + invokeHiramekiOfCard pick (fromGroupCards='$costFlipped' + filter)
// ============================================================
describe('B06036 a2 — flip 3 → cost-flipped 内の YAIBA∩ヒラメキ を pick → 【ヒラメキ】effect 発動', () => {
  it('① 候補は YAIBA∩ヒラメキ の 1枚のみ (非YAIBA / ヒラメキ無 decoy を除外)', () => {
    setHuman('self');
    produce(base(), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1, 2] } });
      runAllUntilEmpty(d);
      const pending = _drainPendingEffectPickSide();
      expect(pending, 'invoke pick surface').not.toBeNull();
      expect(pending!.player, 'chooser = self').toBe('self');
      expect(pending!.candidates.length, 'YAIBA∩ヒラメキ 1枚のみ').toBe(1);
      expect(pending!.candidates[0]!.cardId, '候補 = YH').toBe(YH);
      expect(pending!.candidates.some((c) => c.cardId === NYH), '非YAIBA は候補外').toBe(false);
      expect(pending!.candidates.some((c) => c.cardId === YNH), 'ヒラメキ無 は候補外').toBe(false);
      expect(pending!.nMin, '「1枚まで」→ 0枚可').toBe(0);
    });
  });

  it('② YH を pick → 【ヒラメキ】draw1 が発動 (手札+1) / cost で証拠3つ表向き', () => {
    setHuman('self');
    const after = produce(base(), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1, 2] } });
      runAllUntilEmpty(d);
      const pending = _drainPendingEffectPickSide();
      const cand = pending!.candidates.find((c) => c.cardId === YH)!;
      applyPickAndContinuation(d, pending!, cand.uid);
    });
    expect(after.players.self.hand.length, 'YH の【ヒラメキ】draw1 発動').toBe(1);
    expect(after.players.self.evidence.slice(0, 3).every((e) => e.faceUp), 'cost で証拠3つ表向き').toBe(true);
  });

  it('AI declared resolution binds the selected exact evidence occurrence before queueing', () => {
    setHuman(null);
    const after = produce(base({ evidence: [evd(YH), evd(YH), evd(YNH)] }), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1, 2] } });

      const declared = d.pendingEffects.find((entry) =>
        entry.source.cardId === 'B06036' && entry.source.abilityId === 'a2',
      );
      expect(declared?.effect).toMatchObject({
        kind: 'atom',
        verb: 'invokeHiramekiOfCard',
        args: {
          occurrence: {
            uid: 'evidence:self:0',
            cardId: YH,
            player: 'self',
            area: 'evidence',
            index: 0,
            occurrenceWitness: expect.any(String),
          },
        },
      });

      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length, 'selected evidence Hirameki draw').toBe(1);
    expect(after.players.self.evidence.slice(0, 3).every((e) => e.faceUp), 'exact paid evidence remains live').toBe(true);
  });

  it('③ cost 前から faceUp の YAIBA∩ヒラメキ証拠 (YH2) は候補外 (fromGroupCards gate)', () => {
    setHuman('self');
    // index0 = YH2 (既に faceUp) / index1-3 = 裏向き → cost は 1,2,3 を flip
    const evidence: EvidenceCard[] = [evd(YH2, true), evd(YH), evd(NYH), evd(YNH)];
    produce(base({ evidence }), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [1, 2, 3] } });
      runAllUntilEmpty(d);
      const pending = _drainPendingEffectPickSide();
      expect(pending, 'invoke pick surface').not.toBeNull();
      expect(pending!.candidates.length, 'cost-flipped 内の YH のみ (YH2 は除外)').toBe(1);
      expect(pending!.candidates[0]!.cardId, '候補 = YH (index1)').toBe(YH);
      expect(pending!.candidates.some((c) => c.cardId === YH2), 'YH2 は fromGroupCards 外で候補外').toBe(false);
    });
  });

  it('④ decline (0枚 skip) → invoke なし (手札不変) / cost は消費', () => {
    setHuman('self');
    const after = produce(base(), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1, 2] } });
      runAllUntilEmpty(d);
      const pending = _drainPendingEffectPickSide();
      applyPickSkipAndContinuation(d, pending!);
    });
    expect(after.players.self.hand.length, 'decline → invoke なし').toBe(0);
    expect(after.players.self.evidence.slice(0, 3).every((e) => e.faceUp), 'cost は支払済').toBe(true);
  });

  it('【ターン1】: 宣言後 canDeclaredAbility=false (2回目不可)', () => {
    setHuman('self');
    const after = produce(base(), (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1, 2] } });
      runAllUntilEmpty(d);
      const pending = _drainPendingEffectPickSide();
      applyPickAndContinuation(d, pending!, pending!.candidates.find((c) => c.cardId === YH)!.uid);
    });
    expect(canDeclaredAbility(after, 'case:self', 'a2'), '同ターン2回目は宣言不可').toBe(false);
  });
});

// ============================================================
// condition gate — 【解決編】
// ============================================================
describe('B06036 a2 — condition caseStatus:解決編', () => {
  it('解決編 → 宣言可', () => {
    expect(canDeclaredAbility(base({ status: '解決編' }), 'case:self', 'a2')).toBe(true);
  });
  it('事件編 → 宣言不可 (rules/17 条件外 = 能力を持たない扱い)', () => {
    expect(canDeclaredAbility(base({ status: '事件編' }), 'case:self', 'a2')).toBe(false);
  });
});

// ============================================================
// cost gate — flipFaceUpEvidence 3つ (裏証拠3つなければ使用不可, rules/21)
// ============================================================
describe('B06036 a2 — cost flipFaceUpEvidence 3つ (canPay)', () => {
  const a2 = B06036.abilities.find((a) => a.id === 'a2')!;
  const ctx: EffectCtx = {
    source: { cardId: 'B06036', uid: 'case:self', abilityId: 'a2', player: 'self', area: 'case' },
    bindings: {},
  };
  it('裏証拠2つのみ → canPay=false (3つ表向きにできない)', () => {
    expect(engineCost.canPay(base({ evidence: [evd(YH), evd(NYH)] }), a2.cost!, ctx)).toBe(false);
  });
  it('裏証拠3つ → canPay=true', () => {
    expect(engineCost.canPay(base(), a2.cost!, ctx)).toBe(true);
  });
});

// ============================================================
// owner=opp pin — case:opp で side 反転しない (BUG-174)
// ============================================================
describe('B06036 a2 — owner=opp pin', () => {
  it('⑤ case:opp (human opp) → opp 側の証拠を flip・opp が pick・opp の【ヒラメキ】が opp を draw', () => {
    setHuman('opp');
    const after = produce(base({ side: 'opp' }), (d) => {
      activateDeclaredAbility(d, 'case:opp', 'a2', { flipFaceUpEvidence: { indices: [0, 1, 2] } });
      runAllUntilEmpty(d);
      const pending = _drainPendingEffectPickSide();
      expect(pending, 'opp owner human → pick surface').not.toBeNull();
      expect(pending!.player, 'chooser = opp').toBe('opp');
      const cand = pending!.candidates.find((c) => c.cardId === YH)!;
      expect(cand, '候補に YH').toBeTruthy();
      applyPickAndContinuation(d, pending!, cand.uid);
    });
    expect(after.players.opp.hand.length, 'opp が draw (invoke player=self=owner=opp)').toBe(1);
    expect(after.players.opp.evidence.slice(0, 3).every((e) => e.faceUp), 'opp の証拠3つ表向き').toBe(true);
    expect(after.players.self.hand.length, 'self は無影響').toBe(0);
  });
});
