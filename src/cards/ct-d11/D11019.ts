// cards/ct-d11/D11019 15の受難 (イベント)
// rules: 09-cutin-disguise.md, 13-keywords.md, 17-icons.md, 20-color-and-switch.md, 26-qa-deck-refresh.md
// spec: .claude/specs/cards-analysis/D11019.md
//
// 公式テキスト:
//   自分のデッキのカードを上からレベル4以下の【黄】のキャラが出るまで1枚ずつ公開し、それを登場させる。
//   残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//   自分のリムーブエリアに【黄】のカードが20枚以上ある場合、ターン終了時までそのキャラに〚突撃［事件］〛を持たせる。
//   【カットイン】AP＋1000
//
// a1: 個別実装 sequence (D11020 と同じ DSL コンパクト形 — 1 step = 1 行 + 公式テキスト対応コメント)
// a2: 【カットイン】AP＋1000 (inline — 旧 cutinFixedAP factory を展開)

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use', // このイベント自身が使われたとき発火
  },
  effect: {
    kind: 'sequence',
    steps: [
      // デッキ上からレベル4以下【黄】のキャラが出るまで1枚ずつ公開 ($matched=該当キャラ / $revealed=公開した全カード)
      { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', filter: { color: '黄', levelMax: 4, kind: 'character' }, bind: '$revealed', bindMatch: '$matched' } },
      { kind: 'conditional',
        if: { kind: 'and', cs: [{ kind: 'bound', key: '$matched', presence: 'matched' }, { kind: 'removeColorAtLeast', player: 'self', color: '黄', n: 20 }] },
        // 公開した【黄】キャラを登場させる
        // BUG-102: target に source area=deck を指定し、登場時にマッチカードをデッキから除去
        // (sourceArea='deck' → atom-handlers sceneEnter:421 splice)。無いと現場+デッキで複製。
        then: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: '$matched.cardId', viaEffect: true, target: { query: { area: 'deck', side: 'self' } } } },
            { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$matched.uid', kw: '突撃[事件]', scope: 'turn' } },
          ],
        },
        else: { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: '$matched.cardId', viaEffect: true, target: { query: { area: 'deck', side: 'self' } } } },
      },
      // 残りの公開カードをデッキの下に移す
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      // デッキをシャッフルする
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ],
  },
  description:
    'デッキ上からレベル4以下【黄】のキャラまで公開→登場 / 残りはデッキ下 / リムーブ【黄】20以上で突撃[事件]を付与。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

// a2: 【カットイン】AP＋1000 — コンタクト中の攻撃キャラ ($contact.byUid) を contact scope で加算
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const D11019: CardDef = {
  id: 'D11019',
  no: '0944/D11019',
  kind: 'event',
  names: ['15の受難'],
  colors: ['黄'],
  level: 4,
  traits: [],
  rarity: 'D',
  imageUrl: '1775608977394523.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
