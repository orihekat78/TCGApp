// Phase 4 Group B Task 4.6 — flow.actionCase
// rules: 10-action-event.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import {
  removeOpponentEvidenceTop,
  gainSelfEvidence,
} from '@/engine/flow/action-case';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, GameState, ActionContext, EvidenceCard } from '@/engine/types';

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
  oppEvidence?: number;
  selfDeck?: number;
}): { s: GameState; ax: ActionContext; selfUid: string } {
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(makeCard('Atk'));
  const initial = createEmptyGameState();
  let selfUid = '';
  const s = produce(initial, draft => {
    const a = mutate.scene.enter(draft, 'self', 'Atk', {});
    selfUid = a.uid;
    const evCount = opts.oppEvidence ?? 1;
    for (let i = 0; i < evCount; i++) {
      draft.players.opp.evidence.push({
        cardId: `ev-${i}`,
        faceUp: false,
        origin: { turn: 0, via: 'opening' },
      });
    }
    const dz = opts.selfDeck ?? 5;
    draft.players.self.deck = Array.from({ length: dz }, (_, i) => `d-${i}`);
  });
  const ax: ActionContext = {
    id: 'test-ax-1',
    byUid: selfUid,
    byPlayer: 'self',
    target: { kind: 'case', player: 'opp' },
    phase: 'judge',
    startedAt: { turn: 0, nano: 0 },
  };
  return { s, ax, selfUid };
}

describe('engine.flow.actionCase.removeOpponentEvidenceTop', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetUidCounter();
    resetDefRegistry();
  });

  it('opp.evidence loses 1 (top is removed)', () => {
    const { s, ax } = setupScene({ oppEvidence: 3 });
    expect(s.players.opp.evidence.length).toBe(3);
    const out = produce(s, draft => {
      removeOpponentEvidenceTop(draft, ax);
    });
    expect(out.players.opp.evidence.length).toBe(2);
    expect(out.players.opp.remove).toContain('ev-2'); // 最上部
  });

  it('removeOpponentEvidenceTop emits evidence:remove-by-action with { player, ev }', () => {
    const captured: { player: string; ev: EvidenceCard }[] = [];
    event.on('evidence:remove-by-action', (_s, payload) => {
      captured.push(payload as typeof captured[number]);
    });
    const { s, ax } = setupScene({ oppEvidence: 2 });
    produce(s, draft => {
      removeOpponentEvidenceTop(draft, ax);
    });
    expect(captured.length).toBe(1);
    expect(captured[0].player).toBe('opp');
    expect(captured[0].ev.cardId).toBe('ev-1');
  });

  it('returns undefined when opp.evidence is empty', () => {
    const { s, ax } = setupScene({ oppEvidence: 0 });
    let ret: EvidenceCard | undefined;
    produce(s, draft => {
      ret = removeOpponentEvidenceTop(draft, ax);
    });
    expect(ret).toBeUndefined();
  });
});

describe('engine.flow.actionCase.gainSelfEvidence', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetUidCounter();
    resetDefRegistry();
  });

  it('byPlayer.evidence +1 from deck top', () => {
    const { s, ax } = setupScene({ selfDeck: 5 });
    expect(s.players.self.evidence.length).toBe(0);
    const out = produce(s, draft => {
      gainSelfEvidence(draft, ax);
    });
    expect(out.players.self.evidence.length).toBe(1);
    expect(out.players.self.evidence[0].cardId).toBe('d-0');
    expect(out.players.self.evidence[0].faceUp).toBe(false);
    expect(out.players.self.evidence[0].origin.via).toBe('action-case');
  });

  it('works even after byUid removed from scene (rules/10)', () => {
    const { s, ax, selfUid } = setupScene({ selfDeck: 5 });
    const out = produce(s, draft => {
      // byUid を強制リムーブしてから gain
      mutate.scene.removeToRemove(draft, selfUid, 'effect');
      gainSelfEvidence(draft, ax);
    });
    // 攻撃キャラが現場を離れていても、証拠獲得は進める
    expect(out.players.self.evidence.length).toBe(1);
    expect(out.players.self.scene.find(c => c.uid === selfUid)).toBeUndefined();
  });

  it('skips when deck is empty (mutate.evidence.addFromDeck no-op)', () => {
    const { s, ax } = setupScene({ selfDeck: 0 });
    const out = produce(s, draft => {
      gainSelfEvidence(draft, ax);
    });
    expect(out.players.self.evidence.length).toBe(0);
  });
});
