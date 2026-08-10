// Phase 8 Task 8.1: useEngineDispatch / dispatchEngineAction
//
// rules: 05-turn-phases.md (メインフェイズ), 11-reasoning.md, 12-next-hint.md,
//        21-declared-ability-cost.md
//
// 仕様:
//   - dispatchEngineAction(action) は engine.flow の対応関数を呼び、結果を store に反映
//   - gameState が null のとき: { ok:false, reason:'no-state' } を返し engine 関数は呼ばれない
//   - canX 判定が false のとき: { ok:false, reason:'not-allowed' } を返し state 不変
//   - engine が throw した場合: { ok:false, reason:'engine-error', detail:... }
//   - Immer の produce 経由で書込 — gameState 参照が更新され、未変更スライスは共有

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  dispatchEngineAction,
  useEngineDispatch,
} from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import { FILE_CARD_BACK_PLACEHOLDER } from '@/engine/types/game-state';
import * as flow from '@/engine/flow';
import type {
  GameState,
  FileCard,
  SceneCharacter,
} from '@/engine/types/game-state';
import { makeChar as baseChar } from '../../helpers/fixtures';
import { register as engineRegisterCardDef } from '@/engine/read/def';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import { snapshotPendingRuntimeState } from '@/engine/effect/runtime-state';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';

// ---- fixtures ----

function withMainPhase(s: GameState): GameState {
  s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  return s;
}

function withSelfPartnerActive(s: GameState): GameState {
  s.players.self.partner = { cardId: '', state: 'active', location: 'partner-area' };
  return s;
}

function makeChar(uid: string, cardId = 'cX'): SceneCharacter {
  return baseChar({ cardId, uid, enterOrder: 0 });
}

// ---- tests ----

describe('dispatchEngineAction (pure function)', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
    useTargetPickerStore.getState()._reset();
    vi.restoreAllMocks();
  });

  describe('happy paths', () => {
    it('reasoning: sleeps active partner and appends a reasoning log entry', () => {
      const init = withMainPhase(withSelfPartnerActive(createEmptyGameState()));
      useGameStateStore.setState({ gameState: init });

      const result = dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
      expect(result.ok).toBe(true);

      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.partner.state).toBe('sleep');
      expect(after.log.at(-1)?.action).toBe('reasoning');
    });

    it('handUseCard: sets turnState.handUseUsed and appends a handUseCard log', () => {
      const init = withMainPhase(createEmptyGameState());
      init.players.self.hand = ['X'];
      useGameStateStore.setState({ gameState: init });

      const result = dispatchEngineAction({
        type: 'handUseCard',
        player: 'self',
        cardId: 'X',
      });
      expect(result.ok).toBe(true);
      const after = useGameStateStore.getState().gameState!;
      expect(after.turnState.self.handUseUsed).toBe(true);
      expect(after.log.at(-1)?.action).toBe('handUseCard');
      expect(after.log.at(-1)?.target).toBe('X');
    });

    it('nextHint: pops FILE top to hand and flags nextHintUsed (Round 3: 実 cardId)', () => {
      const init = withMainPhase(createEmptyGameState());
      // Round 3: FileCard.card-back に cardId 必須化、ネクストヒントで実 cardId が手札に渡る
      const fb1: FileCard = { type: 'card-back', cardId: 'FILE_A' };
      const fb2: FileCard = { type: 'card-back', cardId: 'FILE_B' };
      const fb3: FileCard = { type: 'card-back', cardId: 'FILE_C' };
      init.players.self.file = [fb1, fb2, fb3];
      const handBefore = init.players.self.hand.length;
      useGameStateStore.setState({ gameState: init });

      const result = dispatchEngineAction({ type: 'nextHint', player: 'self' });
      expect(result.ok).toBe(true);
      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.file.length).toBe(2);
      expect(after.players.self.hand.length).toBe(handBefore + 1);
      // Round 3: 旧 FILE_CARD_BACK_PLACEHOLDER → 実 cardId (popTop は末尾 = FILE_C を返す)
      expect(after.players.self.hand.at(-1)).toBe('FILE_C');
      expect(after.turnState.self.nextHintUsed).toBe(true);
    });

    it('partnerAbility: appends a partnerAbility log entry', () => {
      const init = withMainPhase(createEmptyGameState());
      init.players.self.partner = { cardId: 'P1', state: 'active', location: 'partner-area' };
      useGameStateStore.setState({ gameState: init });

      const result = dispatchEngineAction({
        type: 'partnerAbility',
        player: 'self',
        abilId: 'A1',
      });
      expect(result.ok).toBe(true);
      const after = useGameStateStore.getState().gameState!;
      expect(after.log.at(-1)?.action).toBe('partnerAbility');
      expect(after.log.at(-1)?.target).toBe('A1');
    });

    it('declaredAbility: increments declaredUseCount and appends log', () => {
      // W6 step11: canDeclaredAbility の fail-closed 化に伴い、実カード同様 declared ability を持つ
      // def を登録する (旧「def 未登録でも true 素通り」前提の pin を更新)。
      engineRegisterCardDef({
        id: 'cX', no: 'cX', kind: 'character', names: ['cX'], colors: ['赤'], level: 3, ap: 3000, lp: 1,
        traits: [], keywords: [], rarity: 'C', imageUrl: '', ruleRefs: [],
        abilities: [{ id: 'A1', type: 'declared', scope: 'on-scene', effect: { kind: 'atom', verb: 'noop', args: {} }, description: 'test', ruleRefs: [] }],
      } as never);
      const init = withMainPhase(createEmptyGameState());
      init.players.self.scene = [makeChar('c1')];
      useGameStateStore.setState({ gameState: init });

      const result = dispatchEngineAction({
        type: 'declaredAbility',
        uid: 'c1',
        abilId: 'A1',
      });
      expect(result.ok).toBe(true);
      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.scene[0]?.declaredUseCount['A1']).toBe(1);
      expect(after.log.at(-1)?.action).toBe('declaredAbility');
    });

    it('endTurn: swaps turn.player, increments turn.number, advances to next player main phase (Round 2)', () => {
      // Round 2 修正前: endTurn のみ呼出 → phase='end' で stuck (= ターン終了 button 永続 disabled
      //   の root cause)。本 test は旧仕様で phase='end' を assert していたが、
      //   修正後は startTurn(nextPlayer) が連続実行され phase='main' に遷移する。
      const init = createEmptyGameState();
      init.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      // startTurn 内の runAutoPhase は deck から 1 枚 draw + FILE に 2 枚配置するため、
      // 最低 3 枚の opp deck が必要 (engine.flow.runAutoPhase 仕様)。
      init.players.opp.deck.push({ cardId: 'D11003', faceUp: false });
      init.players.opp.deck.push({ cardId: 'D11003', faceUp: false });
      init.players.opp.deck.push({ cardId: 'D11003', faceUp: false });
      useGameStateStore.setState({ gameState: init });

      const result = dispatchEngineAction({ type: 'endTurn', player: 'self' });
      expect(result.ok).toBe(true);
      const after = useGameStateStore.getState().gameState!;
      expect(after.turn.player).toBe('opp');
      expect(after.turn.number).toBe(4);
      // Round 2: phase は next player の main に遷移済
      expect(after.turn.phase).toBe('main');
    });
  });

  describe('negative paths', () => {
    it('no-state: returns { ok:false, reason:"no-state" } and does not call engine', () => {
      const spy = vi.spyOn(flow, 'doReasoning');
      const result = dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
      expect(result).toEqual({ ok: false, reason: 'no-state' });
      expect(spy).not.toHaveBeenCalled();
    });

    it('reasoning on sleeping partner: returns not-allowed and state unchanged', () => {
      const init = withMainPhase(createEmptyGameState());
      init.players.self.partner = { cardId: '', state: 'sleep', location: 'partner-area' };
      useGameStateStore.setState({ gameState: init });
      const before = useGameStateStore.getState().gameState;

      const result = dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('not-allowed');
      expect(useGameStateStore.getState().gameState).toBe(before);
    });

    it('endTurn when phase=auto: returns not-allowed', () => {
      const init = createEmptyGameState();
      init.turn = { number: 1, player: 'self', phase: 'auto', isFirstPlayerFirstTurn: false };
      useGameStateStore.setState({ gameState: init });
      const before = useGameStateStore.getState().gameState;

      const result = dispatchEngineAction({ type: 'endTurn', player: 'self' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('not-allowed');
      expect(useGameStateStore.getState().gameState).toBe(before);
    });

    it('endTurn by non-turn player: returns not-allowed', () => {
      const init = withMainPhase(createEmptyGameState());
      useGameStateStore.setState({ gameState: init });
      const result = dispatchEngineAction({ type: 'endTurn', player: 'opp' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('not-allowed');
    });

    it('direct endTurn dispatch is rejected while an action picker is unresolved', () => {
      const init = withMainPhase(createEmptyGameState());
      useGameStateStore.setState({ gameState: init });
      useTargetPickerStore.getState()._setPhase({
        phase: 'picking',
        candidates: ['self-1'],
        purpose: 'action:source',
      });

      const result = dispatchEngineAction({ type: 'endTurn', player: 'self' });

      expect(result).toEqual({ ok: false, reason: 'not-allowed' });
      expect(useGameStateStore.getState().gameState!.turn.player).toBe('self');
    });

    it('engine throw: captured as { ok:false, reason:"engine-error", detail }', () => {
      const init = withMainPhase(withSelfPartnerActive(createEmptyGameState()));
      useGameStateStore.setState({ gameState: init });

      vi.spyOn(flow, 'doReasoning').mockImplementation(() => {
        throw new Error('boom');
      });

      const result = dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('engine-error');
        expect(result.detail).toMatch(/boom/);
      }
    });

    it('rejects a malformed presentation commit without advancing UI surfaces or runtime', () => {
      const init = withMainPhase(withSelfPartnerActive(createEmptyGameState()));
      startCausalSession(init, 'dispatch-validation');
      resetPresentationQueue('dispatch-validation');
      appendCausal(init, {
        actor: 'self',
        kind: 'use',
        targets: [],
        outcome: { type: 'none' },
      });
      useGameStateStore.getState().setGameState(init);

      const runtime = globalThis as { __pendingContactStartAxId?: string };
      runtime.__pendingContactStartAxId = 'runtime-before';
      const stateBefore = useGameStateStore.getState().gameState;
      const surfaceBefore = useGameStateStore.getState().activeActionId;
      const runtimeBefore = snapshotPendingRuntimeState();

      vi.spyOn(flow, 'doReasoning').mockImplementation((draft) => {
        appendCausal(draft, {
          actor: 'self',
          kind: 'draw',
          targets: [],
          outcome: { type: 'none' },
        });
        (draft.log.at(-1) as { parentEventId?: string }).parentEventId = 'dispatch-validation:999';
        runtime.__pendingContactStartAxId = 'runtime-after';
      });

      try {
        const result = dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toBe('engine-error');
          expect(result.detail).toMatch(/presentation|parent|missing|edge/i);
        }
        expect(useGameStateStore.getState().gameState).toBe(stateBefore);
        expect(useGameStateStore.getState().activeActionId).toBe(surfaceBefore);
        expect(snapshotPendingRuntimeState()).toEqual(runtimeBefore);
      } finally {
        delete runtime.__pendingContactStartAxId;
        useGameStateStore.setState({ activeActionId: null });
      }
    });
  });

  describe('Immer integration', () => {
    it('produces a new top-level reference after a successful dispatch', () => {
      const init = withMainPhase(withSelfPartnerActive(createEmptyGameState()));
      useGameStateStore.setState({ gameState: init });
      const before = useGameStateStore.getState().gameState;

      dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
      const after = useGameStateStore.getState().gameState;
      expect(after).not.toBe(before);
    });

    it('unchanged slice (opp) keeps the same reference (structural sharing)', () => {
      const init = withMainPhase(withSelfPartnerActive(createEmptyGameState()));
      useGameStateStore.setState({ gameState: init });
      const oppBefore = useGameStateStore.getState().gameState!.players.opp;

      dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
      const oppAfter = useGameStateStore.getState().gameState!.players.opp;
      expect(oppAfter).toBe(oppBefore);
    });
  });
});

describe('useEngineDispatch (hook wrapper)', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
  });

  it('returns a dispatch function delegating to dispatchEngineAction', () => {
    const { dispatch } = useEngineDispatch();
    expect(typeof dispatch).toBe('function');

    const init = createEmptyGameState();
    init.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    useGameStateStore.setState({ gameState: init });

    const result = dispatch({ type: 'endTurn', player: 'self' });
    expect(result.ok).toBe(true);
    expect(useGameStateStore.getState().gameState!.turn.player).toBe('opp');
  });
});
