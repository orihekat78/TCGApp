// tests/cards/m1-megasweep/B08004.manual — 江戸川コナン (character) 手書き probe (engine 実評価)
//
// 印字 (ground truth, payloads/B08004.json fullTexts):
//   a1: 【パートナー青】〚突撃〛（登場したターンからすぐにアクションできる）
//   a2: 【事件青＆黒】【絆灰原哀】【FILE5】【宣言】【ターン1】
//       〚アクティブ状態のカード名［灰原哀］を1枚スタンさせる〛：このキャラをアクティブにする。
//       この能力は自分のリムーブエリアに【黒】のキャラが3枚以上ある場合に宣言できる。
//
// novel句 (全て engine 実評価で踏む):
//   a1 continuous: scope on-scene, condition partnerColor{青} → grantKeywords ['突撃']
//      (パートナーが青でない場合は持たない = rules/17 §【パートナー(色)】条件未充足で「持っていない扱い」)
//   a2 declared: condition and[ caseColor{青,黒 combine:and}, bond{灰原哀}, fileAtLeast{5},
//        removeColorAtLeast{self,黒,3,cardKind:character} ], limit turn1,
//        cost stunChar{ pick 自現場 active 灰原哀 n1 }, effect sceneSetState{uid:$self, active}。
//      → 宣言 gate は 4 条件すべて成立で true。1 条件でも欠ければ false (off-variant で pin)。
//      → 発火すると cost で active 灰原哀 が stun 化し、effect で自身 (B08004) が active 化。
//
// production dispatch:
//   - a1: read.char.keywords (continuousModifier walk = 実評価オラクル)
//   - a2 gate: canDeclaredAbility (UI/AI 列挙 gate。condition + canPay の実評価)
//   - a2 発火: activateDeclaredAbility(uid,'a2') + runAllUntilEmpty + _drainAllEffectPicksForTest
//        (BUG-171。cost pick は HeuristicPolicy drain で解決 = 実 emit 経路)
//   - owner='opp' 反転 pin (BUG-174): a2 を opp 所有で 1 scenario
//   - decoy: remove の 黒イベント (cardKind:character で除外) / sleep 灰原哀 (cost の active filter で除外)
//   - beforeEach で registry 再登録 → event._resetRegistry() 必須 (handler 累積で N 重発火)
//
// rules: 03-field-areas.md, 13-keywords.md, 17-icons.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read/index';
import { makeChar } from '../../helpers/fixtures';
import { B08004 } from '@/cards/ct-p08/B08004';
import type { CardDef, GameState, Player, AbilityDef } from '@/engine/types';

function cdef(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over } as CardDef;
}

// パートナー色 fixtures (partnerColor は def.colors のみ参照)
const P_BLUE = cdef('P_BLUE', { kind: 'partner', colors: ['青'] });
const P_RED = cdef('P_RED', { kind: 'partner', colors: ['赤'] });
// bond + cost 対象 (カード名[灰原哀])
const HAIBARA = cdef('HAIBARA', { names: ['灰原哀'], colors: ['黒'] });
// cost decoy: 名不一致の active キャラ (cost pick 対象外 → stun されない)
const OTHER = cdef('OTHER', { names: ['別ノ人'], colors: ['黒'] });
// removeColorAtLeast fixtures: 黒キャラ 3枚 + 黒イベント decoy (cardKind:character で除外)
const BK1 = cdef('BK1', { colors: ['黒'] });
const BK2 = cdef('BK2', { colors: ['黒'] });
const BK3 = cdef('BK3', { colors: ['黒'] });
const BKEV = cdef('BKEV', { kind: 'event', colors: ['黒'] }); // 黒イベント: キャラでないので数えない
const FIXTURES = [P_BLUE, P_RED, HAIBARA, OTHER, BK1, BK2, BK3, BKEV];

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  registerCardDef(B08004);
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null; // CPU 経路
});

// ---- a2 用 board builder ----
// owner 側に valid な gate 盤面を組む。opts で 1 条件だけ崩して off-variant を作る。
interface BoardOpts {
  caseColors?: string[]; // 既定 ['青','黒']
  fileN?: number;        // 既定 5
  removeIds?: string[];  // 既定 ['BK1','BK2','BK3']
  haibaraActive?: boolean; // 既定 true (絆 + cost 候補)
  partnerColor?: '青' | '赤'; // 既定 青
  extraScene?: { cardId: string; uid: string; state: 'active' | 'sleep' | 'stun' }[];
}
function board(owner: Player, opts: BoardOpts = {}): { s: GameState; selfUid: string } {
  const {
    caseColors = ['青', '黒'], fileN = 5, removeIds = ['BK1', 'BK2', 'BK3'],
    haibaraActive = true, partnerColor = '青', extraScene = [],
  } = opts;
  const selfUid = 'u-b08004';
  const s = createEmptyGameState();
  s.turn = { number: 4, player: owner, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  const p = s.players[owner];
  p.partner = { cardId: partnerColor === '青' ? 'P_BLUE' : 'P_RED', state: 'active', location: 'partner-area' } as GameState['players']['self']['partner'];
  p.case = { cardId: 'CASE', status: '事件編', requiredEvidence: owner === 'self' ? 7 : 6, colors: caseColors, declaredUseCount: {} } as GameState['players']['self']['case'];
  p.file = Array.from({ length: fileN }, (_, i) => `f${i}`);
  p.remove = [...removeIds];
  p.scene = [makeChar({ uid: selfUid, cardId: 'B08004', state: 'sleep' })];
  if (haibaraActive) p.scene.push(makeChar({ uid: 'u-hb', cardId: 'HAIBARA', state: 'active' }));
  for (const e of extraScene) p.scene.push(makeChar({ uid: e.uid, cardId: e.cardId, state: e.state }));
  return { s, selfUid };
}

// a2 production dispatch: activate (cost 支払い) + effect 解決 + cost pick drain
function activateA2(s0: GameState, uid: string): GameState {
  let after = produce(s0, (d) => {
    activateDeclaredAbility(d, uid, 'a2');
    runAllUntilEmpty(d);
  });
  after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
  after = produce(after, (d) => runAllUntilEmpty(d));
  return after;
}

// ============================================================
// shape (descriptor 骨格)
// ============================================================
describe('B08004 江戸川コナン — shape', () => {
  it('id/no/色/lv/ap/lp/特徴 + a1 continuous partnerColor / a2 declared stunChar→sceneSetState', () => {
    expect(B08004.id).toBe('B08004');
    expect(B08004.no).toBe('0845/B08004');
    expect(B08004.colors).toEqual(['青']);
    expect(B08004.level).toBe(7);
    expect(B08004.ap).toBe(6000);
    expect(B08004.lp).toBe(1);
    expect(B08004.traits).toEqual(['探偵', '毛利探偵事務所', '少年探偵団']);

    const a1 = B08004.abilities[0] as AbilityDef;
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '青' });
    expect((a1.continuousModifier!.grantKeywords as () => string[])()).toEqual(['突撃']);

    const a2 = B08004.abilities[1] as AbilityDef;
    expect(a2.type).toBe('declared');
    expect(a2.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a2.cost).toMatchObject({ kind: 'stunChar' });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } });
  });
});

// ============================================================
// a1 — 【パートナー青】突撃 付与 (engine 実評価)
// ============================================================
describe('B08004 a1 — 【パートナー青】突撃 付与', () => {
  it('S1 パートナー青 → 突撃 を持つ / off-variant 赤 → 持たない', () => {
    const { s: sBlue, selfUid } = board('self', { partnerColor: '青' });
    expect(read.char.keywords(sBlue, selfUid), '青パートナー → 付与').toContain('突撃');

    const { s: sRed } = board('self', { partnerColor: '赤' });
    expect(read.char.keywords(sRed, selfUid), '赤パートナー → 条件未充足で持たない').not.toContain('突撃');
  });
});

// ============================================================
// a2 gate — 4 条件すべて成立で宣言可 / 1 条件欠落で不可 (canDeclaredAbility)
// ============================================================
describe('B08004 a2 gate — 事件青&黒 & 絆灰原哀 & FILE5 & 黒キャラ3枚', () => {
  it('S2 happy: 4 条件すべて成立 → 宣言可', () => {
    const { s, selfUid } = board('self');
    expect(canDeclaredAbility(s, selfUid, 'a2')).toBe(true);
  });

  it('S3 off-variant caseColor: 事件が青のみ (黒欠落) → combine:and 不成立で宣言不可', () => {
    const { s, selfUid } = board('self', { caseColors: ['青'] });
    expect(canDeclaredAbility(s, selfUid, 'a2')).toBe(false);
  });

  it('S4 off-variant fileAtLeast: FILE 4枚 → 宣言不可 (他 3 条件は成立のまま)', () => {
    const { s, selfUid } = board('self', { fileN: 4 });
    expect(canDeclaredAbility(s, selfUid, 'a2')).toBe(false);
  });

  it('S5 off-variant removeColorAtLeast: 黒キャラ 2枚のみ → 宣言不可', () => {
    const { s, selfUid } = board('self', { removeIds: ['BK1', 'BK2'] });
    expect(canDeclaredAbility(s, selfUid, 'a2')).toBe(false);
  });

  it('S6 decoy: リムーブが 黒イベント3枚 → cardKind:character で数えず宣言不可 / 黒キャラ3枚なら可', () => {
    const evOnly = board('self', { removeIds: ['BKEV', 'BKEV', 'BKEV'] });
    expect(canDeclaredAbility(evOnly.s, evOnly.selfUid, 'a2'), '黒イベントは「黒のキャラ」に非該当').toBe(false);
    // 黒キャラ2枚 + 黒イベント1枚 でも character は2枚 → 不可 (decoy が数を水増ししない)
    const mixed = board('self', { removeIds: ['BK1', 'BK2', 'BKEV'] });
    expect(canDeclaredAbility(mixed.s, mixed.selfUid, 'a2'), '黒イベント混在でも character 2枚では不可').toBe(false);
  });

  it('S7 off-variant 絆/cost: 現場に灰原哀不在 → 絆不成立 かつ cost 支払不能 で宣言不可', () => {
    const { s, selfUid } = board('self', { haibaraActive: false });
    expect(canDeclaredAbility(s, selfUid, 'a2')).toBe(false);
  });
});

// ============================================================
// a2 発火 — cost で active 灰原哀 stun / effect で自身 active (production dispatch)
// ============================================================
describe('B08004 a2 発火 — stunChar cost → sceneSetState 自身 active', () => {
  it('S8 happy: 自身(sleep→active) / active 灰原哀 が stun / decoy(sleep 灰原哀・別ノ人 active) は不変', () => {
    // sleep 灰原哀 (cost の active filter 対象外) と 別ノ人 active (名不一致で対象外) を decoy 配置
    const { s, selfUid } = board('self', {
      extraScene: [
        { cardId: 'HAIBARA', uid: 'u-hb-sleep', state: 'sleep' },
        { cardId: 'OTHER', uid: 'u-other', state: 'active' },
      ],
    });
    const after = activateA2(s, selfUid);
    expect(read.char.state(after, selfUid), '自身 sleep→active (effect sceneSetState $self)').toBe('active');
    expect(read.char.state(after, 'u-hb'), 'active 灰原哀 が cost で stun 化').toBe('stun');
    expect(read.char.state(after, 'u-hb-sleep'), 'sleep 灰原哀 は active filter 外 → 不変').toBe('sleep');
    expect(read.char.state(after, 'u-other'), '別ノ人(active) は cardName 不一致 → 不変').toBe('active');
  });

  it('S9 limit turn1: 1回使用後は再宣言不可', () => {
    const { s, selfUid } = board('self');
    const after = activateA2(s, selfUid);
    expect(canDeclaredAbility(after, selfUid, 'a2'), 'limit turn1 消費済み → 再宣言不可').toBe(false);
  });

  it('S10 owner=opp pin (BUG-174): opp 所有でも opp 側で同一に機能 (自分側は無関係)', () => {
    const { s, selfUid } = board('opp');
    const after = activateA2(s, selfUid);
    expect(read.char.state(after, selfUid), 'owner=opp: 自身 active (反転せず)').toBe('active');
    expect(read.char.state(after, 'u-hb'), 'owner=opp: opp の 灰原哀 が stun').toBe('stun');
    expect(after.players.self.scene.length, '自分側 現場は無関係 (空)').toBe(0);
  });
});
