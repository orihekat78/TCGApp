// cards/ct-d11/D11007 松田陣平 (キャラ)
// rules: 07-action-flow.md, 08-contact.md, 13-keywords.md, 17-icons.md, 22-qa-action-contact.md
// spec: .claude/specs/cards-analysis/D11007.md
//
// 公式テキスト:
//   このキャラは相手の現場にいるレベル7以上のアクティブ状態のキャラを指定してアクションできる。
//   【パートナー黄】〚突撃〛
//   【自分ターン中】【ターン1】このキャラが、このキャラよりAPの高いキャラとコンタクトしたとき、
//     手札を1枚リムーブしてもよい。そうした場合、そのコンタクト中、このキャラをAP＋3000する。
//
// NOTE (G29 target expander): 「レベル7以上アクティブも対象可」 はカード固有の対象拡張。
// 現状 continuous ability + customSelectorPatch で expansion 情報を選手キャラに付与する。
// TODO Phase 5+: engine.flow.action.canActionAgainstChar が selectorPatch の
// `expandTargetable.activeMinLevel` を参照する実装が必要。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { engine } from '@/engine';
import { partnerColorKeyword } from '../_shared/index.js';

// a1 アクション対象拡張: customSelectorPatch にメタ情報を付与
const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: {
    customSelectorPatch: () => ({
      // メタ情報: flow.canActionAgainstChar 側でこの値を見て対象拡張する想定
      expandTargetable: { activeMinLevel: 7 } as unknown as undefined,
    } as never),
  },
  description: 'このキャラは相手の現場にいるレベル7以上のアクティブ状態のキャラを指定してアクションできる。',
  ruleRefs: ['rules/07-action-flow.md'],
};

const a2 = partnerColorKeyword({ color: '黄', kw: '突撃', abilityId: 'a2' });

// a3 自分ターン中 ターン1: 高APコンタクト時に手札1リム → self AP+3000 (コンタクト中)
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  limit: { kind: 'turn', n: 1 },
  trigger: {
    hook: 'contact:start',
    matcher: (p: unknown, s: GameState) => {
      if (!p || typeof p !== 'object') return false;
      const obj = p as { aUid?: string; bUid?: string };
      if (!obj.aUid || !obj.bUid) return false;
      const aAp = engine.read.char.ap(s, obj.aUid);
      const bAp = engine.read.char.ap(s, obj.bUid);
      return bAp > aAp;
    },
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'discard',      args: { player: 'self', n: 1 } },                          // 手札を1枚選びリムーブ
        { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 3000, scope: 'contact' } },  // このキャラを AP+3000 (コンタクト中)
      ],
    },
  },
  description: '【自分ターン中】【ターン1】高APコンタクト時、手札1リムでこのキャラAP＋3000 (コンタクト中)。',
  ruleRefs: ['rules/08-contact.md', 'rules/22-qa-action-contact.md'],
};

export const D11007: CardDef = {
  id: 'D11007',
  no: '0938/D11007',
  kind: 'character',
  names: ['松田陣平'], colors: ['黄'],
  level: 6, ap: 5000, lp: 1,
  traits: ['警察', '警視庁'], keywords: [],
  rarity: 'D', imageUrl: '1775608962464705.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/07-action-flow.md', 'rules/08-contact.md', 'rules/13-keywords.md', 'rules/22-qa-action-contact.md'],
};
