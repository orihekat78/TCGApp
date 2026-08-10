// Phase 4 Task 4.3 — flow.main.runNextHint
// rules: 12-next-hint.md, 20-color-and-switch.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { canStartNextHint, runNextHint } from '@/engine/flow/main/next-hint';
import { event } from '@/engine/event/index';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, CausalLogEntryV1, GameState } from '@/engine/types';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: opts.kind ?? 'event',
    names: opts.names ?? [id],
    colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1,
    traits: opts.traits ?? [],
    rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '',
    abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

function makeStateWithFile(n: number, opts: { caseColors?: string[]; hand?: string[] } = {}): GameState {
  const initial = createEmptyGameState();
  return produce(initial, draft => {
    draft.players.self.case.colors = opts.caseColors ?? ['赤'];
    draft.players.self.case.cardId = 'CASE';
    for (let i = 0; i < n; i++) {
      // Round 3: FileCard.card-back に cardId 必須 (placeholder で OK)
      draft.players.self.file.push({ type: 'card-back', cardId: `FILE_${i}` });
    }
    draft.players.self.hand = opts.hand ?? [];
  });
}

describe('engine.flow.main.runNextHint', () => {
  beforeEach(() => {
    event._resetRegistry();
    resetDefRegistry();
  });

  it('FILE ≥ 1 で canStartNextHint=true', () => {
    const s = makeStateWithFile(1);
    expect(canStartNextHint(s, 'self')).toBe(true);
  });

  it('FILE=0 で canStartNextHint=false', () => {
    const s = makeStateWithFile(0);
    expect(canStartNextHint(s, 'self')).toBe(false);
  });

  it('FILE 最上部のカードを手札に加え、フラグをセットする (Round 3: 実 cardId)', () => {
    const s = makeStateWithFile(3);
    const after = produce(s, draft => {
      runNextHint(draft, 'self');
    });
    expect(after.players.self.file).toHaveLength(2);
    // Round 3: 旧 'card-back' placeholder → 実 cardId (FILE_2 = 最後に push されたもの)
    expect(after.players.self.hand).toContain('FILE_2');
    expect(after.turnState.self.nextHintUsed).toBe(true);
  });

  it('公開因果列に FILE→手札だけを記録し、裏向きカードIDは公開しない', () => {
    const s = makeStateWithFile(2);

    const after = produce(s, draft => {
      startCausalSession(draft, 'next-hint-file-only');
      runNextHint(draft, 'self');
    });
    const graph = validateCausalLog(after.log as CausalLogEntryV1[]);

    expect(graph.map(node => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['zone-move', 'next-hint-file-only:1', { type: 'move', from: 'file', to: 'hand', count: 1 }],
      ['summary', 'next-hint-file-only:2', { type: 'state', state: 'success' }],
    ]);
    expect(JSON.stringify(graph)).not.toContain('FILE_1');
  });

  it('canStartNextHint=false で runNextHint → throw', () => {
    const s = makeStateWithFile(0);
    expect(() =>
      produce(s, draft => {
        runNextHint(draft, 'self');
      }),
    ).toThrow(/not startable/);
  });

  it('optionalCardId で 1 枚追加使用する (effect:declared 発火)', () => {
    registerCardDef(makeCard('EV1', { colors: ['赤'], level: 1 }));
    let fired = 0;
    event.on('effect:declared', (_s, payload) => {
      const p = payload as { kind: string };
      // Round 4b: kind は 'event-use' / 'character-use' に分離 (eventRemoveByAP matcher 整合)
      if (p && (p.kind === 'event-use' || p.kind === 'character-use')) fired++;
    });
    const s = makeStateWithFile(2, { hand: ['EV1'] });
    const after = produce(s, draft => {
      runNextHint(draft, 'self', 'EV1');
    });
    expect(fired).toBe(1);
    expect(after.turnState.self.nextHintUsed).toBe(true);
  });

  it('キャラを optionalCardId で使用すると 現場に登場 + enter Hook 発火 (viaEffect:false, named)', () => {
    // rules/12: ネクストヒントで登場するキャラは アクティブ状態 + 同ターン登場 (名乗り)
    registerCardDef(makeCard('CH1', { kind: 'character', colors: ['赤'], level: 1 }));
    let entered: { uid: string; viaEffect: boolean; enterOrder: number } | undefined;
    event.on('enter', (_s, payload) => {
      entered = payload as typeof entered;
    });
    const s = makeStateWithFile(2, { hand: ['CH1'] });
    const after = produce(s, draft => {
      runNextHint(draft, 'self', 'CH1');
    });
    expect(after.players.self.scene).toHaveLength(1);
    expect(after.players.self.scene[0].cardId).toBe('CH1');
    expect(after.players.self.scene[0].isNamed).toBe(true);
    expect(after.players.self.scene[0].state).toBe('active');
    expect(after.players.self.hand).not.toContain('CH1');
    expect(entered).toBeDefined();
    expect(entered!.viaEffect).toBe(false);
    expect(entered!.uid).toMatch(/^CH1#\d+$/);
  });

  it('任意キャラ使用を FILE→手札→使用→手札→現場→登場の因果列として記録する', () => {
    registerCardDef(makeCard('CH1', { kind: 'character', colors: ['赤'], level: 1 }));
    const s = makeStateWithFile(2, { hand: ['CH1'] });

    const after = produce(s, draft => {
      startCausalSession(draft, 'next-hint-character');
      runNextHint(draft, 'self', 'CH1');
    });
    const graph = validateCausalLog(after.log as CausalLogEntryV1[]);

    expect(graph.map(node => [node.kind, node.parentEventId, node.outcome])).toEqual([
      ['declare', undefined, { type: 'state', state: 'active' }],
      ['zone-move', 'next-hint-character:1', { type: 'move', from: 'file', to: 'hand', count: 1 }],
      ['use', 'next-hint-character:2', { type: 'state', state: 'active' }],
      ['zone-move', 'next-hint-character:3', { type: 'move', from: 'hand', to: 'scene', count: 1 }],
      ['enter', 'next-hint-character:4', { type: 'state', state: 'success' }],
      ['summary', 'next-hint-character:5', { type: 'state', state: 'success' }],
    ]);
    expect(graph[4]).toMatchObject({
      source: { kind: 'player', side: 'self' },
      targets: [{ kind: 'card', side: 'self', zone: 'scene', cardNumber: 'CH1' }],
    });
    expect(JSON.stringify(graph)).not.toContain('FILE_1');
  });

  it('イベントを optionalCardId で使用しても enter Hook は emit しない', () => {
    registerCardDef(makeCard('EV1', { kind: 'event', colors: ['赤'], level: 1 }));
    let entered = false;
    event.on('enter', () => { entered = true; });
    const s = makeStateWithFile(2, { hand: ['EV1'] });
    produce(s, draft => {
      runNextHint(draft, 'self', 'EV1');
    });
    expect(entered).toBe(false);
  });

  it('optionalCardId が手札にない → throw', () => {
    const s = makeStateWithFile(2);
    expect(() =>
      produce(s, draft => {
        runNextHint(draft, 'self', 'NONEXISTENT');
      }),
    ).toThrow(/not in self hand/);
  });

  it('optionalCardId 色違反 → throw (rules/20)', () => {
    registerCardDef(makeCard('EV1', { colors: ['青'], level: 1 }));
    const s = makeStateWithFile(2, { caseColors: ['赤'], hand: ['EV1'] });
    expect(() =>
      produce(s, draft => {
        runNextHint(draft, 'self', 'EV1');
      }),
    ).toThrow(/color violates/);
  });

  it('optionalCardId レベル超過 → throw (rules/12)', () => {
    // FILE=2 だが、1 枚 popした後で 1 枚に減るので、level 2 のカードは使用不可
    registerCardDef(makeCard('EV2', { colors: ['赤'], level: 2 }));
    const s = makeStateWithFile(2, { hand: ['EV2'] });
    expect(() =>
      produce(s, draft => {
        runNextHint(draft, 'self', 'EV2');
      }),
    ).toThrow(/level/);
  });

  it('アシスト中パートナーのみ FILE にあれば canStartNextHint=false', () => {
    const s = makeStateWithFile(0);
    const s1 = produce(s, draft => {
      draft.players.self.file.push({ type: 'assisted-partner', cardId: 'P-SELF' });
    });
    expect(canStartNextHint(s1, 'self')).toBe(false);
  });
});
