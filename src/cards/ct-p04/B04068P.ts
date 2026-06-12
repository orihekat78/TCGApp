// cards/ct-p04/B04068P 安室透 (キャラ・パラレル) — Task D batch (2026-06-12)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 22-qa-action-contact.md
//
// 公式テキスト (B04068 と同一効果。P 版はリマインダ文なし、rarity/imageUrl/no のみ異なる):
//   〚突撃〛
//   【FILE5】このキャラがアクションしたとき、自分のFILEエリアにあるカードを上から1枚手札に加えてもよい。
//     そうした場合、ターン終了時までこのキャラをAP＋2000し、手札からレベル7以下の〚特徴［喫茶ポアロ］〛のキャラを1枚まで登場させる。
//
// 句マッピング: B04068.ts と同一 (同テキスト別ファイル full def 慣行 — B07073P 同様)。
//   - 〚突撃〛 => keywords:['突撃']
//   - 【FILE5】 => condition fileAtLeast{n:5} / このキャラがアクションしたとき => action:declare(selfOnly) — ガード前発動 (公式Q&A/rules/22)
//   - 〜加えてもよい。そうした場合 => optional{chain[filePopToHand, charModifyAP $self +2000 turn, sceneEnter from hand]}
//   - filePopToHand 不発 (FILE空/アシストパートナーのみ) = chain break — 公式Q&A 通り

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【FILE5】自分のFILEエリアのカードが5枚以上 (アシスト中パートナー含む — 公式Q&A / rules/17)
  condition: { kind: 'fileAtLeast', n: 5 },
  // このキャラがアクションしたとき (= アクション宣言・スリープ時点。ガード判定より前 — 公式Q&A / rules/22)
  trigger: { hook: 'action:declare', selfOnly: true },
  effect: {
    // 手札に加えてもよい (任意効果 rules/15)
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // 自分のFILEエリアにあるカードを上から1枚手札に加える (FILE空/アシストパートナーのみ → 以降の効果は解決不可 = chain break)
        { kind: 'atom', verb: 'filePopToHand', args: { player: 'self' } },
        // そうした場合、ターン終了時までこのキャラをAP＋2000し
        { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 2000, scope: 'turn' } },
        // 手札からレベル7以下の〚特徴［喫茶ポアロ］〛のキャラを1枚まで登場させる (現場満杯時はスイッチ可 — 公式Q&A / rules/20)
        { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { kind: 'character', trait: '喫茶ポアロ', levelMax: 7 } } },
      ],
    },
  },
  description:
    '【FILE5】このキャラがアクションしたとき、自分のFILEエリアにあるカードを上から1枚手札に加えてもよい。そうした場合、ターン終了時までこのキャラをAP＋2000し、手札からレベル7以下の〚特徴［喫茶ポアロ］〛のキャラを1枚まで登場させる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/22-qa-action-contact.md'],
};

export const B04068P: CardDef = {
  id: 'B04068P',
  no: '0454/B04068P',
  kind: 'character',
  names: ['安室透'],
  colors: ['黄'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['探偵', '喫茶ポアロ'],
  keywords: ['突撃'],
  rarity: 'SRCP',
  imageUrl: '1740032136946008.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md',
  ],
};
