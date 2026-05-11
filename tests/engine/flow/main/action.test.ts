// Phase 4 Task 4.3 — flow.main.canAction*
// rules: 07-action-flow.md, 13-keywords.md (迅速/突撃)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { canAction, canActionAgainstChar, canActionAgainstCase } from '@/engine/flow/main/action';
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

function makeScene(opts: {
  selfNamed?: boolean;
  selfState?: 'active' | 'sleep' | 'stun';
  selfKeywords?: string[];
  oppState?: 'active' | 'sleep' | 'stun';
  oppEvidence?: number;
}): { s: GameState; selfUid: string; oppUid: string } {
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(makeCard('C1'));
  registerCardDef(makeCard('C2'));
  const initial = createEmptyGameState();
  let selfUid = '';
  let oppUid = '';
  const s = produce(initial, draft => {
    const s1 = mutate.scene.enter(draft, 'self', 'C1', { named: opts.selfNamed });
    selfUid = s1.uid;
    if (opts.selfState === 'sleep') mutate.scene.setState(draft, s1.uid, 'sleep');
    else if (opts.selfState === 'stun') mutate.scene.setState(draft, s1.uid, 'stun');
    if (opts.selfKeywords) {
      const t = draft.players.self.scene.find(c => c.uid === selfUid)!;
      t.keywordOverrides.granted = opts.selfKeywords;
    }
    const o1 = mutate.scene.enter(draft, 'opp', 'C2', {});
    oppUid = o1.uid;
    if (opts.oppState === 'sleep') mutate.scene.setState(draft, o1.uid, 'sleep');
    else if (opts.oppState === 'stun') mutate.scene.setState(draft, o1.uid, 'stun');
    // 相手証拠
    const evCount = opts.oppEvidence ?? 0;
    for (let i = 0; i < evCount; i++) {
      draft.players.opp.evidence.push({
        cardId: `ev-${i}`,
        faceUp: false,
        origin: { turn: 0, via: 'opening' },
      });
    }
  });
  return { s, selfUid, oppUid };
}

describe('engine.flow.main.canAction', () => {
  beforeEach(() => {
    _resetUidCounter();
    resetDefRegistry();
  });

  it('active + 名乗りなし → canAction=true', () => {
    const { s, selfUid } = makeScene({});
    expect(canAction(s, selfUid)).toBe(true);
  });

  it('sleep → canAction=false', () => {
    const { s, selfUid } = makeScene({ selfState: 'sleep' });
    expect(canAction(s, selfUid)).toBe(false);
  });

  it('stun → canAction=false', () => {
    const { s, selfUid } = makeScene({ selfState: 'stun' });
    expect(canAction(s, selfUid)).toBe(false);
  });

  it('名乗り中で例外キーワードなし → false (rules/07)', () => {
    const { s, selfUid } = makeScene({ selfNamed: true });
    expect(canAction(s, selfUid)).toBe(false);
  });

  it('名乗り中 + 迅速 → canAction=true (rules/13)', () => {
    const { s, selfUid } = makeScene({ selfNamed: true, selfKeywords: ['迅速'] });
    expect(canAction(s, selfUid)).toBe(true);
  });

  it('名乗り中 + 突撃 → canAction=true (rules/13)', () => {
    const { s, selfUid } = makeScene({ selfNamed: true, selfKeywords: ['突撃'] });
    expect(canAction(s, selfUid)).toBe(true);
  });

  it('名乗り中 + 突撃[キャラ] → canAction(generic)=false / canActionAgainstChar=true (rules/13)', () => {
    const { s, selfUid, oppUid } = makeScene({
      selfNamed: true,
      selfKeywords: ['突撃[キャラ]'],
      oppState: 'sleep',
    });
    // canAction (any) は突撃[キャラ] では成立しない (any キーワード判定)
    expect(canAction(s, selfUid)).toBe(false);
    // 対 char では成立
    expect(canActionAgainstChar(s, selfUid, oppUid)).toBe(true);
  });

  it('名乗り中 + 突撃[事件] → canActionAgainstCase=true / canActionAgainstChar=false', () => {
    const { s, selfUid, oppUid } = makeScene({
      selfNamed: true,
      selfKeywords: ['突撃[事件]'],
      oppState: 'sleep',
      oppEvidence: 1,
    });
    expect(canActionAgainstCase(s, selfUid, 'opp')).toBe(true);
    expect(canActionAgainstChar(s, selfUid, oppUid)).toBe(false);
  });
});

describe('engine.flow.main.canActionAgainstChar', () => {
  beforeEach(() => {
    _resetUidCounter();
    resetDefRegistry();
  });

  it('相手キャラが sleep → true', () => {
    const { s, selfUid, oppUid } = makeScene({ oppState: 'sleep' });
    expect(canActionAgainstChar(s, selfUid, oppUid)).toBe(true);
  });

  it('相手キャラが stun → true (rules/07)', () => {
    const { s, selfUid, oppUid } = makeScene({ oppState: 'stun' });
    expect(canActionAgainstChar(s, selfUid, oppUid)).toBe(true);
  });

  it('相手キャラが active → false (rules/07)', () => {
    const { s, selfUid, oppUid } = makeScene({ oppState: 'active' });
    expect(canActionAgainstChar(s, selfUid, oppUid)).toBe(false);
  });

  it('対象が存在しない uid → false', () => {
    const { s, selfUid } = makeScene({});
    expect(canActionAgainstChar(s, selfUid, 'nonexistent')).toBe(false);
  });

  it('自分のキャラを対象に → false (相手の現場のキャラのみ rules/07)', () => {
    const { s, selfUid } = makeScene({});
    expect(canActionAgainstChar(s, selfUid, selfUid)).toBe(false);
  });
});

describe('engine.flow.main.canActionAgainstCase', () => {
  beforeEach(() => {
    _resetUidCounter();
    resetDefRegistry();
  });

  it('相手証拠 ≥ 1 → true', () => {
    const { s, selfUid } = makeScene({ oppEvidence: 1 });
    expect(canActionAgainstCase(s, selfUid, 'opp')).toBe(true);
  });

  it('相手証拠 = 0 → false (rules/07)', () => {
    const { s, selfUid } = makeScene({ oppEvidence: 0 });
    expect(canActionAgainstCase(s, selfUid, 'opp')).toBe(false);
  });

  it('自分の事件は対象にできない (rules/07)', () => {
    const { s, selfUid } = makeScene({ oppEvidence: 1 });
    expect(canActionAgainstCase(s, selfUid, 'self')).toBe(false);
  });
});
