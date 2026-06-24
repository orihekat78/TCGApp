// cards/ct-p08/B08023 大岡紅葉 (character R) — engine変更0 (carrier-reuse 短縮形, 2026-06-24)
// rules: rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md, rules/19-special-rules.md
//
// 公式テキスト:
//   【登場時】以下から1つ選んで行う。
//   ・自分の現場にいる〚カード名［伊織無我］〛を1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットし、
//     ターン終了時までAP＋2000する。
//   ・自分の現場にいる〚カード名［伊織無我］〛を1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットし、
//     ターン終了時まで〚突撃〛を与える。
//   ・相手の現場にいるキャラを1枚まで選び、相手のデッキのカードを上から1枚裏向きでセットし、スリープさせる。
//
// 句マッピング:
//   - 【登場時】= triggered enter selfOnly (BUG-032)
//   - 「以下から1つ選んで行う」= choice(chooser:'self') of 3 sequences
//   - carrier-reuse は **短縮形必須** (DSL罠): charSetCard{player,max,filter,fromDeckTop,bind:'$picked'}
//     (uid/target を書かない)。明示 `uid:'$pick'+target` 形は **human 経路で bind 喪失** → rider が
//     silent no-op になる (敵対 review 実測: AP=3000 / sleep 不発、BUG-158)。短縮形は paShortFormAwait の
//     re-dispatch で a.uid=実uid となり runAtom preamble の writeback ($picked) が human/AI 両経路で発火
//     (atom-handlers.ts:95、短縮形 exemplar B07070/B07079)。「1枚まで」=max:1 (0可) → 0 pick で bind 未解決 →
//     setCard も rider も silent no-op (rules/15)。
//   - opt1 rider=charModifyAP{scope:'turn'} / opt2 rider=charGrantKeyword{kw:'突撃',scope:'turn'}
//   - opt3 = charSetCard{player:'opp'} = 相手デッキ source + 相手キャラ候補 (BUG-120 fix: chooser=controller)、
//     exemplar B02020/B05028。スリープは sceneSetState{state:'sleep'} (スタン状態は setState が維持 rules/24)

import type { AbilityDef, CardDef } from '@/engine/types';

// 自陣 伊織無我 ≤1 に自デッキ上端を裏向きセット (短縮形 carrier、bind:'$picked')
const SET_IORI_SELF = {
  kind: 'atom' as const,
  verb: 'charSetCard' as const,
  args: { player: 'self', max: 1, side: 'self', filter: { cardName: '伊織無我' }, fromDeckTop: true, faceUp: false, bind: '$picked' },
};

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      // opt1: 伊織無我 ≤1 に self-deck setCard → ターン終了時まで AP+2000
      {
        kind: 'sequence',
        steps: [
          SET_IORI_SELF,
          { kind: 'atom', verb: 'charModifyAP', args: { uid: '$picked.uid', delta: 2000, scope: 'turn' } },
        ],
      },
      // opt2: 伊織無我 ≤1 に self-deck setCard → ターン終了時まで 突撃 付与
      {
        kind: 'sequence',
        steps: [
          SET_IORI_SELF,
          { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$picked.uid', kw: '突撃', scope: 'turn' } },
        ],
      },
      // opt3: 相手の現場キャラ ≤1 に opp-deck setCard → スリープ
      {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'charSetCard', args: { player: 'opp', max: 1, side: 'opp', fromDeckTop: true, faceUp: false, bind: '$picked' } },
          { kind: 'atom', verb: 'sceneSetState', args: { uid: '$picked.uid', state: 'sleep' } },
        ],
      },
    ],
  },
  description:
    '【登場時】以下から1つ選択: ① 伊織無我1枚まで→自deck裏向きセット+ターン終了時まで AP+2000 / ② 同→ターン終了時まで突撃付与 / ③ 相手現場キャラ1枚まで→相手deck裏向きセット+スリープ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

export const B08023: CardDef = {
  id: 'B08023',
  no: '0863/B08023',
  kind: 'character',
  names: ['大岡紅葉'],
  colors: ['緑'],
  level: 6, ap: 5000, lp: 1,
  traits: ['高校生'], keywords: [],
  rarity: 'R',
  imageUrl: '1770731204449510.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
