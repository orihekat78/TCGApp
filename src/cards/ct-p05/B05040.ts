// cards/ct-p05/B05040 ロバート・テイラー (キャラ) — カットイン実装 (BUG-114, 2026-06-07)
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト(カットイン): 【カットイン】【自分ターン中】手札を1枚リムーブしてもよい。
//   そうした場合、リムーブしたカードのレベル1につき、AP＋1000（自分のターンのコンタクト中に手札からリムーブして使う）
//
// BUG-114 で追加した discard-bind dyn primitive (discard{bind} + $discarded.level) で engine変更0 化。
// chain: step1 discard{max:1, bind:'$discarded'} (してもよい) → step2 charModifyAP
//   delta:{dyn:'$discarded.level * 1000'} (そうした場合 = discard 適用時のみ continuation 実行)。
//   skip/手札0 は continuation drop / chain break で AP+ 無し。【自分ターン中】= condition turn:self。
import type { CardDef, AbilityDef } from '@/engine/types';

const cutin: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'turn', player: 'self' },
  description:
    '【カットイン】【自分ターン中】手札を1枚リムーブしてもよい。そうした場合、リムーブしたカードのレベル1につき、AP＋1000',
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, bind: '$discarded' } },
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: { dyn: '$discarded.level * 1000' }, scope: 'contact' } },
    ],
  },
};

export const B05040: CardDef = {
  id: 'B05040',
  no: '0544/B05040',
  kind: 'character',
  names: ['ロバート・テイラー'],
  colors: ['緑'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['カメラマン'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322178480249.jpg',
  abilities: [cutin],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
