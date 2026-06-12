// cards/ct-p08/B08029P 小も大を兼ねる (イベント・パラレル) — Task D batch (2026-06-12)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト (B08029 と同一):
//   【パートナー緑】自分のリムーブエリアにあるレベル7以下の〚カード名［伊織無我］〛を1枚まで選び、登場させる。
//   ターン終了時までそのキャラに〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）を与えるか、
//   ターン終了時までそのキャラに「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。
//   自分のリムーブエリアにあるレベル7以下の〚カード名［大岡紅葉］〛を1枚まで選び、手札に加える。
//
// 句マッピング: B08029.ts と同一 (最上位 choice + 各 option = parallel[sequence[deploy bind '$matched',
//   grant], 大岡紅葉回収])。sequence 内 choice 形は human 経路で bind 喪失のため不可 (B08029.ts 参照)。
//   P 版差分は rarity / imageUrl / no のみ。

import type { AbilityDef, CardDef, Effect } from '@/engine/types';

// option 毎に新規 object を生成し effect tree 内の共有参照を避ける (walk/Immer 安全)
const deployStep = (): Effect => ({ kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: '$pick.cardId', from: 'remove', viaEffect: true, bind: '$matched', target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { cardName: '伊織無我', levelMax: 7, kind: 'character' } }, n: { min: 0, max: 1 }, chooser: 'self' } } });
const ookaStep = (): Effect => ({ kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '大岡紅葉', levelMax: 7, kind: 'character' } } });
const optionWith = (grant: Effect): Effect => ({ kind: 'parallel', steps: [{ kind: 'sequence', steps: [deployStep(), grant] }, ookaStep()] });

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  // 【パートナー緑】(rules/17: 条件未達ならこの能力を持たない = 使えるが何も起こらないイベント)
  condition: { kind: 'partnerColor', color: '緑' },
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  // 突撃[キャラ] を与えるか、「…アクティブ状態のキャラを指定してアクションできる。」を与える (真の2択)
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      optionWith({ kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$matched.uid', kw: '突撃[キャラ]', scope: 'turn' } }),
      optionWith({ kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$matched.uid', key: 'actionTargetsActive', val: true } }),
    ],
  },
  description: '【パートナー緑】自分のリムーブエリアにあるレベル7以下の〚カード名［伊織無我］〛を1枚まで選び、登場させる。ターン終了時までそのキャラに〚突撃［キャラ］〛を与えるか、ターン終了時までそのキャラに「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。自分のリムーブエリアにあるレベル7以下の〚カード名［大岡紅葉］〛を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};

export const B08029P: CardDef = {
  id: 'B08029P',
  no: '0869/B08029P',
  kind: 'event',
  names: ['小も大を兼ねる'],
  colors: ['緑'],
  level: 8,
  traits: [],
  rarity: 'CP',
  imageUrl: '1770878966438277.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
  ],
};
