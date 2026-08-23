// engine-extension set-card 除去 batch (2026-06-06 タスクC) — charRemoveSetCard verb + B08034 工藤優作。
//
// 検証: 在場キャラから setCard を1枚リムーブする新 verb。B08034 a2 の chain
//   ([charRemoveSetCard{hasSetCards}, draw]) が「セットされたカードを1枚リムーブしてもよい。そうした場合1引く」を
//   忠実に表現する (set card 有り→リムーブ+draw / 無し→chain break で draw なし)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { doReasoning } from '@/engine/flow/main/reasoning';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B08034 } from '@/cards/ct-p08/B08034';
import { B08034P } from '@/cards/ct-p08/B08034P';
import type { GameState, SceneCharacter, SetCardEntry } from '@/engine/types';
import { sceneChar as baseScene } from '../helpers/fixtures';

function sceneChar(cardId: string, uid: string, setCards: SetCardEntry[] = []): SceneCharacter {
  return baseScene(cardId, uid, { setCards });
}

describe('engine-extension set-card 除去 batch (2026-06-06)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('card def: a1=enter(事件白+パートナー白) / a2=reasoning:end chain(charRemoveSetCard, draw)', () => {
    expect(B08034.rarity).toBe('R');
    expect(B08034P.rarity).toBe('RP');
    expect(B08034.abilities[0].trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(B08034.abilities[1].trigger).toMatchObject({ hook: 'reasoning:end', matcherCondition: { kind: 'triggerCharMatches', side: 'self' } });
    const a2eff = B08034.abilities[1].effect as { kind: string; steps: { verb?: string }[] };
    expect(a2eff.kind).toBe('chain');
    expect(a2eff.steps[0]?.verb).toBe('charRemoveSetCard');
  });

  it('a2: setCard を持つキャラがいる → 推理で setCard を1枚リムーブ + 1ドロー', () => {
    const policy = new HeuristicPolicy();
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    // B08034 (推理する) + holder (setCard 1枚保持)
    s.players.self.scene = [
      sceneChar('B08034', 'kudo#1'),
      sceneChar('D08009', 'holder#1', [{ cardId: 'D08003', faceUp: false }]),
    ];
    s.players.self.deck = ['e1', 'e2', 'draw1', 'x']; // LP2 で e1/e2 証拠化 + a2 draw で draw1
    s = produce(s, (d) => {
      doReasoning(d, 'kudo#1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, policy);
    });
    const holder = s.players.self.scene.find((c) => c.uid === 'holder#1');
    expect(holder?.setCards.length, 'setCard が1枚リムーブされた (0 枚に)').toBe(0);
    expect(s.players.self.remove, 'リムーブした setCard (D08003) がリムーブエリアへ (rules/16)').toContain('D08003');
    expect(s.players.self.hand, 'そうした場合 1ドロー (draw1)').toContain('draw1');
  });

  it('a2: setCard を持つキャラが居ない → chain break で 1ドローしない', () => {
    const policy = new HeuristicPolicy();
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B08034', 'kudo#1')]; // setCard 保持キャラ無し
    s.players.self.deck = ['e1', 'e2', 'draw1', 'x'];
    s = produce(s, (d) => {
      doReasoning(d, 'kudo#1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, policy);
    });
    expect(s.players.self.hand, 'setCard 無し → リムーブ不能 → draw なし (chain break)').not.toContain('draw1');
  });
});
