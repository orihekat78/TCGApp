// cards/ct-p07/B07016 服部平次 (キャラ) — catalog-reuse batch
// rules: 05-turn-phases.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【自分ターン中】【ターン1】自分が【緑】のイベントを使用したとき、レベル8以下のキャラを1枚まで選び、リムーブする。（イベントを解決してからキャラを選ぶ）
//   【パートナー緑】【宣言】【ターン1】〚このキャラ以外のレベル5以上のキャラを1枚スリープさせる〛：ターン終了時までこのキャラは〚突撃［事件］〛を持つ。
//
// a1: 自分が【緑】イベント使用時 (effect:declared, 非selfOnly, matcher: kind==='event-use' かつ 使用カードが緑) →
//     レベル8以下のキャラを1枚まで選びリムーブ。matcher は engine.cards.get で使用イベントの色を判定 (B02010 の engine import 同様)。
//     【自分ターン中】=condition turn:self / 【ターン1】=limit turn 1。effect は D08003 a1 / D11020 の sceneRemove 短縮形 pick。
// a2: 【パートナー緑】【宣言】【ターン1】 cost(このキャラ以外のレベル5以上を1枚スリープ; D01003 sleepChar pick 同型) →
//     ターン終了時まで このキャラに 突撃[事件] 付与 (D11015 a2 charGrantKeyword 同型)。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { engine } from '@/engine';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【自分ターン中】
  condition: { kind: 'turn', player: 'self' },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 自分が【緑】のイベントを使用したとき (使用カードの色を engine.cards.get で判定)
  trigger: {
    hook: 'effect:declared',
    matcher: (p: unknown, _s: GameState) => {
      if (!p || typeof p !== 'object') return false;
      const pp = p as { kind?: unknown; cardId?: unknown };
      if (pp.kind !== 'event-use' || typeof pp.cardId !== 'string') return false;
      const d = engine.cards.get(pp.cardId);
      return !!d && d.colors.includes('緑');
    },
  },
  // レベル8以下のキャラを1枚まで選び、リムーブする (イベント解決後)
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 8 } } },
  description: '【自分ターン中】【ターン1】自分が【緑】のイベントを使用したとき、レベル8以下のキャラを1枚までリムーブ。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【パートナー緑】
  condition: { kind: 'partnerColor', color: '緑' },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 〚このキャラ以外のレベル5以上のキャラを1枚スリープさせる〛 (D01003 sleepChar pick 同型)
  cost: {
    kind: 'sleepChar',
    target: { kind: 'pick', query: { area: 'scene', side: 'self', excludeSelf: true, filter: { levelMin: 5 } }, n: { min: 1, max: 1 }, chooser: 'self' },
  },
  // ターン終了時までこのキャラは〚突撃［事件］〛を持つ
  effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[事件]', scope: 'turn' } },
  description: '【パートナー緑】【宣言】【ターン1】[このキャラ以外のレベル5以上を1枚スリープ]:ターン終了時まで 突撃[事件] を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/21-declared-ability-cost.md', 'rules/17-icons.md'],
};

export const B07016: CardDef = {
  id: 'B07016',
  no: '0748/B07016',
  kind: 'character',
  names: ['服部平次'],
  colors: ['緑'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1762413976124612.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
  ],
};
