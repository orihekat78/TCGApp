# 次セッション再開プロンプト (2026-06-15 BUG-145 self-sleep gate 完了時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (certify / 意味等価突合 / 敵対設計レビュー) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ✅ **push 済**: 本セッション② は branch→main ff-merge→push 済 (`876492d5`)。origin/main は session① の 6 commit +
> BUG-145 の計 7 commit 先行状態を解消し同期済。次セッション開始時は `git log origin/main..main` が空であることを確認。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-15)

- engine拡張 wave#2 cluster1〜8 ✅ + BUG-145 self-state micro-cluster ✅。ALL_CARDS = 1166。origin/main 同期済 (`876492d5`)。
- 本セッション② = BUG-145: self-sleep optional gate。`charStateIs{ref,state}` 条件追加 (engine 4点同期) +
  11能力に `condition: not{charStateIs(self,sleep)}` AND マージ (PR138/PR144/B04049/B09058/B09058P/B09057/
  B08058/B08058P enter, B06102/B09065 turn-end, B09013 a2)。gate は ability.condition (effect 側 conditional は
  optional prompt を surface させるため不可)。**sleep のみ gate** (自スタン PR157/PR163 は already-sleep でも可=公式非対称)。
  専用 test 35件。敵対 verify (opus×14): 11能力 全 CORRECT / 除外 13枚 MISS 0。
- 全 gate green: full vitest **2148** / smoke:1000 = baseline 不変 (winsA=498) / playwright 119 / validate-specs 73-0。

## 次にやること (候補、未確定 — ユーザーと相談 or triage から選定)

- **cluster3 DEFER 群の self-state 解禁余地を再評価** (新規!): `charStateIs{ref,state}` が出来たので、
  DEFERRED-INDEX で「self/source の状態を見たい」が理由で DEFER したカードが解禁可能か棚卸し。
  charStateIs は ref:TargetingRef で pick/all も取れる (apAtLeast 同流儀) → 他キャラ状態 gate も可能。
- B07005 action-restriction「アクションできない」(self 行動禁止 + コンタクト中カットイン禁止、2 gate、新 engine 機構)。
- observer contact-removal attribution (D02008 a2 / B05066、byUid 帰属トリガ)。
- B08078 外部 hook 発火 (最難、cluster2 DEFER)。
- needsManual 5件 (B06101/B07052/B08020系/B09008/D10011、closure 要) の手実装 (taskA queue 254/254 完走済)。

## プロセス必須
- /card-wave skill。green候補は未certify なら信用しない。**certify green でも意味等価は自前で1対1突合** (PR138/B01011 教訓)。
- **bug doc 1枚でも同構造を機械抽出して水平展開** (BUG-145 は 1→11 に拡大)。
- **状態 gate は ability.condition で** (effect 側 conditional ラップは resolveEffectPicks が両枝 walk → prompt surface)。
- 新 engine 機構は **playwright まで回す**。新挙動は専用 vitest で実証 (制御 case 込)。heavy gates はフェーズ終端。

## 状態 doc
- bug: .claude/bugs/index.base (BUG-143/144/145 修正済) / defer: .claude/specs/DEFERRED-INDEX.md (self-state cluster ✅)
- BUG-145 詳細: .claude/bugs/BUG-145.md / changelog-entries/2026-06-15-03 / session②: .claude/memory.md
```

本セッション② は BUG-145 self-sleep gate 完了 (11能力、charStateIs 追加、全 gate green、push 済)。
次セッションは origin 同期確認 → charStateIs を活かした self-state DEFER 棚卸し or 次クラスタ選定から。
