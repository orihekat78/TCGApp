// hybrid-batch2 probe — B06065 伝説の玉探し (case, engine変更0)
//
// 印字 (ground truth):
//   a1: この事件が解決編に移行したとき、自分は手札を1枚リムーブする。
//   a2:【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：
//       自分のリムーブエリアにある〚特徴［YAIBA］〛のイベントを1枚まで選び、手札に加える。  ← novel refusedLine
//
// rules: 01 (解決編移行), 15 (「〜まで」=0可), 17 (【解決編】条件外は持たない扱い/【ターン1】),
//        21 (宣言コスト「自分の」省略 / 全部行えなければ使用不可), 26 (証拠操作)
//
// novel 経路 = production dispatch:
//   activateDeclaredAbility('case:self','a2',{flipFaceUpEvidence:{indices}}) → pay(flip2) → useDeclaredAbility
//   → runAllUntilEmpty → handAddFromRemove short-form pick (remove/side:self/filter{kind:event,trait:YAIBA})
// BUG-171: 宣言は activateDeclaredAbility + runAllUntilEmpty で踏む (直接 handler 呼びは cost skip)。
// BUG-174: 相手側 remove に YAIBA イベント decoy を置き、side:self が honored (取られない) ことを pin。
// BUG-117/118: filter 条件外 (非YAIBA イベント / YAIBA だがキャラ kind) を remove に置き非候補を assert。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { canPay } from '@/engine/cost/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, CardDef, EvidenceCard, EffectCtx } from '@/engine/types';
import { B06065 } from '@/cards/ct-p06/B06065';

type CaseStatus = GameState['players']['self']['case']['status'];

function evtDef(id: string, traits: string[]): CardDef {
  return { id, no: `9/${id}`, kind: 'event', names: [id], colors: ['白'], level: 1,
    traits, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;
}
function chDef(id: string, traits: string[] = []): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 3000, lp: 1,
    traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;
}
const ev = (cardId: string, faceUp = false): EvidenceCard => ({ cardId, faceUp, origin: { turn: 1, via: 'reasoning' } });
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

// remove-area fixtures (filter = {kind:'event', trait:'YAIBA'})
const YAIBA_EV = 'YAIBA_EV';   // 対象
const YAIBA_EV2 = 'YAIBA_EV2'; // 対象 (max:1 検証用の2枚目)
const OTHER_EV = 'OTHER_EV';   // decoy: 非YAIBA イベント (trait 外)
const YAIBA_CH = 'YAIBA_CH';   // decoy: YAIBA だが kind:character (kind:event 除外)
const HANDC = 'HANDC';         // a1 discard 対象

function base(status: CaseStatus, faceDown: number): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.case = { cardId: 'B06065', status, requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
  s.players.self.evidence = Array.from({ length: faceDown }, (_, i) => ev(`E${i}`, false));
  s.players.self.deck = ['FILL', 'FILL', 'FILL', 'FILL'];
  s.players.opp.deck = ['FILL', 'FILL', 'FILL', 'FILL'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  setHuman(null);
  registerCardDef(B06065);
  registerCardDef(evtDef(YAIBA_EV, ['YAIBA']));
  registerCardDef(evtDef(YAIBA_EV2, ['YAIBA']));
  registerCardDef(evtDef(OTHER_EV, []));
  registerCardDef(chDef(YAIBA_CH, ['YAIBA']));
  registerCardDef(chDef(HANDC));
  registerCardDef(chDef('FILL'));
  registerTriggeredListener();
});

const a2cost = B06065.abilities[1].cost!;
const payCtx = (): EffectCtx => ({
  source: { player: 'self', uid: 'case:self', cardId: 'B06065', abilityId: 'a2', area: 'case' },
  bindings: {},
} as unknown as EffectCtx);

// declared production dispatch
function activate(s0: GameState, indices: number[]): GameState {
  return produce(s0, (d) => {
    activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices } });
    runAllUntilEmpty(d);
    _drainAllEffectPicksForTest(d);
    runAllUntilEmpty(d);
  });
}

describe('B06065 a2 — 【解決編】gate + flip2 cost + YAIBA event handAddFromRemove', () => {
  it('condition【解決編】: 事件編 → 宣言不可 / 解決編 → 宣言可 (rules/17 条件外=持たない扱い)', () => {
    expect(canDeclaredAbility(base('事件編', 2), 'case:self', 'a2')).toBe(false);
    expect(canDeclaredAbility(base('解決編', 2), 'case:self', 'a2')).toBe(true);
  });

  it('cost〚証拠2つ表向き〛: 裏向き1つ → 支払不可 / 2つ → 可 (rules/21 全部行えなければ不可)', () => {
    expect(canPay(base('解決編', 1), a2cost, payCtx()), '裏向き1つ → 2つ flip 不可').toBe(false);
    expect(canPay(base('解決編', 2), a2cost, payCtx()), '裏向き2つ → 可').toBe(true);
  });

  it('happy: 証拠2つ表向き + YAIBA イベントを手札へ / 非YAIBA・YAIBAキャラ decoy は remove 残置', () => {
    const s = base('解決編', 2);
    s.players.self.remove = [YAIBA_EV, OTHER_EV, YAIBA_CH];
    const after = activate(s, [0, 1]);
    expect(after.players.self.evidence[0].faceUp, '証拠0 表向き').toBe(true);
    expect(after.players.self.evidence[1].faceUp, '証拠1 表向き').toBe(true);
    expect(after.players.self.hand, 'YAIBA イベント → 手札').toContain(YAIBA_EV);
    expect(after.players.self.remove, 'YAIBA イベントは remove から抜ける').not.toContain(YAIBA_EV);
    expect(after.players.self.remove, '非YAIBA イベント decoy 残置').toContain(OTHER_EV);
    expect(after.players.self.remove, 'YAIBA だが kind:character decoy 残置').toContain(YAIBA_CH);
    expect(after.players.self.hand, 'キャラは手札に来ない').not.toContain(YAIBA_CH);
  });

  it('max:1 (1枚まで): YAIBA イベント2枚 → 1枚だけ手札、もう1枚は remove 残置', () => {
    const s = base('解決編', 2);
    s.players.self.remove = [YAIBA_EV, YAIBA_EV2];
    const after = activate(s, [0, 1]);
    const inHand = [YAIBA_EV, YAIBA_EV2].filter((c) => after.players.self.hand.includes(c));
    const inRem = [YAIBA_EV, YAIBA_EV2].filter((c) => after.players.self.remove.includes(c));
    expect(inHand.length, '手札に来るのは1枚だけ').toBe(1);
    expect(inRem.length, 'もう1枚は remove 残置').toBe(1);
  });

  it('side:self honored (BUG-174): 相手 remove の YAIBA イベントは対象外', () => {
    const s = base('解決編', 2);
    s.players.self.remove = [OTHER_EV];        // 自分側は非YAIBA のみ
    s.players.opp.remove = [YAIBA_EV];         // 相手側に YAIBA イベント decoy
    const after = activate(s, [0, 1]);
    expect(after.players.opp.remove, '相手 remove の YAIBA は取られない').toContain(YAIBA_EV);
    expect(after.players.self.hand, '相手カードは自分の手札に来ない').not.toContain(YAIBA_EV);
    expect(after.players.self.evidence[0].faceUp, 'コストは支払われている').toBe(true);
  });

  it('negative (空振り合法): 自分 remove に YAIBA イベント無し → 0枚追加、コストのみ消費 (rules/15「〜まで」=0)', () => {
    const s = base('解決編', 2);
    s.players.self.remove = [OTHER_EV, YAIBA_CH]; // YAIBA イベント無し
    const before = s.players.self.hand.length;
    const after = activate(s, [0, 1]);
    expect(after.players.self.hand.length, '手札は増えない').toBe(before);
    expect(after.players.self.remove, '非YAIBA イベント残置').toContain(OTHER_EV);
    expect(after.players.self.remove, 'YAIBAキャラ残置').toContain(YAIBA_CH);
    expect(after.players.self.evidence[0].faceUp, 'コストは支払われる (flip 済)').toBe(true);
  });

  it('【ターン1】: 1回使用後は同ターン2回目の宣言不可', () => {
    const s = base('解決編', 2);
    s.players.self.remove = [YAIBA_EV];
    const after = activate(s, [0, 1]);
    expect(canDeclaredAbility(after, 'case:self', 'a2'), '2回目は不可').toBe(false);
  });
});

describe('B06065 a1 — case:to-resolved (production hook) → 手札1リムーブ', () => {
  it('事件編→解決編 移行 → 手札1枚が remove へ (mutate.case.toResolved emit)', () => {
    const after = produce(base('事件編', 0), (d) => {
      d.players.self.hand = [HANDC];
      mutate.case.toResolved(d, 'self');
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.case.status, '解決編へ移行').toBe('解決編');
    expect(after.players.self.hand, '手札から discard').not.toContain(HANDC);
    expect(after.players.self.remove, 'remove へ').toContain(HANDC);
  });

  it('negative: 既に解決編 → toResolved は no-op、a1 再発火せず手札不変', () => {
    const after = produce(base('解決編', 0), (d) => {
      d.players.self.hand = [HANDC];
      mutate.case.toResolved(d, 'self');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand, '再発火なし → 手札維持').toContain(HANDC);
  });
});
