// cards/ct-p06/B06079 アンドレ・キャメル (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/13-keywords.md, rules/05-turn-phases.md
// 公式テキスト:
//   【登場時】自分の能力や効果によって登場した場合、ターン終了時までこのキャラをAP＋1000し、〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
// 句マッピング:
//   - 【登場時】 => trigger {hook 'enter', selfOnly:true}, type 'triggered', scope 'on-scene' [exemplar B01014/B01021 a1 (ct-p01): 【登場時】=trigger{hook 'enter',selfOnly:true}. rules/17 §【登場時】: 能力/効果による登場でも発動 (selfOnly matches the entering char itself).]
//   - 自分の能力や効果によって登場した場合 => condition {kind 'enterSource', viaEffect:true} (no sourceFilter) [cond enterSource (src/engine/cond/eval.ts:418-428): viaEffect:true gates effect-driven entries; sourceFilter is OPTIONAL (line 421 `if(cond.sourceFilter)`), so omitting it matches ANY effect/ability entry with no kind/level/color qualifier — exactly '能力や効果によって' with no further constraint. Exemplar B01014/B01021 use enterSource{viaEffect:true,...} but add sourceFilter only because their text qualifies 'レベル3以上のキャラ/イベント'; this card has no such qualifier so sourceFilter is dropped (BUG-146 emit統一: viaEffect:false = 手札使用/ネクストヒント, correctly excluded).]
//   - ターン終了時までこのキャラをAP＋1000し => sequence step1: atom charModifyAP {uid:'$self', delta:1000, scope 'turn'} [EXACT green-certified precedent: PR276 a2 / D02004 a1 map the identical phrase 'アクション終了時までこのキャラをAP＋1000する' & 'ターン終了時まで…AP+1000' to charModifyAP{uid:'$self',delta:1000,scope 'turn'}. Handler char.ts:24-31 confirms args {uid,delta,scope} → mutate.char.modifyAP; scope 'turn' = expires at turn end (rules/05 エンドフェイズ §効果切れ). $self carrier short-form (BUG-130).]
//   - 〚突撃〛（登場したターンからすぐにアクションできる）を持つ => sequence step2: atom charGrantKeyword {uid:'$self', kw:'突撃', scope 'turn'} [exemplar B06007 a1 (ct-p06): charGrantKeyword{uid:'$self',kw:'突撃',scope 'turn'} for granting 突撃 until turn-end. Handler char.ts:108-119 confirms args {uid,kw,scope}→mutate.char.grantKeyword. Single 'ターン終了時まで' in the text scopes BOTH effects (AP+1000 し、突撃を持つ), so scope 'turn' on both atoms. 突撃 is GRANTED (not innate) → keywords:[] at metadata level. rules/13 §突撃: 名乗り状態でもアクション可.]
//   - AP＋1000し、突撃を持つ (連結・both mandatory) => effect {kind 'sequence', steps:[charModifyAP, charGrantKeyword]} ['〜し、〜を持つ' = both effects必須 (rules/15 §「〜する」=必ず行う). No '〜してもよい'/'〜まで' quantifier present, so neither optional nor choice — a plain sequence (exemplar PR276 a2 uses sequence for two co-applied atoms).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  condition: {
    kind: 'enterSource',
    viaEffect: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: {
          uid: '$self',
          delta: 1000,
          scope: 'turn'
        }
      },
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$self',
          kw: '突撃',
          scope: 'turn'
        }
      }
    ]
  },
  description: '【登場時】自分の能力や効果によって登場した場合、ターン終了時までこのキャラをAP+1000し、突撃を持つ。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/13-keywords.md'
  ]
};

export const B06079: CardDef = {
  id: 'B06079',
  no: '0699/B06079',
  kind: 'character',
  names: [
    'アンドレ・キャメル'
  ],
  colors: [
    '赤'
  ],
  level: 6,
  ap: 5000,
  lp: 0,
  traits: [
    'FBI'
  ],
  rarity: 'C',
  imageUrl: '1754285244562276.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/13-keywords.md',
    'rules/05-turn-phases.md'
  ],
};
