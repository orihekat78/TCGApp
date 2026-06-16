// cards/ct-p09/B09026 伊織無我 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【絆大岡紅葉】【自分ターン中】AP＋2000\n【ターン1】相手の現場にいるキャラが自分の現場にいる〚カード名［伊織無我］〛とのコンタクトによってリムーブされたとき、自分のリムーブエリアにあるレベル6以下の〚カード名［大岡紅葉］〛を1枚まで選び、スリープ状態で登場させる。
// 句マッピング:
//   - 【絆大岡紅葉】【自分ターン中】AP＋2000 => a1: type 'continuous', scope 'on-scene', condition: and([bond{cardName:'大岡紅葉'}, turn{player:'self'}]), continuousModifier:{apDelta:2000} [VERBATIM twin = src/cards/ct-p06/B06040.ts a1 (【絆服部平次】【自分ターン中】AP＋1000 = continuous, condition and([bond,turn:self]), continuousModifier{apDelta:1000}). bond cond impl src/engine/cond/eval.ts L79-91 (scene scan, split-name via allCardNameComponentsForDef, partner excluded per rules/17). turn cond impl eval.ts L35-36 (state.turn.player===resolvePlayer). continuousModifier.apDelta is a SELF buff (no 「現場のキャラを」wording → bearer-only, NOT cluster13 aura). card-def.ts ContinuousModifier.apDelta honored by read.char.ap.]
//   - 【ターン1】相手の現場にいるキャラが…とのコンタクトによってリムーブされたとき (trigger) => a2: type 'triggered', scope 'on-scene', limit:{kind 'turn',n:1}, trigger {hook 'leave:to-remove'} (NO selfOnly), condition: removedCharMatches{side:'opp', cause:'contact-ap', by:{filter:{cardName:'伊織無我'}}} [removal-observer = cluster15 (2026-06-16) NOW GREEN. removedCharMatches impl src/engine/cond/eval.ts L329-358 (payload snapshot {uid,cause,side,byUid}; side owner-relative L334-337; cause filter L339; by:{filter} re-fetches byUid winner from owner scene + matchOneFilter L341-352). cluster15 design spec .claude/specs/engine-cluster15-contact-removal-observer-design.md §8 v2-A re-classifies B09026 as CONTACT-FILTER(cardName 伊織無我), excludeSource omitted. listener wiring src/engine/listeners/triggered.ts: leave:to-remove dispatcher L381-388 calls handleHook for in-play observers; handleHook L183-244 matches trig.hook, scopeAllowsArea('on-scene','scene'), no selfOnly gate, evaluates ability.condition with ctx.triggerPayload=payload & ctx.source={uid,player} of observer. limit{turn,n:1} via declaredUseCount (BUG-096). Split-name cardName:'伊織無我' matching B08019 大岡紅葉＆伊織無我 is PINNED in tests/engine/cond/removed-char-matches.test.ts ('by:{filter cardName} 分割名 pin'). NO filter on removed char itself (only side:'opp') → not the unsupported 'removed-char stat filter'. effect verb=sceneEnter (登場, NOT removal) → no cascade-DEFER concern even though limit present.]
//   - 自分のリムーブエリアにあるレベル6以下の〚カード名［大岡紅葉］〛を1枚まで選び、スリープ状態で登場させる (effect) => a2.effect: atom sceneEnter{player:'self', from:'remove', max:1, viaEffect:true, enterSleep:true, filter:{cardName:'大岡紅葉', levelMax:6, kind 'character'}} [VERBATIM shape twin = src/cards/ct-p02/B02038.ts a2 (リムーブのレベル4以下の【白】キャラを1枚までスリープ状態で登場 = sceneEnter{player:'self', from:'remove', max:1, viaEffect:true, enterSleep:true, filter:{color:'白', levelMax:4, kind 'character'}}); also src/cards/ct-d05/D05006.ts a1 same. Here filter swaps to cardName+levelMax. cardName filter honored on remove-area candidates: candidates.ts case 'remove' L160-167 builds {kind 'card',area:'remove'} cands; matchOneFilter L260-265 cardName (split-name via allCardNameComponentsForDef, rules/19), L294 kind, L335 levelMax (base.level for c===null printed-static). 'X枚まで'=max:1 → n.min:0 (0枚可, rules/15). 「登場させる」=必須 (not してもよい) → bare atom, no optional wrapper. enterSleep:true sets active:false (atom-handlers.ts L674/L809). effect target=[大岡紅葉] is DISTINCT from trigger remover-filter=[伊織無我] (no mix-up per brief warning). Pure JSON, no closure → needsManual:false. Player pick surface (1枚まで) → tier 2.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'bond',
        cardName: '大岡紅葉'
      },
      {
        kind: 'turn',
        player: 'self'
      }
    ]
  },
  continuousModifier: {
    apDelta: 2000
  },
  description: '【絆大岡紅葉】【自分ターン中】AP＋2000',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'leave:to-remove'
  },
  condition: {
    kind: 'removedCharMatches',
    side: 'opp',
    cause: 'contact-ap',
    by: {
      filter: {
        cardName: '伊織無我'
      }
    }
  },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      enterSleep: true,
      filter: {
        cardName: '大岡紅葉',
        levelMax: 6,
        kind: 'character'
      }
    }
  },
  description: '【ターン1】相手の現場にいるキャラが自分の現場にいる〚カード名［伊織無我］〛とのコンタクトによってリムーブされたとき、自分のリムーブエリアにあるレベル6以下の〚カード名［大岡紅葉］〛を1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B09026: CardDef = {
  id: 'B09026',
  no: '0970/B09026',
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
  rarity: 'C',
  imageUrl: '1775608835768948.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/24-qa-naming-stun.md'
  ],
};
