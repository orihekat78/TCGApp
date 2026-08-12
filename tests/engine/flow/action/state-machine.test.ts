// Phase 4 Group B Task 4.4 — flow.action state machine
// rules: 07-action-flow.md, 08-contact.md, 22-qa-action-contact.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import {
  declare,
  tryGuard,
  passGuard,
  advance,
  abortIfMissing,
  abortForTerminal,
  snapshotAP,
  computeOrder,
  _resetActionContexts,
} from '@/engine/flow/action/state-machine';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { judge } from '@/engine/flow/contact';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, CausalLogEntryV1, GameState, ActionContext } from '@/engine/types';

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
  selfAP?: number;
  oppAP?: number;
  oppState?: 'active' | 'sleep' | 'stun';
  oppEvidence?: number;
  guardActive?: boolean;
} = {}): { s: GameState; selfUid: string; oppUid: string; guardUid: string } {
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(makeCard('Atk', { ap: opts.selfAP ?? 2000 }));
  registerCardDef(makeCard('Def', { ap: opts.oppAP ?? 1000 }));
  registerCardDef(makeCard('G', { ap: 500 }));
  const initial = createEmptyGameState();
  let selfUid = '';
  let oppUid = '';
  let guardUid = '';
  const s = produce(initial, draft => {
    const a = mutate.scene.enter(draft, 'self', 'Atk', {});
    selfUid = a.uid;
    const d = mutate.scene.enter(draft, 'opp', 'Def', {});
    oppUid = d.uid;
    if (opts.oppState === 'sleep') mutate.scene.setState(draft, d.uid, 'sleep');
    else if (opts.oppState === 'stun') mutate.scene.setState(draft, d.uid, 'stun');
    else if (opts.oppState === undefined) mutate.scene.setState(draft, d.uid, 'sleep');
    // ガード候補
    if (opts.guardActive) {
      const g = mutate.scene.enter(draft, 'opp', 'G', {});
      guardUid = g.uid;
    }
    const evCount = opts.oppEvidence ?? 0;
    for (let i = 0; i < evCount; i++) {
      draft.players.opp.evidence.push({
        cardId: `ev-${i}`,
        faceUp: false,
        origin: { turn: 0, via: 'opening' },
      });
    }
  });
  return { s, selfUid, oppUid, guardUid };
}

describe('engine.flow.action.declare', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetActionContexts();
    _resetUidCounter();
    resetDefRegistry();
  });

  it('declare emits action:declare with payload { byUid, target }', () => {
    const captured: { byUid: string; target: unknown }[] = [];
    event.on('action:declare', (_s, payload) => {
      captured.push(payload as { byUid: string; target: unknown });
    });
    const { s, selfUid, oppUid } = makeScene({});
    const out = produce(s, draft => {
      declare(draft, selfUid, { kind: 'char', uid: oppUid });
    });
    expect(captured.length).toBe(1);
    expect(captured[0].byUid).toBe(selfUid);
    expect(captured[0].target).toEqual({ kind: 'char', uid: oppUid });
    void out;
  });

  it('byUid is sleep after declare', () => {
    const { s, selfUid, oppUid } = makeScene({});
    const out = produce(s, draft => {
      declare(draft, selfUid, { kind: 'char', uid: oppUid });
    });
    const c = out.players.self.scene.find(c => c.uid === selfUid)!;
    expect(c.state).toBe('sleep');
  });

  it('declare transitions phase to guard-window', () => {
    const { s, selfUid, oppUid } = makeScene({});
    let ax: ActionContext | undefined;
    produce(s, draft => {
      ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
    });
    expect(ax?.phase).toBe('guard-window');
  });

  it('starts one public causal chain when declaring an action against a case', () => {
    const { s, selfUid } = makeScene({ oppEvidence: 1 });
    let ax: ActionContext | undefined;
    const out = produce(s, draft => {
      draft.players.opp.case.cardId = 'PRIVATE-CASE-ID';
      startCausalSession(draft, 'case-action');
      ax = declare(draft, selfUid, { kind: 'case', player: 'opp' });
    });

    const graph = validateCausalLog(out.log as CausalLogEntryV1[]);
    expect(graph.map((node) => [node.kind, node.parentEventId])).toEqual([
      ['declare', undefined],
      ['sleep', 'case-action:1'],
    ]);
    expect(graph[0]).toMatchObject({
      source: { kind: 'card', side: 'self', zone: 'scene' },
      targets: [{ kind: 'card', side: 'opp', zone: 'case' }],
    });
    expect(JSON.stringify(graph)).not.toContain('ev-0');
    expect(ax?.causalTrace).toMatchObject({
      rootEventId: 'case-action:1',
      tailEventId: 'case-action:2',
    });
  });
});

describe('engine.flow.action.tryGuard', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetActionContexts();
    _resetUidCounter();
    resetDefRegistry();
  });

  it('tryGuard sets guardUid + sleeps guard + emits action:guarded', () => {
    const captured: { byUid: string; guardUid: string; targetUid?: string }[] = [];
    event.on('action:guarded', (_s, payload) => {
      captured.push(payload as { byUid: string; guardUid: string; targetUid?: string });
    });
    const { s, selfUid, oppUid, guardUid } = makeScene({ guardActive: true });
    let ax: ActionContext | undefined;
    const out = produce(s, draft => {
      ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
      tryGuard(draft, ax, guardUid);
    });
    expect(ax?.guardUid).toBe(guardUid);
    expect(ax?.guarded?.guardUid).toBe(guardUid);
    expect(ax?.phase).toBe('leave-resolution');
    const g = out.players.opp.scene.find(c => c.uid === guardUid)!;
    expect(g.state).toBe('sleep');
    expect(captured.length).toBe(1);
    // engine additive A2 (2026-07-11, B04073): action:guarded payload に targetUid を同梱 (char 対象=oppUid)
    expect(captured[0]).toEqual({ byUid: selfUid, guardUid, targetUid: oppUid });
  });

  it('guarded case enters the full contact sequence against the guard', () => {
    const starts: { aUid: string; bUid: string }[] = [];
    event.on('contact:start', (_state, payload) => {
      starts.push(payload as { aUid: string; bUid: string });
    });
    const { s, selfUid, guardUid } = makeScene({ guardActive: true, oppEvidence: 1 });
    let ax: ActionContext | undefined;

    produce(s, draft => {
      ax = declare(draft, selfUid, { kind: 'case', player: 'opp' });
      tryGuard(draft, ax, guardUid);
      advance(draft, ax);
      expect(ax.phase).toBe('contact-pending');
      advance(draft, ax);
    });

    expect(ax?.phase).toBe('action-1');
    expect(ax?.firstUid).toBe(guardUid);
    expect(ax?.secondUid).toBe(selfUid);
    expect(starts).toEqual([{ aUid: selfUid, bUid: guardUid }]);
  });
});

describe('engine.flow.action.passGuard', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetActionContexts();
    _resetUidCounter();
    resetDefRegistry();
  });

  it('passGuard emits action:unguarded with payload { byUid, target } and advances to leave-resolution for char', () => {
    const captured: { byUid: string; target: unknown }[] = [];
    event.on('action:unguarded', (_s, payload) => {
      captured.push(payload as { byUid: string; target: unknown });
    });
    const { s, selfUid, oppUid } = makeScene({});
    let ax: ActionContext | undefined;
    produce(s, draft => {
      ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
      passGuard(draft, ax);
    });
    expect(ax?.phase).toBe('leave-resolution');
    expect(captured.length).toBe(1);
    expect(captured[0].byUid).toBe(selfUid);
    expect(captured[0].target).toEqual({ kind: 'char', uid: oppUid });
  });

  it('passGuard for case target advances to judge', () => {
    const { s, selfUid } = makeScene({ oppEvidence: 1 });
    let ax: ActionContext | undefined;
    produce(s, draft => {
      ax = declare(draft, selfUid, { kind: 'case', player: 'opp' });
      passGuard(draft, ax);
    });
    expect(ax?.phase).toBe('judge');
  });
});

describe('engine.flow.action.abortIfMissing', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetActionContexts();
    _resetUidCounter();
    resetDefRegistry();
  });

  it('clears every action context before writing a terminal result', () => {
    const { s, selfUid, oppUid } = makeScene({});
    const after = produce(s, draft => {
      declare(draft, selfUid, { kind: 'char', uid: oppUid });
      abortForTerminal(draft, 'opp', 'concede');
    });

    expect(after.actionContexts).toEqual({});
    expect(after.gameResult).toEqual({ winner: 'opp', reason: 'concede' });
  });

  it('byUid removed → action-end', () => {
    const { s, selfUid, oppUid } = makeScene({});
    let ax: ActionContext | undefined;
    produce(s, draft => {
      ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
      // 攻撃キャラを除去
      mutate.scene.removeToRemove(draft, selfUid, 'effect');
      abortIfMissing(draft, ax);
    });
    expect(ax?.phase).toBe('action-end');
  });

  it('target char removed → action-end', () => {
    const { s, selfUid, oppUid } = makeScene({});
    let ax: ActionContext | undefined;
    produce(s, draft => {
      ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
      // 対象を除去
      mutate.scene.removeToRemove(draft, oppUid, 'effect');
      abortIfMissing(draft, ax);
    });
    expect(ax?.phase).toBe('action-end');
  });

  it('passGuard aborts instead of opening the unguarded path when the target left first', () => {
    const unguarded: unknown[] = [];
    event.on('action:unguarded', (_state, payload) => {
      unguarded.push(payload);
    });
    const { s, selfUid, oppUid } = makeScene({});

    const after = produce(s, draft => {
      const ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
      mutate.scene.removeToRemove(draft, oppUid, 'effect');
      passGuard(draft, ax);
    });

    expect(after.actionContexts).toEqual({});
    expect(unguarded).toEqual([]);
  });

  it('tryGuard aborts before validating a guard when the declared target left first', () => {
    const guarded: unknown[] = [];
    event.on('action:guarded', (_state, payload) => {
      guarded.push(payload);
    });
    const { s, selfUid, oppUid, guardUid } = makeScene({ guardActive: true });

    const after = produce(s, draft => {
      const ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
      mutate.scene.removeToRemove(draft, oppUid, 'effect');
      tryGuard(draft, ax, guardUid);
    });

    expect(after.actionContexts).toEqual({});
    expect(after.players.opp.scene.find((card) => card.uid === guardUid)?.state).toBe('active');
    expect(guarded).toEqual([]);
  });

  it('abortIfMissing emits action:end with result aborted', () => {
    const captured: { byUid: string; result: string }[] = [];
    event.on('action:end', (_s, payload) => {
      captured.push(payload as { byUid: string; result: string });
    });
    const { s, selfUid, oppUid } = makeScene({});
    produce(s, draft => {
      const ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
      mutate.scene.removeToRemove(draft, selfUid, 'effect');
      abortIfMissing(draft, ax);
    });
    expect(captured.length).toBeGreaterThanOrEqual(1);
    expect(captured[captured.length - 1].result).toBe('aborted');
  });

  it('does not classify an aborted case action as contact', () => {
    const { s, selfUid } = makeScene({ oppEvidence: 1 });
    const after = produce(s, draft => {
      draft.players.opp.case.cardId = 'PRIVATE-CASE-ID';
      startCausalSession(draft, 'case-abort');
      const ax = declare(draft, selfUid, { kind: 'case', player: 'opp' });
      mutate.scene.removeToRemove(draft, selfUid, 'effect');
      abortIfMissing(draft, ax);
    });
    const graph = validateCausalLog(after.log as CausalLogEntryV1[]);
    const completion = graph.at(-1);

    expect(completion).toMatchObject({ kind: 'cancel' });
    expect(completion?.tags ?? []).not.toContain('contact');
  });

  it('does not classify a character action aborted before contact start as contact', () => {
    const { s, selfUid, oppUid } = makeScene();
    const after = produce(s, draft => {
      startCausalSession(draft, 'char-abort-before-contact');
      const ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
      mutate.scene.removeToRemove(draft, selfUid, 'effect');
      abortIfMissing(draft, ax);
    });
    const graph = validateCausalLog(after.log as CausalLogEntryV1[]);
    const completion = graph.at(-1);

    expect(completion).toMatchObject({ kind: 'cancel' });
    expect(completion?.tags ?? []).not.toContain('contact');
  });
});

describe('engine.flow.action.advance — 9-phase chain', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetActionContexts();
    _resetUidCounter();
    resetDefRegistry();
  });

  it('full chain: declared → guard-window → leave-resolution → contact-pending → action-1 → action-2 → judge → contact-end → action-end', () => {
    const { s, selfUid, oppUid } = makeScene({});
    let ax: ActionContext | undefined;
    produce(s, draft => {
      ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
      expect(ax.phase).toBe('guard-window');
      passGuard(draft, ax); // guard-window → leave-resolution
      expect(ax.phase).toBe('leave-resolution');
      advance(draft, ax); // leave-resolution → contact-pending
      expect(ax.phase).toBe('contact-pending');
      advance(draft, ax); // contact-pending → action-1 (emit contact:start, contact:order-set)
      expect(ax.phase).toBe('action-1');
      // 両方 acted
      ax.firstActed = true;
      ax.secondActed = true;
      advance(draft, ax); // action-1 → action-2
      expect(ax.phase).toBe('action-2');
      advance(draft, ax); // action-2 → judge (no redo)
      expect(ax.phase).toBe('judge');
      advance(draft, ax); // judge → contact-end
      expect(ax.phase).toBe('contact-end');
      advance(draft, ax); // contact-end → action-end
      expect(ax.phase).toBe('action-end');
    });
  });

  it('action-1-redo: firstActed=false + secondActed=true → redo', () => {
    const { s, selfUid, oppUid } = makeScene({});
    let ax: ActionContext | undefined;
    produce(s, draft => {
      ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
      passGuard(draft, ax);
      advance(draft, ax); // leave-resolution → contact-pending
      advance(draft, ax); // contact-pending → action-1
      ax.firstActed = false;
      ax.secondActed = true;
      advance(draft, ax); // action-1 → action-2
      advance(draft, ax); // action-2 → action-1-redo
      expect(ax.phase).toBe('action-1-redo');
      advance(draft, ax); // action-1-redo → judge
      expect(ax.phase).toBe('judge');
    });
  });

  it('no redo when both acted', () => {
    const { s, selfUid, oppUid } = makeScene({});
    let ax: ActionContext | undefined;
    produce(s, draft => {
      ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
      passGuard(draft, ax);
      advance(draft, ax); // → contact-pending
      advance(draft, ax); // → action-1
      ax.firstActed = true;
      ax.secondActed = true;
      advance(draft, ax); // → action-2
      advance(draft, ax); // → judge
      expect(ax.phase).toBe('judge');
    });
  });
});

describe('engine.flow.action.snapshotAP', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetActionContexts();
    _resetUidCounter();
    resetDefRegistry();
  });

  it('snapshotAP captures both APs + emits contact:before-judge', () => {
    const captured: { aUid: string; bUid: string; aAP: number; bAP: number }[] = [];
    event.on('contact:before-judge', (_s, payload) => {
      captured.push(payload as typeof captured[number]);
    });
    const { s, selfUid, oppUid } = makeScene({ selfAP: 2000, oppAP: 1500 });
    let ax: ActionContext | undefined;
    produce(s, draft => {
      ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
      passGuard(draft, ax);
      snapshotAP(draft, ax);
    });
    expect(ax?.apSnapshot?.aAP).toBe(2000);
    expect(ax?.apSnapshot?.bAP).toBe(1500);
    expect(ax?.apSnapshot?.aUid).toBe(selfUid);
    expect(ax?.apSnapshot?.bUid).toBe(oppUid);
    expect(captured.length).toBe(1);
    expect(captured[0]).toEqual({ aUid: selfUid, bUid: oppUid, aAP: 2000, bAP: 1500 });
  });
});

describe('engine.flow.action.computeOrder', () => {
  it('aAP < bAP → attacker first', () => {
    const r = computeOrder(500, 2000, { aUid: 'A', bUid: 'B' });
    expect(r.firstUid).toBe('A');
    expect(r.secondUid).toBe('B');
  });

  it('aAP > bAP → defender first', () => {
    const r = computeOrder(2000, 500, { aUid: 'A', bUid: 'B' });
    expect(r.firstUid).toBe('B');
    expect(r.secondUid).toBe('A');
  });

  it('aAP === bAP → defender (non-turn-player) first (rules/08)', () => {
    const r = computeOrder(1000, 1000, { aUid: 'A', bUid: 'B' });
    expect(r.firstUid).toBe('B'); // defender first on tie
    expect(r.secondUid).toBe('A');
  });
});

describe('engine.flow.action — contact:start / contact:order-set hooks', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetActionContexts();
    _resetUidCounter();
    resetDefRegistry();
  });

  it('contact:start emitted on contact-pending → action-1', () => {
    const captured: { aUid: string; bUid: string }[] = [];
    event.on('contact:start', (_s, payload) => {
      captured.push(payload as { aUid: string; bUid: string });
    });
    const { s, selfUid, oppUid } = makeScene({});
    produce(s, draft => {
      const ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
      passGuard(draft, ax);
      advance(draft, ax); // leave-resolution → contact-pending
      advance(draft, ax); // → action-1 (emit contact:start)
    });
    expect(captured.length).toBe(1);
    expect(captured[0]).toEqual({ aUid: selfUid, bUid: oppUid });
  });

  it('contact:order-set emitted with firstUid/secondUid', () => {
    const captured: { firstUid: string; secondUid: string }[] = [];
    event.on('contact:order-set', (_s, payload) => {
      captured.push(payload as { firstUid: string; secondUid: string });
    });
    const { s, selfUid, oppUid } = makeScene({ selfAP: 2000, oppAP: 1000 });
    produce(s, draft => {
      const ax = declare(draft, selfUid, { kind: 'char', uid: oppUid });
      passGuard(draft, ax);
      advance(draft, ax); // → contact-pending
      advance(draft, ax); // → action-1
    });
    expect(captured.length).toBe(1);
    // attacker AP > defender AP → defender first
    expect(captured[0].firstUid).toBe(oppUid);
    expect(captured[0].secondUid).toBe(selfUid);
  });
});

describe('engine.flow.action — partner attacker AP fix (rules/07)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetActionContexts();
    _resetUidCounter();
    resetDefRegistry();
  });

  function makePartnerScene(opts: { partnerAP?: number; defAP?: number } = {}): {
    s: GameState;
    defUid: string;
  } {
    _resetUidCounter();
    resetDefRegistry();
    registerCardDef(makeCard('PartnerCard', { kind: 'partner', ap: opts.partnerAP ?? 3000, lp: 2 }));
    registerCardDef(makeCard('Def', { ap: opts.defAP ?? 1000 }));
    const initial = createEmptyGameState();
    let defUid = '';
    const s = produce(initial, draft => {
      draft.players.self.partner.cardId = 'PartnerCard';
      draft.players.self.partner.state = 'active';
      draft.players.self.partner.location = 'partner-area';
      const d = mutate.scene.enter(draft, 'opp', 'Def', {});
      defUid = d.uid;
      mutate.scene.setState(draft, d.uid, 'sleep');
    });
    return { s, defUid };
  }

  it('snapshotAP correctly reads partner AP (not 0) when partner is attacker', () => {
    const { s, defUid } = makePartnerScene({ partnerAP: 3000, defAP: 1000 });
    let ax: ActionContext | undefined;
    produce(s, draft => {
      ax = declare(draft, 'partner:self', { kind: 'char', uid: defUid });
      passGuard(draft, ax);
      snapshotAP(draft, ax);
    });
    // Before fix: readChar.ap returned 0 for partner uid → aAP was 0
    expect(ax?.apSnapshot?.aAP).toBe(3000);
    expect(ax?.apSnapshot?.bAP).toBe(1000);
  });

  it('partner attacker with AP >= defender AP removes defender via judge', () => {
    const { s, defUid } = makePartnerScene({ partnerAP: 3000, defAP: 1000 });
    let defenderRemoved = false;
    const out = produce(s, draft => {
      const ax = declare(draft, 'partner:self', { kind: 'char', uid: defUid });
      passGuard(draft, ax);
      snapshotAP(draft, ax);
      const r = judge(draft, ax);
      defenderRemoved = r.defenderRemoved;
    });
    expect(defenderRemoved).toBe(true);
    // Defender is gone from scene
    expect(out.players.opp.scene.find(c => c.uid === defUid)).toBeUndefined();
  });
});
