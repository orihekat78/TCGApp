// CARD PHASE hybrid-batch2 probe — B06028 風魔の小太郎 (engine変更0)
//
// 公式テキスト (hirameki):
//   【ヒラメキ】【事件YAIBA】【解決編】アクション中のキャラを1枚まで選び、リムーブする。
//   （アクション［事件］による証拠の獲得までは進める）
//
// novel 句 (compiler refuse 行) = ヒラメキ effect で「アクション中のキャラ」= actor を
// sceneRemove する + 発動 gate が AND[caseTrait YAIBA, caseStatus 解決編]。
// これは wave-11 (B05111 等 = sceneSetState stun) の removal 版 + trait 半条件を足したもの。
//
// 検証チェーン (印字 ⇔ 実 engine 経路 1対1):
//   (a) descriptor: a1 = evidence:remove-by-action optional + AND[caseTrait YAIBA,解決編] + sceneRemove $trigger.byUid
//   (b) production emit: removeOpponentEvidenceTop (flow/action-case.ts:38) が payload byUid を載せ
//       handleEvidenceRemovedHook (triggered.ts:548) が AND gate を通し pendingHirameki.actorUid 貫通
//   (c) end-to-end: UI hiramekiResolve 複製 (resolveEffectPicks→queue→runAllUntilEmpty) で actor が
//       リムーブされる。actor は **相手側 (opp) 現場** = owner='opp' 対象 pin (BUG-174)。
//       filter 外 decoy (別 opp キャラ / 自陣キャラ) は残存 (BUG-117/118)。
//   (d) negative: 事件編 (YAIBA あり) → pending 立たず (caseStatus gate)
//   (e) negative: YAIBA なし (解決編) → pending 立たず (caseTrait gate、B05111 に無い novel 半条件)
//   (f) actor 離場後の解決 → silent no-op (rules/15「可能な限り」), 盤面不変
// rules: 10 / 15 / 17 / 24

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { removeOpponentEvidenceTop } from '@/engine/flow/action-case';
import { register as registerCardDef, _resetRegistry as resetDefRegistry, def as readDef } from '@/engine/read/def';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _drainPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B06028 } from '@/cards/ct-p06/B06028';
import type { GameState, EffectCtx, ActionContext, CardDef } from '@/engine/types';

// 事件 def (caseTrait 判定は CardDef.caseTraits を参照 — cond/eval.ts:106)
function pcase(id: string, caseTraits: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'case', names: [id], colors: ['緑'], traits: [],
    rarity: 'C', imageUrl: '', caseLevel: 6, caseTraits, abilities: [], ruleRefs: [],
  };
}
// 現場キャラ def (attacker / decoy)
function chDef(id: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'], level: 1,
    ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const CASE_YAIBA = pcase('CASE_YAIBA', ['YAIBA']);
const CASE_PLAIN = pcase('CASE_PLAIN', []); // YAIBA なし decoy 事件

function selfTurn(s: GameState): void {
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

// hirameki 所有者 = 証拠所有者 = self。事件 (YAIBA/解決編) を self に配置。
// attacker (アクション[事件] actor) = opp 現場のキャラ (= $trigger.byUid、リムーブ対象)。
function board(opts: { caseId: string; status: '事件編' | '解決編'; withDecoys?: boolean }): {
  state: GameState; atkUid: string; oDecoyUid: string; sDecoyUid: string;
} {
  const base = createEmptyGameState();
  selfTurn(base);
  let atkUid = '', oDecoyUid = '', sDecoyUid = '';
  const state = produce(base, draft => {
    draft.players.self.case.cardId = opts.caseId;
    draft.players.self.case.status = opts.status;
    // self の証拠最上部 = B06028 (アクション[事件] でリムーブされヒラメキが起きる証拠)
    draft.players.self.evidence.push({ cardId: 'B06028', faceUp: false, origin: { turn: 0, via: 'opening' } });
    // attacker は opp 現場 (相手側 = owner='opp' 対象、BUG-174)
    atkUid = mutate.scene.enter(draft, 'opp', 'ATK', { active: true }).uid;
    if (opts.withDecoys) {
      oDecoyUid = mutate.scene.enter(draft, 'opp', 'ODECOY', { active: true }).uid; // 別 opp キャラ (actor でない)
      sDecoyUid = mutate.scene.enter(draft, 'self', 'SDECOY', { active: true }).uid; // 自陣キャラ
    }
  });
  return { state, atkUid, oDecoyUid, sDecoyUid };
}

// 実 production 経路で emit を発火: removeOpponentEvidenceTop (action-case flow)。
// ax.target.player = 証拠所有者 (self) / ax.byPlayer = attacker 側 (opp) / ax.byUid = actor uid。
function driveActionCase(s: GameState, atkUid: string) {
  return produce(s, draft => {
    const ax: ActionContext = {
      id: 'ax', byUid: atkUid, byPlayer: 'opp',
      target: { kind: 'case', player: 'self' }, phase: 'judge', startedAt: { turn: 0, nano: 0 },
    };
    removeOpponentEvidenceTop(draft, ax);
  });
}

// UI useEngineDispatch.hiramekiResolve の engine 経路を忠実に複製 (wave-11 と同型)。
// pending の effect を解決し queue → runAllUntilEmpty で actor を sceneRemove。
function resolveHiramekiLikeUi(
  s: GameState,
  pending: { player: 'self' | 'opp'; cardId: string; abilityId: string; actorUid?: string },
): GameState {
  return produce(s, draft => {
    const def = readDef.card(pending.cardId);
    if (!def) throw new Error(`def not found: ${pending.cardId}`);
    const ability = def.abilities.find(a => a.id === pending.abilityId)!;
    const ctx: EffectCtx = {
      source: { player: pending.player, cardId: pending.cardId, area: 'evidence' },
      bindings: {},
      triggerPayload: { player: pending.player, ev: { cardId: pending.cardId }, byUid: pending.actorUid },
    } as EffectCtx;
    const aiPolicy = new HeuristicPolicy();
    const resolved = resolveEffectPicks(draft, ability.effect as never, ctx, {
      chooseAtomTarget: aiPolicy.chooseAtomTarget?.bind(aiPolicy),
      byPlayer: pending.player,
    });
    event.queue(
      draft,
      resolved as never,
      { player: pending.player, cardId: pending.cardId, area: 'evidence' },
      'evidence:remove-by-action',
      { player: pending.player, ev: { cardId: pending.cardId }, byUid: pending.actorUid },
    );
    runAllUntilEmpty(draft);
  });
}

describe('B06028 風魔の小太郎 — 【ヒラメキ】【事件YAIBA】【解決編】アクション中のキャラをリムーブ', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    _resetPendingHirameki();
    for (const d of [B06028, CASE_YAIBA, CASE_PLAIN, chDef('ATK'), chDef('ODECOY'), chDef('SDECOY')]) {
      registerCardDef(d);
    }
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // (a) descriptor — DSL が印字と 1対1
  it('(a) descriptor: a1 = evidence:remove-by-action optional + AND[caseTrait YAIBA, 解決編] + sceneRemove $trigger.byUid', () => {
    const a1 = B06028.abilities.find(a => a.id === 'a1')!;
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-evidence');
    expect(a1.trigger?.hook).toBe('evidence:remove-by-action');
    expect(a1.trigger?.optional).toBe(true);
    expect(a1.condition).toEqual({
      kind: 'and',
      cs: [{ kind: 'caseTrait', trait: 'YAIBA' }, { kind: 'caseStatus', status: '解決編' }],
    });
    expect(a1.effect).toEqual({ kind: 'atom', verb: 'sceneRemove', args: { uid: '$trigger.byUid', cause: 'effect' } });
  });

  // (b) production emit → pending 立ち actorUid 貫通 (YAIBA + 解決編)
  it('(b) YAIBA+解決編: removeOpponentEvidenceTop で pending 立ち actorUid = attacker uid', () => {
    const { state, atkUid } = board({ caseId: 'CASE_YAIBA', status: '解決編' });
    driveActionCase(state, atkUid);
    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ pending が立つ').not.toBeNull();
    expect(pending!.cardId).toBe('B06028');
    expect(pending!.abilityId).toBe('a1');
    expect(pending!.actorUid, 'アクション中のキャラ (actor) uid が貫通').toBe(atkUid);
  });

  // (c) end-to-end: actor (相手側現場) がリムーブされる + decoy 残存 (BUG-174 / BUG-117・118)
  it('(c) 解決 → 相手側 actor がリムーブ / 別 opp キャラ・自陣キャラ decoy は残存', () => {
    const { state, atkUid, oDecoyUid, sDecoyUid } = board({ caseId: 'CASE_YAIBA', status: '解決編', withDecoys: true });
    const s1 = driveActionCase(state, atkUid);
    const pending = _drainPendingHirameki();
    expect(pending).not.toBeNull();
    const out = resolveHiramekiLikeUi(s1, pending!);
    expect(out.players.opp.scene.some(c => c.uid === atkUid), 'actor (opp 側) がリムーブされた').toBe(false);
    expect(out.players.opp.scene.some(c => c.uid === oDecoyUid), 'actor でない別 opp キャラは残る').toBe(true);
    expect(out.players.self.scene.some(c => c.uid === sDecoyUid), '自陣キャラは残る').toBe(true);
    expect(out.players.opp.remove.includes('ATK'), 'actor は opp リムーブエリアへ').toBe(true);
  });

  // (d) negative: 事件編 (YAIBA あり) → pending 立たず (caseStatus gate)
  it('(d) 事件編 (YAIBA あり) → pending 立たず = リムーブ発生しない', () => {
    const { state, atkUid } = board({ caseId: 'CASE_YAIBA', status: '事件編' });
    driveActionCase(state, atkUid);
    expect(_drainPendingHirameki(), '解決編でないので発火しない').toBeNull();
  });

  // (e) negative: YAIBA なし (解決編) → pending 立たず (caseTrait gate、novel 半条件)
  it('(e) YAIBA なし事件 (解決編) → pending 立たず = caseTrait gate', () => {
    const { state, atkUid } = board({ caseId: 'CASE_PLAIN', status: '解決編' });
    driveActionCase(state, atkUid);
    expect(_drainPendingHirameki(), '事件が YAIBA を持たないので発火しない').toBeNull();
  });

  // (f) actor が既に離場 → 解決は silent no-op (rules/15「可能な限り」)
  it('(f) actor 離場後の解決 → crash せず盤面不変 (自陣 decoy 残存)', () => {
    const { state, atkUid, sDecoyUid } = board({ caseId: 'CASE_YAIBA', status: '解決編', withDecoys: true });
    const s1 = driveActionCase(state, atkUid);
    const pending = _drainPendingHirameki();
    expect(pending).not.toBeNull();
    // actor を先に現場から除去してから解決
    const s2 = produce(s1, draft => { mutate.scene.removeToRemove(draft, atkUid, 'effect'); });
    let out!: GameState;
    expect(() => { out = resolveHiramekiLikeUi(s2, pending!); }).not.toThrow();
    expect(out.players.self.scene.some(c => c.uid === sDecoyUid), '自陣 decoy は無傷').toBe(true);
  });
});
