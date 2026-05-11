// Phase 4 Task 4.2 — engine.flow.runAutoPhase
// spec: .claude/specs/engine-api-flow-control.md
// rules: 03-field-areas.md, 05-turn-phases.md, 04-game-setup.md, 13-keywords.md (アシスト)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAutoPhase } from '@/engine/flow/auto-phase';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { GameState, HookName } from '@/engine/types';

function makeStateWithDeck(deckSize: number): GameState {
  const initial = createEmptyGameState();
  return produce(initial, draft => {
    // パートナー (両方) を init
    mutate.partner.init(draft, 'self', 'P-SELF');
    mutate.partner.init(draft, 'opp', 'P-OPP');
    mutate.case.init(draft, 'self', 'CASE-SELF', []);
    mutate.case.init(draft, 'opp', 'CASE-OPP', []);
    // デッキを deckSize 枚で埋める
    draft.players.self.deck = Array.from({ length: deckSize }, (_, i) => `s-${i}`);
    draft.players.opp.deck = Array.from({ length: deckSize }, (_, i) => `o-${i}`);
    // ターン情報
    draft.turn.player = 'self';
    draft.turn.number = 1;
    draft.turn.phase = 'auto';
    draft.turn.isFirstPlayerFirstTurn = true;
  });
}

describe('engine.flow.runAutoPhase', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetUidCounter();
  });

  it('1. パートナーをアクティブにする', () => {
    const initial = makeStateWithDeck(40);
    // まずパートナーを sleep にしておく
    const s1 = produce(initial, draft => {
      mutate.partner.setState(draft, 'self', 'sleep');
    });
    const after = produce(s1, draft => {
      runAutoPhase(draft, 'self');
    });
    expect(after.players.self.partner.state).toBe('active');
  });

  it('2. スタン状態のキャラはアクティブにならず sleep になる (rules/03)', () => {
    const initial = makeStateWithDeck(40);
    const s1 = produce(initial, draft => {
      const c = mutate.scene.enter(draft, 'self', 'C1', { active: true });
      mutate.scene.setState(draft, c.uid, 'stun');
    });
    const after = produce(s1, draft => {
      runAutoPhase(draft, 'self');
    });
    // stun → sleep (rules/03)
    expect(after.players.self.scene[0].state).toBe('sleep');
  });

  it('2. スリープ状態のキャラはアクティブになる', () => {
    const initial = makeStateWithDeck(40);
    const s1 = produce(initial, draft => {
      const c = mutate.scene.enter(draft, 'self', 'C1', { active: false });
      expect(c.state).toBe('sleep');
    });
    const after = produce(s1, draft => {
      runAutoPhase(draft, 'self');
    });
    expect(after.players.self.scene[0].state).toBe('active');
  });

  it('3. デッキから 1 枚ドローする', () => {
    const initial = makeStateWithDeck(40);
    const after = produce(initial, draft => {
      runAutoPhase(draft, 'self');
    });
    expect(after.players.self.hand).toHaveLength(1);
    expect(after.players.self.hand[0]).toBe('s-0');
  });

  it('4. 先攻初手は FILE に 1 枚追加 + isFirstPlayerFirstTurn が false になる', () => {
    const initial = makeStateWithDeck(40);
    expect(initial.turn.isFirstPlayerFirstTurn).toBe(true);
    const after = produce(initial, draft => {
      runAutoPhase(draft, 'self');
    });
    expect(after.players.self.file).toHaveLength(1);
    // ドロー 1 + FILE 1 = 2 枚消費
    expect(after.players.self.deck).toHaveLength(40 - 1 - 1);
    expect(after.turn.isFirstPlayerFirstTurn).toBe(false);
  });

  it('4. 通常ターン (isFirstPlayerFirstTurn=false) では FILE 2 枚', () => {
    const initial = makeStateWithDeck(40);
    const s1 = produce(initial, draft => {
      draft.turn.isFirstPlayerFirstTurn = false;
    });
    const after = produce(s1, draft => {
      runAutoPhase(draft, 'self');
    });
    expect(after.players.self.file).toHaveLength(2);
    expect(after.players.self.deck).toHaveLength(40 - 1 - 2);
  });

  it('4. 非ターンプレイヤーへの runAutoPhase は通常通り FILE 2 枚 (rules/04 例外は先攻のみ)', () => {
    const initial = makeStateWithDeck(40);
    // self が先攻なので opp の自動フェイズは FILE=2 になるはず
    const after = produce(initial, draft => {
      runAutoPhase(draft, 'opp');
    });
    expect(after.players.opp.file).toHaveLength(2);
    // isFirstPlayerFirstTurn は維持される (先攻=self ではないため)
    expect(after.turn.isFirstPlayerFirstTurn).toBe(true);
  });

  it('1. FILE 中パートナー (アシスト中) は partner-area に戻してアクティブ化 (rules/05)', () => {
    const initial = makeStateWithDeck(40);
    const s1 = produce(initial, draft => {
      mutate.partner.assist(draft, 'self');
    });
    expect(s1.players.self.partner.location).toBe('file-area');
    expect(s1.players.self.partner.state).toBe('sleep');
    expect(s1.players.self.file.some(f => f.type === 'assisted-partner')).toBe(true);

    const after = produce(s1, draft => {
      runAutoPhase(draft, 'self');
    });
    expect(after.players.self.partner.location).toBe('partner-area');
    expect(after.players.self.partner.state).toBe('active');
    expect(after.players.self.file.some(f => f.type === 'assisted-partner')).toBe(false);
  });

  it('3. デッキ 0 枚で remove も 0 枚なら draw は 0 枚 (敗北は呼出元の Hook 担当)', () => {
    const initial = makeStateWithDeck(0);
    // remove も 0 のため refresh は失敗するが、runAutoPhase 自体は throw しない
    const after = produce(initial, draft => {
      runAutoPhase(draft, 'self');
    });
    // ドロー失敗 → 手札 0
    expect(after.players.self.hand).toHaveLength(0);
  });

  it('hook 発火順: phase:auto:start → before-draw → after-draw → after-file', () => {
    const initial = makeStateWithDeck(40);
    const fired: HookName[] = [];
    event.on('phase:auto:start', () => {
      fired.push('phase:auto:start');
    });
    event.on('phase:auto:before-draw', () => {
      fired.push('phase:auto:before-draw');
    });
    event.on('phase:auto:after-draw', () => {
      fired.push('phase:auto:after-draw');
    });
    event.on('phase:auto:after-file', () => {
      fired.push('phase:auto:after-file');
    });
    produce(initial, draft => {
      runAutoPhase(draft, 'self');
    });
    expect(fired).toEqual([
      'phase:auto:start',
      'phase:auto:before-draw',
      'phase:auto:after-draw',
      'phase:auto:after-file',
    ]);
  });

  it('phase が auto に設定される', () => {
    const initial = makeStateWithDeck(40);
    const s1 = produce(initial, draft => {
      draft.turn.phase = 'main';
    });
    const after = produce(s1, draft => {
      runAutoPhase(draft, 'self');
    });
    // runAutoPhase 完了後、まだ auto (呼出元が main へ遷移する責務)
    expect(after.turn.phase).toBe('auto');
  });
});
