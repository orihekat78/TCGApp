// cluster9 — setcard:leave hook を実 engine 経路で駆動する挙動テスト (engine拡張 wave#2 cluster9, 2026-06-15)。
// B07034/B07034P/PR231 a1 (side:self) + B02020/B02020P a1 (side:opp) は非 MVP のため smoke:1000 では踏めない
// (BUG-132 教訓: smoke green は no-op 回帰のみ保証 / 新挙動は専用テストで実証)。
//
// 検証 (公式テキスト + qAndA と 1対1):
//   - FIX-1 (design-review HIGH): B07034 が自身に裏向きセットを持ったまま removeToRemove で離場しても a1 が発火する
//     (emit-BEFORE-splice 不変条件のピン留め。公式Q&A「このキャラ自身が現場を離れた場合も発動」)。
//   - sibling 離場 / removeOneSetCard (B08034 path、host 在場) でも発火。
//   - per-occurrence + 【ターン2】: 2枚同時離場=2ドロー / 3枚=2ドロー上限 (公式Q&A iii)。
//   - 【事件赤魔術】gate: 事件が赤魔術でなければ不発。【自分ターン中】gate: 相手ターンでは不発。
//   - side 判定: B07034 (side:self) は相手側 set card 離場で不発 / B02020 (side:opp) は相手側で発火・自側で不発。
// rules: 16-card-set.md / 15 / 17 / 22

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { CardDef, GameState } from '@/engine/types';

// synthetic 事件 (caseTrait gate 充足/非充足用)
function pcase(id: string, caseTraits: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'case', names: [id], colors: ['白'], traits: [],
    rarity: 'C', imageUrl: '', caseLevel: 7, caseTraits, abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
// neutral host (set card 保持役。setcard:leave ability は持たない)
function phost(id: string): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
function setCase(s: GameState, p: 'self' | 'opp', cardId: string): void {
  s.players[p].case = { cardId, status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} } as GameState['players']['self']['case'];
}

const AKA = 'AKACASE';   // 赤魔術 事件
const PLAIN = 'PLAINCASE'; // 非赤魔術 事件
const HOST = 'HOST';

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  registerAll();
  registerCardDef(pcase(AKA, ['赤魔術']));
  registerCardDef(pcase(PLAIN, []));
  registerCardDef(phost(HOST));
  registerTriggeredListener();
});

/** self 現場に B07034 + (option) HOST を配置、deck を draw 用に充填、turn=self + 赤魔術事件 を default に。 */
function base(opts: { caseId?: string; turn?: 'self' | 'opp' } = {}): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn.player = opts.turn ?? 'self';
    setCase(d, 'self', opts.caseId ?? AKA);
    setCase(d, 'opp', PLAIN);
    d.players.self.deck = ['D1', 'D2', 'D3', 'D4', 'D5'];
    d.players.opp.deck = ['E1', 'E2', 'E3'];
  });
}

describe('cluster9 — setcard:leave (B07034 a1 side:self)', () => {
  it('FIX-1: B07034 が自身の裏向きセットを持ったまま removeToRemove で離場 → a1 が1ドロー (emit-before-splice 不変条件)', () => {
    let s = base();
    s = produce(s, (d) => {
      const k = mutate.scene.enter(d, 'self', 'B07034', {});
      mutate.char.setCard(d, k.uid, 'SET1', false);
    });
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => {
      const k = d.players.self.scene.find((c) => c.cardId === 'B07034')!;
      mutate.scene.removeToRemove(d, k.uid, 'effect');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length).toBe(before + 1);
    // B07034 自身は離場済 (リムーブエリアへ)
    expect(after.players.self.scene.some((c) => c.cardId === 'B07034')).toBe(false);
  });

  it('sibling 離場: 別の自側キャラの裏向きセットが removeToRemove で離場 → B07034 が1ドロー', () => {
    let s = base();
    s = produce(s, (d) => {
      mutate.scene.enter(d, 'self', 'B07034', {});
      const h = mutate.scene.enter(d, 'self', HOST, {});
      mutate.char.setCard(d, h.uid, 'SET1', false);
    });
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => {
      const h = d.players.self.scene.find((c) => c.cardId === HOST)!;
      mutate.scene.removeToRemove(d, h.uid, 'effect');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length).toBe(before + 1);
  });

  it('removeOneSetCard (B08034 path, host 在場): 自側キャラの set card 1枚除去 → B07034 が1ドロー', () => {
    let s = base();
    s = produce(s, (d) => {
      mutate.scene.enter(d, 'self', 'B07034', {});
      const h = mutate.scene.enter(d, 'self', HOST, {});
      mutate.char.setCard(d, h.uid, 'SET1', false);
    });
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => {
      const h = d.players.self.scene.find((c) => c.cardId === HOST)!;
      mutate.char.removeOneSetCard(d, h.uid);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length).toBe(before + 1);
    // host は在場のまま (removeOneSetCard は set card のみ外す)
    expect(after.players.self.scene.some((c) => c.cardId === HOST)).toBe(true);
  });

  it('per-occurrence: 2枚同時離場 → 2ドロー / 3枚同時離場 → 2ドロー (【ターン2】上限)', () => {
    // 2枚
    let s2 = base();
    s2 = produce(s2, (d) => {
      mutate.scene.enter(d, 'self', 'B07034', {});
      const h = mutate.scene.enter(d, 'self', HOST, {});
      mutate.char.setCard(d, h.uid, 'S1', false);
      mutate.char.setCard(d, h.uid, 'S2', false);
    });
    const b2 = s2.players.self.hand.length;
    const a2 = produce(s2, (d) => {
      const h = d.players.self.scene.find((c) => c.cardId === HOST)!;
      mutate.scene.removeToRemove(d, h.uid, 'effect');
      runAllUntilEmpty(d);
    });
    expect(a2.players.self.hand.length).toBe(b2 + 2);

    // 3枚 → 上限2
    let s3 = base();
    s3 = produce(s3, (d) => {
      mutate.scene.enter(d, 'self', 'B07034', {});
      const h = mutate.scene.enter(d, 'self', HOST, {});
      mutate.char.setCard(d, h.uid, 'S1', false);
      mutate.char.setCard(d, h.uid, 'S2', false);
      mutate.char.setCard(d, h.uid, 'S3', false);
    });
    const b3 = s3.players.self.hand.length;
    const a3 = produce(s3, (d) => {
      const h = d.players.self.scene.find((c) => c.cardId === HOST)!;
      mutate.scene.removeToRemove(d, h.uid, 'effect');
      runAllUntilEmpty(d);
    });
    expect(a3.players.self.hand.length).toBe(b3 + 2);
  });

  it('【事件赤魔術】gate: 事件が赤魔術でなければ不発', () => {
    let s = base({ caseId: PLAIN });
    s = produce(s, (d) => {
      mutate.scene.enter(d, 'self', 'B07034', {});
      const h = mutate.scene.enter(d, 'self', HOST, {});
      mutate.char.setCard(d, h.uid, 'S1', false);
    });
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => {
      const h = d.players.self.scene.find((c) => c.cardId === HOST)!;
      mutate.scene.removeToRemove(d, h.uid, 'effect');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length).toBe(before);
  });

  it('【自分ターン中】gate: 相手ターンでは不発', () => {
    let s = base({ turn: 'opp' });
    s = produce(s, (d) => {
      mutate.scene.enter(d, 'self', 'B07034', {});
      const h = mutate.scene.enter(d, 'self', HOST, {});
      mutate.char.setCard(d, h.uid, 'S1', false);
    });
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => {
      const h = d.players.self.scene.find((c) => c.cardId === HOST)!;
      mutate.scene.removeToRemove(d, h.uid, 'effect');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length).toBe(before);
  });

  it('side:self: 相手側キャラの set card 離場では B07034 は不発', () => {
    let s = base();
    s = produce(s, (d) => {
      mutate.scene.enter(d, 'self', 'B07034', {});
      const h = mutate.scene.enter(d, 'opp', HOST, {});
      mutate.char.setCard(d, h.uid, 'S1', false);
    });
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => {
      const h = d.players.opp.scene.find((c) => c.cardId === HOST)!;
      mutate.scene.removeToRemove(d, h.uid, 'effect');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length).toBe(before);
  });
});

describe('cluster9 — setcard:leave (B02020 a1 side:opp)', () => {
  it('side:opp: 相手側キャラの set card 離場で B02020 a1 が queue される', () => {
    let s = base();
    s = produce(s, (d) => {
      mutate.scene.enter(d, 'self', 'B02020', {});
      const h = mutate.scene.enter(d, 'opp', HOST, {});
      mutate.char.setCard(d, h.uid, 'S1', false);
    });
    const after = produce(s, (d) => {
      const h = d.players.opp.scene.find((c) => c.cardId === HOST)!;
      mutate.scene.removeToRemove(d, h.uid, 'effect');
    });
    const queued = after.pendingEffects.some((pe) => pe.triggeredBy?.hook === 'setcard:leave');
    expect(queued).toBe(true);
  });

  it('side:opp: 自側キャラの set card 離場では B02020 は queue されない', () => {
    let s = base();
    s = produce(s, (d) => {
      mutate.scene.enter(d, 'self', 'B02020', {});
      const h = mutate.scene.enter(d, 'self', HOST, {});
      mutate.char.setCard(d, h.uid, 'S1', false);
    });
    const after = produce(s, (d) => {
      const h = d.players.self.scene.find((c) => c.cardId === HOST)!;
      mutate.scene.removeToRemove(d, h.uid, 'effect');
    });
    const queued = after.pendingEffects.some((pe) => pe.triggeredBy?.hook === 'setcard:leave');
    expect(queued).toBe(false);
  });
});
