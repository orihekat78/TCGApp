# 次セッション再開プロンプト (2026-06-15 cluster11 出荷 / BUG-146 修正済 時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (certify / 意味等価突合 / 敵対設計レビュー) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ⚠️ **push 確認**: cluster11 (`1c62d5f8`) + 本 docs commit が push 済か次セッション開始時に
> `git log origin/main..main` が空であることを確認すること。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-15、engine拡張 wave#2 cluster11 出荷 / BUG-146 修正済)

- engine拡張 wave#2 cluster1〜9 + **cluster11** ✅ + BUG-145 ✅ + BUG-146 ✅ + 赤魔術 family ✅。ALL_CARDS = 1181。
  cluster10 (loseGame) は DEFER 継続。origin 同期確認 (`git log origin/main..main` 空)。
- **直近セッション = cluster11 (enter-source-level filter) を BUG-146 と coupled で出荷** (`1c62d5f8`):
  - **BUG-146 修正** (engine correctness): atom-handlers sceneEnter:768/sceneSwitch:794 の enter emit source を
    ctx.source(原因カード)→**登場キャラ**に統一 + 原因カードを payload.sourceCardId へ additive 移送。
    効果/能力登場キャラの【登場時】/【疾風】が発火 (旧:永久不発) + 原因カードの誤発火 (旧:28枚) 解消。
  - **新 condition enterSource** (4点同期) + **解禁4枚** B01014/B01015/B01021 (or[char≥3,event≥3] viaEffect) +
    B07019 (解決編+緑event+BUG-145 self-sleep gate)。
  - opus 7-agent wf (4 certify + 3-lens 敵対設計レビュー) = 全 GO-with-fixes / 0 BLOCK。
    全 gate green: tsc0 / vitest 2197 / smoke baseline **不動** (winsA498/avg11.00→10.998/0例外) / playwright 119 / CI lint 全errors0。
  - 回帰 2 test (look-top-n-enterSleep / leave-reanimate PR155) を正挙動に更新 + cluster11-enter-source.test.ts 16本。

## 次にやること (候補、ユーザーと相談 or triage から選定)

- **backlog の別 engine gate** (DEFERRED-INDEX landscape の残 gate、いずれも needs-design):
  - name-designation (11枚=最大カード歩留まり、宣言 UI surface + designated-name 比較 condition が必要)
  - multi-card sceneEnter (6枚、「2枚まで選び登場」= sceneEnter cardIds multi 契約)
  - その他 (partner-area 構造 / aura family 等)。triage workflow で ready-now を再選定
    (cluster9/10/11 の教訓: 未精読 gate の low-risk は信用せず per-card certify/diag で実証)。
- **低 urgency engine bug 群**: reasoning 由来 refresh (BUG-142 水平展開) 等は DEFERRED-INDEX cluster3 既知ギャップ参照。

## プロセス必須
- /card-wave skill。green候補は未certify なら信用しない。engine 変更は骨格凍結例外手続き (rule/bug 根拠) +
  敵対設計レビュー (opus 3-lens) + 全 gate (full vitest / smoke 再 bless / playwright / CI lint 8本)。
- 高リスク広域 emit/hook 変更時は **consumer を決定論 grep で全列挙** してから着手 (cluster11 の水平展開収束法)。
  certify を実装前に走らせると encoding の構造誤り (chain/cost-vs-atom/条件束縛) を先取り捕捉できる。
- 非MVP カードは behavioral vitest が実機検証の正 (enter hook 経由 test も書く = BUG-146 教訓)。
- 1 gate = 1 独立コミット。docs commit は **`.tmp` を消してから** `npm run docs` → `git add -A` → commit
  (structure.md が working-dir のファイルを拾うため、docs 生成前に temp を消すこと = 本セッションの教訓)。

## 状態 doc
- bug: .claude/bugs/index.base (**BUG-146 修正済 1c62d5f8**)
- defer: .claude/specs/DEFERRED-INDEX.md (cluster11 ✅ 節 + 残 landscape gate)
- 詳細: changelog-entries/2026-06-15-07 / session: .claude/memory.md セッション⑥ + sessions/2026-06-15*.md
```

直近セッションは cluster11 + BUG-146 coupled 出荷 (`1c62d5f8` + 本 docs commit)。
次セッションは origin 同期確認 → triage で次 gate 選定から。`/clear` で新セッション推奨。
