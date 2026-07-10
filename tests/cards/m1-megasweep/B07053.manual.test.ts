// tests/cards/m1-megasweep/B07053.manual — ロボット黒羽快斗 (character) 手書き probe (engine 実評価)
//
// 印字 (ground truth, payloads/B07053.json fullTexts.effect):
//   a1 現場にいるこのキャラは〚カード名［怪盗キッド］〛としても扱う。
//   a2 【登場時】手札から〚カード名［黒羽快斗］〛か〚［怪盗キッド］〛を1枚公開してもよい。
//        そうした場合、ターン終了時までこのキャラは〚突撃〛(登場したターンからすぐにアクションできる)を持つ。
//
// DSL:
//   a1 = continuous, scope 'on-scene', continuousModifier.grantNames ['怪盗キッド']
//   a2 = triggered, hook 'enter' selfOnly,
//        effect chain[ handReveal{player:self, n:1, filter:{cardName:['黒羽快斗','怪盗キッド'], kind:'character'}},
//                      charGrantKeyword{uid:$self, kw:'突撃', scope:'turn'} ]
//
// novel 経路 = production dispatch:
//   a1: read.char.names(uid) が 印字 ['ロボット黒羽快斗'] ∪ granted ['怪盗キッド'] を union して返す
//       (read/char.ts:348 names() → traitNameGrantSafe('grantNames')、B07053 は本 honor site の exemplar 引用元)。
//       scope 'on-scene' = grantWalk は scene.byUid の board char のみに適用。公式Q&A「現場にいなければ
//       ［怪盗キッド］として扱われない」= names() が非在場 uid で [] を返すことで自然充足 (デッキ/リムーブ参照不可)。
//   a2: sceneEnter atom (viaEffect) で B07053 を実登場させ 'enter' hook を実 emit → 登録済 triggered listener が
//       a2 を発火 (BUG-146 経路)。chain step0 handReveal 短縮形 n:1 が exact-N gate を通過すれば pick を側路に
//       enqueue → _drainAllEffectPicksForTest が単一候補を解決 → 公開 (zone 不変) → continuation で step1
//       charGrantKeyword が 突撃 を付与。候補 0 (filter 外のみ) なら handReveal が chainStepNoApply を立て
//       step1 を gate (「そうした場合」false 枝) → 突撃 付与されず (B09061 の exact-N gate と同型)。
//
// filter/kind decoy: 手札に「event 名［怪盗キッド］」(kind decoy) と「char 名［その他］」(name decoy) のみ →
//   cardName∧kind:character の候補 0 → gate。→ filter が cardName と kind の AND であることを pin。
// BUG-174 (owner 反転しない pin): S5 で B07053 を opp 現場に置き、a1 grantNames が opp 側 char の names に
//   ［怪盗キッド］を付与する (self 側の同名判定に漏れない) ことを pin。owner 反転しない = card-level owner 判定。
//   a1 は read-side (grantWalk が ownerSideOf で owner を解決) ゆえ opp でも対称に機能する。
// 「してもよい」0-decline について: DSL は exact-N (n:1) all-or-nothing で採録 (shipped exemplar B09061 が
//   「N枚公開してもよい」を handReveal n:N で採録するプロジェクト慣例)。候補在時の human 辞退は非モデル化
//   (公開=zone 不変・突撃=有益ゆえ mechanical に無害)。「そうした場合」false 枝は候補 0 gate (S4) が担うため
//   0-pick(候補在×辞退) scenario は non-applicable。
// ★既知の systemic engine 制限 (B07053 固有ではない、DSL は正しい): a2 の handReveal 短縮形は
//   buildShortFormPick(area, a, hrP, hrP) が **解決済 player** (opp) を sideDefault に渡すため、
//   sidesForQuery が side='opp' を owner 相対で再解決 (oppSide(opp)='self') → opp 所有 source では
//   手札列挙が self 側になり候補0 → gate-skip。⇒ opp が所有する B07053 の【登場時】公開→突撃 は
//   実 emit でも発火しない。ただしこれは shipped exemplar B09061 の handReveal も同一挙動を示す
//   (self:公開成立 / opp:gate-skip、本 session で実測) 既存の許容済 latent 制限であり、B07053 の
//   出荷可否 (self 所有 = 通常経路は正しい) を左右しない。よって a2 の owner=opp は probe 対象外とし、
//   owner-reversal pin は card-level に閉じた a1 (read-side) で担う。
// beforeEach で registry 再登録 → event._resetRegistry() 必須 (handler 累積で N 重発火)。
// rules: 05-turn-phases.md, 07-action-flow.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md,
//        19-special-rules.md, 24-qa-naming-stun.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { createEmptyGameState } from '@/engine/state-factory';
import { read } from '@/engine/read/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B07053 } from '@/cards/ct-p07/B07053';
import type { CardDef, GameState, EffectCtx, Effect, Player, AbilityDef } from '@/engine/types';

// synthetic reveal targets / decoys
function mkChar(id: string, name: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [name], colors: ['白'], level: 3,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
function mkEvent(id: string, name: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [name], colors: ['白'], level: 3,
    traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

const KID = 'SYN_KID';       // char 名［怪盗キッド］ — valid reveal target
const KAITO = 'SYN_KAITO';   // char 名［黒羽快斗］ — valid reveal target
const EVKID = 'SYN_EVKID';   // event 名［怪盗キッド］ — decoy (right name, wrong kind)
const OTHER = 'SYN_OTHER';   // char 名［その他］ — decoy (wrong name)
const VAN = 'SYN_VAN';       // vanilla char (a1 grantNames decoy: continuous ability を持たない)

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  registerCardDef(B07053);
  registerCardDef(mkChar(KID, '怪盗キッド'));
  registerCardDef(mkChar(KAITO, '黒羽快斗'));
  registerCardDef(mkEvent(EVKID, '怪盗キッド'));
  registerCardDef(mkChar(OTHER, 'その他'));
  registerCardDef(mkChar(VAN, 'ただのキャラ'));
  registerTriggeredListener();
});

// sceneEnter を効果登場として駆動 (viaEffect) → 'enter' hook を実 emit。cluster11 §2 と同型。
// player/side は 'self' relative 固定 (resolvePlayer は source.player 相対) → 登場側は srcCtx(player) で決める。
function summon(cardId: string): Effect {
  return {
    kind: 'atom', verb: 'sceneEnter',
    args: { player: 'self', cardId, viaEffect: true, target: { query: { area: 'remove', side: 'self' } } },
  } as unknown as Effect;
}
function srcCtx(player: Player): EffectCtx {
  return { source: { cardId: 'SUMMONER', uid: 'sum#1', abilityId: 'a1', player, area: 'scene' }, bindings: {} } as EffectCtx;
}

// player の現場に B07053 を effect-登場させ、chain の handReveal pick を AI drain で解決。
// 戻り値 = 登場した B07053 の uid。
function enterRobot(base: GameState, player: Player): { s: GameState; uid: string } {
  const s = produce(base, (d) => {
    d.players[player].remove = [...d.players[player].remove, 'B07053'];
    runEffect(d, summon('B07053'), srcCtx(player));
    runAllUntilEmpty(d);
    _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    runAllUntilEmpty(d);
  });
  const entered = s.players[player].scene.find((c) => c.cardId === 'B07053');
  if (!entered) throw new Error('B07053 が登場していない');
  return { s, uid: entered.uid };
}

// ============================================================
// descriptor pin — codegen drift 検出
// ============================================================
describe('B07053 ロボット黒羽快斗 — shape (descriptor)', () => {
  it('id/no/色/lv/ap/lp/特徴 + a1 continuous grantNames / a2 enter chain[handReveal, charGrantKeyword]', () => {
    expect(B07053.id).toBe('B07053');
    expect(B07053.no).toBe('0782/B07053');
    expect(B07053.kind).toBe('character');
    expect(B07053.colors).toEqual(['白']);
    expect(B07053.level).toBe(5);
    expect(B07053.ap).toBe(5000);
    expect(B07053.lp).toBe(1);
    expect(B07053.traits).toEqual(['ロボット']);

    const a1 = B07053.abilities[0] as AbilityDef;
    expect(a1.type).toBe('continuous');
    expect(a1.scope).toBe('on-scene');
    expect(a1.continuousModifier).toMatchObject({ grantNames: ['怪盗キッド'] });

    const a2 = B07053.abilities[1] as AbilityDef;
    expect(a2.type).toBe('triggered');
    expect(a2.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const steps = (a2.effect as { steps: Array<{ verb: string; args: Record<string, unknown> }> }).steps;
    expect(steps[0]).toMatchObject({ verb: 'handReveal', args: { player: 'self', max: 1, filter: { cardName: ['黒羽快斗', '怪盗キッド'], kind: 'character' } } });
    expect(steps[1]).toMatchObject({ verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } });
  });
});

// ============================================================
// a1 — 現場にいるこのキャラは［怪盗キッド］としても扱う (continuous grantNames)
// ============================================================
describe('B07053 a1 — grantNames: 現場で names に［怪盗キッド］が union (実 read)', () => {
  it('S2 現場の B07053 は names = 印字［ロボット黒羽快斗］∪ granted［怪盗キッド］。vanilla decoy は非付与', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('B07053', 'robo#1'), sceneChar(VAN, 'van#1')];

    const names = read.char.names(s, 'robo#1');
    expect(names, '印字名を保持').toContain('ロボット黒羽快斗');
    expect(names, 'grantNames で［怪盗キッド］を追加取得').toContain('怪盗キッド');

    // decoy: 継続能力を持たない別キャラは［怪盗キッド］を得ない (grantNames は自身の continuous 能力のみ)
    const vanNames = read.char.names(s, 'van#1');
    expect(vanNames, 'vanilla は自身の印字名のみ').toEqual(['ただのキャラ']);
    expect(vanNames, 'aura ではない → 隣接キャラに波及しない').not.toContain('怪盗キッド');
  });

  it('S5 owner=opp pin (BUG-174): opp 現場の B07053 が opp 側 names に［怪盗キッド］。self 側は無関係 (反転せず)', () => {
    const s = createEmptyGameState();
    s.players.opp.scene = [sceneChar('B07053', 'robo-opp')];
    s.players.self.scene = [sceneChar(VAN, 'van-self')];

    const oppNames = read.char.names(s, 'robo-opp');
    expect(oppNames, 'owner=opp: opp の B07053 に grantNames が付与 (owner を ownerSideOf で解決)').toContain('怪盗キッド');
    expect(oppNames, '印字名も保持').toContain('ロボット黒羽快斗');
    // self 側 vanilla は無関係 (opp の a1 が self 側 char に波及しない)
    expect(read.char.names(s, 'van-self'), 'self 側は反転せず無関係').toEqual(['ただのキャラ']);
  });
});

// ============================================================
// a2 — 【登場時】手札から［黒羽快斗］か［怪盗キッド］を公開 → 突撃 (enter 実 emit + handReveal gate)
// ============================================================
describe('B07053 a2 — enter で手札公開 → 突撃 付与 (実 emit + AI drain)', () => {
  it('S3 happy: 手札に char［怪盗キッド］ → 登場時に公開(zone不変) → 突撃 付与', () => {
    const base = createEmptyGameState();
    base.players.self.hand = [KID, OTHER]; // KID=valid, OTHER=decoy
    const { s, uid } = enterRobot(base, 'self');

    expect(read.char.hasKeyword(s, uid, '突撃'), '公開成立 → 突撃 を持つ').toBe(true);
    expect(s.players.self.hand, '公開は zone 不変 → 手札に KID/OTHER が残る').toEqual([KID, OTHER]);
  });

  it('S4 gate + kind/name decoy: 手札が event［怪盗キッド］と char［その他］のみ → 候補0 → 突撃 付与されず', () => {
    const base = createEmptyGameState();
    base.players.self.hand = [EVKID, OTHER]; // EVKID=名一致だが event / OTHER=char だが名不一致
    const { s, uid } = enterRobot(base, 'self');

    expect(read.char.hasKeyword(s, uid, '突撃'), 'cardName∧kind:character 候補0 → handReveal gate → 突撃 なし').toBe(false);
    expect(s.players.self.hand, '公開不発でも手札は不変').toEqual([EVKID, OTHER]);
  });

  it('S4b 手札0 → 公開不可 → gate で 突撃 付与されず', () => {
    const base = createEmptyGameState();
    base.players.self.hand = [];
    const { s, uid } = enterRobot(base, 'self');
    expect(read.char.hasKeyword(s, uid, '突撃'), '手札0 → 候補0 → 突撃 なし').toBe(false);
  });

  it('S6 valid name = 黒羽快斗 (もう一方) も公開成立 → 突撃 (cardName 配列 OR を pin)', () => {
    const base = createEmptyGameState();
    base.players.self.hand = [KAITO]; // 黒羽快斗 のみ
    const { s, uid } = enterRobot(base, 'self');
    expect(read.char.hasKeyword(s, uid, '突撃'), 'cardName:[黒羽快斗,怪盗キッド] の OR で 黒羽快斗 も候補').toBe(true);
    expect(s.players.self.hand, '公開は zone 不変').toEqual([KAITO]);
  });
});
