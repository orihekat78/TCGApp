// cards/ct-p07/B07026 相応しいお方 (event) — CARD PHASE step12 (eventUseSource 初 consumer、engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/25-qa-effects-resolution.md
//
// 公式テキスト:
//   【パートナー緑】AP8000以下のキャラを1枚まで選び、リムーブする。このイベントが能力や効果によって
//   使用されていた場合、カードを1枚引く。
//
// 句マッピング:
//   - event 自己使用トリガ => hook:'effect:declared' + matcher kind==='event-use' (B05041 idiom)。
//   - 【パートナー緑】=> condition partnerColor{緑} (rules/17、条件外は何も効果のないイベント扱い)。
//   - 「AP8000以下のキャラを1枚まで選び、リムーブする」=> sceneRemove 短縮形
//     {max:1, side:'either', cause:'effect', filter:{apMax:8000}} (D02015/B07059 idiom)。
//   - 「このイベントが能力や効果によって使用されていた場合、カードを1枚引く」=>
//     conditional{if: eventUseSource{viaEffect:true}, then: draw 1} (engine mega-wave W6 step3 r63 P19 —
//     useEventFromHand emit が viaEffect:true / 手札の使用・ネクストヒント emit は viaEffect 無指定 =
//     false で自然判別。公式Q&A: B07015 宣言能力 / B05042 効果による使用が該当、引かない選択不可 =
//     conditional then は必須実行)。
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
  condition: { kind: 'partnerColor', color: '緑' },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } },
      },
      {
        kind: 'conditional',
        if: { kind: 'eventUseSource', viaEffect: true },
        then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【パートナー緑】AP8000以下のキャラを1枚まで選び、リムーブする。このイベントが能力や効果によって使用されていた場合、カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/25-qa-effects-resolution.md'],
};

export const B07026: CardDef = {
  id: 'B07026',
  no: '0758/B07026',
  kind: 'event',
  names: ['相応しいお方'],
  colors: ['緑'],
  level: 6,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762413994204532.jpg',
  abilities: [a1],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/25-qa-effects-resolution.md'],
};
