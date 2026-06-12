// cards/ct-p07/B07090P 「えええええ!?」 (イベント・パラレル) — Task D batch (2026-06-12)
// rules: 07-action-flow.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト (B07090 と同一):
//   自分のリムーブエリアにあるレベル5以下の〚特徴［警視庁］〛のキャラを1枚まで選び、登場させる。
//   〚特徴［警視庁］〛のキャラを1枚まで選び、ターン終了時までAP＋1000し、
//     「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング: B07090.ts と同一 (a1: sceneEnter from remove → charModifyAP 短縮形 carrier bind →
//   charSetTurnEffect actionTargetsActive / a2: ヒラメキ draw1)。P 版差分は rarity / imageUrl / no のみ。
//   ⚠ step2 は短縮形必須 (明示 $pick+target は human 経路で bind 喪失 — B07090.ts 参照)。

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

export const B07090P: CardDef = {
  id: 'B07090P',
  no: '0818/B07090P',
  kind: 'event',
  names: ['「えええええ!?」'],
  colors: ['黄'],
  level: 7,
  traits: [],
  rarity: 'CP',
  imageUrl: '1763546825858229.jpg',
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
