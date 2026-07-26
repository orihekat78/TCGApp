// cards/ct-p03/B03111 バーボン (character) — DEFER 解禁 (engine変更0)。
//   discard chooser:'source' (core.ts:66-72, M2後半 B07100 で出荷済) を reuse。B07100 の filter を
//   levelMax:7・keyword なし に、conditional draw follow-on を除去した clone。
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/25-qa-effects-resolution.md
//
// 公式テキスト:
//   【パートナー黒】【登場時】相手は手札を公開する。その中からレベル7以下のカードを1枚まで選び、
//   相手はそれをリムーブする。（その後、手札を元に戻す）
//
// 句マッピング (grounding: .claude/specs/grounding/B03111.md):
//   - 【パートナー黒】= condition partnerColor 黒 (rules/17【パートナー(色)】= 不成立時「持っていない扱い」)。
//   - 【登場時】= trigger enter + selfOnly (rules/17【登場時】)。
//   - 「相手は手札を公開する。（その後、手札を元に戻す）」= log atom reveal idiom (B07100 a1 同型、zone 不変)。
//     公開 = chooser が候補を見て選べるという結果でのみ意味を持つ (evidenceFlip の非公開 pick と同型)。
//   - 「その中からレベル7以下のカードを1枚まで選び、相手はそれをリムーブする」
//       = discard{ player:'opp', side:'opp', max:1, chooser:'source', filter:{levelMax:7} }。
//     選ぶ主語は無標 = 能力所有者 (自分)、リムーブ実行者のみ「相手は」→ chooser:'source'
//     (公式Q&A「公開された手札からカードを選ぶのは自分ですか？」→「はい。自分がカードを選び、相手は
//      選ばれたカードをリムーブします」= chooser=self × hand-owner=opp の cross-side pick)。
//     「1枚まで」= 0枚 decline 可 (rules/15「〜枚まで」)。「レベル7以下のカード」= filter{levelMax:7}、
//     kind filter なし =「カード」(キャラ/イベント問わず)。
//     side:'opp' 明示: 短縮形 sideDefault は絶対 player を流すが query.side は owner 相対で再解決される
//     — CPU 所有 (source='opp') 時に自分の手札へ反転するのを防ぐ (BUG-181 family、B07100/B05063 同回避)。

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
        verb: 'handReveal',
        args: {
          player: 'opp',
          all: true,
          audience: 'all',
          lifetime: 'effect',
          result: '相手は手札を公開する（その後、手札を元に戻す）',
        },
      },
      // その中からレベル7以下のカードを1枚まで選び (自分が選ぶ)、相手はそれをリムーブする
      {
        kind: 'atom',
        verb: 'discard',
        args: {
          player: 'opp',
          side: 'opp',
          max: 1,
          chooser: 'source',
          filter: { levelMax: 7 },
        },
      },
    ],
  },
  description:
    '【パートナー黒】【登場時】相手は手札を公開する。その中からレベル7以下のカードを1枚まで選び、相手はそれをリムーブする。（その後、手札を元に戻す）',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/25-qa-effects-resolution.md',
  ],
};

export const B03111: CardDef = {
  id: 'B03111',
  no: '0360/B03111',
  kind: 'character',
  names: ['バーボン'],
  colors: ['黒'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1729133482954562.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
