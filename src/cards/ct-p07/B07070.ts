// cards/ct-p07/B07070 新出智明 (キャラ) — engine変更0 (handAtMost gate + pick-share buff + cutin)
// rules: 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【登場時】自分の手札が2枚以下の場合、レベル7以上の【赤】のキャラを1枚まで選び、
//     ターン終了時までAP＋1000し、〚突撃〛（登場したターンからすぐにアクションできる）を与える。
//   【カットイン】AP＋2000（コンタクト中に手札からリムーブして使う）
//
// 公式Q&A:
//   Q: このキャラを手札から使用して登場させた場合、このカードは「自分の手札」に数えますか？ A: いいえ、数えません。
//   → engine 自動成立: hand-use-card.ts は mutate.hand.remove を enter hook emit より前に実行する。
//     ネクストヒント経路 (next-hint.ts) も同順。よって【登場時】解決時の handAtMost{self,2} 評価時点で
//     このカードは既に手札から除去済 = 数に含まれない。特別処理不要。
//
// 句マッピング:
//   a1: 【登場時】= triggered + trigger{hook:'enter', selfOnly:true}。
//     「自分の手札が2枚以下の場合」= effect 内 conditional{if:handAtMost{player:'self',n:2}}
//        (「〜の場合」は解決時評価 = effect 内 conditional、rules/15)。handAtMost handler は hand.length<=n。
//     「レベル7以上の【赤】のキャラを1枚まで選び、…AP＋1000し、〚突撃〛を与える」=
//        sequence で 1 pick を 2 atom が共有 (BUG-130 pick-share)。
//        step1 = charModifyAP 短縮形 carrier {max:1, side:'either', filter:{color:'赤', levelMin:7},
//                delta:1000, scope:'turn', bind:'$picked'} (B07079 a2 step1 同型。⚠ 明示 uid:'$pick'+target は
//                human 経路で後続 step が bind 未解決 no-op になるため禁止 BUG-130)。
//                「キャラ」エリア指定なし=どちらの現場でも (rules/15) → side:'either'。「1枚まで」=max:1 (0枚可)。
//        step2 = charGrantKeyword {uid:'$picked.uid', kw:'突撃', scope:'turn'} (PR181/PR187 step2 $bound.uid 同型。
//                charGrantKeyword は scope:'action' 禁止 → 'turn' 一択)。0枚/候補0 → '$picked' 未束縛 → step2 no-op。
//   a2: 【カットイン】AP＋2000 = triggered on-hand + trigger{hook:'effect:declared',optional,selfOnly} +
//        charModifyAP{uid:'$contact.byUid', delta:2000, scope:'contact'} (B07006 a1 / B07079 a3 同型。色制限なし rules/09)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // 自分の手札が2枚以下の場合 (「〜の場合」= 解決時評価 → effect 内 conditional。
  //  このカードは enter 時点で手札除去済 = 数えない、公式Q&A と整合)
  effect: {
    kind: 'conditional',
    if: { kind: 'handAtMost', player: 'self', n: 2 },
    then: {
      kind: 'sequence',
      steps: [
        // レベル7以上の【赤】のキャラを1枚まで選び、ターン終了時までAP＋1000し (短縮形 carrier + bind:'$picked')
        {
          kind: 'atom',
          verb: 'charModifyAP',
          args: { max: 1, side: 'either', filter: { color: '赤', levelMin: 7 }, delta: 1000, scope: 'turn', bind: '$picked' },
        },
        // 〚突撃〛（登場したターンからすぐにアクションできる）を与える (同一 picked キャラへ)
        { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$picked.uid', kw: '突撃', scope: 'turn' } },
      ],
    },
  },
  description:
    '【登場時】自分の手札が2枚以下の場合、レベル7以上の【赤】のキャラを1枚まで選び、ターン終了時までAP＋1000し、〚突撃〛を与える。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  // 【カットイン】(コンタクト中に手札から使用)
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  // 【カットイン】AP＋2000 — コンタクト中の自分側キャラ ($contact.byUid) を contact scope で加算
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B07070: CardDef = {
  id: 'B07070',
  no: '0799/B07070',
  kind: 'character',
  names: ['新出智明'],
  colors: ['赤'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['医師'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414010664238.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md',
  ],
};
