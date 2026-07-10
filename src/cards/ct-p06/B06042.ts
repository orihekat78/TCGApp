// cards/ct-p06/B06042 ここで会うたが百年目 (イベント) — charGrantAbility declared 解禁 exemplar (2026-07-11 Wave C)
// rules: 07-action-flow.md, 08-contact.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md,
//        21-declared-ability-cost.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   自分の現場にいるキャラを1枚まで選び、ターン終了時までAP＋1000し、「【宣言】【ターン1】相手の現場にいる
//   キャラを1枚まで選び、このキャラとのコンタクトを発生させる。（このキャラがアクションした側のキャラになる）」
//   を与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング:
//   a1 = イベント使用 (effect:declared / kind:'event-use'、B06033 a1 同型)。
//        「自分の現場にいるキャラを1枚まで選び、AP＋1000し」= charModifyAP 短縮形 pick
//        {max:1, side:'self', delta:1000, scope:'turn', bind:'$p'} (B07063 a2 同型: pick を carrier に bind)。
//        「…を与える」= charGrantAbility{uid:'$p.uid', scope:'turn', ability:<declared 付与>} —
//        本 wave で解禁した spec.type:'declared' honor (gap①) + findDeclaredAbility grantedAbilities 走査 (gap②)
//        + grantedId 独立化 (gap③) + validate trigger 免除 (gap④) の初 consumer。
//        付与能力 = 【宣言】【ターン1】bindPick{side:'opp', max:1} (相手の現場のキャラを1枚まで選び) →
//        startContact{targetUid:'$t.uid'} (このキャラ=付与先=ability owner とのコンタクト発生、W6 step9)。
//        0枚選択 (rules/15「まで」) は $t.uid 未解決で startContact no-op。ガード不可 (公式Q&A: コンタクト発生は
//        ガードより後)・アクション発動能力は不発 (アクションではない) は startFromEffect の generatedByEffect 契約が担保。
//   a2 = 【ヒラメキ】draw1 (B04077 a2 / B06033 a2 と同 hook。optional=発動/不発は所有者選択)。

import type { AbilityDef, CardDef } from '@/engine/types';

// 付与する declared ability (「【宣言】【ターン1】相手の現場にいるキャラを1枚まで選び、このキャラとのコンタクトを発生させる。」)
const grantedContact = {
  id: 'b06042_granted_contact',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  effect: {
    kind: 'sequence',
    steps: [
      // 相手の現場にいるキャラを1枚まで選び (side:'opp' = 付与先所有者から見た相手、アクティブ含む全キャラ = 制限なし)
      { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'opp', bind: 't', max: 1 } },
      // このキャラ (= 付与先 = ability owner = ctx.source.uid) とのコンタクトを発生させる
      { kind: 'atom', verb: 'startContact', args: { targetUid: '$t.uid' } },
    ],
  },
  description:
    '【宣言】【ターン1】相手の現場にいるキャラを1枚まで選び、このキャラとのコンタクトを発生させる。（このキャラがアクションした側のキャラになる）',
} as const;

// イベント使用効果
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  // イベント使用 (手札の使用 / ネクストヒント 両経路が同 payload を emit)。B06033 a1 同型。
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分の現場にいるキャラを1枚まで選び、ターン終了時までAP＋1000し (pick を bind:'$p' に固定)
      { kind: 'atom', verb: 'charModifyAP', args: { max: 1, side: 'self', delta: 1000, scope: 'turn', bind: '$p' } },
      // 「【宣言】【ターン1】…」を与える
      { kind: 'atom', verb: 'charGrantAbility', args: { uid: '$p.uid', scope: 'turn', ability: grantedContact } },
    ],
  },
  description:
    '自分の現場にいるキャラを1枚まで選び、ターン終了時までAP＋1000し、「【宣言】【ターン1】相手の現場にいるキャラを1枚まで選び、このキャラとのコンタクトを発生させる。（このキャラがアクションした側のキャラになる）」を与える。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
  ],
};

// 【ヒラメキ】カードを1枚引く
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B06042: CardDef = {
  id: 'B06042',
  no: '0665/B06042',
  kind: 'event',
  names: ['ここで会うたが百年目'],
  colors: ['緑'],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1754285189525906.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
  ],
};
