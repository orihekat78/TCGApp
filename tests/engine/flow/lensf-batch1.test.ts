// tests/engine/flow/lensf-batch1 — Lens F 監査 修正バッチ1 (BUG-099 / BUG-101)
// A (BUG-099): canDeclaredAbility が ability.condition を評価 (declared gate)。
// G (BUG-101): D11005 挑発 mustBeTargeted の set (val) / legal-target 限定 / endTurn 解除 / enumerator gate。

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { mustTargetCandidates } from '@/engine/flow/action/target-expander';
import { D08026 } from '@/cards/ct-d08/D08026';
import { D11005 } from '@/cards/ct-d11/D11005';
import type { GameState } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';

function sceneChar(cardId: string, uid: string, state: 'active' | 'sleep' = 'active') {
  return baseScene(cardId, uid, { state });
}

describe('A (BUG-099): canDeclaredAbility が ability.condition を gate する', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    engine.cards.register(D08026);
  });

  // D08026 a2 condition = { kind:'caseStatus', status:'解決編' }
  function stateWithCaseStatus(status: '事件編' | '解決編'): GameState {
    return produce(createEmptyGameState(), (d) => {
      d.players.self.case = { cardId: 'D08026', status, requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
    });
  }

  it('事件編 では D08026 a2 (【解決編】要件) を宣言できない', () => {
    const s = stateWithCaseStatus('事件編');
    expect(engine.flow.canDeclaredAbility(s, 'case:self', 'a2')).toBe(false);
  });

  it('解決編 では D08026 a2 を宣言できる', () => {
    const s = stateWithCaseStatus('解決編');
    expect(engine.flow.canDeclaredAbility(s, 'case:self', 'a2')).toBe(true);
  });
});

describe('G (BUG-101): D11005 挑発 mustBeTargeted', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    engine.cards.register(D11005);
  });

  it('G1: charSetTurnEffect (val:true) で mustBeTargeted=true がセットされる', () => {
    let s = produce(createEmptyGameState(), (d) => {
      d.players.self.scene.push(sceneChar('D11005', 'D11005#0', 'active'));
    });
    s = produce(s, (d) => {
      engine.effect.runAtom(d, 'charSetTurnEffect', { uid: 'D11005#0', key: 'mustBeTargeted', val: true, scope: 'opp-turn' },
        { source: { player: 'self', uid: 'D11005#0', area: 'scene' }, bindings: {} });
    });
    expect(s.players.self.scene[0].turnEffects.mustBeTargeted).toBe(true);
  });

  it('G3: sleep な mustBeTargeted は強制対象、active なら強制しない (指定できる場合のみ)', () => {
    // opp 視点で self の挑発キャラを対象に取る — actor は opp の active キャラ
    const base = (defenderState: 'active' | 'sleep') => produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      d.players.opp.scene.push(sceneChar('D11005', 'ATK#0', 'active')); // 攻撃者 (cardId 流用)
      d.players.self.scene.push(sceneChar('D11005', 'TAUNT#0', defenderState));
      d.players.self.scene.push(sceneChar('D11005', 'OTHER#0', 'sleep'));
      d.players.self.scene[0].turnEffects.mustBeTargeted = true; // TAUNT#0
    });
    // TAUNT sleep → 強制対象に含まれる
    const sSleep = base('sleep');
    const mustSleep = mustTargetCandidates(sSleep, 'ATK#0');
    expect(mustSleep.map((c) => c.uid)).toEqual(['TAUNT#0']);
    expect(engine.flow.canActionAgainstChar(sSleep, 'ATK#0', 'OTHER#0')).toBe(false); // 強制対象外
    expect(engine.flow.canActionAgainstChar(sSleep, 'ATK#0', 'TAUNT#0')).toBe(true);
    // TAUNT active → 対象に取れない = 強制しない (OTHER を普通に狙える)
    const sActive = base('active');
    expect(mustTargetCandidates(sActive, 'ATK#0').length).toBe(0);
    expect(engine.flow.canActionAgainstChar(sActive, 'ATK#0', 'OTHER#0')).toBe(true);
  });

  it('G2: endTurn で相手 (設定者) scene の mustBeTargeted が解除される', () => {
    // self が挑発を持つ。self ターン終了 (endTurn(self)) では解除されない (相手=opp scene を清掃)。
    // opp ターン終了 (endTurn(opp)) で self scene が清掃され解除。
    let s = produce(createEmptyGameState(), (d) => {
      d.players.self.scene.push(sceneChar('D11005', 'D11005#0', 'sleep'));
      d.players.self.scene[0].turnEffects.mustBeTargeted = true;
    });
    s = produce(s, (d) => { engine.flow.endTurn(d, 'self'); }); // 自ターン終了: 解除されない
    expect(s.players.self.scene[0].turnEffects.mustBeTargeted).toBe(true);
    s = produce(s, (d) => { engine.flow.endTurn(d, 'opp'); }); // 相手ターン終了: 解除
    expect(s.players.self.scene[0].turnEffects.mustBeTargeted).toBeUndefined();
  });
});
