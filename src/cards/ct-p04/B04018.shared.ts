// B04018 / B04018P 共通定義。公式テキストが同一のprint variant。
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md,
//        20-color-and-switch.md, 21-declared-ability-cost.md,
//        24-qa-naming-stun.md, 25-qa-effects-resolution.md
import type { AbilityDef, CardDef } from '@/engine/types';

type VariantMetadata = Pick<CardDef, 'id' | 'no' | 'rarity' | 'imageUrl'>;

function abilities(): AbilityDef[] {
  const a1: AbilityDef = {
    id: 'a1',
    type: 'triggered',
    scope: 'on-scene',
    trigger: {
      hook: 'enter',
      matcherCondition: {
        kind: 'or',
        cs: [
          { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', requireSource: true },
          { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', filter: { cardName: '服部平次' } },
        ],
      },
    },
    effect: {
      kind: 'atom',
      verb: 'charDisableOriginal',
      args: {
        uid: '$pick',
        scope: 'turn',
        target: {
          kind: 'pick',
          query: { area: 'scene', side: 'opp' },
          n: { min: 0, max: 1 },
          chooser: 'self',
        },
      },
    },
    description: 'このキャラか[服部平次]が自分の現場に登場したとき、相手の現場にいるキャラを1枚まで選び、ターン終了時まで元の能力を無効にする。',
    ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md', 'rules/25-qa-effects-resolution.md'],
  };

  const a2: AbilityDef = {
    id: 'a2',
    type: 'triggered',
    scope: 'on-scene',
    trigger: { hook: 'leave:to-remove', selfOnly: true },
    condition: { kind: 'turn', player: 'opp' },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: '【相手ターン中】【現場リムーブ時】カードを1枚引く。',
    ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
  };

  const a3: AbilityDef = {
    id: 'a3',
    type: 'declared',
    scope: 'on-scene',
    condition: {
      kind: 'and',
      cs: [
        { kind: 'partnerColor', color: '緑' },
        { kind: 'caseStatus', status: '解決編' },
      ],
    },
    cost: {
      kind: 'pay',
      items: [
        { kind: 'sleepSelf' },
        {
          kind: 'removeFromHand',
          target: {
            kind: 'pick',
            query: { area: 'hand', side: 'self' },
            n: { min: 1, max: 1 },
            chooser: 'self',
          },
          n: 1,
        },
      ],
    },
    effect: {
      kind: 'atom',
      verb: 'sceneEnter',
      args: {
        player: 'self',
        from: 'remove',
        max: 1,
        viaEffect: true,
        filter: { kind: 'character', cardName: '服部平次', levelMax: 5 },
      },
    },
    description: '【パートナー緑】【解決編】【宣言】【スリープ】〚手札を1枚リムーブする〛：自分のリムーブエリアにあるレベル5以下の[服部平次]を1枚まで選び、登場させる。',
    ruleRefs: [
      'rules/15-abilities-effects.md',
      'rules/17-icons.md',
      'rules/19-special-rules.md',
      'rules/20-color-and-switch.md',
      'rules/21-declared-ability-cost.md',
      'rules/24-qa-naming-stun.md',
    ],
  };

  return [a1, a2, a3];
}

export function buildB04018Variant(metadata: VariantMetadata): CardDef {
  return {
    ...metadata,
    kind: 'character',
    names: ['遠山和葉'],
    colors: ['緑'],
    level: 6,
    ap: 4000,
    lp: 1,
    traits: ['高校生'],
    keywords: [],
    abilities: abilities(),
    ruleRefs: [
      'rules/15-abilities-effects.md',
      'rules/17-icons.md',
      'rules/19-special-rules.md',
      'rules/20-color-and-switch.md',
      'rules/21-declared-ability-cost.md',
      'rules/24-qa-naming-stun.md',
      'rules/25-qa-effects-resolution.md',
    ],
  };
}
