// switch-on-effect-enter (rules/20 §スイッチ): 現場満杯の効果登場 (D11014 a2 reanimate) で、
// human が SceneSwitchPickerModal で退場キャラを選ぶと switchRemoveUid 付きで resolve され、
// engine が switchEnter で登場 → step3 $entered conditional の 1 ドローも発火する統合テスト。
// (UI の Playmat.resolveSceneEnterPick が collect → dispatch する switchRemoveUid を直接渡して再現)
//
// rules: 20-color-and-switch.md §スイッチ, 15-abilities-effects.md

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { registerAll } from '@/cards';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { run as runEffect } from '@/engine/effect/resolver';
import { persistPendingRuntimeState, resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import type { Effect, EffectCtx, GameState } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { register as registerCardDef } from '@/engine/read/def';
import { B08003 } from '@/cards/ct-p08/B08003';
import { B05101 } from '@/cards/ct-p05/B05101';
import { B05115 } from '@/cards/ct-p05/B05115';
import { B10091 } from '@/cards/ct-p10/B10091';


// shigo(D11014, source) + フィラー4枚 = 現場満杯(5枚)。reanimate 対象は remove。
function setupFull(reanimateTarget: string): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    d.players.self.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
    d.players.self.scene.push(sceneChar('D11014', 'shigo'));
    d.players.self.scene.push(sceneChar('D11013', 'f1'));
    d.players.self.scene.push(sceneChar('D11013', 'f2'));
    d.players.self.scene.push(sceneChar('D11013', 'f3'));
    d.players.self.scene.push(sceneChar('D11013', 'f4'));
    d.players.self.hand = ['D08013'];        // step1 discard 用
    d.players.self.remove = [reanimateTarget]; // step2 reanimate 対象
    d.players.self.deck = ['D08014'];        // step3 draw 対象
  });
}

function pendingUidFor(cardId: string): string {
  const pending = useGameStateStore.getState().pendingEffectPick;
  const cand = pending!.candidates.find((c) => c.cardId === cardId) ?? pending!.candidates[0];
  return cand!.uid;
}

function fixedSceneEnterEffect(cardId: 'B05101' | 'B05115' | 'B10091'): Effect {
  if (cardId === 'B05101') {
    const optional = B05101.abilities[0]!.effect as Extract<Effect, { kind: 'optional' }>;
    const chain = optional.effect as Extract<Effect, { kind: 'chain' }>;
    return chain.steps[0]!;
  }
  if (cardId === 'B05115') {
    const optional = B05115.abilities[0]!.effect as Extract<Effect, { kind: 'optional' }>;
    return optional.effect;
  }
  return B10091.abilities[2]!.effect;
}

describe('switch-on-effect-enter — 現場満杯の reanimate を switch で登場 (human)', () => {
  beforeAll(() => {
    registerAll();
    registerCardDef({
      id: 'SWITCH-SEQUENCE-SOURCE', no: 'SWITCH-SEQUENCE-SOURCE', kind: 'character',
      names: ['Switch Sequence Source'], colors: ['緑'], level: 1, ap: 1000, lp: 1,
      traits: [], rarity: 'C', imageUrl: '', ruleRefs: [],
      abilities: [{
        id: 'a1', type: 'declared', scope: 'on-scene', description: '', ruleRefs: [],
        effect: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'self', max: 1, cause: 'effect' } },
            { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', max: 1, viaEffect: true } },
          ],
        },
      }],
    });
    registerCardDef({
      id: 'SWITCH-SEQUENCE-REVIVE', no: 'SWITCH-SEQUENCE-REVIVE', kind: 'character',
      names: ['Switch Sequence Revive'], colors: ['緑'], level: 1, ap: 1000, lp: 1,
      traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    });
    registerCardDef({
      id: 'SWITCH-B08003-PARTNER', no: 'SWITCH-B08003-PARTNER', kind: 'partner',
      names: ['Switch B08003 Partner'], colors: ['青'], level: 0, ap: 0, lp: 0,
      traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    });
    for (const card of [
      { id: 'SWITCH-B08003-GOOD', level: 8, traits: ['少年探偵団'] },
      { id: 'SWITCH-B08003-HIGH', level: 9, traits: ['少年探偵団'] },
      { id: 'SWITCH-B08003-FILLER', level: 1, traits: [] },
      { id: 'SWITCH-TRIGGER-ENTRY', level: 1, traits: [] },
    ]) {
      registerCardDef({
        id: card.id, no: card.id, kind: 'character', names: [card.id], colors: ['青'],
        level: card.level, ap: 1000, lp: 1, traits: card.traits, rarity: 'C', imageUrl: '',
        abilities: [], ruleRefs: [],
      });
    }
  });
  beforeEach(() => {
    resetPendingRuntimeState();
    useGameStateStore.setState({ gameState: null, pendingEffectPick: null });
    _clearPendingEffectPickQueue();
    delete (globalThis as { __pendingChainContinuation?: unknown[] }).__pendingChainContinuation;
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });
  afterEach(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('満杯時、reanimate 対象を選び switchRemoveUid を渡すと退場キャラを退けて登場し step3 draw も発火', () => {
    useGameStateStore.setState({ gameState: setupFull('D11011') });

    // 宣言能力 a2 (cost sleepSelf は dispatcher が def から自動支払い — Phase 2c 契約)
    // → step1 discard pick surface
    const r1 = dispatchEngineAction({ type: 'declaredAbility', uid: 'shigo', abilId: 'a2' });
    expect(r1.ok).toBe(true);
    // discard 解決 → step2 sceneEnter pick surface (満杯でも human は早期 skip されない)
    dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pendingUidFor('D08013') });
    expect(useGameStateStore.getState().pendingEffectPick?.atomVerb, '満杯でも reanimate pick が出る').toBe('sceneEnter');

    // reanimate pick を switchRemoveUid='f1' 付きで解決 (UI が SceneSwitchPickerModal で収集した想定)
    dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pendingUidFor('D11011'), switchRemoveUid: 'f1' });

    const gs = useGameStateStore.getState().gameState!;
    expect(gs.players.self.scene.length, 'スイッチなので現場 5 枚維持').toBe(5);
    expect(gs.players.self.scene.some((c) => c.cardId === 'D11011'), '萩原千速 が登場').toBe(true);
    expect(gs.players.self.scene.some((c) => c.uid === 'f1'), '退場キャラ f1 は消える').toBe(false);
    expect(gs.players.self.hand, 'step3 draw は成立').toEqual(['D08014']);
    expect(gs.players.self.deck, 'exact exhaustion → discard と switch 退場カードを即 refresh')
      .toEqual(expect.arrayContaining(['D08013', 'D11013']));
    expect(gs.players.self.deck).toHaveLength(2);
    expect(gs.players.self.remove).toHaveLength(0);
    expect(gs.refreshCount.self).toBe(1);
    expect(gs.players.opp.evidence).toHaveLength(1);
  });

  it('満杯時、switch を辞退 (pickedUid:null) すると reanimate されず draw もしない', () => {
    useGameStateStore.setState({ gameState: setupFull('D11011') });

    dispatchEngineAction({ type: 'declaredAbility', uid: 'shigo', abilId: 'a2' });
    dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pendingUidFor('D08013') });
    // 辞退 = pickedUid:null (Playmat: SceneSwitchPickerModal cancel 時の挙動)
    dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: null });

    const gs = useGameStateStore.getState().gameState!;
    expect(gs.players.self.scene.some((c) => c.cardId === 'D11011'), 'reanimate されない').toBe(false);
    expect(gs.players.self.remove, '対象はリムーブに残る').toContain('D11011');
    expect(gs.players.self.deck.length, 'draw もしない → デッキ据え置き').toBe(1);
  });

  it('先行sceneRemoveで自現場に空きができる継続は追加switchなしで公開解決できる', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.scene = [
        sceneChar('SWITCH-SEQUENCE-SOURCE', 'sequence-source'),
        sceneChar('D11013', 'sequence-victim'),
        sceneChar('D11013', 'sequence-f2'),
        sceneChar('D11013', 'sequence-f3'),
        sceneChar('D11013', 'sequence-f4'),
      ];
      d.players.self.remove = ['SWITCH-SEQUENCE-REVIVE'];
    });
    useGameStateStore.setState({ gameState: state });

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'sequence-source', abilId: 'a1' }))
      .toEqual({ ok: true });
    const removal = useGameStateStore.getState().pendingEffectPick!;
    expect(removal.atomVerb).toBe('sceneRemove');
    expect(removal.sceneEnterSwitchPlayer).toBeUndefined();
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'sequence-victim' }))
      .toEqual({ ok: true });

    const entry = useGameStateStore.getState().pendingEffectPick!;
    expect(entry.atomVerb).toBe('sceneEnter');
    const reviveUid = entry.candidates.find((candidate) => candidate.cardId === 'SWITCH-SEQUENCE-REVIVE')!.uid;
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: reviveUid }))
      .toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene).toHaveLength(5);
    expect(after.players.self.scene.some((character) => character.uid === 'sequence-victim')).toBe(false);
    expect(after.players.self.scene.some((character) => character.cardId === 'SWITCH-SEQUENCE-REVIVE')).toBe(true);
  });

  it('複数登場の forged・duplicate・wrong-count switch UID を public dispatch が state 不変で拒否し再試行できる', () => {
    const state = produce(createEmptyGameState(), (d) => {
      d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.scene = [
        sceneChar('B09010', 'agasa'),
        sceneChar('D11013', 'f1'),
        sceneChar('D11013', 'f2'),
        sceneChar('D11013', 'f3'),
        sceneChar('D11013', 'f4'),
      ];
      d.players.self.remove = ['B01014', 'B01016'];
      d.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: 'D08017' }));
    });
    useGameStateStore.setState({ gameState: state });

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'agasa', abilId: 'a1' })).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick!;
    const selected = pending.candidates.filter((candidate) => candidate.cardId === 'B01014' || candidate.cardId === 'B01016');
    expect(selected).toHaveLength(2);
    const before = JSON.stringify(useGameStateStore.getState().gameState);

    for (const malformedSwitchPart of [
      { switchRemoveUids: null },
      { switchRemoveUids: 'f1' },
      { switchRemoveUids: ['f1', 7] },
      { switchRemoveUid: null },
    ]) {
      let result: unknown;
      expect(() => {
        result = dispatchCurrentDecision({
          type: 'effectPickResolve',
          pickedUid: selected[0]!.uid,
          pickedUids: selected.map((candidate) => candidate.uid),
          ...malformedSwitchPart,
        } as never);
      }).not.toThrow();
      expect(result).toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(useGameStateStore.getState().gameState)).toBe(before);
      expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(pending.decisionId);
    }

    for (const switchRemoveUids of [
      ['f1', 'forged-victim'],
      ['f1', 'f1'],
      ['f1'],
    ]) {
      expect(dispatchCurrentDecision({
        type: 'effectPickResolve',
        pickedUid: selected[0]!.uid,
        pickedUids: selected.map((candidate) => candidate.uid),
        switchRemoveUids,
      })).toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(useGameStateStore.getState().gameState)).toBe(before);
      expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(pending.decisionId);
    }

    expect(dispatchCurrentDecision({
      type: 'effectPickResolve',
      pickedUid: selected[0]!.uid,
      pickedUids: selected.map((candidate) => candidate.uid),
      switchRemoveUids: ['f1', 'f2'],
    })).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.map((character) => character.cardId)).toEqual(
      expect.arrayContaining(['B01014', 'B01016']),
    );
    expect(after.players.self.scene.some((character) => character.uid === 'f1' || character.uid === 'f2')).toBe(false);
  });

  function setupB08003FullScene(): GameState {
    return produce(createEmptyGameState(), (d) => {
      d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.partner = { cardId: 'SWITCH-B08003-PARTNER', state: 'active' };
      const source = sceneChar('B08003', 'agasa');
      source.stackedCards = [
        { cardId: 'SWITCH-B08003-GOOD', instanceId: 'stack:agasa:good' },
        { cardId: 'SWITCH-B08003-HIGH', instanceId: 'stack:agasa:high' },
        { cardId: 'SWITCH-B08003-FILLER', instanceId: 'stack:agasa:filler' },
      ];
      d.players.self.scene = [
        source,
        sceneChar('D11013', 'owner-victim-1'),
        sceneChar('D11013', 'owner-victim-2'),
        sceneChar('D11013', 'owner-victim-3'),
        sceneChar('D11013', 'owner-victim-4'),
      ];
      d.players.self.hand = ['SWITCH-B08003-FILLER'];
    });
  }

  function declareB08003(): void {
    expect(dispatchEngineAction({
      type: 'declaredAbility',
      uid: 'agasa',
      abilId: 'a2',
      costParams: { removeStackedCards: { instanceIds: [
        'stack:agasa:good',
        'stack:agasa:high',
        'stack:agasa:filler',
      ] } },
    } as never)).toEqual({ ok: true });
  }

  function openFixedSceneEnterSwitch(cardId: 'B05101' | 'B05115' | 'B10091') {
    const initial = produce(createEmptyGameState(), (d) => {
      d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.scene = Array.from(
        { length: 5 },
        (_, index) => sceneChar('D11013', `${cardId}-victim-${index + 1}`),
      );
      d.players.self.remove = [cardId];
      runEffect(d, fixedSceneEnterEffect(cardId), {
        source: { player: 'self', area: 'remove', cardId, uid: `${cardId}-source`, abilityId: 'a1' },
        bindings: {},
        triggerPayload: { cardId },
      });
      persistPendingRuntimeState(d);
    });
    resetPendingRuntimeState();
    expect(useGameStateStore.getState().setGameState(initial, { preserveRuntime: true })).toBe(true);
    surfacePendingSideChannels();
    return useGameStateStore.getState().pendingEffectPick!;
  }

  it.each(['B05101', 'B05115', 'B10091'] as const)(
    '%s: 固定sourceの復活は満杯時に第2段switchを作り、選択後にexact sourceを登場させる',
    (cardId) => {
      const pending = openFixedSceneEnterSwitch(cardId);
      expect(pending).toMatchObject({ player: 'self', ownerPlayer: 'self', atomVerb: 'sceneEnter' });
      expect(pending.candidates).toHaveLength(5);
      const victimUid = `${cardId}-victim-3`;
      expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: victimUid }))
        .toEqual({ ok: true });

      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.scene.some((card) => card.cardId === cardId), cardId).toBe(true);
      expect(after.players.self.scene.some((card) => card.uid === victimUid), cardId).toBe(false);
      expect(after.players.self.remove, cardId).not.toContain(cardId);
    },
  );

  it('B05101: switch待機中にsourceが消えた場合はvictimを消費せずfail closedする', () => {
    const pending = openFixedSceneEnterSwitch('B05101');
    const stale = produce(useGameStateStore.getState().gameState!, (d) => {
      d.players.self.remove = d.players.self.remove.filter((cardId) => cardId !== 'B05101');
    });
    useGameStateStore.setState({ gameState: stale });

    expect(dispatchCurrentDecision({
      type: 'effectPickResolve', pickedUid: pending.candidates[1]!.uid,
    })).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene).toHaveLength(5);
    expect(after.players.self.scene.some((card) => card.cardId === 'B05101')).toBe(false);
    expect(after.players.self.scene.some((card) => card.uid === pending.candidates[1]!.uid)).toBe(true);
  });

  it('B08003: CPUがコストカードを選んだ後、能力所有者の人間が自分のスイッチ対象を選ぶ', () => {
    useGameStateStore.setState({ gameState: setupB08003FullScene() });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    declareB08003();

    const switchPick = useGameStateStore.getState().pendingEffectPick!;
    expect(switchPick.player).toBe('self');
    expect(switchPick.candidates.map((candidate) => candidate.uid)).toEqual([
      'agasa', 'owner-victim-1', 'owner-victim-2', 'owner-victim-3', 'owner-victim-4',
    ]);

    const restored = JSON.parse(JSON.stringify(useGameStateStore.getState().gameState)) as GameState;
    expect(restored.pendingRuntimeState).toBeDefined();
    resetPendingRuntimeState();
    useGameStateStore.getState().setGameState(null);
    useGameStateStore.setState({ pendingEffectPick: null });
    expect(useGameStateStore.getState().setGameState(restored, { preserveRuntime: true })).toBe(true);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick?.candidates.map((candidate) => candidate.uid)).toEqual([
      'agasa', 'owner-victim-1', 'owner-victim-2', 'owner-victim-3', 'owner-victim-4',
    ]);
    expect(dispatchCurrentDecision({
      type: 'effectPickResolve', pickedUid: 'owner-victim-2',
    })).toEqual({ ok: true });

    const discard = useGameStateStore.getState().pendingEffectPick!;
    expect(discard).toMatchObject({ player: 'self', atomVerb: 'discard' });
    expect(dispatchCurrentDecision({
      type: 'effectPickResolve', pickedUid: discard.candidates[0]!.uid,
    })).toEqual({ ok: true });

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.some((card) => card.cardId === 'SWITCH-B08003-GOOD')).toBe(true);
    expect(after.players.self.scene.some((card) => card.uid === 'owner-victim-2')).toBe(false);
    expect(after.players.self.remove.filter((cardId) => cardId === 'B08003')).toHaveLength(1);
    expect(after.players.self.remove.filter((cardId) => cardId === 'SWITCH-B08003-FILLER')).toHaveLength(2);
  });

  it('終端 $trigger.cardId sceneEnter は switch decision の JSON 復元後も保存 ctx で解決する', () => {
    const initial = produce(createEmptyGameState(), (d) => {
      d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.scene = [
        sceneChar('D11013', 'trigger-victim-1'),
        sceneChar('D11013', 'trigger-victim-2'),
        sceneChar('D11013', 'trigger-victim-3'),
        sceneChar('D11013', 'trigger-victim-4'),
        sceneChar('D11013', 'trigger-victim-5'),
      ];
      d.players.self.remove = ['SWITCH-TRIGGER-ENTRY'];
      const ctx: EffectCtx = {
        source: { player: 'self', area: 'scene', cardId: 'D11013', uid: 'trigger-source', abilityId: 'a1' },
        bindings: {},
        triggerPayload: { cardId: 'SWITCH-TRIGGER-ENTRY' },
      };
      runEffect(d, {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          cardId: '$trigger.cardId',
          from: 'remove',
          viaEffect: true,
          sourceRequired: true,
          deferSceneSwitchChoice: true,
          target: { query: { area: 'remove', side: 'self' } },
        },
      }, ctx);
      persistPendingRuntimeState(d);
    });

    const restored = JSON.parse(JSON.stringify(initial)) as GameState;
    resetPendingRuntimeState();
    expect(useGameStateStore.getState().setGameState(restored, { preserveRuntime: true })).toBe(true);
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick!;
    expect(pending.atomVerb).toBe('sceneEnter');
    expect(pending.continuation?.ctx.triggerPayload).toEqual({ cardId: 'SWITCH-TRIGGER-ENTRY' });

    expect(dispatchCurrentDecision({
      type: 'effectPickResolve', pickedUid: 'trigger-victim-3',
    })).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.some((card) => card.cardId === 'SWITCH-TRIGGER-ENTRY')).toBe(true);
    expect(after.players.self.scene.some((card) => card.uid === 'trigger-victim-3')).toBe(false);
    expect(after.players.self.remove).not.toContain('SWITCH-TRIGGER-ENTRY');
  });

  it('B08003: 能力所有者がCPUなら、人間はコストカードだけを選びCPU現場のスイッチ対象は選ばない', () => {
    useGameStateStore.setState({ gameState: setupB08003FullScene() });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';

    declareB08003();
    const costPick = useGameStateStore.getState().pendingEffectPick!;
    expect(costPick).toMatchObject({ player: 'opp', atomVerb: 'bindPick' });
    expect(costPick.candidates.every((candidate) => candidate.player === 'self')).toBe(true);
    const good = costPick.candidates.find((candidate) => candidate.cardId === 'SWITCH-B08003-GOOD')!;
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: good.uid })).toEqual({ ok: true });

    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.some((card) => card.cardId === 'SWITCH-B08003-GOOD')).toBe(true);
    expect(after.players.self.remove.filter((cardId) => cardId === 'B08003')).toHaveLength(1);
    expect(after.players.self.hand).toHaveLength(0);
    expect(after.players.self.remove.filter((cardId) => cardId === 'SWITCH-B08003-FILLER')).toHaveLength(2);
  });
});
