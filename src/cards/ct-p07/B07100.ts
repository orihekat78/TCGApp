// cards/ct-p07/B07100 コルン (character) — M2後半 batch (engine: atomDiscard chooser:'source' は同 branch 出荷済)
// rules: rules/09-cutin-disguise.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/25-qa-effects-resolution.md
// 公式テキスト:
//   【パートナー黒】【登場時】相手は手札を公開する。その中から【カットイン】を持つレベル8以下のカードを1枚まで選び、
//   相手はそれをリムーブする。（その後、手札を元に戻す）カードをリムーブし、相手の手札が4枚以下の場合、相手はカードを1枚引く。
// 句マッピング (grounding: .claude/specs/grounding/B07100.md):
//   - 「相手は手札を公開する。（その後、手札を元に戻す）」= log atom reveal idiom (D05004/B06084 a1 同型、zone 不変)。
//   - 「その中から…1枚まで選び、相手はそれをリムーブする」= discard{player:'opp', max:1, chooser:'source', filter}。
//     選ぶ主語は無標 = 能力所有者 (自分)、リムーブ実行者のみ「相手は」→ chooser:'source' (atomDiscard が
//     byPlayer=ctx.source.player で pick を自分側に surface、手札所有者は opp のまま)。「1枚まで」= 0枚 decline 可 (rules/15)。
//   - 「【カットイン】を持つレベル8以下のカード」= filter {keyword:'カットイン', levelMax:8}、kind filter なし =「カード」。
//     keyword presence は印字静的判定 (defHasKeyword) — rules/17 Q&A (本カード名指し): 条件アイコンで無効な cutin も
//     「持つ」= 既定で正。付与された cutin も「持つ」だが手札カードへの cutin 付与 repr は現存せず可観測乖離ゼロ
//     (B07003 出荷時に state-aware presence reader へ拡張、DEFERRED-INDEX 既存行)。
//   - 「カードをリムーブし、〜場合」= chain gate: 0枚 pick/decline は chainStepNoApply で後段 skip (B09061 同機構)。
//   - 「相手の手札が4枚以下の場合」= handAtMost{player:'opp', n:4} — リムーブ適用後の手札を読む (rules/25 前段適用後判定)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー黒】
  condition: { kind: 'partnerColor', color: '黒' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      // 相手は手札を公開する（その後、手札を元に戻す）— 公開 = zone 不変の reveal idiom
      {
        kind: 'atom',
        verb: 'log',
        args: {
          player: 'opp',
          action: 'reveal-hand',
          result: '相手は手札を公開する（その後、手札を元に戻す）',
        },
      },
      {
        kind: 'chain',
        steps: [
          // その中から【カットイン】を持つレベル8以下のカードを1枚まで選び (自分が選ぶ)、相手はそれをリムーブする
          {
            kind: 'atom',
            verb: 'discard',
            args: {
              player: 'opp',
              // side 明示必須 (edge lens BLOCK 2026-07-10): 短縮形 sideDefault は絶対 player (dcP) を
              // 流すが query.side は owner 相対で再解決される — CPU 所有 (source='opp') だと自分の
              // 手札に反転する (BUG-181 family)。owner 相対 'opp' 明示で両方向正 (B05063 同回避)。
              side: 'opp',
              max: 1,
              chooser: 'source',
              filter: { keyword: 'カットイン', levelMax: 8 },
            },
          },
          // カードをリムーブし、相手の手札が4枚以下の場合、相手はカードを1枚引く
          {
            kind: 'conditional',
            if: { kind: 'handAtMost', player: 'opp', n: 4 },
            then: { kind: 'atom', verb: 'draw', args: { player: 'opp', n: 1 } },
          },
        ],
      },
    ],
  },
  description:
    '【パートナー黒】【登場時】相手は手札を公開する。その中から【カットイン】を持つレベル8以下のカードを1枚まで選び、相手はそれをリムーブする。（その後、手札を元に戻す）カードをリムーブし、相手の手札が4枚以下の場合、相手はカードを1枚引く。',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/25-qa-effects-resolution.md',
  ],
};

export const B07100: CardDef = {
  id: 'B07100',
  no: '0827/B07100',
  kind: 'character',
  names: ['コルン'],
  colors: ['黒'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414041030370.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
