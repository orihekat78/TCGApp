// cards/ct-p02/B02041 怪盗キッド (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/09-cutin-disguise.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/23-qa-disguise-cutin.md
// 公式テキスト:
//   【パートナー白】【登場時】【変装時】キャラを1枚まで選び、スリープさせる。
//   【変装】【事件白】【FILE6】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）
// 句マッピング:
//   - 【パートナー白】（登場時/変装時 共通の条件アイコン） => ability.condition { kind 'partnerColor', color:'白' } on both a1(enter) and a2(disguise:into) [src/cards/ct-p02/B02040.ts a1 = 同名構造『【パートナー白】【登場時】…』を triggered enter selfOnly + condition:{kind 'partnerColor',color:'白'} で実装済。src/engine/cond/eval.ts:37 case 'partnerColor' = owner partner CardDef.colors と color の交差判定 (cap-map cond line 142)。src/engine/listeners/triggered.ts:230-244 が ability.condition を evalCond し未達なら queue しない (BUG-033) ので enter/disguise:into 両 hook で条件ゲートが効く。]
//   - 【登場時】 => a1 trigger { hook 'enter', selfOnly:true } [src/cards/ct-p02/B02040.ts a1 / ct-p01/B01052.ts a2 = 【登場時】= triggered enter+selfOnly。triggered.ts TRIGGERED_HOOKS に 'enter' 登録 (line 57)。enter は handUseCard/next-hint/sceneEnter 全登場経路で発火 (cap-map hooks)。selfOnly=source.uid 一致 (triggered.ts:210-211, 158 selfOnlyMatches)。]
//   - 【変装時】（登場時と同一効果） => a2 trigger { hook 'disguise:into', selfOnly:true } — a1 と同一 sceneSetState 効果 [src/cards/ct-p02/B02045.ts a2 / B02044.ts a2 = 【変装時】= triggered disguise:into+selfOnly。flow/contact.ts:198-209 disguise() が 'disguise:into' を emit (payload {uid,fromCardId,newCardId}, uid 維持)。rules/09: 変装は『登場』ではないため enter hook は発火せず disguise:into のみ → 登場時/変装時 が二重発火しない。同一効果のため 2 ability に複製 (B02044 が同方針)。]
//   - キャラを1枚まで選び、スリープさせる => atom sceneSetState { player:'self', max:1, side:'either', state:'sleep' } (短縮形 scene pick, n.min:0 / n.max:1) [src/cards/ct-p04/B04014.ts (sceneSetState{player:'self',state:'sleep',max:2,side:'either'} filter無) と ct-p09/B09013.ts a1 (sceneSetState{player:'self',max:1,side:'either',state:'sleep',filter:{lpMin:1}}) の filter を除いた形。B02041 は対象 filter 無し (任意キャラ・両側)。atom-handlers.ts:965-969 case 'sceneSetState': uid 不在 + player string + state string + hasNorMax → paShortFormAwait が side='either' の scene pick を構築 (a.side で上書き可)。n.min:0 ⇒『1枚まで』(0枚 decline 可, rules/15)。明示 pick 形は src/cards/ct-p03/B03079.ts a2 (uid:'$pick'+target n{0,1}) と同義。]
//   - 【変装】（変装能力本体） => a3 type 'icon-disguise' [src/cards/ct-p02/B02045.ts a1 (同名 怪盗キッド・henso【変装】【事件白】【FILE】) と B02044.ts a3 が直接の型。src/engine/flow/contact.ts:46 disguiseAbility() が type==='icon-disguise' ability を探し、canDisguise (lines 147-162) がその condition を変装可否ゲートとして evalCond で評価。]
//   - 【事件白】【FILE6】（変装ゲート条件） => a3.condition and[ caseColor 白, fileAtLeast 6 ] [src/cards/ct-p02/B02045.ts a1 の condition (caseColor 白 + fileAtLeast 4) と同型、FILE しきい値を 6 に変更。src/engine/cond/eval.ts:45 caseColor (owner 事件色 membership) / :70 fileAtLeast (file.length>=n, assisted-partner も file 配列に含むので算入, cap-map cond line 147)。canDisguise が ability.condition を評価し未達なら変装不可 (rules/17 §条件アイコン)。]

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
    kind: 'partnerColor',
    color: '白'
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      state: 'sleep'
    }
  },
  description: '【パートナー白】【登場時】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'disguise:into',
    selfOnly: true
  },
  condition: {
    kind: 'partnerColor',
    color: '白'
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      state: 'sleep'
    }
  },
  description: '【パートナー白】【変装時】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'icon-disguise',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'caseColor',
        color: '白'
      },
      {
        kind: 'fileAtLeast',
        n: 6
      }
    ]
  },
  description: '【変装】【事件白】【FILE6】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/17-icons.md'
  ]
};

export const B02041: CardDef = {
  id: 'B02041',
  no: '0208/B02041',
  kind: 'character',
  names: [
    '怪盗キッド'
  ],
  colors: [
    '白'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '怪盗'
  ],
  rarity: 'R',
  imageUrl: '1721357230961900.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/23-qa-disguise-cutin.md'
  ],
};
