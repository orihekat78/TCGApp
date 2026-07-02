// cards/ct-p03/B03085 諸伏景光 (キャラ) — engine additive wave-11 (hirameki actor payload consumer)
// rules: 03-field-areas.md(スタン/現場5枚), 10-action-event.md(ヒラメキ), 15-abilities-effects.md(してもよい/〜枚まで),
//        17-icons.md(【登場時】【解決編】), 20-color-and-switch.md(スイッチ、公式Q&A), 24-qa-naming-stun.md
//
// 公式テキスト:
//   【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル6以下の
//     〚特徴［警察］〛のキャラを1枚まで選び、スリープ状態で登場させる。
//   【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる。
//     （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//   公式Q&A: 手札からリムーブしたカードを選んで登場させることも可 (リムーブエリア到達後は通常の候補) /
//            現場5枚時はスイッチ登場可 (登場したばかりの本カードもリムーブ可)。
//
// 句マッピング:
//   [effect col a1] 【登場時】手札1リムーブしてもよい。そうした場合、リムーブの Lv6以下〚警察〛キャラ
//     1枚までスリープ状態で登場
//     => trigger{hook:'enter', selfOnly:true} + effect optional{chain[discard{player:self,n:1},
//        sceneEnter 明示 pick 形 {player:self, cardId:'$pick.cardId', from:'remove', viaEffect:true,
//        enterSleep:true, target:{pick, query:{area:'remove', side:'self', filter:{trait:'警察',
//        levelMax:6, kind:'character'}}, n:{min:0,max:1}, chooser:'self'}}]}
//        — remove-enter は D09020/B07058 明示形 VERBATIM (D05006 の短縮形は runtime awaiting-pick に
//        落ち AI queue 経路で解決者不在 — 本 wave 実測により明示形採用。trait filter の remove 経路
//        honor は D08024/D09020 precedent)。optional=「してもよい」、
//        chain=「そうした場合」(step1 適用時のみ step2)、max:1=「1枚まで」0可 (rules/15)。
//        discard で落とした手札カード自身も直後の remove-area 候補に入る (公式Q&A 通り、
//        chain step 逐次解決で step2 の候補列挙は step1 適用後の盤面)。
//   [hira col a2] 【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる
//     => B05111 a2 と同一 (wave-11 actor payload。裁定・edge は src/cards/ct-p05/B05111.ts 句マッピング参照):
//        bare atom sceneSetState{uid:'$trigger.byUid', state:'stun'} + condition caseStatus 解決編。
//        fire/skip が「1枚まで選び (0可)」と一致 / partner・離場 actor は silent no-op / optional{} wrapper 禁止。

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
  // 【解決編】(自分の事件が解決編)
  condition: { kind: 'caseStatus', status: '解決編' },
  // アクション中のキャラ (= '$trigger.byUid'、wave-11 actor payload) をスタン
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$trigger.byUid', state: 'stun' } },
  description:
    '【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）',
  ruleRefs: ['rules/10-action-event.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

export const B03085: CardDef = {
  id: 'B03085',
  no: '0338/B03085',
  kind: 'character',
  names: ['諸伏景光'],
  colors: ['黄'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['警察', '警視庁', '公安'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1729133443614274.jpg',
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
