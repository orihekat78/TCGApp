// m1-megasweep probe — B05027 服部平次＆遠山和葉 (MR character, engine変更0)
//
// 印字 (ground truth, payloads/B05027.json fullTexts):
//   a1 (effect, refusedLine): 【パートナー緑】【宣言】【ターン1】レベル8以下の【緑】のキャラを1枚まで選び、
//        アクティブにするか、ターン終了時まで〚突撃〛を与える。
//   a2 (effect, refusedLine): 【ターン1】自分の現場に〚[服部平次]〛か〚[遠山和葉]〛が登場したとき、
//        キャラを1枚まで選び、スリープさせる。この能力はパートナーエリアでも発動する。
//   a3 (cutIn): 【カットイン】AP＋2000  ← compiledRest (既製 idiom、本 probe の novel対象外)
//
// DSL:
//   a1 = declared, scope on-scene, condition partnerColor{緑}, limit turn 1,
//        effect choice[ option0: sceneSetState active pick{levelMax8,色緑,either,n0-1}
//                       option1: charGrantKeyword 突撃 scope:turn pick{同filter} ]
//   a2 = triggered hook 'enter', scope on-partner-area (=PA でも発動),
//        matcherCondition triggerCharMatches{side:self, cardName:[服部平次,遠山和葉]}, limit turn 1,
//        effect sceneSetState{ player:self, max:1, side:either, state:sleep } (「1枚まで」pick)。
//
// novel 経路 = production dispatch:
//   a1: activateDeclaredAbility(uid,'a1',{choiceIndex}) + runAllUntilEmpty + drainAiEffectPicks
//       (BUG-171)。condition/limit の使用可否は canDeclaredAbility (UI/AI 列挙 gate) で pin。
//   a2: mutate.scene.enter で 服部平次/遠山和葉 を登場 → event.emit('enter') → triggered.ts が
//       matcher 通過分の effect を queue → drainAiEffectPicks で sleep pick を heuristic 解決 (実 emit 経路)。
//
// BUG-174 (owner 反転しない pin): a1 を owner=opp 側に置き、opp partner=緑 で同一に機能することを pin。
// BUG-117/118 (filter 実評価): a1 の pick 候補は decoy (Lv9緑=levelMax超過 / 青Lv3=色不一致) を先頭に
//   並べても除外され、唯一の 緑Lv8 のみが選ばれる (filter が壊れていれば先頭 decoy が誤選択され fail)。
// 「1枚まで」= 0 選択許容: a1 で有効候補ゼロ (decoy のみ) → 何も起きず throw もしない (0-pick path)。
// beforeEach で registry 再登録 → event._resetRegistry() 必須 (handler 累積で N 重発火)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue, _clearPendingEffectChoiceSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate as mutateAll } from '@/engine/mutate/index';
import { read } from '@/engine/read/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar } from '../../helpers/fixtures';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';
import { B05027 } from '@/cards/ct-p05/B05027';

type Player = 'self' | 'opp';
const setHuman = (s: Player | null) => { (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = s; };
const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  sceneChar(cardId, uid, { state });

function cdef(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over } as unknown as CardDef;
}

// パートナー色 fixtures (partnerColor は def.colors のみ参照)
const PARTNER_G = cdef('PARTNER_G', { colors: ['緑'] });
const PARTNER_B = cdef('PARTNER_B', { colors: ['青'] });
// a1 pick fixtures
const GREEN8 = cdef('GREEN8', { colors: ['緑'], level: 8 });   // ✓ 唯一の有効候補
const GREEN9 = cdef('GREEN9', { colors: ['緑'], level: 9 });   // decoy: levelMax8 超過
const BLUE3  = cdef('BLUE3',  { colors: ['青'], level: 3 });   // decoy: 色不一致
// a2 enter fixtures
const HATTORI = cdef('HATTORI', { names: ['服部平次'] });
const KAZUHA  = cdef('KAZUHA',  { names: ['遠山和葉'] });
const OTHER   = cdef('OTHER',   { names: ['別ノ人'] });         // off-variant: 名不一致 → 発火せず
const TARGET  = cdef('TARGET');                                 // a2 sleep 対象
const TARGET2 = cdef('TARGET2');
const FIXTURES = [PARTNER_G, PARTNER_B, GREEN8, GREEN9, BLUE3, HATTORI, KAZUHA, OTHER, TARGET, TARGET2];

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  _clearPendingEffectChoiceSide();
  setHuman(null);
  registerCardDef(B05027);
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
});

// ============================================================
// a1 — 【パートナー緑】【宣言】【ターン1】緑Lv8以下を1枚まで: アクティブ化 or 突撃付与
// ============================================================
describe('B05027 a1 — 宣言: 緑Lv8以下を1枚まで アクティブ化 or 突撃付与', () => {
  // decoy を先頭に並べる → filter が壊れていれば cands[0]=decoy が誤選択される discriminating 配置。
  function boardA1(partnerColor: '緑' | '青', ownerSide: Player = 'self'): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: ownerSide, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players[ownerSide].partner = { cardId: partnerColor === '緑' ? 'PARTNER_G' : 'PARTNER_B', state: 'active', location: 'partner-area' } as GameState['players']['self']['partner'];
    s.players[ownerSide].scene = [
      sc('B05027', 'hattori'),           // 自身: 緑Lv9 → levelMax8 で候補外
      sc('GREEN9', 'g9', 'sleep'),       // decoy 先頭
      sc('BLUE3', 'b3', 'sleep'),        // decoy
      sc('GREEN8', 'g8', 'sleep'),       // ✓ 唯一の候補
    ];
    return s;
  }
  const activate = (s0: GameState, uid: string, choiceIndex: 0 | 1) => produce(s0, (d) => {
    activateDeclaredAbility(d, uid, 'a1', { choiceIndex });
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
  });

  it('gate: パートナー緑なら宣言可 / 青なら不可 (partnerColor condition) / 使用後は不可 (limit turn1)', () => {
    expect(canDeclaredAbility(boardA1('緑'), 'hattori', 'a1'), 'partner緑 → 宣言可').toBe(true);
    expect(canDeclaredAbility(boardA1('青'), 'hattori', 'a1'), 'partner青 → partnerColor条件不成立で宣言不可').toBe(false);
    const after = activate(boardA1('緑'), 'hattori', 0);
    expect(canDeclaredAbility(after, 'hattori', 'a1'), '1回使用後は limit turn1 で再宣言不可').toBe(false);
  });

  it('option0 (アクティブ化): 緑Lv8(sleep→active) のみ / decoy(Lv9緑・青Lv3) は候補外で不変', () => {
    const after = activate(boardA1('緑'), 'hattori', 0);
    expect(read.char.state(after, 'g8'), '緑Lv8 は sleep→active').toBe('active');
    expect(read.char.state(after, 'g9'), 'decoy Lv9緑 は候補外 → sleep のまま').toBe('sleep');
    expect(read.char.state(after, 'b3'), 'decoy 青Lv3 は候補外 → sleep のまま').toBe('sleep');
  });

  it('option0 0-pick: 有効候補ゼロ (decoy のみ) → 何も起きず throw もしない (「1枚まで」=0可、rules/15)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.partner = { cardId: 'PARTNER_G', state: 'active', location: 'partner-area' } as GameState['players']['self']['partner'];
    s.players.self.scene = [sc('B05027', 'hattori'), sc('GREEN9', 'g9', 'sleep'), sc('BLUE3', 'b3', 'sleep')];
    const after = activate(s, 'hattori', 0);
    expect(read.char.state(after, 'g9'), '候補ゼロ → decoy 不変').toBe('sleep');
    expect(read.char.state(after, 'b3'), '候補ゼロ → decoy 不変').toBe('sleep');
  });

  it('option1 (突撃付与): 緑Lv8 が ターン終了時まで 突撃 を得る / decoy は付与されず / 状態は不変', () => {
    const after = activate(boardA1('緑'), 'hattori', 1);
    expect(read.char.hasKeyword(after, 'g8', '突撃'), '緑Lv8 に 突撃 付与').toBe(true);
    expect(read.char.hasKeyword(after, 'g9', '突撃'), 'decoy Lv9緑 には付与されない').toBe(false);
    expect(read.char.state(after, 'g8'), 'grant は状態を変えない → sleep のまま').toBe('sleep');
  });

  it('owner=opp pin (BUG-174): B05027 が opp 側でも opp partner=緑 で option0 が同一に機能', () => {
    const after = activate(boardA1('緑', 'opp'), 'hattori', 0);
    expect(read.char.state(after, 'g8'), 'owner=opp: 緑Lv8 が sleep→active (反転せず)').toBe('active');
    expect(read.char.state(after, 'g9'), 'decoy は不変').toBe('sleep');
  });
});

// ============================================================
// a2 — 【ターン1】[服部平次]/[遠山和葉] 登場時: キャラ1枚まで sleep (PA でも発動)
// ============================================================
describe('B05027 a2 — [服部平次]/[遠山和葉] 登場時 キャラ1枚まで sleep (PA でも発動)', () => {
  // B05027 を partnerAreaMR に置く = 印字「この能力はパートナーエリアでも発動する」を pin。
  function boardPA(extraSelf: SceneCharacter[] = []): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.partnerAreaMR = { cardId: 'B05027', uid: 'pamr#1', state: 'active' } as SceneCharacter;
    s.players.self.scene = [sc('TARGET', 't1', 'active'), ...extraSelf];  // t1 = cands[0] (自側先頭)
    return s;
  }
  // 実 emit 経路: enter → event.emit('enter') → triggered listener → drainAiEffectPicks が sleep pick 解決。
  const fireEnter = (d: GameState, cardId: string, ord: number) => {
    const c = mutateAll.scene.enter(d, 'self', cardId, {});
    event.emit(d, 'enter', { uid: c.uid, player: 'self', enterOrder: ord, enterOrderThisTurn: ord }, { player: 'self', cardId, uid: c.uid });
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
  };
  const enter = (s0: GameState, cardId: string) => produce(s0, (d) => fireEnter(d, cardId, 2));

  it('服部平次 登場 → PA の B05027 が発動 → 先頭キャラ(TARGET)を sleep', () => {
    const after = enter(boardPA(), 'HATTORI');
    expect(read.char.state(after, 't1'), 'TARGET が sleep 化').toBe('sleep');
    // 登場した服部平次 (自側 2番目候補) は sleep されない
    const hattori = after.players.self.scene.find((c) => c.cardId === 'HATTORI');
    expect(hattori?.state, '登場キャラ自身は cands[0] ではないので active のまま').toBe('active');
  });

  it('遠山和葉 登場でも発動する (cardName 配列 second element)', () => {
    const after = enter(boardPA(), 'KAZUHA');
    expect(read.char.state(after, 't1'), '遠山和葉 登場でも TARGET が sleep').toBe('sleep');
  });

  it('off-variant: 名不一致キャラ(別ノ人) 登場では発動しない (matcher cardName)', () => {
    const after = enter(boardPA(), 'OTHER');
    expect(read.char.state(after, 't1'), '名不一致 → a2 不発 → TARGET は active のまま').toBe('active');
  });

  it('limit turn1: 同ターン2回目の 服部平次 登場では再発動しない', () => {
    const s1 = enter(boardPA(), 'HATTORI');           // 1回目: t1 sleep
    expect(read.char.state(s1, 't1')).toBe('sleep');
    // 2回目登場に備え active な TARGET2 を追加
    const s2 = produce(s1, (d) => { d.players.self.scene.push(sc('TARGET2', 't2', 'active')); });
    const s3 = produce(s2, (d) => fireEnter(d, 'HATTORI', 3));
    expect(read.char.state(s3, 't2'), 'limit turn1 消費済 → 2回目は不発 → TARGET2 は active のまま').toBe('active');
  });
});
