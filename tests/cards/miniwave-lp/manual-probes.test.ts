// tests/cards/miniwave-lp/manual-probes
// miniwave-lp 手書き probe: gen-card-probes.cjs が扱えない hook (reasoning:after-sleep / action:declare /
//   leave:to-remove / evidence:remove-by-action) を **production dispatch 経路** で駆動して検証する
//   (BUG-171 慣行: engine 内部を bypass しない)。engine / src/cards は変更しない (probe のみ)。
//
// 対象 / 駆動:
//   B01045 中森青子 a2 —
//     triggered reasoning:after-sleep / action:declare (共有 limit【ターン1】), matcherCondition
//       triggerCharMatches{side:'opp', filter:{}} = 「相手の現場にいるキャラが推理かアクションしたとき」。
//     effect optional → chain[mill 5 gate:true, charOverrideLP $trigger.uid 0 turn, charOverrideAP 同 0 turn]。
//     = 「デッキ5枚リムーブしてもよい。そうした場合、ターン終了時までそのキャラの元LP/元APを0にする」。
//     production reasoning:after-sleep emit (reasoning.ts payload {uid,player}) を実キャラで直叩き。
//   B01054 寺井黄之助 a1/a2 —
//     a1 triggered leave:to-remove selfOnly +【相手ターン中】→ bindPick 1(side either) → forEach charOverrideLP 0 turn。
//        production 除去経路 = mutate.scene.removeToRemove(自身,'effect') が leave:to-remove emit (scene.ts:317)。
//     a2【ヒラメキ】evidence:remove-by-action → draw。実 draw は UI 委譲ゆえ engine 層は pendingHirameki push を pin
//        (hybrid-batch3 B06104 慣行)。
//   BUG-179 shipped-card regression (同 filter:{} anti-pattern の回帰 gate):
//     B05080 a2 (side:'opp', filter:{}) — opp PARTNER 推理では発火せず / opp 現場キャラ推理で発火 (discard prompt)。
//     B03096 a1 (side:'self', filter:{}) — 自 PARTNER 推理では発火せず / 自 現場キャラ推理で souza 実行 (opp デッキ上→下)。
//
// 手法: 各 hook の production emit / mutate を実カードで直接叩く direct engine test。fake emit は
//   production payload 形状 (reasoning.ts / state-machine.ts / action-case.ts) を厳密模倣。
// rules: 03/07/10/11/13/15/17/19/22/26

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createMainGameState as createEmptyGameState } from '../../helpers/main-game-state';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _peekPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import {
  _drainPendingEffectPickSide,
  _drainPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import {
  applyPickAndContinuation,
  applyOptionalAndContinuation,
} from '@/engine/effect/apply-pick';
import { B01045 } from '@/cards/ct-p01/B01045';
import { B01054 } from '@/cards/ct-p01/B01054';
import { B05080 } from '@/cards/ct-p05/B05080';
import { B03096 } from '@/cards/ct-p03/B03096';
import type { CardDef, GameState } from '@/engine/types';

// ---- fixtures ----
function charDef(id: string, o: { names?: string[]; ap?: number; lp?: number; level?: number } = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: o.names ?? [id], colors: ['赤'],
    level: o.level ?? 3, ap: o.ap ?? 4000, lp: o.lp ?? 3, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  };
}
const REASONER = charDef('REASONER', { ap: 4000, lp: 3 });   // 相手/自 現場で推理するキャラ (override/discard 対象)
const TARGET = charDef('TARGET', { ap: 5000, lp: 4 });        // B01054 a1 の override 対象 (自現場)
const OPPT = charDef('OPPT', { ap: 6000, lp: 2 });            // B01054 a1 の override 対象 (opp現場)
const DK = charDef('DK', {});
const OTOP = charDef('OTOP', { level: 4 });                   // B03096 souza: opp デッキ上 (lv8未満 → draw なし)
const O2 = charDef('O2', { level: 2 });
const O3 = charDef('O3', { level: 2 });
const HANDCARD = charDef('HANDCARD', {});                     // B05080 discard 弾

const FIXTURES = [REASONER, TARGET, OPPT, DK, OTOP, O2, O3, HANDCARD, B01045, B01054, B05080, B03096];

function setHuman(s: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
}

function base(turn: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turn, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['DK', 'DK', 'DK', 'DK', 'DK', 'DK'];
  s.players.opp.deck = ['DK', 'DK', 'DK', 'DK'];
  return s;
}

// production reasoning:end emit payload (reasoning.ts:140) = { uid, player, gained } / source { player, uid }。
function emitReasoningEnd(s: GameState, side: 'self' | 'opp', uid: string): void {
  event.emit(s, 'reasoning:end', { uid, player: side, gained: 1 }, { player: side, uid });
}
function emitReasoningAfterSleep(s: GameState, side: 'self' | 'opp', uid: string): void {
  event.emit(s, 'reasoning:after-sleep', { uid, player: side }, { player: side, uid });
}
// production action:declare emit payload (state-machine.ts:199) = { byUid, target, uid, player, targetUid }。
function emitActionDeclare(s: GameState, side: 'self' | 'opp', uid: string): void {
  event.emit(
    s, 'action:declare',
    { byUid: uid, target: { kind: 'case', player: side === 'self' ? 'opp' : 'self' }, uid, player: side, targetUid: undefined },
    { player: side, uid },
  );
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _resetPendingHirameki();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  for (const f of FIXTURES) registerCardDef(f);
  registerTriggeredListener();
  setHuman('self');
});

// ============================================================================
// B01045 中森青子 a2 — reasoning:after-sleep / action:declare → optional → chain(mill5 gate + override LP/AP 0)
// ============================================================================
describe('B01045 a2【ターン1】相手の現場キャラが推理/アクション → mill5してもよい→そのキャラ 元LP/元AP を0 (ターン終了時まで)', () => {
  // B01045 (自現場) + REASONER (opp現場)。自ターン中 (相手キャラの推理に反応)。
  function board(): { s: GameState; reasoner: string } {
    const s = base('opp');
    mutate.scene.enter(s, 'self', 'B01045', {});
    const reasoner = mutate.scene.enter(s, 'opp', 'REASONER', {}).uid;
    return { s, reasoner };
  }

  it('positive: opp現場キャラ推理 → optional take → deck-5 + REASONER lp/ap を0 (印字 lp3/ap4000 → 0)', () => {
    const { s, reasoner } = board();
    const deckBefore = s.players.self.deck.length; // 6
    emitReasoningAfterSleep(s, 'opp', reasoner);
    runAllUntilEmpty(s);
    const opt = _drainPendingEffectOptionalSide();
    expect(opt, 'optional が surface する').not.toBeNull();
    applyOptionalAndContinuation(s, opt!, true);
    runAllUntilEmpty(s);
    expect(s.players.self.deck.length, 'mill5 でデッキ -5').toBe(deckBefore - 5);
    expect(engine.read.char.lp(s, reasoner), '元LP を0').toBe(0);
    expect(engine.read.char.ap(s, reasoner), '元AP を0').toBe(0);
  });

  it('positive(additive): 印字修整 (lpMod+2 / apMod+1500) は override(0) の上に残る (rules/19 QA)', () => {
    const { s, reasoner } = board();
    // 既存の能力/効果による修整を先に載せる
    mutate.char.setTurnEffect(s, reasoner, 'lpMod_permanent', 2);
    mutate.char.setTurnEffect(s, reasoner, 'apMod_permanent', 1500);
    emitReasoningAfterSleep(s, 'opp', reasoner);
    runAllUntilEmpty(s);
    const opt = _drainPendingEffectOptionalSide();
    applyOptionalAndContinuation(s, opt!, true);
    runAllUntilEmpty(s);
    expect(engine.read.char.lp(s, reasoner), 'base 0 + 修整+2').toBe(2);
    expect(engine.read.char.ap(s, reasoner), 'base 0 + 修整+1500').toBe(1500);
  });

  it('clearTurnEffects(turn): ターン終了で override 解除 → 印字 lp3/ap4000 に復帰', () => {
    const { s, reasoner } = board();
    emitReasoningAfterSleep(s, 'opp', reasoner);
    runAllUntilEmpty(s);
    applyOptionalAndContinuation(s, _drainPendingEffectOptionalSide()!, true);
    runAllUntilEmpty(s);
    expect(engine.read.char.lp(s, reasoner)).toBe(0);
    mutate.char.clearTurnEffects(s, reasoner, 'turn');
    expect(engine.read.char.lp(s, reasoner), 'lpOverride_turn 失効 → 印字 lp3').toBe(3);
    expect(engine.read.char.ap(s, reasoner), 'apOverride_turn 失効 → 印字 ap4000').toBe(4000);
  });

  it('positive(action:declare hook): opp現場キャラがアクション宣言 → optional surface (共有 trigger)', () => {
    const { s, reasoner } = board();
    emitActionDeclare(s, 'opp', reasoner);
    runAllUntilEmpty(s);
    expect(_drainPendingEffectOptionalSide(), 'action:declare でも共有 trigger が発火').not.toBeNull();
  });

  it('negative(BUG-179 regression): opp PARTNER 推理 (uid=partner:opp) → filter:{} で発火せず (optional なし)', () => {
    const { s } = board();
    // production partner 推理 emit: uid='partner:opp', player='opp' (reasoning.ts findTarget partner 経路)
    emitReasoningAfterSleep(s, 'opp', 'partner:opp');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectOptionalSide(), 'パートナーは「現場にいるキャラ」でない → 不発火').toBeNull();
    expect(s.pendingEffects.length, 'pendingEffect も増えない').toBe(0);
  });

  it('negative(optional decline): opt を辞退 → mill せず override せず (deck 据置 / lp3 ap4000)', () => {
    const { s, reasoner } = board();
    const deckBefore = s.players.self.deck.length;
    emitReasoningAfterSleep(s, 'opp', reasoner);
    runAllUntilEmpty(s);
    applyOptionalAndContinuation(s, _drainPendingEffectOptionalSide()!, false);
    runAllUntilEmpty(s);
    expect(s.players.self.deck.length, 'mill せず').toBe(deckBefore);
    expect(engine.read.char.lp(s, reasoner), 'override せず').toBe(3);
    expect(engine.read.char.ap(s, reasoner)).toBe(4000);
  });

  it('negative(mill gate): デッキ<5 で take → chain break (mill gate:true) → override 適用されず', () => {
    const { s, reasoner } = board();
    s.players.self.deck = ['DK', 'DK', 'DK', 'DK']; // 4枚 (< 5)
    emitReasoningAfterSleep(s, 'opp', reasoner);
    runAllUntilEmpty(s);
    applyOptionalAndContinuation(s, _drainPendingEffectOptionalSide()!, true);
    runAllUntilEmpty(s);
    expect(s.players.self.deck.length, 'gate-skip でリムーブしない').toBe(4);
    expect(engine.read.char.lp(s, reasoner), 'chain break → override なし → 印字 lp3').toBe(3);
    expect(engine.read.char.ap(s, reasoner), 'chain break → 印字 ap4000').toBe(4000);
  });

  it('negative(【ターン1】): 同ターン2回目の推理反応は limit で不発火', () => {
    const { s, reasoner } = board();
    emitReasoningAfterSleep(s, 'opp', reasoner);
    runAllUntilEmpty(s);
    // 1回目 fire (limit 消費) — 辞退しても消費される (rules/24)
    applyOptionalAndContinuation(s, _drainPendingEffectOptionalSide()!, false);
    runAllUntilEmpty(s);
    emitReasoningAfterSleep(s, 'opp', reasoner);
    runAllUntilEmpty(s);
    expect(_drainPendingEffectOptionalSide(), '2回目は【ターン1】で不発').toBeNull();
  });
});

describe('B01045 actual reasoning completion', () => {
  function board(): { s: GameState; reasoner: string } {
    const s = base('opp');
    mutate.scene.enter(s, 'self', 'B01045', {});
    const reasoner = mutate.scene.enter(s, 'opp', 'REASONER', {}).uid;
    return { s, reasoner };
  }

  it('take resolves before evidence and makes the reasoner gain zero evidence', () => {
    const { s, reasoner } = board();
    engine.flow.doReasoning(s, reasoner);
    runAllUntilEmpty(s);
    const opt = _drainPendingEffectOptionalSide();
    expect(opt).not.toBeNull();
    applyOptionalAndContinuation(s, opt!, true);
    runAllUntilEmpty(s);

    expect(s.players.opp.evidence).toHaveLength(0);
    expect(s.log.filter((entry) => entry.action === 'reasoning').at(-1)?.result).toBe('evidence+0');
  });

  it('decline continues to normal evidence completion', () => {
    const { s, reasoner } = board();
    engine.flow.doReasoning(s, reasoner);
    runAllUntilEmpty(s);
    applyOptionalAndContinuation(s, _drainPendingEffectOptionalSide()!, false);
    runAllUntilEmpty(s);

    expect(s.players.opp.evidence).toHaveLength(3);
    expect(engine.read.char.lp(s, reasoner)).toBe(3);
    expect(s.log.filter((entry) => entry.action === 'reasoning').at(-1)?.result).toBe('evidence+3');
  });

  it('partner reasoning does not open this character-only optional', () => {
    const s = base('opp');
    mutate.scene.enter(s, 'self', 'B01045', {});
    mutate.partner.init(s, 'opp', 'REASONER');

    engine.flow.doReasoning(s, 'partner:opp');
    runAllUntilEmpty(s);

    expect(_drainPendingEffectOptionalSide()).toBeNull();
    expect(s.players.opp.evidence).toHaveLength(3);
    expect(s.log.filter((entry) => entry.action === 'reasoning').at(-1)?.result).toBe('evidence+3');
  });
});

// ============================================================================
// B01054 寺井黄之助 a1 — leave:to-remove selfOnly【相手ターン中】→ bindPick1 → override LP 0
// ============================================================================
describe('B01054 a1【相手ターン中】【現場リムーブ時】キャラ1枚まで選び ターン終了時まで元LPを0', () => {
  function board(turn: 'self' | 'opp'): { s: GameState; teraiUid: string } {
    const s = base(turn);
    const teraiUid = mutate.scene.enter(s, 'self', 'B01054', {}).uid;
    mutate.scene.enter(s, 'self', 'TARGET', {}); // 自現場 override 対象
    mutate.scene.enter(s, 'opp', 'OPPT', {});    // opp現場 override 対象 (side either)
    return { s, teraiUid };
  }

  it('positive: 相手ターン中に B01054 が現場からリムーブ → pick surface → 選んだキャラ (OPPT) の元LPを0', () => {
    const { s, teraiUid } = board('opp');
    const opptUid = s.players.opp.scene.find((c) => c.cardId === 'OPPT')!.uid;
    mutate.scene.removeToRemove(s, teraiUid, 'effect');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'bindPick が surface (side either)').not.toBeNull();
    const cands = (pick!.candidates as Array<{ uid: string; cardId: string }>).map((c) => c.cardId);
    expect(cands, 'either → opp現場も候補').toContain('OPPT');
    expect(cands, 'either → 自現場も候補').toContain('TARGET');
    applyPickAndContinuation(s, pick!, opptUid);
    runAllUntilEmpty(s);
    expect(engine.read.char.lp(s, opptUid), 'OPPT 元LP2 → 0').toBe(0);
  });

  it('negative: 自ターン中の除去 → condition(相手ターン中)不成立 → 不発火 (pick なし / lp 据置)', () => {
    const { s, teraiUid } = board('self');
    const opptUid = s.players.opp.scene.find((c) => c.cardId === 'OPPT')!.uid;
    mutate.scene.removeToRemove(s, teraiUid, 'effect');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), '自ターンは不発火').toBeNull();
    expect(engine.read.char.lp(s, opptUid), 'override されず 印字 lp2').toBe(2);
  });
});

describe('B01054 a2【ヒラメキ】証拠から action リムーブ → draw (engine 層は pendingHirameki push を pin)', () => {
  it('positive: B01054 が証拠から action リムーブ → pendingHirameki push (a2)', () => {
    const s = base('self');
    // production evidence:remove-by-action emit (action-case.ts:49) = { player, ev, byUid }
    event.emit(s, 'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'B01054' }, byUid: 'atk' },
      { player: 'self', uid: 'atk' });
    const pend = _peekPendingHirameki();
    expect(pend, 'B01054 のヒラメキが pending へ').not.toBeNull();
    expect(pend!.cardId).toBe('B01054');
    expect(pend!.abilityId).toBe('a2');
  });

  it('negative: ヒラメキ非所持カード (DK) が証拠からリムーブ → push なし', () => {
    const s = base('self');
    event.emit(s, 'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'DK' }, byUid: 'atk' },
      { player: 'self', uid: 'atk' });
    expect(_peekPendingHirameki(), 'ヒラメキ無しカードは push しない').toBeNull();
  });
  // MANUAL-NOTE: a2 の draw1 実行は UI 委譲 (hiramekiResolve dispatch / useHiramekiFlowDriver)。
  //   engine 層の観測点は pendingHirameki push まで (hybrid-batch3 B06104 慣行)。
});

// ============================================================================
// BUG-179 regression — 出荷済カードの filter:{} anti-pattern 回帰 gate
// ============================================================================
describe('BUG-179 regression B05080 a2 (side:opp, filter:{}) — 相手 PARTNER 推理では発火しない', () => {
  function board(): { s: GameState; reasoner: string } {
    const s = base('self');
    mutate.scene.enter(s, 'self', 'B05080', {});
    const reasoner = mutate.scene.enter(s, 'opp', 'REASONER', {}).uid;
    s.players.self.hand = ['HANDCARD']; // discard 弾
    return { s, reasoner };
  }

  it('positive: opp現場キャラ推理 → chain 発火 (discard の pick surface)', () => {
    const { s, reasoner } = board();
    emitReasoningAfterSleep(s, 'opp', reasoner);
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'discard pick が surface').not.toBeNull();
    expect(pick!.atomVerb).toBe('discard');
  });

  it('negative(BUG-179): opp PARTNER 推理 (uid=partner:opp) → 発火しない (pick/pending なし)', () => {
    const { s } = board();
    emitReasoningAfterSleep(s, 'opp', 'partner:opp');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), 'パートナー推理では発火しない').toBeNull();
    expect(s.pendingEffects.length, 'pendingEffect も増えない').toBe(0);
  });
});

describe('BUG-179 regression B03096 a1 (side:self, filter:{}) — 自 PARTNER 推理では発火しない', () => {
  function board(): { s: GameState; reasoner: string } {
    const s = base('self');
    mutate.scene.enter(s, 'self', 'B03096', {});
    const reasoner = mutate.scene.enter(s, 'self', 'REASONER', {}).uid;
    // opp デッキ上に既知順で seed (souza = opp デッキ上1枚を下へ)
    s.players.opp.deck = ['OTOP', 'O2', 'O3'];
    return { s, reasoner };
  }

  it('positive: 自現場キャラ推理 → souza 実行 (opp デッキ上 OTOP が下へ移動)', () => {
    const { s, reasoner } = board();
    emitReasoningEnd(s, 'self', reasoner);
    runAllUntilEmpty(s);
    expect(s.players.opp.deck[0], 'OTOP はもうデッキ上ではない').not.toBe('OTOP');
    expect(s.players.opp.deck[s.players.opp.deck.length - 1], 'OTOP がデッキ最下部へ').toBe('OTOP');
  });

  it('negative(BUG-179): 自 PARTNER 推理 (uid=partner:self) → 発火しない (opp デッキ据置)', () => {
    const { s } = board();
    emitReasoningEnd(s, 'self', 'partner:self');
    runAllUntilEmpty(s);
    expect(s.players.opp.deck[0], 'souza 走らず OTOP デッキ上のまま').toBe('OTOP');
    expect(s.pendingEffects.length, 'pendingEffect も増えない').toBe(0);
  });
});
