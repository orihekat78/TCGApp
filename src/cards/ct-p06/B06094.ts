// cards/ct-p06/B06094 高木君のおごり (イベント) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   以下から1つ選んで行う。自分の現場に〚特徴［喫茶ポアロ］〛のキャラが3枚以上いる場合、代わりに2つとも行う。（上から順に行う）
//   ・アクティブ状態のキャラを1枚まで選び、スタンさせる。
//   ・スリープ状態のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//
// a1: イベント使用 (effect:declared hook, kind:'event-use')。
//   基本は choice[optA, optB] (1つ選んで行う)。自分の現場の[喫茶ポアロ]が3枚以上なら
//   sequence[optA, optB] へ昇格 (代わりに2つとも、上から順に行う) → conditional{if,then,else} で表現。
//   optA/optB は sceneSetState(set state:'stun') の explicit pick 形 (候補 state フィルタ active/sleep を
//   query.state に分離し、設定先 state:'stun' と key 衝突させない / D08019 a2 同型)。
//   末尾の（）はスタン状態の標準挙動の補足で engine.scene.setState が処理 (rules/03)。

import type { AbilityDef, CardDef, Effect } from '@/engine/types';

// ・アクティブ状態のキャラを1枚まで選び、スタンさせる。
const optActive: Effect = {
  kind: 'atom',
  verb: 'sceneSetState',
  args: { uid: '$pick', state: 'stun', target: { kind: 'pick', query: { area: 'scene', side: 'either', state: ['active'] }, n: { min: 0, max: 1 }, chooser: 'self' } },
};

// ・スリープ状態のキャラを1枚まで選び、スタンさせる。
const optSleep: Effect = {
  kind: 'atom',
  verb: 'sceneSetState',
  args: { uid: '$pick', state: 'stun', target: { kind: 'pick', query: { area: 'scene', side: 'either', state: ['sleep'] }, n: { min: 0, max: 1 }, chooser: 'self' } },
};

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'conditional',
    // 自分の現場に[喫茶ポアロ]のキャラが3枚以上いる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '喫茶ポアロ' } }, nMin: 3 },
    // 代わりに2つとも行う（上から順に行う）
    then: { kind: 'sequence', steps: [optActive, optSleep] },
    // 以下から1つ選んで行う
    else: { kind: 'choice', chooser: 'self', options: [optActive, optSleep] },
  },
  description:
    '以下から1つ選んで行う。[喫茶ポアロ]3枚以上なら代わりに2つとも行う。・アクティブ1枚までスタン ・スリープ1枚までスタン。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

// a2: 【ヒラメキ】カードを1枚引く (BUG-140 補修 2026-06-13: TSV hirameki 列の取りこぼし修正) — D03011 a2 同型
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

export const B06094: CardDef = {
  id: 'B06094',
  no: '0713/B06094',
  kind: 'event',
  names: ['高木君のおごり'],
  colors: ['黄'],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1754285264349654.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
