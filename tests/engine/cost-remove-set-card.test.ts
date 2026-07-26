// engine additive wave (2026-06-24) — Cost `removeSetCard`。
// 宣言コスト〚現場にいるキャラに裏向きでセットされているカードを合わせて N 枚リムーブする〛(B08033 工藤有希子 a2)。
// count-based (TargetingRef 不使用) の self-pool コスト。candidates() は set card を Candidate 列挙しないため
// discardEvidence/removeDeckTop/fileFrom と同型。既存カードは removeSetCard 未使用 → 回帰0 (additive)。
//
// 検証 (B08033 公式 qa と 1対1):
//   §1 canPay=true  — self 全 scene の faceUp:false set card 総数 ≥ n (1キャラ2枚 / 2キャラ1枚ずつ両経路)。
//   §2 canPay=false — face-down set card が n 未満。
//   §3 canPay=false — face-up set card のみ (裏向きでないので数えない、テキスト「裏向きで」)。
//   §4 canPay=false — set card 0 枚。
//   §5 pay (params hostUids=[A,B]) — 各 host から1枚ずつ離場 → remove エリアへ、setCards 減少。
//   §6 pay (fallback, params 無) — scene 順に face-down set card を n 枚リムーブ。
//   §7 pay (2-from-1, hostUids=[A,A]) — 1キャラから2枚リムーブ。
//   §8 pay は face-up set card を残す (face-down のみ対象)。
//   §9 E2E — 自 scene に B07034 (赤魔術事件) + HOST(2枚 face-down)。removeSetCard n=2 で B07034 が2ドロー
//            (「裏向き set card が離れるたび」純 observer、cause:'cost' でも発火、rules/21 の ability/effect gate 無)。
//   §10 pay-nest — removeSetCard が `pay`(複合コスト) 内でも payInner 再帰で動作。
// rules: 16 (set/離場時表向きリムーブ), 21 (コスト「自分の」省略), 15/25 (cost→effect 解決順)
// spec: .claude/specs/engine-additive-removeset-cost-design.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { canPay } from '@/engine/cost/evaluate';
import { canPayAtomically, pay } from '@/engine/cost/pay';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, EffectCtx, Cost } from '@/engine/types';

function phost(id: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
function pcase(id: string, caseTraits: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'case', names: [id], colors: ['白'], traits: [],
    rarity: 'C', imageUrl: '', caseLevel: 7, caseTraits, abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
function setCase(s: GameState, p: 'self' | 'opp', cardId: string, caseTrait: string[] = []): void {
  s.players[p].case = { cardId, status: '事件編', requiredEvidence: 7, colors: ['白'], caseTraits: caseTrait, declaredUseCount: {} } as unknown as GameState['players']['self']['case'];
}

const HOST = 'HOST';
const COST2 = { kind: 'removeSetCard', n: 2 } as unknown as Cost;
const COST1 = { kind: 'removeSetCard', n: 1 } as unknown as Cost;

const ctxBare = (): EffectCtx => ({ source: { cardId: HOST, uid: 'u-x', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx);
const ctxWithParams = (hostUids: string[]): EffectCtx => ({
  source: { cardId: HOST, uid: 'u-x', abilityId: 'a1', player: 'self', area: 'scene' },
  bindings: {},
  dyn: { costParams: { removeSetCard: { hostUids } } },
} as unknown as EffectCtx);
const ctxWithExactParams = (picks: Array<{ hostUid: string; instanceId: string }>): EffectCtx => ({
  source: { cardId: HOST, uid: 'u-x', abilityId: 'a1', player: 'self', area: 'scene' },
  bindings: {},
  dyn: { costParams: { removeSetCard: {
    hostUids: picks.map((pick) => pick.hostUid),
    instanceIds: picks.map((pick) => pick.instanceId),
  } } },
} as unknown as EffectCtx);
const ctxWithRawWitness = (removeSetCard: unknown): EffectCtx => ({
  source: { cardId: HOST, uid: 'u-x', abilityId: 'a1', player: 'self', area: 'scene' },
  bindings: {},
  dyn: { costParams: { removeSetCard } },
} as unknown as EffectCtx);

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  registerCardDef(phost(HOST));
  registerTriggeredListener();
});

/** self 現場に N 個の HOST を置き、faceDown 配列指定で set card を載せる。uid を返す。 */
function sceneWithSets(faceDownPerChar: boolean[][]): { state: GameState; uids: string[] } {
  const uids: string[] = [];
  const state = produce(createEmptyGameState(), (d) => {
    d.turn.player = 'self';
    setCase(d, 'self', 'CS');
    d.players.self.deck = ['D1', 'D2', 'D3', 'D4', 'D5'];
    faceDownPerChar.forEach((sets, i) => {
      const k = mutate.scene.enter(d, 'self', HOST, {});
      uids.push(k.uid);
      sets.forEach((faceDown, j) => mutate.char.setCard(d, k.uid, `SET-${i}-${j}`, !faceDown));
    });
  });
  return { state, uids };
}

describe('removeSetCard §1-4 — canPay gating (self face-down set card 総数 ≥ n)', () => {
  it('§1a 2キャラに1枚ずつ face-down → canPay(n=2)=true', () => {
    const { state } = sceneWithSets([[true], [true]]);
    expect(canPay(state, COST2, ctxBare())).toBe(true);
  });
  it('§1b 1キャラに2枚 face-down → canPay(n=2)=true', () => {
    const { state } = sceneWithSets([[true, true]]);
    expect(canPay(state, COST2, ctxBare())).toBe(true);
  });
  it('§2 face-down 1枚のみ → canPay(n=2)=false', () => {
    const { state } = sceneWithSets([[true]]);
    expect(canPay(state, COST2, ctxBare())).toBe(false);
  });
  it('§3 face-up set card のみ → canPay(n=2)=false (裏向きでないので数えない)', () => {
    const { state } = sceneWithSets([[false, false]]);
    expect(canPay(state, COST2, ctxBare())).toBe(false);
  });
  it('§4 set card 0枚 → canPay(n=1)=false', () => {
    const { state } = sceneWithSets([[]]);
    expect(canPay(state, COST1, ctxBare())).toBe(false);
  });
});

describe('removeSetCard §5-8 — pay', () => {
  it('§5 params hostUids=[A,B] → 各 host から1枚ずつ離場、remove に2枚', () => {
    const { state, uids } = sceneWithSets([[true], [true]]);
    const after = produce(state, (d) => { pay(d, COST2, ctxWithParams([uids[0], uids[1]])); });
    expect(after.players.self.scene.find((c) => c.uid === uids[0])!.setCards.length).toBe(0);
    expect(after.players.self.scene.find((c) => c.uid === uids[1])!.setCards.length).toBe(0);
    expect(after.players.self.remove.filter((id) => id.startsWith('SET-')).length).toBe(2);
  });
  it('§6 fallback (params 無) → scene 順に face-down 2枚リムーブ', () => {
    const { state, uids } = sceneWithSets([[true, true], [true]]);
    const after = produce(state, (d) => { pay(d, COST2, ctxBare()); });
    const remain = uids.map((u) => after.players.self.scene.find((c) => c.uid === u)!.setCards.length);
    expect(remain.reduce((a, b) => a + b, 0)).toBe(1); // 元 3枚 − 2 = 1
    expect(after.players.self.remove.filter((id) => id.startsWith('SET-')).length).toBe(2);
  });
  it('§7 2-from-1 hostUids=[A,A] → 1キャラから2枚', () => {
    const { state, uids } = sceneWithSets([[true, true], [true]]);
    const after = produce(state, (d) => { pay(d, COST2, ctxWithParams([uids[0], uids[0]])); });
    expect(after.players.self.scene.find((c) => c.uid === uids[0])!.setCards.length).toBe(0);
    expect(after.players.self.scene.find((c) => c.uid === uids[1])!.setCards.length).toBe(1); // 触れず
  });
  it('§8 face-up set card は残す (face-down のみ対象)', () => {
    // host A: [face-down, face-up], host B: [face-down]
    const { state, uids } = sceneWithSets([[true, false], [true]]);
    const after = produce(state, (d) => { pay(d, COST2, ctxBare()); });
    const aSets = after.players.self.scene.find((c) => c.uid === uids[0])!.setCards;
    // A の face-down は除去、face-up は残る
    expect(aSets.length).toBe(1);
    expect(aSets[0].faceUp).toBe(true);
    expect(after.players.self.scene.find((c) => c.uid === uids[1])!.setCards.length).toBe(0);
  });
});

describe('removeSetCard §9 — E2E B07034 が cost 離場で発火', () => {
  it('自 scene に B07034(赤魔術事件) + HOST(2枚 face-down) → removeSetCard n=2 で B07034 が2ドロー', () => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetDefRegistry();
    _resetUidCounter();
    registerAll();
    registerCardDef(pcase('AKACASE', ['赤魔術']));
    registerCardDef(phost(HOST));
    registerTriggeredListener();

    const s = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      setCase(d, 'self', 'AKACASE', ['赤魔術']);
      d.players.self.deck = ['D1', 'D2', 'D3', 'D4'];
      mutate.scene.enter(d, 'self', 'B07034', {});
      const h = mutate.scene.enter(d, 'self', HOST, {});
      mutate.char.setCard(d, h.uid, 'SET-A', false);
      mutate.char.setCard(d, h.uid, 'SET-B', false);
    });
    const before = s.players.self.hand.length;
    const hostUid = s.players.self.scene.find((c) => c.cardId === HOST)!.uid;
    const after = produce(s, (d) => {
      pay(d, COST2, ctxWithParams([hostUid, hostUid]));
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length).toBe(before + 2);
  });
});

describe('removeSetCard §10 — pay-nest (`pay` 複合コスト内)', () => {
  it('removeSetCard が pay.items にネストしても payInner 再帰で動作', () => {
    const { state, uids } = sceneWithSets([[true], [true]]);
    const NESTED = { kind: 'pay', items: [COST2] } as unknown as Cost;
    const after = produce(state, (d) => { pay(d, NESTED, ctxWithParams([uids[0], uids[1]])); });
    expect(after.players.self.remove.filter((id) => id.startsWith('SET-')).length).toBe(2);
  });
});

// review concern (test-adequacy) を反映した予防テスト群。実装は検証済で正しいが、将来の
// リグレッション (face-up 計数 / self 固定化 / opp 誤リムーブ) を捕捉する。
describe('removeSetCard §11-13 — review-concern 予防', () => {
  it('§11 mixed pool: 単一キャラに [face-down, face-up] → canPay(n=1)=true / canPay(n=2)=false', () => {
    const { state } = sceneWithSets([[true, false]]); // face-down 1 + face-up 1
    expect(canPay(state, COST1, ctxBare())).toBe(true);
    expect(canPay(state, COST2, ctxBare())).toBe(false); // face-up は数えない
  });

  it('§12 opp-source: ctx.source.player=opp なら opp scene を計数/リムーブ', () => {
    const uids: string[] = [];
    const state = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      const k1 = mutate.scene.enter(d, 'opp', HOST, {});
      const k2 = mutate.scene.enter(d, 'opp', HOST, {});
      uids.push(k1.uid, k2.uid);
      mutate.char.setCard(d, k1.uid, 'SET-O0', false);
      mutate.char.setCard(d, k2.uid, 'SET-O1', false);
    });
    const ctxOpp = { source: { cardId: HOST, uid: 'u-x', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} } as EffectCtx;
    expect(canPay(state, COST2, ctxOpp)).toBe(true); // opp scene を見る (self 固定でない)
    const after = produce(state, (d) => { pay(d, COST2, ctxOpp); });
    expect(after.players.opp.remove.filter((id) => id.startsWith('SET-O')).length).toBe(2);
    expect(after.players.self.remove.length).toBe(0); // self は無関係
  });

  it('§13 self-only guard: explicit に opp uid が混入した witness は atomic に拒否する (rules/21, BUG-245)', () => {
    let oppUid = '';
    const selfUids: string[] = [];
    const state = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      const s1 = mutate.scene.enter(d, 'self', HOST, {});
      const s2 = mutate.scene.enter(d, 'self', HOST, {});
      selfUids.push(s1.uid, s2.uid);
      mutate.char.setCard(d, s1.uid, 'SET-S0', false);
      mutate.char.setCard(d, s2.uid, 'SET-S1', false);
      const o = mutate.scene.enter(d, 'opp', HOST, {});
      oppUid = o.uid;
      mutate.char.setCard(d, o.uid, 'SET-OPP', false);
    });
    // BUG-245 atomic fail-closed: 不正 witness を捨てて fallback すると、ユーザーが選んでいない
    // 自陣カードを不可逆に支払う。rules/21 の「コストをすべて行う」前に宣言全体を拒否する。
    expect(() => produce(state, (d) => { pay(d, COST2, ctxWithParams([selfUids[0], oppUid])); }))
      .toThrow('invalid removeSetCard picks');
    expect(state.players.opp.scene.find((c) => c.uid === oppUid)!.setCards.length).toBe(1);
    expect(state.players.opp.remove.length).toBe(0);
    expect(state.players.self.remove.length).toBe(0);
  });
});

describe('removeSetCard §14-18 — exact physical occurrence witness (BUG-248)', () => {
  it('§14 同一hostの複数裏向きから指定instanceだけを除去する', () => {
    const { state, uids } = sceneWithSets([[true, true]]);
    const host = state.players.self.scene.find((char) => char.uid === uids[0])!;
    const [first, second] = host.setCards;
    const ctx = ctxWithExactParams([{ hostUid: host.uid, instanceId: first!.instanceId! }]);
    const after = produce(state, (draft) => { pay(draft, COST1, ctx); });
    expect(after.players.self.scene[0]!.setCards.map((entry) => entry.instanceId)).toEqual([second!.instanceId]);
    expect(after.players.self.remove).toContain(first!.cardId);
  });

  it.each([
    ['duplicate', (state: GameState) => {
      const host = state.players.self.scene[0]!;
      const id = host.setCards[0]!.instanceId!;
      return { cost: COST2, ctx: ctxWithExactParams([{ hostUid: host.uid, instanceId: id }, { hostUid: host.uid, instanceId: id }]) };
    }],
    ['host-instance mismatch', (state: GameState) => {
      const [a, b] = state.players.self.scene;
      return { cost: COST1, ctx: ctxWithExactParams([{ hostUid: b!.uid, instanceId: a!.setCards[0]!.instanceId! }]) };
    }],
    ['face-up decoy', (state: GameState) => {
      const host = state.players.self.scene[2]!;
      return { cost: COST1, ctx: ctxWithExactParams([{ hostUid: host.uid, instanceId: host.setCards[0]!.instanceId! }]) };
    }],
  ])('§15-17 rejects %s before mutation', (_name, make) => {
    const { state } = sceneWithSets([[true, true], [true], [false]]);
    const before = JSON.stringify(state);
    const { cost, ctx } = make(state);
    expect(canPayAtomically(state, cost, ctx)).toBe(false);
    expect(() => produce(state, (draft) => pay(draft, cost, ctx))).toThrow('invalid removeSetCard picks');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('§18 exact witness cannot cross to opponent host', () => {
    const { state } = sceneWithSets([[true]]);
    let oppUid = '';
    const withOpp = produce(state, (draft) => {
      const opp = mutate.scene.enter(draft, 'opp', HOST, {});
      oppUid = opp.uid;
      mutate.char.setCard(draft, opp.uid, 'OPP-SET', false);
    });
    const oppEntry = withOpp.players.opp.scene[0]!.setCards[0]!;
    const ctx = ctxWithExactParams([{ hostUid: oppUid, instanceId: oppEntry.instanceId! }]);
    expect(canPayAtomically(withOpp, COST1, ctx)).toBe(false);
  });

  it.each([
    ['explicit undefined witness', undefined],
    ['missing host array', { instanceIds: ['set:1'] }],
    ['non-string host', { hostUids: [null], instanceIds: ['set:1'] }],
    ['missing instance array', { hostUids: ['host'], instanceIds: null }],
    ['short instance array', { hostUids: ['host'], instanceIds: [] }],
    ['long instance array', { hostUids: ['host'], instanceIds: ['set:1', 'set:2'] }],
    ['mixed instance array', { hostUids: ['host'], instanceIds: ['set:1', null] }],
    ['non-string instance', { hostUids: ['host'], instanceIds: [42] }],
    ['null witness', null],
  ])('§19 rejects malformed public witness: %s', (_name, raw) => {
    const { state } = sceneWithSets([[true]]);
    const before = JSON.stringify(state);
    const ctx = ctxWithRawWitness(raw);
    expect(canPayAtomically(state, COST1, ctx)).toBe(false);
    expect(() => produce(state, (draft) => pay(draft, COST1, ctx))).toThrow('invalid removeSetCard picks');
    expect(JSON.stringify(state)).toBe(before);
  });

  it('§20 rejects sparse arrays instead of collapsing holes into fallback', () => {
    const { state, uids } = sceneWithSets([[true]]);
    const sparseHosts = Array(2) as unknown[];
    sparseHosts[0] = uids[0];
    const ctx = ctxWithRawWitness({ hostUids: sparseHosts, instanceIds: [state.players.self.scene[0]!.setCards[0]!.instanceId, 'set:extra'] });
    expect(canPayAtomically(state, COST1, ctx)).toBe(false);
    expect(() => produce(state, (draft) => pay(draft, COST1, ctx))).toThrow('invalid removeSetCard picks');
  });

  it('§21 rejects a sparse instanceIds array', () => {
    const { state, uids } = sceneWithSets([[true]]);
    const sparseInstances = Array(1) as unknown[];
    const ctx = ctxWithRawWitness({ hostUids: [uids[0]], instanceIds: sparseInstances });
    expect(canPayAtomically(state, COST1, ctx)).toBe(false);
    expect(() => produce(state, (draft) => pay(draft, COST1, ctx))).toThrow('invalid removeSetCard picks');
  });
});
