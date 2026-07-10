// attribution mini-wave ① — p04-byplayer-opp (B04089 ベルモット / B04091 ウォッカ / B04094 ジン)
// 束 = 「自分の能力や効果によって相手の現場にいるキャラをリムーブしたとき」
//      = removedCharMatches{side:'opp', cause:'effect', byPlayer:'self'} (owner-relative)。
//
// 検証方針 (production emit 経路、BUG-171):
//   leave:to-remove は mutate.scene.removeToRemove が emit する。effect 由来 removal の byPlayer は
//   atom-handlers/scene.ts:338 が ctx.source.player を opts.byPlayer で渡す配線 (mutate/scene.ts:334 が emit)。
//   本 probe は removeToRemove(uid, cause, byUid, { byPlayer }) を直接呼び、その production emit payload を
//   registerTriggeredListener() の実 listener に処理させ、observer の triggered effect が pendingEffects に
//   queue されたか (= condition 全通過) を検証する (hagiwara-self-remove-observer.test.ts と同方式)。
//   byPlayer 由来の過剰発火/fail-closed を pin し、owner='opp' 視点 (BUG-174) を 1 本入れる。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { B04089 } from '@/cards/ct-p04/B04089';
import { B04091 } from '@/cards/ct-p04/B04091';
import { B04094 } from '@/cards/ct-p04/B04094';
import type { GameState, CardDef, EffectDescriptor, AbilityDef } from '@/engine/types';

function defOf(o: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: o.id, no: o.id, kind: 'character', names: o.names ?? [o.id], colors: o.colors ?? ['黒'],
    level: o.level ?? 3, ap: o.ap ?? 3000, lp: o.lp ?? 1, traits: o.traits ?? [],
    rarity: 'C', imageUrl: '', abilities: o.abilities ?? [], ruleRefs: [], ...o,
  };
}
// optional/chain/sequence を walk して最初の指定 verb の args を返す。
function findArgs(eff: EffectDescriptor | undefined, verb: string): Record<string, unknown> | null {
  if (!eff || typeof eff !== 'object') return null;
  const e = eff as Record<string, unknown>;
  if (e.kind === 'atom' && e.verb === verb) return e.args as Record<string, unknown>;
  for (const k of ['effect', 'then', 'else']) {
    const r = findArgs(e[k] as EffectDescriptor | undefined, verb);
    if (r) return r;
  }
  for (const s of (e.steps as EffectDescriptor[] | undefined) ?? []) {
    const r = findArgs(s, verb);
    if (r) return r;
  }
  return null;
}
// observer (= source.uid) の leave:to-remove triggered effect が queue されたか
function observerFired(after: GameState, observerUid: string): boolean {
  return after.pendingEffects.some(
    (pe) => pe.triggeredBy?.hook === 'leave:to-remove' && pe.source?.uid === observerUid,
  );
}

function setup(defs: CardDef[]): void {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _resetRegistry();
  registerCardDef(defOf({ id: 'BLACKP', names: ['黒パートナー'], colors: ['黒'] }));
  registerCardDef(defOf({ id: 'REDP', names: ['赤パートナー'], colors: ['赤'] }));
  registerCardDef(defOf({ id: 'VIC', names: ['被害者'], traits: [] }));
  for (const d of defs) registerCardDef(d);
  registerTriggeredListener();
}

// ───────────────────────── B04089 ベルモット ─────────────────────────
describe('B04089 ベルモット — 自分の効果で相手キャラ除去→[opt]自スリープ+Lv7以下1枚除去', () => {
  beforeEach(() => setup([B04089]));

  // 出荷 DSL の構造 pin (印字 ⇔ DSL の 1対1)
  it('effect: optional→chain[sceneSetState{$self,sleep}, sceneRemove{Lv7以下・either・1枚まで}]', () => {
    const eff = (B04089.abilities[0] as AbilityDef).effect;
    const setState = findArgs(eff, 'sceneSetState')!;
    expect(setState.uid).toBe('$self');
    expect(setState.state).toBe('sleep');
    const rm = findArgs(eff, 'sceneRemove')!;
    expect(rm.max).toBe(1); // 「1枚まで」(0 可, rules/15)
    expect(rm.side).toBe('either'); // エリア指定なし=どちらの現場でも (rules/15)
    expect((rm.filter as Record<string, unknown>).levelMax).toBe(7);
    // 【ターン1】= limit
    expect((B04089.abilities[0] as AbilityDef).limit).toEqual({ kind: 'turn', n: 1 });
  });

  // P1 FIRE: 自分ターン・黒パートナー・自効果で相手現場キャラ除去 → observer queue
  it('P1 FIRE: 自効果(byPlayer=self)で相手現場キャラ除去 → 発火', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.partner.cardId = 'BLACKP';
      obs = mutate.scene.enter(d, 'self', 'B04089', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {}).uid;
      mutate.scene.removeToRemove(d, v, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(observerFired(after, obs)).toBe(true);
  });

  // P2 非発火: コンタクト由来 (cause:'contact-ap') は Q&A で明示的に非発火
  it('P2 非発火: cause=contact-ap (コンタクト由来) → Q&A どおり非発火', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.partner.cardId = 'BLACKP';
      obs = mutate.scene.enter(d, 'self', 'B04089', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {}).uid;
      mutate.scene.removeToRemove(d, v, 'contact-ap', obs, { byPlayer: 'self' });
    });
    expect(observerFired(after, obs)).toBe(false);
  });

  // P3 非発火 (過剰発火 pin): 相手の効果 (byPlayer=opp) による相手現場キャラ除去
  it('P3 非発火: byPlayer=opp (相手の効果由来) → 非発火', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.partner.cardId = 'BLACKP';
      obs = mutate.scene.enter(d, 'self', 'B04089', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {}).uid;
      mutate.scene.removeToRemove(d, v, 'effect', undefined, { byPlayer: 'opp' });
    });
    expect(observerFired(after, obs)).toBe(false);
  });

  // P4 非発火 (fail-closed pin): legacy caller (byPlayer 未設定)
  it('P4 非発火: byPlayer 未設定 (legacy caller) → fail-closed', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.partner.cardId = 'BLACKP';
      obs = mutate.scene.enter(d, 'self', 'B04089', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {}).uid;
      mutate.scene.removeToRemove(d, v, 'effect', undefined);
    });
    expect(observerFired(after, obs)).toBe(false);
  });

  // P5 非発火 (decoy): 自効果でも「自分の」現場キャラ除去 (side:self) は対象外
  it('P5 非発火: 自効果で自分の現場キャラ除去 (side:self) → 非発火', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.partner.cardId = 'BLACKP';
      obs = mutate.scene.enter(d, 'self', 'B04089', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'VIC', {}).uid; // 自分の現場の別キャラ
      mutate.scene.removeToRemove(d, v, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(observerFired(after, obs)).toBe(false);
  });

  // P6 非発火: 【自分ターン中】gate — 相手ターン中は非発火
  it('P6 非発火: 相手ターン中 (turn:opp) → 【自分ターン中】gate で非発火', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      d.players.self.partner.cardId = 'BLACKP';
      obs = mutate.scene.enter(d, 'self', 'B04089', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {}).uid;
      mutate.scene.removeToRemove(d, v, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(observerFired(after, obs)).toBe(false);
  });

  // P7 非発火: 既にスリープの observer は「このキャラをスリープさせてもよい」を払えず不発 (BUG-145, Q&A アクティブ必須)
  it('P7 非発火: observer が既にスリープ → not(charStateIs self sleep) で非発火', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.partner.cardId = 'BLACKP';
      obs = mutate.scene.enter(d, 'self', 'B04089', {}).uid;
      mutate.scene.setState(d, obs, 'sleep');
      const v = mutate.scene.enter(d, 'opp', 'VIC', {}).uid;
      mutate.scene.removeToRemove(d, v, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(observerFired(after, obs)).toBe(false);
  });

  // P8 非発火: 黒以外のパートナー → 【パートナー黒】gate
  it('P8 非発火: 赤パートナー → 【パートナー黒】gate で非発火', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.partner.cardId = 'REDP';
      obs = mutate.scene.enter(d, 'self', 'B04089', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {}).uid;
      mutate.scene.removeToRemove(d, v, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(observerFired(after, obs)).toBe(false);
  });
});

// ───────────────────────── B04091 ウォッカ ─────────────────────────
describe('B04091 ウォッカ — 自効果で相手キャラ除去→2ドロー+手札1リム / ヒラメキ', () => {
  beforeEach(() => setup([B04091]));

  it('a1 effect: sequence[draw{n:2}, discard{n:1}] (共に必須) + a2 ヒラメキ draw{n:1}', () => {
    const a1 = B04091.abilities[0] as AbilityDef;
    const draw = findArgs(a1.effect, 'draw')!;
    expect(draw.n).toBe(2);
    const disc = findArgs(a1.effect, 'discard')!;
    expect(disc.n).toBe(1);
    expect(a1.limit).toEqual({ kind: 'turn', n: 1 });
    const a2 = B04091.abilities[1] as AbilityDef;
    expect(a2.trigger?.hook).toBe('evidence:remove-by-action');
    expect(a2.trigger?.optional).toBe(true);
    expect(findArgs(a2.effect, 'draw')!.n).toBe(1);
  });

  it('P1 FIRE: 自効果(byPlayer=self)で相手現場キャラ除去 → 発火', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.partner.cardId = 'BLACKP';
      obs = mutate.scene.enter(d, 'self', 'B04091', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {}).uid;
      mutate.scene.removeToRemove(d, v, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(observerFired(after, obs)).toBe(true);
  });

  it('P2 非発火: cause=contact-ap (コンタクト由来) → 非発火', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.partner.cardId = 'BLACKP';
      obs = mutate.scene.enter(d, 'self', 'B04091', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {}).uid;
      mutate.scene.removeToRemove(d, v, 'contact-ap', obs, { byPlayer: 'self' });
    });
    expect(observerFired(after, obs)).toBe(false);
  });
});

// ───────────────────────── B04094 ジン ─────────────────────────
describe('B04094 ジン — 自効果で相手キャラ除去→ターン終了まで突撃 (【自分ターン中】無し)', () => {
  beforeEach(() => setup([B04094]));

  it('a1 effect: charGrantKeyword{$self, 突撃, turn} + limit turn1 / turn:self gate 無し', () => {
    const a1 = B04094.abilities[0] as AbilityDef;
    const g = findArgs(a1.effect, 'charGrantKeyword')!;
    expect(g.uid).toBe('$self');
    expect(g.kw).toBe('突撃');
    expect(g.scope).toBe('turn');
    expect(a1.limit).toEqual({ kind: 'turn', n: 1 });
    // 【自分ターン中】が無いので condition に turn は含まれない
    const condStr = JSON.stringify(a1.condition);
    expect(condStr).not.toContain('"turn"');
    expect(condStr).toContain('partnerColor');
    expect(condStr).toContain('removedCharMatches');
  });

  it('P1 FIRE: 自効果(byPlayer=self)で相手現場キャラ除去 → 発火', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.partner.cardId = 'BLACKP';
      obs = mutate.scene.enter(d, 'self', 'B04094', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {}).uid;
      mutate.scene.removeToRemove(d, v, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(observerFired(after, obs)).toBe(true);
  });

  // 【自分ターン中】が無い証明: 相手ターン中でも自効果由来除去なら発火
  it('P2 FIRE (turn無し証明): 相手ターン中でも自効果由来除去なら発火', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      d.players.self.partner.cardId = 'BLACKP';
      obs = mutate.scene.enter(d, 'self', 'B04094', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {}).uid;
      mutate.scene.removeToRemove(d, v, 'effect', undefined, { byPlayer: 'self' });
    });
    expect(observerFired(after, obs)).toBe(true);
  });

  // owner='opp' 視点 pin (BUG-174): opp scene の observer が、opp の効果で self 現場キャラを除去 → 発火
  it('P3 owner=opp 視点: opp observer が opp の効果で self 現場キャラ除去 → 発火', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.players.opp.partner.cardId = 'BLACKP';
      obs = mutate.scene.enter(d, 'opp', 'B04094', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'VIC', {}).uid; // opp から見て「相手の現場」
      mutate.scene.removeToRemove(d, v, 'effect', undefined, { byPlayer: 'opp' });
    });
    expect(observerFired(after, obs)).toBe(true);
  });

  it('P4 非発火: cause=contact-ap (コンタクト由来) → 非発火', () => {
    let obs = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.partner.cardId = 'BLACKP';
      obs = mutate.scene.enter(d, 'self', 'B04094', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'VIC', {}).uid;
      mutate.scene.removeToRemove(d, v, 'contact-ap', obs, { byPlayer: 'self' });
    });
    expect(observerFired(after, obs)).toBe(false);
  });
});
