// cards/ct-p06/B06066 怪盗キッド＆白馬探 (character MR) — M2後半 mini-wave GREEN (sleepChar trait-filter cost)
// rules: rules/03-field-areas.md, rules/05-turn-phases.md, rules/09-cutin-disguise.md, rules/15-abilities-effects.md,
//        rules/17-icons.md, rules/18-mr.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【宣言】【ターン1】〚このキャラか、このキャラと同じ特徴を持つキャラを1枚スリープさせる〛：
//     相手の現場にいるAP8000以下のキャラを1枚まで選び、デッキの下に移す。
//   自分のターン終了時、自分の現場にスリープ状態かスタン状態のキャラが合わせて3枚以上いる場合、
//     キャラを1枚まで選び、アクティブにする。この能力はパートナーエリアでも発動する。
//   【カットイン】AP＋2000
// 公式QA:
//   - 「コストで相手の現場のキャラをスリープさせられる?」→ いいえ (rules/21 コストは自分のカードのみ → side:'self')
//   - 「スタン状態のキャラをアクティブにした場合は?」→ スリープ状態になる (mutate/scene.ts setState スタン特殊挙動、rules/03/24)
// 句マッピング:
//   - 【宣言】【ターン1】 => type:'declared' + limit:{kind:'turn', n:1} [VERBATIM B05066.ts a2]
//   - 〚このキャラか、このキャラと同じ特徴を持つキャラを1枚スリープさせる〛 => cost sleepChar pick
//     {area:'scene', side:'self', filter:{trait:['怪盗','探偵','高校生']}} [B03060.ts a1 の excludeSelf 抜き clone。
//     印字特徴が静的 (怪盗|探偵|高校生) なので trait 配列 any-match (candidates wants.some) で self 含め全対象を被覆。
//     効果で特徴付与されたキャラも「同じ特徴」に該当 (grantTraits honor 済)。B06066 自身の特徴が動的に変わるケースは
//     静的 list では追従しない (現 pool に該当効果なし、out-of-scope)]
//   - 相手の現場にいるAP8000以下のキャラを1枚まで選び、デッキの下に移す => sceneToDeck 短縮形
//     {player:'opp', max:1, filter:{apMax:8000, kind:'character'}, pos:'bottom'} [atomSceneToDeck: chooser=controller /
//     side 既定=a.player (BUG-120 規約)。「1枚まで」= 0枚可 → max:1。リムーブでない = 現場リムーブ時 不発動 (rules/09/23)]
//   - 自分のターン終了時 => trigger:{hook:'phase:end:start'} + condition turn:self [VERBATIM D03011.ts a1 / B08047.ts a1]
//   - スリープ状態かスタン状態のキャラが合わせて3枚以上 => {kind:'sceneHas', query:{area:'scene', side:'self',
//     filter:{kind:'character'}, state:['sleep','stun']}, nMin:3} [TargetQuery.state = candidates 状態 filter。
//     sleep+stun 合算 = state 配列 any-match]
//   - キャラを1枚まで選び、アクティブにする => sceneSetState 短縮形 {player:'self', side:'either', max:1, state:'active'}
//     [VERBATIM B01009.ts a2 (filter 無し)。側 指定なし「キャラ」= either (rules/15)。スタン→アクティブは
//     代わりにスリープ (mutate 済挙動、rules/03/24)]
//   - この能力はパートナーエリアでも発動する => scope:'on-partner-area' [scopeAllowsArea: PA OR 現場の両所在で発火
//     (triggered.ts:200)。MR① で PA に居ても発動する (rules/18)]
//   - 【カットイン】AP＋2000 => on-hand triggered effect:declared + charModifyAP $contact.byUid [VERBATIM D01011.ts a1 / B05066.ts a3]
//   - MR => rarity:'MR' (read/def.isMR が rarity を消費、MR能力①② は mr-partner-area-core 配線済 rules/18)
//   - カード名 複数 => names 分割 (rules/19 「＆」ルール) [VERBATIM B05066.ts names]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 〚このキャラか、このキャラと同じ特徴を持つキャラを1枚スリープさせる〛 (自分の現場のみ rules/21、self 含む)
  cost: {
    kind: 'sleepChar',
    target: {
      kind: 'pick',
      query: { area: 'scene', side: 'self', filter: { trait: ['怪盗', '探偵', '高校生'] } },
      n: { min: 1, max: 1 },
      chooser: 'self',
    },
  },
  // 相手の現場にいるAP8000以下のキャラを1枚まで選び、デッキの下に移す (0枚可)
  effect: {
    kind: 'atom',
    verb: 'sceneToDeck',
    args: { player: 'opp', max: 1, filter: { apMax: 8000, kind: 'character' }, pos: 'bottom' },
  },
  description:
    '【宣言】【ターン1】〚このキャラか、このキャラと同じ特徴を持つキャラを1枚スリープさせる〛：相手の現場にいるAP8000以下のキャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  // この能力はパートナーエリアでも発動する (現場 + PA 両所在、rules/18)
  scope: 'on-partner-area',
  // 自分のターン終了時
  trigger: { hook: 'phase:end:start' },
  // 自分の現場にスリープ状態かスタン状態のキャラが合わせて3枚以上いる場合
  condition: {
    kind: 'and',
    cs: [
      { kind: 'turn', player: 'self' },
      {
        kind: 'sceneHas',
        query: { area: 'scene', side: 'self', filter: { kind: 'character' }, state: ['sleep', 'stun'] },
        nMin: 3,
      },
    ],
  },
  // キャラを1枚まで選び、アクティブにする (スタンは代わりにスリープ rules/03/24、0枚可)
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: { player: 'self', side: 'either', max: 1, state: 'active' },
  },
  description:
    '自分のターン終了時、自分の現場にスリープ状態かスタン状態のキャラが合わせて3枚以上いる場合、キャラを1枚まで選び、アクティブにする。この能力はパートナーエリアでも発動する。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/18-mr.md', 'rules/24-qa-naming-stun.md'],
};

// 【カットイン】AP＋2000 — D01011 a1 / B05066 a3 同型
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B06066: CardDef = {
  id: 'B06066',
  no: '0687/B06066',
  kind: 'character',
  names: ['怪盗キッド＆白馬探', '怪盗キッド', '白馬探'], // rules/19 複数名カード
  colors: ['白'],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: ['怪盗', '探偵', '高校生'],
  keywords: [],
  rarity: 'MR', // rules/18 MR能力①② (read/def.isMR が rarity を消費)
  imageUrl: '1751538660425915.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
  ],
};
