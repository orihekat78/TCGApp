// cards/pr-01/PR195 ブルーサファイア (event) — engine wave-12 exemplar (toPartnerArea / G39)
// rules: rules/03-field-areas.md (§パートナーエリア), rules/06-card-types.md, rules/10-action-event.md,
//        rules/14-refresh.md, rules/15-abilities-effects.md, rules/19-special-rules.md,
//        rules/26-qa-deck-refresh.md (§「〜が出るまで1枚ずつ公開し、それを手札に加える」型 = 必ず加える)
// 公式テキスト (TSV pr-01/event.tsv + 公式 API pr-01-api.json):
//   effect: 自分のデッキのカードを上から〚カード名［中森青子］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。このカードをパートナーエリアに移す。
//   hirameki: 【ヒラメキ】（証拠からリムーブされるときに発動する）このカードをパートナーエリアに移す。
//   category1: ビッグジュエル (公式 API。TSV drop のため明示 — B07055 同運用)
// 公式 Q&A: 見つからず全公開 → 何も加えず全部デッキに戻しシャッフル / 公開されたら必ず加える (decline 不可)
//   / PA 上限なし / ヒラメキ decline 可。
// 句マッピング (certify wf_66b41e13 grounding 誤訳ゼロ。B01018 a1 と deck-reveal 4節 byte 等価 (cardName 差のみ)):
//   - 起動配線 => B07059 と同型 event-use trigger。【パートナー(色)】アイコンは印字に無い → condition なし
//   - 〜が出るまで1枚ずつ公開し => deckRevealUntil {player:'self', filter:{cardName:'中森青子'},
//     bind:'$revealed', bindMatch:'$matched'} (maxN/chooseMatch なし = 出るまで型) [B01018/B05017 同型。
//     cardName は rules/19 複数名分割で match]
//   - それを手札に加える (必須) => conditional {if bound $matched matched} → handAddFromDeck
//     {player:'self', cardId:'$matched.cardId'} [found/not-found guard であり選択ではない (rules/26 必ず加える型)]
//   - 残りの公開したカードをデッキの下に移し => deckToBottomBound {player:'self', bindKey:'$revealed'}
//     [$revealed は matched を除く公開分]
//   - デッキをシャッフルする => deckShuffle {player:'self'}
//   - このカードをパートナーエリアに移す => toPartnerArea {} [plain sequence 末尾。中森青子 不在で全公開でも必ず発火]
//   - 【ヒラメキ】 => a2 B07059 と同型 (optional decline 可)

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  effect: {
    kind: 'sequence',
    steps: [
      // 中森青子 が出るまで1枚ずつ公開 (B01018 同型)
      { kind: 'atom', verb: 'deckRevealUntil', args: { visibility: 'public', viewer: 'all', player: 'self', filter: { cardName: '中森青子' }, bind: '$revealed', bindMatch: '$matched' } },
      // 出たら必ず手札へ (found guard、選択不可 = rules/26)
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      // 残りの公開分をデッキの下へ
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed', order: 'preserve' } },
      // デッキをシャッフル
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
      // このカードをパートナーエリアに移す (無条件・必ず)
      { kind: 'atom', verb: 'toPartnerArea', args: {} },
    ],
  },
  description: '自分のデッキのカードを上から〚カード名［中森青子］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。このカードをパートナーエリアに移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'toPartnerArea', args: {} },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）このカードをパートナーエリアに移す。',
  ruleRefs: ['rules/10-action-event.md'],
};

export const PR195: CardDef = {
  id: 'PR195',
  no: '0832/PR195',
  kind: 'event',
  names: ['ブルーサファイア'],
  colors: ['白'],
  level: 1,
  // 特徴 (公式 API category1 由来): ビッグジュエル (B07055 同運用)
  traits: ['ビッグジュエル'],
  rarity: 'PR',
  imageUrl: '19aaa0308c1288.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
