// engine mega-wave W5 — dyn/cost probe (r37/r38/r47)
// step1: $bound.<key>.<field> dyn root (統合 resolveBound: count / level / cardName)
// rules: 15-abilities-effects.md (Effect Descriptor parameterization) / 19-special-rules.md (実効値)
// B09109 QA1: 「効果を解決する時点の (増減/書き換え後の) レベルやカード名を参照」→ uid bound は実効値。

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { evalDyn } from '@/engine/dyn/eval';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { produce } from '@/engine/produce';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAtom } from '@/engine/effect/atom-handlers';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyPickAndContinuation, applyPickSkipAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide, _peekPendingEffectPickQueueLength } from '@/engine/effect/resolve-picks';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import type { GameState, SceneCharacter, CardDef, EvidenceCard, Effect } from '@/engine/types';
import { makeChar, makeCtx } from '../helpers/fixtures';

const g = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };

function ev(cardId: string, faceUp = false): EvidenceCard {
  return { cardId, faceUp, origin: { turn: 1, via: 'opening' } };
}

function withScene(s: GameState, p: 'self' | 'opp', chars: SceneCharacter[]): GameState {
  return {
    ...s,
    players: { ...s.players, [p]: { ...s.players[p], scene: chars } },
  };
}

function defOf(overrides: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: overrides.id,
    no: overrides.no ?? 'NO',
    kind: 'character',
    names: ['default-name'],
    colors: [],
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...overrides,
  };
}

describe('megaw5 step1 — $bound.<key>.<field> dyn root', () => {
  beforeEach(() => {
    _resetRegistry();
  });

  it('$bound.<key>.count returns bound array length (r38)', () => {
    const s = createEmptyGameState();
    const ctx = makeCtx({ bindings: { $flipped: [{ cardId: 'C001' }, { cardId: 'C002' }, { cardId: 'C003' }] } });
    expect(evalDyn(s, '$bound.$flipped.count', ctx)).toBe(3);
  });

  it('$bound.<missing-key>.count returns 0 (defensive)', () => {
    const s = createEmptyGameState();
    expect(evalDyn(s, '$bound.$flipped.count', makeCtx())).toBe(0);
  });

  it('$bound.<key>.level with uid binding returns EFFECTIVE level (charRead.level, lvlMod honored)', () => {
    registerCardDef(defOf({ id: 'LV5', level: 5 }));
    const s = withScene(createEmptyGameState(), 'self', [
      makeChar({
        uid: 'u1', cardId: 'LV5',
        turnEffects: { contactImmune: false, removeOnTurnEnd: false, lvlMod_turn: 2 },
      }),
    ]);
    const ctx = makeCtx({ bindings: { chosenChar: [{ kind: 'char', uid: 'u1', cardId: 'LV5', player: 'self' }] } });
    expect(evalDyn(s, '$bound.chosenChar.level', ctx)).toBe(7);
  });

  it('$bound.<key>.level with cardId-only binding returns printed CardDef.level (souza-bound, no uid)', () => {
    registerCardDef(defOf({ id: 'LV6', level: 6 }));
    const s = createEmptyGameState();
    const ctx = makeCtx({ bindings: { souzaFound: [{ kind: 'card', cardId: 'LV6', area: 'deck', player: 'opp' }] } });
    expect(evalDyn(s, '$bound.souzaFound.level', ctx)).toBe(6);
  });

  it('$bound.<key>.cardName returns primary card name', () => {
    registerCardDef(defOf({ id: 'NM1', names: ['怪盗キッド'] }));
    const s = createEmptyGameState();
    const ctx = makeCtx({ bindings: { chosenChar: [{ kind: 'char', uid: 'u9', cardId: 'NM1', player: 'self' }] } });
    // uid 'u9' は盤面に不在 → cardId フォールバックで printed 名 (defensive)
    expect(evalDyn(s, '$bound.chosenChar.cardName', ctx)).toBe('怪盗キッド');
  });

  it('$bound.<missing-key>.level returns NaN (defensive, no throw)', () => {
    const s = createEmptyGameState();
    const v = evalDyn(s, '$bound.nope.level', makeCtx());
    expect(typeof v).toBe('number');
    expect(Number.isNaN(v)).toBe(true);
  });

  it('$bound.<missing-key>.cardName returns empty string (defensive)', () => {
    const s = createEmptyGameState();
    expect(evalDyn(s, '$bound.nope.cardName', makeCtx())).toBe('');
  });

  it('$bound.<key>.<unknown-field> throws', () => {
    const s = createEmptyGameState();
    const ctx = makeCtx({ bindings: { k: [{ cardId: 'C001' }] } });
    expect(() => evalDyn(s, '$bound.k.bogus', ctx)).toThrow(/unknown \$bound field/);
  });

  it('$bound arithmetic composes: $bound.$flipped.count*1 in expression', () => {
    const s = createEmptyGameState();
    const ctx = makeCtx({ bindings: { $flipped: [{ cardId: 'A' }, { cardId: 'B' }] } });
    expect(evalDyn(s, '$bound.$flipped.count*2', ctx)).toBe(4);
  });
});

// ============================================================
// step2 (r38) — evidenceFlip multi (cardIds 契約) + bind writeback + dyn-max
// B08028 日向幸「自分の裏向きの証拠を好きな数選び、表向きにする。この効果によって
// 表向きにした枚数と同じ数まで相手の裏向きの証拠を選び、表向きにする。」
// ============================================================
describe('megaw5 step2 — evidenceFlip multi + bind + dyn-max (r38)', () => {
  beforeEach(() => {
    _resetRegistry();
    _clearPendingEffectPickQueue();
    g.__humanPlayerSide = null;
  });
  afterEach(() => { g.__humanPlayerSide = null; });

  const ctxOf = () => makeCtx({ source: { player: 'self', uid: 'src#1', cardId: 'B08028', area: 'scene' } });

  // B08028 効果 sequence (short-form multi + cardIds 契約 両 step)
  const mirrorSeq: Effect = {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'evidenceFlip', args: { player: 'self', cardIds: '$pick.cardIds', max: 99, faceDown: true, bind: '$flipped' } },
      { kind: 'atom', verb: 'evidenceFlip', args: { player: 'opp', cardIds: '$pick.cardIds', max: { dyn: '$bound.$flipped.count' }, faceDown: true } },
    ],
  } as Effect;

  it('runAtom 直接: cardIds 解決済 array → 裏向きのみ flip + bind writeback (faceUp decoy 不変)', () => {
    const s = createEmptyGameState();
    s.players.self.evidence = [ev('E1'), ev('E2'), ev('E3', true)];
    const ctx = ctxOf();
    const r = produce(s, d => { runAtom(d, 'evidenceFlip', { player: 'self', cardIds: ['E1', 'E2'], bind: '$flipped' }, ctx); });
    expect(r.players.self.evidence[0].faceUp).toBe(true);
    expect(r.players.self.evidence[1].faceUp).toBe(true);
    expect(r.players.self.evidence[2].faceUp, 'faceUp decoy 不変').toBe(true);
    expect(ctx.bindings['$flipped']).toEqual([{ cardId: 'E1' }, { cardId: 'E2' }]);
  });

  it('runAtom 直接: cardIds 内に裏向き不在 cardId → skip + bind は実 flip 分のみ', () => {
    const s = createEmptyGameState();
    s.players.self.evidence = [ev('E1')];
    const ctx = ctxOf();
    const r = produce(s, d => { runAtom(d, 'evidenceFlip', { player: 'self', cardIds: ['E1', 'NOPE'], bind: '$flipped' }, ctx); });
    expect(r.players.self.evidence[0].faceUp).toBe(true);
    expect(ctx.bindings['$flipped']).toEqual([{ cardId: 'E1' }]);
  });

  it('human 経路: mirror sequence — step1 pick 適用 (2枚) → step2 pick の nMax=2 (mirror-count) → 相手2枚 flip', () => {
    g.__humanPlayerSide = 'self';
    const s = createEmptyGameState();
    s.players.self.evidence = [ev('S1'), ev('S2'), ev('S3')];
    s.players.opp.evidence = [ev('O1'), ev('O2'), ev('O3')];
    const ctx = ctxOf();
    runEffect(s, mirrorSeq, ctx);
    runAllUntilEmpty(s);
    const p1 = _drainPendingEffectPickSide();
    expect(p1?.atomVerb).toBe('evidenceFlip');
    expect(p1!.candidates.length, 'step1 候補 = 自分の裏向き3枚').toBe(3);
    const uids = p1!.candidates.slice(0, 2).map(x => x.uid);
    applyPickAndContinuation(s, p1!, uids[0]!, uids);
    expect(s.players.self.evidence.filter(e => e.faceUp).length, '自分2枚 flip').toBe(2);
    const p2 = _drainPendingEffectPickSide();
    expect(p2?.atomVerb, 'step2 pick が継続で enqueue される').toBe('evidenceFlip');
    expect(p2!.candidates.length, 'step2 候補 = 相手の裏向き3枚').toBe(3);
    expect(p2!.nMax, 'mirror-count: nMax = 表向きにした枚数 2').toBe(2);
    const oUids = p2!.candidates.slice(0, 2).map(x => x.uid);
    applyPickAndContinuation(s, p2!, oUids[0]!, oUids);
    expect(s.players.opp.evidence.filter(e => e.faceUp).length, '相手2枚 flip').toBe(2);
  });

  it('human 経路: step1 skip (0枚) → step2 は no-op (相手 flip 0、pick も出ない)', () => {
    g.__humanPlayerSide = 'self';
    const s = createEmptyGameState();
    s.players.self.evidence = [ev('S1')];
    s.players.opp.evidence = [ev('O1')];
    const ctx = ctxOf();
    runEffect(s, mirrorSeq, ctx);
    runAllUntilEmpty(s);
    const p1 = _drainPendingEffectPickSide();
    expect(p1?.atomVerb).toBe('evidenceFlip');
    applyPickSkipAndContinuation(s, p1!);
    // step2: mirror-count 0 → 相手側 flip なし。pending が出てもゼロ pick / 出ないのが正。
    const p2 = _drainPendingEffectPickSide();
    if (p2) expect(p2.nMax ?? 0, 'step2 が出るなら nMax=0').toBe(0);
    expect(s.players.opp.evidence.filter(e => e.faceUp).length, '相手 flip 0').toBe(0);
  });

  it('AI drain 経路: mirror-count 上限 — 自分2枚しか裏向きが無い場合、相手は3枚あっても2枚まで', () => {
    const s = createEmptyGameState();
    s.players.self.evidence = [ev('S1'), ev('S2')];
    s.players.opp.evidence = [ev('O1'), ev('O2'), ev('O3')];
    const ctx = ctxOf();
    runEffect(s, mirrorSeq, ctx);
    runAllUntilEmpty(s);
    drainAiEffectPicks(s, new HeuristicPolicy());
    expect(s.players.self.evidence.filter(e => e.faceUp).length, 'AI greedy: 自分2枚全部').toBe(2);
    expect(s.players.opp.evidence.filter(e => e.faceUp).length, 'mirror: 相手は2枚まで (3枚目は裏のまま)').toBe(2);
  });

  it('B08028 descriptor: a1 cost/effect + a2 ヒラメキ が印字句と 1対1', async () => {
    const { B08028 } = await import('@/cards/ct-p08/B08028');
    const a1 = B08028.abilities[0]!;
    expect(a1.type).toBe('declared');
    expect(a1.cost).toMatchObject({ kind: 'pay' });
    const items = (a1.cost as { items: unknown[] }).items;
    expect(items[0]).toMatchObject({ kind: 'sleepSelf' });
    expect(items[1]).toMatchObject({ kind: 'removeFromScene', n: 1 });
    expect((items[1] as { target: { query: { excludeSelf?: boolean; side?: string } } }).target.query).toMatchObject({ excludeSelf: true, side: 'self' });
    const steps = (a1.effect as { steps: { args: Record<string, unknown> }[] }).steps;
    expect(steps[0].args).toMatchObject({ player: 'self', cardIds: '$pick.cardIds', faceDown: true, bind: '$flipped' });
    expect(steps[1].args).toMatchObject({ player: 'opp', cardIds: '$pick.cardIds', max: { dyn: '$bound.$flipped.count' }, faceDown: true });
    const a2 = B08028.abilities[1]!;
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
  });

  it('B08028 cost: 現場に自分しかいない → canPay false (excludeSelf で候補0) / 2枚目が居れば true', async () => {
    const { B08028 } = await import('@/cards/ct-p08/B08028');
    const { canPay } = await import('@/engine/cost/evaluate');
    const { register } = await import('@/engine/read/def');
    register(B08028);
    const mk = (extra: boolean) => {
      const s = createEmptyGameState();
      s.players.self.scene = [
        makeChar({ uid: 'hyuga#1', cardId: 'B08028', state: 'active' }),
        ...(extra ? [makeChar({ uid: 'other#1', cardId: 'B08028', state: 'active' })] : []),
      ];
      return s;
    };
    const ctx = makeCtx({ source: { player: 'self', uid: 'hyuga#1', cardId: 'B08028', area: 'scene' } });
    const cost = B08028.abilities[0]!.cost!;
    expect(canPay(mk(false), cost, ctx), 'このキャラ以外が現場に居ない → 使用不可').toBe(false);
    expect(canPay(mk(true), cost, ctx), '他キャラが居れば使用可').toBe(true);
  });

  it('legacy 回帰: 単一 short-form (max:1) は従来 pick-await 挙動 (queue enqueue)', () => {
    g.__humanPlayerSide = 'self';
    const s = createEmptyGameState();
    s.players.opp.evidence = [ev('O1'), ev('O2')];
    const before = _peekPendingEffectPickQueueLength();
    runEffect(s, { kind: 'atom', verb: 'evidenceFlip', args: { player: 'opp', max: 1, faceDown: true } } as Effect, ctxOf());
    runAllUntilEmpty(s);
    expect(_peekPendingEffectPickQueueLength()).toBeGreaterThan(before);
    _clearPendingEffectPickQueue();
  });
});

// ============================================================
// step4 (r37) — Cost removeDeckTop.n の {dyn} 対応
// B04088 スコッチ〚相手の現場にいるキャラ1枚につき、デッキのカードを上から2枚リムーブする〛
// ============================================================
describe('megaw5 step4 — removeDeckTop.n dyn (r37)', () => {
  beforeEach(() => { _resetRegistry(); });

  const dynCost = { kind: 'removeDeckTop', player: 'self', n: { dyn: '$self.oppSceneCount*2' } } as never;

  function st(oppChars: number, deckN: number): GameState {
    const s = createEmptyGameState();
    registerCardDef({
      id: 'OPPC', no: 'NO', kind: 'character', names: ['opp-c'], colors: [], traits: [],
      rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], level: 1, ap: 1000, lp: 1,
    } as CardDef);
    s.players.opp.scene = Array.from({ length: oppChars }, (_, i) => makeChar({ uid: `o#${i}`, cardId: 'OPPC' }));
    s.players.self.deck = Array.from({ length: deckN }, (_, i) => `SD${i}`);
    s.players.opp.deck = ['OD1', 'OD2'];
    return s;
  }
  const ctx = () => makeCtx({ source: { player: 'self', uid: 'sc#1', cardId: 'B04088', area: 'scene' } });

  it('canPay: opp 2体 → n=4。deck4=true / deck3=false (部分支払い不可 QA)', async () => {
    const { canPay } = await import('@/engine/cost/evaluate');
    expect(canPay(st(2, 4), dynCost, ctx())).toBe(true);
    expect(canPay(st(2, 3), dynCost, ctx())).toBe(false);
  });

  it('canPay: opp 0体 → n=0 → 常に true (deck 0 でも)', async () => {
    const { canPay } = await import('@/engine/cost/evaluate');
    expect(canPay(st(0, 0), dynCost, ctx())).toBe(true);
  });

  it('pay: opp 2体 → self deck 上から4枚リムーブ + costPaid.ids 記録 / opp deck 不変', async () => {
    const { pay } = await import('@/engine/cost/pay');
    const s = st(2, 5);
    const c = ctx();
    const r = produce(s, d => { pay(d, dynCost, c); });
    expect(r.players.self.deck, '上4枚除去、残り1').toEqual(['SD4']);
    expect(r.players.self.remove).toEqual(expect.arrayContaining(['SD0', 'SD1', 'SD2', 'SD3']));
    expect((c.costPaid?.['removeDeckTop'] as { ids: string[] }).ids.length).toBe(4);
    expect(r.players.opp.deck, '相手 deck 不変 (player:self 固定)').toEqual(['OD1', 'OD2']);
  });

  it('pay: opp 0体 → n=0 no-op (deck 不変)', async () => {
    const { pay } = await import('@/engine/cost/pay');
    const s = st(0, 3);
    const r = produce(s, d => { pay(d, dynCost, ctx()); });
    expect(r.players.self.deck.length).toBe(3);
  });

  it('pay: deck ちょうど n 枚 → 全リムーブ後ただちにrefresh (rules/14, 21)', async () => {
    const { canPay } = await import('@/engine/cost/evaluate');
    const { pay } = await import('@/engine/cost/pay');
    const s = st(1, 2); // n=2, deck=2
    expect(canPay(s, dynCost, ctx())).toBe(true);
    const r = produce(s, d => { pay(d, dynCost, ctx()); });
    expect([...r.players.self.deck].sort()).toEqual(['SD0', 'SD1']);
    expect(r.players.self.remove).toEqual([]);
    expect(r.players.opp.evidence, 'refresh penalty').toHaveLength(1);
    expect(r.gameResult).toBeUndefined();
  });

  it('B04088 descriptor: cost {dyn} + partnerColor黒 + sceneRemove apMax8000 が印字句と 1対1', async () => {
    const { B04088 } = await import('@/cards/ct-p04/B04088');
    const { B04088P } = await import('@/cards/ct-p04/B04088P');
    const a1 = B04088.abilities[0]!;
    expect(a1.type).toBe('declared');
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '黒' });
    const items = (a1.cost as { items: unknown[] }).items;
    expect(items[0]).toMatchObject({ kind: 'sleepSelf' });
    expect(items[1]).toMatchObject({ kind: 'removeDeckTop', player: 'self', n: { dyn: '$self.oppSceneCount*2' } });
    expect((a1.effect as { args: Record<string, unknown> }).args).toMatchObject({ max: 1, side: 'either', filter: { apMax: 8000, kind: 'character' } });
    expect(B04088P.abilities[0]!).toMatchObject({ type: 'declared' });
  });

  it('B04088 E2E: canPay gate — deck6で支払い後、即時refresh', async () => {
    const { B04088 } = await import('@/cards/ct-p04/B04088');
    const { canPay } = await import('@/engine/cost/evaluate');
    const { pay } = await import('@/engine/cost/pay');
    registerCardDef(B04088);
    const mk = (deckN: number) => {
      const s = st(3, deckN);
      s.players.self.scene = [makeChar({ uid: 'sc#1', cardId: 'B04088', state: 'active' })];
      return s;
    };
    const c = ctx();
    const cost = B04088.abilities[0]!.cost!;
    expect(canPay(mk(5), cost, c), 'deck5 < n6 → 使用不可 (公式Q&A)').toBe(false);
    expect(canPay(mk(6), cost, c), 'deck6 = n6 → 使用可').toBe(true);
    const r = produce(mk(6), d => { pay(d, cost, c); });
    expect(r.players.self.deck.length, '6枚リムーブ後にrefreshで戻る').toBe(6);
    expect(r.players.self.remove).toEqual([]);
    expect(r.players.opp.evidence, 'refresh penalty').toHaveLength(1);
    expect(r.players.self.scene[0]!.state, 'sleepSelf も支払済').toBe('sleep');
  });

  it('回帰: 固定 number n は byte 等価挙動 (canPay/pay)', async () => {
    const { canPay } = await import('@/engine/cost/evaluate');
    const { pay } = await import('@/engine/cost/pay');
    const fixedCost = { kind: 'removeDeckTop', player: 'self', n: 3 } as never;
    expect(canPay(st(0, 3), fixedCost, ctx())).toBe(true);
    expect(canPay(st(0, 2), fixedCost, ctx())).toBe(false);
    const r = produce(st(0, 4), d => { pay(d, fixedCost, ctx()); });
    expect(r.players.self.deck).toEqual(['SD3']);
  });
});

// ============================================================
// step3 (r47) — TargetFilter levelIn/levelInBound + deckRevealUntil dispatch-time dyn filter
// B04074 降谷零「発見されたカードのいずれかと同じレベルのキャラを1枚まで選び、リムーブする」
// B09109 怪盗キッド&安室透 a1「そのキャラと同じレベルで同じカード名のキャラが出るまで1枚ずつ公開」
// ============================================================
describe('megaw5 step3 — levelIn/levelInBound + deckRevealUntil dyn filter (r47)', () => {
  beforeEach(() => {
    _resetRegistry();
    _clearPendingEffectPickQueue();
    g.__humanPlayerSide = null;
  });

  function regLv(id: string, level: number, name = `nm-${id}`): void {
    registerCardDef({
      id, no: 'NO', kind: 'character', names: [name], colors: [], traits: [],
      rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], level, ap: 1000, lp: 1,
    } as CardDef);
  }

  it('levelInBound: souza-bound の printed level 集合と一致するキャラのみ候補 (両現場、decoy 除外)', async () => {
    const { candidates } = await import('@/engine/target/candidates');
    regLv('LV3', 3); regLv('LV4', 4); regLv('LV6', 6); regLv('LV3d', 3); regLv('LV6d', 6);
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar({ uid: 'a#1', cardId: 'LV3' }), makeChar({ uid: 'b#1', cardId: 'LV4' })];
    s.players.opp.scene = [makeChar({ uid: 'c#1', cardId: 'LV6' })];
    const ctx = makeCtx({
      source: { player: 'self', uid: 'a#1', cardId: 'LV3', area: 'scene' },
      bindings: { souzaFound: [
        { kind: 'card', cardId: 'LV3d', area: 'deck', player: 'opp' },
        { kind: 'card', cardId: 'LV6d', area: 'deck', player: 'opp' },
      ] },
    });
    const cands = candidates(s, {
      kind: 'pick',
      query: { area: 'scene', side: 'either', filter: { levelInBound: { bindKey: 'souzaFound' } } },
      n: { min: 0, max: 1 }, chooser: 'self',
    } as never, ctx);
    const uids = cands.map(c => (c as { uid: string }).uid).sort();
    expect(uids, 'lvl3-self + lvl6-opp のみ (lvl4 decoy 除外)').toEqual(['a#1', 'c#1']);
  });

  it('levelInBound: binding 不在 → 候補0 (graceful、crash しない)', async () => {
    const { candidates } = await import('@/engine/target/candidates');
    regLv('LV3', 3);
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar({ uid: 'a#1', cardId: 'LV3' })];
    const cands = candidates(s, {
      kind: 'pick',
      query: { area: 'scene', side: 'either', filter: { levelInBound: { bindKey: 'nope' } } },
      n: { min: 0, max: 1 }, chooser: 'self',
    } as never, makeCtx());
    expect(cands.length).toBe(0);
  });

  it('levelIn (literal): 実効 level で判定 (lvlMod_turn honor)', async () => {
    const { candidates } = await import('@/engine/target/candidates');
    regLv('LV5', 5);
    const s = createEmptyGameState();
    s.players.self.scene = [
      makeChar({ uid: 'mod#1', cardId: 'LV5', turnEffects: { contactImmune: false, removeOnTurnEnd: false, lvlMod_turn: -1 } }),
      makeChar({ uid: 'raw#1', cardId: 'LV5' }),
    ];
    const cands = candidates(s, {
      kind: 'pick',
      query: { area: 'scene', side: 'self', filter: { levelIn: [4] } },
      n: { min: 0, max: 1 }, chooser: 'self',
    } as never, makeCtx({ source: { player: 'self', uid: 'mod#1', cardId: 'LV5', area: 'scene' } }));
    expect(cands.map(c => (c as { uid: string }).uid), '実効 lvl4 のみ (printed 5 は不一致)').toEqual(['mod#1']);
  });

  it('deckRevealUntil: filter の {dyn:$bound...} を dispatch 時に解決 — 同 level + 同名で停止 (B09109 a1)', () => {
    regLv('CC', 5, '怪盗キッド');
    regLv('D_LV3', 3);
    regLv('D_LV5_OTHER', 5, '安室透');
    regLv('D_LV5_SAME', 5, '怪盗キッド');
    regLv('D_LV9', 9);
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar({ uid: 'cc#1', cardId: 'CC' })];
    s.players.self.deck = ['D_LV3', 'D_LV5_OTHER', 'D_LV5_SAME', 'D_LV9'];
    const ctx = makeCtx({
      source: { player: 'self', uid: 'cc#1', cardId: 'CC', area: 'scene' },
      bindings: { chosenChar: [{ kind: 'char', uid: 'cc#1', cardId: 'CC', player: 'self' }] },
    });
    const r = produce(s, d => {
      runAtom(d, 'deckRevealUntil', {
        player: 'self',
        filter: {
          kind: 'character',
          levelMin: { dyn: '$bound.chosenChar.level' },
          levelMax: { dyn: '$bound.chosenChar.level' },
          cardName: { dyn: '$bound.chosenChar.cardName' },
        },
        bind: 'restRevealed', bindMatch: 'matchedChar',
      }, ctx);
    });
    void r;
    expect((ctx.bindings['matchedChar'] as { cardId: string }[])[0]?.cardId, '同 lvl5+同名で停止').toBe('D_LV5_SAME');
    expect((ctx.bindings['restRevealed'] as { cardId: string }[]).map(x => x.cardId), '残り = 手前2枚 (D_LV9 は未公開)').toEqual(['D_LV3', 'D_LV5_OTHER']);
  });

  it('deckRevealUntil: 実効 level 参照 (B09109 QA1) — lvlMod で level が変わった chosen char に追従', () => {
    regLv('CC2', 5, 'X');
    regLv('D_LV4_SAME', 4, 'X');
    regLv('D_LV5_SAME', 5, 'X');
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar({ uid: 'cc#2', cardId: 'CC2', turnEffects: { contactImmune: false, removeOnTurnEnd: false, lvlMod_turn: -1 } })];
    s.players.self.deck = ['D_LV5_SAME', 'D_LV4_SAME'];
    const ctx = makeCtx({
      source: { player: 'self', uid: 'cc#2', cardId: 'CC2', area: 'scene' },
      bindings: { chosenChar: [{ kind: 'char', uid: 'cc#2', cardId: 'CC2', player: 'self' }] },
    });
    produce(s, d => {
      runAtom(d, 'deckRevealUntil', {
        player: 'self',
        filter: { levelMin: { dyn: '$bound.chosenChar.level' }, levelMax: { dyn: '$bound.chosenChar.level' }, cardName: { dyn: '$bound.chosenChar.cardName' } },
        bindMatch: 'matchedChar',
      }, ctx);
    });
    expect((ctx.bindings['matchedChar'] as { cardId: string }[])[0]?.cardId, '実効 lvl4 に一致する D_LV4_SAME (printed5 は不一致)').toBe('D_LV4_SAME');
  });

  it('B04074 E2E (AI 経路): bond 不在 → 捜査2 + 発見 level 一致キャラのみ sceneRemove 候補', async () => {
    const { B04074 } = await import('@/cards/ct-p04/B04074');
    registerCardDef(B04074);
    regLv('SC_LV3', 3); regLv('SC_LV9', 9);
    regLv('OD_LV3', 3); regLv('OD_LV5', 5);
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      makeChar({ uid: 'furuya#1', cardId: 'B04074' }),
      makeChar({ uid: 'lv3#1', cardId: 'SC_LV3' }),
      makeChar({ uid: 'lv9#1', cardId: 'SC_LV9' }),
    ];
    s.players.opp.deck = ['OD_LV3', 'OD_LV5'];
    const ctx = makeCtx({ source: { player: 'self', uid: 'furuya#1', cardId: 'B04074', area: 'scene' } });
    runEffect(s, B04074.abilities[0]!.effect, ctx);
    runAllUntilEmpty(s);
    drainAiEffectPicks(s, new HeuristicPolicy());
    // 捜査2: 相手 deck 2枚が公開されデッキ下へ (順序保持) — bind '$found' = {lv3, lv5}
    expect(s.players.opp.deck.length, '捜査でデッキ枚数不変 (下へ移動)').toBe(2);
    // sceneRemove: 発見 level {3,5} と一致する lv3#1 のみ除去可能 → AI が 1枚 remove
    // (furuya 自身 lv7 / lv9 decoy は不一致)
    expect(s.players.self.remove.includes('SC_LV3'), 'lv3 が発見 level 一致でリムーブ').toBe(true);
    expect(s.players.self.scene.some(c => c.uid === 'lv9#1'), 'lv9 decoy は残る').toBe(true);
    expect(s.players.self.scene.some(c => c.uid === 'furuya#1'), '降谷 (lv7 不一致) は残る').toBe(true);
  });

  it('B04074 E2E: bond (風見裕也) 在 → 捜査4 に escalate', async () => {
    const { B04074 } = await import('@/cards/ct-p04/B04074');
    registerCardDef(B04074);
    registerCardDef({
      id: 'KAZAMI', no: 'NO', kind: 'character', names: ['風見裕也'], colors: [], traits: [],
      rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], level: 4, ap: 1000, lp: 1,
    } as CardDef);
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      makeChar({ uid: 'furuya#1', cardId: 'B04074' }),
      makeChar({ uid: 'kazami#1', cardId: 'KAZAMI' }),
    ];
    s.players.opp.deck = ['D1', 'D2', 'D3', 'D4', 'D5'];
    const logLenBefore = s.log.length;
    const ctx = makeCtx({ source: { player: 'self', uid: 'furuya#1', cardId: 'B04074', area: 'scene' } });
    runEffect(s, B04074.abilities[0]!.effect, ctx);
    runAllUntilEmpty(s);
    drainAiEffectPicks(s, new HeuristicPolicy());
    const souzaLog = s.log.slice(logLenBefore).find(l => l.action === 'souza');
    expect(souzaLog?.result, '捜査4 (代わりに)').toContain('4');
  });

  it('B09109 a1 idiom (chain): bindPick → deckRevealUntil dyn → sceneEnter $matched + rider + 残りデッキ下 + shuffle', async () => {
    regLv('KID5', 5, '怪盗キッド');
    regLv('DK_L3', 3); regLv('DK_KID5', 5, '怪盗キッド'); regLv('DK_L8', 8);
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [makeChar({ uid: 'kid#1', cardId: 'KID5' })];
    s.players.self.deck = ['DK_L3', 'DK_KID5', 'DK_L8'];
    // B09109 a1 の本 wave 解禁句 (optional 外側は既存 idiom ゆえ chain 部のみ probe)
    const a1chain: Effect = {
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'bindPick', args: { player: 'self', max: 1, filter: { levelMax: 8, kind: 'character' }, side: 'self', bind: 'chosenChar' } },
        { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', filter: { kind: 'character', levelMin: { dyn: '$bound.chosenChar.level' }, levelMax: { dyn: '$bound.chosenChar.level' }, cardName: { dyn: '$bound.chosenChar.cardName' } }, bind: 'restRevealed', bindMatch: 'matchedChar' } },
        // BUG-102 準拠: target.query.area='deck' で登場時にデッキから splice (無いと複製)。D11019 VERBATIM。
        { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: '$matchedChar.cardId', viaEffect: true, target: { query: { area: 'deck', side: 'self' } } } },
        { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: 'restRevealed' } },
        { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
      ],
    } as Effect;
    const ctx = makeCtx({ source: { player: 'self', uid: 'kid#1', cardId: 'KID5', area: 'scene' } });
    runEffect(s, a1chain, ctx);
    runAllUntilEmpty(s);
    drainAiEffectPicks(s, new HeuristicPolicy());
    // AI greedy が kid#1 (lv5) を bind → 同 lv5 同名 DK_KID5 で停止 → 登場
    expect(s.players.self.scene.some(c => c.cardId === 'DK_KID5'), '同 level+同名カードが登場').toBe(true);
    // 残り公開 (DK_L3) はデッキ下 → deck は [DK_L8, DK_L3] を shuffle した 2枚
    expect(s.players.self.deck.length).toBe(2);
    expect(s.players.self.deck.includes('DK_L3')).toBe(true);
    expect(s.players.self.deck.includes('DK_KID5')).toBe(false);
  });

  it('negative control (r47 risk): sequence だと bind が deckRevealUntil dispatch 前に確定するか — 実測記録', async () => {
    // chain 版と同一 DSL を sequence にした場合の挙動を固定 (壊れるなら card-authoring checklist の
    // 「chain 必須」根拠、壊れないなら short-form dispatch-time 解決の追加保証)。
    regLv('KID5b', 5, 'X2');
    regLv('DKb_KID5', 5, 'X2'); regLv('DKb_L1', 1);
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [makeChar({ uid: 'kb#1', cardId: 'KID5b' })];
    s.players.self.deck = ['DKb_L1', 'DKb_KID5'];
    const seq: Effect = {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'bindPick', args: { player: 'self', max: 1, filter: { levelMax: 8, kind: 'character' }, side: 'self', bind: 'chosenChar' } },
        { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', filter: { levelMin: { dyn: '$bound.chosenChar.level' }, levelMax: { dyn: '$bound.chosenChar.level' }, cardName: { dyn: '$bound.chosenChar.cardName' } }, bindMatch: 'matchedChar' } },
      ],
    } as Effect;
    const ctx = makeCtx({ source: { player: 'self', uid: 'kb#1', cardId: 'KID5b', area: 'scene' } });
    runEffect(s, seq, ctx);
    runAllUntilEmpty(s);
    drainAiEffectPicks(s, new HeuristicPolicy());
    const matched = (ctx.bindings['matchedChar'] as { cardId: string }[] | undefined)?.[0]?.cardId;
    // 実測固定 (W5 混成 review で強制失敗 probe により確認): AI 経路では bindPick (PA 短縮形) が
    // dispatch 時に即時解決されるため、sequence でも bind は次 atom より先に確定する。
    // この挙動が変わったら chain 必須制約の再評価が要る — 厳密 pin。
    expect(matched).toBe('DKb_KID5');
  });

  it('deckRevealUntil: dyn filter + 全 deck 不一致 → matched なし・全公開 (既存 no-match path 回帰)', () => {
    regLv('CC3', 7, 'Z');
    regLv('D_A', 1); regLv('D_B', 2);
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar({ uid: 'cc#3', cardId: 'CC3' })];
    s.players.self.deck = ['D_A', 'D_B'];
    const ctx = makeCtx({
      source: { player: 'self', uid: 'cc#3', cardId: 'CC3', area: 'scene' },
      bindings: { chosenChar: [{ kind: 'char', uid: 'cc#3', cardId: 'CC3', player: 'self' }] },
    });
    produce(s, d => {
      runAtom(d, 'deckRevealUntil', {
        player: 'self',
        filter: { levelMin: { dyn: '$bound.chosenChar.level' }, levelMax: { dyn: '$bound.chosenChar.level' }, cardName: { dyn: '$bound.chosenChar.cardName' } },
        bind: 'restRevealed', bindMatch: 'matchedChar',
      }, ctx);
    });
    expect((ctx.bindings['matchedChar'] as unknown[]).length, 'match 0').toBe(0);
    expect((ctx.bindings['restRevealed'] as unknown[]).length, '全2枚が残り').toBe(2);
  });
});
