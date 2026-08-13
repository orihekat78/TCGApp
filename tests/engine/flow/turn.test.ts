// engine.flow.turn — Turn-level wrappers tests
// spec: .claude/specs/engine-api-flow-control.md
// rules: 05-turn-phases.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { startTurn, endTurn, startMainPhase } from '@/engine/flow/turn';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { runAllUntilEmpty } from '@/engine/resolve';
import type { GameState, HookName } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

function makeStateWithDeck(deckSize: number, opts: { player?: 'self' | 'opp'; turnNo?: number } = {}): GameState {
  const initial = createEmptyGameState();
  return produce(initial, draft => {
    mutate.partner.init(draft, 'self', 'P-SELF');
    mutate.partner.init(draft, 'opp', 'P-OPP');
    mutate.case.init(draft, 'self', 'CASE-SELF', []);
    mutate.case.init(draft, 'opp', 'CASE-OPP', []);
    draft.players.self.deck = Array.from({ length: deckSize }, (_, i) => `s-${i}`);
    draft.players.opp.deck = Array.from({ length: deckSize }, (_, i) => `o-${i}`);
    draft.turn.player = opts.player ?? 'self';
    draft.turn.number = opts.turnNo ?? 1;
    draft.turn.phase = 'auto';
    draft.turn.isFirstPlayerFirstTurn = false;
  });
}

describe('engine.flow.startTurn', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetUidCounter();
  });

  it('turn:start → (auto phase hooks) → phase:main:start の順に Hook を emit する', () => {
    const fired: HookName[] = [];
    const interestingHooks: HookName[] = ['turn:start', 'phase:auto:start', 'phase:auto:after-file', 'phase:main:start'];
    for (const h of interestingHooks) {
      event.on(h, () => { fired.push(h); });
    }
    const s = makeStateWithDeck(10);
    produce(s, draft => {
      startTurn(draft, 'self');
    });
    expect(fired[0]).toBe('turn:start');
    expect(fired.at(-1)).toBe('phase:main:start');
    expect(fired).toContain('phase:auto:start');
    expect(fired).toContain('phase:auto:after-file');
  });

  it('turn:start payload に player と turnNo を含む', () => {
    let payload: unknown;
    event.on('turn:start', (_s, p) => { payload = p; });
    const s = makeStateWithDeck(10, { player: 'opp', turnNo: 3 });
    produce(s, draft => {
      startTurn(draft, 'opp');
    });
    expect(payload).toEqual({ player: 'opp', turnNo: 3 });
  });

  it('startTurn 完了後 phase は main に遷移している', () => {
    const s = makeStateWithDeck(10);
    const after = produce(s, draft => {
      startTurn(draft, 'self');
    });
    expect(after.turn.phase).toBe('main');
  });

  it('turn:start より前に両プレイヤーのターン単位フラグをリセットする', () => {
    const s = produce(makeStateWithDeck(10, { player: 'opp' }), draft => {
      draft.turnState.self.eventUseBanned = true;
      draft.turnState.opp.cutinBanned = true;
      draft.players.self.scene = [sceneChar('SELF-LIMIT', 'self-limit')];
      draft.players.opp.scene = [sceneChar('OPP-LIMIT', 'opp-limit')];
      draft.players.self.scene[0].declaredUseCount.a1 = 1;
      draft.players.opp.scene[0].declaredUseCount.a1 = 1;
    });
    let atTurnStart: {
      selfEventBan: boolean;
      oppCutinBan: boolean;
      selfLimit: number | undefined;
      oppLimit: number | undefined;
    } | undefined;
    event.on('turn:start', (state) => {
      atTurnStart = {
        selfEventBan: state.turnState.self.eventUseBanned === true,
        oppCutinBan: state.turnState.opp.cutinBanned === true,
        selfLimit: state.players.self.scene[0]?.declaredUseCount.a1,
        oppLimit: state.players.opp.scene[0]?.declaredUseCount.a1,
      };
    });

    produce(s, draft => {
      startTurn(draft, 'opp');
    });

    expect(atTurnStart).toEqual({
      selfEventBan: false,
      oppCutinBan: false,
      selfLimit: undefined,
      oppLimit: undefined,
    });
  });
});

describe('engine.flow.startMainPhase', () => {
  beforeEach(() => {
    event._resetRegistry();
  });

  it('phase:main:start Hook を emit し、phase を main にする', () => {
    let fired = false;
    event.on('phase:main:start', () => { fired = true; });
    const s = makeStateWithDeck(10);
    const after = produce(s, draft => {
      draft.turn.phase = 'auto';
      startMainPhase(draft, 'self');
    });
    expect(fired).toBe(true);
    expect(after.turn.phase).toBe('main');
  });
});

describe('engine.flow.endTurn', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetUidCounter();
  });

  it('phase:main:end → phase:end:start → phase:end:cleanup → turn:end の順に Hook を emit する', () => {
    const fired: HookName[] = [];
    const watch: HookName[] = ['phase:main:end', 'phase:end:start', 'phase:end:cleanup', 'turn:end'];
    for (const h of watch) {
      event.on(h, () => { fired.push(h); });
    }
    const s = makeStateWithDeck(10);
    produce(s, draft => {
      endTurn(draft, 'self');
    });
    expect(fired).toEqual(['phase:main:end', 'phase:end:start', 'phase:end:cleanup', 'turn:end']);
  });

  it('endTurn 後 turn.number が +1 され、turn.player が入替わる', () => {
    const s = makeStateWithDeck(10, { player: 'self', turnNo: 3 });
    const after = produce(s, draft => {
      endTurn(draft, 'self');
    });
    expect(after.turn.number).toBe(4);
    expect(after.turn.player).toBe('opp');
  });

  it('opp 側 endTurn でも対称に player が self に戻る', () => {
    const s = makeStateWithDeck(10, { player: 'opp', turnNo: 4 });
    const after = produce(s, draft => {
      endTurn(draft, 'opp');
    });
    expect(after.turn.number).toBe(5);
    expect(after.turn.player).toBe('self');
  });

  it('endTurn 中の phase は end に遷移する (Hook 発火時点で参照可)', () => {
    let phaseAtStart: string | undefined;
    event.on('phase:end:start', (s) => { phaseAtStart = s.turn.phase; });
    const s = makeStateWithDeck(10);
    produce(s, draft => {
      endTurn(draft, 'self');
    });
    expect(phaseAtStart).toBe('end');
  });

  it('phase:end:cleanup payload は { player } 形式 (spec 準拠)', () => {
    let cleanupPayload: unknown;
    event.on('phase:end:cleanup', (_s, p) => { cleanupPayload = p; });
    const s = makeStateWithDeck(10);
    produce(s, draft => {
      endTurn(draft, 'self');
    });
    expect(cleanupPayload).toEqual({ player: 'self' });
  });

  it('ターン終了時効果を終了時清掃より先に解決し、終了プレイヤーを優先する', () => {
    const s = produce(makeStateWithDeck(10), draft => {
      draft.players.self.scene = [sceneChar('SELF-END', 'self-end')];
      draft.players.opp.scene = [sceneChar('OPP-END', 'opp-end')];
    });
    event.on('phase:end:start', (state) => {
      event.queue(
        state,
        { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: 'self-end', key: 'apMod_turn', val: 1000 } },
        { player: 'self', uid: 'self-end' },
      );
      event.queue(
        state,
        { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: 'opp-end', key: 'apMod_turn', val: 1000 } },
        { player: 'opp', uid: 'opp-end' },
      );
    });

    const after = produce(s, draft => {
      endTurn(draft, 'self');
      runAllUntilEmpty(draft);
    });

    const resolvedTargets = after.log
      .filter(entry => entry.action === 'effect:charSetTurnEffect')
      .map(entry => entry.target);
    expect(resolvedTargets).toEqual(['self-end', 'opp-end']);
    expect(after.players.self.scene[0]?.turnEffects.apMod_turn).toBeUndefined();
    expect(after.players.opp.scene[0]?.turnEffects.apMod_turn).toBeUndefined();
    expect(after.turn).toMatchObject({ number: 2, player: 'opp' });
  });
});
