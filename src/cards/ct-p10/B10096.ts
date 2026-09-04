// CT-P10 B10096 「何の真似だ…」
// rules: 09-cutin-disguise.md, 14-refresh.md, 15-abilities-effects.md, 20-color-and-switch.md
import type { AbilityDef, CardDef, Effect, GameState } from '@/engine/types';

const blackCutin = { color: '黒', keyword: 'カットイン' };

const lookAndAdd: Effect = {
  kind: 'sequence',
  steps: [
    { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', chooseMatch: 'upTo', maxN: 4, filter: blackCutin, bind: '$revealed', bindMatch: '$matched' } },
    { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId', presentation: 'public-selected-card' } } },
    { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
  ],
};

const enterFromHand: Effect = {
  kind: 'atom',
  verb: 'sceneEnter',
  args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { kind: 'character', ...blackCutin, levelMax: { dyn: '$self.fileCount' } } },
};

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (payload: unknown, _state: GameState) => (payload as { kind?: unknown })?.kind === 'event-use' },
  condition: { kind: 'partnerColor', color: '黒' },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'mill', args: { player: 'self', n: 3, gate: true, bind: '$removed' } },
        {
          kind: 'conditional',
          if: { kind: 'boundMatchCountAtLeast', bindKey: '$removed', filter: blackCutin, n: 3 },
          then: { kind: 'sequence', steps: [lookAndAdd, enterFromHand] },
          else: {
            kind: 'conditional',
            if: { kind: 'boundMatchCountAtLeast', bindKey: '$removed', filter: blackCutin, n: 1 },
            then: { kind: 'choice', chooser: 'self', options: [lookAndAdd, enterFromHand] },
          },
        },
      ],
    },
  },
  description: '【パートナー黒】自分のデッキのカードを上から3枚リムーブしてもよい。この効果によって【カットイン】を持つ【黒】のカードが1枚以上リムーブされた場合、以下から1つ選んで行う。3枚以上リムーブされた場合、代わりに2つとも行う。（上から順に行う）・自分のデッキのカードを上から4枚見る。その中から【カットイン】を持つ【黒】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。・手札から自分のFILEエリアの枚数以下のレベルの【カットイン】を持つ【黒】のキャラを1枚まで登場させる。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-hand', condition: { kind: 'turn', player: 'self' },
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 3000, scope: 'contact' } },
  description: '【カットイン】【自分ターン中】AP＋3000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md'],
};

export const B10096: CardDef = {
  id: 'B10096', no: '1151/B10096', kind: 'event', names: ['「何の真似だ…」'], colors: ['黒'], level: 6,
  traits: [], keywords: ['カットイン'], rarity: 'C', imageUrl: '1783904232387075.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/20-color-and-switch.md'],
};

export const B10096P: CardDef = { ...B10096, id: 'B10096P', no: '1151/B10096P', rarity: 'CP', imageUrl: '1783904232395553.jpg' };
