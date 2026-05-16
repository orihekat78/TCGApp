// Task 8.4b: performGameStart integration test
//
// rules: 04-game-setup.md (初期化手順 / 先攻 1 ターン目 FILE=1 例外)

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { performGameStart } from '@/ui/services/gameStarter';

beforeEach(() => {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  registerAll();
});

describe('performGameStart', () => {
  it('returns turn-1 state: 先攻は手札 6 (5+auto draw)、後攻は手札 5', () => {
    const s = performGameStart();
    expect(s.turn.number).toBe(1);
    expect(['self', 'opp']).toContain(s.turn.player);
    const first = s.turn.player;
    const second = first === 'self' ? 'opp' : 'self';
    expect(s.players[first].hand.length).toBe(6); // 5 + auto-phase draw 1
    expect(s.players[second].hand.length).toBe(5);
  });

  it('先攻プレイヤーの FILE は 1 枚 (rules/04 例外、通常は 2 枚)', () => {
    const s = performGameStart();
    const first = s.turn.player;
    expect(s.players[first].file.length).toBe(1);
  });
});
