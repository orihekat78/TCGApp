// cards/ct-p02/B02068 「行け秀一！その熱病でお前の命が尽きるまで…」 (イベント) — engine拡張 wave#2 cluster3 (action-lifecycle trigger, 2026-06-13)
// rules: 07-action-flow.md, 08-contact.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【パートナー赤】自分の現場にいる【赤】のキャラを好きな数選び、ターン終了時まで
//   「このキャラがアクション［事件］したとき、手札を1枚リムーブしてもよい。そうした場合、
//   ターン終了時までこのキャラは〚ブレット〛（このキャラのアクションはガードできない）を持つ。」を与える。
//
// 句マッピング:
//   a1: イベント使用トリガ (B02014/B02083 同型 = effect:declared on-hand + matcher p.kind==='event-use')。
//     【パートナー赤】= 使用条件 ability.condition partnerColor{color:'赤'} (条件不成立なら能力を持たない扱い / rules/17)。
//     「自分の現場にいる【赤】のキャラを好きな数選び、…『…』を与える」=
//       charGrantAbility 短縮形 multi-pick {player:'self', side:'self', filter:{color:'赤'}, max:5 (現場上限・0枚可 rules/15), scope:'turn'}。
//       carrier は短縮形必須 (B02014 教訓: 明示 uid+target carrier は human forEach bind 未解決 no-op + AI 単一候補化)。
//       与える能力 (granted descriptor は JSON のみ — matcher closure 禁止 validate.ts:175-188 → matcherCondition で subtype gate):
//         trigger {hook:'action:declare', selfOnly:true, matcherCondition: triggerActionKind{v:'case'}}
//           = 「このキャラがアクション［事件］したとき」。公式Q&A: アクション宣言・事件指定・スリープ時点で発動
//             (相手のガード判定より前) → action:declare emit 位置と一致。selfOnly = carrier キャラ自身限定 / 離場なら不発。
//             triggerActionKind v:'case' で [事件] subtype に限定 (action[キャラ] では発動しない)。
//         effect optional{chain[discard1, charGrantKeyword $self ブレット turn]} =
//           「手札を1枚リムーブしてもよい。そうした場合、ターン終了時までこのキャラは〚ブレット〛を持つ。」
//           optional = 「〜してもよい」(辞退可 / 手札0 でも skip)。chain = 「そうした場合」(discard1 が実行されたときのみ keyword 付与)。
//           discard {player:'self', n:1} = 必須 1枚リムーブ (optional 内なので「リムーブする」型でよい)。
//           charGrantKeyword {uid:'$self', kw:'ブレット', scope:'turn'} = granted ability 発火キャラ ($self=carrier) に
//             ターン終了時まで〚ブレット〛(guard.ts turn-grant 評価。⚠ scope は turn 必須 — action 不可: grantedKeywords は
//             suffix 無し格納で action 清掃が効かない罠)。
//   付与した ability/keyword はいずれも clearTurnEffects('turn') で清掃 = ターン終了時まで。
//   ⚠ human 経路の前提: granted optional/choice modal をガード窓より前に解決する必要あり (X16 contact driver gate 拡張で対応)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  // 【パートナー赤】(使用条件 — 条件不成立なら能力を持たない扱い / rules/17)
  condition: { kind: 'partnerColor', color: '赤' },
  // イベント使用トリガ (このイベントを使用したとき / B02014 同型)
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  // 自分の現場にいる【赤】のキャラを好きな数選び (multi-pick carrier、0枚可)、ターン終了時まで
  // 「このキャラがアクション［事件］したとき、手札を1枚リムーブしてもよい。そうした場合、
  //  ターン終了時までこのキャラは〚ブレット〛を持つ。」を与える。
  effect: {
    kind: 'atom',
    verb: 'charGrantAbility',
    args: {
      player: 'self',
      side: 'self',
      max: 5,
      filter: { color: '赤' },
      scope: 'turn',
      ability: {
        // このキャラがアクション［事件］したとき (宣言・事件指定・スリープ時点 = ガード判定前 / rules/22 qAndA)
        trigger: { hook: 'action:declare', selfOnly: true, matcherCondition: { kind: 'triggerActionKind', v: 'case' } },
        // 手札を1枚リムーブしてもよい。そうした場合、ターン終了時までこのキャラは〚ブレット〛を持つ。
        effect: {
          kind: 'optional',
          effect: {
            kind: 'chain',
            steps: [
              { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
              { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: 'ブレット', scope: 'turn' } },
            ],
          },
        },
        description:
          'このキャラがアクション［事件］したとき、手札を1枚リムーブしてもよい。そうした場合、ターン終了時までこのキャラは〚ブレット〛（このキャラのアクションはガードできない）を持つ。(B02068 付与)',
      },
    },
  },
  description:
    '【パートナー赤】自分の現場にいる【赤】のキャラを好きな数選び、ターン終了時まで「このキャラがアクション［事件］したとき、手札を1枚リムーブしてもよい。そうした場合、ターン終了時までこのキャラは〚ブレット〛（このキャラのアクションはガードできない）を持つ。」を与える。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};

export const B02068: CardDef = {
  id: 'B02068',
  no: '0231/B02068',
  kind: 'event',
  names: ['「行け秀一！その熱病でお前の命が尽きるまで…」'],
  colors: ['赤'],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1721357267339596.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md',
  ],
};
