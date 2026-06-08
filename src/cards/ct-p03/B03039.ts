// cards/ct-p03/B03039 長島茂雄 (キャラ) — カットイン実装 (BUG-114, 2026-06-07)
// rules: 09-cutin-disguise.md, 16-card-set.md, 17-icons.md
//
// 公式テキスト(カットイン): 【カットイン】AP＋1000、相手の現場にいるキャラに裏向きでセットされている
//   カードを1枚選び、リムーブしてもよい。そうした場合、代わりにAP＋3000（コンタクト中に手札からリムーブして使う）
//
// task-C で追加された charRemoveSetCard (B08034) + side 分離 (buildShortFormPick は a.side で side を
// chooser と独立指定可) により engine 変更0 で実装可能になった (BUG-114 の verb 不在は stale)。
// chain semantics で「してもよい。そうした場合、代わりに+3000」を表現:
//   step1 AP+1000 (base, 攻撃キャラ $contact.byUid に contact scope) → step2 charRemoveSetCard
//   {player:'self', side:'opp'} (相手キャラのセット1枚、chooser=自分) → step3 AP+2000。
//   step2 が remove 適用時のみ continuation(step3) 実行 → 計+3000。skip/候補無しは continuation drop/
//   chain break で step3 不実行 → +1000 のまま (rules/09 カットイン色制限なし)。
import type { CardDef, AbilityDef } from '@/engine/types';

const cutin: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  description:
    '【カットイン】AP＋1000、相手の現場にいるキャラに裏向きでセットされているカードを1枚選び、リムーブしてもよい。そうした場合、代わりにAP＋3000',
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
      { kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', side: 'opp', max: 1, filter: { hasSetCards: true } } },
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
    ],
  },
};

export const B03039: CardDef = {
  id: 'B03039',
  no: '0296/B03039',
  kind: 'character',
  names: ['長島茂雄'],
  colors: ['緑'],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: ['高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133249341593.jpg',
  abilities: [cutin],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};
