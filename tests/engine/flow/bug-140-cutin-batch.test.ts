// qa: card:B03028:d5ed43d6e9854041a9d21e09941ee12b53c86ab6a330a20e63d83cef33a88a45
// qa: card:B08020:d0447a989e2ce1eae2c62ea7297724ea5fe7015808c2a90c2e3be0d2a4e7821f
// tests/engine/flow/bug-140-cutin-batch — BUG-140 補修 (2026-06-13) の cutin 挙動検証
//
// rules: 09-cutin-disguise.md, 22-qa-action-contact.md
// bug: .claude/bugs/BUG-140.md
//
// TSV cutIn 列の取りこぼし補修 3 テンプレを、代表カード 1 枚ずつ実 contact 経路で検証する:
//   c-ap1000 : B03129 (【カットイン】AP＋1000)
//   c-ap2000 : B07093 (【カットイン】AP＋2000)
//   c-turnAP : B03026 (【自分ターン中】AP＋1000 / 【相手ターン中】AP＋3000 — 両分岐)
// ハーネスは tests/engine/flow/lensf-batch2b-cutin.test.ts と同一。

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _setHumanPlayerSide, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { cutIn } from '@/engine/flow/contact';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { registerAll } from '@/cards/index';
import type { GameState, ActionContext } from '@/engine/types';

describe('BUG-140 補修 cutin 挙動 (テンプレ代表 3 枚)', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    event._resetRegistry();
    _resetTriggeredRegistered();
    registerAll();
    _setHumanPlayerSide('self');
    registerTriggeredListener();
  });

  // self が D11005 で攻撃、opp が D11018 で防御するコンタクトを構築
  function setup(handCard: string, handOwner: 'self' | 'opp'): { s: GameState; selfUid: string; oppUid: string; ax: ActionContext } {
    let s = createEmptyGameState();
    let selfUid = '';
    let oppUid = '';
    s = produce(s, (d) => {
      const a = engine.mutate.scene.enter(d, 'self', 'D11005', {});
      selfUid = a.uid;
      const def = engine.mutate.scene.enter(d, 'opp', 'D11018', {});
      oppUid = def.uid;
      engine.mutate.hand.add(d, handOwner, [handCard]);
    });
    const ax: ActionContext = {
      id: 'ax1', byUid: selfUid, byPlayer: 'self', target: { kind: 'char', uid: oppUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: selfUid, aAP: engine.read.char.ap(s, selfUid), bUid: oppUid, bAP: engine.read.char.ap(s, oppUid) },
      contactImmune: false,
    } as ActionContext;
    return { s, selfUid, oppUid, ax };
  }

  it('c-ap1000 B03129: opp がカットイン → 防御キャラ AP+1000', () => {
    const { s, selfUid, oppUid, ax } = setup('B03129', 'opp');
    const before = engine.read.char.ap(s, oppUid);
    const selfBefore = engine.read.char.ap(s, selfUid);
    const after = produce(s, (d) => { cutIn(d, ax, 'opp', 'B03129'); runAllUntilEmpty(d); });
    expect(engine.read.char.ap(after, oppUid)).toBe(before + 1000);
    expect(engine.read.char.ap(after, selfUid)).toBe(selfBefore); // 攻撃側には乗らない
    expect(after.players.opp.hand).not.toContain('B03129'); // 使用済 (手札から離れる)
  });

  it('a green Cut-in is not an event-use trigger for B03028 or B08020', () => {
    const { s, ax } = setup('B05042', 'self');
    const after = produce(s, (d) => {
      d.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      engine.mutate.scene.enter(d, 'self', 'B03028', {});
      engine.mutate.scene.enter(d, 'self', 'B08020', {});
      cutIn(d, ax, 'self', 'B05042');
      runAllUntilEmpty(d);
    });

    for (const cardId of ['B03028', 'B08020']) {
      const observer = after.players.self.scene.find((card) => card.cardId === cardId)!;
      expect(observer.declaredUseCount.a2, cardId).toBeUndefined();
      expect(after.pendingEffects.some((entry) => entry.source.cardId === cardId), cardId).toBe(false);
    }
  });

  it('c-ap2000 B07093: opp がカットイン → 防御キャラ AP+2000', () => {
    const { s, oppUid, ax } = setup('B07093', 'opp');
    const before = engine.read.char.ap(s, oppUid);
    const after = produce(s, (d) => { cutIn(d, ax, 'opp', 'B07093'); runAllUntilEmpty(d); });
    expect(engine.read.char.ap(after, oppUid)).toBe(before + 2000);
  });

  it('c-turnAP B03026: 非ターン側 (opp) がカットイン → 【相手ターン中】分岐で AP+3000', () => {
    // state.turn.player = 'self' (state-factory 既定)。owner=opp 視点では相手ターン中 → +3000
    const { s, oppUid, ax } = setup('B03026', 'opp');
    const before = engine.read.char.ap(s, oppUid);
    const after = produce(s, (d) => { cutIn(d, ax, 'opp', 'B03026'); runAllUntilEmpty(d); });
    expect(engine.read.char.ap(after, oppUid)).toBe(before + 3000);
  });

  it('c-turnAP B03026: ターン側 (self) がカットイン → 【自分ターン中】分岐で AP+1000', () => {
    const { s, selfUid, ax } = setup('B03026', 'self');
    const before = engine.read.char.ap(s, selfUid);
    const after = produce(s, (d) => { cutIn(d, ax, 'self', 'B03026'); runAllUntilEmpty(d); });
    expect(engine.read.char.ap(after, selfUid)).toBe(before + 1000);
  });
});
