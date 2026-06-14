# engine拡張 wave#2 cluster5 — usage-restriction aura 解禁 3枚

**Round/Phase**: 2026-06-14 engine拡張 wave#2 cluster5 (`cards/wave2-cluster5`)。
「相手は【カットイン】を使用できない」/「相手のキャラの【変装時】は発動しない」族 (相手への board-derived
使用制限 aura) を解禁。設計ゲート = Workflow (5 grounding agent → synthesis → 4 敵対レンズ、全 opus)。
敵対反証で 2 欠陥を捕捉し修正反映の上 approve。M3 イベント使用不可族 (B09034/P) は cluster6 へ分割。

### engine 拡張 (additive・不在時 no-op・whitelist 3点同期は不要)

- **新 field `ContinuousModifier.opponentRestrict?: ('cutin'|'disguiseTrigger')[]`** — verb/cond/hook ではなく
  `continuousModifier` の data field のため sync-taskA-whitelists 不変。
- **新 reader `read.char.restrictsOpponent(s, ownerSide, token)`** — ownerSide の現場を走査し
  type:'continuous' & opponentRestrict.includes(token) & (condition を owner ctx で満たす) があれば true。
  BUG-030 の grantKeywords walk を board-level に拡張 (rules/24 §常時有効型 / rules/17 §条件)。
- **`flow/contact.ts` 2 ガード** — canCutIn は `other`(=cut-in する側の相手) の cutin aura を見て不可化
  (canDisguise 不変)。disguise は disguise:into emit を `restrictsOpponent(other,'disguiseTrigger')` で wrap
  (変装 swap は emit 前に完了 → 変装は成立、【変装時】trigger のみ silence)。

### 解禁カード 3枚

- B02063 羽田秀吉 — 相手カットイン不可(無条件 M1) / 【FILE8】LP+1(既存) / 【ヒラメキ】相手手札1枚リムーブ(既存)
- B04034 京極真 — 【絆鈴木園子】【自分ターン中】相手カットイン不可(M1)+相手の【変装時】不発動(M2) / 【ヒラメキ】(既存)
- B09017 吉田歩美 — 【相手ターン中】自場にレベル4[少年探偵団](≠吉田歩美)で相手カットイン不可(M1 条件付き)
- ALL_CARDS 1158→1161。

### 敵対反証が捕捉した欠陥 (修正済)

- **[blocker] M2 方向バグ**: disguise:into 抑止が変装する側の盤面を走査していた → `other`(変装する p の相手=aura
  所有者側) を走査に修正。自分変装での自爆 (自分の aura が自分の【変装時】を抑止) も同根 → 解消。
- **[major] B09017 custom 型エラー**: `allCardNameComponentsForDef(cand.cardId)` は CardDef 要求 →
  `lookupCardDef(cand.cardId)` で def 解決後に渡す (eval.ts §bond と同 import・同基準、split-name 対応)。

### 検証

- 挙動 pin 5 件 (`tests/cards/cluster5-usage-restriction-behavioral.test.ts`): M1 cutin-ban×3 aura (B02063 無条件 /
  B04034 絆+ターン / B09017 board+ターン) + 変装は許可 + **B09017 の2枚目[吉田歩美]は NAME 除外** /
  M2 相手変装時 抑止(swap 成立) + **aura 所有者自身の変装時は発動 (direction fix 証跡)**。
- 全ゲート green: tsc / sync-whitelists / full vitest **2091** (+5) / **smoke:1000 baseline 完全一致**
  (timeouts0/exceptions0/avg10.863≈10.86/winsA469 = no-op 実証。新カードは MVP デッキ不在) /
  e2e playwright **119 passed** (1 skipped) / eslint + lint:card-addition/listener/icon-abilities。
  新カードは非 MVP (CT-D08/D11 不在) で実機 playwright「画面=文言」は N/A → 専用 vitest で代替実証 (BUG-132 教訓)。
- 設計記録: [.claude/specs/engine-wave2-cluster5-usage-restriction-design.md](../specs/engine-wave2-cluster5-usage-restriction-design.md)。

### cluster6 (follow-up, B09034/B09034P)

M3 イベント使用不可 (新 verb setEventUseBan + TurnScopedFlags.eventUseBanned + 2 flow gate)。
ただし B09034「2枚まで」は `forEach over:{kind:'pick'}` が実行時 throw のため、
**handAddFromRemove に複数pick path ($pick.cardIds、charStackCard 同型) の additive 追加**を前提に別 commit で実施。
