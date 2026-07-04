// cards/ct-p09/B09070 萩原千速&萩原研二 (character/MR) — CARD PHASE step12
// (shippuFiredCharThisTurn forEach 初 consumer、BUG-170 修正で解禁。engine変更 = BUG-170 のみ)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md,
//        rules/18-mr.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md
//
// 公式テキスト:
//   【疾風】自分のリムーブエリアにある、レベル6以下の〚特徴［神奈川県警］〛のキャラか【疾風】を持つ
//   レベル6以下のキャラを1枚まで選び、手札に加える。（自分の現場にこのターンで1番に登場したときに発動する）
//   【パートナー黄】【宣言】【スリープ】：レベル9以下のキャラを1枚まで選び、リムーブする。
//   自分のターン終了時、自分の現場にいるこのターン中に【疾風】を発動していたすべてのキャラを
//   アクティブにする。この能力はパートナーエリアでも発動する。
//
// 句マッピング:
//   - 【疾風】=> trigger{hook:'enter', selfOnly:true, matcherCondition:enterOrderEquals{n:1}}
//     (B09071 a2 同型 = abilityIsShippu 判定形。公式Q&A「効果による登場でも/相手ターンでも発動」=
//     enter hook の既存挙動)。
//   - 「〜のキャラか【疾風】を持つ〜キャラを1枚まで選び、手札に加える」=> handAddFromRemove 短縮形
//     {max:1, filterAny:[{trait 神奈川県警×lv6×char},{keyword 疾風×lv6×char}]} (trait/keyword 異軸 OR =
//     filterAny any-match、D11012 idiom + B09090 cost と同 OR 形。remove からキャラ = kind:'character')。
//   - 【パートナー黄】【宣言】【スリープ】=> declared + condition partnerColor{黄} + cost sleepSelf。
//     「レベル9以下のキャラを1枚まで選び、リムーブする」=> sceneRemove 短縮形 {max:1, side:'either',
//     cause:'effect', filter:{levelMax:9}}。
//   - 「自分のターン終了時、…【疾風】を発動していたすべてのキャラをアクティブにする」=>
//     trigger{hook:'phase:end:start'} + condition{turn:self} (B08049 idiom) +
//     forEach{over: all self scene filter{shippuFiredCharThisTurn:true}} → sceneSetState active
//     (engine mega-wave W6 step4 r58 の想定 exemplar。**BUG-170**: 本 flag は endTurn 清掃だと
//     queue 解決前に消える → startTurn 境界清掃へ移動済)。公式Q&A「スタン状態をアクティブにした場合
//     はスリープになる」= sceneSetState active の rules/03 代替 (既存機序)。
//   - 「この能力はパートナーエリアでも発動する」=> scope:'on-partner-area' (= PA OR 現場、
//     listeners/triggered.ts scopeAllowsArea)。本カードは MR (rarity 'MR' → rules/18 PA 常駐可)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filterAny: [
        { trait: '神奈川県警', levelMax: 6, kind: 'character' },
        { keyword: '疾風', levelMax: 6, kind: 'character' },
      ],
    },
  },
  description:
    '【疾風】自分のリムーブエリアにある、レベル6以下の〚特徴［神奈川県警］〛のキャラか【疾風】を持つレベル6以下のキャラを1枚まで選び、手札に加える。（自分の現場にこのターンで1番に登場したときに発動する）',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '黄' },
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 9 } },
  },
  description: '【パートナー黄】【宣言】【スリープ】：レベル9以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-partner-area',
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  effect: {
    kind: 'forEach',
    over: { kind: 'all', query: { area: 'scene', side: 'self', filter: { shippuFiredCharThisTurn: true } } },
    do: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$each.uid', state: 'active' } },
  },
  description:
    '自分のターン終了時、自分の現場にいるこのターン中に【疾風】を発動していたすべてのキャラをアクティブにする。この能力はパートナーエリアでも発動する。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/18-mr.md'],
};

const a4: AbilityDef = {
  id: 'a4',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B09070: CardDef = {
  id: 'B09070',
  no: '1010/B09070',
  kind: 'character',
  names: ['萩原千速&萩原研二', '萩原千速', '萩原研二'],
  colors: ['黄'],
  level: 9,
  ap: 8000,
  lp: 1,
  traits: ['警察', '神奈川県警', '警視庁'],
  rarity: 'MR',
  imageUrl: '1775608890137963.jpg',
  abilities: [a1, a2, a3, a4],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
