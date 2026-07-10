// tests/cards/night-w0/B03111 — バーボン probe (DEFER 解禁 clone、engine変更0)。
//   a1: 【パートナー黒】【登場時】相手手札公開 → その中からレベル7以下のカードを1枚まで「自分が」選び、
//       「相手が」それをリムーブする (chooser:'source' × hand-owner=opp の cross-side pick)。
//   engine primitive (atomDiscard chooser:'source' + buildShortFormPick side owner-相対) は
//   tests/cards/m2latter-cutin-filter.test.ts (B07100) が機構 pin 済。本 probe は実 shipped CardDef +
//   production dispatch (enter 実 hook emit → registerTriggeredListener → resolve/stack → pick side-channel)
//   で印字 ⇔ 挙動の 1対1 を decoy 同梱で固定。owner='opp' 逆側 pin 1本 (BUG-174/181 family)。
// rules: 15 (「1枚まで」=0可) / 17 (パートナー色 = 持っていない扱い) / 公式Q&A (選ぶのは自分)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered, _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import type { CardDef, GameState } from '@/engine/types';
import { B03111 } from '@/cards/ct-p03/B03111';

// 汎用 decoy def (character)
function plain(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}

beforeEach(() => {
  event._resetRegistry(); // handler 累積防止 (miniwave 慣行)
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  // human=self を明示 (null だと triggered listener 初期 walk が AI greedy で自動解決し pick が立たない)
  _setHumanPlayerSide('self');
});

afterEach(() => {
  _setHumanPlayerSide(null);
});

// ───────────────────────── 構造 (印字 ⇔ DSL 1対1) ─────────────────────────

describe('B03111 構造', () => {
  it('meta + a1 = enter sequence[log reveal, discard opp side:opp chooser:source levelMax:7]', () => {
    expect(B03111.no).toBe('0360/B03111');
    expect(B03111.kind).toBe('character');
    expect(B03111.names).toEqual(['バーボン']); // 単一名 (rules/19 分割対象外)
    expect(B03111.colors).toEqual(['黒']);
    expect(B03111.level).toBe(7);
    expect(B03111.ap).toBe(6000);
    expect(B03111.lp).toBe(1);
    expect(B03111.traits).toEqual(['黒ずくめの組織']);
    const a1 = B03111.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a1.condition).toEqual({ kind: 'partnerColor', color: '黒' });
    const seq = a1.effect as { kind: string; steps: Array<Record<string, unknown>> };
    expect(seq.kind).toBe('sequence');
    expect(seq.steps[0]).toMatchObject({ kind: 'atom', verb: 'log', args: { player: 'opp', action: 'reveal-hand' } });
    expect(seq.steps[1]).toMatchObject({
      kind: 'atom', verb: 'discard',
      args: { player: 'opp', side: 'opp', max: 1, chooser: 'source', filter: { levelMax: 7 } },
    });
    // 後段 conditional draw は無い (B07100 との差分)
    expect(seq.steps.length).toBe(2);
  });
});

// ───────────────────────── production 経路 (self 所有) ─────────────────────────

function enterProduction(s: GameState, player: 'self' | 'opp', cardId: string): string {
  // 'enter' は flow 層が emit する (mutate.scene.enter は emit しない)。flow と同一 payload 形で emit。
  const c = mutate.scene.enter(s, player, cardId, {});
  event.emit(s, 'enter',
    { uid: c.uid, viaEffect: false, enterOrder: c.enterOrder, enterOrderThisTurn: c.enterOrderThisTurn },
    { player, cardId, uid: c.uid });
  return c.uid;
}

describe('B03111 a1 — 登場時 cross-side pick (self 所有)', () => {
  function setup(oppHand: string[], selfPartner = 'PBLK'): GameState {
    registerCardDef(B03111);
    registerCardDef(plain('CAND7', { level: 7 }));                    // lv7≤7 char → 候補
    registerCardDef(plain('DECOY8', { level: 8 }));                   // lv8>7 → 除外
    registerCardDef(plain('EVT2', { kind: 'event', level: 2 }));      // lv2 event (kind filter 無 → 候補)
    registerCardDef(plain('PBLK', { colors: ['黒'] }));
    registerCardDef(plain('PRED', { colors: ['赤'] }));
    registerCardDef(plain('DKD'));
    registerTriggeredListener();
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'self' } as GameState['turn'];
    s.players.self.partner = { cardId: selfPartner, state: 'active', location: 'partner-area' };
    s.players.opp.partner = { cardId: 'PRED', state: 'active', location: 'partner-area' };
    s.players.opp.hand = [...oppHand];
    s.players.opp.deck = ['DKD'];
    return s;
  }

  it('登場 → opp 手札 pick、chooser=self / 候補=レベル7以下のみ (kind 不問, 8以下でなく7以下)', () => {
    const s = setup(['CAND7', 'DECOY8', 'EVT2']);
    enterProduction(s, 'self', 'B03111');
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('discard');
    expect(pending?.player).toBe('self');              // ★選ぶのは能力所有者 (chooser:'source')
    expect(pending?.nMin).toBe(0);                     // 「1枚まで」= 0枚可
    expect(pending?.nMax).toBe(1);
    // 候補 = CAND7 (lv7) + EVT2 (lv2 event、kind filter 無) の2枚。DECOY8 (lv8) は除外
    expect(pending!.candidates.map(c => c.cardId).sort()).toEqual(['CAND7', 'EVT2']);
    expect(pending!.candidates.every(c => c.player === 'opp')).toBe(true); // 全員 opp 手札
    // self が CAND7 を選択 → opp 手札からリムーブ
    const cand = pending!.candidates.find(c => c.cardId === 'CAND7')!;
    applyPickAndContinuation(s, pending!, cand.uid);
    expect(s.players.opp.hand).not.toContain('CAND7');
    expect(s.players.opp.remove).toContain('CAND7');
    expect(s.players.opp.hand).toContain('DECOY8'); // 元に戻す = 非選択カードは手札に残存
    expect(s.players.opp.hand).toContain('EVT2');
    expect(s.players.opp.deck).toEqual(['DKD']);     // draw follow-on 無 (デッキ不変)
  });

  it('「1枚まで」decline → リムーブなし (0枚可 rules/15)', () => {
    const s = setup(['CAND7', 'EVT2']);
    enterProduction(s, 'self', 'B03111');
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('discard');
    applyPickSkipAndContinuation(s, pending!, false); // 「リムーブしない」を選択
    expect(s.players.opp.hand.sort()).toEqual(['CAND7', 'EVT2']); // 手札不変
    expect(s.players.opp.remove).toEqual([]);
  });

  it('候補ゼロ (レベル7以下が手札に無い) → pick 立たず何も起きない', () => {
    const s = setup(['DECOY8', 'DECOY8']); // 全て lv8 > 7
    enterProduction(s, 'self', 'B03111');
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    // 候補ゼロなら pick は surface しない (or 空候補) — いずれにせよリムーブは起きない
    if (pending) expect(pending.candidates.length).toBe(0);
    expect(s.players.opp.remove).toEqual([]);
    expect(s.players.opp.hand.length).toBe(2);
  });

  it('【パートナー黒】不成立 (赤パートナー) → 不発火 (rules/17 持っていない扱い)', () => {
    const s = setup(['CAND7'], 'PRED');
    enterProduction(s, 'self', 'B03111');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(s.players.opp.hand).toEqual(['CAND7']);
    expect(s.players.opp.remove).toEqual([]);
  });
});

// ───────────────────────── owner='opp' 逆側 pin (BUG-174/181) ─────────────────────────

describe('B03111 a1 — opp 所有時 逆側 (side/chooser owner 相対解決)', () => {
  it('CPU(opp) が B03111 を所有 → self の手札を公開、opp が選び self がリムーブ', () => {
    _setHumanPlayerSide('opp'); // opp=human にして opp 側 pick を surface させる
    registerCardDef(B03111);
    registerCardDef(plain('CAND7', { level: 7 }));
    registerCardDef(plain('DECOY8', { level: 8 }));
    registerCardDef(plain('PBLK', { colors: ['黒'] }));
    registerCardDef(plain('PRED', { colors: ['赤'] }));
    registerTriggeredListener();
    const s = createEmptyGameState();
    s.turn = { number: 3, player: 'opp' } as GameState['turn'];
    s.players.opp.partner = { cardId: 'PBLK', state: 'active', location: 'partner-area' };
    s.players.self.partner = { cardId: 'PRED', state: 'active', location: 'partner-area' };
    s.players.self.hand = ['CAND7', 'DECOY8']; // ← 公開・リムーブ対象は self 側 (source の相手)
    enterProduction(s, 'opp', 'B03111');
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('discard');
    expect(pending?.player).toBe('opp');   // ★chooser = source 所有者 = opp (反転せず正)
    expect(pending!.candidates.map(c => c.cardId)).toEqual(['CAND7']); // self 手札の lv7 のみ
    expect(pending!.candidates.every(c => c.player === 'self')).toBe(true); // hand-owner = source の相手 = self
    applyPickAndContinuation(s, pending!, pending!.candidates[0]!.uid);
    expect(s.players.self.hand).not.toContain('CAND7');
    expect(s.players.self.remove).toContain('CAND7');
    expect(s.players.self.hand).toContain('DECOY8'); // 非選択は残存
  });
});
