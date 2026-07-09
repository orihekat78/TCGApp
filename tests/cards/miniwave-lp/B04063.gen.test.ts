// tests/cards/miniwave-lp/B04063.gen — HAND-AUTHORED (supersedes gen-card-probes.cjs output).
//
// gen-card-probes.cjs の自動 scenario は本カードの novel 部
//   sceneRemove.filter.levelMax = { dyn: '$bound.$revealed.levelSum' }
//   (「リムーブエリアに移したカードのレベルの合計以下のレベルのキャラを1枚まで選び、リムーブ」)
// を pin できない:
//   (a) partnerColor条件を満たす setup (partnerColors:['赤']) を張っていなかったため ability が発火せず
//       0 prompt → over-scripted で fail していた (root cause)。
//   (b) 動的 levelSum を「既知レベルの札を seed し、しきい値ちょうど=候補 / しきい値+1=候補外」で
//       実証していなかった。
// 本 file は production dispatch (handUseCard + runAllUntilEmpty) で駆動し、しきい値を genuinely pin する。
// engine / src/cards は変更しない (probe のみ)。
//
// カード効果フロー (B04063「諦めるなよ瑛海!!」【パートナー赤】):
//   1) deckRevealUntil maxN:3 chooseMatch:'upTo' — デッキ上3枚を見て 1枚まで手札 (owner=human → pick surface)。
//      → 手札に加えなかった残りが $revealed に bind。
//   2) boundToRemove $revealed — 残りをリムーブエリアへ (= 「リムーブエリアに移したカード」)。
//   3) sceneRemove max:1 filter.levelMax = $revealed の printed level 合計。 → その値以下のキャラ 1枚まで選び除去。
//
// MANUAL-NOTE: しきい値の合計対象は「手札に加えなかった (=リムーブへ移した) 札」のみ。手札に加えた札の
//   レベルは合計に入らない (dyn は $revealed = rest binding を読む)。よって手札に加える札を変えると
//   しきい値が動的に変わる — scenario A(sum=4) と B(sum=5) で DECOY5 の候補性が反転することで実証する。
// MANUAL-NOTE(latent): deckRevealUntil を 'pick:skip' (0枚手札追加) で解決すると $revealed が bind されず
//   sum=0 になる (「残りをリムーブ」の印字と乖離。engine 挙動、probe では非修正)。よって本 probe は
//   「手札に1枚加える」経路で残りをリムーブへ回して sum を作る (production 上も合法な選択肢)。

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
import { B04063 } from '@/cards/ct-p04/B04063';
import type { CardDef } from '@/engine/types';

function ch(id: string, level: number): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['赤'],
    level, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

// deckTop seed (既知レベル) — 手札追加の選択で「リムーブへ回る集合」を変え levelSum を制御する。
const L2A = ch('L2A', 2);
const L2B = ch('L2B', 2);
const L3 = ch('L3', 3);
// opp 現場の除去対象/decoy (レベルがしきい値の境界に並ぶ)。
const DECOY4 = ch('DECOY4', 4);
const DECOY5 = ch('DECOY5', 5);
const DECOY6 = ch('DECOY6', 6);
const DECOY8 = ch('DECOY8', 8);

const FIXTURES: CardDef[] = [L2A, L2B, L3, DECOY4, DECOY5, DECOY6, DECOY8];

const SCENARIOS: ProbeScenario[] = [
  {
    // sum=4 (L3 を手札へ → 残り L2A(2)+L2B(2)=4 をリムーブへ)。DECOY4(=4) は候補、DECOY5(=5=sum+1) は候補外。
    name: 'B04063 levelSum しきい値ちょうど: L3手札追加→sum=4, DECOY4(lv4) 候補 & 除去, DECOY5(lv5=sum+1) 候補外',
    setup: {
      oppScene: [{ cardId: 'DECOY4', uid: 'u4' }, { cardId: 'DECOY5', uid: 'u5' }],
      hand: ['B04063'], deckTop: ['L2A', 'L2B', 'L3'], deckSize: 3, caseColors: ['赤'], fileCount: 7, partnerColors: ['赤'],
    },
    drive: { kind: 'event-use', cardId: 'B04063' },
    script: [{ pickCardId: 'L3' }, { pickCardId: 'DECOY4' }],
    expect: [
      { kind: 'zone', cardId: 'L3', zone: 'hand', side: 'self', present: true },   // 手札に加えた札
      { kind: 'zone', cardId: 'L2A', zone: 'remove', side: 'self', present: true }, // リムーブへ回った札 (sum 対象)
      { kind: 'zone', cardId: 'L2B', zone: 'remove', side: 'self', present: true },
      { kind: 'candidatesExclude', pickIndex: 1, cardId: 'DECOY5' },               // lv5 > sum4 → sceneRemove 候補外
      { kind: 'zone', cardId: 'DECOY4', zone: 'scene', side: 'opp', present: false }, // lv4 = sum → 除去された
      { kind: 'zone', cardId: 'DECOY5', zone: 'scene', side: 'opp', present: true },  // 候補外で残存
      { kind: 'zone', cardId: 'B04063', zone: 'hand', side: 'self', present: false },
    ],
  },
  {
    // sum=5 (L2A を手札へ → 残り L2B(2)+L3(3)=5 をリムーブへ)。同じ盤面の DECOY5 が今度は候補になる = しきい値が動的。
    name: 'B04063 levelSum 動的: L2A手札追加→sum=5, DECOY5(lv5=sum) 候補 & 除去, DECOY6(lv6=sum+1) 候補外',
    setup: {
      oppScene: [{ cardId: 'DECOY5', uid: 'u5' }, { cardId: 'DECOY6', uid: 'u6' }],
      hand: ['B04063'], deckTop: ['L2A', 'L2B', 'L3'], deckSize: 3, caseColors: ['赤'], fileCount: 7, partnerColors: ['赤'],
    },
    drive: { kind: 'event-use', cardId: 'B04063' },
    script: [{ pickCardId: 'L2A' }, { pickCardId: 'DECOY5' }],
    expect: [
      { kind: 'zone', cardId: 'L2A', zone: 'hand', side: 'self', present: true },
      { kind: 'zone', cardId: 'L2B', zone: 'remove', side: 'self', present: true },
      { kind: 'zone', cardId: 'L3', zone: 'remove', side: 'self', present: true },
      { kind: 'candidatesExclude', pickIndex: 1, cardId: 'DECOY6' },               // lv6 > sum5 → 候補外
      { kind: 'zone', cardId: 'DECOY5', zone: 'scene', side: 'opp', present: false }, // sum4 では候補外だった DECOY5 が sum5 で除去可
      { kind: 'zone', cardId: 'DECOY6', zone: 'scene', side: 'opp', present: true },
    ],
  },
  {
    // sum=4 だが opp 現場が全員 lv>4 → sceneRemove の候補が 0 → pick surface しない (0枚選択も不要)。
    // deckReveal pick(1個) のみ。opp 現場は据置。しきい値が確かに gate していることの negative pin。
    name: 'B04063 しきい値ガード: sum=4 で opp 現場が全員 lv>4 → sceneRemove 発火せず opp 据置',
    setup: {
      oppScene: [{ cardId: 'DECOY5', uid: 'u5' }, { cardId: 'DECOY8', uid: 'u8' }],
      hand: ['B04063'], deckTop: ['L2A', 'L2B', 'L3'], deckSize: 3, caseColors: ['赤'], fileCount: 7, partnerColors: ['赤'],
    },
    drive: { kind: 'event-use', cardId: 'B04063' },
    script: [{ pickCardId: 'L3' }], // deckReveal のみ。sceneRemove は候補0で surface しない
    expect: [
      { kind: 'zone', cardId: 'DECOY5', zone: 'scene', side: 'opp', present: true },
      { kind: 'zone', cardId: 'DECOY8', zone: 'scene', side: 'opp', present: true },
    ],
  },
  {
    // 【パートナー赤】不成立 → ability そのものが発火せず prompt 0。
    name: 'B04063 condition-off: partnerColor 不一致 → 発火せず (prompt 0)',
    setup: {
      oppScene: [{ cardId: 'DECOY4', uid: 'u4' }],
      hand: ['B04063'], deckTop: ['L2A', 'L2B', 'L3'], deckSize: 3, caseColors: ['赤'], fileCount: 7, partnerColors: ['青'],
    },
    drive: { kind: 'event-use', cardId: 'B04063' },
    script: [],
    expect: [
      { kind: 'noPromptSurfaced' },
      { kind: 'zone', cardId: 'DECOY4', zone: 'scene', side: 'opp', present: true },
    ],
  },
];

describe('B04063 — hand-authored probe (levelSum dyn threshold)', () => {
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
      runCardScenario(B04063, FIXTURES, sc);
    });
  }
});
