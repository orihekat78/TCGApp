// cards/ct-p06/B06077 ジョディ・スターリング (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【パートナー赤】〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる） \n【FILE6】このキャラのアクション終了時、このキャラを現場からリムーブしてもよい。そうした場合、手札からレベル6以下の〚特徴［FBI］〛のキャラを1枚まで登場させる。
// 句マッピング:
//   - 【パートナー赤】〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる） => __shared partnerColorKeyword({color:'赤', kw:'突撃[キャラ]', abilityId:'a1'}) — continuous, condition partnerColor{color:'赤'}, continuousModifier.grantKeywords()=>['突撃[キャラ]'] [EXACT exemplar src/cards/ct-d11/D11009.ts:14 partnerColorKeyword({color:'黄', kw:'突撃[キャラ]', abilityId:'a1'}) for the identical printed clause 【パートナー黄】〚突撃［キャラ］〛 (registered in ct-d11/index.ts:12 + cards/index.ts). 色違いのみ(赤). Shared class src/cards/_shared/partnerColorKeyword.ts builds {type 'continuous', condition:partnerColor, continuousModifier.grantKeywords:()=>['突撃[キャラ]']}. partnerColor condition grounded cap-map L142. The granted string '突撃[キャラ]' is honored by engine action gate src/engine/flow/main/action.ts:55 (targetKind==='char' && kws.includes('突撃[キャラ]')) — 名乗り状態でもアクション[キャラ]可. condition不成立なら能力を持たない扱い(rules/17).]
//   - 【FILE6】(条件ゲート) => ability.condition { kind 'fileAtLeast', n:6 } [EXACT exemplar src/cards/ct-p05/B05108.ts a2 condition {kind 'fileAtLeast', n:6} for identical printed 【FILE6】. fileAtLeast condition grounded cap-map L147 (owner file.length>=n; assisted-partner も数える=qAndA). 条件不成立=能力を持たない扱い rules/17.]
//   - このキャラのアクション終了時 => trigger { hook 'action:end', selfOnly:true } [EXACT exemplar src/cards/ct-p05/B05108.ts a2 trigger {hook 'action:end', selfOnly:true} (also ct-p03/B03073.ts). action:end emitted by engine src/engine/flow/action/state-machine.ts:338,459. selfOnly gates source.uid==actor; 離場 actor は collectCardsInPlay 対象外+selfOnly で「現場にいなければ不発」自然成立 (rules/22 qAndA: 離場⇒アクション終了の順).]
//   - このキャラを現場からリムーブしてもよい。そうした場合、…登場させる => effect optional{ sequence[ sceneRemove{uid:'$self',cause:'effect'}, sceneEnter{...} ] } [EXACT exemplar src/cards/ct-p05/B05108.ts a2 effect = optional{sequence[sceneRemove{uid:'$self',cause:'effect'}, sceneEnter{...}]}. 「〜してもよい」=optional ラッパ(rules/15); 「そうした場合」=optional 内の連続 step (decline すれば両方発生せず). sceneRemove uid:'$self' = 自身リムーブ (cap-map L35; 発動キャラ離場でも後続継続 rules/15). cascade-DEFER 非該当: action:end trigger (removal-observer ではない) かつ sceneRemove は self のみ (別カードリムーブ無).]
//   - 手札からレベル6以下の〚特徴［FBI］〛のキャラを1枚まで登場させる => atom sceneEnter { player:'self', from:'hand', max:1, viaEffect:true, filter:{levelMax:6, trait:'FBI', kind 'character'} } [EXACT exemplar src/cards/ct-p05/B05108.ts a2 sceneEnter{player:'self', from:'hand', max:1, viaEffect:true, filter:{levelMax:7, color:'黒', kind 'character'}} — B06077 は filter のみ差替(levelMax:6, trait:'FBI'). from:'hand' short-form builds source-area pick ($pick.cardId) per cap-map L33. max:1='1枚まで'=0枚可(rules/15). viaEffect=効果登場で色制限なし(rules/20)+enter hook 発火(【登場時】発動, qAndA). filter trait+levelMax+kind は matchOneFilter で honor (exemplar src/cards/ct-d01/D01008.ts hand sceneEnter filter:{trait:'少年探偵団', levelMax:4, kind 'character'}). 'FBI' は実在 trait (card自身 features:'FBI'; D04002/3/4 traits['FBI']). kind 'character' per BUG-123 (テキスト「キャラ」).]

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

const a1 = partnerColorKeyword({
  color: '赤',
  kw: '突撃[キャラ]',
  abilityId: 'a1'
});

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'fileAtLeast',
    n: 6
  },
  trigger: {
    hook: 'action:end',
    selfOnly: true
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            uid: '$self',
            cause: 'effect'
          }
        },
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            from: 'hand',
            max: 1,
            viaEffect: true,
            filter: {
              levelMax: 6,
              trait: 'FBI',
              kind: 'character'
            }
          }
        }
      ]
    }
  },
  description: '【FILE6】このキャラのアクション終了時、このキャラを現場からリムーブしてもよい。そうした場合、手札からレベル6以下の〚特徴［FBI］〛のキャラを1枚まで登場させる。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B06077: CardDef = {
  id: 'B06077',
  no: '0697/B06077',
  kind: 'character',
  names: [
    'ジョディ・スターリング'
  ],
  colors: [
    '赤'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    'FBI'
  ],
  rarity: 'R',
  imageUrl: '1754285244552000.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md'
  ],
};
