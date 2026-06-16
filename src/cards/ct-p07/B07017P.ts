// cards/ct-p07/B07017P 伊織無我 (character) — Task A green候補 (engine変更0)
// rules: rules/08-contact.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/22-qa-action-contact.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）\n【絆大岡紅葉】AP＋1000\n相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、自分のリムーブエリアにあるレベル6以上の【緑】のイベントを1枚まで選び、手札に加える。
// 句マッピング:
//   - 〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる） => CardDef.keywords: ['突撃[キャラ]'] (innate printed keyword, not granted) [Exemplar src/cards/ct-p09/B09037.ts (工藤優作) has innate keywords:['突撃[キャラ]'] for an unconditional 〚突撃［キャラ］〛 clause (also ct-p08/B08032.ts). Engine src/engine/flow/main/action.ts L54-56 honors the naming-state exception: targetKind==='char' && kws.includes('突撃[キャラ]') => allowed. Bracketed string read directly from keywords[]. Parenthetical is gloss only.]
//   - 【絆大岡紅葉】AP＋1000 => type 'continuous' ability, condition {kind 'bond', cardName:'大岡紅葉'}, continuousModifier {apDelta:1000} [Near-identical exemplar src/cards/ct-p09/B09037.ts a2 (【絆黒羽盗一】【自分ターン中】AP＋1000 => continuous + and[bond,turn] + continuousModifier{apDelta:1000}); B07017 lacks 【自分ターン中】 so condition is bond-only. bond shape confirmed src/cards/ct-p02/B02032.ts ({kind 'bond', cardName}) and cap-map L152 (owner SCENE name-components intersect, split-names via allCardNameComponentsForDef). Engine src/engine/read/char.ts continuousDelta (L18-46) reads continuousModifier.apDelta for bearer own AP and re-evaluates ability.condition each read (L36) => continuous/常時有効 semantics rules/24.]
//   - 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、自分のリムーブエリアにあるレベル6以上の【緑】のイベントを1枚まで選び、手札に加える。 => type 'triggered' on-scene, trigger{hook 'leave:to-remove'} (no selfOnly = removal-observer), condition removedCharMatches{side:'opp',cause:'contact-ap',by:'self'}, effect handAddFromRemove{player:'self',max:1,filter:{levelMin:6,color:'緑',kind 'event'}} [Removal-observer family (brief §反撃, cluster15). Variant 「このキャラとのコンタクトによって」 => {side:'opp',cause:'contact-ap',by:'self'} per brief. Engine src/engine/cond/eval.ts L329-357 implements removedCharMatches: side compares payload.side vs owner, cause exact-match, by:'self' checks byUid===ctx.source.uid. byUid populated by src/engine/mutate/scene.ts L164-171 emit ({uid,cause,side,byUid}) + src/engine/flow/contact.ts L262-264 removeToRemove(state,bUid,'contact-ap',aUid) where aUid=winner=this attacker. Type spec src/engine/types/effect.ts L71. Listener src/engine/listeners/triggered.ts: leave:to-remove in TRIGGER_HOOKS (L69), non-selfOnly in-play scan, sets triggerPayload (L226/L242) and evaluates ability.condition (L232-244). Effect verb+filter exemplar src/cards/ct-p07/B07042.ts (handAddFromRemove via leave:to-remove, max:1, filter). Remove-area filter color+kind event exemplar B04009 referenced in src/engine/target/candidates.ts L289-291 (kind), L274-277 (color), L320 (levelMin) — all honored for area:'remove' card candidates (printed stats). '1枚まで'=>max:1 (n.min:0 skippable, rules/15).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'bond',
    cardName: '大岡紅葉'
  },
  continuousModifier: {
    apDelta: 1000
  },
  description: '【絆大岡紅葉】AP＋1000',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove'
  },
  condition: {
    kind: 'removedCharMatches',
    side: 'opp',
    cause: 'contact-ap',
    by: 'self'
  },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        levelMin: 6,
        color: '緑',
        kind: 'event'
      }
    }
  },
  description: '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、自分のリムーブエリアにあるレベル6以上の【緑】のイベントを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B07017P: CardDef = {
  id: 'B07017P',
  no: '0749/B07017P',
  kind: 'character',
  names: [
    '伊織無我'
  ],
  colors: [
    '緑'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '執事'
  ],
  rarity: 'RP',
  imageUrl: '1763546798317557.jpg',
  keywords: [
    '突撃[キャラ]'
  ],
  abilities: [a1, a2],
  ruleRefs: [
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md'
  ],
};
