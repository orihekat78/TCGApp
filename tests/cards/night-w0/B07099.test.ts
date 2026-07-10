// tests/cards/night-w0/B07099 板倉卓 — DEFER解禁 probe (self-remove observer + evidence-flip-down, engine変更0)
//
// カードテキスト:
//   a1 【パートナー黒】【自分ターン中】自分の現場にいるこのキャラが自分の能力や効果によってリムーブされたとき、
//       表向きの証拠を1つまで選び、裏向きにする。
//   a2 【ヒラメキ】（証拠からリムーブされるときに発動する）表向きの証拠を1つまで選び、裏向きにする。
//
// 検証:
//   ① a1 trigger gating — removedCharMatches{cause:'effect', byPlayer:'self'} + and[partnerColor黒, turn self]。
//      production dispatch 2経路 (BUG-171): (a) mutate.scene.removeToRemove 直 emit / (b) runAtom('sceneRemove') 実 atom。
//      decoy: byPlayer:'opp' 過剰発火 / byPlayer 未設定 legacy fail-closed / cause:'switch' 二重遮断 (rules/13 Q&A) /
//             【パートナー黒】不成立 / 【自分ターン中】不成立 / owner='opp' 逆側 pin (BUG-174)。
//   ② a1/a2 effect semantics — evidenceFlipDown 短縮形 self-scope を runAtom で決定論検証。
//      自分の表向き証拠のみ裏向き化 / 相手の表向き証拠 decoy 不変 (self-scope) / 既裏向き decoy 不変 / 0枚(「〜まで」) no-op /
//      順番不変。短縮形 {max:1,faceUp:true} が pick を enqueue すること。
//   ③ descriptor 全列転写 pin (a1 trigger/matcherCondition/effect, a2 hirameki, card fields)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { runAtom } from '@/engine/effect/atom-handlers';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _peekPendingEffectPickQueueLength, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { B07099 } from '@/cards/ct-p07/B07099';
import type { GameState, CardDef, Player, EffectCtx, AbilityDef, EvidenceCard } from '@/engine/types';

function defOf(o: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: o.id, no: o.id, kind: 'character', names: o.names ?? [o.id], colors: o.colors ?? ['黒'],
    level: o.level ?? 1, ap: o.ap ?? 1000, lp: o.lp ?? 1, traits: o.traits ?? [],
    rarity: 'C', imageUrl: '', abilities: o.abilities ?? [], ruleRefs: [], ...o,
  };
}
function ev(cardId: string, faceUp = false): EvidenceCard {
  return { cardId, faceUp, origin: { turn: 1, via: 'opening' } };
}
function ctxOf(player: Player, uid: string, cardId: string): EffectCtx {
  return { source: { player, uid, cardId, area: 'scene' }, bindings: {} } as unknown as EffectCtx;
}
// leave:to-remove の triggered effect が source.uid=observer で queue されたか
function fired(after: GameState, observerUid: string): boolean {
  return after.pendingEffects.some(
    (pe) => pe.triggeredBy?.hook === 'leave:to-remove' && pe.source?.uid === observerUid,
  );
}
const queueLen = () => _peekPendingEffectPickQueueLength();

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _resetRegistry();
  registerCardDef(B07099);
  registerCardDef(defOf({ id: 'PARTNER_K', names: ['ジン'], colors: ['黒'] })); // 黒パートナー
  registerCardDef(defOf({ id: 'PARTNER_G', names: ['佐藤'], colors: ['緑'] })); // 非黒パートナー (decoy)
  registerCardDef(defOf({ id: 'CAUSER', names: ['ベルモット'], colors: ['黒'] })); // 除去を起こす別の自分カード
  registerTriggeredListener();
  _clearPendingEffectPickQueue();
});

// ============================================================
// ① a1 trigger gating (production dispatch 2経路 + decoys)
// ============================================================
describe('B07099 a1 — removedCharMatches{cause:effect, byPlayer:self} + 【パートナー黒】【自分ターン中】', () => {
  function board(mut: (d: GameState) => void): GameState {
    return produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      d.players.self.partner.cardId = 'PARTNER_K'; // 【パートナー黒】成立
      mut(d);
    });
  }

  it('byPlayer:self (自分の効果で除去) → 発火 [直 emit]', () => {
    let obs = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', 'B07099', {}).uid;
      mutate.scene.removeToRemove(d, obs, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(fired(after, obs)).toBe(true);
  });

  it('byPlayer:self [runAtom sceneRemove 実 atom = ctx.source.player 由来] → 発火', () => {
    let obs = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', 'B07099', {}).uid;
      const src = mutate.scene.enter(d, 'self', 'CAUSER', {}).uid; // 除去を起こす別の自分カード
      runAtom(d, 'sceneRemove', { uid: obs, cause: 'effect' }, ctxOf('self', src, 'CAUSER'));
    });
    expect(fired(after, obs)).toBe(true);
  });

  it('byPlayer:opp (相手が自分キャラを効果で除去) → 非発火 [過剰発火 pin]', () => {
    let obs = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', 'B07099', {}).uid;
      mutate.scene.removeToRemove(d, obs, 'effect', undefined, { byPlayer: 'opp' });
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('byPlayer 未設定 (legacy caller) → 非発火 [fail-closed pin]', () => {
    let obs = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', 'B07099', {}).uid;
      mutate.scene.removeToRemove(d, obs, 'effect', undefined);
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('cause:switch (byPlayer:self でも) → 非発火 [rules/13 Q&A cause 二重遮断]', () => {
    let obs = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', 'B07099', {}).uid;
      mutate.scene.removeToRemove(d, obs, 'switch', undefined, { byPlayer: 'self' });
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('【パートナー黒】不成立 (緑パートナー) → 非発火 [condition gate]', () => {
    let obs = '';
    const after = board((d) => {
      d.players.self.partner.cardId = 'PARTNER_G';
      obs = mutate.scene.enter(d, 'self', 'B07099', {}).uid;
      mutate.scene.removeToRemove(d, obs, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('相手ターン中 (turn:opp) → 非発火 [【自分ターン中】gate]', () => {
    let obs = '';
    const after = board((d) => {
      d.turn.player = 'opp';
      obs = mutate.scene.enter(d, 'self', 'B07099', {}).uid;
      mutate.scene.removeToRemove(d, obs, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('owner=opp 視点 (opp 自身の効果で opp の当該キャラ除去) → 発火 [BUG-174 owner-relative]', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp'; // opp 視点の【自分ターン中】
      d.players.opp.partner.cardId = 'PARTNER_K';
      obs = mutate.scene.enter(d, 'opp', 'B07099', {}).uid;
      mutate.scene.removeToRemove(d, obs, 'effect', undefined, { byPlayer: 'opp' });
    });
    expect(fired(after, obs)).toBe(true);
  });
});

// ============================================================
// ② a1/a2 effect semantics — evidenceFlipDown self-scope (runAtom 決定論)
// ============================================================
describe('B07099 effect — evidenceFlipDown 自分の表向き証拠を裏向き (self-scope)', () => {
  it('自分の表向き証拠を裏向き / 相手の同名表向き証拠は不変 (self-scope) / 既裏向き decoy 不変', () => {
    const s = produce(createEmptyGameState(), (d) => {
      d.players.self.evidence = [ev('S_FU', true), ev('S_FD', false)];
      d.players.opp.evidence = [ev('S_FU', true)]; // 同 cardId の相手証拠 = decoy (side self ゆえ触らない)
    });
    const r = produce(s, (d) => {
      runAtom(d, 'evidenceFlipDown', { player: 'self', target: 'S_FU', faceUp: true }, ctxOf('self', 'x#1', 'B07099'));
    });
    expect(r.players.self.evidence[0].faceUp, '自分の S_FU が裏向きに').toBe(false);
    expect(r.players.self.evidence[1].faceUp, '元から裏向きの decoy は不変').toBe(false);
    expect(r.players.opp.evidence[0].faceUp, '相手の同名 S_FU は不変 (self-scope)').toBe(true);
  });

  it('順番不変 (rules/11 証拠エリアの位置は変えない): flip 後も配列位置/並びは不変', () => {
    const s = produce(createEmptyGameState(), (d) => {
      d.players.self.evidence = [ev('A', true), ev('B', true), ev('C', true)];
    });
    const r = produce(s, (d) => {
      runAtom(d, 'evidenceFlipDown', { player: 'self', target: 'B', faceUp: true }, ctxOf('self', 'x#1', 'B07099'));
    });
    expect(r.players.self.evidence.map((e) => e.cardId)).toEqual(['A', 'B', 'C']);
    expect(r.players.self.evidence.map((e) => e.faceUp)).toEqual([true, false, true]);
  });

  it('0枚 (cardIds:[]) → no-op [rules/15「〜1つまで」= 0 可]', () => {
    const s = produce(createEmptyGameState(), (d) => {
      d.players.self.evidence = [ev('Z', true)];
    });
    const r = produce(s, (d) => {
      runAtom(d, 'evidenceFlipDown', { player: 'self', cardIds: [] }, ctxOf('self', 'x#1', 'B07099'));
    });
    expect(r.players.self.evidence[0].faceUp, '不変').toBe(true);
  });

  it('短縮形 {max:1, faceUp:true} (target 未指定) → pick を enqueue [「1つまで」選択経路]', () => {
    const s = produce(createEmptyGameState(), (d) => {
      d.players.self.evidence = [ev('S_FU', true), ev('S_FD', false)];
    });
    produce(s, (d) => {
      runAtom(d, 'evidenceFlipDown', { player: 'self', max: 1, faceUp: true }, ctxOf('self', 'x#1', 'B07099'));
    });
    expect(queueLen()).toBe(1);
  });
});

// ============================================================
// ③ descriptor 全列転写 pin
// ============================================================
describe('B07099 descriptor — 全列転写', () => {
  it('a1: leave:to-remove selfOnly + removedCharMatches{effect,self} + and[partnerColor黒,turn self] + evidenceFlipDown self短縮形', () => {
    const a1 = B07099.abilities[0] as AbilityDef;
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-scene');
    expect(a1.trigger).toMatchObject({
      hook: 'leave:to-remove',
      selfOnly: true,
      matcherCondition: { kind: 'removedCharMatches', cause: 'effect', byPlayer: 'self' },
    });
    expect(a1.condition).toMatchObject({
      kind: 'and',
      cs: [{ kind: 'partnerColor', color: '黒' }, { kind: 'turn', player: 'self' }],
    });
    expect(a1.effect).toMatchObject({
      kind: 'atom', verb: 'evidenceFlipDown', args: { player: 'self', max: 1, faceUp: true },
    });
  });

  it('a2: 【ヒラメキ】evidence:remove-by-action optional + evidenceFlipDown self短縮形', () => {
    const a2 = B07099.abilities[1] as AbilityDef;
    expect(a2.type).toBe('triggered');
    expect(a2.scope).toBe('on-evidence');
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toMatchObject({
      kind: 'atom', verb: 'evidenceFlipDown', args: { player: 'self', max: 1, faceUp: true },
    });
  });

  it('card fields: 黒 / lv5 / ap4000 / lp1 / traits[CGクリエイター,システムエンジニア] / names[板倉卓] / no', () => {
    expect(B07099.colors).toEqual(['黒']);
    expect(B07099.level).toBe(5);
    expect(B07099.ap).toBe(4000);
    expect(B07099.lp).toBe(1);
    expect(B07099.traits).toEqual(['CGクリエイター', 'システムエンジニア']);
    expect(B07099.names).toEqual(['板倉卓']);
    expect(B07099.no).toBe('0826/B07099');
    expect(B07099.keywords ?? []).toEqual([]);
  });
});
