// cards/ct-p04/B04068 安室透 (キャラ) — Task D batch (2026-06-12)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）
//   【FILE5】このキャラがアクションしたとき、自分のFILEエリアにあるカードを上から1枚手札に加えてもよい。
//     そうした場合、ターン終了時までこのキャラをAP＋2000し、手札からレベル7以下の〚特徴［喫茶ポアロ］〛のキャラを1枚まで登場させる。
//
// 句マッピング:
//   - 〚突撃〛 => keywords:['突撃'] (B07071 同型。rules/13 名乗り状態でもアクション可)
//   - 【FILE5】 => condition fileAtLeast{n:5} (B04023/D06012 同型。アシスト中パートナーも数える rules/17 — 公式Q&A 裁定と一致)
//   - このキャラがアクションしたとき => trigger{hook:'action:declare',selfOnly:true} (D06010/B03099 同型。
//     公式Q&A「アクションを宣言し〜スリープさせた時点で発動 (ガード前)」= rules/22 解決順と一致)
//   - 〜手札に加えてもよい。そうした場合、… => optional{chain[...]} (B04023 a1 同型。「してもよい」=任意 rules/15)
//   - 自分のFILEエリアにあるカードを上から1枚手札に加える => filePopToHand{player:'self'} (Task D E3 BUG-128 修正済:
//     実 cardId を手札へ + 'file:pop' emit。FILE空/アシストパートナーのみ → __chainStepNoApply = chain break — 公式Q&A 通り)
//   - ターン終了時までこのキャラをAP＋2000し => charModifyAP{uid:'$self',delta:2000,scope:'turn'} (D11016 同型)
//   - 手札からレベル7以下の〚特徴［喫茶ポアロ］〛のキャラを1枚まで登場させる => sceneEnter PA短縮形
//     {from:'hand',max:1,filter:{kind:'character',trait:'喫茶ポアロ',levelMax:7}} (B09025/B04007 同型。
//     現場満杯時のスイッチは sceneEnter handler が処理 — 公式Q&A/rules/20。効果による登場は事件の色制限を受けない rules/20)

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

export const B04068: CardDef = {
  id: 'B04068',
  no: '0454/B04068',
  kind: 'character',
  names: ['安室透'],
  colors: ['黄'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['探偵', '喫茶ポアロ'],
  keywords: ['突撃'],
  rarity: 'SR',
  imageUrl: '1735287801318096.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md',
  ],
};
