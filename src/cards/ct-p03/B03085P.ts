// cards/ct-p03/B03085P 諸伏景光 (character, パラレル) — engine additive wave-11 (hirameki actor payload consumer)
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 24-qa-naming-stun.md
// 公式テキスト (B03085 と同一、パラレル = imageUrl/rarity/no のみ差異):
//   【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル6以下の
//     〚特徴［警察］〛のキャラを1枚まで選び、スリープ状態で登場させる。
//   【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる。
//     （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
// 句マッピングは B03085.ts と同一 (standalone full CardDef 慣習、B03092P 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // 手札を1枚リムーブしてもよい
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
        // そうした場合、自分のリムーブエリアにあるレベル6以下の〚特徴［警察］〛のキャラを1枚まで選び、スリープ状態で登場させる
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
              query: { area: 'remove', side: 'self', filter: { trait: '警察', levelMax: 6, kind: 'character' } },
              n: { min: 0, max: 1 },
              chooser: 'self',
            },
          },
        },
      ],
    },
  },
  description:
    '【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル6以下の〚特徴［警察］〛のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  condition: { kind: 'caseStatus', status: '解決編' },
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$trigger.byUid', state: 'stun' } },
  description:
    '【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）',
  ruleRefs: ['rules/10-action-event.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

export const B03085P: CardDef = {
  id: 'B03085P',
  no: '0338/B03085P',
  kind: 'character',
  names: ['諸伏景光'],
  colors: ['黄'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['警察', '警視庁', '公安'],
  keywords: [],
  rarity: 'RP',
  imageUrl: '1729133443619364.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/24-qa-naming-stun.md',
  ],
};
