// tests/cards/s2-deck/B01022.gen — HAND-AUTHORED (S2 deck cluster, deck-window multi-deploy)。
//
// production dispatch (handUseCard + runAllUntilEmpty) で B01022「少年探偵団」の novel 部を pin する:
//   (a) fromGroupCards — pick 候補が「見た6枚 (window)」に限定され、deck 深部の filter 一致 decoy が出ない。
//   (b) filter — レベル4以下 + 特徴[少年探偵団] + kind:character が候補を gate する (lv5 / 特徴外 除外)。
//   (c) multi-enter 2枚 + 「残りをシャッフルしてデッキの下」— 登場分は deck を離れ、残 window + 深部が deck に残る。
//   (d) 「2枚まで」= 0枚可 (rules/15) — pick:skip でも skipResolvesAtom により後段 (bottom+shuffle) を解決。
//   (e) 手札0枚 → discard 不発で以降を解決 (公式Q&A)。
//   (f) 【パートナー青】不成立 → 発火せず (rules/17 条件アイコン)。
//   (g) window 内の同 cardId 重複 → 2 候補として区別され 2 枚とも登場できる (index 区別)。
//
// MANUAL-NOTE: deckShuffle が全デッキを無作為化するため「深部カードが top に残る」順序 assert は
//   engine probe (tests/engine/effect/s2-deck-window-pick.test.ts E4) 側で pin 済。ここでは membership/枚数のみ。
// MANUAL-NOTE: 現場満杯 switch (公式Q&A 3件目) は cluster14 の switchRemoveUids 機構 (UI 収集) 側で、
//   harness では収集経路が無いため対象外 (Playwright 実機で確認)。

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
import { B01022 } from '@/cards/ct-p01/B01022';
import type { CardDef } from '@/engine/types';

function dt(id: string, level: number): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'],
    level, ap: 2000, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}
const DT3 = dt('DT3', 3);   // 候補 (lv3)
const DT4 = dt('DT4', 4);   // 候補 (lv4 = 境界ちょうど)
const DT5 = dt('DT5', 5);   // 候補外 (lv5 > 4)
const NX: CardDef = { id: 'NX', no: 'NX', kind: 'character', names: ['無関係'], colors: ['赤'], level: 2, ap: 2000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const EVX: CardDef = { id: 'EVX', no: 'EVX', kind: 'event', names: ['イベX'], colors: ['青'], level: 1, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;
const FODDER: CardDef = { id: 'FODDER', no: 'FODDER', kind: 'character', names: ['手札の種'], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

const FIXTURES: CardDef[] = [DT3, DT4, DT5, NX, EVX, FODDER];

const SCENARIOS: ProbeScenario[] = [
  {
    // (a)(b)(c) 本線: window=上6 [DT3,DT5,NX,EVX,DT4,NX] / 深部 idx6 に DT3 (filter 一致だが window 外)。
    // 候補 = DT3(idx0)+DT4(idx4) のみ。2枚登場 → deck は 深部DT3 + 残window4 の 5枚。
    name: 'B01022 本線: window 限定 + filter gate + 2枚登場 + 残りシャッフルして下',
    setup: {
      hand: ['B01022', 'FODDER'],
      deckTop: ['DT3', 'DT5', 'NX', 'EVX', 'DT4', 'NX', 'DT3'], deckSize: 7,
      caseColors: ['青'], fileCount: 7, partnerColors: ['青'],
    },
    drive: { kind: 'event-use', cardId: 'B01022' },
    script: [
      { pickCardId: 'FODDER' },                 // 手札を1枚リムーブ
      { pickCardIds: ['DT3', 'DT4'] },          // window 候補 2 枚登場
    ],
    expect: [
      { kind: 'zone', cardId: 'FODDER', zone: 'remove', side: 'self', present: true },
      { kind: 'candidatesExclude', pickIndex: 1, cardId: 'DT5' },  // lv5 > 4 → 候補外
      { kind: 'candidatesExclude', pickIndex: 1, cardId: 'NX' },   // 特徴外 → 候補外
      { kind: 'candidatesExclude', pickIndex: 1, cardId: 'EVX' },  // kind:event → 候補外
      { kind: 'zone', cardId: 'DT3', zone: 'scene', side: 'self', present: true },
      { kind: 'zone', cardId: 'DT4', zone: 'scene', side: 'self', present: true },
      { kind: 'zone', cardId: 'DT4', zone: 'deck', side: 'self', present: false }, // window の DT4 は deck を離れた
      { kind: 'zone', cardId: 'DT3', zone: 'deck', side: 'self', present: true },  // 深部 DT3 は deck に残る (window 外)
      { kind: 'deckDelta', side: 'self', n: -2 },                                  // 登場2枚分のみ減 (残りは bottom へ戻る)
      { kind: 'zone', cardId: 'B01022', zone: 'remove', side: 'self', present: true }, // 使用済イベント
    ],
  },
  {
    // (a) window 外 decoy の除外を単独で pin: 候補が window 内 DT3 の 1 枚だけになる
    // (深部 idx6 の DT4 は filter 一致でも候補に出ない)。
    name: 'B01022 window 外 decoy: 深部の filter 一致カードは候補に出ない',
    setup: {
      hand: ['B01022', 'FODDER'],
      deckTop: ['DT3', 'NX', 'NX', 'EVX', 'EVX', 'NX', 'DT4'], deckSize: 7,
      caseColors: ['青'], fileCount: 7, partnerColors: ['青'],
    },
    drive: { kind: 'event-use', cardId: 'B01022' },
    script: [{ pickCardId: 'FODDER' }, { pickCardIds: ['DT3'] }],
    expect: [
      { kind: 'candidatesExclude', pickIndex: 1, cardId: 'DT4' }, // 深部 DT4 = window 外
      { kind: 'zone', cardId: 'DT3', zone: 'scene', side: 'self', present: true },
      { kind: 'zone', cardId: 'DT4', zone: 'deck', side: 'self', present: true },
      { kind: 'deckDelta', side: 'self', n: -1 },
    ],
  },
  {
    // (g) window 内の同 cardId 重複 → 2 候補 (index 区別) → 2 枚とも登場。
    name: 'B01022 重複 cardId: window 内 DT3×2 を 2 枚とも登場できる',
    setup: {
      hand: ['B01022', 'FODDER'],
      deckTop: ['DT3', 'DT3', 'NX', 'EVX', 'NX', 'NX', 'DT3'], deckSize: 7,
      caseColors: ['青'], fileCount: 7, partnerColors: ['青'],
    },
    drive: { kind: 'event-use', cardId: 'B01022' },
    script: [{ pickCardId: 'FODDER' }, { pickCardIds: ['DT3', 'DT3'] }],
    expect: [
      { kind: 'zone', cardId: 'DT3', zone: 'scene', side: 'self', present: true },
      { kind: 'deckDelta', side: 'self', n: -2 },                                 // window の 2 枚が deck を離れた
      { kind: 'zone', cardId: 'DT3', zone: 'deck', side: 'self', present: true }, // 深部 1 枚は残る (stale-bind prune)
    ],
  },
  {
    // (d) 「2枚まで」= 0枚可。skip でも skipResolvesAtom で bottom+shuffle まで解決 (deck 枚数不変)。
    name: 'B01022 0枚選択: pick:skip でも残り全部が deck に戻る (枚数不変)',
    setup: {
      hand: ['B01022', 'FODDER'],
      deckTop: ['DT3', 'DT4', 'NX', 'EVX', 'NX', 'NX', 'DT5'], deckSize: 7,
      caseColors: ['青'], fileCount: 7, partnerColors: ['青'],
    },
    drive: { kind: 'event-use', cardId: 'B01022' },
    script: [{ pickCardId: 'FODDER' }, 'pick:skip'],
    expect: [
      { kind: 'zone', cardId: 'DT3', zone: 'scene', side: 'self', present: false },
      { kind: 'deckDelta', side: 'self', n: 0 },
      { kind: 'zone', cardId: 'DT3', zone: 'deck', side: 'self', present: true },
    ],
  },
  {
    // (e) 手札0枚 (B01022 使用後の手札が空) → discard 不発、以降の効果は解決される (公式Q&A)。
    name: 'B01022 手札0: リムーブせず以降を解決 (reveal→登場まで進む)',
    setup: {
      hand: ['B01022'],
      deckTop: ['DT3', 'NX', 'NX', 'EVX', 'NX', 'NX'], deckSize: 6,
      caseColors: ['青'], fileCount: 7, partnerColors: ['青'],
    },
    drive: { kind: 'event-use', cardId: 'B01022' },
    script: [{ pickCardIds: ['DT3'] }], // discard prompt は出ない (候補0)
    expect: [
      { kind: 'zone', cardId: 'DT3', zone: 'scene', side: 'self', present: true },
      { kind: 'deckDelta', side: 'self', n: -1 },
    ],
  },
  {
    // (f) 【パートナー青】不成立 → 効果を持たない扱い (rules/17) — prompt 0。
    name: 'B01022 condition-off: partnerColor 不一致 → 発火せず (prompt 0)',
    setup: {
      hand: ['B01022', 'FODDER'],
      deckTop: ['DT3', 'DT4', 'NX', 'EVX', 'NX', 'NX'], deckSize: 6,
      caseColors: ['青'], fileCount: 7, partnerColors: ['赤'],
    },
    drive: { kind: 'event-use', cardId: 'B01022' },
    script: [],
    expect: [
      { kind: 'noPromptSurfaced' },
      { kind: 'zone', cardId: 'DT3', zone: 'deck', side: 'self', present: true },
    ],
  },
];

describe('B01022 — hand-authored probe (deck-window multi-deploy)', () => {
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
      runCardScenario(B01022, FIXTURES, sc);
    });
  }
});
