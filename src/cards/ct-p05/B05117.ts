// cards/ct-p05/B05117 コンコン (event) — DEFER 解禁: on-set-host rider leave:to-remove walk (2026-07-11, engine変更0)
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 18-mr.md, 20-color-and-switch.md
//
// 公式テキスト (印字 ground truth, .tmp/_ground/B05117.md):
//   このイベントを自分の現場にいる【黒】のキャラ1枚にセットする。
//   このイベントがセットされているキャラは「【相手ターン中】このキャラが現場から離れたとき、
//     自分の現場にキャラが1枚もいない場合、キャラを1枚まで選び、リムーブし、自分のリムーブエリアにある
//     【カットイン】を持つレベル6以下のキャラを2枚まで選び、登場させる。」を持つ。
// 公式Q&A (要点):
//   - リムーブされたキャラ (このイベントをセットしていた host) 自身も、条件を満たせば登場対象に選べる。
//   - 2枚セットされていれば付与能力を2つ持つ。ただし1つ目で登場させると2つ目は「現場0枚」条件を満たさない。
//   - 「現場0枚」条件は **効果解決時** に参照する (相手《ジン》等で全リムーブされた場合も解決時0枚なら成立)。
//   - 現場にキャラ0枚でも使用可 (セット不能なら解決後リムーブエリアへ。セット可能なキャラがいれば必ずセット)。
//   - 能力/効果による登場でも登場したキャラの【登場時】能力は発動する。
//
// 句マッピング:
//   - a1 = 「このイベントを自分の現場にいる【黒】のキャラ1枚にセットする」
//       => effect:declared (event-use) trigger → charSetCard{fromSelf:true, n:1, filter:{kind:'character', color:'黒'}}
//          (B01057 a1 同型 + 【黒】filter。fromSelf = 使用イベント自身を remove から faceUp セット。
//           現場0枚でセット不能なら atom no-op → イベントは解決後リムーブへ = Q&A と整合。)
//   - a2 = rider (scope:'on-set-host'): host が持つ付与能力
//       * 【相手ターン中】 => ability.condition turn:opp (rules/17。trigger 時 gate。host 所有者相対)
//       * このキャラが現場から離れたとき => trigger leave:to-remove selfOnly
//           (【現場リムーブ時】= host のリムーブ。M2後半 handleLeaveToRemoveSelf が faceUp setCards の
//            on-set-host + leave:to-remove rider を removedChar snapshot 経由で walk。exemplar B01057 a2。)
//       * 自分の現場にキャラが1枚もいない場合 => effect conditional{if: not sceneHas{side:'self', kind:'character'}}
//           (「〜場合」= effect 内 conditional で **解決時評価** rules/15/25。Q&A「解決時0枚参照」と整合。
//            not sceneHas = stable (pre-walk 過剰 surface 回避、resolve-picks.ts conditionIfIsStable)。)
//       * キャラを1枚まで選び、リムーブし => sequence step0 sceneRemove{max:1, side:'either', cause:'effect', kind:'character'}
//           (エリア指定なしの「キャラ」= どちらの現場でも選べる rules/15 → side:'either'。「1枚まで」= 0枚可。
//            現場0枚 gate 済ゆえ実質相手キャラ候補。exemplar D07004/D07014 sceneRemove pick 短縮形。)
//       * 自分のリムーブエリアにある【カットイン】を持つレベル6以下のキャラを2枚まで選び、登場させる
//           => sequence step1 sceneEnter{from:'remove', max:2, viaEffect:true, filter:{kind:'character', keyword:'カットイン', levelMax:6}}
//           (from:'remove' = 自分のリムーブエリア。「2枚まで」= 0〜2枚 max:2。keyword:'カットイン' は
//            defHasKeyword がアイコン能力も吸収 candidates.ts:458 (BUG-122)。levelMax:6。効果登場 = 色制限なし rules/20。
//            remove 済 host も同 pool の候補 = Q&A①。exemplar B05112 (from:hand + keyword カットイン + levelMax)。)
//        remove→enter は独立 (「そうした場合」gating なし) → sequence (chain ではない)。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: このイベントを自分の現場にいる【黒】のキャラ1枚にセットする (fromSelf = 使用イベント自身を表向きセット)
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { player: 'self', fromSelf: true, n: 1, filter: { kind: 'character', color: '黒' } },
  },
  description: 'このイベントを自分の現場にいる【黒】のキャラ1枚にセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

// a2 (rider): このイベントがセットされているキャラが持つ付与能力。
//   「【相手ターン中】このキャラが現場から離れたとき、自分の現場にキャラが1枚もいない場合、
//    キャラを1枚まで選び、リムーブし、自分のリムーブエリアにある【カットイン】を持つレベル6以下のキャラを
//    2枚まで選び、登場させる。」
const a2: AbilityDef = {
  id: 'b05117_set_t1', // rider ability.id は card-unique に
  type: 'triggered',
  scope: 'on-set-host',
  trigger: { hook: 'leave:to-remove', selfOnly: true }, // このキャラ (host) が現場から離れた (リムーブ) とき
  condition: { kind: 'turn', player: 'opp' }, // 【相手ターン中】
  effect: {
    // 自分の現場にキャラが1枚もいない場合 (解決時評価 rules/15/25、Q&A)
    kind: 'conditional',
    if: {
      kind: 'not',
      c: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { kind: 'character' } } },
    },
    then: {
      kind: 'sequence',
      steps: [
        // キャラを1枚まで選び、リムーブし (どちらの現場でも rules/15、0枚可)
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { kind: 'character' } },
        },
        // 自分のリムーブエリアにある【カットイン】を持つレベル6以下のキャラを2枚まで選び、登場させる
        //   N>1 = multi-card 契約 (cardIds:'$pick.cardIds' + target pick n{0,2})。短縮形 max:2 は 1 に collapse
        //   するため使用不可 (DSL 罠、reference-miniwave-loop-and-pick-dsl-rules)。exemplar B09010 a1。
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            from: 'remove',
            cardIds: '$pick.cardIds',
            viaEffect: true, // 効果による登場 = 色制限を受けない (rules/20)
            target: {
              kind: 'pick',
              query: { area: 'remove', side: 'self', filter: { kind: 'character', keyword: 'カットイン', levelMax: 6 } },
              n: { min: 0, max: 2 }, // 「2枚まで」= 0〜2枚 (rules/15)
              chooser: 'self',
            },
          },
        },
      ],
    },
  },
  description:
    'このイベントがセットされているキャラは「【相手ターン中】このキャラが現場から離れたとき、自分の現場にキャラが1枚もいない場合、キャラを1枚まで選び、リムーブし、自分のリムーブエリアにある【カットイン】を持つレベル6以下のキャラを2枚まで選び、登場させる。」を持つ。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};

export const B05117: CardDef = {
  id: 'B05117',
  no: '0613/B05117',
  kind: 'event',
  names: ['コンコン'],
  colors: ['黒'],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1746628078759577.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
