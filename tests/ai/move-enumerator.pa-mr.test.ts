// M3 PA batch (2026-07-10): AI 側 declaredAbility 列挙に partnerAreaMR source を追加
// rules: 18-mr.md §パートナーエリアにいるMRキャラ / 21-declared-ability-cost.md
// BUG-084 同型: UI 側 enumDeclaredAbilitySources と AI enumerateMoves の source 非対称を防ぐ。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { event } from '@/engine/event/index';
import type { CardDef, GameState, AbilityDef } from '@/engine/types';
import { enumerateMoves } from '@/ai/move-enumerator';
import { makeChar } from '../helpers/fixtures';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id,
    kind: opts.kind ?? 'character',
    names: opts.names ?? [id], colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1,
    ap: opts.ap ?? 1000, lp: opts.lp ?? 1000,
    traits: opts.traits ?? [], rarity: opts.rarity ?? 'MR',
    imageUrl: opts.imageUrl ?? '', abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

function makeDecl(id: string, scope: AbilityDef['scope']): AbilityDef {
  return { id, name: id, type: 'declared', scope, description: '' } as AbilityDef;
}

function makeBaseState(paMrCardId: string | null): GameState {
  return produce(createEmptyGameState(), (draft) => {
    mutate.partner.init(draft, 'self', 'P-SELF');
    mutate.partner.init(draft, 'opp', 'P-OPP');
    mutate.case.init(draft, 'self', 'CASE-SELF', ['赤']);
    mutate.case.init(draft, 'opp', 'CASE-OPP', ['青']);
    draft.turn.player = 'self';
    draft.turn.phase = 'main';
    draft.turn.number = 1;
    if (paMrCardId) {
      draft.players.self.partnerAreaMR = makeChar({ cardId: paMrCardId, uid: 'partnerMR:self' });
    }
  });
}

beforeEach(() => {
  event._resetRegistry();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(makeCard('P-SELF', { kind: 'partner', rarity: 'C' }));
  registerCardDef(makeCard('P-OPP', { kind: 'partner', rarity: 'C' }));
  registerCardDef(makeCard('CASE-SELF', { kind: 'case', rarity: 'C' }));
  registerCardDef(makeCard('CASE-OPP', { kind: 'case', rarity: 'C' }));
});

describe('enumerateMoves — partnerAreaMR declaredAbility (rules/18)', () => {
  it('PA-MR の scope on-partner-area 宣言能力を declaredAbility move として列挙', () => {
    registerCardDef(makeCard('MR1', { abilities: [makeDecl('a1', 'on-partner-area')] }));
    const s = makeBaseState('MR1');
    const moves = enumerateMoves(s, 'self');
    expect(moves).toContainEqual({ kind: 'declaredAbility', uid: 'partnerMR:self', abilityId: 'a1' });
  });

  it('scope on-scene のみの PA-MR は列挙しない (decoy: engine scope gate)', () => {
    registerCardDef(makeCard('MR2', { abilities: [makeDecl('a1', 'on-scene')] }));
    const s = makeBaseState('MR2');
    const moves = enumerateMoves(s, 'self');
    expect(moves.filter((m) => m.kind === 'declaredAbility' && m.uid === 'partnerMR:self')).toEqual([]);
  });

  it('partnerAreaMR 空 → partnerMR move なし', () => {
    const s = makeBaseState(null);
    const moves = enumerateMoves(s, 'self');
    expect(moves.filter((m) => m.kind === 'declaredAbility' && m.uid === 'partnerMR:self')).toEqual([]);
  });
});
