# 作業ログ — 名探偵コナンTCG プロジェクト

> 履歴: cluster2/BUG-140 → sessions/2026-06-13.md。cluster3 → sessions/2026-06-14.md +
> changelog-entries/2026-06-14-01。cluster4 → sessions/2026-06-14-2.md + changelog-entries/2026-06-14-02。

## 現在地 (2026-06-14) — engine拡張 wave#2 cluster5 ✅ (branch cards/wave2-cluster5、commit 前)

cluster4 完了 (commit 431b8eed) 後、ユーザー選択 (A) で cluster5 = usage-restriction aura を実施。
cluster6 (M3 イベント使用不可) は同セッション内で cluster5 後に別 commit 実装の方針。

### usage-restriction aura 解禁 3枚 (M1 相手カットイン不可 + M2 変装時不発動)

- 設計ゲート = Workflow (5 grounding → synthesis → 4 敵対レンズ, 全 opus, 1.3M tok)。**反証が 2 欠陥捕捉**:
  M2 方向バグ (disguise:into 抑止が変装側盤面を走査 → `other`=相手側に修正、自分変装自爆も同根) /
  B09017 custom 型エラー (cardId string を CardDef 要求 helper に渡す → lookupCardDef で解決)。両方修正反映。
- engine additive (whitelist 3点同期 **不要** = verb でなく continuousModifier field):
  新 field `ContinuousModifier.opponentRestrict?:('cutin'|'disguiseTrigger')[]` /
  新 reader `read.char.restrictsOpponent(s,ownerSide,token)` (grantKeywords walk を board-level 拡張) /
  `flow/contact.ts` canCutIn + disguise:into emit に other-side ガード 2 箇所。touched engine = 3 ファイル。
- カード: B02063 羽田秀吉(無条件)・B04034 京極真(絆+ターン, M1+M2)・B09017 吉田歩美(相手ターン+board, NAME除外)。ALL_CARDS 1158→1161。

### 検証ゲート (全 green)

tsc 0 / sync-whitelists / 挙動テスト 5 新設 (`tests/cards/cluster5-usage-restriction-behavioral.test.ts`:
M1 cutin-ban×3 + 変装許可 + B09017 2枚目吉田歩美 NAME除外 / M2 抑止+swap成立 + 自分変装は発動=direction fix証跡) /
full vitest **2091** (+5) / smoke:1000 baseline 完全一致 (avg10.863≈10.86/winsA469/timeouts0/exceptions0=no-op実証) /
e2e playwright **119 passed** (1 skipped) / eslint + lint:card-addition/listener/icon-abilities。
新カードは非MVP→実機「画面=文言」N/A、専用 vitest で代替 (BUG-132 教訓)。

### 残作業 (このセッション)

npm run docs → commit → main ff-merge → push → CI green。その後 cluster6 (B09034/P) 着手。

## cluster6 前提 (次工程)

M3 = 新 verb setEventUseBan + TurnScopedFlags.eventUseBanned (reset=mutate/flag.ts:68-71) +
handUseGateCommon/next-hint の event-only gate。**B09034「2枚まで」は forEach over:pick が実行時 throw**
(resolver.ts:122) / 素 handAddFromRemove は value[0] 1枚のみ → **handAddFromRemove に複数pick path
($pick.cardIds、charStackCard 同型) を additive 追加が前提**。設計→実装→専用テスト。

## ポインタ

- 設計記録: `.claude/specs/engine-wave2-cluster5-usage-restriction-design.md`
- triage/設計レビュー出力: `.tmp/cluster4-triage.json` (usage-restriction gate 評価) / workflow run wf_8e2bf639-f25
- 繰越 (DEFERRED-INDEX): B07025 / B08066 leave:remove-area gap / cluster3 reasoning-refresh・BUG-143/144・U1/U2
