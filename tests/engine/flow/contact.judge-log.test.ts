// Phase 8.10e: contact.judge log integration tests
//
// rules: 08-contact.md (AP 判定の挙動)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, GameState } from '@/engine/types';

import { resolveActionAgainstChar } from '@/ai/action-resolution';
import { HeuristicPolicy } from '@/ai/policies/heuristic';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id,
    kind: opts.kind ?? 'character',
    names: opts.names ?? [id], colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1,
    ap: opts.ap ?? 1000, lp: opts.lp ?? 1000,
    traits: opts.traits ?? [], rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '', abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

function setupBase(): GameState {
  return produce(createEmptyGameState(), (d) => {
    mutate.partner.init(d, 'self', 'P-SELF');
    mutate.partner.init(d, 'opp', 'P-OPP');
    mutate.case.init(d, 'self', 'CASE-SELF', ['赤']);
    mutate.case.init(d, 'opp', 'CASE-OPP', ['青']);
    d.turn.player = 'self';
    d.turn.phase = 'main';
  });
}

beforeEach(() => {
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(makeCard('P-SELF', { kind: 'partner', ap: 1500 }));
  registerCardDef(makeCard('P-OPP', { kind: 'partner', ap: 1500 }));
  registerCardDef(makeCard('CASE-SELF', { kind: 'case' }));
  registerCardDef(makeCard('CASE-OPP', { kind: 'case' }));
});

describe('Phase 8.10e: contact.judge logs result', () => {
  it('attacker AP >= defender AP → log includes contact-judge with result="hit"', () => {
    registerCardDef(makeCard('Atk', { ap: 2000, lp: 1 }));
    registerCardDef(makeCard('Def', { ap: 1000, lp: 1 }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'Atk', { active: true });
      mutate.scene.enter(d, 'opp', 'Def', { active: false });
    });
    const atk = s.players.self.scene[0].uid;
    const def = s.players.opp.scene[0].uid;
    const after = produce(s, (d) => {
      resolveActionAgainstChar(d, atk, def, new HeuristicPolicy());
    });
    const judgeEntry = after.log.find((e) => e.action === 'contact-judge');
    expect(judgeEntry).toBeDefined();
    // 2026-05-25 拡張: 最終 AP 詳細 + 勝敗を含む format に変更
    expect(judgeEntry?.result).toMatch(/HIT/);
    expect(judgeEntry?.result).toMatch(/AP2000/);
    expect(judgeEntry?.result).toMatch(/AP1000/);
  });

  it('attacker AP < defender AP → log includes contact-judge with MISS detail', () => {
    registerCardDef(makeCard('WeakAtk', { ap: 800, lp: 1 }));
    registerCardDef(makeCard('StrongDef', { ap: 2000, lp: 1 }));
    const s = produce(setupBase(), (d) => {
      mutate.scene.enter(d, 'self', 'WeakAtk', { active: true });
      mutate.scene.enter(d, 'opp', 'StrongDef', { active: false });
    });
    const atk = s.players.self.scene[0].uid;
    const def = s.players.opp.scene[0].uid;
    const after = produce(s, (d) => {
      resolveActionAgainstChar(d, atk, def, new HeuristicPolicy());
    });
    const judgeEntry = after.log.find((e) => e.action === 'contact-judge');
    expect(judgeEntry).toBeDefined();
    // 2026-05-25 拡張: 最終 AP 詳細 + 勝敗を含む format
    expect(judgeEntry?.result).toMatch(/MISS/);
    expect(judgeEntry?.result).toMatch(/AP800/);
    expect(judgeEntry?.result).toMatch(/AP2000/);
  });
});
