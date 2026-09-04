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
import type { AIPolicy } from '@/ai/policy';
import { resolveActionAgainstChar } from '@/ai/action-resolution';

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

  it.each(['attacker', 'target'] as const)(
    'ends before guard selection/contact when the %s leaves during declaration effects',
    (removed) => {
      registerCardDef(makeCard('Attacker', { ap: 1500, lp: 1 }));
      registerCardDef(makeCard('Target', { ap: 1000, lp: 1 }));
      registerCardDef(makeCard('Guardian', { ap: 2500, lp: 1 }));
      const s = produce(makeBaseState(), (draft) => {
        mutate.scene.enter(draft, 'self', 'Attacker', { active: true });
        mutate.scene.enter(draft, 'opp', 'Target', { active: false });
        mutate.scene.enter(draft, 'opp', 'Guardian', { active: true });
      });
      const atkUid = s.players.self.scene.find((c) => c.cardId === 'Attacker')!.uid;
      const tgtUid = s.players.opp.scene.find((c) => c.cardId === 'Target')!.uid;
      const guardUid = s.players.opp.scene.find((c) => c.cardId === 'Guardian')!.uid;
      const removedUid = removed === 'attacker' ? atkUid : tgtUid;
      let guardChoices = 0;
      let contactStarts = 0;
      const defenderPolicy: AIPolicy = {
        choose: () => null,
        chooseGuard: () => {
          guardChoices += 1;
          return guardUid;
        },
      };
      event.on('action:declare', (state) => {
        mutate.scene.removeToRemove(state, removedUid, 'effect');
      });
      event.on('contact:start', () => {
        contactStarts += 1;
      });

      const after = produce(s, (draft) => {
        resolveActionAgainstChar(draft, atkUid, tgtUid, defenderPolicy);
      });

      expect(guardChoices).toBe(0);
      expect(contactStarts).toBe(0);
      expect(after.actionContexts).toEqual({});
    },
  );

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

// BUG-144: アクション[事件] も rules/07-08 でガード可能。AI 防御側に guard 窓を出す
// (human 経路 useEngineDispatch actionJudge と同型: case+guard成立 → 証拠変動なし + contact AP判定)。
describe('policy.applyMove — actionAgainstCase with chooseGuard (BUG-144)', () => {
  function seedEvidence(draft: GameState, p: 'self' | 'opp', cardId: string): void {
    // Keep one card in deck after seeding. Exact exhaustion would correctly end
    // the game during fixture setup, making the later action invalid.
    draft.players[p].deck.push(cardId, `${cardId}-FILLER`);
    mutate.evidence.addFromDeck(draft, p, 1, false, { turn: 0, via: 'action-case' });
  }

  it('CPU guard on case-action: 高 AP active キャラでガード → 証拠は奪われない (rules/07)', () => {
    registerCardDef(makeCard('Attacker', { ap: 1500, lp: 1 }));
    registerCardDef(makeCard('Guardian', { ap: 2500, lp: 1 }));
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'self', 'Attacker', { active: true });
      mutate.scene.enter(draft, 'opp', 'Guardian', { active: true });
      seedEvidence(draft, 'opp', 'EV-OPP'); // opp 事件に証拠 1 (アクション[事件] の対象条件)
      draft.players.self.deck.push('EV-SELF'); // gainSelfEvidence 用 (ガード時は引かれないはず)
    });
    const atkUid = s.players.self.scene.find((c) => c.cardId === 'Attacker')!.uid;
    const guardUid = s.players.opp.scene.find((c) => c.cardId === 'Guardian')!.uid;
    const contactStarts: { aUid: string; bUid: string }[] = [];
    event.on('contact:start', (_state, payload) => {
      contactStarts.push(payload as { aUid: string; bUid: string });
    });

    const after = produce(s, (draft) => {
      applyMove(draft, { kind: 'actionAgainstCase', byUid: atkUid, targetPlayer: 'opp' }, 'self');
    });

    // Guardian がガード → スリープ化
    expect(after.players.opp.scene.find((c) => c.uid === guardUid)?.state).toBe('sleep');
    // rules/07+10: ガード成立 → 証拠変動なし (opp 証拠は奪われず、self 証拠も増えない)
    expect(after.players.opp.evidence.length).toBe(1);
    expect(after.players.self.evidence.length).toBe(0);
    // Attacker (1500) < Guardian (2500) → judge で何も起こらない (Attacker 残存・スリープ)
    expect(after.players.self.scene.find((c) => c.uid === atkUid)?.state).toBe('sleep');
    expect(contactStarts).toEqual([{ aUid: atkUid, bUid: guardUid }]);
    expect(after.actionContexts).toEqual({});
  });

  it('CPU passGuard on case-action: ガード候補なし → 既存挙動 (証拠リムーブ + 自証拠獲得)', () => {
    registerCardDef(makeCard('Attacker', { ap: 2000, lp: 1 }));
    const s = produce(makeBaseState(), (draft) => {
      mutate.scene.enter(draft, 'self', 'Attacker', { active: true });
      seedEvidence(draft, 'opp', 'EV-OPP');
      draft.players.self.deck.push('EV-SELF', 'EV-SELF-FILLER');
    });
    const atkUid = s.players.self.scene.find((c) => c.cardId === 'Attacker')!.uid;

    const after = produce(s, (draft) => {
      applyMove(draft, { kind: 'actionAgainstCase', byUid: atkUid, targetPlayer: 'opp' }, 'self');
    });

    // ガード候補なし → passGuard → rules/10: 相手証拠 -1 + 自証拠 +1
    expect(after.players.opp.evidence.length).toBe(0);
    expect(after.players.self.evidence.length).toBe(1);
    expect(after.gameResult).toBeUndefined();
    expect(after.actionContexts).toEqual({});
  });
});
