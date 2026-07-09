// CARD PHASE hybrid-batch2 probe — B01051 京極真
//
// 印字 (ground truth):
//   〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）
//   このキャラは事件を指定してアクションできない。   ← refusedLine (novel)
//   【自分ターン中】AP＋1000
//
// novel 句 = 「このキャラは事件を指定してアクションできない。」
//   → continuousModifier.caseActionBan:true (on-scene)。
//   consumer = flow/main/action.ts:153 canActionAgainstCase()
//     `if (readChar.selfContinuousFlag(state, byUid, 'caseActionBan')) return false;`
//   selfContinuousFlag は bearer (現場) の continuous ability を walk (read/char.ts:48-)。
//
// rules: 07 (アクション対象), 13 (突撃[キャラ]=char のみ / [事件]≠所持), 15 (常時有効型),
//        24 (「できない」能力優先 = QA 裁定)。
//
// canActionAgainstCase / canActionAgainstChar は純粋 selector — emit/pick なし。
// 直接 state を組んで gate を実測する (candidates 経路 = 実 production 可否判定)。

import { describe, it, expect, beforeEach } from 'vitest';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { canActionAgainstCase, canActionAgainstChar } from '@/engine/flow/main/action';
import { char as readChar } from '@/engine/read/char';
import type { GameState, SceneCharacter, CardDef, EvidenceCard } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';
import { B01051 } from '@/cards/ct-p01/B01051';

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active', over: Partial<SceneCharacter> = {}): SceneCharacter =>
  baseScene(cardId, uid, { state, ...over });
const ev = (cardId: string, faceUp = false): EvidenceCard => ({ cardId, faceUp, origin: { turn: 1, via: 'opening' } });

// 控え control def: caseActionBan を持たない同 level/AP のキャラ (ban が唯一の blocker であることを分離)
function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['白'], level: 7, ap: 6000, lp: 0,
    traits: [], keywords: ['突撃[キャラ]'], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const FIXTURES: CardDef[] = [
  def('PLAIN'),                 // ban なし control (突撃[キャラ] のみ、caseActionBan 未宣言)
  def('OPPTARGET'),             // アクション[キャラ] の対象キャラ
];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['FILL', 'FILL'];
  s.players.opp.deck = ['FILL', 'FILL'];
  return s;
}

beforeEach(() => {
  resetCardDefRegistry();
  for (const d of [B01051, ...FIXTURES]) registerCardDef(d);
});

// ============================================================
// novel: caseActionBan — 「事件を指定してアクションできない」
// ============================================================
describe('B01051 a1 — caseActionBan: アクション[事件] 不可', () => {
  it('B01051 (active/非名乗り) → アクション[事件] 不可 (相手証拠あり・突撃[キャラ]持ちでも false)', () => {
    const s = base();
    s.players.self.scene = [sc('B01051', 'kyo')]; // active, isNamed:false → _canAction('case') は通る
    s.players.opp.evidence = [ev('OE1')];         // 証拠 ≥ 1 (rules/07 の対象条件は満たす)
    // 突撃[キャラ] は保持しているが、[事件] は持たない = QA「できない能力が優先」
    expect(readChar.hasKeyword(s, 'kyo', '突撃[キャラ]')).toBe(true);
    expect(canActionAgainstCase(s, 'kyo', 'opp'), 'caseActionBan で事件アクション不可').toBe(false);
  });

  it('control: ban を持たない同型キャラ (PLAIN) → 同じ盤面で アクション[事件] 可 (ban が唯一の blocker)', () => {
    const s = base();
    s.players.self.scene = [sc('PLAIN', 'ctl')];
    s.players.opp.evidence = [ev('OE1')];
    expect(canActionAgainstCase(s, 'ctl', 'opp'), 'ban 無しなら通る = 差分は caseActionBan のみ').toBe(true);
  });

  it('scope 分離: B01051 は アクション[キャラ] は可能 (ban は 事件 限定)', () => {
    const s = base();
    s.players.self.scene = [sc('B01051', 'kyo')];
    s.players.opp.scene = [sc('OPPTARGET', 'ot', 'sleep')]; // sleep = 合法な char 対象
    expect(canActionAgainstChar(s, 'kyo', 'ot'), 'caseActionBan は char アクションを妨げない').toBe(true);
  });

  it('owner=opp pin (BUG-174): B01051 が相手側現場でも bearer 走査で ban 有効 → 自分事件へ不可', () => {
    const s = base();
    s.players.opp.scene = [sc('B01051', 'okyo')];  // 相手側にいる B01051
    s.players.self.evidence = [ev('SE1')];          // 自分の事件に証拠あり
    // opp actor が self 事件をアクション: side に依らず bearer(okyo) の caseActionBan が効く
    expect(canActionAgainstCase(s, 'okyo', 'self'), '相手側 bearer でも ban 適用').toBe(false);
  });

  it('negative (ban 発火せずとも別 gate): 証拠0の事件は ban 以前に対象不可 (誤って true にならない)', () => {
    const s = base();
    s.players.self.scene = [sc('PLAIN', 'ctl')];
    s.players.opp.evidence = []; // 証拠0 → rules/07 で対象不可
    expect(canActionAgainstCase(s, 'ctl', 'opp'), '証拠0 は ban と無関係に false').toBe(false);
  });
});
