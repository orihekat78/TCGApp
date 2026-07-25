// Phase 8.7a: runActionFlow tests
//
// rules: 07-action-flow.md, 08-contact.md, 10-action-event.md, 13-keywords.md
// spec: .claude/specs/2026-05-11-ui-action-flows.md ⑤アクション
//
// 仕様:
//   1. enumActionSourceCandidates で自プレイヤーの source 候補列挙
//      (canAction を満たす active キャラ + active partner)
//   2. useTargetPicker.start({purpose:'action:source'}) で source 選択
//   3. enumActionTargetCandidates で target 候補列挙
//      (opp.scene の sleep/stun + 'case:opp' (opp.evidence ≥ 1 のとき))
//   4. useTargetPicker.start({purpose:'action:target'}) で target 選択
//   5. useConfirmation.ask (standard) で確認 → dispatchEngineAction
//
// engine 側は policy.applyMove と同じシーケンスで FSM を最後まで進める
// (Phase 6 簡略実装: AI 側はガード/カットイン/変装なし)

import { describe, it, expect, beforeEach } from 'vitest';
import {
  runActionFlow,
  enumActionSourceCandidates,
  enumActionTargetCandidates,
} from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';
import { makeChar as baseChar } from '../../helpers/fixtures';

function makeChar(uid: string, state: 'active' | 'sleep' | 'stun' = 'active', isNamed = false): SceneCharacter {
  return baseChar({ cardId: 'cX', uid, state, isNamed, enterOrder: 0 });
}

function setupForAction(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.partner = { cardId: 'P1', state: 'active', location: 'partner-area' };
  s.players.self.scene = [makeChar('s1', 'active', false)];
  s.players.opp.partner = { cardId: 'P2', state: 'active', location: 'partner-area' };
  s.players.opp.scene = [makeChar('t1', 'sleep', false)];
  s.players.opp.case = { cardId: 'C1', status: '事件編', requiredEvidence: 7, colors: ['blue'] };
  s.players.opp.evidence = [
    { cardId: 'card-back', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
  ];
  // self.deck に 1 枚 (actionAgainstCase の gainSelfEvidence 用)
  s.players.self.deck = ['evi-1'];
  return s;
}

async function pickAndConfirmPicker(uid: string): Promise<void> {
  const r = useTargetPickerStore.getState()._resolver!;
  useTargetPickerStore.getState()._setPhase({ phase: 'idle' });
  useTargetPickerStore.getState()._setResolver(null);
  r(uid);
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

async function cancelPicker(): Promise<void> {
  const r = useTargetPickerStore.getState()._resolver!;
  useTargetPickerStore.getState()._setPhase({ phase: 'idle' });
  useTargetPickerStore.getState()._setResolver(null);
  r(null);
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

async function acceptConfirmation(): Promise<void> {
  const r = useConfirmationStore.getState()._resolver!;
  useConfirmationStore.getState()._setCurrent(null);
  useConfirmationStore.getState()._setResolver(null);
  r(true);
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

async function rejectConfirmation(): Promise<void> {
  const r = useConfirmationStore.getState()._resolver!;
  useConfirmationStore.getState()._setCurrent(null);
  useConfirmationStore.getState()._setResolver(null);
  r(false);
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

describe('enumActionSourceCandidates', () => {
  it('returns active scene chars + active partner, excludes sleep chars', () => {
    const s = setupForAction();
    s.players.self.scene = [
      makeChar('alive', 'active', false),
      makeChar('sleepy', 'sleep', false),
    ];
    const result = enumActionSourceCandidates(s, 'self');
    expect(result).toContain('alive');
    expect(result).not.toContain('sleepy');
    expect(result).toContain('partner:self');
  });

  it('excludes named chars without 迅速/突撃 keywords', () => {
    const s = setupForAction();
    s.players.self.scene = [makeChar('named-no-kw', 'active', true)];
    const result = enumActionSourceCandidates(s, 'self');
    expect(result).not.toContain('named-no-kw');
  });
});

describe('enumActionTargetCandidates', () => {
  it('returns opp sleep/stun chars + case:opp (when opp evidence>=1)', () => {
    const s = setupForAction();
    s.players.opp.scene = [
      makeChar('opp-sleep', 'sleep', false),
      makeChar('opp-active', 'active', false),
    ];
    const result = enumActionTargetCandidates(s, 'partner:self');
    expect(result).toContain('opp-sleep');
    expect(result).not.toContain('opp-active');
    expect(result).toContain('case:opp');
  });

  it('omits case:opp when opp.evidence is empty', () => {
    const s = setupForAction();
    s.players.opp.evidence = [];
    const result = enumActionTargetCandidates(s, 'partner:self');
    expect(result).not.toContain('case:opp');
  });
});

describe('runActionFlow', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null, activeActionId: null });
    useTargetPickerStore.getState()._reset();
    useConfirmationStore.getState()._reset();
    _resetActionContexts();
  });

  it('source pick → target char pick → confirm accept → dispatch actionAgainstChar', async () => {
    useGameStateStore.setState({ gameState: setupForAction() });
    const promise = runActionFlow({ player: 'self' });

    // 1. source picker
    let phase = useTargetPickerStore.getState().phase;
    expect(phase.phase).toBe('picking');
    if (phase.phase === 'picking') expect(phase.purpose).toBe('action:source');
    await pickAndConfirmPicker('s1');

    // 2. target picker
    phase = useTargetPickerStore.getState().phase;
    expect(phase.phase).toBe('picking');
    if (phase.phase === 'picking') {
      expect(phase.purpose).toBe('action:target');
      expect(phase.candidates).toContain('t1');
      expect(phase.candidates).toContain('case:opp');
    }
    await pickAndConfirmPicker('t1');

    // 3. confirmation
    expect(useConfirmationStore.getState().current?.kind).toBe('standard');
    expect(useConfirmationStore.getState().current?.title).toContain('アクション');
    await acceptConfirmation();

    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    // Phase 8 Commit 2: runActionFlow は declare のみ (FSM 完了は useContactFlowDriver の責務)
    // attacker s1 はスリープ済 (declare 時)
    expect(after.players.self.scene.find((c) => c.uid === 's1')?.state).toBe('sleep');
    // activeActionId が set されている (driver 引き継ぎ用)
    expect(useGameStateStore.getState().activeActionId).not.toBeNull();
  });

  it('source pick → target case:opp pick → confirm accept → dispatch actionDeclareCase', async () => {
    useGameStateStore.setState({ gameState: setupForAction() });
    const promise = runActionFlow({ player: 'self' });

    await pickAndConfirmPicker('s1');
    await pickAndConfirmPicker('case:opp');
    await acceptConfirmation();

    const result = await promise;
    expect(result.ok).toBe(true);
    // Phase 8 Commit 2: declare のみ完了 → activeActionId set / 後続 (証拠操作) は driver 担当
    expect(useGameStateStore.getState().activeActionId).not.toBeNull();
  });

  it('returns cancelled when source picker cancels', async () => {
    useGameStateStore.setState({ gameState: setupForAction() });
    const before = useGameStateStore.getState().gameState;
    const promise = runActionFlow({ player: 'self' });
    await cancelPicker();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('returns cancelled when target picker cancels', async () => {
    useGameStateStore.setState({ gameState: setupForAction() });
    const promise = runActionFlow({ player: 'self' });
    await pickAndConfirmPicker('s1');
    await cancelPicker();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
  });

  it('returns cancelled when confirmation rejects', async () => {
    useGameStateStore.setState({ gameState: setupForAction() });
    const promise = runActionFlow({ player: 'self' });
    await pickAndConfirmPicker('s1');
    await pickAndConfirmPicker('t1');
    await rejectConfirmation();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
  });

  it('returns no-state when gameState is null', async () => {
    const result = await runActionFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-state');
  });

  it('returns not-allowed when no source candidates', async () => {
    const s = setupForAction();
    s.players.self.partner.state = 'sleep';
    s.players.self.scene = [makeChar('sleepy', 'sleep', false)];
    useGameStateStore.setState({ gameState: s });
    const result = await runActionFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });

  it('returns not-allowed when no target candidates (no opp chars + no opp evidence)', async () => {
    const s = setupForAction();
    s.players.opp.scene = [];
    s.players.opp.evidence = [];
    useGameStateStore.setState({ gameState: s });
    const promise = runActionFlow({ player: 'self' });
    // source 選択は通る
    await pickAndConfirmPicker('s1');
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });
});
