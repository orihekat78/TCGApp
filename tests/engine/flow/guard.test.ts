// Phase 4 Group B Task 4.7 — flow.guard
// rules: 07-action-flow.md, 13-keywords.md (ブレット), 24-qa-naming-stun.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { candidates, canGuard } from '@/engine/flow/guard';
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
    ap: opts.ap ?? 1000,
    lp: opts.lp ?? 1000,
    traits: opts.traits ?? [],
    rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '',
    abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

function setupScene(opts: {
  attackerKeywords?: string[];
  oppChars?: { state?: 'active' | 'sleep' | 'stun'; named?: boolean }[];
}): { s: GameState; selfUid: string; oppUids: string[] } {
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(makeCard('Atk'));
  registerCardDef(makeCard('Def'));
  const initial = createEmptyGameState();
  let selfUid = '';
  const oppUids: string[] = [];
  const s = produce(initial, draft => {
    const a = mutate.scene.enter(draft, 'self', 'Atk', {});
    selfUid = a.uid;
    if (opts.attackerKeywords) {
      const ch = draft.players.self.scene.find(c => c.uid === selfUid)!;
      ch.keywordOverrides.granted = opts.attackerKeywords;
    }
    const list = opts.oppChars ?? [{}];
    for (const oc of list) {
      const o = mutate.scene.enter(draft, 'opp', 'Def', { named: oc.named });
      if (oc.state === 'sleep') mutate.scene.setState(draft, o.uid, 'sleep');
      else if (oc.state === 'stun') mutate.scene.setState(draft, o.uid, 'stun');
      oppUids.push(o.uid);
    }
  });
  return { s, selfUid, oppUids };
}

describe('engine.flow.guard.candidates', () => {
  beforeEach(() => {
    _resetUidCounter();
    resetDefRegistry();
  });

  it('returns active opp chars (excludes sleep/stun)', () => {
    const { s, selfUid, oppUids } = setupScene({
      oppChars: [
        { state: 'active' },
        { state: 'sleep' },
        { state: 'stun' },
      ],
    });
    const list = candidates(s, selfUid);
    expect(list.map(c => c.uid)).toEqual([oppUids[0]]);
  });

  it('includes named active chars (rules/24)', () => {
    const { s, selfUid, oppUids } = setupScene({
      oppChars: [{ state: 'active', named: true }],
    });
    const list = candidates(s, selfUid);
    expect(list.map(c => c.uid)).toEqual([oppUids[0]]);
  });

  it('returns [] when attacker has ブレット (rules/13)', () => {
    const { s, selfUid } = setupScene({
      attackerKeywords: ['ブレット'],
      oppChars: [{ state: 'active' }, { state: 'active' }],
    });
    const list = candidates(s, selfUid);
    expect(list).toEqual([]);
  });

  it('returns multiple active opp chars', () => {
    const { s, selfUid, oppUids } = setupScene({
      oppChars: [{ state: 'active' }, { state: 'active' }],
    });
    const list = candidates(s, selfUid);
    expect(list.map(c => c.uid).sort()).toEqual([...oppUids].sort());
  });
});

describe('engine.flow.guard.canGuard', () => {
  beforeEach(() => {
    _resetUidCounter();
    resetDefRegistry();
  });

  it('true for valid candidate', () => {
    const { s, selfUid, oppUids } = setupScene({
      oppChars: [{ state: 'active' }],
    });
    expect(canGuard(s, selfUid, oppUids[0])).toBe(true);
  });

  it('false for invalid guardUid', () => {
    const { s, selfUid } = setupScene({});
    expect(canGuard(s, selfUid, 'nonexistent')).toBe(false);
  });

  it('false when attacker has ブレット (even for valid otherwise-guard)', () => {
    const { s, selfUid, oppUids } = setupScene({
      attackerKeywords: ['ブレット'],
      oppChars: [{ state: 'active' }],
    });
    expect(canGuard(s, selfUid, oppUids[0])).toBe(false);
  });

  it('false when target char is sleep (not active)', () => {
    const { s, selfUid, oppUids } = setupScene({
      oppChars: [{ state: 'sleep' }],
    });
    expect(canGuard(s, selfUid, oppUids[0])).toBe(false);
  });
});
