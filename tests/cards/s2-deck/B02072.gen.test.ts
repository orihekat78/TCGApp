// qa: card:B02072:d318ff70e45401b63348e1dc41c896a174b47ebc5076d2054aa468915f989c1a
// qa: card:B02072:a15bc8904cf0cb368b744793b86426eca39c0ce555e83702b3f347197fbc1391
// qa: card:B02072:dde8a4e3f3585a2b42d029aa8be1b6b10cf73aa59f7523c3f9064c44887a88e6
// qa: card:B02072:d370f1b6e59c56f2d1bd035a04300d6b1292944bc2328768ee314b6a7f84ae47
// tests/cards/s2-deck/B02072.gen — HAND-AUTHORED (S2 deck cluster, souza dyn X + levelSum 閾値)。
//
// production dispatch (activateDeclaredAbility + runAllUntilEmpty) で novel 部を pin:
//   (a) souza x = {dyn:'$self.sceneTrait.警察'} — 自現場の[警察]数 (スリープ済の自身含む) だけ相手デッキ公開。
//   (b) sceneRemove filter levelMax = {dyn:'$bound.$found.levelSum'} — 発見カードの printed level 合計が閾値。
//   (c) しきい値境界: sum ちょうど = 候補 / sum+1 = 候補外 (candidatesExclude)。
//   (d) 「1枚まで」= 0枚可 → 候補 0 なら prompt 自体が出ない。
//   ⚠ chain 必須 (sequence だと pre-walk で levelSum が 0 bake) — 本 probe の (c) が退行検知を兼ねる。
//
// MANUAL-NOTE: souza は相手デッキ top X を公開→デッキ下へ移す (deck 枚数不変)。deckDelta 側は opp n:0。

import { describe, expect, it, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, register } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';
import { applyDeckReorderAndContinuation } from '@/engine/effect/apply-pick';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import {
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import { runCardScenario } from '../../helpers/card-probe-harness';
import type { ProbeScenario } from '../../helpers/card-probe-harness';
import { B02072 } from '@/cards/ct-p02/B02072';
import type { CardDef } from '@/engine/types';

function ch(id: string, level: number, traits: string[] = []): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黄'],
    level, ap: 3000, lp: 1, traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}
// 相手デッキ top seed (printed level 既知) — 公開枚数 X で sum を制御
const P2 = ch('P2', 2);
const P3 = ch('P3', 3);
const P9 = ch('P9', 9); // X=2 のとき window 外 (3枚目)
// 自現場の[警察] (X 計数用)
const COP = ch('COP', 4, ['警察']);
const CIV = ch('CIV', 4); // 特徴外 — X に数えない
// 除去対象 decoy (しきい値境界)
const D5 = ch('D5', 5);
const D6 = ch('D6', 6);

const FIXTURES: CardDef[] = [P2, P3, P9, COP, CIV, D5, D6];

const SCENARIOS: ProbeScenario[] = [
  {
    // (a)(b)(c): 自現場 = B02072(警察)+COP(警察)+CIV(特徴外) → X=2。oppDeck top [P2,P3,P9] →
    // 発見 = P2+P3 (sum=5)。D5(lv5=sum) 候補&除去 / D6(lv6=sum+1) 候補外。
    name: 'B02072 dyn X=2 (自身+COP) → 発見 sum=5: D5 候補&除去 / D6 候補外',
    setup: {
      selfScene: [{ cardId: 'B02072', uid: 'u0' }, { cardId: 'COP', uid: 'u1' }, { cardId: 'CIV', uid: 'u2' }],
      oppScene: [{ cardId: 'D5', uid: 'u5' }, { cardId: 'D6', uid: 'u6' }],
      oppDeckTop: ['P2', 'P3', 'P9'], oppDeckSize: 0,
      deckSize: 5, fileCount: 3,
    },
    drive: { kind: 'declared', uid: 'u0', abilityId: 'a1' },
    script: [{ pickCardId: 'D5' }],
    expect: [
      { kind: 'state', uid: 'u0', state: 'sleep' },                        // 【スリープ】コスト
      { kind: 'candidatesExclude', pickIndex: 0, cardId: 'D6' },           // lv6 > sum5 → 候補外
      { kind: 'zone', cardId: 'D5', zone: 'scene', side: 'opp', present: false }, // 除去された
      { kind: 'zone', cardId: 'D6', zone: 'scene', side: 'opp', present: true },
      { kind: 'deckDelta', side: 'opp', n: 0 },                            // souza = 公開→下移送 (枚数不変)
      { kind: 'zone', cardId: 'P9', zone: 'deck', side: 'opp', present: true },  // window 外はそのまま deck
    ],
  },
  {
    // dyn X が盤面連動: COP 無し → X=1 (自身のみ)。発見 = P2 のみ (sum=2)。
    // 同じ opp 盤面で D5 が今度は候補外 → prompt 0 (「1枚まで」= 候補0で不発)。
    name: 'B02072 dyn X=1 (自身のみ) → sum=2: 候補0で sceneRemove prompt 無し',
    setup: {
      selfScene: [{ cardId: 'B02072', uid: 'u0' }, { cardId: 'CIV', uid: 'u2' }],
      oppScene: [{ cardId: 'D5', uid: 'u5' }],
      oppDeckTop: ['P2', 'P3'], oppDeckSize: 0,
      deckSize: 5, fileCount: 3,
    },
    drive: { kind: 'declared', uid: 'u0', abilityId: 'a1' },
    script: [],
    expect: [
      { kind: 'state', uid: 'u0', state: 'sleep' },
      { kind: 'zone', cardId: 'D5', zone: 'scene', side: 'opp', present: true }, // sum=2 < lv5 → 据置
      { kind: 'deckDelta', side: 'opp', n: 0 },
    ],
  },
  {
    // 相手デッキが X 枚未満 → 可能な限り公開・リフレッシュしない (公式Q&A / rules/26)。
    // X=2 だが oppDeck 1枚 → 発見 = P3 のみ (sum=3)。
    name: 'B02072 デッキ不足: X=2 で opp デッキ1枚 → 1枚のみ発見 (sum=3)、リフレッシュ無し',
    setup: {
      selfScene: [{ cardId: 'B02072', uid: 'u0' }, { cardId: 'COP', uid: 'u1' }],
      oppScene: [{ cardId: 'D5', uid: 'u5' }],
      oppDeckTop: ['P3'], oppDeckSize: 0,
      deckSize: 5, fileCount: 3,
    },
    drive: { kind: 'declared', uid: 'u0', abilityId: 'a1' },
    script: [],
    expect: [
      { kind: 'zone', cardId: 'D5', zone: 'scene', side: 'opp', present: true }, // sum=3 < 5 → 候補外で prompt 無し
      { kind: 'zone', cardId: 'P3', zone: 'deck', side: 'opp', present: true },  // 公開後デッキ下へ (リムーブされない)
      { kind: 'deckDelta', side: 'opp', n: 0 },
    ],
  },
];

describe('B02072 — hand-authored probe (souza dyn X + levelSum threshold)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetDefRegistry();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    _clearPendingEffectOptionalSide();
  });

  for (const sc of SCENARIOS) {
    it(sc.name, () => {
      runCardScenario(B02072, FIXTURES, sc);
    });
  }

  it('lets only the defending deck owner order the found cards without exposing that order in the log', () => {
    [B02072, ...FIXTURES].forEach(register);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    const state = createEmptyGameState();
    state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(B02072.id, 'u0'), sceneChar(COP.id, 'u1')];
    state.players.opp.deck = [P2.id, P3.id, P9.id];

    activateDeclaredAbility(state, 'u0', 'a1');
    runAllUntilEmpty(state);
    const reorder = _drainPendingDeckReorderSide();
    expect(reorder).toMatchObject({ player: 'opp', cardIds: [P2.id, P3.id] });
    expect(JSON.stringify(state.log)).not.toContain(P2.id);
    expect(JSON.stringify(state.log)).not.toContain(P3.id);

    applyDeckReorderAndContinuation(state, reorder!, [P3.id, P2.id]);
    expect(state.players.opp.deck).toEqual([P9.id, P3.id, P2.id]);
  });

  it('reveals the only available card for X=2 without refreshing the short deck', () => {
    [B02072, ...FIXTURES].forEach(register);
    const state = createEmptyGameState();
    state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(B02072.id, 'u0'), sceneChar(COP.id, 'u1')];
    state.players.opp.deck = [P3.id];

    activateDeclaredAbility(state, 'u0', 'a1');
    runAllUntilEmpty(state);

    expect(state.log.findLast((entry) => entry.action === 'souza')?.result).toBe('revealed 1');
    expect(state.players.opp.deck).toEqual([P3.id]);
    expect(state.refreshCount.opp).toBe(0);
  });
});
