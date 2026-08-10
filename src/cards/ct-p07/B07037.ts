// cards/ct-p07/B07037 黒羽快斗 (character) — engine wave A1 exemplar (G39 PA 計数・消費)
// rules: 03-field-areas.md (§パートナーエリア), 15-abilities-effects.md (§「〜してもよい。そうした場合」),
//        17-icons.md (§【登場時】), 20-color-and-switch.md
//
// 公式テキスト:
//   【登場時】自分のパートナーエリアにある〚特徴［ビッグジュエル］〛のカードを2枚リムーブしてもよい。
//     そうした場合、自分のリムーブエリアにあるレベル6以下の〚カード名［中森青子］〛を1枚まで選び、
//     スリープ状態で登場させる。
//
// 句マッピング:
//   - 【登場時】 => ability a1: type 'triggered', scope 'on-scene', trigger {hook:'enter', selfOnly:true}
//     (D01008/D08003 a1 と同型)。
//   - 「…を2枚リムーブしてもよい。そうした場合、…」 => optional{chain[…]} (B07055/B03094 と VERBATIM)。
//     · step[0]: 新 verb partnerAreaRemove {player:'self', n:2, filter:{trait:'ビッグジュエル'}}
//       — PA 一般カード枠 (partnerAreaCards, wave-12) から特徴[ビッグジュエル]を **正確に2枚** 選びリムーブ。
//       n:2 = exact-N gate: PA の該当が2枚未満なら chainStepNoApply → chain break (revive せず)。
//       「してもよい」の任意性は外側 optional{} が担う (辞退 → inner 未実行 → revive せず)。
//     · step[1]: sceneEnter {from:'remove'} — リムーブエリアの レベル6以下・中森青子 を1枚まで選び
//       スリープ状態で登場 (B07058/D09020 の remove-enter shape + enterSleep:true=D01008)。
//       chain 意味論により step[0] が apply したときのみ実行 = 「そうした場合」。
//   - cutIn / hirameki / henso (印字なし) => 追加能力なし。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // 自分のパートナーエリアにある〚特徴[ビッグジュエル]〛のカードを2枚リムーブ
        {
          kind: 'atom',
          verb: 'partnerAreaRemove',
          args: { player: 'self', n: 2, minimumPolicy: 'exact', filter: { trait: 'ビッグジュエル' } },
        },
        // そうした場合、リムーブエリアのレベル6以下の[中森青子]を1枚までスリープ状態で登場
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: '$pick.cardId',
            from: 'remove',
            viaEffect: true,
            enterSleep: true,
            target: {
              kind: 'pick',
              query: { area: 'remove', side: 'self', filter: { cardName: '中森青子', levelMax: 6, kind: 'character' } },
              n: { min: 0, max: 1 },
              chooser: 'self',
            },
          },
        },
      ],
    },
  },
  description:
    '【登場時】自分のパートナーエリアにある[ビッグジュエル]のカードを2枚リムーブしてもよい。そうした場合、リムーブエリアのレベル6以下の[中森青子]を1枚までスリープ状態で登場させる。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};

export const B07037: CardDef = {
  id: 'B07037',
  no: '0766/B07037',
  kind: 'character',
  names: ['黒羽快斗'],
  colors: ['白'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['高校生', 'マジシャン'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762413994245221.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
