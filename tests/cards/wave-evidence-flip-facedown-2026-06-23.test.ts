// wave-evidence-flip-facedown (2026-06-23) — engine拡張 evidenceFlipDown 有効化 + 出荷4枚の文言=処理検証
//   B05013 灰原哀 / B06017・B06017P 天草四郎時定 / B06019 クモ男
//
// engine拡張: 新 verb evidenceFlipDown「自分の表向きの証拠を N つまで選び、裏向きにする」(evidenceFlip=表向き化 の逆)。
//   atomHandAddFromRemove と同型 3-path (cardIds await / cardIds resolved multi / single short-form)。
//   candidates evidence に faceUp filter を additive 追加 / TargetQuery.faceUp / mutate.evidence.flipFaceDown。
//   evidenceFlipDown 使用カードは従来0 = 回帰ゼロ。evidenceFlip(faceup) は不変 (legacy 回帰 §8 で証跡)。
//
// 非 deck カード (MVP 外) は playwright 不可 → engine path を直接踏む (BUG-117/118 教訓を engine 層で):
//   ① candidates() で faceUp filter / side='self' 解決を decoy(裏向き証拠/相手証拠) 込みで witness
//   ② runAtom evidenceFlipDown で single/multi(cardIds)/duplicate-cardId/0枚/裏向きtarget-noop を decoy で witness
//   ③ 順番不変 (B05013 Q&A): flip 後も証拠配列位置が変わらないことを witness
//   ④ pick-await: short-form(max1,faceUp) / multi(cardIds:'$pick.cardIds') が pick を enqueue
//   ⑤ end-to-end: B05013 enter emit → runAllUntilEmpty → drainAiEffectPicks で「自分の表向き証拠2枚を裏向き化」
//   ⑥ B06017 enter conditional (sceneHas YAIBA excludeSelf) fire/skip + 変装/ヒラメキ descriptor
//   ⑦ B06019 enter caseStatus(事件編) gate + chain[discard 緑YAIBA, draw2] fire/skip
//   ⑧ legacy evidenceFlip(faceup) 回帰 (裏向き→表向き、不変証跡)
//   ⑨ card def 構造アサーション (trigger hook / evidenceFlipDown args / 変装 condition)
//
// rules: 03-field-areas / 09-cutin-disguise / 10-action-event / 11-reasoning / 15 / 17

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { candidates } from '@/engine/target/candidates';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _peekPendingEffectPickQueueLength, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import { B05013 } from '@/cards/ct-p05/B05013';
import { B06017 } from '@/cards/ct-p06/B06017';
import { B06017P } from '@/cards/ct-p06/B06017P';
import { B06019 } from '@/cards/ct-p06/B06019';
import type { GameState, EvidenceCard } from '@/engine/types';

const g = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };

function ev(cardId: string, faceUp = false): EvidenceCard {
  return { cardId, faceUp, origin: { turn: 1, via: 'opening' } };
}

function base(turnPlayer: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.deck = ['D1', 'D2', 'D3', 'D4'];
  s.players.opp.deck = ['O1', 'O2', 'O3', 'O4'];
  return s;
}

const ctxSelf = (cardId = 'B05013', uid = 'src#1') =>
  makeCtx({ source: { player: 'self', uid, cardId, area: 'scene' } });
const queueLen = () => _peekPendingEffectPickQueueLength();
const fired = (s: GameState) => (s.pendingEffects ?? []).length;

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerAll();
  registerTriggeredListener();
  _resetPendingHirameki();
  _clearPendingEffectPickQueue();
  g.__humanPlayerSide = null; // CPU 経路
});

// ============================================================
// ① candidates() — faceUp filter / side='self' 解決 (engine path)
// ============================================================
describe('candidates(): evidence faceUp filter + side 解決', () => {
  function stateWithEvidence(): GameState {
    const s = base('self');
    s.players.self.evidence = [ev('S_FU1', true), ev('S_FD', false), ev('S_FU2', true)];
    s.players.opp.evidence = [ev('O_FU', true)];
    return s;
  }
  const pickRef = (faceUp: boolean) => ({
    kind: 'pick' as const,
    query: { area: 'evidence' as const, side: 'self' as const, ...(faceUp ? { faceUp: true } : {}) },
    n: { min: 0, max: 2 },
    chooser: 'self' as const,
  });

  it('faceUp:true → 表向きの自証拠のみ候補 (裏向き decoy 除外)', () => {
    const cands = candidates(stateWithEvidence(), pickRef(true), ctxSelf());
    expect(cands.length).toBe(2); // S_FU1, S_FU2
    expect(cands.every(c => c.kind === 'evidence' && c.player === 'self')).toBe(true);
  });
  it('faceUp 無 → 裏向き含む全自証拠 (control: filter が効いている証跡)', () => {
    const cands = candidates(stateWithEvidence(), pickRef(false), ctxSelf());
    expect(cands.length).toBe(3);
  });
  it('side=self → 相手の証拠は候補に含めない (自分の証拠のみ)', () => {
    const cands = candidates(stateWithEvidence(), pickRef(true), ctxSelf());
    expect(cands.some(c => c.kind === 'evidence' && c.player === 'opp')).toBe(false);
  });
});

// ============================================================
// ② runAtom evidenceFlipDown — single (max:1 resolved) decoy witness
// ============================================================
describe('runAtom evidenceFlipDown: single (pick-resolved) + 順番不変', () => {
  it('指定の表向き自証拠を裏向き、裏向き decoy / 相手証拠は不変', () => {
    const s = base('self');
    s.players.self.evidence = [ev('S_FU', true), ev('S_FD', false)];
    s.players.opp.evidence = [ev('S_FU', true)]; // 同 cardId の相手証拠 = decoy (side self ゆえ触らない)
    const r = produce(s, d => { runAtom(d, 'evidenceFlipDown', { player: 'self', target: 'S_FU', faceUp: true }, ctxSelf()); });
    expect(r.players.self.evidence[0].faceUp, '自分の S_FU が裏向きに').toBe(false);
    expect(r.players.self.evidence[1].faceUp, '元から裏向きの decoy は不変').toBe(false);
    expect(r.players.opp.evidence[0].faceUp, '相手の同名 S_FU は不変 (player:self)').toBe(true);
  });
  it('順番不変 (B05013 Q&A): flip 後も配列の位置/cardId 並びは変わらない', () => {
    const s = base('self');
    s.players.self.evidence = [ev('A', true), ev('B', true), ev('C', true)];
    const r = produce(s, d => { runAtom(d, 'evidenceFlipDown', { player: 'self', target: 'B', faceUp: true }, ctxSelf()); });
    expect(r.players.self.evidence.map(e => e.cardId)).toEqual(['A', 'B', 'C']); // 位置不変
    expect(r.players.self.evidence.map(e => e.faceUp)).toEqual([true, false, true]); // B のみ裏向き
  });
  it('裏向きの target 指定 → no-op (表向きのみ flip、faceUp 候補限定と整合)', () => {
    const s = base('self');
    s.players.self.evidence = [ev('X', false)]; // 既に裏向き
    const r = produce(s, d => { runAtom(d, 'evidenceFlipDown', { player: 'self', target: 'X', faceUp: true }, ctxSelf()); });
    expect(r.players.self.evidence[0].faceUp).toBe(false); // 変化なし
  });
});

// ============================================================
// ③ runAtom evidenceFlipDown — multi (cardIds contract, B05013 enter「2つまで」)
// ============================================================
describe('runAtom evidenceFlipDown: multi (cardIds 解決済)', () => {
  it('cardIds 2件 → 各表向き証拠を裏向き', () => {
    const s = base('self');
    s.players.self.evidence = [ev('P', true), ev('Q', true), ev('R', true)];
    const r = produce(s, d => { runAtom(d, 'evidenceFlipDown', { player: 'self', cardIds: ['P', 'R'] }, ctxSelf()); });
    expect(r.players.self.evidence.map(e => e.faceUp)).toEqual([false, true, false]); // P,R 裏向き / Q 不変
  });
  it('同 cardId 2件 → 表向きの 2 個体を別々に裏向き (index-based, flipFaceDown が次個体を拾う)', () => {
    const s = base('self');
    s.players.self.evidence = [ev('DUP', true), ev('DUP', true), ev('OTHER', true)];
    const r = produce(s, d => { runAtom(d, 'evidenceFlipDown', { player: 'self', cardIds: ['DUP', 'DUP'] }, ctxSelf()); });
    expect(r.players.self.evidence.map(e => e.faceUp)).toEqual([false, false, true]); // DUP 両方裏向き
  });
  it('cardIds 空 (0枚 pick) → no-op (rules/15「N つまで」= 0 可)', () => {
    const s = base('self');
    s.players.self.evidence = [ev('Z', true)];
    const r = produce(s, d => { runAtom(d, 'evidenceFlipDown', { player: 'self', cardIds: [] }, ctxSelf()); });
    expect(r.players.self.evidence[0].faceUp).toBe(true); // 不変
  });
});

// ============================================================
// ④ pick-await: short-form / multi が pick を enqueue
// ============================================================
describe('evidenceFlipDown pick-await (enqueue 経路)', () => {
  it('short-form {max:1,faceUp} (target 未指定) → pick を enqueue', () => {
    const s = base('self');
    s.players.self.evidence = [ev('S_FU', true), ev('S_FD', false)];
    produce(s, d => { runAtom(d, 'evidenceFlipDown', { player: 'self', max: 1, faceUp: true }, ctxSelf()); });
    expect(queueLen()).toBe(1);
  });
  it('multi {cardIds:$pick.cardIds + target} → pick を enqueue', () => {
    const s = base('self');
    s.players.self.evidence = [ev('S_FU1', true), ev('S_FU2', true)];
    const target = { kind: 'pick', query: { area: 'evidence', side: 'self', faceUp: true }, n: { min: 0, max: 2 }, chooser: 'self' };
    produce(s, d => { runAtom(d, 'evidenceFlipDown', { player: 'self', cardIds: '$pick.cardIds', target }, ctxSelf()); });
    expect(queueLen()).toBe(1);
  });
});

// ============================================================
// ⑤ B05013 灰原哀 — 【登場時】自分の表向き証拠を2つまで選び裏向き (end-to-end)
// ============================================================
describe('B05013 灰原哀 — 登場時 evidenceFlipDown 2つまで (end-to-end)', () => {
  function board(): GameState {
    const s = base('self');
    s.players.self.scene = [sceneChar('B05013', 'h#1', { state: 'active' })];
    s.players.self.evidence = [ev('S_FU1', true), ev('S_FU2', true), ev('S_FD', false)]; // FD=decoy
    s.players.opp.evidence = [ev('O_FU', true)]; // 相手証拠 = decoy (side self)
    return s;
  }
  function emitEnter(s: GameState): GameState {
    return produce(s, d => {
      event.emit(d, 'enter', { uid: 'h#1', player: 'self', viaEffect: false }, { player: 'self', uid: 'h#1', cardId: 'B05013' });
    });
  }
  it('登場時 → 発火 (pendingEffects)', () => {
    expect(fired(emitEnter(board()))).toBe(1);
  });
  it('end-to-end: AI multi-pick → 表向き自証拠2枚を裏向き、裏向き decoy / 相手証拠は不変', () => {
    let s = emitEnter(board());
    s = produce(s, d => { runAllUntilEmpty(d); drainAiEffectPicks(d); });
    expect(s.players.self.evidence[0].faceUp, 'S_FU1 裏向き').toBe(false);
    expect(s.players.self.evidence[1].faceUp, 'S_FU2 裏向き').toBe(false);
    expect(s.players.self.evidence[2].faceUp, 'S_FD decoy は元から裏向き=不変').toBe(false);
    expect(s.players.opp.evidence[0].faceUp, '相手証拠は不変 (side self)').toBe(true);
  });
  it('descriptor: a1 enter selfOnly + evidenceFlipDown multi {cardIds, target faceUp n.max:2}; a2 hirameki short-form', () => {
    const a1 = B05013.abilities[0];
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'evidenceFlipDown', args: { player: 'self', cardIds: '$pick.cardIds' } });
    expect((a1.effect as { args: { target: { query: { faceUp: boolean }; n: { max: number } } } }).args.target.query.faceUp).toBe(true);
    expect((a1.effect as { args: { target: { n: { max: number } } } }).args.target.n.max).toBe(2);
    const a2 = B05013.abilities[1];
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'evidenceFlipDown', args: { player: 'self', max: 1, faceUp: true } });
  });
});

// ============================================================
// ⑥ B06017 天草四郎時定 — 登場時 conditional (sceneHas YAIBA excludeSelf) + 変装/ヒラメキ descriptor
// ============================================================
describe('B06017 天草四郎時定 — enter conditional + 変装/ヒラメキ', () => {
  function board(withOtherYaiba: boolean): GameState {
    const s = base('self');
    s.players.self.scene = withOtherYaiba
      ? [sceneChar('B06017', 't#1', { state: 'active' }), sceneChar('B06019', 'y#1', { state: 'active' })] // B06019=YAIBA decoy(=other)
      : [sceneChar('B06017', 't#1', { state: 'active' })];
    s.players.self.hand = [];
    return s;
  }
  function emitEnterResolve(s: GameState): GameState {
    return produce(s, d => {
      event.emit(d, 'enter', { uid: 't#1', player: 'self', viaEffect: false }, { player: 'self', uid: 't#1', cardId: 'B06017' });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
    });
  }
  it('+ : 自分の現場にこのキャラ以外の YAIBA がいる → カード1引く', () => {
    const r = emitEnterResolve(board(true));
    expect(r.players.self.hand.length, '1 draw').toBe(1);
  });
  it('DECOY: このキャラ以外の YAIBA がいない (自身のみ) → 引かない (excludeSelf gate)', () => {
    const r = emitEnterResolve(board(false));
    expect(r.players.self.hand.length, 'no draw (excludeSelf で自身は計数外)').toBe(0);
  });
  it('descriptor: a1 conditional sceneHas{trait YAIBA, excludeSelf}; a2 hirameki evidenceFlipDown; a3 変装 and[caseTrait YAIBA, fileAtLeast 5]', () => {
    const a1 = B06017.abilities[0];
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a1.effect).toMatchObject({ kind: 'conditional', if: { kind: 'sceneHas' } });
    expect((a1.effect as { if: { query: { excludeSelf: boolean; filter: { trait: string } } } }).if.query.excludeSelf).toBe(true);
    expect((a1.effect as { if: { query: { filter: { trait: string } } } }).if.query.filter.trait).toBe('YAIBA');
    const a2 = B06017.abilities[1];
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'evidenceFlipDown', args: { player: 'self', max: 1, faceUp: true } });
    const a3 = B06017.abilities[2];
    expect(a3.type).toBe('icon-disguise');
    expect(a3.condition).toMatchObject({ kind: 'and' });
    expect((a3.condition as { cs: { kind: string; trait?: string; n?: number }[] }).cs).toEqual([
      { kind: 'caseTrait', trait: 'YAIBA' },
      { kind: 'fileAtLeast', n: 5 },
    ]);
  });
  it('B06017P は B06017 と能力 byte 同一 (絵柄違い)', () => {
    expect(JSON.stringify(B06017P.abilities)).toBe(JSON.stringify(B06017.abilities));
    expect(B06017P.imageUrl).not.toBe(B06017.imageUrl);
    expect(B06017P.rarity).toBe('RP');
  });
});

// ============================================================
// ⑦ B06019 クモ男 — 【事件編】enter chain[discard 緑YAIBA, draw2]
// ============================================================
describe('B06019 クモ男 — 事件編 gate + discard→draw chain', () => {
  function board(caseStatus: '事件編' | '解決編', handCards: string[]): GameState {
    const s = base('self');
    s.players.self.case = { ...s.players.self.case, status: caseStatus };
    s.players.self.scene = [sceneChar('B06019', 'k#1', { state: 'active' })];
    s.players.self.hand = [...handCards];
    return s;
  }
  function emitEnterResolve(s: GameState): GameState {
    return produce(s, d => {
      event.emit(d, 'enter', { uid: 'k#1', player: 'self', viaEffect: false }, { player: 'self', uid: 'k#1', cardId: 'B06019' });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
    });
  }
  it('+ : 事件編 + 手札に緑YAIBA → discard 1 + draw 2 (hand: 1→2, remove に discard)', () => {
    const r = emitEnterResolve(board('事件編', ['B06017'])); // B06017=緑YAIBA
    expect(r.players.self.hand.length, 'discard 1 (B06017) + draw 2 = 2').toBe(2);
    expect(r.players.self.remove, 'discard した B06017 は remove へ').toContain('B06017');
  });
  it('DECOY: 解決編 → enter 不発 (【事件編】caseStatus gate)', () => {
    const r = emitEnterResolve(board('解決編', ['B06017']));
    expect(fired(r), '条件不成立で発火せず').toBe(0);
    expect(r.players.self.hand.length, 'discard も draw もなし').toBe(1);
  });
  it('DECOY: 事件編 + 手札に緑YAIBA なし → discard 0 → chain break → draw なし', () => {
    const r = emitEnterResolve(board('事件編', ['D99'])); // D99 = 緑YAIBA でない (未登録 = filter 不一致)
    expect(r.players.self.hand.length, 'discard 0 (候補なし) → draw skip → hand 不変').toBe(1);
  });
  it('descriptor: a1 caseStatus 事件編 + chain[discard{緑YAIBA}, draw n:2]; a2 hirameki evidenceFlipDown', () => {
    const a1 = B06019.abilities[0];
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a1.condition).toMatchObject({ kind: 'caseStatus', status: '事件編' });
    expect(a1.effect).toMatchObject({ kind: 'chain' });
    const steps = (a1.effect as { steps: { verb: string; args: Record<string, unknown> }[] }).steps;
    expect(steps[0]).toMatchObject({ verb: 'discard', args: { max: 1, filter: { color: '緑', trait: 'YAIBA' } } });
    expect(steps[1]).toMatchObject({ verb: 'draw', args: { n: 2 } });
    const a2 = B06019.abilities[1];
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'evidenceFlipDown', args: { player: 'self', max: 1, faceUp: true } });
  });
});

// ============================================================
// ⑧ legacy evidenceFlip (faceup) 回帰 — 不変証跡
// ============================================================
describe('legacy evidenceFlip (faceup) 回帰: 裏向き→表向き は不変', () => {
  it('evidenceFlip idx 形 → 裏向き証拠を表向き (evidenceFlipDown と逆方向、相互非干渉)', () => {
    const s = base('self');
    s.players.self.evidence = [ev('S1', false), ev('S2', false)];
    const r = produce(s, d => { runAtom(d, 'evidenceFlip', { player: 'self', idx: 0 }, ctxSelf()); });
    expect(r.players.self.evidence[0].faceUp, 'evidenceFlip は表向き化').toBe(true);
    expect(r.players.self.evidence[1].faceUp).toBe(false);
  });
});
