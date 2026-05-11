// cards/ct-d11/D11013 萩原千速 (キャラ)
// rules: 09-cutin-disguise.md, 17-icons.md, 22-qa-action-contact.md, 23-qa-disguise-cutin.md
// spec: .claude/specs/cards-analysis/D11013.md
//
// 公式テキスト:
//   【カットイン】【パートナー黄】AP＋1000、〚特徴［警察］〛のキャラに【カットイン】した場合、
//     カードを1枚引く。（コンタクト中に手札からリムーブして使う）

import type { AbilityDef, CardDef, EffectCtx, GameState } from '@/engine/types';
import { engine } from '@/engine';

const a1: AbilityDef = {
  id: 'a1',
  type: 'icon-cutin',
  scope: 'on-hand',
  condition: { kind: 'partnerColor', color: '黄' },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' },
      },
      {
        kind: 'conditional',
        if: {
          kind: 'custom',
          check: (s: GameState, ctx: EffectCtx) => {
            const tgt = ctx.contact?.targetUid;
            if (!tgt) return false;
            return engine.read.char.traits(s, tgt).includes('警察');
          },
        },
        then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【カットイン】【パートナー黄】AP＋1000、[警察]に【カットイン】した場合カードを1枚引く。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const D11013: CardDef = {
  id: 'D11013',
  no: '0940/D11013',
  kind: 'character',
  names: ['萩原千速'],
  colors: ['黄'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['警察', '神奈川県警'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1775608977339229.jpg',
  abilities: [a1],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};
