// cards/ct-p06/B06003 毛利蘭＆江戸川コナン (character/MR) — M2後半 batch
// (engine primitive: Cost selfLpDeltaTurn は同 branch で出荷済 — evaluate.ts 恒真 canPay +
//  pay.ts lpMod_turn 書込・emit 無し)
// rules: rules/03-field-areas.md, rules/11-reasoning.md, rules/15-abilities-effects.md,
//        rules/17-icons.md, rules/18-mr.md, rules/19-special-rules.md,
//        rules/21-declared-ability-cost.md, rules/22-qa-action-contact.md
//
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）
//   【パートナー青】【宣言】【ターン1】〚ターン終了時までLP－2する〛：キャラを1枚まで選び、スリープさせる。
//   【宣言】【ターン1】カードを1枚引く。自分の手札が5枚以上ある場合、手札を1枚リムーブする。
//   この能力は自分の現場にキャラが3枚以上いて、全員のLPの合計が2以下の場合に宣言できる。
//   この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000
//
// 句マッピング:
//   - 〚突撃〛=> keywords:['突撃'] (rules/13。B03067 同形式)。
//   - MR => rarity:'MR' (read/def.ts isMr = rarity.startsWith('MR')。MR core 出荷済 rules/18)。
//   - 複数名カード (rules/19「＆」) => names 分割 ['毛利蘭＆江戸川コナン','毛利蘭','江戸川コナン']。
//   - a1「【パートナー青】【宣言】【ターン1】」=> declared + condition partnerColor 青 + limit turn1
//     (BUG-099: canDeclaredAbility が condition を gate)。
//   - a1 cost「〚ターン終了時までLP－2する〛」=> {kind:'selfLpDeltaTurn', delta:-2}
//     (canPay 恒真 = LP は下限なし rules/19、公式Q&A「LP1以下でも支払可・負値可」。
//      lpMod_turn は clearTurnEffects で失効。コストの LP 減は emit を出さない rules/21 —
//      「効果によって」系条件を満たさない。⚠ 下がった実効 LP は a2 条件評価に即時反映 = 仕様通り)。
//   - a1「キャラを1枚まで選び、スリープさせる」=> sceneSetState 短縮形 {player:'self', side:'either',
//     max:1, state:'sleep'} (D09014/D02005 a1 同型。「キャラ」= 両現場 rules/15、「まで」= 0枚可)。
//   - a2「この能力は自分の現場にキャラが3枚以上いて、全員のLPの合計が2以下の場合に宣言できる」=>
//     condition and[sceneHas{area scene/side self/kind character, nMin:3}, sceneLpSum{max:2}]
//     (types/effect.ts:33 が本カードを名指しで設計。sceneLpSum は負 LP も合算 = 公式Q&A。
//      area:'scene' query ゆえ PA 在中の自身は枚数にも合計にも入らない = 公式Q&A「現場にいないので含みません」)。
//   - a2「カードを1枚引く。自分の手札が5枚以上ある場合、手札を1枚リムーブする」=>
//     sequence[draw n:1, conditional{if:handAtLeast n:5, then:discard n:1}]
//     (「〜場合」は draw 後の逐次評価 rules/25 B08048 型 — runtime resolver が解決時盤面で if を
//      再評価するため、pre-walk の stable-if 先行評価と齟齬しない)。
//   - a2「この能力はパートナーエリアでも宣言できる」=> scope:'on-partner-area' (B09108 a2 同型。
//     現場からの宣言も canDeclaredAbility は scene area に scope gate を掛けないため両所可)。
//   - a1 は scope 無指定 (= on-scene) → PA 在中では宣言不可 (grounding 罠節)。
//   - 【カットイン】AP＋2000 => D01011 同型 (on-hand + effect:declared + $contact.byUid + scope:'contact')。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  condition: { kind: 'partnerColor', color: '青' },
  cost: { kind: 'selfLpDeltaTurn', delta: -2 },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: { player: 'self', side: 'either', max: 1, state: 'sleep' },
  },
  description:
    '【パートナー青】【宣言】【ターン1】〚ターン終了時までLP－2する〛：キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area',
  limit: { kind: 'turn', n: 1 },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'sceneHas',
        query: { area: 'scene', side: 'self', filter: { kind: 'character' } },
        nMin: 3,
      },
      { kind: 'sceneLpSum', query: { area: 'scene', side: 'self' }, max: 2 },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      {
        kind: 'conditional',
        if: { kind: 'handAtLeast', player: 'self', n: 5 },
        then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【宣言】【ターン1】カードを1枚引く。自分の手札が5枚以上ある場合、手札を1枚リムーブする。この能力は自分の現場にキャラが3枚以上いて、全員のLPの合計が2以下の場合に宣言できる。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
  ],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B06003: CardDef = {
  id: 'B06003',
  no: '0628/B06003',
  kind: 'character',
  names: ['毛利蘭＆江戸川コナン', '毛利蘭', '江戸川コナン'],
  colors: ['青'],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: ['探偵', '毛利探偵事務所', '少年探偵団', '高校生', '空手家'],
  keywords: ['突撃'],
  rarity: 'MR',
  imageUrl: '1754284680531866.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
