// cards/ct-d11/D11014 横溝重悟 (キャラ・疾風+宣言)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
// spec: .claude/specs/cards-analysis/D11014.md
//
// 公式テキスト:
//   【疾風】キャラを1枚まで選び、ターン終了時までAP－1000する。
//   【宣言】【スリープ】〚手札を1枚リムーブする〛: 自分のリムーブエリアにあるレベル5以下の
//     〚特徴［警察］〛のキャラを1枚まで選び、登場させる。
//     〚カード名［萩原千速］〛を登場させた場合、カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: 【疾風】= 1番目登場 trigger + charModifyAP PA 短縮形 (D08003 / D11020 同型 DSL)
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true,
    matcherCondition: { kind: 'enterOrderEquals', n: 1 }, // 【疾風】= 1番目に登場で発火
  },
  effect: {
    // キャラを1枚まで選び、ターン終了時まで AP-1000
    kind: 'atom', verb: 'charModifyAP', args: { max: 1, side: 'either', delta: -1000, scope: 'turn' },
  },
  description: '【疾風】キャラを1枚まで選び、ターン終了時までAP－1000する。',
  ruleRefs: ['rules/17-icons.md', 'rules/19-special-rules.md'],
};

// a2: 【宣言】【スリープ】〚手札を1枚リムーブする〛: リムーブ警察 Lv5- 登場 → 萩原千速 なら 1 ドロー
//   - cost: sleepSelf のみ (もともと sleep / stun なら canPay=false で宣言不可 — rules/21、engine 既存保証)
//   - 手札 1 リムは effect step として D08013 同型 ({ player: 'self', n: 1 } で modal pick)
//     → 自動リムーブではなく user 選択。後続 step が pendingEffectPick 解決まで pause
//   - sceneEnter の `max: 1` + 候補 0 件なら user は skip → chain 進行
//   - sceneEnter の `bind: '$entered'` で登場キャラ情報を ctx.bindings に格納
//   - boundMatchesFilter で 〚カード名[萩原千速]〛(分割名完全一致) を declarative 判定
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' }, // 【宣言】【スリープ】 (もともと sleep / stun なら canPay=false で宣言不可)
  effect: {
    kind: 'sequence',
    steps: [
      // 〚手札を1枚リムーブする〛 (D08013 同型 modal pick)
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      // 自分のリムーブエリアにあるレベル5以下の[警察]のキャラを1枚まで選び、登場させる (候補 0 件 / user skip OK)
      // bind:$entered が必要なため短縮形にせず明示 target を保持
      { kind: 'choice', chooser: 'self',
        options: [{ kind: 'atom', verb: 'sceneEnter',
          args: {
            player: 'self', cardId: '$pick.cardId', viaEffect: true, bind: '$entered',
            target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { trait: '警察', levelMax: 5 } }, n: { min: 0, max: 1 }, chooser: 'self' },
          },
        }],
      },
      // 〚カード名[萩原千速]〛を登場させた場合 (分割名完全一致) カードを1枚引く
      { kind: 'conditional',
        if: { kind: 'boundMatchesFilter', bindKey: '$entered', filter: { cardName: '萩原千速' } },
        then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description: '【宣言】【スリープ】〚手札を1枚リムーブする〛: リムーブのLv5以下[警察]を1枚まで登場。[萩原千速]登場で1ドロー。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const D11014: CardDef = {
  id: 'D11014',
  no: '0941/D11014',
  kind: 'character',
  names: ['横溝重悟'], colors: ['黄'],
  level: 7, ap: 6000, lp: 1,
  traits: ['警察', '神奈川県警'], keywords: [],
  rarity: 'D', imageUrl: '1775608977348526.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
