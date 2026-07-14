// B09096 キャンティ G15 relative-AP filter — engine0 wave 2026-06-29 (stale-yellow 解禁の回帰固定)。
// 主張: filter:{apMin:{dyn:'$self.ap'}, apMax:{dyn:'$self.ap'}} が resolve-picks.resolveTargetFilterDyn で
//   pick 列挙前に $self の実効AP へ literalize され、targetCandidates が「同じAP」のみ候補化する (engine変更0)。
//   certify-yellow (apMin/apMax は number 静的のみ、{dyn} 不可) は cluster12 nested-filter-dyn 解禁前の stale。
// 経路: runEffect(a1.effect) → AI drain。SAME-AP decoy は除去 / DIFF-AP decoy は残存 で behavioral 実証。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { makeChar } from '../helpers/fixtures';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';
import { B09096 } from '@/cards/ct-p09/B09096';
import { B09096P } from '@/cards/ct-p09/B09096P';

function pchar(id: string, ap: number): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['黒'],
    level: 5, ap, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

const inScene = (s: GameState, side: 'self' | 'opp', cardId: string) =>
  s.players[side].scene.some((c) => c.cardId === cardId);

function driveA1(mutate: (s: GameState) => void, selfApOverride: number | null = null): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  mutate(s);
  const a1 = B09096.abilities.find((a) => a.id === 'a1')!;
  return produce(s, (d) => {
    const ctx = { source: { player: 'self', cardId: 'B09096', uid: 'kan#1', abilityId: 'a1', area: 'scene' }, bindings: {} } as unknown as EffectCtx;
    runEffect(d, a1.effect as never, ctx);
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    }
  });
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  _resetUidCounter();
  registerCardDef(B09096);
  registerCardDef(pchar('SAME', 3000)); // B09096 と同AP
  registerCardDef(pchar('DIFF', 5000)); // 別AP
  registerCardDef(pchar('SAME5', 5000)); // dyn liveness 用 (override 後の self AP=5000 に一致)
});

describe('B09096 G15 — apMin/apMax {dyn:$self.ap} で「同じAP」のみ候補化 (engine変更0)', () => {
  it('SAME-AP(3000) は除去、DIFF-AP(5000) は残存', () => {
    const s = driveA1((st) => {
      st.players.self.scene = [makeChar({ cardId: 'B09096', uid: 'kan#1', state: 'active' })];
      st.players.opp.scene = [
        makeChar({ cardId: 'SAME', uid: 'same#1', state: 'active' }),
        makeChar({ cardId: 'DIFF', uid: 'diff#1', state: 'active' }),
      ];
    });
    expect(inScene(s, 'opp', 'SAME'), 'AP一致(3000) は除去される').toBe(false);
    expect(inScene(s, 'opp', 'DIFF'), 'AP不一致(5000) は残存する').toBe(true);
  });

  it('対象が全て DIFF-AP のみ → 候補0 で何も除去しない (0枚可)', () => {
    const s = driveA1((st) => {
      st.players.self.scene = [makeChar({ cardId: 'B09096', uid: 'kan#1', state: 'active' })];
      st.players.opp.scene = [makeChar({ cardId: 'DIFF', uid: 'diff#1', state: 'active' })];
    });
    expect(inScene(s, 'opp', 'DIFF'), 'AP不一致のみ → 残存').toBe(true);
  });

  it('dyn liveness: self の実効AP を override で 5000 にすると 5000 が一致対象になる (定数3000 ではない)', () => {
    const s = driveA1((st) => {
      st.players.self.scene = [makeChar({ cardId: 'B09096', uid: 'kan#1', state: 'active', apOverride: 5000 })];
      st.players.opp.scene = [
        makeChar({ cardId: 'SAME5', uid: 's5#1', state: 'active' }),  // ap5000 = override後 self に一致
        makeChar({ cardId: 'SAME', uid: 'same#1', state: 'active' }), // ap3000 = 元 def 値 (不一致のはず)
      ];
    });
    expect(inScene(s, 'opp', 'SAME5'), 'override後 self AP=5000 に一致 → 除去').toBe(false);
    expect(inScene(s, 'opp', 'SAME'), 'def値3000 は override後 self(5000) と不一致 → 残存').toBe(true);
  });
});

describe('B09096P — base と effect 構造一致 (同テキスト別ファイル full def)', () => {
  it('a1.effect が B09096 と byte 等価 (filter dyn 含む)', () => {
    const base = B09096.abilities.find((a) => a.id === 'a1')!.effect;
    const para = B09096P.abilities.find((a) => a.id === 'a1')!.effect;
    expect(JSON.stringify(para)).toBe(JSON.stringify(base));
    expect(B09096P.ap).toBe(B09096.ap); // 3000 — $self.ap 参照が両者で同値
  });
});
