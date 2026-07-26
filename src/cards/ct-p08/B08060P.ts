// cards/ct-p08/B08060P 「託されたカセットテープ」 (イベント) — engine拡張 wave#2 cluster12 (nested-filter-dyn, 2026-06-15)
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   自分のデッキのカードを上からレベル7のカードが出るまで1枚ずつ公開し、それを手札に加える。
//   残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//   カードを手札に加えた場合、手札を1枚リムーブする。
//   手札から自分のFILEエリアの枚数以下のレベルのキャラを1枚まで登場させる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング (B05017 a1 reveal-until + D01013 a2 hirameki + cluster12 sceneEnter-dyn の合成):
//   - イベント使用 = effect:declared selfOnly + matcher kind==='event-use' (B04064 a1 同型)。
//   - 上からレベル7のカードが出るまで1枚ずつ公開し => deckRevealUntil{filter:{levelMin:7,levelMax:7}} (maxN 無し=1枚ずつ until-match, B05017 a1 同型)。
//     それを手札に加える => 公式Q&A「必ずそれ(最初に公開された条件合致カード)を手札に加える」= 必須 → conditional($matched)→handAddFromDeck。
//     レベル7不在で全公開 → $matched=[] → 何も加えず (公式Q&A「何も手札に加えず、公開したカードをすべてデッキに移してシャッフル」)。
//   - 残りの公開したカードをデッキの下に移し、デッキをシャッフルする => deckToBottomBound{$revealed} → deckShuffle (B05017/D11019 同型)。
//   - カードを手札に加えた場合、手札を1枚リムーブする => conditional($matched)→discard{n:1} (必須 discard、対象は手札任意 rules/15)。
//   - 手札から自分のFILEエリアの枚数以下のレベルのキャラを1枚まで登場 =>
//       sceneEnter{from:'hand', max:1, viaEffect:true, filter:{kind:'character', levelMax:{dyn:'$self.fileCount'}}}
//       色指定なし (「キャラ」のみ)。levelMax:{dyn:'$self.fileCount'} = cluster12 nested-filter-dyn (アシストパートナー込み rules/17)。viaEffect 色制限なし rules/20。
//   - 【ヒラメキ】カードを1枚引く => a2 evidence:remove-by-action optional draw 1 (D01013 a2 同型, rules/10)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'sequence',
    steps: [
      // レベル7のカードが出るまで1枚ずつ公開 (until-match, maxN 無し) → $matched に bind
      { kind: 'atom', verb: 'deckRevealUntil', args: { visibility: 'public', viewer: 'all', player: 'self', filter: { levelMin: 7, levelMax: 7 }, bind: '$revealed', bindMatch: '$matched' } },
      // それ(レベル7)を必ず手札に加える
      { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } } },
      // 残りの公開したカードをデッキの下に移す
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      // デッキをシャッフルする
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
      // カードを手札に加えた場合、手札を1枚リムーブする
      { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } } },
      // 手札から FILE 枚数以下のレベルのキャラを1枚まで登場 (cluster12: levelMax dyn, 色指定なし)
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { kind: 'character', levelMax: { dyn: '$self.fileCount' } } } },
    ],
  },
  description:
    '自分のデッキのカードを上からレベル7のカードが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。カードを手札に加えた場合、手札を1枚リムーブする。手札から自分のFILEエリアの枚数以下のレベルのキャラを1枚まで登場させる。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};

// a2: 【ヒラメキ】カードを1枚引く (D01013 a2 同型, rules/10)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B08060P: CardDef = {
  id: 'B08060P',
  no: '0898/B08060P',
  kind: 'event',
  names: ['託されたカセットテープ'],
  colors: ['赤'],
  level: 1,
  traits: [],
  rarity: 'CP',
  imageUrl: '1770878984759762.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
