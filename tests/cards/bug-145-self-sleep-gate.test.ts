// BUG-145 self-state micro-cluster (2026-06-15, BUG-313 follow-up):
// Matching triggered abilities fire even when their self-sleep cost cannot currently resolve.
// The optional is offered only when the source is active at effect resolution; sleep/stun suppress it.
// Printed listener conditions (partner color, turn owner, FILE count) remain ability.condition gates.
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { produce } from 'immer';
import { evalCond } from '@/engine/cond/eval';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _clearPendingEffectOptionalSide, _peekPendingEffectOptionalSide } from '@/engine/effect/resolve-picks';
import type { Condition, EffectCtx, GameState, CardDef } from '@/engine/types';
import { sceneChar, makeCtx } from '../helpers/fixtures';

import { PR138 } from '@/cards/pr-01/PR138';
import { PR144 } from '@/cards/pr-01/PR144';
import { B04049 } from '@/cards/ct-p04/B04049';
import { B09058 } from '@/cards/ct-p09/B09058';
import { B09058P } from '@/cards/ct-p09/B09058P';
import { B09057 } from '@/cards/ct-p09/B09057';
import { B06102 } from '@/cards/ct-p06/B06102';
import { B09065 } from '@/cards/ct-p09/B09065';
import { B09013 } from '@/cards/ct-p09/B09013';
import { B08058 } from '@/cards/ct-p08/B08058';
import { B08058P } from '@/cards/ct-p08/B08058P';
import { B04089 } from '@/cards/ct-p04/B04089';
import { B04089P } from '@/cards/ct-p04/B04089P';
import { B04092 } from '@/cards/ct-p04/B04092';
import { B04093 } from '@/cards/ct-p04/B04093';
import { B06090 } from '@/cards/ct-p06/B06090';
import { B06090P } from '@/cards/ct-p06/B06090P';
import { B07019 } from '@/cards/ct-p07/B07019';
import { B07068 } from '@/cards/ct-p07/B07068';
import { B07068P } from '@/cards/ct-p07/B07068P';
import { B09056 } from '@/cards/ct-p09/B09056';
import { B09056P } from '@/cards/ct-p09/B09056P';
import { B10070, B10070P } from '@/cards/ct-p10/B10070';
import { D10005 } from '@/cards/ct-d10/D10005';
import { D10006 } from '@/cards/ct-d10/D10006';
import { B04058 } from '@/cards/ct-p04/B04058';
import { PR028 } from '@/cards/pr-01/PR028';
import { PR032 } from '@/cards/pr-01/PR032';
import { B03070 } from '@/cards/ct-p03/B03070';
import { B03070P } from '@/cards/ct-p03/B03070P';
import { B05007 } from '@/cards/ct-p05/B05007';
import { B05007P } from '@/cards/ct-p05/B05007P';
import { B07008 } from '@/cards/ct-p07/B07008';
import { B08064 } from '@/cards/ct-p08/B08064';
import { B09038 } from '@/cards/ct-p09/B09038';
import { B09038P } from '@/cards/ct-p09/B09038P';
import { B09040 } from '@/cards/ct-p09/B09040';
import { B09040P } from '@/cards/ct-p09/B09040P';
import { B10005, B10005P } from '@/cards/ct-p10/B10005';
import { B10023, B10023P } from '@/cards/ct-p10/B10023';
import { B10029 } from '@/cards/ct-p10/B10029';
import { B10079 } from '@/cards/ct-p10/B10079';
import { ALL_CARDS } from '@/cards';

// [id, card, abilityIndex]. a1=index0, a2=index1.
const GATED: Array<[string, CardDef, number]> = [
  ['PR138', PR138, 0], ['PR144', PR144, 0], ['B09058', B09058, 0],
  ['B09058P', B09058P, 0], ['B09057', B09057, 0],
  ['B04049', B04049, 0], ['B06102', B06102, 0], ['B09065', B09065, 0],
  ['B08058', B08058, 1], ['B08058P', B08058P, 1],
  ['B04089', B04089, 0], ['B04089P', B04089P, 0], ['B04092', B04092, 0], ['B04093', B04093, 0],
  ['B06090', B06090, 0], ['B06090P', B06090P, 0], ['B07019', B07019, 0],
  ['B07068', B07068, 0], ['B07068P', B07068P, 0],
  ['B09056', B09056, 0], ['B09056P', B09056P, 0],
  ['B10070', B10070, 1], ['B10070P', B10070P, 1], ['D10005', D10005, 0], ['D10006', D10006, 0],
  ['B05007', B05007, 0], ['B05007P', B05007P, 0], ['B07008', B07008, 1], ['B08064', B08064, 0],
  ['B09038', B09038, 1], ['B09038P', B09038P, 1], ['B09040', B09040, 0], ['B09040P', B09040P, 0],
  ['B10005', B10005, 1], ['B10005P', B10005P, 1], ['B10023', B10023, 0], ['B10023P', B10023P, 0],
  ['B10029', B10029, 0], ['B10079', B10079, 1],
  ['B04058', B04058, 0], ['PR028', PR028, 0], ['PR032', PR032, 0],
  ['B03070', B03070, 0], ['B03070P', B03070P, 0], ['B09013', B09013, 1],
];

function isSelfSleepOptional(effect: unknown): boolean {
  if (!effect || typeof effect !== 'object') return false;
  const optional = effect as {
    kind?: string;
    effect?: unknown;
  };
  if (optional.kind !== 'optional') return false;
  let first = optional.effect as { kind?: string; steps?: unknown[] } | undefined;
  while (first && (first.kind === 'chain' || first.kind === 'sequence')) {
    first = first.steps?.[0] as typeof first;
  }
  const atom = first as {
    kind?: string;
    verb?: string;
    args?: { uid?: string; state?: string };
  } | undefined;
  return atom?.kind === 'atom' && atom.verb === 'sceneSetState'
    && atom.args?.uid === '$self' && atom.args?.state === 'sleep';
}

function collectSelfSleepOptionalPaths(effect: unknown, path = 'effect'): string[] {
  if (!effect || typeof effect !== 'object') return [];
  const node = effect as {
    kind?: string;
    effect?: unknown;
    then?: unknown;
    else?: unknown;
    steps?: unknown[];
    options?: unknown[];
  };
  const paths = isSelfSleepOptional(node) ? [path] : [];
  if (node.effect) paths.push(...collectSelfSleepOptionalPaths(node.effect, `${path}.effect`));
  if (node.then) paths.push(...collectSelfSleepOptionalPaths(node.then, `${path}.then`));
  if (node.else) paths.push(...collectSelfSleepOptionalPaths(node.else, `${path}.else`));
  node.steps?.forEach((step, index) => paths.push(...collectSelfSleepOptionalPaths(step, `${path}.steps[${index}]`)));
  node.options?.forEach((option, index) => paths.push(...collectSelfSleepOptionalPaths(option, `${path}.options[${index}]`)));
  return paths;
}

function hasSelfStateGate(c: unknown): boolean {
  if (!c || typeof c !== 'object') return false;
  const cc = c as { kind?: string; c?: unknown; cs?: unknown[]; ref?: { kind?: string }; state?: string };
  if (cc.kind === 'charStateIs' && cc.ref?.kind === 'self') return true;
  if (cc.kind === 'and' && Array.isArray(cc.cs)) return cc.cs.some(hasSelfStateGate);
  if (cc.kind === 'or' && Array.isArray(cc.cs)) return cc.cs.some(hasSelfStateGate);
  if (cc.c) return hasSelfStateGate(cc.c);
  return false;
}

function hasSelfActiveGate(c: unknown): boolean {
  if (!c || typeof c !== 'object') return false;
  const cc = c as { kind?: string; c?: unknown; cs?: unknown[]; ref?: { kind?: string }; state?: string };
  if (cc.kind === 'charStateIs' && cc.ref?.kind === 'self' && cc.state === 'active') return true;
  if ((cc.kind === 'and' || cc.kind === 'or') && Array.isArray(cc.cs)) return cc.cs.some(hasSelfActiveGate);
  if (cc.c) return hasSelfActiveGate(cc.c);
  return false;
}

function resolutionGate(card: CardDef, idx: number): Condition {
  const effect = card.abilities[idx]!.effect as {
    kind: string;
    if?: Condition;
    then?: { kind?: string };
  };
  expect(effect.kind).toBe('conditional');
  expect(hasSelfActiveGate(effect.if)).toBe(true);
  expect(effect.then?.kind).toBe('optional');
  const findActive = (condition: Condition): Condition | undefined => {
    if (condition.kind === 'charStateIs' && condition.ref.kind === 'self' && condition.state === 'active') {
      return condition;
    }
    if (condition.kind === 'and' || condition.kind === 'or') {
      for (const child of condition.cs) {
        const found = findActive(child);
        if (found) return found;
      }
    }
    if (condition.kind === 'not') return findActive(condition.c);
    return undefined;
  };
  return findActive(effect.if!)!;
}

function ctxForSelf(uid: string, cardId: string): EffectCtx {
  return makeCtx({ source: { player: 'self', cardId, abilityId: 'a', uid } as EffectCtx['source'] });
}

describe('BUG-145 — charStateIs プリミティブ (self の状態判定)', () => {
  it.each(['active', 'sleep', 'stun'] as const)('charStateIs(ref:self) が self=%s を正しく判定', (st) => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('X', 'u0', { state: st })];
    const ctx = ctxForSelf('u0', 'X');
    for (const probe of ['active', 'sleep', 'stun'] as const) {
      const cond: Condition = { kind: 'charStateIs', ref: { kind: 'self' }, state: probe };
      expect(evalCond(s, cond, ctx), `charStateIs(${probe}) when self=${st}`).toBe(probe === st);
    }
    const gate: Condition = { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' };
    expect(evalCond(s, gate, ctx), `resolution gate when self=${st}`).toBe(st === 'active');
  });
});

describe('BUG-145 — 45印刷は mandatory trigger と resolution-time active gate を分離する', () => {
  it('全CardDefの self-sleep optional footprint を列挙し、未審査の同型を残さない', () => {
    const detected = ALL_CARDS.flatMap((card) => card.abilities.flatMap((ability) => (
      collectSelfSleepOptionalPaths(ability.effect).map((path) => `${card.id}:${ability.id}:${path}`)
    ))).sort();
    const reviewed = GATED.map(([id, card, idx]) => `${id}:${card.abilities[idx]!.id}:effect.then`).sort();
    expect(detected).toEqual(reviewed);
  });

  it.each(GATED)('%s: self-state は ability.condition でなく effect.conditional が所有する', (id, card, idx) => {
    expect(hasSelfStateGate(card.abilities[idx]!.condition), `${id} listener gate`).toBe(false);
    const gate = resolutionGate(card, idx);
    for (const state of ['active', 'sleep', 'stun'] as const) {
      const s = createEmptyGameState();
      s.players.self.scene = [sceneChar(id, 'source', { state })];
      s.players.self.hand = ['HAND'];
      expect(evalCond(s, gate, ctxForSelf('source', id)), `${id} at ${state}`).toBe(state === 'active');
    }
  });
});

describe('BUG-145 — 実パイプライン: PR138 はtrigger時にqueueし、解決時stateでoptionalを決める', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    _clearPendingEffectOptionalSide();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    registerCardDef(PR138);
    registerCardDef({ id: 'KZ6', no: 'NO', kind: 'character', names: ['KZ6'], colors: ['黒'], level: 6, ap: 4000, lp: 1, traits: ['黒ずくめの組織'], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as CardDef);
    registerTriggeredListener();
  });

  afterEach(() => {
    _clearPendingEffectOptionalSide();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  function emitEnter(selfState: 'active' | 'sleep' | 'stun'): GameState {
    let s = createEmptyGameState();
    s.players.self.scene = [sceneChar('PR138', 'pr0', { state: selfState })];
    s.players.self.hand = ['HANDX'];
    s.players.self.remove = ['KZ6'];
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'pr0', viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'PR138', uid: 'pr0' });
    });
    return s;
  }

  it.each(['active', 'sleep', 'stun'] as const)('trigger時self=%sでも PR138 a1 を必ずqueueする', (state) => {
    const s = emitEnter(state);
    const queued = s.pendingEffects.filter((p) => p.triggeredBy?.hook === 'enter' && p.source?.cardId === 'PR138');
    expect(queued).toHaveLength(1);
  });

  it.each(['sleep', 'stun'] as const)('activeでqueue後、解決前に%sならoptionalを出さない', (state) => {
    const s = produce(emitEnter('active'), (draft) => {
      draft.players.self.scene[0]!.state = state;
      runAllUntilEmpty(draft);
    });
    expect(_peekPendingEffectOptionalSide()).toBeNull();
    expect(s.pendingEffects.some((p) => p.source?.cardId === 'PR138' && (
      p.status === 'pending' || p.status === 'resolving'
    ))).toBe(false);
  });

  it('sleepでqueue後、解決前にactiveならoptionalを出す', () => {
    produce(emitEnter('sleep'), (draft) => {
      draft.players.self.scene[0]!.state = 'active';
      runAllUntilEmpty(draft);
    });
    expect(_peekPendingEffectOptionalSide()?.source).toMatchObject({
      cardId: 'PR138', abilityId: 'a1', uid: 'pr0',
    });
  });
});

describe('BUG-145 — sequence tail も non-active source では実行しない', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    _clearPendingEffectOptionalSide();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    registerCardDef(B05007);
    registerTriggeredListener();
  });

  afterEach(() => {
    _clearPendingEffectOptionalSide();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it.each(['sleep', 'stun'] as const)('B05007 が %s でも発動済みだが、optionalと独立draw tailを抑止する', (state) => {
    const game = createEmptyGameState();
    game.players.self.scene = [sceneChar('B05007', 'source', { state })];
    game.players.self.deck = ['DRAW', 'REST'];
    event.emit(
      game,
      'enter',
      { uid: 'source', viaEffect: false, enterOrder: 1, enterOrderThisTurn: 1 },
      { player: 'self', cardId: 'B05007', uid: 'source' },
    );
    expect(game.pendingEffects.filter((entry) => entry.source?.cardId === 'B05007')).toHaveLength(1);
    runAllUntilEmpty(game);
    expect(_peekPendingEffectOptionalSide()).toBeNull();
    expect(game.players.self.hand).toEqual([]);
    expect(game.players.self.deck).toEqual(['DRAW', 'REST']);
  });

  it('B05007 がactiveなら解決時にoptionalを公開する', () => {
    const game = createEmptyGameState();
    game.players.self.scene = [sceneChar('B05007', 'source')];
    event.emit(
      game,
      'enter',
      { uid: 'source', viaEffect: false, enterOrder: 1, enterOrderThisTurn: 1 },
      { player: 'self', cardId: 'B05007', uid: 'source' },
    );
    runAllUntilEmpty(game);
    expect(_peekPendingEffectOptionalSide()?.source).toMatchObject({
      cardId: 'B05007', abilityId: 'a1', uid: 'source',
    });
  });
});

describe('B09013 a2 — 非activeでも発動済み・【ターン1】消費', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    _clearPendingEffectOptionalSide();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    registerCardDef(B09013);
    registerCardDef({
      id: 'KOGORO', no: 'NO', kind: 'character', names: ['毛利小五郎'], colors: ['青'],
      level: 7, ap: 8000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    } as CardDef);
    registerTriggeredListener();
  });

  afterEach(() => {
    _clearPendingEffectOptionalSide();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  function declare(state: GameState): GameState {
    return produce(state, (draft) => {
      event.emit(
        draft,
        'action:declare',
        { byUid: 'actor', target: { kind: 'event' }, uid: 'actor', player: 'self' },
        { player: 'self', uid: 'actor' },
      );
      runAllUntilEmpty(draft);
    });
  }

  it.each(['sleep', 'stun'] as const)('%s 中も発動済み、active 復帰後の同ターン再発動なし', (state) => {
    const initial = createEmptyGameState();
    initial.players.self.scene = [
      sceneChar('B09013', 'eri', { state }),
      sceneChar('KOGORO', 'actor'),
    ];

    const first = declare(initial);
    expect(_peekPendingEffectOptionalSide(), `${state} 中は optional を実行不能`).toBeNull();
    expect(readChar.declaredUseCount(first, 'eri', 'a2'), `${state} 中でも発動済み`).toBe(1);

    const second = declare(produce(first, (draft) => {
      draft.players.self.scene.find((c) => c.uid === 'eri')!.state = 'active';
    }));
    expect(_peekPendingEffectOptionalSide(), '同ターンの再発動なし').toBeNull();
    expect(readChar.declaredUseCount(second, 'eri', 'a2')).toBe(1);
  });
});

describe('BUG-145 — printed listener conditions は維持する', () => {
  it('partner/turn/FILE conditions は self-state gate と混ざらない', () => {
    expect(B04049.abilities[0]!.condition).toEqual({ kind: 'partnerColor', color: '赤' });
    expect(B06102.abilities[0]!.condition).toEqual({ kind: 'turn', player: 'self' });
    expect(B09065.abilities[0]!.condition).toEqual({ kind: 'turn', player: 'self' });
    expect(B08058.abilities[1]!.condition).toEqual({ kind: 'fileAtLeast', n: 8 });
    expect(B08058P.abilities[1]!.condition).toEqual({ kind: 'fileAtLeast', n: 8 });
  });

  it('追加13印刷の printed conditions だけを listener gate に残す', () => {
    expect(B04089.abilities[0]!.condition).toEqual({
      kind: 'and',
      cs: [
        { kind: 'partnerColor', color: '黒' },
        { kind: 'turn', player: 'self' },
        { kind: 'removedCharMatches', side: 'opp', cause: 'effect', byPlayer: 'self' },
      ],
    });
    expect(B04092.abilities[0]!.condition).toBeUndefined();
    expect(B04093.abilities[0]!.condition).toBeUndefined();
    expect(B06090.abilities[0]!.condition).toBeUndefined();
    expect(B07019.abilities[0]!.condition).toEqual({
      kind: 'and',
      cs: [
        { kind: 'caseStatus', status: '解決編' },
        { kind: 'enterSource', viaEffect: true, sourceFilter: { kind: 'event', color: '緑' } },
      ],
    });
    expect(B07068.abilities[0]!.condition).toEqual({ kind: 'partnerColor', color: '赤' });
    expect(B09056.abilities[0]!.condition).toEqual({
      kind: 'and',
      cs: [
        { kind: 'caseColor', color: ['赤', '黒'], combine: 'and' },
        { kind: 'partnerColor', color: '赤' },
      ],
    });
    expect(B10070.abilities[1]!.condition).toBeUndefined();
    expect(D10005.abilities[0]!.condition).toEqual({ kind: 'caseTrait', trait: 'シャッフルロマンス' });
    expect(D10006.abilities[0]!.condition).toEqual({ kind: 'caseTrait', trait: 'シャッフルロマンス' });
  });

  it('B06102: self=active かつ自分ターン → condition = true', () => {
    const s = createEmptyGameState();
    s.turn = { number: 4, player: 'self', phase: 'end', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B06102', 'b0', { state: 'active' })];
    const ctx = ctxForSelf('b0', 'B06102');
    expect(evalCond(s, B06102.abilities[0]!.condition!, ctx)).toBe(true);
  });
  it('B06102: self=active だが相手ターン → condition = false', () => {
    const s = createEmptyGameState();
    s.turn = { number: 4, player: 'opp', phase: 'end', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B06102', 'b0', { state: 'active' })];
    const ctx = ctxForSelf('b0', 'B06102');
    expect(evalCond(s, B06102.abilities[0]!.condition!, ctx)).toBe(false);
  });
});

describe('B10029 a1 — printed scene condition も effect resolution 時に評価する', () => {
  const HEIJI: CardDef = {
    id: 'HEIJI', no: 'NO', kind: 'character', names: ['服部平次'], colors: ['緑'],
    level: 4, ap: 4000, lp: 1, traits: ['高校生'], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };

  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    _clearPendingEffectOptionalSide();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    registerCardDef(B10029);
    registerCardDef(HEIJI);
    registerTriggeredListener();
  });

  afterEach(() => {
    _clearPendingEffectOptionalSide();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  function emitEnter(game: GameState): void {
    event.emit(
      game,
      'enter',
      { uid: 'source', viaEffect: false, enterOrder: 0, enterOrderThisTurn: 0 },
      { player: 'self', cardId: 'B10029', abilityId: 'a1', uid: 'source' },
    );
  }

  it('trigger 時に対象名が不在でも queue し、解決前に登場すれば optional を公開する', () => {
    const game = createEmptyGameState();
    game.players.self.scene = [sceneChar('B10029', 'source')];
    emitEnter(game);
    expect(game.pendingEffects.filter((entry) => entry.source?.cardId === 'B10029')).toHaveLength(1);
    game.players.self.scene.push(sceneChar('HEIJI', 'heiji'));
    runAllUntilEmpty(game);
    expect(_peekPendingEffectOptionalSide()?.source).toMatchObject({
      cardId: 'B10029', abilityId: 'a1', uid: 'source',
    });
  });

  it('trigger 時に対象名がいても解決前に離れれば optional を公開しない', () => {
    const game = createEmptyGameState();
    game.players.self.scene = [sceneChar('B10029', 'source'), sceneChar('HEIJI', 'heiji')];
    emitEnter(game);
    expect(game.pendingEffects.filter((entry) => entry.source?.cardId === 'B10029')).toHaveLength(1);
    game.players.self.scene = game.players.self.scene.filter((entry) => entry.uid !== 'heiji');
    runAllUntilEmpty(game);
    expect(_peekPendingEffectOptionalSide()).toBeNull();
  });
});
