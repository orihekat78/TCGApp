// wave-evidence-flip (2026-06-23) — engine拡張 evidence-flip-faceup 有効化 + 出荷5枚の文言=処理検証
//   B07064 ワトソン / B03076 世良真純 / B08085 シェリー / B09076 三池苗子 / B09076P 三池苗子
//
// engine拡張: evidenceFlip atom に (a) pick-form「(相手の)裏向きの証拠を1つまで選び、表向きにする」
//   (b) fromTop「上から1つ表向きにする」(c) candidates evidence の faceDown filter を additive 追加。
//   evidenceFlip 使用カードは従来0 = 回帰ゼロ。legacy idx 形は後方互換維持 (atom-handlers.test.ts)。
//
// 非 deck カード (MVP 外) は playwright 不可 → engine path を直接踏む:
//   ① candidates() で faceDown filter / side='opp' 解決を decoy(face-up証拠/自証拠) 込みで witness
//   ② runAtom evidenceFlip で fromTop(上から=末尾)/pick-resolved を decoy(bottom/自証拠/face-up) で witness
//   ③ enter/leave/疾風 hook を grounded payload で emit → 発火/不発を decoy gate(caseColor/turn/enterOrder) で witness
//   ④ end-to-end: enter emit → runAllUntilEmpty → drainAiEffectPicks で「裏向きの相手証拠のみ表向き化」を確認
//   ⑤ card def 構造アサーション (trigger hook / evidenceFlip args / cutin / hirameki)
//
// rules: 03-field-areas / 09-cutin-disguise / 10-action-event / 13-keywords / 15 / 17 / 22

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { candidates } from '@/engine/target/candidates';
import { mutate } from '@/engine/mutate/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _peekPendingEffectPickQueueLength, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import { B07064 } from '@/cards/ct-p07/B07064';
import { B03076 } from '@/cards/ct-p03/B03076';
import { B08085 } from '@/cards/ct-p08/B08085';
import { B09076 } from '@/cards/ct-p09/B09076';
import { B09076P } from '@/cards/ct-p09/B09076P';
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

const ctxSelf = () => makeCtx({ source: { player: 'self', uid: 'src#1', cardId: 'B07064', area: 'scene' } });
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
// ① candidates() — faceDown filter / side='opp' 解決 (engine path)
// ============================================================
describe('candidates(): evidence faceDown filter + side 解決', () => {
  function stateWithEvidence(): GameState {
    const s = base('self');
    s.players.opp.evidence = [ev('O_FD1', false), ev('O_FU', true), ev('O_FD2', false)];
    s.players.self.evidence = [ev('S_FD', false)];
    return s;
  }
  const pickRef = (faceDown: boolean) => ({
    kind: 'pick' as const,
    query: { area: 'evidence' as const, side: 'opp' as const, ...(faceDown ? { faceDown: true } : {}) },
    n: { min: 0, max: 1 },
    chooser: 'self' as const,
  });

  it('faceDown:true → 裏向きの相手証拠のみ候補 (face-up decoy 除外)', () => {
    const cands = candidates(stateWithEvidence(), pickRef(true), ctxSelf());
    expect(cands.length).toBe(2); // O_FD1, O_FD2
    expect(cands.every(c => c.kind === 'evidence' && c.player === 'opp')).toBe(true);
  });
  it('faceDown 無 → 表向き含む全相手証拠 (control: filter が効いている証跡)', () => {
    const cands = candidates(stateWithEvidence(), pickRef(false), ctxSelf());
    expect(cands.length).toBe(3);
  });
  it('side=opp → 自分の証拠は候補に含めない (相手の証拠 を scout)', () => {
    const cands = candidates(stateWithEvidence(), pickRef(true), ctxSelf());
    expect(cands.some(c => c.kind === 'evidence' && c.player === 'self')).toBe(false);
  });
});

// ============================================================
// ② runAtom evidenceFlip — fromTop / pick-resolved (decoy witness)
// ============================================================
describe('runAtom evidenceFlip: fromTop (上から=末尾) + pick-resolved', () => {
  it('fromTop: 相手証拠の上から(末尾)1つを表向き、bottom と自証拠は不変', () => {
    const s = base('self');
    s.players.opp.evidence = [ev('O_BOTTOM', false), ev('O_TOP', false)];
    s.players.self.evidence = [ev('S1', false)];
    const r = produce(s, d => { runAtom(d, 'evidenceFlip', { player: 'opp', fromTop: true }, ctxSelf()); });
    expect(r.players.opp.evidence[1].faceUp, '上から(末尾)=O_TOP が表向き').toBe(true);
    expect(r.players.opp.evidence[0].faceUp, 'bottom decoy は不変').toBe(false);
    expect(r.players.self.evidence[0].faceUp, '自証拠は不変 (player:opp)').toBe(false);
  });
  it('fromTop: 相手証拠0枚 → no-op (throw しない)', () => {
    const s = base('self');
    s.players.opp.evidence = [];
    expect(() => produce(s, d => { runAtom(d, 'evidenceFlip', { player: 'opp', fromTop: true }, ctxSelf()); })).not.toThrow();
  });
  it('pick-resolved (target=cardId): 指定の裏向き相手証拠を表向き、自証拠不変', () => {
    const s = base('self');
    s.players.opp.evidence = [ev('O1', false), ev('O2', false)];
    s.players.self.evidence = [ev('O1', false)]; // 同 cardId の自証拠 = decoy (player:opp なので触らない)
    const r = produce(s, d => { runAtom(d, 'evidenceFlip', { player: 'opp', target: 'O1', faceDown: true }, ctxSelf()); });
    expect(r.players.opp.evidence[0].faceUp, '相手の O1 が表向き').toBe(true);
    expect(r.players.opp.evidence[1].faceUp).toBe(false);
    expect(r.players.self.evidence[0].faceUp, '自分の同名 O1 は不変').toBe(false);
  });
  it('legacy idx 形 (後方互換): {player,idx} で指定 idx を表向き', () => {
    const s = base('self');
    s.players.self.evidence = [ev('S1', false), ev('S2', false)];
    const r = produce(s, d => { runAtom(d, 'evidenceFlip', { player: 'self', idx: 1 }, ctxSelf()); });
    expect(r.players.self.evidence[1].faceUp).toBe(true);
    expect(r.players.self.evidence[0].faceUp).toBe(false);
  });
});

// ============================================================
// ③④ B07064 ワトソン — 【登場時】相手裏向き証拠1つまで選び表向き (end-to-end)
// ============================================================
describe('B07064 ワトソン — 登場時 evidenceFlip pick (end-to-end)', () => {
  function board(): GameState {
    const s = base('self');
    s.players.self.scene = [sceneChar('B07064', 'w#1', { state: 'active' })];
    s.players.opp.evidence = [ev('O_FD', false), ev('O_FU', true)]; // FU=decoy
    s.players.self.evidence = [ev('S1', false)];
    return s;
  }
  function emitEnter(s: GameState, uid: string, cardId: string): GameState {
    return produce(s, d => {
      event.emit(d, 'enter', { uid, player: 'self', viaEffect: false }, { player: 'self', uid, cardId });
    });
  }

  it('登場時 → 発火 (pendingEffects)', () => {
    expect(fired(emitEnter(board(), 'w#1', 'B07064'))).toBe(1);
  });
  it('end-to-end: 効果解決 + AI pick → 裏向きの相手証拠のみ表向き化、face-up decoy / 自証拠は不変', () => {
    let s = emitEnter(board(), 'w#1', 'B07064');
    s = produce(s, d => { runAllUntilEmpty(d); drainAiEffectPicks(d); });
    expect(s.players.opp.evidence[0].faceUp, 'O_FD が表向きに (AI が唯一の裏向き候補を選択)').toBe(true);
    expect(s.players.opp.evidence[1].faceUp, 'O_FU decoy は不変 (faceDown filter で候補外)').toBe(true); // 元から true
    expect(s.players.self.evidence[0].faceUp, '自証拠は不変').toBe(false);
  });
  it('descriptor: enter selfOnly + evidenceFlip{player:opp,max:1,faceDown:true}', () => {
    const a1 = B07064.abilities[0];
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'evidenceFlip', args: { player: 'opp', max: 1, faceDown: true } });
  });
});

// ============================================================
// B03076 世良真純 — 【登場時】相手証拠 上から1つ表向き (fromTop) + ヒラメキ draw
// ============================================================
describe('B03076 世良真純 — 登場時 fromTop + ヒラメキ', () => {
  it('end-to-end: 登場 → 相手証拠の上から(末尾)1つ表向き', () => {
    const s0 = base('self');
    s0.players.self.scene = [sceneChar('B03076', 's#1', { state: 'active' })];
    s0.players.opp.evidence = [ev('O_BOTTOM', false), ev('O_TOP', false)];
    let s = produce(s0, d => {
      event.emit(d, 'enter', { uid: 's#1', player: 'self', viaEffect: false }, { player: 'self', uid: 's#1', cardId: 'B03076' });
    });
    s = produce(s, d => { runAllUntilEmpty(d); });
    expect(s.players.opp.evidence[1].faceUp, '上から(末尾) が表向き').toBe(true);
    expect(s.players.opp.evidence[0].faceUp, 'bottom は不変').toBe(false);
  });
  it('descriptor: a1 enter selfOnly + evidenceFlip{player:opp,fromTop:true}; a2 hirameki draw', () => {
    expect(B03076.abilities[0].effect).toMatchObject({ kind: 'atom', verb: 'evidenceFlip', args: { player: 'opp', fromTop: true } });
    const a2 = B03076.abilities[1];
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } });
  });
});

// ============================================================
// B08085 シェリー — 【事件青＆黒】【相手ターン中】【現場リムーブ時】flip + cutin
// ============================================================
describe('B08085 シェリー — leave gate (caseColor 青&黒 + 相手ターン中)', () => {
  // 自然な leave:to-remove 発火 (cluster15 同流儀): B08085 を現場に enter → removeToRemove。
  // selfOnly leave = 自身が除去されたとき発火 (D01012 a1 同型)。
  function runLeave(turnPlayer: 'self' | 'opp', caseColors: string[]): GameState {
    const s0 = base(turnPlayer);
    s0.players.self.case = { ...s0.players.self.case, colors: caseColors };
    s0.players.opp.evidence = [ev('O_FD', false)];
    return produce(s0, d => {
      const sh = mutate.scene.enter(d, 'self', 'B08085', {});
      mutate.scene.removeToRemove(d, sh.uid, 'effect');
    });
  }
  it('+ : 相手ターン中 + 事件青&黒 → 発火', () => {
    expect(fired(runLeave('opp', ['青', '黒']))).toBe(1);
  });
  it('DECOY: 自分ターン中 → 不発 (【相手ターン中】gate)', () => {
    expect(fired(runLeave('self', ['青', '黒']))).toBe(0);
  });
  it('DECOY: 事件が青のみ (黒なし) → 不発 (【事件青＆黒】and gate)', () => {
    expect(fired(runLeave('opp', ['青']))).toBe(0);
  });
  it('descriptor: leave selfOnly + and[caseColor青&黒, turn opp] + evidenceFlip pick; cutin a2 turn:self AP+2000', () => {
    const a1 = B08085.abilities[0];
    expect(a1.trigger).toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
    expect(a1.condition).toMatchObject({ kind: 'and' });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'evidenceFlip', args: { player: 'opp', max: 1, faceDown: true } });
    const a2 = B08085.abilities[1];
    expect(a2.trigger).toMatchObject({ hook: 'effect:declared', optional: true, selfOnly: true });
    expect(a2.condition).toMatchObject({ kind: 'turn', player: 'self' });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } });
  });
});

// ============================================================
// B09076 / B09076P 三池苗子 — 【疾風】flip + cutin
// ============================================================
describe('B09076 三池苗子 — 疾風 gate (enterOrderThisTurn===1)', () => {
  function board(order: number): GameState {
    const s = base('self');
    s.players.self.scene = [sceneChar('B09076', 'm#1', { state: 'active', enterOrderThisTurn: order })];
    s.players.opp.evidence = [ev('O_FD', false)];
    return s;
  }
  function emitEnter(s: GameState): GameState {
    const order = s.players.self.scene[0]!.enterOrderThisTurn ?? 1;
    return produce(s, d => {
      // 疾風 = enterOrderEquals が payload.enterOrderThisTurn を読む (eval.ts) ため payload に載せる
      event.emit(d, 'enter', { uid: 'm#1', player: 'self', viaEffect: false, enterOrderThisTurn: order }, { player: 'self', uid: 'm#1', cardId: 'B09076' });
    });
  }
  it('+ : このターン1番目に登場 (enterOrderThisTurn=1) → 発火', () => {
    expect(fired(emitEnter(board(1)))).toBe(1);
  });
  it('DECOY: 2番目に登場 (enterOrderThisTurn=2) → 不発 (【疾風】enterOrderEquals n:1)', () => {
    expect(fired(emitEnter(board(2)))).toBe(0);
  });
  it('descriptor B09076/B09076P: enter selfOnly + enterOrderEquals1 + evidenceFlip pick; cutin AP+2000', () => {
    for (const def of [B09076, B09076P]) {
      const a1 = def.abilities[0];
      expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } });
      expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'evidenceFlip', args: { player: 'opp', max: 1, faceDown: true } });
      const a2 = def.abilities[1];
      expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, scope: 'contact' } });
    }
  });
});

// ============================================================
// ⑤ pick enqueue 確認 (短縮形が pick queue に積む = trigger→atom 配線)
// ============================================================
describe('evidenceFlip 短縮形 pick が queue へ enqueue (配線確認)', () => {
  it('B07064 登場時効果解決 → __pendingEffectPickQueue に evidence pick が積まれる (human 経路)', () => {
    g.__humanPlayerSide = 'self'; // human 経路: pick は queue に積まれ UI 解決待ち (CPU は runAllUntilEmpty で auto-drain)
    const s0 = base('self');
    s0.players.self.scene = [sceneChar('B07064', 'w#1', { state: 'active' })];
    s0.players.opp.evidence = [ev('O_FD', false)];
    produce(s0, d => {
      event.emit(d, 'enter', { uid: 'w#1', player: 'self', viaEffect: false }, { player: 'self', uid: 'w#1', cardId: 'B07064' });
      runAllUntilEmpty(d);
      expect(queueLen(), 'evidence pick が enqueue された').toBeGreaterThanOrEqual(1);
    });
    _clearPendingEffectPickQueue();
  });
});
