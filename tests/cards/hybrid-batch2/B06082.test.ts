// CARD PHASE hybrid-batch2 probe — B06082 「説得するよりこの方が早い…」 (event)
// 公式テキスト (refusedLine, novel 句):
//   【解決編】AP8000以下のキャラを1枚まで選び、リムーブする。自分のFILEエリアにあるカードを上から
//   1枚手札に加えてもよい。そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。
//   （自分の事件が解決編になっている場合、この能力か効果を使える）
// QA (payload): FILEエリアにある【アシスト】したパートナーカードは手札に加えられない
//   → パートナーカードを除いて上から1枚を手札に加える。
//
// a1 DSL: triggered on-hand, hook effect:declared (kind==='event-use'), condition caseStatus:'解決編'
//   sequence[ sceneRemove(self, max1, either, apMax8000),
//             optional{ chain[ filePopToHand(self), sceneRemove(self, max1, either, apMax8000) ] } ]
// a2 = 【ヒラメキ】draw1 (compiledRest、本 probe 対象外)
//
// 検証面 (全て実バグ由来):
//   - production dispatch: handUseCard → effect:declared emit → on-hand triggered listener (BUG-171 系)。
//   - owner='opp' pin: 除去対象を相手側にのみ置く (BUG-174)。
//   - decoy: AP9000 (apMax8000 外) は候補に入らない (BUG-117/118)。
//   - negative: 事件編 (condition 不成立) では一切発動しない。
//   - optional は AI auto-skip → human chooser 駆動 (_peekPendingEffectOptionalSide +
//     applyOptionalAndContinuation、B04058/B06018 pilot 慣行)。「そうした場合」= chain。
//   - QA: filePopToHand は assisted-partner を skip (mutate/file.ts:38 popTop)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks, _drainAllEffectPicksForTest, applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue, _peekPendingEffectOptionalSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { char as readChar } from '@/engine/read/char';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, SceneCharacter, CardDef, FileCard } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';

import { B06082 } from '@/cards/ct-p06/B06082';

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  baseScene(cardId, uid, { state });
const FB: FileCard = { type: 'card-back', cardId: 'FILL' };
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

const FIXTURES: CardDef[] = [
  def('FILL'),                                     // deck/FILE filler
  def('OK8', { ap: 8000 }),                        // 除去対象 (AP8000 = 「8000以下」境界)
  def('OK8B', { ap: 8000 }),                       // 2枚目除去対象
  def('OK9', { ap: 9000 }),                        // decoy (apMax8000 外)
  def('SELF8', { ap: 8000 }),                      // 自陣 AP8000 (either 検証)
  def('ZPART', { kind: 'partner', ap: undefined, lp: 3 }), // アシストパートナー (QA skip 検証)
];

function base(status: '事件編' | '解決編' = '解決編'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['FILL', 'FILL', 'FILL', 'FILL'];
  s.players.opp.deck = ['FILL', 'FILL', 'FILL', 'FILL'];
  s.players.self.hand = ['B06082'];
  s.players.self.case.colors = ['赤'];               // rules/20 色制限を通す
  s.players.self.case.status = status;
  s.players.self.file = Array.from({ length: 6 }, () => ({ ...FB })); // level6 ≤ FILE (rules/12)
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetCardDefRegistry();
  _resetUidCounter();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  setHuman(null);
  for (const d of [B06082, ...FIXTURES]) registerCardDef(d);
  registerTriggeredListener();
});

const sceneHas = (s: GameState, side: 'self' | 'opp', uid: string) => s.players[side].scene.some(c => c.uid === uid);

// ============================================================
// A. 【解決編】gate + 1枚目 sceneRemove (AI path, owner=opp pin + decoy)
// ============================================================
describe('B06082 a1 — 【解決編】 gate + AP8000以下1枚リムーブ', () => {
  // AI 経路: 1枚目 sceneRemove を heuristic 除去、optional は auto-skip (2枚目は発火しない)
  const useAi = (s0: GameState) => produce(s0, (d) => {
    handUseCard(d, 'self', 'B06082');
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
  });

  it('解決編: 相手側 AP8000 を1枚リムーブ / AP9000 decoy 残存 (owner=opp pin, BUG-174/117)', () => {
    const s = base('解決編');
    s.players.opp.scene = [sc('OK8', 'o8'), sc('OK9', 'o9')];
    const after = useAi(s);
    expect(sceneHas(after, 'opp', 'o8'), 'AP8000 リムーブ').toBe(false);
    expect(sceneHas(after, 'opp', 'o9'), 'AP9000 decoy は候補外で残存').toBe(true);
  });

  it('解決編: 自陣 AP8000 も除去候補 (side:either)', () => {
    const s = base('解決編');
    s.players.self.scene = [sc('SELF8', 's8')];
    s.players.opp.scene = [sc('OK9', 'o9')]; // decoy のみ → 候補は自陣 s8 だけ
    const after = useAi(s);
    expect(sceneHas(after, 'self', 's8'), '自陣 AP8000 が either で除去される').toBe(false);
    expect(sceneHas(after, 'opp', 'o9')).toBe(true);
  });

  it('事件編: condition 不成立 → 一切リムーブされない (negative)', () => {
    const s = base('事件編');
    s.players.opp.scene = [sc('OK8', 'o8'), sc('OK9', 'o9')];
    const after = useAi(s);
    expect(sceneHas(after, 'opp', 'o8'), '事件編では発動せず AP8000 も残存').toBe(true);
    expect(sceneHas(after, 'opp', 'o9')).toBe(true);
    expect(_peekPendingEffectOptionalSide(), 'optional も surface しない').toBeNull();
  });
});

// ============================================================
// B. 「そうした場合」= chain (human optional=true) — FILE→手札1 + 2枚目リムーブ
// ============================================================
describe('B06082 a1 — optional: FILE1枚手札 → 2枚目リムーブ (chain)', () => {
  function board() {
    const s = base('解決編');
    // 相手側に AP8000 を2枚 → 1枚目・2枚目とも opp から除去 (owner=opp pin)
    s.players.opp.scene = [sc('OK8', 'o8'), sc('OK8B', 'o8b')];
    return s;
  }
  // human 経路: 1枚目 sceneRemove(human-owned) を drain → optional surface → 決定 → 2枚目 drain
  const useOptional = (s0: GameState, run: boolean) => {
    setHuman('self');
    return produce(s0, (d) => {
      handUseCard(d, 'self', 'B06082');
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d); // 1枚目 sceneRemove pick
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'optional surface (1枚目リムーブ後)').not.toBeNull();
      applyOptionalAndContinuation(d, p!, run);
      _drainAllEffectPicksForTest(d); runAllUntilEmpty(d); // 2枚目 sceneRemove pick (run 時)
      _drainAllEffectPicksForTest(d); runAllUntilEmpty(d);
    });
  };

  it('run=true: FILE先頭を手札へ (hand+1) + AP8000 を計2枚リムーブ', () => {
    const after = useOptional(board(), true);
    expect(after.players.opp.scene.length, '2枚とも除去').toBe(0);
    expect(after.players.self.hand, 'FILE の card-back が手札へ').toEqual(['FILL']);
    expect(after.players.self.file.length, 'FILE 6→5').toBe(5);
  });

  it('run=false: filePop せず 2枚目リムーブなし (1枚のみ / 手札・FILE 不変)', () => {
    const after = useOptional(board(), false);
    expect(after.players.opp.scene.length, '1枚のみ除去').toBe(1);
    expect(after.players.self.hand.length, '手札は加わらない (B06082 使用で 1→0)').toBe(0);
    expect(after.players.self.file.length, 'FILE 不変').toBe(6);
  });
});

// ============================================================
// C. QA: filePopToHand は【アシスト】パートナーを skip (mutate/file.ts:38 popTop)
// ============================================================
describe('B06082 a1 — QA: アシストパートナーを手札に加えない', () => {
  it('FILE 先頭が assisted-partner → 下の card-back を手札へ (パートナーは残る)', () => {
    setHuman('self');
    const s = base('解決編');
    // FILE = [card-back x5, assisted-partner ZPART] (末尾=最上位)。level6 ≤ file.length(6)
    s.players.self.file = [
      ...Array.from({ length: 5 }, () => ({ ...FB })),
      { type: 'assisted-partner', cardId: 'ZPART' } as FileCard,
    ];
    s.players.opp.scene = [sc('OK8', 'o8'), sc('OK8B', 'o8b')];
    const after = produce(s, (d) => {
      handUseCard(d, 'self', 'B06082');
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d);
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true);
      _drainAllEffectPicksForTest(d); runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d); runAllUntilEmpty(d);
    });
    expect(after.players.self.hand, 'card-back のみ手札へ (パートナー除外)').toEqual(['FILL']);
    expect(after.players.self.hand.includes('ZPART'), 'アシストパートナーは加えない (QA)').toBe(false);
    expect(after.players.self.file.some(f => f.type === 'assisted-partner'), 'パートナーは FILE に残る').toBe(true);
  });
});
