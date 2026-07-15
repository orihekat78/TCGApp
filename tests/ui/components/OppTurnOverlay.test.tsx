// Phase 8.10a: OppTurnOverlay tests
// user_request 20260521_01 #3 UX: specific attacker/target/phase status text

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { OppTurnOverlay } from '@/ui/components/OppTurnOverlay';
import { useGameStateStore } from '@/ui/state/store';
import { useContactModalStore } from '@/ui/hooks/useContactModalStore';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';
import { createEmptyGameState } from '@/engine/state-factory';
import * as flow from '@/engine/flow/index.js';
import { produce } from '@/engine/produce';
import type { SceneCharacter } from '@/engine/types/game-state';
import { makeChar as baseChar } from '../../helpers/fixtures';

function makeChar(uid: string, cardId: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter {
  return baseChar({ cardId, uid, state, enterOrder: 0 });
}

describe('OppTurnOverlay', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null, activeActionId: null });
    useContactModalStore.getState()._reset();
    flow.action._resetActionContexts();
  });

  it('renders nothing when gameState is null', () => {
    const html = renderToString(<OppTurnOverlay />);
    expect(html).toBe('');
  });

  it('renders nothing when turn.player === "self"', () => {
    const s = produce(createSampleGameState(), (d) => {
      d.turn.player = 'self';
    });
    useGameStateStore.setState({ gameState: s });
    const html = renderToString(<OppTurnOverlay />);
    expect(html).not.toContain('opp-turn-overlay');
  });

  it('renders overlay with "相手のターン処理中" when no action active', () => {
    const s = produce(createSampleGameState(), (d) => {
      d.turn.player = 'opp';
    });
    useGameStateStore.setState({ gameState: s });
    const html = renderToString(<OppTurnOverlay />);
    expect(html).toContain('opp-turn-overlay');
    expect(html).toContain('相手のターン処理中');
    expect(html).toContain('data-testid="opp-turn-overlay"');
  });

  it('shows attacker → target with phase label when contact is active (guard-window)', () => {
    // user_request 20260521_01 #3 UX: 相手ターン中の contact の具体表示
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('o1', 'D11003', 'active')];
    s.players.self.scene = [makeChar('s1', 'D08003', 'sleep'), makeChar('s2', 'D08005', 'active')];
    useGameStateStore.setState({ gameState: s });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'o1', targetUid: 's1' });
    const html = renderToString(<OppTurnOverlay />);
    expect(html).toContain('opp-turn-overlay');
    // 具体的な attacker / target / phase 表示
    expect(html).toContain('→');
    expect(html).toMatch(/ガード判定中|コンタクト/);
    // generic な「相手のターン処理中」「アクション解決中」は使わない
    expect(html).not.toContain('相手のターン処理中');
    expect(html).not.toContain('相手がアクション解決中');
  });

  it('shows target = 事件 when target.kind === "case"', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('o1', 'D11003', 'active')];
    s.players.self.case = { cardId: 'C1', status: '事件編', requiredEvidence: 7, colors: ['blue'] };
    s.players.self.evidence = [
      { cardId: 'card-back', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
    ];
    useGameStateStore.setState({ gameState: s });
    dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'o1', targetPlayer: 'self' });
    const html = renderToString(<OppTurnOverlay />);
    expect(html).toContain('opp-turn-overlay');
    expect(html).toContain('事件');
  });

  it('is hidden while the human is deciding a contact response', () => {
    const s = produce(createSampleGameState(), (d) => {
      d.turn.player = 'opp';
    });
    useGameStateStore.setState({ gameState: s });
    useContactModalStore.getState()._setCutInDisguise({
      actionId: 'ax_human',
      player: 'self',
      actorLabel: '1番目',
      candidates: [],
    });

    expect(renderToString(<OppTurnOverlay />)).toBe('');
  });
});
