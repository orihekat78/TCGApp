// tests/engine/effect/player-resolution-bug
// 仮説検証: CPU 側 (opp) card の enter trigger で `player: 'self'` リテラルが
//   誤って絶対 ID 'self' (=人間) として解釈され、CPU の D11003/D08013/D08021
//   等が人間に evidence を与えてしまっていないか。
//
// User 報告 (2026-05-25): 「相手ターン中に自分の証拠が一枚増えた」
// 痕跡未発見のままだったので refresh-penalty 経由ではない。
// → atom-handlers.ts の `const p = a.player as Player;` リテラル解釈が原因の疑い。

import { describe, it, expect, beforeAll } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerTriggeredListener } from '@/engine/listeners/triggered';
import { produce, setAutoFreeze, enableMapSet } from 'immer';

beforeAll(async () => {
  setAutoFreeze(false);
  enableMapSet();
  const { registerAll } = await import('@/cards/index');
  registerAll();
  registerTriggeredListener();
});

describe('Player resolution bug — CPU card `player: self` should grant CPU (not human)', () => {
  it('D11003 enter (CPU side, enterOrder=1) → CPU evidence +1, human evidence unchanged', async () => {
    const { event } = await import('@/engine/event/index');
    const { runAllUntilEmpty } = await import('@/engine/resolve/stack');
    const s0 = createEmptyGameState();

    // deck に dummy card を追加 (evidenceGain は deck top を evidence に積むため)
    const s0b = produce(s0, (draft) => {
      draft.players.opp.deck.push({ cardId: 'D11003' });
      draft.players.self.deck.push({ cardId: 'D11003' });
    });

    const selfEvidenceBefore = s0b.players.self.evidence.length;
    const oppEvidenceBefore = s0b.players.opp.evidence.length;

    // CPU 側 scene に D11003 を 1 番目として登場させ、enter hook を emit
    const s1 = produce(s0b, (draft) => {
      // CPU 側 scene を空にしてから D11003 を 1 番目で登場
      draft.players.opp.scene.length = 0;
      draft.players.opp.scene.push({
        cardId: 'D11003',
        uid: 'D11003#opp-0',
        state: 'active',
        ap: 8000,
        lp: 1,
        level: 8,
        namedThisTurn: true,
        mods: { ap: 0, lp: 0, scope: 'turn' },
      } as never);

      // enter hook emit (enterOrder=1 で D11003 a1 matcher が通る)
      event.emit(
        draft,
        'enter',
        { enterOrder: 1 },
        { player: 'opp', uid: 'D11003#opp-0', cardId: 'D11003' },
      );

      runAllUntilEmpty(draft);
    });

    const selfEvidenceAfter = s1.players.self.evidence.length;
    const oppEvidenceAfter = s1.players.opp.evidence.length;

    // 期待値:
    //   - CPU が evidenceGain → CPU (opp) の evidence が +1
    //   - 人間 (self) の evidence は変化なし
    // バグの場合:
    //   - 人間 (self) の evidence が +1 (リテラル 'self' を絶対解釈)
    //   - CPU (opp) の evidence は変化なし

    expect({
      selfDelta: selfEvidenceAfter - selfEvidenceBefore,
      oppDelta: oppEvidenceAfter - oppEvidenceBefore,
    }).toEqual({
      selfDelta: 0,
      oppDelta: 1,
    });
  });

  it('control: D11003 enter (HUMAN side, enterOrder=1) → human evidence +1, opp unchanged', async () => {
    const { event } = await import('@/engine/event/index');
    const { runAllUntilEmpty } = await import('@/engine/resolve/stack');
    const s0 = createEmptyGameState();

    const s0b = produce(s0, (draft) => {
      draft.players.self.deck.push({ cardId: 'D11003' });
    });

    const selfBefore = s0b.players.self.evidence.length;
    const oppBefore = s0b.players.opp.evidence.length;

    const s1 = produce(s0b, (draft) => {
      draft.players.self.scene.length = 0;
      draft.players.self.scene.push({
        cardId: 'D11003',
        uid: 'D11003#self-0',
        state: 'active',
        ap: 8000, lp: 1, level: 8,
        namedThisTurn: true,
        mods: { ap: 0, lp: 0, scope: 'turn' },
      } as never);

      event.emit(
        draft,
        'enter',
        { enterOrder: 1 },
        { player: 'self', uid: 'D11003#self-0', cardId: 'D11003' },
      );

      runAllUntilEmpty(draft);
    });

    expect({
      selfDelta: s1.players.self.evidence.length - selfBefore,
      oppDelta: s1.players.opp.evidence.length - oppBefore,
    }).toEqual({
      selfDelta: 1,
      oppDelta: 0,
    });
  });

  it('D08013 enter (CPU side) → CPU が evidence+1 → hand に移動 (人間 side ではなく)', async () => {
    const { event } = await import('@/engine/event/index');
    const { runAllUntilEmpty } = await import('@/engine/resolve/stack');
    const s0 = createEmptyGameState();

    const s0b = produce(s0, (draft) => {
      draft.players.opp.deck.push({ cardId: 'D08013' });
      draft.players.opp.hand.push({ cardId: 'D08013' }); // discard step 3 のため
    });

    const selfEvBefore = s0b.players.self.evidence.length;
    const oppEvBefore = s0b.players.opp.evidence.length;
    const selfHandBefore = s0b.players.self.hand.length;
    const oppHandBefore = s0b.players.opp.hand.length;

    const s1 = produce(s0b, (draft) => {
      draft.players.opp.scene.length = 0;
      draft.players.opp.scene.push({
        cardId: 'D08013',
        uid: 'D08013#opp-0',
        state: 'active',
        ap: 0, lp: 0, level: 4,
        namedThisTurn: true,
        mods: { ap: 0, lp: 0, scope: 'turn' },
      } as never);

      event.emit(
        draft,
        'enter',
        { enterOrder: 1 },
        { player: 'opp', uid: 'D08013#opp-0', cardId: 'D08013' },
      );

      runAllUntilEmpty(draft);
    });

    // D08013 step 1 (evidenceGain) のみ確認:
    // CPU の card で player: 'self' なので、CPU (opp) に evidence +1 のはず
    const selfEvDelta = s1.players.self.evidence.length - selfEvBefore;
    const oppEvDelta = s1.players.opp.evidence.length - oppEvBefore;

    expect({
      selfEvDelta,
      oppEvDelta,
    }).toMatchObject({
      selfEvDelta: 0,    // 人間側は不変
      oppEvDelta: 1,     // CPU 側に +1
    });
  });
});
