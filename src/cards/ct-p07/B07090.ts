// cards/ct-p07/B07090 「えええええ!?」 (イベント) — Task D batch (2026-06-12)
// rules: 07-action-flow.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   自分のリムーブエリアにあるレベル5以下の〚特徴［警視庁］〛のキャラを1枚まで選び、登場させる。
//   〚特徴［警視庁］〛のキャラを1枚まで選び、ターン終了時までAP＋1000し、
//     「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング:
//   a1: イベント使用 (effect:declared selfOnly + event-use matcher、B02053 同型) → sequence
//     step1: 「自分のリムーブエリアにあるレベル5以下の[警視庁]のキャラを1枚まで選び、登場させる」=
//            sceneEnter from:'remove' 短縮形 (max:1 = 0枚可、viaEffect 登場は色制限なし rules/20。
//            効果登場でも【登場時】発動・名乗り状態で登場 — 公式Q&A)
//     step2: 「[警視庁]のキャラを1枚まで選び、ターン終了時までAP＋1000し」= charModifyAP 短縮形
//            (uid/target 非明示) + bind:'$picked' (E0 pick-share)。側指定なし = side:'either' (rules/15)。
//            ⚠ 明示 uid:'$pick'+target 形は使用禁止: human 経路では初期 walk で pick が push され
//            (1) 候補が step1 登場前の盤面で列挙され登場キャラを選べない、(2) 後続 step が bind
//            未解決で no-op する (2026-06-12 敵対レビュー vitest 実証)。短縮形は runtime push →
//            sequence continuation が ctx を共有し、候補も登場後の盤面で列挙される (Q&A 整合)。
//     step3: 「『このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。』を与える」=
//            charSetTurnEffect{uid:'$picked.uid', key:'actionTargetsActive'} (同一 pick 対象。
//            clearTurnEffects('turn') で清掃 = 公式Q&A「ターン終了時にすべて切れる」。
//            名乗りは解除しない = 登場ターンにアクションするには突撃/迅速が別途必要 — 公式Q&A)
//     ⚠ 既知 engine-wide 制約: step1 の pick を明示 skip すると continuation drop で step2/3 も
//       失われる (Q&A「登場させず AP+1000 のみ」が human で不可 — BUG 起票対象)。候補 0 件時は
//       push されず step2 へ正常に進む。
//   a2: 【ヒラメキ】カードを1枚引く — B02061 a2 同型 (evidence:remove-by-action optional)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分のリムーブエリアにあるレベル5以下の[警視庁]のキャラを1枚まで選び、登場させる
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', max: 1, viaEffect: true, filter: { trait: '警視庁', levelMax: 5, kind: 'character' } } },
      // [警視庁]のキャラを1枚まで選び、ターン終了時までAP＋1000し (短縮形 carrier + bind:'$picked' で次 step と共有)
      { kind: 'atom', verb: 'charModifyAP', args: { max: 1, side: 'either', filter: { trait: '警視庁' }, delta: 1000, scope: 'turn', bind: '$picked' } },
      // 「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える (ターン終了時まで)
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$picked.uid', key: 'actionTargetsActive', val: true } },
    ],
  },
  description: '自分のリムーブエリアにあるレベル5以下の〚特徴［警視庁］〛のキャラを1枚まで選び、登場させる。〚特徴［警視庁］〛のキャラを1枚まで選び、ターン終了時までAP＋1000し、「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B07090: CardDef = {
  id: 'B07090',
  no: '0818/B07090',
  kind: 'event',
  names: ['「えええええ!?」'],
  colors: ['黄'],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1762414027483318.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
