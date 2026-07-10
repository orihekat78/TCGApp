// tests/cards/m1-megasweep/B03028.manual — 服部平次 (character SR) 手書き probe (engine 実評価)
//
// 印字 (ground truth, payloads/B03028.json fullTexts.effect):
//   a1 【登場時】自分のデッキのカードを上から【緑】のイベントが出るまで1枚ずつ公開し、それを手札に加える。
//      残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//   a2 【自分ターン中】【ターン1】自分が【緑】のイベントを使用したとき、手札を1枚リムーブしてもよい。
//      （イベントを解決してからリムーブする）そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。
//
// DSL:
//   a1 = triggered, hook 'enter' selfOnly,
//        sequence[ deckRevealUntil{player:self, filter:{color:緑,kind:event}, bind:$revealed, bindMatch:$matched},
//                  conditional{ if bound $matched matched → handAddFromDeck{cardId:$matched.cardId} },
//                  deckToBottomBound{bindKey:$revealed}, deckShuffle ]
//        ★ chooseMatch/maxN 無し = 従来 semantics「上から match まで 1 枚ずつ reveal、match で stop」。
//        「それを手札に加える」= forced (「まで」でない) → 公式Q&A「必ず加えます」。pick を surface しない
//        全自動 path (owner が human でも chooseMatch:'upTo' でないため deckRevealUntil pick は出ない)。
//   a2 = triggered, hook 'effect:declared', matcherCondition and[ triggerCardMatches{緑,event},
//        or[eventUseSource{viaEffect:false}, eventUseSource{viaEffect:true}] ], condition turn:self,
//        limit turn:1, effect optional{ chain[ discard{player:self,n:1}, sceneRemove{player:self,max:1,
//        side:either,cause:effect,filter:{levelMax:7}} ] }。
//
// novel 経路 = production dispatch (全て engine 実評価):
//   a1: sceneEnter atom (viaEffect, from remove) で B03028 を実登場 → 'enter' hook 実 emit → 登録済
//       triggered listener が a1 (selfOnly) 発火 (BUG-146 経路)。deckRevealUntil (picks.ts) が
//       filter{緑,event} で match まで reveal (赤event=色外 / 緑character=kind外 は match せず revealed-past
//       として $revealed に入る) → handAddFromDeck が $matched を deck→hand → deckToBottomBound が
//       $revealed (match 除外の revealed-past) を deck 下へ → deckShuffle。shuffle 後は membership+length のみ
//       検証 (順序は非決定)。緑event 不在なら match=null → conditional 不発 (handAdd なし) → 全 reveal が
//       $revealed = 全部デッキ下 (公式Q&A「何も加えずデッキに移してシャッフル」)。
//   a2: 「自分が【緑】のイベントを使用したとき」= B08020 a2 同型の第三者 observer (scene-resident、非 selfOnly)。
//       handUseCard(self, 緑event) → effect:declared{kind:'event-use',cardId,player} 実 emit → listener が
//       matcherCondition (triggerCardMatches{緑,event} ∧ eventUseSource(event-use)) + condition turn:self +
//       limit turn:1 gate 通過で declared-reaction を queue (limit は queue 時に消費 = rules/24 §0-pick でも
//       発動済)。reaction は raw queue → stack.runOne の resolveDeferredEntryPicks で「イベント解決後の盤面」
//       で pick 確定 (BUG-132 GAP-2)。effect が optional → human owner のとき __pendingEffectOptionalSide が
//       surface (AI/非human は skip = 使わない、resolve-picks.ts:661)。applyOptionalAndContinuation(run:true)
//       で inner chain[discard n:1 → sceneRemove levelMax7] を再開 → AI drain。
//       「自分が」= condition turn:self による間接実装 (イベント使用は使用者ターンに限る、B08020 header 注記)。
//
// decoy / off-variant (rules/15,17,20,24 + カード固有 Q&A):
//   a1: 赤event (色外) / 緑character (kind外) は deckRevealUntil filter で match せず revealed-past → デッキ下。
//   a2: 非緑イベント使用 → triggerCardMatches 不成立 → 非発火 (S5) / 相手ターン (turn:opp) の使用 →
//       condition turn:self 不成立 → 非発火 (S6、「自分が」の side 遮蔽) / lv8 char → sceneRemove filter
//       levelMax:7 外 = 非除去 (S4) / 【ターン1】= 同ターン2度目の緑event使用は非発火 (limit、S7)。
//   BUG-174 owner=opp: condition turn:self は owner 相対 → opp 所有 B03028 は self ターンの緑event使用で
//       非発火 (literal-'self' へ反転しない) を S8 で pin。opp 所有の firing 経路 (discard/sceneRemove pick の
//       side 解決) は B08082/B07053 と同じく PB-shortform latent を避け、robust な condition 次元 (非発火) で担う。
//
// カード固有 Q&A (payloads/B03028.json qa):
//   - 【緑】イベント不在で全公開 → 何も加えずデッキへ戻しシャッフル (S3 で pin)。
//   - 公開された【緑】イベントを加えないことは不可 = 必ず加える (a1 forced、S2 で hand 取得を pin)。
//   - 緑イベントの【カットイン】【ヒラメキ】では a2 非発火 = payload kind が event-use でない (eventUseSource
//     が event-use 明示 gate。本 probe は手札の使用経路のみ駆動、cutin/hirameki は emit 形状違いで対象外)。
//   - 手札リムーブしなくても能力は一度発動済でこのターン再発動不可 = limit は fire 時消費 (S7 で pin)。
//
// カード本体 / engine は編集禁止。test 側のみ調整して green。
// beforeEach で registry 再登録 → event._resetRegistry() 必須 (handler 累積で N 重発火、CLAUDE.md 規約)。
// rules: 05-turn-phases.md, 07-action-flow.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md,
//        17-icons.md, 20-color-and-switch.md, 24-qa-naming-stun.md, 25-qa-effects-resolution.md, 26-qa-deck-refresh.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  applyOptionalAndContinuation,
  _drainAllEffectPicksForTest,
} from '@/engine/effect/apply-pick';
import {
  _peekPendingEffectOptionalSide,
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
} from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B03028 } from '@/cards/ct-p03/B03028';
import type { CardDef, GameState, EffectCtx, Effect, Player, AbilityDef } from '@/engine/types';

type Side = 'self' | 'opp';
const HUMAN = globalThis as { __humanPlayerSide?: Side | null };
const g = globalThis as {
  __pendingDeckRevealSide?: unknown;
  __pendingDeckReorderSide?: unknown;
};

// ── synthetic defs (色/種別/レベルを明示 — filter は registry の def を読む) ──
function evDef(id: string, color: string, level = 1): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors: [color], level,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
function chDef(id: string, color: string, level: number): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: [color], level, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

// a1 deckRevealUntil fixtures
const GREV = 'GREV';      // 緑 event → a1 の match / a2 の使用イベント (valid)
const GREV2 = 'GREV2';    // 緑 event (a2 limit 2度目)
const REDEV = 'REDEV';    // 赤 event → a1 decoy (色外, revealed-past) / a2 decoy (triggerCardMatches 外)
const GRCHAR = 'GRCHAR';  // 緑 character → a1 decoy (kind外, revealed-past)
const REST1 = 'REST1';    // 未公開で残るデッキカード
const REST2 = 'REST2';
// a2 sceneRemove fixtures
const OPP_LOW = 'OPP_LOW';   // opp lv5 char → sceneRemove valid (levelMax:7 内)
const OPP_HI = 'OPP_HI';     // opp lv8 char → sceneRemove decoy (levelMax:7 外)
const EXTRA = 'EXTRA';       // discard n:1 用の手札カード

const FB = { type: 'card-back' as const, cardId: '__FILE__' };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerCardDef(B03028);
  registerCardDef(evDef(GREV, '緑'));
  registerCardDef(evDef(GREV2, '緑'));
  registerCardDef(evDef(REDEV, '赤'));
  registerCardDef(chDef(GRCHAR, '緑', 3));
  registerCardDef(chDef(REST1, '青', 3));
  registerCardDef(chDef(REST2, '青', 3));
  registerCardDef(chDef(OPP_LOW, '赤', 5));
  registerCardDef(chDef(OPP_HI, '赤', 8));
  registerCardDef(chDef(EXTRA, '青', 3));
  registerTriggeredListener();
  HUMAN.__humanPlayerSide = null;
  g.__pendingDeckRevealSide = null;
  g.__pendingDeckReorderSide = null;
});

// ── a1 driver: sceneEnter (viaEffect, from remove) で 'enter' 実 emit → a1 全自動解決 ──
function summon(cardId: string): Effect {
  return {
    kind: 'atom', verb: 'sceneEnter',
    args: { player: 'self', cardId, viaEffect: true, target: { query: { area: 'remove', side: 'self' } } },
  } as unknown as Effect;
}
function srcCtx(player: Player): EffectCtx {
  return { source: { cardId: 'SUMMONER', uid: 'sum#1', abilityId: 'x', player, area: 'scene' }, bindings: {} } as EffectCtx;
}
function enterHattori(base: GameState): GameState {
  return produce(base, (d) => {
    d.players.self.remove = [...d.players.self.remove, 'B03028'];
    runEffect(d, summon('B03028'), srcCtx('self'));
    runAllUntilEmpty(d);
  });
}

// ── a2 driver: turn=turnPlayer で B03028 を owner の scene に置き、user が 緑event を手札使用 ──
function board(owner: Side, turnPlayer: Side): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  for (const side of ['self', 'opp'] as Side[]) {
    s.players[side].case.colors = ['緑'];
    s.players[side].file = [FB, FB, FB]; // FILE3 ≥ event level1
  }
  s.players[owner].scene = [sceneChar('B03028', 'hatt#1', { state: 'active' })];
  return s;
}
// user が緑イベントを手札使用 → effect:declared 実 emit → a2 reaction を runAllUntilEmpty まで進める
function useEvent(base: GameState, user: Side, cardId: string): GameState {
  return produce(base, (d) => {
    handUseCard(d, user, cardId);
    runAllUntilEmpty(d);
  });
}
// optional を accept して inner chain[discard, sceneRemove] を AI drain で完走
function acceptOptional(s: GameState): GameState {
  const out = produce(s, (d) => {
    const p = _peekPendingEffectOptionalSide();
    if (!p) throw new Error('optional side が surface していない');
    applyOptionalAndContinuation(d, p, true);
    _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    runAllUntilEmpty(d);
  });
  // applyOptionalAndContinuation は side-channel を自動 clear しない (cluster11 と同運用) →
  // 次 scenario / 次 emit の peek に stale entry が漏れないよう明示 clear。
  _clearPendingEffectOptionalSide();
  return out;
}

// ============================================================
// descriptor pin — codegen drift 検出
// ============================================================
describe('B03028 服部平次 — shape (descriptor)', () => {
  it('id/no/色/lv/ap/lp/特徴 + a1 enter sequence(deckRevealUntil…) / a2 effect:declared optional(discard→sceneRemove)', () => {
    expect(B03028.id).toBe('B03028');
    expect(B03028.no).toBe('0285/B03028');
    expect(B03028.kind).toBe('character');
    expect(B03028.colors).toEqual(['緑']);
    expect(B03028.level).toBe(8);
    expect(B03028.ap).toBe(7000);
    expect(B03028.lp).toBe(2);
    expect(B03028.traits).toEqual(['探偵', '高校生']);

    const a1 = B03028.abilities[0] as AbilityDef;
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const steps = (a1.effect as { steps: Array<{ kind: string; verb?: string; args?: Record<string, unknown> }> }).steps;
    expect(steps[0]).toMatchObject({ verb: 'deckRevealUntil', args: { player: 'self', filter: { color: '緑', kind: 'event' }, bind: '$revealed', bindMatch: '$matched' } });
    expect(steps[0]?.args?.chooseMatch, 'chooseMatch 無し = forced 取得 (「まで」でない)').toBeUndefined();
    expect(steps[1]).toMatchObject({ kind: 'conditional', then: { verb: 'handAddFromDeck', args: { cardId: '$matched.cardId' } } });
    expect(steps[2]).toMatchObject({ verb: 'deckToBottomBound', args: { bindKey: '$revealed' } });
    expect(steps[3]).toMatchObject({ verb: 'deckShuffle' });

    const a2 = B03028.abilities[1] as AbilityDef;
    expect(a2.type).toBe('triggered');
    expect(a2.trigger).toMatchObject({ hook: 'effect:declared' });
    expect(a2.condition).toMatchObject({ kind: 'turn', player: 'self' });
    expect(a2.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a2.effect).toMatchObject({ kind: 'optional' });
    const chain = (a2.effect as { effect: { steps: Array<{ verb: string; args: Record<string, unknown> }> } }).effect.steps;
    expect(chain[0]).toMatchObject({ verb: 'discard', args: { player: 'self', n: 1 } });
    expect(chain[1]).toMatchObject({ verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 7 } } });
  });
});

// ============================================================
// a1 — 【登場時】緑イベントが出るまで公開 → それを手札 / 残りをデッキ下 → シャッフル
// ============================================================
describe('B03028 a1 — 登場時 deckRevealUntil(緑event) → 手札加入 + 残りデッキ下', () => {
  it('S2 happy: [赤ev, 緑char, 緑ev, REST1, REST2] → 緑ev を手札 / 赤ev・緑char は revealed-past としてデッキ下 / REST は未公開でデッキ残留', () => {
    const base = createEmptyGameState();
    // top から: REDEV(色外) → GRCHAR(kind外) → GREV(match, stop)。REST1/REST2 は未公開。
    base.players.self.deck = [REDEV, GRCHAR, GREV, REST1, REST2];
    const s = enterHattori(base);

    // B03028 が現場に登場 (a1 の selfOnly enter 発火の前提)
    expect(s.players.self.scene.some((c) => c.cardId === 'B03028'), 'B03028 登場').toBe(true);
    // 「それを手札に加える」= 緑event を必ず取得 (forced、公式Q&A)
    expect(s.players.self.hand, '緑event GREV を手札に加える').toContain(GREV);
    expect(s.players.self.hand, '緑event 以外は手札に入らない').toEqual([GREV]);
    // 緑event は deck から抜ける
    expect(s.players.self.deck, '取得した緑event はデッキに残らない').not.toContain(GREV);
    // 赤event(色外) と 緑char(kind外) は match せず revealed-past → デッキ下 (デッキに残る)
    expect(s.players.self.deck, '赤event は match せずデッキへ (色外)').toContain(REDEV);
    expect(s.players.self.deck, '緑character は match せずデッキへ (kind外)').toContain(GRCHAR);
    // 未公開の REST もデッキに残る
    expect(s.players.self.deck, 'REST1 未公開でデッキ残留').toContain(REST1);
    expect(s.players.self.deck, 'REST2 未公開でデッキ残留').toContain(REST2);
    // 合計: 5枚 − 取得1 = 4枚
    expect(s.players.self.deck.length, '緑event 1枚がデッキから hand へ移動 → deck 4枚').toBe(4);
  });

  it('S3 fallback (緑event 不在): 全公開しても match なし → 何も手札に加えず全部デッキへ戻す (公式Q&A)', () => {
    const base = createEmptyGameState();
    base.players.self.deck = [REDEV, GRCHAR, REST1]; // 緑event なし
    const s = enterHattori(base);

    expect(s.players.self.scene.some((c) => c.cardId === 'B03028'), 'B03028 登場').toBe(true);
    // 何も手札に加わらない ($matched=null → conditional 不発)
    expect(s.players.self.hand, '緑event 不在 → 手札に何も加えない').toEqual([]);
    // 全 reveal がデッキ下へ戻る (枚数不変)
    expect(s.players.self.deck.length, 'デッキ枚数不変 (全部戻る)').toBe(3);
    expect([...s.players.self.deck].sort(), '3枚とも依然デッキ内 (順は shuffle で不定)').toEqual([GRCHAR, REDEV, REST1].sort());
  });
});

// ============================================================
// a2 — 【自分ターン中】【ターン1】自分が緑event使用 → (optional) 手札1リムーブ → lv7以下キャラ1リムーブ
// ============================================================
describe('B03028 a2 — 緑event 使用に反応: optional discard → lv7以下 sceneRemove', () => {
  it('S4 happy: self が緑event使用 → optional accept → EXTRA discard + opp lv5 除去 / opp lv8 は levelMax:7 外で残存', () => {
    HUMAN.__humanPlayerSide = 'self'; // optional は human owner のときのみ surface
    let s = board('self', 'self');
    s.players.self.hand = [GREV, EXTRA]; // GREV=使用, EXTRA=discard 用
    s.players.opp.scene = [
      sceneChar(OPP_LOW, 'olow#1', { state: 'active' }), // lv5 valid target
      sceneChar(OPP_HI, 'ohi#1', { state: 'active' }),   // lv8 decoy (filter 外)
    ];

    s = useEvent(s, 'self', GREV);
    // 使用イベントは remove へ、a2 reaction が optional として surface
    expect(s.players.self.remove, '使用した緑event は remove へ着地').toContain(GREV);
    expect(_peekPendingEffectOptionalSide(), 'a2 optional が surface (「手札を1枚リムーブしてもよい」)').not.toBeNull();

    s = acceptOptional(s);
    HUMAN.__humanPlayerSide = null;

    // discard: EXTRA が手札→remove
    expect(s.players.self.hand, 'discard で EXTRA が手札から抜ける').not.toContain(EXTRA);
    expect(s.players.self.remove, 'EXTRA は remove へ').toContain(EXTRA);
    // sceneRemove: opp lv5 が除去 / opp lv8 は levelMax:7 外で残存
    expect(s.players.opp.scene.some((c) => c.uid === 'olow#1'), 'opp lv5 は sceneRemove で除去').toBe(false);
    expect(s.players.opp.remove, 'opp lv5 は相手 remove へ').toContain(OPP_LOW);
    expect(s.players.opp.scene.some((c) => c.uid === 'ohi#1'), 'opp lv8 は levelMax:7 外 → 残存').toBe(true);
  });

  it('S5 off-variant 非緑イベント: self が赤event使用 → triggerCardMatches{緑} 不成立 → a2 非発火', () => {
    HUMAN.__humanPlayerSide = 'self';
    let s = board('self', 'self');
    s.players.self.case.colors = ['緑', '赤']; // 赤event も使えるよう 2色事件に
    s.players.self.hand = [REDEV, EXTRA];
    s.players.opp.scene = [sceneChar(OPP_LOW, 'olow#1', { state: 'active' })];

    s = useEvent(s, 'self', REDEV);
    HUMAN.__humanPlayerSide = null;

    expect(_peekPendingEffectOptionalSide(), '赤event使用 → a2 非発火 (optional 不 surface)').toBeNull();
    expect(s.pendingEffects.length, 'reaction が queue されない').toBe(0);
    expect(s.players.self.hand, 'EXTRA は手札に残る (discard なし)').toContain(EXTRA);
    expect(s.players.opp.scene.some((c) => c.uid === 'olow#1'), 'opp lv5 は除去されない').toBe(true);
  });

  it('S6 off-variant 相手ターン (turn:opp): opp が緑event使用 → self所有 a2 の condition turn:self 不成立 → 非発火 (「自分が」遮蔽)', () => {
    HUMAN.__humanPlayerSide = 'opp';
    let s = board('self', 'opp'); // B03028 は self 所有 / ターンは opp
    s.players.opp.hand = [GREV, EXTRA];
    s.players.self.scene = [
      sceneChar('B03028', 'hatt#1', { state: 'active' }),
      sceneChar(OPP_LOW, 'slow#1', { state: 'active' }),
    ];

    s = useEvent(s, 'opp', GREV);
    HUMAN.__humanPlayerSide = null;

    expect(_peekPendingEffectOptionalSide(), 'opp ターンの緑event使用 → self所有 a2 は非発火').toBeNull();
    expect(s.pendingEffects.length, 'reaction が queue されない (condition turn:self 不成立)').toBe(0);
    expect(s.players.self.scene.some((c) => c.uid === 'slow#1'), 'self キャラは除去されない').toBe(true);
  });

  it('S7 【ターン1】limit: 同ターン2回目の緑event使用では a2 が発火しない (1回目で消費、rules/24)', () => {
    HUMAN.__humanPlayerSide = 'self';
    let s = board('self', 'self');
    // GREV2 は 1回目の discard で誤消費されないよう、2回目直前に手札へ追加する
    s.players.self.hand = [GREV, EXTRA];
    s.players.opp.scene = [
      sceneChar(OPP_LOW, 'olow#1', { state: 'active' }),
      sceneChar(OPP_LOW, 'olow#2', { state: 'active' }),
    ];

    // 1回目: 発火 → optional accept → EXTRA discard + olow#1 除去
    s = useEvent(s, 'self', GREV);
    expect(_peekPendingEffectOptionalSide(), '1回目は a2 発火').not.toBeNull();
    s = acceptOptional(s);
    expect(s.players.opp.scene.some((c) => c.uid === 'olow#1'), '1回目で opp キャラ1体除去').toBe(false);

    // 2回目: 同ターン → limit 消費済で非発火 (handUseUsed は複数使用経路を模して reset、GREV2 を手札へ)
    s = produce(s, (d) => { d.turnState.self.handUseUsed = false; d.players.self.hand.push(GREV2); });
    // pendingEffects は 1回目 fire の settled entry を保持するため、2回目で「増えない」ことで非発火を pin
    const pendingBefore = s.pendingEffects.length;
    s = useEvent(s, 'self', GREV2);
    HUMAN.__humanPlayerSide = null;

    expect(_peekPendingEffectOptionalSide(), '2回目は【ターン1】で非発火 (optional 不 surface)').toBeNull();
    expect(s.pendingEffects.length, '2回目は新規 reaction が queue されない (limit 消費済)').toBe(pendingBefore);
    expect(s.players.opp.scene.some((c) => c.uid === 'olow#2'), '2回目は sceneRemove 起きず opp 2体目残存').toBe(true);
  });

  it('S8 owner=opp reversal pin (BUG-174): opp所有 B03028 は self ターンの緑event使用で非発火 (condition turn:self は owner 相対、literal反転せず)', () => {
    HUMAN.__humanPlayerSide = 'self';
    let s = board('opp', 'self'); // B03028 は opp 所有 / ターンは self
    s.players.self.hand = [GREV, EXTRA];
    // 両側に lv≤7 キャラを置き「誤発火で誰かが除去される」を検出
    s.players.self.scene = [sceneChar(OPP_LOW, 'slow#1', { state: 'active' })];
    s.players.opp.scene = [
      sceneChar('B03028', 'hatt#1', { state: 'active' }),
      sceneChar(OPP_LOW, 'olow#1', { state: 'active' }),
    ];
    const selfHandBefore = [...s.players.self.hand];

    s = useEvent(s, 'self', GREV);
    HUMAN.__humanPlayerSide = null;

    // opp 所有の a2 は condition turn:self (owner=opp → turn.player が opp である必要) が self ターンで不成立 → 非発火
    expect(_peekPendingEffectOptionalSide(), 'opp所有 a2 は self ターンで非発火 (owner 相対、反転せず)').toBeNull();
    expect(s.pendingEffects.length, 'reaction が queue されない').toBe(0);
    // 誰も除去されない / discard も起きない
    expect(s.players.self.scene.some((c) => c.uid === 'slow#1'), 'self キャラ残存').toBe(true);
    expect(s.players.opp.scene.some((c) => c.uid === 'olow#1'), 'opp キャラ残存').toBe(true);
    // GREV 使用による手札減 (=GREV 消費) のみ。EXTRA は discard されず残る
    expect(s.players.self.hand, 'EXTRA は discard されず手札に残る (a2 非発火)').toContain(EXTRA);
    expect(s.players.self.hand.length, 'GREV 使用ぶんのみ手札減 (a2 discard は起きない)').toBe(selfHandBefore.length - 1);
  });
});
