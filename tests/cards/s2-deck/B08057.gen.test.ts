// tests/cards/s2-deck/B08057.gen — HAND-AUTHORED (S2 deck cluster, remove→deck-bottom 3-tier pick)。
//
// production dispatch (activateDeclaredAbility + runAllUntilEmpty) で novel 部を pin:
//   (a) 宣言条件: 解決編 + 現場レベル7 EXACT ×3 (a1 の +2 適用後の実効レベルで自身も数える)。
//   (b) コスト: sleepSelf + デッキ上9枚リムーブ → コストで積んだ 9 枚も pick 候補になる (公式Q&A)。
//   (c) 3-tier pick: lv5/lv4/lv1 各1枚まで (EXACT filter、逐次 pick で前選択は候補から消える)。
//   (d) 「合わせて3枚移した場合」boundCountCompare eq 3 → sceneToDeck opp 1まで / 2枚以下では発火しない。
//   (e) デッキ8枚以下 → cost-gate 宣言不可。
//
// MANUAL-NOTE: 「好きな順番で」(deckBottomReorderBound) は human 専用 side-channel — harness は
//   識別のみ (engine probe s2-b08057-primitives P3 で pin 済)。並べ替え modal 実機は Playwright で確認。

import { describe, it, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import {
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import { runCardScenario } from '../../helpers/card-probe-harness';
import type { ProbeScenario } from '../../helpers/card-probe-harness';
import { B08057 } from '@/cards/ct-p08/B08057';
import type { CardDef } from '@/engine/types';

function ch(id: string, level: number): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['赤'],
    level, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}
const LV7A = ch('LV7A', 7);
const LV7B = ch('LV7B', 7);
// remove エリア seed (レベル tier 別)
const R5 = ch('R5', 5);
const R5B = ch('R5B', 5);
const R4 = ch('R4', 4);
const R1 = ch('R1', 1);
const R3 = ch('R3', 3); // どの tier にも該当しない decoy
const OPPC = ch('OPPC', 6);

const FIXTURES: CardDef[] = [LV7A, LV7B, R5, R5B, R4, R1, R3, OPPC];

// 解決編 + a1(+2) で B08057 自身が lv7 → LV7A/LV7B と合わせて 3 枚 = 宣言可
const SCENE3 = [
  { cardId: 'B08057', uid: 'u0' },
  { cardId: 'LV7A', uid: 'u7a' },
  { cardId: 'LV7B', uid: 'u7b' },
];

const SCENARIOS: ProbeScenario[] = [
  {
    // (a)(b)(c)(d) 本線: 3 tier とも選ぶ → 合計3枚 → opp 現場 1枚デッキ下。
    name: 'B08057 本線: 3-tier 各1枚 → 合わせて3枚 → 相手キャラをデッキ下へ',
    setup: {
      caseStatus: '解決編',
      selfScene: SCENE3,
      oppScene: [{ cardId: 'OPPC', uid: 'uo' }],
      remove: ['R5', 'R4', 'R1', 'R3'],
      deckSize: 9, fileCount: 3,
    },
    drive: { kind: 'declared', uid: 'u0', abilityId: 'a1' === 'a1' ? 'a2' : 'a2' },
    script: [
      { pickCardId: 'R5' },   // lv5 tier
      { pickCardId: 'R4' },   // lv4 tier
      { pickCardId: 'R1' },   // lv1 tier
      { pickCardId: 'OPPC' }, // 合わせて3枚 → 相手キャラ選択
    ],
    expect: [
      { kind: 'state', uid: 'u0', state: 'sleep' },
      { kind: 'candidatesExclude', pickIndex: 0, cardId: 'R3' },  // lv3 = どの tier でも候補外 (EXACT)
      { kind: 'candidatesExclude', pickIndex: 0, cardId: 'R4' },  // lv5 tier に lv4 は出ない
      { kind: 'zone', cardId: 'R5', zone: 'deck', side: 'self', present: true },
      { kind: 'zone', cardId: 'R4', zone: 'deck', side: 'self', present: true },
      { kind: 'zone', cardId: 'R1', zone: 'deck', side: 'self', present: true },
      { kind: 'zone', cardId: 'R3', zone: 'remove', side: 'self', present: true },
      { kind: 'zone', cardId: 'OPPC', zone: 'scene', side: 'opp', present: false }, // デッキ下へ
      { kind: 'zone', cardId: 'OPPC', zone: 'deck', side: 'opp', present: true },
    ],
  },
  {
    // (b) コストで積んだ 9 枚も候補 (remove 初期空 → コスト9枚から R5 を拾う)。
    // deckTop に R5 を仕込み → コストで remove へ → lv5 tier 候補に出る。
    name: 'B08057 コスト由来: コストでリムーブした札も pick 候補 (公式Q&A)',
    setup: {
      caseStatus: '解決編',
      selfScene: SCENE3,
      remove: [],
      deckTop: ['R5'], deckSize: 9, fileCount: 3, // 合計 10 枚 (コスト9枚後も deck 1 枚残 = refresh 界面回避)
    },
    drive: { kind: 'declared', uid: 'u0', abilityId: 'a2' },
    script: [{ pickCardId: 'R5' }], // lv4/lv1 tier は候補0で prompt 自体出ない (filler はレベル不一致)
    expect: [
      { kind: 'zone', cardId: 'R5', zone: 'deck', side: 'self', present: true }, // remove 経由でデッキ下へ戻った
    ],
  },
  {
    // (d) 負例: 2枚しか移せない (lv1 tier 候補なし) → 「合わせて3枚」不成立 → opp 現場据置。
    name: 'B08057 moved=2: 合わせて3枚不成立 → 相手キャラ pick 発火せず',
    setup: {
      caseStatus: '解決編',
      selfScene: SCENE3,
      oppScene: [{ cardId: 'OPPC', uid: 'uo' }],
      remove: ['R5', 'R4', 'R3'],
      deckSize: 9, fileCount: 3,
    },
    drive: { kind: 'declared', uid: 'u0', abilityId: 'a2' },
    script: [{ pickCardId: 'R5' }, { pickCardId: 'R4' }], // lv1 prompt は候補0で出ない
    expect: [
      { kind: 'zone', cardId: 'OPPC', zone: 'scene', side: 'opp', present: true }, // 据置
      { kind: 'zone', cardId: 'R5', zone: 'deck', side: 'self', present: true },
      { kind: 'zone', cardId: 'R4', zone: 'deck', side: 'self', present: true },
    ],
  },
  {
    // (e) cost-gate: デッキ8枚 → removeDeckTop n:9 が canPay false → 宣言不可。
    name: 'B08057 cost-gate: デッキ8枚以下は宣言不可 (公式Q&A)',
    setup: {
      caseStatus: '解決編',
      selfScene: SCENE3,
      remove: ['R5', 'R4', 'R1'],
      deckSize: 8, fileCount: 3,
    },
    drive: { kind: 'cost-gate', uid: 'u0', abilityId: 'a2', expectCanPay: false },
    script: [],
    expect: [],
  },
];

describe('B08057 — hand-authored probe (remove 3-tier → deck bottom + moved-count gate)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetDefRegistry();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    _clearPendingEffectOptionalSide();
    (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
  });

  for (const sc of SCENARIOS) {
    it(sc.name, () => {
      runCardScenario(B08057, FIXTURES, sc);
    });
  }

  // (a) 負例: 宣言可否 gate は enumeration 層 (canDeclaredAbility)。
  //   activateDeclaredAbility は trusted caller 前提で condition を再検査しない (production は
  //   UI/AI が canDeclaredAbility で列挙してから呼ぶ) — そのため condition-off は helper 直検査で pin。
  it('B08057 condition gate: 解決編+lv7×3 で宣言可 / 事件編 or lv7 2枚では不可 (canDeclaredAbility)', async () => {
    const { canDeclaredAbility } = await import('@/engine/flow/main/declared-ability');
    const mk = (caseStatus: '事件編' | '解決編', scene3: boolean) => {
      const sc: ProbeScenario = {
        name: 'gate', setup: {
          caseStatus,
          selfScene: scene3 ? SCENE3 : SCENE3.slice(0, 2),
          remove: ['R5'], deckSize: 9, fileCount: 3,
        },
        // cost-gate drive は canPay=true を検証しつつ state を返す (発火はしない)
        drive: { kind: 'cost-gate', uid: 'u0', abilityId: 'a2', expectCanPay: true },
        script: [], expect: [],
      };
      return runCardScenario(B08057, FIXTURES, sc);
    };
    const { expect } = await import('vitest');
    expect(canDeclaredAbility(mk('解決編', true), 'u0', 'a2'), '解決編 + 実効lv7×3 (自身+2含む)').toBe(true);
    expect(canDeclaredAbility(mk('事件編', true), 'u0', 'a2'), '事件編 → caseStatus 不成立 (+2 も乗らず lv7 2枚)').toBe(false);
    expect(canDeclaredAbility(mk('解決編', false), 'u0', 'a2'), 'lv7 が自身含め 2 枚 → 不成立').toBe(false);
  });
});
