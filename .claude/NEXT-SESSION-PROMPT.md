# 次セッション再開プロンプト (2026-06-05 末時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

---

```
名探偵コナンTCG MVP の engine 拡張バッチを継続してください。

## 現在地

- リポジトリ: c:/Users/arumi/OneDrive/デスクトップ/conan
- 最新コミット: 169ca7e3 fix(lint): lint:side-channel に engine-internal queue allowlist 追加
- ALL_CARDS: 882 枚 (前回 859 → +23 枚)
- vitest: 1764 pass · 1 skip (回帰 0、BUG-077 のみ pre-existing flaky)
- e2e: 16/16 pass (engine-extensions-2026-06-05.spec.ts + reuse-cards-2026-06-05.spec.ts)
- pre-commit hook: 全 lint clean (SKIP 不要)

## 完了済 (本セッション 14 commit / 2026-06-05)

engine-extension-plan.md step 1〜5b 全達成 + lint 整備:

1. engine #1 leave:to-remove hook + 10 枚 (D03013/D04010/B03013/B03091/B03130/B04010/B06009/B08084/B08089/PR054)
2. engine #2 charModifyLevel verb + 2 枚 (B07103/P)
3. engine #3 multi-target Pattern A pick + 1 枚 (B02021)
4. engine #4 sceneToHand verb + 2 枚 (B06069/P)
5. engine #5a deckRevealUntil maxN + handAddFromDeck + 6 枚 (D01013 + 5 色違い)
6. engine #5b charSetCard fromDeckTop + PA短縮形 + 2 枚 (B08054, B02023)
7. lint:bug-frontmatter prefix match 化 + BUG-115 commit 反映
8. lint:side-channel engine-internal allowlist 追加
9. BUG-116 (declaredAbility cost silent skip) 登録 (DEFERRED)

## 推奨される次の動き

### 優先度 高
1. **BUG-116 推奨修正案 A**:
   useDeclaredAbility 内で `ability.cost && !ctx?.costPaid` を検出して warning log
   (e2e で declared dispatch 時に cost 漏れを早期検出可能に)

2. **1試合通し Playwright smoke**:
   CLAUDE.md 6.3 要件 (mulligan→勝敗決定まで通して操作 / console error 0)
   既存 e2e は ability 単発検証のみ、本来の「機能確認」未充足

### 優先度 中 (batch 拡充、engine 変更ゼロで進められる)
3. **leave:to-remove 残 79 枚** — 多くは draw/discard/sleep の単純パターン (engine#1 cards 参照)
4. **bounce 残 25 枚** — B06076 ジェイムズ・ブラック等 (sceneToHand verb 既存)
5. **level-modify 残 15 枚** — B05066 declared 等 (charModifyLevel verb 既存)
6. **set-card 残** — B02018/B02020/B02030 等 (charSetCard fromDeckTop + PA短縮形 既存)

### 優先度 低 (engine 拡張・高リスク)
7. continuous aura (他キャラ buff、~13 枚解禁) — AP/LP read 全体に波及
8. untargetable (~6 枚) — 全ターゲット処理に波及
9. partner ability rewrite (~10 枚)

## 重要な参照ファイル

- 拡張計画: `.claude/specs/engine-extension-plan.md`
- ゲート表: `.claude/specs/card-impl-engine-gates.md`
- DEFERRED 一覧: `.claude/specs/DEFERRED-INDEX.md`
- BUG 一覧: `.claude/bugs/index.base`
- 本セッション changelog: `.claude/changelog-entries/2026-06-05-03〜14`

## 注意事項 (本セッションで判明)

- **BUG-116 (latent)**: `useEngineDispatch.declaredAbility` は `action.cost && action.ctx`
  が揃わないと cost を silent skip。AI 経路と本番 UI は OK、e2e/直接 dispatch では cost フリー。
  → 上記「優先度 高 #1」で対処予定
- **BUG-077 flaky timeout**: D08013 a1 step 2 evidenceToHand の vitest 全 suite 実行時 timeout。
  isolated 実行は pass。原因は registerAll 初期化負荷と推測 (pre-existing、対処は別途)

最初に何をすべきかを宣言してから着手してください。
```
