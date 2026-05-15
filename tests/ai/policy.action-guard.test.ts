// Phase 8.7c: policy.applyMove での actionAgainstChar ガード判定統合テスト。
//
// rules: 07-action-flow.md / 08-contact.md
//
// 検証:
//   - defender に高 AP active キャラ → tryGuard が走り、そのキャラがスリープして
//     コンタクトが発生 (引分以上で attacker もリムーブされる可能性)
//   - defender に active キャラ無し → 既存 Phase 6 簡略実装の挙動 (passGuard)

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

import { applyMove } from '@/ai/policy';

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

function makeBaseState(): GameState {
  return produce(createEmptyGameState(), (draft) => {
    mutate.partner.init(draft, 'self', 'P-SELF');
    mutate.partner.init(draft, 'opp', 'P-OPP');
    mutate.case.init(draft, 'self', 'CASE-SELF', ['赤']);
    mutate.case.init(draft, 'opp', 'CASE-OPP', ['青']);
    draft.turn.player = 'self';
    draft.turn.phase = 'main';
  });
}

beforeEach(() => {
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(makeCard('P-SELF', { kind: 'partner', ap: 2000, lp: 2 }));
  registerCardDef(makeCard('P-OPP', { kind: 'partner', ap: 2000, lp: 2 }));
  registerCardDef(makeCard('CASE-SELF', { kind: 'case' }));
  registerCardDef(makeCard('CASE-OPP', { kind: 'case' }));
});

describe('policy.applyMove — actionAgainstChar with chooseGuard (Phase 8.7c)', () => {
  it('CPU guard: defender has high-AP active char → guard fires + that char sleeps', () => {
    registerCardDef(makeCard('Attacker', { ap: 1500, lp: 1 }));
    registerCardDef(makeCard('Target', { ap: 1000, lp: 1 }));
    registerCardDef(makeCard('Guardian', { ap: 2500, lp: 1 }));
    const s = produce(makeBaseState(), (draft) => {
      // self.scene: Attacker (active), opp.scene: Target (sleep, 攻撃対象) + Guardian (active, ガード候補)
      mutate.scene.enter(draft, 'self', 'Attacker', { active: true });
      mutate.scene.enter(draft, 'opp', 'Target', { active: false });
      mutate.scene.enter(draft, 'opp', 'Guardian', { active: true });
    });
    const atkUid = s.players.self.scene.find((c) => c.cardId === 'Attacker')!.uid;
    const tgtUid = s.players.opp.scene.find((c) => c.cardId === 'Target')!.uid;
    const guardUid = s.players.opp.scene.find((c) => c.cardId === 'Guardian')!.uid;

    const after = produce(s, (draft) => {
      applyMove(draft, { kind: 'actionAgainstChar', byUid: atkUid, targetUid: tgtUid }, 'self');
    });

    // Guardian がガード → スリープ化 (declare の側でも、tryGuard でも sleep される)
    const guardian = after.players.opp.scene.find((c) => c.uid === guardUid);
    expect(guardian?.state).toBe('sleep');
    // rules/08: AP低い (Attacker 1500) < AP高い (Guardian 2500) → なにも起こらない
    //   → Attacker は残存だがスリープ (declare で sleep 済)、リムーブはされない
    const attacker = after.players.self.scene.find((c) => c.uid === atkUid);
    expect(attacker).toBeDefined();
    expect(attacker?.state).toBe('sleep');
    // Target は攻撃対象だがガードに守られた → 残存 (元の sleep のまま)
    const target = after.players.opp.scene.find((c) => c.uid === tgtUid);
    expect(target?.state).toBe('sleep');
  });

  it('CPU passGuard: defender has no active char → 既存挙動 (Target removed)', () => {
    registerCardDef(makeCard('Attacker', { ap: 2000, lp: 1 }));
    registerCardDef(makeCard('Target', { ap: 1000, lp: 1 }));
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'self', 'Attacker', { active: true });
      mutate.scene.enter(draft, 'opp', 'Target', { active: false });
      // opp partner is active (P-OPP) ですが guard.candidates は scene のみ参照する
      // (現状 engine 制約: partner は guard 不可、Phase 5 で拡張予定)
    });
    const atkUid = s.players.self.scene.find((c) => c.cardId === 'Attacker')!.uid;
    const tgtUid = s.players.opp.scene.find((c) => c.cardId === 'Target')!.uid;

    const after = produce(s, (draft) => {
      applyMove(draft, { kind: 'actionAgainstChar', byUid: atkUid, targetUid: tgtUid }, 'self');
    });

    // ガード候補無し → passGuard → AP 2000 >= 1000 で Target リムーブ、Attacker 残存 (スリープ)
    expect(after.players.opp.scene.find((c) => c.uid === tgtUid)).toBeUndefined();
    expect(after.players.self.scene.find((c) => c.uid === atkUid)?.state).toBe('sleep');
  });
});
