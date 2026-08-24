// cards/pr-01/PR105 工藤有希子 (character) — CARD PHASE step12 batch2
// (nameOverride 初 live consumer: W6 step1/2 が本カード名指しで出荷した primitive の解禁、engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/16-card-set.md,
//        rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md
//
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。ターン終了時まで
//   このキャラは〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）を持つ。
//   【宣言】【ターン1】ターン終了時までこのキャラをAP＋1000する。キャラのカード名を1つ指定し、
//   ターン終了時までこのキャラのカード名を指定したカード名に書き換えてもよい。
//
// 句マッピング:
//   - a1「デッキのカードを上から1枚裏向きでこのキャラにセットする」=> charSetCard{uid:'$self',
//     fromDeckTop:true, faceUp:false} (B07031 a1 と印字同文・同型。裏向きセット = 情報を持たない
//     rules/16、公式Q&A整合)。
//   - a1「ターン終了時までこのキャラは〚突撃［キャラ］〛を持つ」=> charGrantKeyword{uid:'$self',
//     kw:'突撃[キャラ]', scope:'turn'} (B05089 a2 同型。turnEffects grantedKeywords、
//     clearTurnEffects('turn') 失効)。
//   - a2「ターン終了時までこのキャラをAP＋1000する」=> charModifyAP{uid:'$self', delta:1000,
//     scope:'turn'} (D01006 a1 同型)。
//   - a2「キャラのカード名を1つ指定し」=> declareName{bind:'named', optional:true} (W6 step1 verb。
//     「してもよい」句 → args.optional=true = DeclareCardNameModal に「指定しない」を表示。
//     skip/AI 未供給 = 空文字 → nameOverride 未設定扱い (read/char.ts 空文字防御) = 書き換え decline。
//     公式Q&A「指定せず AP+1000 のみも可」と整合)。
//   - a2「ターン終了時までこのキャラのカード名を指定したカード名に書き換える」=>
//     charSetTurnEffect{uid:'$self', key:'nameOverride', val:'$dyn.declaredName'}
//     (W6 step2 出荷・probe pin 済 (engine-mega-w6.test.ts「PR105 nameOverride 経路」)。
//     **完全置換** = 印字 names[] 全部を置換、names()/effectiveNameComponents 両 honor site。
//     rules/19 複数名分割は書き換え後の有効名にも適用される。⚠ 外部付与名 (grantNames)
//     との相互作用は公式Q&A未確認 — DEFERRED-INDEX megaw6 節 (6)、本カード単独では非交差)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false, player: 'self' } },
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[キャラ]', scope: 'turn' } },
    ],
  },
  description:
    '【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。ターン終了時までこのキャラは突撃[キャラ]を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
      {
        kind: 'atom',
        verb: 'declareName',
        args: {
          bind: 'named',
          optional: true,
          domain: 'registered-character-card-name',
        },
      },
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'nameOverride', val: '$dyn.declaredName' } },
    ],
  },
  description:
    '【宣言】【ターン1】ターン終了時までこのキャラをAP＋1000する。キャラのカード名を1つ指定し、ターン終了時までこのキャラのカード名を指定したカード名に書き換えてもよい。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};

export const PR105: CardDef = {
  id: 'PR105',
  no: '0486/PR105',
  kind: 'character',
  names: ['工藤有希子'],
  colors: ['白'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['女優'],
  rarity: 'PR',
  imageUrl: '1743027497321576.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
