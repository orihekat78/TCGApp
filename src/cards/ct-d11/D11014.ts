// cards/ct-d11/D11014 横溝重悟 (キャラ・疾風+宣言)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
// spec: .claude/specs/cards-analysis/D11014.md
//
// 公式テキスト:
//   【疾風】キャラを1枚まで選び、ターン終了時までAP－1000する。
//   【宣言】【スリープ】〚手札を1枚リムーブする〛: 自分のリムーブエリアにあるレベル5以下の
//     〚特徴［警察］〛のキャラを1枚まで選び、登場させる。
//     〚カード名［萩原千速］〛を登場させた場合、カードを1枚引く。

import type { AbilityDef, CardDef, EffectCtx, GameState } from '@/engine/types';
import { engine } from '@/engine';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => (p as { enterOrder?: number })?.enterOrder === 1,
  },
  effect: {
    kind: 'choice', chooser: 'self',
    options: [{
      kind: 'atom', verb: 'charModifyAP',
      args: {
        uid: '$pick', delta: -1000, scope: 'turn',
        target: {
          kind: 'pick',
          query: { area: 'scene', side: 'either' },
          n: { min: 0, max: 1 }, chooser: 'self',
        },
      },
    }],
  },
  description: '【疾風】キャラを1枚まで選び、ターン終了時までAP－1000する。',
  ruleRefs: ['rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      {
        kind: 'removeFromHand',
        n: 1,
        target: {
          kind: 'pick',
          query: { area: 'hand', side: 'self' },
          n: { min: 1, max: 1 }, chooser: 'self',
        },
      },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'choice', chooser: 'self',
        options: [{
          kind: 'atom', verb: 'sceneEnter',
          args: {
            player: 'self', cardId: '$pick.cardId', viaEffect: true, bind: '$entered',
            target: {
              kind: 'pick',
              query: { area: 'remove', side: 'self', filter: { trait: '警察', levelMax: 5 } },
              n: { min: 0, max: 1 }, chooser: 'self',
            },
          },
        }],
      },
      {
        kind: 'conditional',
        if: {
          kind: 'custom',
          check: (_s: GameState, ctx: EffectCtx) => {
            const entered = ctx.bindings?.['$entered'] as { cardId?: string }[] | undefined;
            const cardId = entered?.[0]?.cardId;
            if (!cardId) return false;
            const def = engine.cards.get(cardId);
            return !!def && def.names.includes('萩原千速');
          },
        },
        then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description: '【宣言】【スリープ】〚手札1リム〛: リムーブのLv5以下[警察]を登場。[萩原千速]を登場で1ドロー。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const D11014: CardDef = {
  id: 'D11014',
  no: '0941/D11014',
  kind: 'character',
  names: ['横溝重悟'], colors: ['黄'],
  level: 7, ap: 6000, lp: 1,
  traits: ['警察', '神奈川県警'], keywords: [],
  rarity: 'D', imageUrl: '1775608977348526.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
