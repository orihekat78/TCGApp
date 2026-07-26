// M2後半 batch — D06003 family (服部平次 ×4 printings) + B07100 コルン の card probe。
// engine primitive (TargetFilter.cutinTextIncludes / atomDiscard chooser:'source') は
// tests/engine/effect/m2latter-setcard-turn-filter.test.ts (P9/P11) が機構 pin 済。
// 本 probe は **実 shipped CardDef + production dispatch** (flow.action.declare の実 emit /
// enter は flow 層と同一 payload 形の hook emit → registerTriggeredListener → resolve/stack →
// pick side-channel) で印字テキスト ⇔ 挙動の 1対1 を decoy 同梱で固定する。
// rules: 07/09/15/17/22/25 + TSV qAndA (D06003: ウォッカ除外名指し / B07100: presence 静的判定)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered, _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { declare, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { makeChar } from '../helpers/fixtures';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { D06003 } from '@/cards/ct-d06/D06003';
import { D06004 } from '@/cards/ct-d06/D06004';
import { D06021 } from '@/cards/ct-d06/D06021';
import { D06023 } from '@/cards/ct-d06/D06023';
import { B07100 } from '@/cards/ct-p07/B07100';
import { B06084 } from '@/cards/ct-p06/B06084'; // AP＋ cutin 持ち (【カットイン】AP＋2000) — D06003 候補側
import { B01097 } from '@/cards/ct-p01/B01097'; // ウォッカ: draw 型 cutin (「AP＋」を含まない) — qAndA 名指し decoy

// 汎用 decoy def
function plain(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}

// 【カットイン】持ち decoy (abilityIsCutin 形状: triggered + on-hand + effect:declared + optional)
function cutinHolder(id: string, level: number, desc: string): CardDef {
  const cutin: AbilityDef = {
    id: 'a1',
    type: 'triggered',
    scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
    effect: { kind: 'atom', verb: 'noop', args: {} },
    description: desc,
    ruleRefs: [],
  };
  return plain(id, { level, abilities: [cutin] });
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetActionContexts();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  // human pick surfacing: __humanPlayerSide が null (既定) だと triggered listener の初期 walk が
  // AI policy で greedy 自動解決し pick が side-channel に立たない。self=human を明示する。
  _setHumanPlayerSide('self');
});

afterEach(() => {
  _setHumanPlayerSide(null);
});

// ───────────────────────── D06003 服部平次 ─────────────────────────

describe('D06003 構造 (印字 ⇔ DSL 1対1)', () => {
  it('meta + a1 (事件緑&白 突撃) + a2 (action:declare → handAddFromRemove cutinTextIncludes AP＋)', () => {
    expect(D06003.no).toBe('0167/D06003');
    expect(D06003.colors).toEqual(['緑']);
    expect(D06003.level).toBe(8);
    expect(D06003.ap).toBe(7000);
    expect(D06003.lp).toBe(2);
    expect(D06003.traits).toEqual(['探偵', '高校生']);
    const a1 = D06003.abilities[0];
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toEqual({ kind: 'caseColor', color: ['緑', '白'], combine: 'and' });
    expect(a1.continuousModifier?.grantKeywords?.(
      undefined as never, undefined as never)).toEqual(['突撃']);
    const a2 = D06003.abilities[1];
    expect(a2.type).toBe('triggered');
    expect(a2.trigger).toMatchObject({ hook: 'action:declare', selfOnly: true });
    expect(a2.condition).toEqual({ kind: 'partnerColor', color: '緑' });
    expect(a2.limit).toEqual({ kind: 'turn', n: 1 });
    expect(a2.effect).toMatchObject({
      kind: 'atom', verb: 'handAddFromRemove',
      args: { player: 'self', max: 1, filter: { cutinTextIncludes: 'AP＋' } },
    });
  });

  it('D06004/D06021/D06023 = 同文 printings (DSL 同一、id/no/imageUrl のみ差)', () => {
    const shape = (c: CardDef) => JSON.stringify({ ...c, id: '', no: '', imageUrl: '' });
    for (const c of [D06004, D06021, D06023]) {
      expect(shape(c)).toBe(shape(D06003));
    }
    expect(D06004.no).toBe('0167/D06004');
    expect(D06021.no).toBe('0167/D06021');
    expect(D06023.no).toBe('0167/D06023');
  });
});

describe('D06003 a2 — production 経路 (flow.action.declare → 実 listener → pick)', () => {
  function setup(partnerCardId = 'PGRN'): GameState {
    registerCardDef(D06003);
    registerCardDef(B06084);   // 【カットイン】AP＋2000 持ち → 候補
    registerCardDef(B01097);   // ウォッカ: 【カットイン】draw型 (AP＋を含まない) → qAndA どおり候補外
    registerCardDef(plain('NOCUT'));  // cutin なし decoy
    registerCardDef(plain('PGRN', { colors: ['緑'] }));
    registerCardDef(plain('PRED', { colors: ['赤'] }));
    registerCardDef(plain('TGT'));
    registerTriggeredListener();
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'self' } as GameState['turn'];
    s.players.self.partner = { cardId: partnerCardId, state: 'active', location: 'partner-area' };
    s.players.opp.partner = { cardId: 'PRED', state: 'active', location: 'partner-area' };
    s.players.self.scene.push(makeChar({ uid: 'u-hattori', cardId: 'D06003', state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'u-tgt', cardId: 'TGT', state: 'sleep' }));
    s.players.self.remove = ['B06084', 'B01097', 'NOCUT'];
    return s;
  }

  it('action[キャラ] 宣言 → pick surface。候補 = AP＋ cutin 持ちのみ (ウォッカ decoy 除外) → 手札へ', () => {
    const s = setup();
    declare(s, 'u-hattori', { kind: 'char', uid: 'u-tgt' });
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('handAddFromRemove');
    expect(pending?.nMin).toBe(0); // 「1枚まで」= 0枚可 (rules/15)
    expect(pending?.nMax).toBe(1);
    // 候補 = B06084 (【カットイン】AP＋2000) のみ。B01097 ウォッカ (draw型 cutin) と NOCUT は除外
    expect(pending!.candidates.map(c => c.cardId)).toEqual(['B06084']);
    // human が選択 → 手札に加わる (remove から splice)
    applyPickAndContinuation(s, pending!, pending!.candidates[0]!.uid);
    expect(s.players.self.hand).toContain('B06084');
    expect(s.players.self.remove).not.toContain('B06084');
    expect(s.players.self.remove).toContain('B01097'); // decoy は残存
  });

  it('【ターン1】: 同ターン 2 回目の action では pick が立たない', () => {
    const s = setup();
    declare(s, 'u-hattori', { kind: 'char', uid: 'u-tgt' });
    runAllUntilEmpty(s);
    const first = _drainPendingEffectPickSide();
    expect(first?.atomVerb).toBe('handAddFromRemove');
    applyPickAndContinuation(s, first!, first!.candidates[0]!.uid);
    // 再アクティブ化して同ターン 2 回目
    mutate.scene.setState(s, 'u-hattori', 'active');
    mutate.scene.setState(s, 'u-tgt', 'sleep');
    declare(s, 'u-hattori', { kind: 'char', uid: 'u-tgt' });
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide()).toBeNull(); // limit turn 1 で不発
  });

  it('【パートナー緑】: パートナーが緑以外 → 不発火 (pick なし)', () => {
    const s = setup('PRED'); // 赤パートナー
    declare(s, 'u-hattori', { kind: 'char', uid: 'u-tgt' });
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(s.players.self.hand).toEqual([]);
  });
});

// ───────────────────────── B07100 コルン ─────────────────────────

describe('B07100 構造 (印字 ⇔ DSL 1対1)', () => {
  it('meta + a1 = enter sequence[log reveal, chain[discard opp chooser:source cutin lv8以下, conditional handAtMost4 → draw]]', () => {
    expect(B07100.no).toBe('0827/B07100');
    expect(B07100.colors).toEqual(['黒']);
    expect(B07100.level).toBe(6);
    expect(B07100.ap).toBe(5000);
    expect(B07100.lp).toBe(1);
    expect(B07100.traits).toEqual(['黒ずくめの組織']);
    const a1 = B07100.abilities[0];
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a1.condition).toEqual({ kind: 'partnerColor', color: '黒' });
    const seq = a1.effect as { kind: string; steps: Array<Record<string, unknown>> };
    expect(seq.kind).toBe('sequence');
    expect(seq.steps[0]).toMatchObject({ kind: 'atom', verb: 'handReveal', args: { player: 'opp', all: true, audience: 'all', lifetime: 'effect' } });
    const chain = seq.steps[1] as { kind: string; steps: Array<Record<string, unknown>> };
    expect(chain.kind).toBe('chain');
    expect(chain.steps[0]).toMatchObject({
      kind: 'atom', verb: 'discard',
      args: { player: 'opp', max: 1, chooser: 'source', filter: { keyword: 'カットイン', levelMax: 8 } },
    });
    expect(chain.steps[1]).toMatchObject({
      kind: 'conditional',
      if: { kind: 'handAtMost', player: 'opp', n: 4 },
      then: { kind: 'atom', verb: 'draw', args: { player: 'opp', n: 1 } },
    });
  });
});

describe('B07100 a1 — production 経路 (enter 実 hook emit → 実 listener → cross-side pick)', () => {
  // 'enter' は flow 層 (hand-use-card.ts:261 / next-hint.ts) が emit する (mutate.scene.enter は emit しない)。
  // 本 probe は scene 配置後に flow と同一 payload 形で emit する (wave2-cluster3 / granted-ability test と同方式)。
  function enterProduction(s: GameState, player: 'self' | 'opp', cardId: string): string {
    const c = mutate.scene.enter(s, player, cardId, {});
    event.emit(s, 'enter',
      { uid: c.uid, viaEffect: false, enterOrder: c.enterOrder, enterOrderThisTurn: c.enterOrderThisTurn },
      { player, cardId, uid: c.uid });
    return c.uid;
  }

  function setup(oppHand: string[], partnerCardId = 'PBLK'): GameState {
    registerCardDef(B07100);
    registerCardDef(cutinHolder('CUT3', 3, '【カットイン】AP＋2000'));       // cutin ∧ lv3≤8 → 候補
    registerCardDef(cutinHolder('CUT9', 9, '【カットイン】AP＋2000'));       // cutin だが lv9>8 → 除外
    registerCardDef(plain('NOCUT2', { level: 2 }));                            // lv2≤8 だが cutin なし → 除外
    registerCardDef(plain('PBLK', { colors: ['黒'] }));
    registerCardDef(plain('PRED', { colors: ['赤'] }));
    registerCardDef(plain('FILL1'));
    registerCardDef(plain('FILL2'));
    registerCardDef(plain('DKD'));
    registerTriggeredListener();
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'self' } as GameState['turn'];
    s.players.self.partner = { cardId: partnerCardId, state: 'active', location: 'partner-area' };
    s.players.opp.partner = { cardId: 'PRED', state: 'active', location: 'partner-area' };
    s.players.opp.hand = [...oppHand];
    s.players.opp.deck = ['DKD'];
    return s;
  }

  it('登場 → reveal→discard chain が queue され、opp 手札 pick の chooser = self / 候補 = cutin∧lv8以下のみ', () => {
    const s = setup(['CUT3', 'CUT9', 'NOCUT2', 'FILL1']); // 4枚 → リムーブ後3 ≤4
    enterProduction(s, 'self', 'B07100');
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('discard');
    expect(pending?.player).toBe('self');          // ★選ぶのは能力所有者 (chooser:'source')
    expect(pending?.nMin).toBe(0);                 // 「1枚まで」= 0枚可
    expect(pending?.nMax).toBe(1);
    // 候補 = CUT3 のみ (CUT9 は levelMax:8 で除外 / NOCUT2・FILL1 は keyword で除外)、全員 opp 手札
    expect(pending!.candidates.map(c => c.cardId)).toEqual(['CUT3']);
    expect(pending!.candidates.every(c => c.player === 'opp')).toBe(true);
    // human (self) が CUT3 を選択 → opp 手札からリムーブ → 手札3 ≤4 → opp が1枚引く
    applyPickAndContinuation(s, pending!, pending!.candidates[0]!.uid);
    expect(s.players.opp.hand).not.toContain('CUT3');
    expect(s.players.opp.hand).toContain('DKD');   // 後段 draw 発火 (handAtMost はリムーブ後判定 rules/25)
    // DKD 取得で exact exhaustion → discard 済み CUT3 を即 refresh (rules/14, 26)。
    expect(s.players.opp.remove).toHaveLength(0);
    expect(s.players.opp.deck).toEqual(['CUT3']);
    expect(s.refreshCount.opp).toBe(1);
    expect(s.players.self.evidence).toHaveLength(1);
  });

  it('リムーブ後も手札5 (>4) → draw 不発火 (handAtMost 前段適用後判定)', () => {
    const s = setup(['CUT3', 'CUT9', 'NOCUT2', 'FILL1', 'FILL2', 'FILL1']); // 6枚 → リムーブ後5 >4
    enterProduction(s, 'self', 'B07100');
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    applyPickAndContinuation(s, pending!, pending!.candidates[0]!.uid);
    expect(s.players.opp.remove).toContain('CUT3');
    expect(s.players.opp.hand).not.toContain('DKD'); // draw なし
    expect(s.players.opp.deck).toEqual(['DKD']);
  });

  it('「1枚まで」decline → リムーブなし → 後段 draw も skip (chain gate)', () => {
    const s = setup(['CUT3', 'FILL1']); // 候補あり (decline path を踏む)。decline 時 手札2 ≤4 でも draw してはならない
    enterProduction(s, 'self', 'B07100');
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('discard');
    applyPickSkipAndContinuation(s, pending!, false); // human が「リムーブしない」を選択
    expect(s.players.opp.hand).toEqual(['CUT3', 'FILL1']); // 手札不変
    expect(s.players.opp.remove).toEqual([]);
    expect(s.players.opp.deck).toEqual(['DKD']);           // draw skip (chain gate)
  });

  it('【パートナー黒】: パートナーが黒以外 → 不発火', () => {
    const s = setup(['CUT3'], 'PRED');
    enterProduction(s, 'self', 'B07100');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(s.players.opp.hand).toEqual(['CUT3']);
  });
});
