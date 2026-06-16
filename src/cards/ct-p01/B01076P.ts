// cards/ct-p01/B01076P 「開けるんだキャメル…」 (event) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/03-field-areas.md
// 公式テキスト:
//   自分のリムーブエリアにあるレベル6以下の【赤】のキャラを1枚まで選び、登場させる。
// 句マッピング:
//   - (イベント自己使用トリガ) このイベントを手札の使用/ネクストヒントで使用したとき効果本文が発動する => type 'triggered' scope 'on-hand' trigger {hook 'effect:declared', selfOnly:true, __eventUse:true} [EXACT twin src/cards/ct-p02/B02053.ts a1 と src/cards/ct-d09/D09025.ts a1 (どちらもイベント=リムーブ蘇生型)。__eventUse:true は codegen flag で scripts/taskA-codegen.cjs L112-121 が trigger.__eventUse を削除し matcher:'__EVENT_USE_MATCHER__' = (p)=>p?.kind==='event-use' に置換 → 純JSON維持 (needsManual:false)。emit 元 src/engine/flow/main/hand-use-card.ts L137 emitKind = d?.kind==='event' ? 'event-use' : 'character-use' → effect:declared emit (L140)、ネクストヒントも src/engine/flow/main/next-hint.ts L102 で同 emit。selfOnly+matcher の gate は src/engine/listeners/triggered.ts L211 (selfOnlyMatches: on-hand は payload.cardId 一致) + L213 (trig.matcher(payload))。]
//   - 自分のリムーブエリアにある…キャラを1枚まで選び、登場させる => atom sceneEnter {player:'self', from:'remove', max:1, viaEffect:true, filter:{...}} [EXACT structural twin src/cards/ct-p02/B02053.ts a1 (player:'self', from:'remove', max:1, viaEffect:true, filter{color,trait,levelMax,kind 'character'})。単一 from:'remove' 短縮形 path: src/engine/effect/atom-handlers.ts sceneEnter handler L740-748 (cardId undefined + from string + hasNorMax → buildShortFormPick(a.from,a,...) → cardId='$pick.cardId'+target → tryRePickFromAtom await pick)。解決後 source-area splice L785-790 (sourceArea==='remove' → remove[idx] splice、複製登場防止)。mutate.scene.enter (L815) named=true default = 名乗り状態 (rules/06 効果登場)。enter hook emit → 蘇生キャラの【登場時】発火 (正)。]
//   - を1枚まで選び (量指定子) => max:1 → buildShortFormPick で n:{min:0,max:1} (0枚選択=合法な辞退) [src/engine/effect/atom-pick-spec.ts buildShortFormPick L77-84: max あり → nMin=0, nMax=1 → n:{min:0,max:1}。rules/15 「〜枚まで」=0枚可 (brief 量指定子規約)。0枚解決時は sceneEnter が silent no-op (handAddFromRemove 同型)。]
//   - レベル6以下 => filter.levelMax: 6 [src/engine/target/candidates.ts matchOneFilter L321: filter.levelMax !== undefined && level > filter.levelMax → reject。remove-area cand は c===null なので level=base?.level (CardDef static)。buildShortFormPick L80 が filter を query.filter に pass-through、candidates.ts L160-167 case 'remove' が各 remove cardId を matchesFiltersByCardId に通す。]
//   - 【赤】の => filter.color: '赤' [src/engine/target/candidates.ts matchOneFilter L274-278: filter.color → d?.colors.includes(want)、不一致 reject。remove-area cand path で評価 (B02053 が同経路で color:'白' を使用)。]
//   - キャラ => filter.kind  'character' [src/engine/target/candidates.ts matchOneFilter L291: filter.kind !== undefined && d?.kind !== filter.kind → reject (BUG-118 で remove/deck 候補列挙経路も kind 評価済)。リムーブからキャラ pick は kind 'character' 必須 (BUG-123, brief 規約)。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'
  },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      filter: {
        color: '赤',
        levelMax: 6,
        kind: 'character'
      }
    }
  },
  description: '自分のリムーブエリアにあるレベル6以下の【赤】のキャラを1枚まで選び、登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ]
};

export const B01076P: CardDef = {
  id: 'B01076P',
  no: '0066/B01076P',
  kind: 'event',
  names: [
    '「開けるんだキャメル…」'
  ],
  colors: [
    '赤'
  ],
  level: 6,
  traits: [],
  rarity: 'CP',
  imageUrl: '1714013053541431.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ],
};
