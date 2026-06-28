// cards/ct-p03/B03088 松田陣平 (character R) — engine変更0 (carrier-reuse 短縮形 + 4名 bond gate + fromSelf hirameki)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/10-action-event.md
//
// 公式テキスト:
//   【宣言】【ターン1】レベル7以下のキャラを1枚まで選び、アクティブにし、AP＋1000し、ターン終了時まで〚突撃〛
//     （登場したターンからすぐにアクションできる）を与える。カードを1枚引く。この能力は自分の現場に
//     〚カード名［降谷零］〛と〚カード名［諸伏景光］〛と〚カード名［伊達航］〛と〚カード名［萩原研二］〛がいる場合に宣言できる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。
//   公式Q&A: AP＋1000はターン終了時に切れない（そのキャラが現場にいるかぎり持続）/ このキャラ自身を選べる /
//            アクティブ状態のキャラも選べる / ヒラメキは発動させないことを選択できる。
//
// 句マッピング:
//   - 【宣言】(コロン無し=コスト無) => type:'declared', scope:'on-scene' [B02005/B05066 a2 precedent]
//   - 【ターン1】 => limit:{kind:'turn', n:1}
//   - 「自分の現場に［降谷零］と［諸伏景光］と［伊達航］と［萩原研二］がいる場合に宣言できる」=> condition and{bond×4}
//     [bond cond {kind:'bond', cardName:'X'} = 現場に該当カード名のキャラ (rules/17 §絆、パートナー除く)。
//      and.cs = cond/eval.ts:31 .every() 真AND。4名 AND 同型 D09004]
//   - 「レベル7以下のキャラを1枚まで選び、アクティブにし、AP＋1000し」=> sequence carrier:
//     step1 charModifyAP 短縮形 carrier {max:1, side:'either', filter:{levelMax:7}, delta:1000, scope:'permanent', bind:'$picked'}
//       [carrier は B02005/B08023 と VERBATIM arg shape (短縮形必須、明示uid+target は human 経路 bind 喪失 BUG-158)。
//        「レベル7以下のキャラ」= side:'either' (エリア指定なし=両側 rules/15、Q&A 自身選択可と整合)。
//        「1枚まで」= max:1 (0枚可 rules/15)。AP＋1000 は Q&A「ターン終了で切れず現場にいる限り持続」= scope:'permanent'
//        (mutate.char.modifyAP apMod_permanent bucket、clearTurnEffects('turn') の delete 対象外=永続)。]
//     step2 sceneSetState rider {uid:'$picked.uid', state:'active'} [「アクティブにし」。既active/自身も no-op で安全 (Q&A)。
//        rider は uid:'$picked.uid' で carrier の pick を再利用 (runAtom preamble Task D E0 が短縮形 carrier 解決時
//        ctx.bindings['$picked'] に書込、B08023 が sceneSetState rider を同型使用)]
//     step3 charGrantKeyword rider {uid:'$picked.uid', kw:'突撃', scope:'turn'} [「ターン終了時まで突撃」=
//        grantedKeywords (clearTurnEffects('turn') で削除=turn-scope)。B02005/B07070 同型]
//   - 「カードを1枚引く」=> step4 draw {player:'self', n:1} (独立、pick に依存しない)
//   - 【ヒラメキ】「このカードを手札に加える」=> a2 triggered on-evidence + evidence:remove-by-action optional +
//       handAddFromRemove {player:'self', fromSelf:true} [PR085/B05102/B06033 a2 と VERBATIM。fromSelf=ctx.source.cardId
//       (リムーブされた証拠=このカード自身) を remove→手札。optional=発動/不発を所有者選択 rules/10]
//   - cutIn/henso 印字無 → 未カバー句なし。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'bond', cardName: '降谷零' },
      { kind: 'bond', cardName: '諸伏景光' },
      { kind: 'bond', cardName: '伊達航' },
      { kind: 'bond', cardName: '萩原研二' },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: { max: 1, side: 'either', filter: { levelMax: 7 }, delta: 1000, scope: 'permanent', bind: '$picked' },
      },
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$picked.uid', state: 'active' } },
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$picked.uid', kw: '突撃', scope: 'turn' } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ],
  },
  description:
    '【宣言】【ターン1】レベル7以下のキャラを1枚まで選び、アクティブにし、AP＋1000し、ターン終了時まで〚突撃〛を与える。カードを1枚引く。自分の現場に［降谷零］［諸伏景光］［伊達航］［萩原研二］がいる場合に宣言できる。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', fromSelf: true } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B03088: CardDef = {
  id: 'B03088',
  no: '0341/B03088',
  kind: 'character',
  names: ['松田陣平'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1729133443648249.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/10-action-event.md',
  ],
};
