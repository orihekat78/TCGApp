// engine additive wave-7 (2026-07-02, P17) — actedCharThisTurn TargetFilter 軸の挙動テスト。
//
// 「このターン中にアクション[キャラ]した自軍キャラ」を per-char で記録し、TargetFilter で参照する。
// B08049 ジョディ・スターリング【宣言】【ターン1】【スリープ】:
//   「自分の現場にいる、このターン中にアクション[キャラ]していた〚特徴[FBI]〛のキャラを1枚まで選び、
//    アクティブにする。」
//
// 3 部品:
//   #1 記録: flow/action/state-machine.declare が action:declare を target.kind==='char' で発火した際、
//      actor (byUid) の turnEffects['actedCharThisTurn'] を true にする。アクション[事件] (target.kind==='case')
//      では立てない (rules/22: アクション宣言時=ガード判定前に確定、ガード有無に依らず「アクションした」)。
//   #2 参照: TargetFilter.actedCharThisTurn === true が matchOneFilter で board char (c 有) の flag を honor。
//      c===null (deck/remove の印字 candidate) は必ず不一致。
//   #3 清掃: clearTurnEffects('turn') (ターン終了) が flag を削除。'action'/'contact' scope では残す
//      (同一ターン内、アクション終了後の【宣言】が読めるように)。
//
// 既存カードは actedCharThisTurn を宣言/使用しない ⇒ 挙動不変 (smoke baseline 不変)。専用テスト必須。
// rules: 07(アクション=スリープ化), 22(アクション宣言=ガード前に確定), 17(【ターン①】), 15(「〜まで」=0可)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { candidates } from '@/engine/target/candidates';
import { evalCond } from '@/engine/cond/eval';
import { cost as engineCost } from '@/engine/cost/index';
import { mutate } from '@/engine/mutate/index';
import { declare as declareAction, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createMainGameState as createEmptyGameState } from '../helpers/main-game-state';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { makeCtx } from '../helpers/fixtures';
import { B08049 } from '@/cards/ct-p08/B08049';
import type { CardDef, GameState, AbilityDef, Condition } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'], level: 4, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

const ctxSelf = makeCtx({ source: { player: 'self', area: 'scene', uid: 'probe' } });
function candUids(s: GameState, query: Record<string, unknown>): string[] {
  return candidates(s, { kind: 'all', query } as never, ctxSelf)
    .filter(c => c.kind === 'char')
    .map(c => (c as { uid: string }).uid)
    .sort();
}

beforeEach(() => {
  event._resetRegistry();
  _resetActionContexts();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(ch('FBI', { traits: ['FBI'] }));
  registerCardDef(ch('COP', { traits: ['警察'] }));
});

// ============================================================
// #2 参照: TargetFilter.actedCharThisTurn honor (matchOneFilter/candidates)
// ============================================================
describe('wave7 #2 actedCharThisTurn filter honor', () => {
  function withActedFlags(): GameState {
    return produce(createEmptyGameState(), (d) => {
      const a = mutate.scene.enter(d, 'self', 'FBI', {}); // acted
      const b = mutate.scene.enter(d, 'self', 'FBI', {}); // not acted (decoy)
      d.players.self.scene.find(c => c.uid === a.uid)!.turnEffects['actedCharThisTurn'] = true;
      void b;
    });
  }

  it('actedCharThisTurn:true → acted した board char のみ候補 (未アクションは除外)', () => {
    const s = withActedFlags();
    const acted = s.players.self.scene[0].uid;
    expect(candUids(s, { side: 'self', filter: { trait: ['FBI'], actedCharThisTurn: true } })).toEqual([acted]);
  });

  it('actedCharThisTurn 未指定 → gate なし (両方候補、回帰0)', () => {
    const s = withActedFlags();
    expect(candUids(s, { side: 'self', filter: { trait: ['FBI'] } }).length).toBe(2);
  });

  it('c===null (deck の同 cardId) は「アクションした」概念無 → 不一致', () => {
    const s = produce(withActedFlags(), (d) => { d.players.self.deck.push('FBI'); });
    const deckHits = candidates(s, { kind: 'all', query: { side: 'self', area: 'deck', filter: { actedCharThisTurn: true } } } as never, ctxSelf);
    expect(deckHits).toHaveLength(0);
  });

  it('trait mismatch は actedCharThisTurn:true でも除外 (AND 合成)', () => {
    const s = produce(withActedFlags(), (d) => {
      const c = mutate.scene.enter(d, 'self', 'COP', {}); // acted だが FBI でない
      d.players.self.scene.find(x => x.uid === c.uid)!.turnEffects['actedCharThisTurn'] = true;
    });
    const acted = s.players.self.scene[0].uid;
    expect(candUids(s, { side: 'self', filter: { trait: ['FBI'], actedCharThisTurn: true } })).toEqual([acted]);
  });
});

// ============================================================
// #1 記録: action.declare が actor へ flag を立てる (char のみ / event は立てない)
// ============================================================
describe('wave7 #1 action:declare records acted flag', () => {
  /** self=actor(active,not-named), opp=target(sleep)。canActionAgainstChar が通る最小構成。 */
  function board(): { s: GameState; actor: string; tgt: string } {
    let actor = '', tgt = '';
    const s = produce(createEmptyGameState(), (d) => {
      d.turn = { ...d.turn, player: 'self' };
      actor = mutate.scene.enter(d, 'self', 'FBI', {}).uid;
      tgt = mutate.scene.enter(d, 'opp', 'COP', {}).uid;
      const ac = d.players.self.scene.find(c => c.uid === actor)!;
      ac.state = 'active'; ac.isNamed = false;
      d.players.opp.scene.find(c => c.uid === tgt)!.state = 'sleep';
    });
    return { s, actor, tgt };
  }

  it('アクション[キャラ] → actor の actedCharThisTurn=true', () => {
    const { s, actor, tgt } = board();
    const after = produce(s, (d) => { declareAction(d, actor, { kind: 'char', uid: tgt, player: 'opp' }); });
    expect(after.players.self.scene.find(c => c.uid === actor)!.turnEffects['actedCharThisTurn']).toBe(true);
  });

  it('decoy: 対象 (opp キャラ) には flag が付かない (actor のみ)', () => {
    const { s, actor, tgt } = board();
    const after = produce(s, (d) => { declareAction(d, actor, { kind: 'char', uid: tgt, player: 'opp' }); });
    expect(after.players.opp.scene.find(c => c.uid === tgt)!.turnEffects['actedCharThisTurn']).toBeUndefined();
  });

  it('アクション[事件] → actor に flag を立てない (target.kind==="case")', () => {
    let actor = '';
    const base = produce(createEmptyGameState(), (d) => {
      d.turn = { ...d.turn, player: 'self' };
      actor = mutate.scene.enter(d, 'self', 'FBI', {}).uid;
      const ac = d.players.self.scene.find(c => c.uid === actor)!;
      ac.state = 'active'; ac.isNamed = false;
      d.players.opp.evidence = [{ cardId: 'E0', faceUp: false, origin: { turn: 0, via: 'effect' } }]; // 事件に証拠 (canActionAgainstCase 通す)
    });
    const after = produce(base, (d) => { declareAction(d, actor, { kind: 'case', player: 'opp' }); });
    expect(after.players.self.scene.find(c => c.uid === actor)!.turnEffects['actedCharThisTurn']).toBeUndefined();
  });
});

// ============================================================
// #3 清掃: clearTurnEffects('turn') が削除 / 'action' は残す
// ============================================================
describe('wave7 #3 actedCharThisTurn reset scope', () => {
  function withFlag(): { s: GameState; uid: string } {
    let uid = '';
    const s = produce(createEmptyGameState(), (d) => {
      uid = mutate.scene.enter(d, 'self', 'FBI', {}).uid;
      d.players.self.scene.find(c => c.uid === uid)!.turnEffects['actedCharThisTurn'] = true;
    });
    return { s, uid };
  }

  it("clearTurnEffects('turn') で削除 (ターン終了で失効)", () => {
    const { s, uid } = withFlag();
    const after = produce(s, (d) => { mutate.char.clearTurnEffects(d, uid, 'turn'); });
    expect(after.players.self.scene.find(c => c.uid === uid)!.turnEffects['actedCharThisTurn']).toBeUndefined();
  });

  it("clearTurnEffects('action') では残す (同ターン内アクション終了後の【宣言】が読めるように)", () => {
    const { s, uid } = withFlag();
    const after = produce(s, (d) => { mutate.char.clearTurnEffects(d, uid, 'action'); });
    expect(after.players.self.scene.find(c => c.uid === uid)!.turnEffects['actedCharThisTurn']).toBe(true);
  });
});

// ============================================================
// #4 exemplar B08049 ジョディ・スターリング — DSL ⇔ 挙動 (card-addition-checklist §7 vitest)
// ============================================================
describe('wave7 #4 B08049 ジョディ exemplar', () => {
  const a1 = B08049.abilities[0] as AbilityDef;
  const a2 = B08049.abilities[1] as AbilityDef;
  const a2Filter = (a2.effect as { args: { filter: Record<string, unknown> } }).args.filter;

  beforeEach(() => { registerCardDef(B08049); });

  it('a2 効果 filter = {trait:FBI, actedCharThisTurn:true} (印字テキスト 1対1)', () => {
    expect(a2Filter).toEqual({ trait: 'FBI', actedCharThisTurn: true });
  });

  it('a2 候補: 今ターン アクション[キャラ]した FBI のみ (未アクション FBI / acted 非FBI は除外)', () => {
    const s = produce(createEmptyGameState(), (d) => {
      const jodie = mutate.scene.enter(d, 'self', 'B08049', {}).uid; // acted FBI
      mutate.scene.enter(d, 'self', 'FBI', {});                       // not-acted FBI (decoy)
      const cop = mutate.scene.enter(d, 'self', 'COP', {}).uid;       // acted 非FBI (decoy)
      d.players.self.scene.find(c => c.uid === jodie)!.turnEffects['actedCharThisTurn'] = true;
      d.players.self.scene.find(c => c.uid === cop)!.turnEffects['actedCharThisTurn'] = true;
    });
    const jodie = s.players.self.scene[0].uid;
    expect(candUids(s, { side: 'self', filter: a2Filter })).toEqual([jodie]);
  });

  it('a1 条件: 自分の現場 FBI 4枚で成立 / 3枚で不成立 (自身も数える、公式Q&A)', () => {
    const if4 = (a1.effect as { if: Condition }).if;
    const s4 = produce(createEmptyGameState(), (d) => { for (let i = 0; i < 4; i++) mutate.scene.enter(d, 'self', 'FBI', {}); });
    const s3 = produce(createEmptyGameState(), (d) => { for (let i = 0; i < 3; i++) mutate.scene.enter(d, 'self', 'FBI', {}); });
    expect(evalCond(s4, if4, makeCtx({ source: { player: 'self', area: 'scene', uid: s4.players.self.scene[0].uid } }))).toBe(true);
    expect(evalCond(s3, if4, makeCtx({ source: { player: 'self', area: 'scene', uid: s3.players.self.scene[0].uid } }))).toBe(false);
  });

  it('filter.actedCharThisTurn:false → 今ターン未アクションの char のみ (hasSetCards と同 boolean 軸)', () => {
    const s = produce(createEmptyGameState(), (d) => {
      const acted = mutate.scene.enter(d, 'self', 'FBI', {}).uid;
      mutate.scene.enter(d, 'self', 'FBI', {}); // idle
      d.players.self.scene.find(c => c.uid === acted)!.turnEffects['actedCharThisTurn'] = true;
    });
    const idle = s.players.self.scene[1].uid;
    expect(candUids(s, { side: 'self', filter: { trait: 'FBI', actedCharThisTurn: false } })).toEqual([idle]);
  });
});

// ============================================================
// #5 exemplar B08049 a2 — declared-ability e2e dispatch (edge-test lens nit)
//    activateDeclaredAbility の cost gate + sceneSetState 解決 → 実際に active 化まで通す。
// ============================================================
describe('wave7 #5 B08049 a2 declared dispatch (cost gate + pick 候補)', () => {
  const a2 = B08049.abilities[1] as AbilityDef;
  const a2Args = (a2.effect as { args: { side?: string; filter: Record<string, unknown> } }).args;
  /** ジョディ(active) + acted FBI(sleep) + idle FBI(sleep,decoy) + acted 非FBI(sleep,decoy)。 */
  function board(): { s: GameState; jodie: string; fbiActed: string; fbiIdle: string; copActed: string } {
    let jodie = '', fbiActed = '', fbiIdle = '', copActed = '';
    const s = produce(createEmptyGameState(), (d) => {
      d.turn = { ...d.turn, player: 'self' };
      jodie = mutate.scene.enter(d, 'self', 'B08049', {}).uid;
      fbiActed = mutate.scene.enter(d, 'self', 'FBI', {}).uid;
      fbiIdle = mutate.scene.enter(d, 'self', 'FBI', {}).uid;
      copActed = mutate.scene.enter(d, 'self', 'COP', {}).uid;
      const g = (u: string) => d.players.self.scene.find(c => c.uid === u)!;
      g(jodie).state = 'active'; g(jodie).isNamed = false;
      g(fbiActed).state = 'sleep'; g(fbiActed).turnEffects['actedCharThisTurn'] = true;
      g(fbiIdle).state = 'sleep';
      g(copActed).state = 'sleep'; g(copActed).turnEffects['actedCharThisTurn'] = true;
    });
    return { s, jodie, fbiActed, fbiIdle, copActed };
  }
  beforeEach(() => { registerCardDef(B08049); });

  it('a2 pick 候補 (production candidates()、side+filter = 印字 1対1): acted FBI のみ', () => {
    // 実際の declared-ability pick が列挙する候補 = candidates(a2 の side+filter query)。
    // 多 decoy 盤面で「アクティブにする」対象が今ターン アクション[キャラ]した FBI のみに絞られる (画面処理=文言)。
    const { s, fbiActed } = board();
    const uids = candidates(s, { kind: 'all', query: { side: a2Args.side ?? 'self', filter: a2Args.filter } } as never, ctxSelf)
      .filter(c => c.kind === 'char').map(c => (c as { uid: string }).uid);
    expect(uids).toEqual([fbiActed]);
  });

  it('a2 cost gate: sleepSelf は ジョディ active 時のみ支払い可 (rules/21、cost.canPay)', () => {
    const { s, jodie } = board();
    const ctx = (state: GameState) => makeCtx({ source: { player: 'self', area: 'scene', cardId: 'B08049', uid: jodie, abilityId: 'a2' } });
    expect(engineCost.canPay(s, a2.cost as never, ctx(s))).toBe(true);
    const slept = produce(s, (d) => { d.players.self.scene.find(c => c.uid === jodie)!.state = 'sleep'; });
    expect(engineCost.canPay(slept, a2.cost as never, ctx(slept))).toBe(false); // sleep = sleepSelf 支払い不可
  });
});
