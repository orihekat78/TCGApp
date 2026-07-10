// cards/ct-p07/B07063 鈴木園子 (character) — engine additive A2 exemplar (granted leave:to-remove observer, 2026-07-11)
// rules: 07-action-flow.md, 08-contact.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【ターン1】自分の現場にいるAP7000以上のキャラがアクションしたとき、ターン終了時までそのキャラに
//     「【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。」を与える。
//   【宣言】【ターン1】【スリープ】〚手札を1枚リムーブする〛：LP0の〚特徴［高校生］〛のキャラを1枚まで選び、
//     アクティブにし、ターン終了時までAP＋1000する。
// 公式Q&A:
//   - a1 発動タイミング = アクション宣言・対象指定・actor スリープ時点 (ガード判定より前 = action:declare emit と一致)。
//   - AP7000 判定は action:declare 時点 (後から AP7000 以上になっても発動しない)。アクション[事件]でも発動。
//   - a2: 効果解決時に LP0 でないキャラ (LP1以上/マイナス) は選べない (effective LP==0 のみ)。コストは自分のカードのみ。
//
// 句マッピング:
//   a1 = action:declare + matcherCondition triggerCharMatches{payloadKey:'byUid', side:'self', filter:{apMin:7000}}
//        (=「自分の現場のAP7000以上のキャラがアクション」actor=byUid) + limit turn:1 →
//        charGrantAbility{uid:'$trigger.byUid', scope:'turn', ability: <granted>} (B08014 uid 形 / B02014 descriptor 形)。
//        granted = 【ターン1】leave:to-remove + matcherCondition removedCharMatches{side:'opp', cause:'contact-ap',
//        by:'self'} (「相手の現場のキャラがこのキャラ(=付与先=source.uid)とのコンタクトによってリムーブ」、
//        D09010 反撃 idiom の by:'self' 版) → draw1。本 wave で validate.ts の leave:to-remove grant 禁止を解禁 +
//        handleHook が grantedAbilities を合算走査する (在場 observer) ため end-to-end 発火。
//   a2 = 【宣言】cost pay[sleepSelf, removeFromHand n:1] + limit turn:1 → sequence carrier
//        (charModifyAP 短縮形 pick {max:1, side:'either', filter:{lpMin:0,lpMax:0,trait:'高校生'}, +1000, scope:'turn',
//         bind:'$picked'} = 「LP0の[高校生]を1枚まで選びAP+1000」+ sceneSetState rider {uid:'$picked.uid', active}
//        = 「アクティブにし」。B03088 a1 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare',
    matcherCondition: { kind: 'triggerCharMatches', payloadKey: 'byUid', side: 'self', filter: { apMin: 7000 } },
  },
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  effect: {
    kind: 'atom',
    verb: 'charGrantAbility',
    args: {
      uid: '$trigger.byUid', // 「そのキャラ (=AP7000以上のアクションしたキャラ)」に与える
      scope: 'turn', // ターン終了時まで
      ability: {
        id: 'b07063_granted_drain',
        limit: { kind: 'turn', n: 1 }, // 与える能力自身の【ターン1】
        trigger: {
          hook: 'leave:to-remove',
          // 相手の現場にいるキャラ (side:'opp') がこのキャラ (by:'self' = 付与先=source.uid) との
          // コンタクトによって (cause:'contact-ap') リムーブされたとき
          matcherCondition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
        },
        effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        description:
          '【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。',
      },
    },
  },
  description:
    '【ターン1】自分の現場にいるAP7000以上のキャラがアクションしたとき、ターン終了時までそのキャラに「【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。」を与える。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' }, // 【スリープ】
      {
        kind: 'removeFromHand', // 〚手札を1枚リムーブする〛
        target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' },
        n: 1,
      },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      // LP0の〚特徴[高校生]〛のキャラを1枚まで選び (max:1=0可、either)、ターン終了時までAP＋1000する
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: { max: 1, side: 'either', filter: { lpMin: 0, lpMax: 0, trait: '高校生' }, delta: 1000, scope: 'turn', bind: '$picked' },
      },
      // アクティブにし (同じ picked へ rider、既 active/自身も no-op で安全)
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$picked.uid', state: 'active' } },
    ],
  },
  description:
    '【宣言】【ターン1】【スリープ】〚手札を1枚リムーブする〛：LP0の〚特徴［高校生］〛のキャラを1枚まで選び、アクティブにし、ターン終了時までAP＋1000する。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B07063: CardDef = {
  id: 'B07063',
  no: '0792/B07063',
  kind: 'character',
  names: ['鈴木園子'],
  colors: ['白'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['高校生', '鈴木財閥'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414010635563.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
