// cards/ct-p01/B01058 トッ (event) — CARD PHASE step12 (reserveEffect next-match 初 consumer、engine変更0)
// rules: rules/03-field-areas.md, rules/13-keywords.md, rules/15-abilities-effects.md,
//        rules/24-qa-naming-stun.md, rules/25-qa-effects-resolution.md, rules/27-card-restrictions.md
//
// 公式テキスト:
//   【白】のキャラを1枚まで選び、ターン終了時まで〚突撃［事件］〛を与える。このターン中、次に相手の
//   証拠がリムーブされたとき、スリープ状態のキャラを1枚まで選び、スタンさせる。
//   （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//
// ※ 公式競技イベントでは禁止カード (rules/27、2025-02-07)。本アプリはカジュアル準拠で実装 (デッキ検証側で表示)。
//
// 句マッピング:
//   - event 自己使用トリガ => hook:'effect:declared' + matcher kind==='event-use' (B05041 idiom)。
//   - 「【白】のキャラを1枚まで選び、ターン終了時まで〚突撃［事件］〛を与える」=>
//     charGrantKeyword 短縮形 {max:1, side:'either', filter:{color:'白'}, kw:'突撃[事件]', scope:'turn'}
//     (B04031/D09020 同型。エリア指定なし = side either rules/15、「1枚まで」= 0枚可)。
//   - 「このターン中、次に相手の証拠がリムーブされたとき、…スタンさせる」=>
//     reserveEffect{hook:'evidence:removed', mode:'next-match', condition:triggerPlayerIs{opp}}
//     (engine mega-wave W6 step8 r75 — single-fire、endTurn 失効、engine probe RESERVE_NEXTMATCH と
//     同 args 形状)。公式Q&A「0枚選んだ場合も有効」= 前段 pick と reserve は独立 sequence step で自動整合。
//     inner sceneSetState はスリープ状態のみ pick (state:['sleep'])、スタン済/アクティブは候補外。
//     エリア指定なし「キャラ」= side:'either'。
import type { AbilityDef, CardDef } from '@/engine/types';

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
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: { player: 'self', max: 1, side: 'either', filter: { color: '白' }, kw: '突撃[事件]', scope: 'turn' },
      },
      {
        kind: 'atom',
        verb: 'reserveEffect',
        args: {
          hook: 'evidence:removed',
          mode: 'next-match',
          condition: { kind: 'triggerPlayerIs', side: 'opp' },
          effect: {
            kind: 'atom',
            verb: 'sceneSetState',
            args: {
              uid: '$pick',
              state: 'stun',
              target: {
                kind: 'pick',
                query: { area: 'scene', side: 'either', state: ['sleep'] },
                n: { min: 0, max: 1 },
                chooser: 'self',
              },
            },
          },
        },
      },
    ],
  },
  description:
    '【白】のキャラを1枚まで選び、ターン終了時まで〚突撃［事件］〛を与える。このターン中、次に相手の証拠がリムーブされたとき、スリープ状態のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/24-qa-naming-stun.md',
    'rules/25-qa-effects-resolution.md',
  ],
};

export const B01058: CardDef = {
  id: 'B01058',
  no: '0050/B01058',
  kind: 'event',
  names: ['トッ'],
  colors: ['白'],
  level: 4,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013041182399.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/24-qa-naming-stun.md',
    'rules/25-qa-effects-resolution.md',
    'rules/27-card-restrictions.md',
  ],
};
