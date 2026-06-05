// cards/ct-p07/B07021 マロちゃん (キャラ) — catalog-reuse batch
// rules: 05-turn-phases.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）
//   自分のターン終了時、自分の現場に〚カード名［綾小路文麿］〛がいない場合、このキャラをリムーブする。
//   【登場時】自分の現場に〚カード名［綾小路文麿］〛がいる場合、カードを1枚引く。
//
// 〚突撃〛は無条件キーワード → keywords:['突撃']。
// a1: 自分のターン終了時 (phase:end:start, turn:self) → 綾小路文麿 不在なら このキャラをリムーブ。
//     conditional{ if: not sceneHas(綾小路文麿), then: sceneRemove($self) }。D08003 a2 conditional + sceneRemove($self) 同型。
// a2: 【登場時】(enter selfOnly) → 綾小路文麿 在場なら 1ドロー。D08019 a1 conditional sceneHas 同型。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 自分のターン終了時
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  effect: {
    kind: 'conditional',
    // 自分の現場に[綾小路文麿]がいない場合
    if: { kind: 'not', c: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: '綾小路文麿' } }, nMin: 1 } },
    // このキャラをリムーブする
    then: { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } },
  },
  description: '自分のターン終了時、自分の現場に[綾小路文麿]がいない場合、このキャラをリムーブする。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 自分の現場に[綾小路文麿]がいる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: '綾小路文麿' } }, nMin: 1 },
    // カードを1枚引く
    then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  },
  description: '【登場時】自分の現場に[綾小路文麿]がいる場合、カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B07021: CardDef = {
  id: 'B07021',
  no: '0753/B07021',
  kind: 'character',
  names: ['マロちゃん'],
  colors: ['緑'],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: ['シマリス'],
  keywords: ['突撃'],
  rarity: 'C',
  imageUrl: '1762413976168527.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
