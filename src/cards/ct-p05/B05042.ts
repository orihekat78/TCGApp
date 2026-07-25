// cards/ct-p05/B05042 ラブリースポット (event) — CARD PHASE step12 (useEventFromHand 初 consumer 群、engine変更0)
// rules: rules/15-abilities-effects.md, rules/19-special-rules.md, rules/25-qa-effects-resolution.md,
//        rules/26-qa-deck-refresh.md
//
// 公式テキスト:
//   自分のデッキのカードを上からイベントが出るまで1枚ずつ公開し、それを手札に加える。残りの公開した
//   カードをデッキの下に移し、デッキをシャッフルする。手札からレベル6以下の【緑】の
//   〚カード名［ラブリースポット］〛以外のイベントを1枚まで使用する。
//
// 句マッピング:
//   - 「イベントが出るまで1枚ずつ公開し、それを手札に加える」=> deckRevealUntil{filter:{kind:'event'}}
//     (maxN 無し = 出るまで型、B05017/D11019 idiom)。rules/26: 必ず加える (「まで」でない) =
//     conditional{bound $matched} → handAddFromDeck。全公開で不在なら何も加えない (自動整合)。
//   - 「残りをデッキの下に移し、シャッフル」=> deckToBottomBound + deckShuffle (同 idiom)。
//   - 「手札からレベル6以下の【緑】の〚カード名［ラブリースポット］〛以外のイベントを1枚まで使用する」=>
//     useEventFromHand{max:1, filter:{kind:'event', levelMax:6, color:'緑', cardNameNot:'ラブリースポット'}}
//     (engine mega-wave W6 step3 r63 — emit(viaEffect:true)→hand.remove 順序、FILE/色制限バイパス。
//     公式Q&A「イベントが見つからなくても使用できる」= sequence 独立 step で自動整合。
//     B07026 の eventUseSource{viaEffect:true} はこの経由使用で成立)。
//   - 【カットイン】AP+2000 => $contact.byUid contact-scope (D11019/B03113 idiom)。
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
        verb: 'deckRevealUntil',
        args: { visibility: 'public', viewer: 'all', player: 'self', filter: { kind: 'event' }, bind: '$revealed', bindMatch: '$matched' },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
      {
        kind: 'atom',
        verb: 'useEventFromHand',
        args: {
          player: 'self',
          max: 1,
          filter: { kind: 'event', levelMax: 6, color: '緑', cardNameNot: 'ラブリースポット' },
        },
      },
    ],
  },
  description:
    '自分のデッキのカードを上からイベントが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。手札からレベル6以下の【緑】の〚カード名［ラブリースポット］〛以外のイベントを1枚まで使用する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/25-qa-effects-resolution.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B05042: CardDef = {
  id: 'B05042',
  no: '0546/B05042',
  kind: 'event',
  names: ['ラブリースポット'],
  colors: ['緑'],
  level: 6,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1746628061773823.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/25-qa-effects-resolution.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
