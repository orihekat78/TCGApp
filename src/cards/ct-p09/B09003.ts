// cards/ct-p09/B09003 江戸川コナン (character) — CARD PHASE step12 batch2
// (declareName clone + continuous lvlDelta 負値 + enter observer、engine変更0)
// rules: rules/11-reasoning.md, rules/13-keywords.md, rules/15-abilities-effects.md,
//        rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md
//
// 公式テキスト:
//   【自分ターン中】現場にいるこのキャラをレベル－2する。
//   【事件青＆緑】【自分ターン中】【ターン1】このキャラ以外のレベル7以下の【青】か【緑】のキャラが
//   自分の現場に登場したとき、AP8000以下のキャラを1枚まで選び、リムーブする。
//   【絆服部平次】【宣言】【ターン1】〚デッキのカードを上から1枚リムーブする〛：カード名を1つ指定し、
//   相手のFILEエリアにあるカードを上から1枚リムーブし、相手はデッキのカードを上から1枚裏向きのまま
//   FILEエリアの上に置く。この効果によって指定したカード名のカードがリムーブされた場合、キャラを
//   1枚まで選び、ターン終了時までAP＋2000する。
//
// 句マッピング:
//   - a1「【自分ターン中】現場にいるこのキャラをレベル－2する」=> continuous +
//     condition{turn:self} + continuousModifier{lvlDelta:-2} (B08050 a1 同型・条件/符号差替。
//     ⚠ DEFERRED-INDEX L421「levelDelta 未出荷」は field 名違いの stale — lvlDelta 名で 2026-06-24
//     出荷済、read.char.level + matchOneFilter 2 site honor。公式Q&A「レベル6として扱う」=
//     level-read 参照時のみで一致。レベル下限なし rules/19)。
//   - a2 条件アイコン: 【事件青＆緑】=> caseColor{color:['青','緑'], combine:'and'} (B09023 a1 同型、
//     rules/17 §「&」=全色) / 【自分ターン中】=> turn{player:'self'} / 【ターン1】=> limit{turn,1}
//     (発動選択不可・解決できなくても発動済カウント rules/24)。
//   - a2「このキャラ以外のレベル7以下の【青】か【緑】のキャラが自分の現場に登場したとき」=>
//     trigger{hook:'enter', matcherCondition: triggerCharMatches{side:'self', excludeSource:true,
//     filter:{levelMax:7, color:['青','緑'], kind:'character'}}} (B02088 a1 同型。color 配列 =
//     any-match (candidates.ts wants.some) = 「【青】か【緑】」。効果/ネクストヒント登場でも
//     enter hook 発火 = rules/17【登場時】と同機序)。
//   - a2「AP8000以下のキャラを1枚まで選び、リムーブする」=> sceneRemove 短縮形 {max:1,
//     side:'either', cause:'effect', filter:{apMax:8000}} (B09070 a2 同型・filter 差替。
//     unscoped「キャラ」= side either rules/15、自身も選べる)。
//   - a3 条件/コスト: 【絆服部平次】=> bond{cardName:'服部平次'} (D09006 同型、現場のみ・
//     パートナー不可 rules/17。本カード自身は分割名を持たないが rules/19 分割名 (B09108 等) でも成立
//     = effectiveNameComponents 経由) / 〚デッキのカードを上から1枚リムーブする〛=>
//     cost removeDeckTop{n:1} (B03100 同型。1枚もリムーブできなければ宣言不可 rules/21)。
//   - a3 本文 = B09108 a2 と同 idiom (declareName → fileRemoveTop opp bind → fileAdd opp →
//     conditional boundNameMatchesDeclared)。then のみ差分:「キャラを1枚まで選び、ターン終了時まで
//     AP＋2000する」=> charModifyAP 短縮形 {delta:2000, max:1, side:'either', scope:'turn'}
//     (D08024 同型)。⚠ then 内は短縮形 pick のみ (pre-walk stable 扱いの制約、B09108 コメント参照)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: { lvlDelta: -2 },
  description: '【自分ターン中】現場にいるこのキャラをレベル－2する。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseColor', color: ['青', '緑'], combine: 'and' },
      { kind: 'turn', player: 'self' },
    ],
  },
  trigger: {
    hook: 'enter',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      excludeSource: true,
      filter: { levelMax: 7, color: ['青', '緑'], kind: 'character' },
    },
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } },
  },
  description:
    '【事件青＆緑】【自分ターン中】【ターン1】このキャラ以外のレベル7以下の【青】か【緑】のキャラが自分の現場に登場したとき、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  condition: { kind: 'bond', cardName: '服部平次' },
  cost: { kind: 'removeDeckTop', player: 'self', n: 1 },
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'declareName', args: { bind: 'named' } },
      { kind: 'atom', verb: 'fileRemoveTop', args: { player: 'opp', n: 1, bind: 'removed' } },
      { kind: 'atom', verb: 'fileAdd', args: { player: 'opp', n: 1 } },
      {
        kind: 'conditional',
        if: { kind: 'boundNameMatchesDeclared', bindKey: 'removed', declareKey: 'named' },
        then: {
          kind: 'atom',
          verb: 'charModifyAP',
          args: { delta: 2000, max: 1, side: 'either', scope: 'turn' },
        },
      },
    ],
  },
  description:
    '【絆服部平次】【宣言】【ターン1】〚デッキのカードを上から1枚リムーブする〛：カード名を1つ指定し、相手のFILEエリアにあるカードを上から1枚リムーブし、相手はデッキのカードを上から1枚裏向きのままFILEエリアの上に置く。この効果によって指定したカード名のカードがリムーブされた場合、キャラを1枚まで選び、ターン終了時までAP＋2000する。',
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};

export const B09003: CardDef = {
  id: 'B09003',
  no: '0948/B09003',
  kind: 'character',
  names: ['江戸川コナン'],
  colors: ['青'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '毛利探偵事務所', '少年探偵団'],
  rarity: 'SR',
  imageUrl: '1775608802564333.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
