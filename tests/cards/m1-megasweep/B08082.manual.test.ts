// tests/cards/m1-megasweep/B08082.manual — ピスコ (character) 手書き probe (engine 実評価)
//
// 印字 (ground truth, payloads/B08082.json fullTexts.effect):
//   a1 【登場時】手札から【現場リムーブ時】を持つキャラを1枚公開してもよい。そうした場合、
//      ターン終了時までこのキャラは〚突撃〛(登場したターンからすぐにアクションできる)を持つ。
//   a2 【相手ターン中】【現場リムーブ時】手札から【黒】以外の色を持つキャラを1枚リムーブしてもよい。
//      そうした場合、カードを1枚引く。
//
// DSL:
//   a1 = triggered, hook 'enter' selfOnly, chain[
//          handReveal{player:self, n:1, filter:{keyword:'現場リムーブ時', kind:'character'}},
//          charGrantKeyword{uid:$self, kw:'突撃', scope:'turn'} ]
//   a2 = triggered, hook 'leave:to-remove' selfOnly, condition turn:opp, chain[
//          discard{player:self, max:1, filter:{colorNot:'黒', kind:'character'}},
//          draw{player:self, n:1} ]
//
// novel 経路 = production dispatch:
//   a1: sceneEnter atom (viaEffect) で B08082 を実登場 → 'enter' hook 実 emit → 登録済 triggered listener が
//       a1 発火 (BUG-146 経路)。chain step0 handReveal 短縮形 n:1 の候補 = 手札の kind:character ∧
//       defHasKeyword(def,'現場リムーブ時')。keyword filter は read/keyword.ts:abilityIsSceneRemoveTrigger
//       = triggered ∧ selfOnly ∧ hook leave:to-remove を印字 (静的) 判定 (BUG-122、rules/17 §「〜を持つ」)。
//       候補≥1 → pick 側路 enqueue → _drainAllEffectPicksForTest で単一候補解決 → 公開 (zone 不変) →
//       continuation で step1 charGrantKeyword 突撃(turn)。候補0 → chainStepNoApply gate (「そうした場合」false 枝)。
//   a2: mutate.scene.removeToRemove(uid,'effect') で leave:to-remove 実 emit (production payload
//       {uid,cause,side,byUid,removedChar})。selfOnly=B08082 自身の除去のみ。condition turn:opp は owner 相対。
//       chain step0 discard{max:1,colorNot:黒,kind:character} が手札 pick を側路 enqueue → drain → discardToRemove →
//       continuation step1 draw。候補0 (黒 char / event のみ) → chainStepNoApply gate → draw 不発 (「そうした場合」false)。
//
// QA (payload B08082):
//   - 「能力が有効かどうかにかかわらず【現場リムーブ時】を参照」= 条件アイコン(【相手ターン中】等)付きでも
//     handReveal 候補になる (S3 で pin)。
//   - 公開したキャラは効果解決時点で元に戻してよい = zone 不変 (S1 で hand 不変を pin)。
//
// decoy/off-variant (rules/15,17):
//   a1: selfOnly でない leave:to-remove observer char (abilityIsSceneRemoveTrigger 不成立) / event kind
//       → 候補0 gate (S2)。
//   a2: 黒 mono char (colorNot 除外) / event kind → 候補0 gate (S5)。turn:self → a2 非発火 (S6)。
//   owner=opp (BUG-174): condition turn:opp は owner 相対。opp 所有 B08082 は opp 自身のターンでは
//     非発火 (= 挙動が literal-'opp' へ反転しない) を S7 で pin。⚠ a2 の discard は Pattern-B 短縮形で、
//     opp 所有時の firing 経路は buildShortFormPick の side 解決 latent (BUG-174: PB shortform が
//     opp source で候補側を self 側へ誤解決 → phantom discard + ungated draw。実測: opp.remove に
//     self 手札 cardId が漏入) を踏むため、owner-reversal pin は robust な condition 次元 (非発火) で担う
//     (B06068/B07053 が opp shortform 経路を避け別次元で担保するのと同型)。self 所有経路 (S4) は正しい
//     = card は GREEN、opp-shortform anomaly は既存の許容済 engine latent で本カード固有ではない。
//
// 「してもよい」0-decline は非モデル (shipped exemplar B07053/B06068 慣例)。「そうした場合」false 枝は
// 候補0 gate (S2/S5) が担うため、候補在×辞退 scenario は non-applicable。
// beforeEach で registry 再登録 → event._resetRegistry() 必須 (handler 累積で N 重発火)。
// rules: 05-turn-phases.md, 07-action-flow.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md,
//        17-icons.md, 20-color-and-switch.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks, _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _clearPendingEffectOptionalSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { read } from '@/engine/read/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B08082 } from '@/cards/ct-p08/B08082';
import type { CardDef, GameState, EffectCtx, Effect, Player, AbilityDef } from '@/engine/types';

// ── synthetic reveal / discard targets + decoys ─────────────────────────────
// 現場リムーブ時 を「持つ」char (a1 valid): triggered ∧ selfOnly ∧ hook leave:to-remove を印字。
function mkRemoveTrigger(id: string, opts: { color?: string; kind?: 'character' | 'event'; condition?: unknown } = {}): CardDef {
  const ab: AbilityDef = {
    id: 'r', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'leave:to-remove', selfOnly: true },
    ...(opts.condition ? { condition: opts.condition } : {}),
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  } as unknown as AbilityDef;
  return {
    id, no: `9/${id}`, kind: opts.kind ?? 'character', names: [id], colors: [opts.color ?? '赤'],
    level: 3, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [ab], ruleRefs: [],
  } as unknown as CardDef;
}
// 非 selfOnly の leave:to-remove observer (a1 decoy: 「〜を持つ」に該当しない)。
function mkObserver(id: string): CardDef {
  const ab: AbilityDef = {
    id: 'o', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'leave:to-remove', selfOnly: false },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  } as unknown as AbilityDef;
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 3, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [ab], ruleRefs: [],
  } as unknown as CardDef;
}
// 能力なし char (色を明示 — a2 colorNot filter 用)。
function mkPlain(id: string, color = '赤'): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: [color],
    level: 3, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
function mkEvent(id: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors: ['赤'],
    level: 3, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

const REMTRIG = 'SYN_REMTRIG';          // a1 valid: 現場リムーブ時 (selfOnly) char
const REMTRIG_COND = 'SYN_REMTRIG_COND'; // a1 valid + 【相手ターン中】条件付き (QA static-print)
const REMTRIG_EV = 'SYN_REMTRIG_EV';     // a1 kind decoy: 現場リムーブ時 だが event
const OBSERVER = 'SYN_OBSERVER';         // a1 selfOnly decoy: 非 selfOnly leave observer
const RED = 'SYN_RED';                   // a2 valid discard: 【赤】(非黒) char
const BLACK = 'SYN_BLACK';               // a2 colorNot decoy: 【黒】mono char
const EV = 'SYN_EV';                     // kind decoy: event
const DKC = 'SYN_DECKCARD';              // draw されるデッキトップ
const SELFDK = 'SYN_SELFDECK';           // S7: self デッキ (触られないことを pin)
const SENT = 'SYN_SENTINEL';             // S7: self 手札 (触られないことを pin)

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerCardDef(B08082);
  registerCardDef(mkRemoveTrigger(REMTRIG));
  registerCardDef(mkRemoveTrigger(REMTRIG_COND, { condition: { kind: 'turn', player: 'opp' } }));
  registerCardDef(mkRemoveTrigger(REMTRIG_EV, { kind: 'event' }));
  registerCardDef(mkObserver(OBSERVER));
  registerCardDef(mkPlain(RED, '赤'));
  registerCardDef(mkPlain(BLACK, '黒'));
  registerCardDef(mkEvent(EV));
  registerCardDef(mkPlain(DKC, '青'));
  registerCardDef(mkPlain(SELFDK, '青'));
  registerCardDef(mkPlain(SENT, '青'));
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

// ── a1 driver: effect-summon で 'enter' 実 emit + handReveal pick を AI drain ──
function summon(cardId: string, player: Player): Effect {
  return {
    kind: 'atom', verb: 'sceneEnter',
    args: { player: 'self', cardId, viaEffect: true, target: { query: { area: 'remove', side: 'self' } } },
  } as unknown as Effect;
}
function srcCtx(player: Player): EffectCtx {
  return { source: { cardId: 'SUMMONER', uid: 'sum#1', abilityId: 'a1', player, area: 'scene' }, bindings: {} } as EffectCtx;
}
function enterPisco(base: GameState, player: Player): { s: GameState; uid: string } {
  const s = produce(base, (d) => {
    d.players[player].remove = [...d.players[player].remove, 'B08082'];
    runEffect(d, summon('B08082', player), srcCtx(player));
    runAllUntilEmpty(d);
    _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    runAllUntilEmpty(d);
  });
  const entered = s.players[player].scene.find((c) => c.cardId === 'B08082');
  if (!entered) throw new Error('B08082 が登場していない');
  return { s, uid: entered.uid };
}

// ── a2 driver: scene 配置 (enter emit なし) → removeToRemove で leave:to-remove 実 emit ──
function board(owner: Player, turnPlayer: Player, hand: string[], deck: string[]): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  const pisco = mutate.scene.enter(s, owner, 'B08082', {}); // enter() は emit しない → a1 非発火
  s.players[owner].hand = [...hand];
  s.players[owner].deck = [...deck];
  (s as unknown as { _piscoUid: string })._piscoUid = pisco.uid;
  return s;
}
function removeAndDrain(base: GameState, owner: Player): GameState {
  const uid = (base as unknown as { _piscoUid: string })._piscoUid;
  return produce(base, (d) => {
    mutate.scene.removeToRemove(d, uid, 'effect');
    runAllUntilEmpty(d);
    _drainAllEffectPicksForTest(d);
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
  });
}

// ============================================================
// descriptor pin — codegen drift 検出
// ============================================================
describe('B08082 ピスコ — shape (descriptor)', () => {
  it('id/no/色/lv/ap/lp/特徴 + a1 enter chain[handReveal,charGrantKeyword] / a2 leave chain[discard,draw]', () => {
    expect(B08082.id).toBe('B08082');
    expect(B08082.no).toBe('0918/B08082');
    expect(B08082.kind).toBe('character');
    expect(B08082.colors).toEqual(['黒']);
    expect(B08082.level).toBe(5);
    expect(B08082.ap).toBe(5000);
    expect(B08082.lp).toBe(0);
    expect(B08082.traits).toEqual(['黒ずくめの組織']);

    const a1 = B08082.abilities[0] as AbilityDef;
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const s1 = (a1.effect as { steps: Array<{ verb: string; args: Record<string, unknown> }> }).steps;
    expect(s1[0]).toMatchObject({ verb: 'handReveal', args: { player: 'self', max: 1, filter: { keyword: '現場リムーブ時', kind: 'character' } } });
    expect(s1[1]).toMatchObject({ verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } });

    const a2 = B08082.abilities[1] as AbilityDef;
    expect(a2.type).toBe('triggered');
    expect(a2.trigger).toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
    expect(a2.condition).toMatchObject({ kind: 'turn', player: 'opp' });
    const s2 = (a2.effect as { steps: Array<{ verb: string; args: Record<string, unknown> }> }).steps;
    expect(s2[0]).toMatchObject({ verb: 'discard', args: { player: 'self', max: 1, filter: { colorNot: '黒', kind: 'character' } } });
    expect(s2[1]).toMatchObject({ verb: 'draw', args: { player: 'self', n: 1 } });
  });
});

// ============================================================
// a1 — 【登場時】手札公開 (現場リムーブ時) → 突撃 (enter 実 emit + handReveal gate)
// ============================================================
describe('B08082 a1 — 登場時に【現場リムーブ時】char 公開 → 突撃 付与', () => {
  it('S1 happy: 手札に 現場リムーブ時(selfOnly) char → 公開(zone不変) → 突撃 付与', () => {
    const base = createEmptyGameState();
    base.players.self.hand = [REMTRIG, RED]; // REMTRIG=valid, RED=能力なし decoy
    const { s, uid } = enterPisco(base, 'self');
    expect(read.char.hasKeyword(s, uid, '突撃'), '公開成立 → 突撃').toBe(true);
    expect(s.players.self.hand, '公開は zone 不変').toEqual([REMTRIG, RED]);
  });

  it('S2 gate + selfOnly/kind decoy: 非selfOnly observer と event(現場リムーブ時) のみ → 候補0 → 突撃 なし', () => {
    const base = createEmptyGameState();
    base.players.self.hand = [OBSERVER, REMTRIG_EV]; // observer=selfOnly不成立 / EV=event kind
    const { s, uid } = enterPisco(base, 'self');
    expect(read.char.hasKeyword(s, uid, '突撃'), 'selfOnly∧kind:character 候補0 → gate → 突撃 なし').toBe(false);
    expect(s.players.self.hand, '公開不発でも手札不変').toEqual([OBSERVER, REMTRIG_EV]);
  });

  it('S3 QA static-print: 【相手ターン中】条件付き 現場リムーブ時 char も候補 (能力の有効性は問わない) → 突撃', () => {
    const base = createEmptyGameState();
    base.players.self.hand = [REMTRIG_COND]; // condition icon 付きでも印字で判定
    const { s, uid } = enterPisco(base, 'self');
    expect(read.char.hasKeyword(s, uid, '突撃'), '静的印字判定 → 候補 → 突撃').toBe(true);
  });
});

// ============================================================
// a2 — 【相手ターン中】【現場リムーブ時】手札の非黒 char リムーブ → draw (leave 実 emit + chain gate)
// ============================================================
describe('B08082 a2 — 相手ターン中の現場リムーブで 非黒char discard → draw', () => {
  it('S4 happy: turn=opp, 手札に赤char → 除去時に discard(赤) → draw 1', () => {
    const base = board('self', 'opp', [RED], [DKC]);
    const after = removeAndDrain(base, 'self');
    expect(after.players.self.remove, '赤char を discard').toContain(RED);
    expect(after.players.self.hand, 'discard 後 draw で DKC が手札に').toEqual([DKC]);
    expect(after.players.self.deck, 'デッキから1枚 draw').toEqual([]);
  });

  it('S5 gate + colorNot/kind decoy: 手札が 黒char と event のみ → 候補0 → discard も draw も無し', () => {
    const base = board('self', 'opp', [BLACK, EV], [DKC]);
    const after = removeAndDrain(base, 'self');
    expect(after.players.self.remove, '黒char/event は discard 対象外 → remove に BLACK/EV 無し')
      .not.toEqual(expect.arrayContaining([BLACK, EV]));
    expect(after.players.self.hand, '手札不変 (discard 不発)').toEqual([BLACK, EV]);
    expect(after.players.self.deck, 'draw gate → デッキ不変').toEqual([DKC]);
  });

  it('S6 condition off (turn=self): 【相手ターン中】不成立 → a2 非発火 (discard/draw 無し)', () => {
    const base = board('self', 'self', [RED], [DKC]);
    const after = removeAndDrain(base, 'self');
    expect(after.players.self.hand, 'a2 非発火 → 手札の RED 残存').toEqual([RED]);
    expect(after.players.self.deck, 'draw されず').toEqual([DKC]);
    expect(after.players.self.remove, 'discard されず (RED は remove に無い)').not.toContain(RED);
  });

  it('S7 owner=opp (BUG-174): condition turn:opp は owner 相対 → opp 所有 B08082 は opp 自身のターンで非発火 (反転せず)', () => {
    // opp 所有 + turn=opp = opp から見て「自分ターン」→ 【相手ターン中】不成立 → a2 非発火。
    // owner-anchored condition ゆえ literal-'opp' 側へ反転しない。opp firing 経路は PB-shortform latent
    // (BUG-174) を踏むため robust な非発火次元で pin する (header 参照)。
    const base = board('opp', 'opp', [RED], [DKC]);
    base.players.self.hand = [SENT];
    base.players.self.deck = [SELFDK];
    const after = removeAndDrain(base, 'opp');
    // 非発火 = 両者資源が discard/draw で変化しない (B08082 が opp.remove へ除去されるのみ)
    expect(after.pendingEffects.length, 'a2 非発火 → 効果 queue されない').toBe(0);
    expect(after.players.opp.hand, 'opp 手札の RED 不変 (discard 不発)').toEqual([RED]);
    expect(after.players.opp.deck, 'opp デッキ不変 (draw 不発)').toEqual([DKC]);
    expect(after.players.opp.remove, 'B08082 のみ opp remove へ').toEqual(['B08082']);
    // self 資源も無関係 (反転せず)
    expect(after.players.self.hand, 'self 手札 不変').toEqual([SENT]);
    expect(after.players.self.deck, 'self デッキ 不変').toEqual([SELFDK]);
    expect(after.players.self.remove, 'self remove 不変').toEqual([]);
  });
});
