// tests/engine/flow/lensf-batch2b-cutin — Lens F batch2b (BUG-104 D11013 防御側カットイン)
// F: cutin の contact binding を p (カットイン側) 視点に補正 (byUid=自分のコンタクト中キャラ、
//    targetUid=相手) + entryToCtx で ctx.contact を展開。
//   → D11013 防御側カットインで (1) AP+1000 が防御キャラに乗る、(2) コンタクト相手が警察なら 1ドロー。

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

describe('BUG-104: D11013 防御側カットイン (ctx.contact + byUid per-player)', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    event._resetRegistry();
    _resetTriggeredRegistered();
    registerAll();
    _setHumanPlayerSide('self');
    registerTriggeredListener();
  });

  // self が attackerCard で攻撃、opp が defenderCard で防御、opp が D11013 をカットイン。
  function run(attackerCard: string): { s: GameState; selfUid: string; oppUid: string; handBefore: number; oppApBefore: number } {
    let s = createEmptyGameState();
    let selfUid = '';
    let oppUid = '';
    s = produce(s, (d) => {
      const a = engine.mutate.scene.enter(d, 'self', attackerCard, {});
      selfUid = a.uid;
      const def = engine.mutate.scene.enter(d, 'opp', 'D11018', {});
      oppUid = def.uid;
      engine.mutate.hand.add(d, 'opp', ['D11013']);
      d.players.opp.deck = ['D11017', 'D11018'];
      d.players.opp.partner.cardId = 'D11001'; // 黄 partner (D11013 a1 condition partnerColor:黄)
    });
    const oppApBefore = engine.read.char.ap(s, oppUid);
    const handBefore = s.players.opp.hand.length;
    const ax: ActionContext = {
      id: 'ax1', byUid: selfUid, byPlayer: 'self', target: { kind: 'char', uid: oppUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: selfUid, aAP: engine.read.char.ap(s, selfUid), bUid: oppUid, bAP: oppApBefore },
      contactImmune: false,
    } as ActionContext;
    s = produce(s, (d) => { cutIn(d, ax, 'opp', 'D11013'); runAllUntilEmpty(d); });
    return { s, selfUid, oppUid, handBefore, oppApBefore };
  }

  it('警察の攻撃者にカットイン → 防御キャラ AP+1000 + 1ドロー', () => {
    const { s, selfUid, oppUid, handBefore, oppApBefore } = run('D11005'); // D11005 = 警察
    // byUid fix: AP+1000 は防御 (opp) キャラに乗る、攻撃 (self) には乗らない
    expect(engine.read.char.ap(s, oppUid)).toBe(oppApBefore + 1000);
    expect(engine.read.char.ap(s, selfUid)).toBe(8000); // D11005 ap=8000 不変
    // ctx.contact fix: コンタクト相手 (攻撃者) が警察 → 1ドロー。D11013 使用 (-1) + draw (+1) = 同数だが
    // hand 内容は drawn card (D11013 でない)。draw が起きたことを deck 減で確認。
    expect(s.players.opp.hand.length).toBe(handBefore); // -D11013 +draw = ±0
    expect(s.players.opp.deck.length).toBe(1); // 2 → 1 (draw した)
    expect(s.players.opp.hand).not.toContain('D11013'); // D11013 は使用済
  });
});
