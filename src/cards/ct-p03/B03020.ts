// cards/ct-p03/B03020 毛利蘭 (character) — engine変更0 wave (triage-verify+fix, 2026-06-28)
// rules: rules/07-action-flow.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/22-qa-action-contact.md, rules/26-qa-deck-refresh.md
//
// 公式テキスト:
//   このキャラがアクションしたとき、自分のデッキのカードを上から3枚リムーブしてもよい。この効果によって
//   〚カード名［妃英理］〛か〚カード名［工藤新一］〛か〚特徴［毛利探偵事務所］〛のキャラがリムーブされた場合、
//   アクション終了時までこのキャラをAP＋1000する。
//
// 句マッピング (verified twin = B02012 a2 action:declare / B05016 deckRevealUntil+boundToRemove / B03097 charModifyAP scope:action):
//   - このキャラがアクションしたとき = trigger{hook:'action:declare', selfOnly:true} (宣言時=ガード前、rules/22)。
//   - 「デッキ上3枚リムーブしてもよい」= optional 外包 (してもよい、rules/15)。中身は上から3枚を blind mill →
//     deckRevealUntil{maxN:3, filter:{kind:'character'}, filterAny:[cardName妃英理, cardName工藤新一, trait毛利探偵事務所],
//       bind:'$revealed', bindMatch:'$matched'} (engine: AND-of(filter, OR(filterAny)) = 「〜のキャラ」character ∧ 3名のいずれか)。
//   - 「〜がリムーブされた場合 AP+1000 (アクション終了まで)」= conditional{if: bound $matched matched →
//       charModifyAP{uid:'$self', delta:1000, scope:'action'}} ($self=actor=このキャラ、B03097 同型)。
//   - 「上から3枚リムーブ」を全枚 mill するため boundToRemove を $revealed と $matched の両方に適用 (FIX: matched は
//     handAdd しないので $revealed から除外される → 第2 boundToRemove で matched も remove、計3枚 mill。
//     B05016 は handAdd 経路ゆえ単一 boundToRemove だった)。空 bind の boundToRemove は no-op (safe)。
//   - ★公式Q&A: デッキが2枚以下で「3枚リムーブ」が実行不能な場合は以降不解決。共有 deckRevealUntil は
//     不足枚数を公開するカードにも使われるため、このカードだけを exact-three conditional で gate する。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:declare', selfOnly: true },
  effect: {
    kind: 'optional',
    // 公式Q&A: 上から3枚を公開できない場合、以降の効果は解決しない。
    // deckRevealUntil は「上からN枚見る」共通 primitive のため不足時は min(deck,N) を公開する。
    // このカード固有の exact-3 gate は JSON-safe deckAtLeast で包み、共有 primitive の
    // 不足枚数を公開するカード（D07023 等）へ影響させない。
    effect: {
      kind: 'conditional',
      if: {
        kind: 'deckAtLeast',
        player: 'self',
        n: 3,
      },
      then: {
        kind: 'sequence',
        steps: [
        {
          kind: 'atom',
          verb: 'deckRevealUntil',
          args: {
            player: 'self',
            maxN: 3,
            filter: { kind: 'character' },
            filterAny: [{ cardName: '妃英理' }, { cardName: '工藤新一' }, { trait: '毛利探偵事務所' }],
            bind: '$revealed',
            bindMatch: '$matched',
          },
        },
        {
          kind: 'conditional',
          if: { kind: 'bound', key: '$matched', presence: 'matched' },
          then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'action' } },
        },
        { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed' } },
        { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$matched' } },
        ],
      },
    },
  },
  description: 'このキャラがアクションしたとき、自分のデッキのカードを上から3枚リムーブしてもよい。この効果によって〚カード名［妃英理］〛か〚カード名［工藤新一］〛か〚特徴［毛利探偵事務所］〛のキャラがリムーブされた場合、アクション終了時までこのキャラをAP＋1000する。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md', 'rules/22-qa-action-contact.md', 'rules/26-qa-deck-refresh.md'],
};

export const B03020: CardDef = {
  id: 'B03020',
  no: '0278/B03020',
  kind: 'character',
  names: ['毛利蘭'],
  colors: ['青'],
  level: 4, ap: 4000, lp: 1,
  traits: ['高校生', '毛利探偵事務所', '空手家'], keywords: [],
  rarity: 'C',
  imageUrl: '1729133201242432.jpg',
  abilities: [a1],
  ruleRefs: ['rules/07-action-flow.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/22-qa-action-contact.md', 'rules/26-qa-deck-refresh.md'],
};
