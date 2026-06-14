// cards/ct-p03/B03073 イーサン・本堂 (character) — engine拡張 wave#2 cluster3 (action:end trigger)
// rules: 03-field-areas.md, 07-action-flow.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md, 26-qa-deck-refresh.md
// spec: .claude/specs/engine-wave2-action-triggers-design.md (カード別 DSL 要点: B03073)
//
// 公式テキスト:
//   このキャラのアクション終了時、このキャラをリムーブし、自分のデッキのカードを上から4枚見る。
//   その中からレベル4以下のキャラを1枚まで登場させ、残りを好きな順番でデッキの下に移す。
//
// 公式 qAndA:
//   - 「アクション終了時」能力でこのキャラをリムーブしない (効果を解決しない) ことは可能? → いいえ。必ずリムーブして以降の効果を解決。
//   - アクション中に現場を離れた場合、このキャラをリムーブできる? → いいえ。現場を離れる⇒アクション終了の順なので、
//     アクション終了時に現場にいないキャラの能力はそもそも発動しない。
//   - 見たカードに条件を満たすカードがあっても1枚も登場させないことは可能? → はい、可能。
//   - 能力/効果で登場したキャラの【登場時】能力は発動する? → はい、発動する。
//
// 句マッピング:
//   - 「このキャラのアクション終了時」 => trigger { hook:'action:end', selfOnly:true }
//       (cluster3 X10。離場 actor は collectCardsInPlay 対象外 + selfOnly で「現場にいなければ不発」が自然成立、rules/22)
//   - 「このキャラをリムーブし」(必須・辞退不可) => sceneRemove { uid:'$self', cause:'effect' }  ← qAndA「必ずリムーブ」
//   - 「自分のデッキのカードを上から4枚見る…レベル4以下のキャラを1枚まで登場させ」
//       => deckRevealUntil { player:'self', maxN:4, chooseMatch:'upTo', filter:{levelMax:4, kind:'character'} }
//          ($matched=採用 1 枚 or 0 枚 / $revealed=採用分を除く残り。chooseMatch:'upTo' で「1枚まで」=0枚可、qAndA・rules/15)
//          → conditional ($matched matched) → sceneEnter (通常登場・名乗り。target area:deck で deck から splice=複製防止、
//            BUG-102。named 既定 true=名乗り / viaEffect=true で【登場時】発動、qAndA)
//   - 「残りを好きな順番でデッキの下に移す」 => deckToBottomBound { bindKey:'$revealed' }  (シャッフルは無し=テキスト通り)

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: このキャラのアクション終了時 → リムーブ → 上から4枚見て Lv4以下キャラ1枚まで登場 → 残りデッキ下
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:end',
    selfOnly: true, // 「このキャラの」アクション終了時 (source.uid 一致 / 離場 actor は不発)
  },
  effect: {
    kind: 'sequence',
    steps: [
      // このキャラをリムーブし (必須・辞退不可、qAndA「必ずリムーブ」)
      { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } },
      // 自分のデッキ上から4枚見て、レベル4以下のキャラ1枚まで採用 ($matched) / 残り ($revealed)
      { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', maxN: 4, chooseMatch: 'upTo', filter: { levelMax: 4, kind: 'character' }, bind: '$revealed', bindMatch: '$matched' } },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        // 採用したキャラを登場させる (通常登場=名乗り、【登場時】発動)。target area:deck で deck から除去 (BUG-102 複製防止)
        then: { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: '$matched.cardId', viaEffect: true, target: { query: { area: 'deck', side: 'self' } } } },
      },
      // 残りの見たカードを好きな順番でデッキの下に移す (シャッフルなし)
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    'このキャラのアクション終了時、このキャラをリムーブし、自分のデッキの上から4枚見る。その中からレベル4以下のキャラを1枚まで登場させ、残りを好きな順番でデッキの下に移す。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

export const B03073: CardDef = {
  id: 'B03073',
  no: '0327/B03073',
  kind: 'character',
  names: ['イーサン・本堂'],
  colors: ['赤'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['CIA'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133424856480.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
