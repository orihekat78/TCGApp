# engine拡張 wave#2 cluster5 — usage-restriction aura 設計記録 (2026-06-14)

「相手は【カットイン】を使用できない」/「相手のキャラの【変装時】は発動しない」aura の additive 解禁。
設計ゲート = Workflow (5 grounding agent → synthesis → 4 敵対レンズ, 全 opus)。反証で 2 欠陥を捕捉・修正済。

## 対象カード (cluster5 = 3枚)

| ID | 名 | 句 → 機構 |
|----|----|----------|
| B02063 | 羽田秀吉 | 相手カットイン不可(無条件 M1) / 【FILE8】LP+1(既存) / ヒラメキ discard:opp(既存) |
| B04034 | 京極真 | 【絆鈴木園子】【自分ターン中】相手カットイン不可(M1) + 相手の変装時不発動(M2) / ヒラメキ(既存) |
| B09017 | 吉田歩美 | 【相手ターン中】+ 自場にレベル4少年探偵団(≠吉田歩美) で相手カットイン不可(M1 条件付き) |

cluster6 (B09034/B09034P 緑イベント「イベント使用不可」M3) は別 commit。後述。

## engine surface (additive・不在時 no-op・whitelist 3点同期は不要)

opponentRestrict は `continuousModifier` の **field** (verb/cond/hook ではない) → sync-taskA-whitelists 不変。

1. `types/card-def.ts` — `ContinuousModifier.opponentRestrict?: ('cutin'|'disguiseTrigger')[]` 追加。
2. `read/char.ts` — `restrictsOpponent(s, ownerSide, token): boolean`。ownerSide の scene を走査し
   type:'continuous' & opponentRestrict.includes(token) & (condition を owner ctx で満たす) があれば true。
   BUG-030 の grantKeywords walk を board-level に拡張 (rules/24 §常時有効型 / rules/17 §条件)。`char` export に追加。
3. `flow/contact.ts` —
   - canCutIn: `other = opp-of-p`; `restrictsOpponent(state, other, 'cutin')` なら不可 (canDisguise 不変)。
   - disguise: disguise:into emit を `if (!restrictsOpponent(state, other, 'disguiseTrigger'))` で wrap。
     変装 swap (deck.toBottom/disguiseInto/hand.remove) は emit 前に完了 → 変装は成立、変装時 のみ silence。

## 敵対反証が捕捉した欠陥 (修正済)

- **[blocker] M2 方向バグ**: 設計初案は `restrictsOpponent(state, p, ...)`(変装する側の盤面)を走査 →
  正しくは `other`(変装する p の相手 = aura 所有者側)。canCutIn の other 計算と一致させ修正。
  自分変装での自爆 (自分の aura が自分の変装時を抑止) も同根 → 修正で解消。
- **[major] B09017 custom 型エラー**: `allCardNameComponentsForDef(cand.cardId)` は CardDef 要求 →
  `lookupCardDef(cand.cardId)` で def 解決後に渡す (eval.ts §bond と同 import・同基準)。

## ルール整合 / エッジ (behavioral test で実証: tests/cards/cluster5-usage-restriction-behavioral.test.ts)

- rules/09: M1 は canCutIn のみ・canDisguise 不変 → 全 3 枚 qAndA「変装は可能」と一致。M2 は変装時 trigger のみ抑止。
- rules/17: 【絆】= 現場カード名(パートナー不可) / 条件未達 = aura を持たない扱い。【FILE8】= file.length(assisted 含む)。
- rules/19/24: B09017 は [吉田歩美] を **NAME 除外** (split-name 対応)。2枚目の吉田歩美では board 不成立
  (excludeSelf=uid では誤許容)。aura は type:'continuous' で毎回再評価 (条件外で即失効、turn 境界で消える)。
- baseline: CT-D08/CT-D11 に本 3 ID 無し。opponentRestrict は新 field で既存 continuous と非衝突 →
  smoke:1000 baseline 完全一致 (no-op 実証)。新挙動は smoke では踏めない (BUG-132 教訓) → 専用 vitest 必須。

## cluster6 (follow-up, B09034/B09034P)

M3 = ターン scoped イベント使用不可。新 verb `setEventUseBan` (3点同期要) + `TurnScopedFlags.eventUseBanned`
+ `mutate/flag.ts` reset + handUseGateCommon/next-hint の event-only gate。**ただし B09034「2枚まで」は
`forEach over:{kind:'pick'}` が実行時 throw** (resolver.ts:122 が picked 無しで resolveTarget → throw) /
素の handAddFromRemove は value[0] の1枚のみ → **handAddFromRemove に複数pick path ($pick.cardIds、
charStackCard 同型) を additive 追加** が前提。cluster6 で設計→実装→専用テスト。
