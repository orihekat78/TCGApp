// attribution mini-wave ① byPlayer:'self' — B03116 / B03112 / B05107 probe
//
// 検証対象 (novel engine surface = removedCharMatches.byPlayer, cond/eval.ts:731):
//   「自分の能力や効果によってリムーブされたとき」= payload.byPlayer が効果 owner (絶対 Player) と一致するか。
//   - B03116 / B05107: 自己蘇生 (selfOnly + byPlayer:'self')。
//   - B03112: 観測 (非 selfOnly + side:'self' + removedFilter{color:'黒'} + byPlayer:'self')。
//
// 発火判定 = ability.condition + trigger.matcherCondition を通過して pendingEffects に queue されたか
// (optional/AI-skip とは無関係に「条件が成立して trigger が発火したか」を観測 = hagiwara-self-remove-observer 同方式)。
//
// 経路2本 (BUG-171 production dispatch): (a) mutate.scene.removeToRemove 直 emit / (b) runAtom('sceneRemove') 実 atom。
// pin: byPlayer:'opp' 過剰発火 / byPlayer 未設定 legacy fail-closed / cause:'switch' 二重遮断 / owner='opp' 視点 (BUG-174) /
//      条件外 decoy 非発火。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { runAtom } from '@/engine/effect/atom-handlers';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { B03116 } from '@/cards/ct-p03/B03116';
import { B03112 } from '@/cards/ct-p03/B03112';
import { B05107 } from '@/cards/ct-p05/B05107';
import type { GameState, CardDef, Player, EffectCtx, AbilityDef } from '@/engine/types';

function defOf(o: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: o.id, no: o.id, kind: 'character', names: o.names ?? [o.id], colors: o.colors ?? ['黒'],
    level: o.level ?? 1, ap: o.ap ?? 1000, lp: o.lp ?? 1, traits: o.traits ?? [],
    rarity: 'C', imageUrl: '', abilities: o.abilities ?? [], ruleRefs: [], ...o,
  };
}
// leave:to-remove の triggered effect が source.uid=observer で queue されたか
function fired(after: GameState, observerUid: string): boolean {
  return after.pendingEffects.some(
    (pe) => pe.triggeredBy?.hook === 'leave:to-remove' && pe.source?.uid === observerUid,
  );
}
function ctxOf(player: Player, uid: string, cardId: string): EffectCtx {
  return { source: { player, uid, cardId, area: 'scene' }, bindings: {} } as unknown as EffectCtx;
}

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); _resetRegistry();
  registerCardDef(B03116); registerCardDef(B03112); registerCardDef(B05107);
  registerCardDef(defOf({ id: 'PARTNER_K', names: ['ジン'], colors: ['黒'] })); // 黒パートナー
  registerCardDef(defOf({ id: 'PARTNER_G', names: ['佐藤'], colors: ['緑'] })); // 非黒パートナー (decoy)
  registerCardDef(defOf({ id: 'VICK', names: ['コルン'], colors: ['黒'], traits: ['黒ずくめの組織'] })); // 黒 victim
  registerCardDef(defOf({ id: 'VICW', names: ['白鳥'], colors: ['青'], traits: ['警察'] })); // 非黒 victim (decoy)
  registerTriggeredListener();
});

// ───────────────── B03116 / B05107 自己蘇生 (selfOnly + byPlayer) ─────────────────
describe.each([
  { id: 'B03116', cardId: 'B03116' },
  { id: 'B05107', cardId: 'B05107' },
])('$id 自己蘇生 — removedCharMatches{cause:effect, byPlayer:self}', ({ cardId }) => {
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
      obs = mutate.scene.enter(d, 'self', cardId, {}).uid;
      mutate.scene.removeToRemove(d, obs, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(fired(after, obs)).toBe(true);
  });

  it('byPlayer:self [runAtom sceneRemove 実 atom = ctx.source.player 由来] → 発火', () => {
    let obs = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', cardId, {}).uid;
      const src = mutate.scene.enter(d, 'self', 'VICW', {}).uid; // 除去を起こす別の自分カード
      runAtom(d, 'sceneRemove', { uid: obs, cause: 'effect' }, ctxOf('self', src, 'VICW'));
    });
    expect(fired(after, obs)).toBe(true);
  });

  it('byPlayer:opp (相手が自分の効果で除去) → 非発火 [過剰発火 pin]', () => {
    let obs = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', cardId, {}).uid;
      mutate.scene.removeToRemove(d, obs, 'effect', undefined, { byPlayer: 'opp' });
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('byPlayer 未設定 (legacy caller) → 非発火 [fail-closed pin]', () => {
    let obs = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', cardId, {}).uid;
      mutate.scene.removeToRemove(d, obs, 'effect', undefined); // opts 無し
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('cause:switch (byPlayer:self でも) → 非発火 [cause 二重遮断、rules/13 Q&A]', () => {
    let obs = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', cardId, {}).uid;
      mutate.scene.removeToRemove(d, obs, 'switch', undefined, { byPlayer: 'self' });
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('【パートナー黒】不成立 (緑パートナー) → 非発火 [condition gate]', () => {
    let obs = '';
    const after = board((d) => {
      d.players.self.partner.cardId = 'PARTNER_G';
      obs = mutate.scene.enter(d, 'self', cardId, {}).uid;
      mutate.scene.removeToRemove(d, obs, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('相手ターン中 (turn:opp) → 非発火 [【自分ターン中】gate]', () => {
    let obs = '';
    const after = board((d) => {
      d.turn.player = 'opp';
      obs = mutate.scene.enter(d, 'self', cardId, {}).uid;
      mutate.scene.removeToRemove(d, obs, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('owner=opp 視点 (opp 自身の効果で opp の当該キャラ除去) → 発火 [BUG-174 owner-relative]', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp'; // opp 視点の【自分ターン中】
      d.players.opp.partner.cardId = 'PARTNER_K';
      obs = mutate.scene.enter(d, 'opp', cardId, {}).uid;
      mutate.scene.removeToRemove(d, obs, 'effect', undefined, { byPlayer: 'opp' });
    });
    expect(fired(after, obs)).toBe(true);
  });
});

// ───────────────── B03116/B05107 列転写 (cutIn / keyword) ─────────────────
describe('B03116 / B05107 全列転写 pin', () => {
  it('B03116 a2 = 【カットイン】AP+1000 ($contact.byUid scope contact)', () => {
    const a2 = B03116.abilities[1] as AbilityDef;
    expect(a2.trigger?.hook).toBe('effect:declared');
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } });
  });
  it('B05107 は 〚突撃〛 (keywords) / B03116 は 突撃 非所持', () => {
    expect(B05107.keywords).toContain('突撃');
    expect(B03116.keywords ?? []).not.toContain('突撃');
  });
});

// ───────────────── B03112 観測 (非 selfOnly + removedFilter{黒} + byPlayer) ─────────────────
describe('B03112 a2 — 自分の現場の【黒】が自分の効果で除去 → LP+1 observer', () => {
  function board(mut: (d: GameState) => void): GameState {
    return produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      mut(d);
    });
  }

  it('黒 victim + byPlayer:self → 発火 [直 emit]', () => {
    let obs = '', vic = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', 'B03112', {}).uid;
      vic = mutate.scene.enter(d, 'self', 'VICK', {}).uid;
      mutate.scene.removeToRemove(d, vic, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(fired(after, obs)).toBe(true);
  });

  it('黒 victim + byPlayer:self [runAtom sceneRemove 実 atom] → 発火', () => {
    let obs = '', vic = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', 'B03112', {}).uid;
      vic = mutate.scene.enter(d, 'self', 'VICK', {}).uid;
      runAtom(d, 'sceneRemove', { uid: vic, cause: 'effect' }, ctxOf('self', obs, 'B03112'));
    });
    expect(fired(after, obs)).toBe(true);
  });

  it('非黒 victim (青) → 非発火 [removedFilter{color:黒} decoy]', () => {
    let obs = '', vic = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', 'B03112', {}).uid;
      vic = mutate.scene.enter(d, 'self', 'VICW', {}).uid; // 青
      mutate.scene.removeToRemove(d, vic, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('黒 victim + byPlayer:opp → 非発火 [過剰発火 pin]', () => {
    let obs = '', vic = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', 'B03112', {}).uid;
      vic = mutate.scene.enter(d, 'self', 'VICK', {}).uid;
      mutate.scene.removeToRemove(d, vic, 'effect', undefined, { byPlayer: 'opp' });
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('黒 victim + byPlayer 未設定 (legacy) → 非発火 [fail-closed]', () => {
    let obs = '', vic = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', 'B03112', {}).uid;
      vic = mutate.scene.enter(d, 'self', 'VICK', {}).uid;
      mutate.scene.removeToRemove(d, vic, 'effect', undefined);
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('cause:switch (黒 victim byPlayer:self) → 非発火 [rules/13 Q&A cause 遮断]', () => {
    let obs = '', vic = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', 'B03112', {}).uid;
      vic = mutate.scene.enter(d, 'self', 'VICK', {}).uid;
      mutate.scene.removeToRemove(d, vic, 'switch', undefined, { byPlayer: 'self' });
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('相手側の黒キャラ除去 (side:opp) → 非発火 [side:self gate]', () => {
    let obs = '', vic = '';
    const after = board((d) => {
      obs = mutate.scene.enter(d, 'self', 'B03112', {}).uid;
      vic = mutate.scene.enter(d, 'opp', 'VICK', {}).uid; // 相手現場の黒
      mutate.scene.removeToRemove(d, vic, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(fired(after, obs)).toBe(false);
  });

  it('owner=opp 視点 → 発火 [BUG-174 owner-relative]', () => {
    let obs = '', vic = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      obs = mutate.scene.enter(d, 'opp', 'B03112', {}).uid;
      vic = mutate.scene.enter(d, 'opp', 'VICK', {}).uid;
      mutate.scene.removeToRemove(d, vic, 'effect', undefined, { byPlayer: 'opp' });
    });
    expect(fired(after, obs)).toBe(true);
  });

  it('列転写: 〚突撃〛keyword / a1 = cutin:used AP+2000 / a2 = charModifyLP $self +1 scope turn', () => {
    expect(B03112.keywords).toContain('突撃');
    const a1 = B03112.abilities[0] as AbilityDef;
    expect(a1.trigger?.hook).toBe('cutin:used');
    expect(a1.effect).toMatchObject({ kind: 'conditional', then: { verb: 'charModifyAP', args: { delta: 2000, scope: 'contact' } } });
    const a2 = B03112.abilities[1] as AbilityDef;
    expect(a2.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'charModifyLP', args: { uid: '$self', delta: 1, scope: 'turn' } });
  });
});
