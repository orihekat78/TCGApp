// engine 拡張 wave-11 (2026-07-02) — hirameki actor payload ($trigger.byUid「アクション中のキャラ」)
//
// 対象 primitive: evidence:remove-by-action payload に byUid (アクション[事件] actor の snapshot) を
// 併記し、【ヒラメキ】effect 内 '$trigger.byUid' で「アクション中のキャラ」を解決可能にする。
// 公式Q&A (B05111): 「アクション中のキャラ」=「現時点でのアクションを行っているキャラ。【ヒラメキ】に
// おいてはアクション［事件］でこのカードの【ヒラメキ】を発動させたキャラが該当する」= actor 単独。
//
// consumer カード: B03085 / B03085P / B05032 / B05111 (全て a2 =
//   【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる = sceneSetState{$trigger.byUid, stun})
//
// 検証チェーン (公式テキスト ⇔ 実 engine 経路 1対1):
//   (a) removeOpponentEvidenceTop emit が payload に byUid=ax.byUid を載せる (action-case.ts)
//   (b) handleEvidenceRemovedHook (optional 経路) が pendingHirameki.actorUid=payload.byUid を貫通 (triggered.ts)
//   (c) UI hiramekiResolve 複製 (resolveEffectPicks→queue→runAllUntilEmpty) で actor が stun 化 (useEngineDispatch.ts)
//   (d) 【解決編】condition gate: 事件編では pending 自体立たない (rules/17 条件外=持たない扱い)
//   (e) actor 離場 / partner uid → sceneSetState は findChar 不在で silent no-op (rules/15「可能な限り」)
// rules: 03 / 10 / 15 / 17 / 24

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { removeOpponentEvidenceTop } from '@/engine/flow/action-case';
import { registerAll } from '@/cards/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _drainPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B03085 } from '@/cards/ct-p03/B03085';
import { B03085P } from '@/cards/ct-p03/B03085P';
import { B05032 } from '@/cards/ct-p05/B05032';
import { B05111 } from '@/cards/ct-p05/B05111';
import type { GameState, EffectCtx, ActionContext, EvidenceCard } from '@/engine/types';

// 攻撃キャラ (アクション[事件] actor) — 現場に active で置く用の synthetic def
function attackerDef(id = 'ATK') {
  return {
    id, no: `9/${id}`, kind: 'character' as const, names: [id], colors: ['赤'], level: 1,
    ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [],
  };
}

function selfTurn(s: GameState): void {
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}

// UI useEngineDispatch.hiramekiResolve の engine 経路を忠実に複製し actor を stun する
function resolveHiramekiLikeUi(
  s: GameState,
  pending: { player: 'self' | 'opp'; cardId: string; abilityId: string; actorUid?: string },
): GameState {
  return produce(s, draft => {
    const def = registerCardDefLookup(pending.cardId);
    const ability = def.abilities.find(a => a.id === pending.abilityId)!;
    const ctx: EffectCtx = {
      source: { player: pending.player, cardId: pending.cardId, area: 'evidence' },
      bindings: {},
      // wave-11: pick 解決段でも $trigger.<field> を参照可能に (queue payload と同内容)
      triggerPayload: { player: pending.player, ev: { cardId: pending.cardId }, byUid: pending.actorUid },
    } as EffectCtx;
    const aiPolicy = new HeuristicPolicy();
    const resolved = resolveEffectPicks(draft, ability.effect as never, ctx, {
      chooseAtomTarget: aiPolicy.chooseAtomTarget?.bind(aiPolicy),
      byPlayer: pending.player,
    });
    // byUid を queue payload に復元 → atom 実行時 (entryToCtx triggerPayload) に $trigger.byUid が解決
    event.queue(
      draft,
      resolved as never,
      { player: pending.player, cardId: pending.cardId },
      'evidence:remove-by-action',
      { player: pending.player, ev: { cardId: pending.cardId }, byUid: pending.actorUid },
    );
    runAllUntilEmpty(draft);
  });
}

// read.def.card の薄い wrapper (test-local、registerAll 後に有効)
import { def as readDef } from '@/engine/read/def';
function registerCardDefLookup(cardId: string) {
  const d = readDef.card(cardId);
  if (!d) throw new Error(`def not found: ${cardId}`);
  return d;
}

describe('engine wave-11 — hirameki actor payload ($trigger.byUid「アクション中のキャラ」)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    _resetPendingHirameki();
    registerAll();
    registerCardDef(attackerDef());
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // (a) emit が byUid を payload に載せる
  it('(a) removeOpponentEvidenceTop emit が byUid=ax.byUid を payload に併記する', () => {
    const captured: { player?: string; ev?: EvidenceCard; byUid?: string }[] = [];
    event.on('evidence:remove-by-action', (_s, payload) => {
      captured.push(payload as (typeof captured)[number]);
    });
    const base = createEmptyGameState();
    selfTurn(base);
    const s = produce(base, draft => {
      draft.players.opp.evidence.push({ cardId: 'ev-x', faceUp: false, origin: { turn: 0, via: 'opening' } });
    });
    const ax: ActionContext = {
      id: 'ax', byUid: 'partner:self', byPlayer: 'self',
      target: { kind: 'case', player: 'opp' }, phase: 'judge', startedAt: { turn: 0, nano: 0 },
    };
    produce(s, draft => {
      removeOpponentEvidenceTop(draft, ax);
    });
    expect(captured.length).toBe(1);
    expect(captured[0].byUid).toBe('partner:self');
  });

  // (b) optional 経路が pendingHirameki.actorUid を貫通する (解決編)
  it('(b) 解決編で B05111 ヒラメキ発火 → pendingHirameki.actorUid = payload.byUid', () => {
    const base = createEmptyGameState();
    selfTurn(base);
    produce(base, draft => {
      draft.players.opp.case.status = '解決編'; // ヒラメキ所有者=opp (証拠所有者) の事件
      event.emit(
        draft, 'evidence:remove-by-action',
        { player: 'opp', ev: { cardId: 'B05111' }, byUid: 'scene:self:0' },
        { player: 'self', uid: 'scene:self:0' },
      );
    });
    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ pending が立つ').not.toBeNull();
    expect(pending!.cardId).toBe('B05111');
    expect(pending!.abilityId).toBe('a2');
    expect(pending!.actorUid, 'actor uid が貫通').toBe('scene:self:0');
  });

  // (d) 事件編 (条件外) では pending が立たない
  it('(d) 事件編では B05111 ヒラメキ pending が立たない (【解決編】condition gate)', () => {
    const base = createEmptyGameState();
    selfTurn(base);
    produce(base, draft => {
      // opp.case.status はデフォルト '事件編'
      event.emit(
        draft, 'evidence:remove-by-action',
        { player: 'opp', ev: { cardId: 'B05111' }, byUid: 'scene:self:0' },
        { player: 'self', uid: 'scene:self:0' },
      );
    });
    expect(_drainPendingHirameki()).toMatchObject({ effectValid: false });
  });

  // (c) end-to-end: 実カード effect で actor が stun 化する
  it('(c) B05111 a2: アクション中のキャラ (actor) が stun 化する', () => {
    const base = createEmptyGameState();
    selfTurn(base);
    let atkUid = '';
    const s = produce(base, draft => {
      atkUid = mutate.scene.enter(draft, 'self', 'ATK', { active: true }).uid;
      draft.players.opp.case.status = '解決編';
      // アクション[事件] で opp の証拠 (B05111) を落とし、ヒラメキを起こす想定の event
      event.emit(
        draft, 'evidence:remove-by-action',
        { player: 'opp', ev: { cardId: 'B05111' }, byUid: atkUid },
        { player: 'self', uid: atkUid },
      );
    });
    const pending = _drainPendingHirameki();
    expect(pending).not.toBeNull();
    expect(pending!.actorUid).toBe(atkUid);

    const out = resolveHiramekiLikeUi(s, pending!);
    const atk = out.players.self.scene.find(c => c.uid === atkUid);
    expect(atk, 'actor が現場に残っている').toBeDefined();
    expect(atk!.state, 'actor が stun 化').toBe('stun');
  });

  // (e) actor が既に現場を離れている → silent no-op (crash しない)
  it('(e) actor 離場後の解決は silent no-op (rules/15「可能な限り行う」)', () => {
    const base = createEmptyGameState();
    selfTurn(base);
    let atkUid = '';
    const s = produce(base, draft => {
      atkUid = mutate.scene.enter(draft, 'self', 'ATK', { active: true }).uid;
      draft.players.opp.case.status = '解決編';
      // actor を先にリムーブしてから解決 (アクション[事件] 中に離場した想定)
      mutate.scene.removeToRemove(draft, atkUid, 'effect');
    });
    const pending = { player: 'opp' as const, cardId: 'B05111', abilityId: 'a2', actorUid: atkUid };
    // crash せず解決が通ること
    expect(() => resolveHiramekiLikeUi(s, pending)).not.toThrow();
    const out = resolveHiramekiLikeUi(s, pending);
    expect(out.players.self.scene.find(c => c.uid === atkUid)).toBeUndefined();
  });

  // (e2) partner uid actor → 「キャラ」でないため no-op
  it('(e2) actor が partner uid のとき stun は no-op (パートナーは「キャラ」でない)', () => {
    const base = createEmptyGameState();
    selfTurn(base);
    const s = produce(base, draft => {
      draft.players.opp.case.status = '解決編';
    });
    const pending = { player: 'opp' as const, cardId: 'B05111', abilityId: 'a2', actorUid: 'partner:self' };
    expect(() => resolveHiramekiLikeUi(s, pending)).not.toThrow();
  });

  // descriptor: 4 枚全て同一 a2 pattern
  it('descriptor: B03085/B03085P/B05032/B05111 の a2 = evidence:remove-by-action optional + sceneSetState $trigger.byUid stun', () => {
    for (const card of [B03085, B03085P, B05032, B05111]) {
      const a2 = card.abilities.find(a => a.id === 'a2')!;
      expect(a2.type).toBe('triggered');
      expect(a2.trigger?.hook).toBe('evidence:remove-by-action');
      expect(a2.trigger?.optional).toBe(true);
      expect(a2.condition).toEqual({ kind: 'caseStatus', status: '解決編' });
      expect(a2.effect).toEqual({ kind: 'atom', verb: 'sceneSetState', args: { uid: '$trigger.byUid', state: 'stun' } });
    }
  });
});
