// Task A certify-harvest needsManual 手書き 3枚の検証。
//   B06101 キャンティ — 【カットイン】黒キャラに AP+1000 (contactTargetMatches colors)
//   D10011 毛利小五郎 — 【宣言】reanimate 毛利蘭 + 【カットイン】毛利蘭に AP+3000 (contactTargetMatches names)
//   B09008 赤木英雄 — AP6000以上で〚突撃〛(continuous apAtLeast self) + 【登場時】opt charRemoveSetCard
//
// 最重要: B09008 a1 = apAtLeast{self} を continuous condition に使う未実証パターンの実挙動確認
//   (基礎AP5000 → 突撃なし / apOverride 6000 → 突撃あり)。read.char.keywords() で読む。

import { describe, it, expect, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { read } from '@/engine/read';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import type { GameState, SceneCharacter, AbilityDef } from '@/engine/types';
import { B06101 } from '@/cards/ct-p06/B06101';
import { D10011 } from '@/cards/ct-d10/D10011';
import { B09008 } from '@/cards/ct-p09/B09008';
import { sceneChar as baseScene } from '../helpers/fixtures';

function sceneChar(cardId: string, uid: string, apOverride: number | null = null): SceneCharacter {
  return baseScene(cardId, uid, { apOverride });
}

describe('Task A certify-harvest — needsManual 手書き 3枚', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ---- B09008 a1: apAtLeast continuous 〚突撃〛 (実挙動) ----
  it('B09008: 基礎AP5000では突撃なし / AP6000以上(override)で突撃を持つ', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [sceneChar('B09008', 'akagi#1')]; // 基礎AP5000
    expect(read.char.ap(s, 'akagi#1'), '基礎AP 5000').toBe(5000);
    expect(read.char.keywords(s, 'akagi#1'), 'AP<6000 は突撃なし').not.toContain('突撃');

    const s2: GameState = createEmptyGameState();
    s2.players.self.scene = [sceneChar('B09008', 'akagi#1', 6000)]; // 元のAP6000
    expect(read.char.ap(s2, 'akagi#1'), 'override AP 6000').toBe(6000);
    expect(read.char.keywords(s2, 'akagi#1'), 'AP>=6000 で突撃').toContain('突撃');
  });

  it('B09008: a2 = enter opt → chain[discard, charRemoveSetCard side:either]', () => {
    const a2 = B09008.abilities[1] as AbilityDef;
    expect(a2.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const eff = a2.effect as { kind: string; effect: { kind: string; steps: Array<{ verb: string; args: Record<string, unknown> }> } };
    expect(eff.kind).toBe('optional');
    expect(eff.effect.kind).toBe('chain');
    expect(eff.effect.steps.map((x) => x.verb)).toEqual(['discard', 'charRemoveSetCard']);
    expect(eff.effect.steps[1].args).toMatchObject({ max: 1, side: 'either', filter: { hasSetCards: true } });
  });

  // ---- B06101 / D10011: cutin contactTargetMatches ----
  it('B06101: keywords[突撃] + cutin (effect:declared/on-hand/optional/selfOnly) conditional charModifyAP+1000', () => {
    expect((B06101 as { keywords: string[] }).keywords).toEqual(['突撃']);
    const a1 = B06101.abilities[0] as AbilityDef;
    expect(a1.scope).toBe('on-hand');
    expect(a1.trigger).toMatchObject({ hook: 'effect:declared', optional: true, selfOnly: true });
    const eff = a1.effect as { kind: string; if: { kind: string }; then: { verb: string; args: Record<string, unknown> } };
    expect(eff.kind).toBe('conditional');
    // BUG-177 (2026-07-09): contactTargetMatches は custom closure → serializable contactCharMatches
    // (who:'byUid'=自コンタクトキャラ、B02006 公式Q&A 準拠) に移行。
    expect(eff.if.kind, 'contactTargetMatches → contactCharMatches 条件').toBe('contactCharMatches');
    expect(eff.if).toMatchObject({ who: 'byUid', filter: { color: ['黒'] } });
    expect(eff.then).toMatchObject({ verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } });
  });

  it('D10011: a1 declared reanimate毛利蘭(FILE6/turn1/selfToDeckBottom) + a2 cutin 自分ターン中 +3000', () => {
    const [a1, a2] = D10011.abilities as AbilityDef[];
    expect(a1.type).toBe('declared');
    expect(a1.condition).toEqual({ kind: 'fileAtLeast', n: 6 });
    expect(a1.limit).toMatchObject({ kind: 'turn', n: 1 });
    expect(a1.cost).toEqual({ kind: 'selfToDeckBottom' });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', filter: { cardName: '毛利蘭', levelMax: 7 } } });
    expect(a2.condition).toEqual({ kind: 'turn', player: 'self' });
    const e2 = a2.effect as { kind: string; if: { kind: string }; then: { args: Record<string, unknown> } };
    expect(e2.kind).toBe('conditional');
    expect(e2.then.args).toMatchObject({ uid: '$contact.byUid', delta: 3000, scope: 'contact' });
  });
});
