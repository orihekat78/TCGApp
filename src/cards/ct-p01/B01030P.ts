// cards/ct-p01/B01030P 大岡紅葉 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【ターン1】相手の現場にいるキャラがコンタクトによってリムーブされたとき、自分のリムーブエリアにある【カットイン】を持つ【緑】のカードを1枚まで選び、手札に加える。
// 句マッピング:
//   - 【ターン1】 (発動回数制限) => ability.limit = { kind 'turn', n:1 } [src/cards/ct-p01/B01036.ts a1 が triggered ability に limit:{kind 'turn',n:1} を使用 (line 30)。types card-def.ts:120 limit?:AbilityLimit が【ターン①】用フィールド。0枚選択でも発火時に消費され同ターン再発動不可 (B01036 comment line 22, rules/24)。]
//   - 相手の現場にいるキャラが…リムーブされたとき (removal-observer trigger) => trigger { hook 'leave:to-remove' } (selfOnly を付けない) [certify-brief §反撃カード一族 = leave:to-remove を selfOnly 無しで使う in-play observer。src/engine/listeners/triggered.ts:69 で leave:to-remove は在場カード反応として handleHook 経由で処理 (selfOnly 無しなら line 211 で selfOnly check skip → 全 in-play scan)。emit は src/engine/mutate/scene.ts:166-170 removeToRemove が payload {uid,cause,side,byUid} で発火。除去キャラ自身の【現場リムーブ時】(B02025 a1=selfOnly:true) とは別経路で衝突しない。]
//   - 相手の現場にいるキャラが (side 限定) => condition.side:'opp' [src/engine/cond/eval.ts:329-357 removedCharMatches。pl.side=除去キャラ所属 (scene.ts:170 side:player)。sameSide=pl.side===ctx.source.player; side:'opp' は sameSide のとき false → owner 相対で相手側除去のみ通す (eval.ts:336-338)。certify-brief variant 表で B01030=CONTACT-BARE=side:'opp'。]
//   - コンタクトによって (除去原因限定、攻撃者無指定) => condition.cause:'contact-ap' (by 省略) [src/engine/flow/contact.ts:264 judge が removeToRemove(state, bUid, 'contact-ap', aUid) を呼ぶ = コンタクト被除去は cause:'contact-ap'。eval.ts:340 cond.cause!==undefined && pl.cause!==cond.cause → false でゲート。by 省略 = 攻撃者無条件 (eval.ts:342 cond.by===undefined を素通り)。certify-brief CONTACT-BARE = {side:'opp',cause:'contact-ap'} (by 省略)。design spec §8 v2-A で B01030 を CONTACT-BARE と確定。]
//   - 自分のリムーブエリアにある…カードを…手札に加える => atom verb 'handAddFromRemove' args.player:'self' [src/cards/ct-p02/B02025.ts a1 が verb 'handAddFromRemove' args:{player:'self',max:1,filter:{keyword:'カットイン',color:'緑'}} を使用 (本カード effect と完全同型)。capability-map line 30: handAddFromRemove は remove→hand splice、short-form (defaultArea=remove)。B09034.ts a2 も同 verb short-form。]
//   - 【カットイン】を持つ…カード (icon keyword filter) => filter.keyword:'カットイン' [src/cards/ct-p02/B02025.ts (filter.keyword:'カットイン')、src/cards/ct-p03/B03128.ts:40 filter:{keyword:'カットイン',color:'黒'} が live exemplar。matchOneFilter (candidates.ts:280-285) が filter.keyword を defHasKeyword 経由で評価し【カットイン】icon ability を吸収 (BUG-122)。capability-map TargetFilter keyword フィールド = 任意 keyword 文字列 OK (icon も)。'カード' (キャラではない) のため kind 制限なし (B02025 同テキスト=kind 省略)。]
//   - 【緑】の…カード (color filter) => filter.color:'緑' [src/cards/ct-p02/B02025.ts filter.color:'緑' (同テキスト同型)。matchOneFilter (candidates.ts:274-277) が def.colors に filter.color を含むか判定。標準 CardDef フィールド。]
//   - 1枚まで選び (量指定子 + 選択 surface) => args.max:1 (short-form → n.min:0,n.max:1 = 0枚可) [certify-brief 量指定子: 「〜枚まで」=n.min:0 (0枚可, rules/15)。B02025.ts a1 が max:1 short-form で「1枚まで」を表現 (buildShortFormPick が n.min:0/n.max:1)。human owner には pick surface、0枚 decline 可 = tier 2。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
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
    cause: 'contact-ap'
  },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        keyword: 'カットイン',
        color: '緑'
      }
    }
  },
  description: '【ターン1】相手の現場にいるキャラがコンタクトによってリムーブされたとき、自分のリムーブエリアにある【カットイン】を持つ【緑】のカードを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B01030P: CardDef = {
  id: 'B01030P',
  no: '0024/B01030P',
  kind: 'character',
  names: [
    '大岡紅葉'
  ],
  colors: [
    '緑'
  ],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: [
    '高校生'
  ],
  rarity: 'RP',
  imageUrl: '1714013000993481.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md'
  ],
};
