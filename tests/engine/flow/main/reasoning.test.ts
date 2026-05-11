// Phase 4 Task 4.3 — flow.main.doReasoning
// rules: 11-reasoning.md, 13-keywords.md (迅速), 19-special-rules.md (LP下限なし)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { canReason, doReasoning } from '@/engine/flow/main/reasoning';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, GameState } from '@/engine/types';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: opts.kind ?? 'character',
    names: opts.names ?? [id],
    colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1,
    ap: opts.ap ?? 0,
    lp: opts.lp ?? 3,
    traits: opts.traits ?? [],
    rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '',
    abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

function makeStateWithChar(opts: { named?: boolean; state?: 'active' | 'sleep' | 'stun'; lp?: number; keywords?: string[]; deckSize?: number } = {}): { s: GameState; uid: string } {
  _resetUidCounter();
  registerCardDef(makeCard('C1', { lp: opts.lp ?? 3 }));
  const initial = createEmptyGameState();
  let uid = '';
  const s = produce(initial, draft => {
    const c = mutate.scene.enter(draft, 'self', 'C1', { named: opts.named });
    uid = c.uid;
    if (opts.state === 'sleep') {
      mutate.scene.setState(draft, c.uid, 'sleep');
    } else if (opts.state === 'stun') {
      mutate.scene.setState(draft, c.uid, 'stun');
    }
    if (opts.keywords) {
      const target = draft.players.self.scene.find(c => c.uid === uid)!;
      target.keywordOverrides.granted = opts.keywords;
    }
    // デッキ
    const sz = opts.deckSize ?? 10;
    draft.players.self.deck = Array.from({ length: sz }, (_, i) => `d-${i}`);
  });
  return { s, uid };
}

describe('engine.flow.main.doReasoning', () => {
  beforeEach(() => {
    event._resetRegistry();
    resetDefRegistry();
  });

  it('active + 名乗りなし → canReason=true', () => {
    const { s, uid } = makeStateWithChar();
    expect(canReason(s, uid)).toBe(true);
  });

  it('スリープ状態 → canReason=false', () => {
    const { s, uid } = makeStateWithChar({ state: 'sleep' });
    expect(canReason(s, uid)).toBe(false);
  });

  it('スタン状態 → canReason=false', () => {
    const { s, uid } = makeStateWithChar({ state: 'stun' });
    expect(canReason(s, uid)).toBe(false);
  });

  it('名乗り中で迅速なし → canReason=false (rules/11)', () => {
    const { s, uid } = makeStateWithChar({ named: true });
    expect(canReason(s, uid)).toBe(false);
  });

  it('名乗り中 + 迅速持ち → canReason=true (rules/13)', () => {
    const { s, uid } = makeStateWithChar({ named: true, keywords: ['迅速'] });
    expect(canReason(s, uid)).toBe(true);
  });

  it('doReasoning: スリープ化 + LP=3 → 証拠 3 枚', () => {
    const { s, uid } = makeStateWithChar({ lp: 3 });
    const after = produce(s, draft => {
      doReasoning(draft, uid);
    });
    const c = after.players.self.scene.find(c => c.uid === uid)!;
    expect(c.state).toBe('sleep');
    expect(after.players.self.evidence).toHaveLength(3);
  });

  it('LP=-2 → 証拠 0 枚 (rules/11 LP≤0)', () => {
    _resetUidCounter();
    resetDefRegistry();
    registerCardDef(makeCard('C1', { lp: 1 }));
    const initial = createEmptyGameState();
    let uid = '';
    const s = produce(initial, draft => {
      const c = mutate.scene.enter(draft, 'self', 'C1', {});
      uid = c.uid;
      // override LP to -2
      const target = draft.players.self.scene.find(c => c.uid === uid)!;
      target.lpOverride = -2;
      draft.players.self.deck = Array.from({ length: 10 }, (_, i) => `d-${i}`);
    });
    const after = produce(s, draft => {
      doReasoning(draft, uid);
    });
    expect(after.players.self.evidence).toHaveLength(0);
    // スリープ化はする
    const c = after.players.self.scene.find(c => c.uid === uid)!;
    expect(c.state).toBe('sleep');
  });

  it('LP=0 → 証拠 0 枚 (rules/11)', () => {
    _resetUidCounter();
    resetDefRegistry();
    registerCardDef(makeCard('C1', { lp: 0 }));
    const initial = createEmptyGameState();
    let uid = '';
    const s = produce(initial, draft => {
      const c = mutate.scene.enter(draft, 'self', 'C1', {});
      uid = c.uid;
      draft.players.self.deck = Array.from({ length: 10 }, (_, i) => `d-${i}`);
    });
    const after = produce(s, draft => {
      doReasoning(draft, uid);
    });
    expect(after.players.self.evidence).toHaveLength(0);
  });

  it('hook: reasoning:declare → reasoning:before-add → reasoning:end の順', () => {
    const { s, uid } = makeStateWithChar({ lp: 2 });
    const fired: string[] = [];
    event.on('reasoning:declare', () => {
      fired.push('declare');
    });
    event.on('reasoning:before-add', () => {
      fired.push('before-add');
    });
    event.on('reasoning:end', () => {
      fired.push('end');
    });
    produce(s, draft => {
      doReasoning(draft, uid);
    });
    expect(fired).toEqual(['declare', 'before-add', 'end']);
  });

  it('reasoning:declare payload: { uid, byPlayer } (spec)', () => {
    const { s, uid } = makeStateWithChar({ lp: 2 });
    let declarePayload: unknown;
    event.on('reasoning:declare', (_state, payload) => {
      declarePayload = payload;
    });
    produce(s, draft => { doReasoning(draft, uid); });
    expect(declarePayload).toMatchObject({ uid, byPlayer: 'self' });
  });

  it('reasoning:before-add payload: { uid, lpUsed } (spec, pre-clamp raw LP)', () => {
    const { s, uid } = makeStateWithChar({ lp: 3 });
    let beforeAddPayload: unknown;
    event.on('reasoning:before-add', (_state, payload) => {
      beforeAddPayload = payload;
    });
    produce(s, draft => { doReasoning(draft, uid); });
    expect(beforeAddPayload).toMatchObject({ uid, lpUsed: 3 });
  });

  it('reasoning:before-add lpUsed carries negative LP (pre-clamp, for mislead)', () => {
    _resetUidCounter();
    resetDefRegistry();
    registerCardDef(makeCard('C1', { lp: 1 }));
    const initial = createEmptyGameState();
    let uid2 = '';
    const s2 = produce(initial, draft => {
      const c = mutate.scene.enter(draft, 'self', 'C1', {});
      uid2 = c.uid;
      const target = draft.players.self.scene.find(c => c.uid === uid2)!;
      target.lpOverride = -2;
      draft.players.self.deck = Array.from({ length: 10 }, (_, i) => `d-${i}`);
    });
    let beforeAddPayload: unknown;
    event.on('reasoning:before-add', (_state, payload) => {
      beforeAddPayload = payload;
    });
    produce(s2, draft => { doReasoning(draft, uid2); });
    expect(beforeAddPayload).toMatchObject({ uid: uid2, lpUsed: -2 });
  });

  it('canReason=false 状態で doReasoning は throw', () => {
    const { s, uid } = makeStateWithChar({ state: 'sleep' });
    expect(() =>
      produce(s, draft => {
        doReasoning(draft, uid);
      }),
    ).toThrow(/not allowed/);
  });

  it('パートナーで推理可能 (active partner)', () => {
    registerCardDef(makeCard('P-SELF', { lp: 4, kind: 'partner' }));
    const initial = createEmptyGameState();
    const s = produce(initial, draft => {
      mutate.partner.init(draft, 'self', 'P-SELF');
      draft.players.self.deck = Array.from({ length: 10 }, (_, i) => `d-${i}`);
    });
    expect(canReason(s, 'partner:self')).toBe(true);
    const after = produce(s, draft => {
      doReasoning(draft, 'partner:self');
    });
    expect(after.players.self.partner.state).toBe('sleep');
    expect(after.players.self.evidence).toHaveLength(4);
  });
});
