# 次セッション再開プロンプト (2026-06-18 セッション㉑ 完了 — cluster15 follow-up 8枚 出荷、ALL_CARDS 1350)

> モデル方針: `claude-fable-5` が agent で利用不可のため、本体も難判断も **opus を最初から**。難判断 agent
> (certify / 意味等価突合 / 敵対反証 / gate5) は `model:'opus'` 明示。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔化、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-18、main=セッション㉑ commit b4796552、ALL_CARDS=1350、CI green)

セッション㉑で cluster15 (contact-removal-observer 反撃一族) の keyword-grant closure DEFER 群を
**4 rep / 8 printings 出荷** (branch cards/wave2-cluster15-partnercolor → main ff-merge)。
- B06038 鬼丸猛(緑)+P / B06039 沖田総司(緑)+P / B08010 真田貴大(青) / B09071 萩原千速(黄)+P+P2。
- keyword-grant closure = partnerColorKeyword __shared (3 rep) / B08010 のみ【絆比護隆佑】inline bond grant (B08012 鏡像)。
- removal-observer は bare removedCharMatches{opp,contact-ap,self} (cluster16 萩原で既出荷の同条件、effect は
  draw/discard/sleep のみ = cascade 懸念なし)。
- gate5 tests/cards/cluster15-followup-removal-observer.test.ts 10 pass (end-to-end contact gating decoy + effect/grant 1対1)。
  全ゲート green (tsc0/vitest 5232/smoke winsA=498不変/engine変更0)。詳細は memory.md セッション㉑。

## ★最優先候補 (いずれか、ユーザー選択)

1. **次 engine クラスタ / トリアージ出荷バッチ#5**: スイープ正本 .claude/specs/triage-sweep-2026-06-15.md
   (gate ラベルは過剰グルーピング、密度は実テキスト決定論分類で必ず検証)。

2. **B04004 (絆 reactive over-fire DSL fix)**: cluster15 DEFER 残。a3 が actor-gate 欠落で over-fire →
   正解 `and[triggerCharMatches{side:opp,filter:{}}, …]` で再 author 要 (refuted=DSL fix)。再 certify してから出荷。

3. **B09016 (円谷光彦・別版)**: cluster16 残の yellow (engine gate)。「ミスリードしたとき」反応 trigger が
   card-triggerable hook に無く engine 変更必須 → 着手は engine 拡張判断を要する。

## プロセス必須 (card-wave skill + 教訓)
- **手 author は exemplar の diff を取り leaf literal 差替のみ**を確認。**group ラベルでなく TSV 実テキストで条件 kind を決める**
  (㉑: B08010 は群ラベル上 partnerColorKeyword だが実は【絆】gated = 別 inline bond closure)。
- **certify auto-spec を信用しすぎない**: ⑲ PR280 auto-spec は engine 非実在 `triggerCondition` で over-fire (verify 透過)。
- **filter/condition は DSL に書いても engine 実評価の保証なし** (BUG-117/118)。gate5 は decoy を outcome で 1対1 検証。
  removal-observer は end-to-end contact (declare→passGuard→snapshotAP→judge) で発火 + cause/by/side decoy で gating 証明。
- `canDeclaredAbility` は cost.canPay を gate しない (存在/limit/condition のみ)。sleep cost gate は `engine.cost.canPay`。
- ヒラメキ effect は明示 $pick+pick query 保持 (短縮形だと auto-resolve されない)。非 hirameki triggered の sleep は短縮形でよい。
- certify/難判断/gate5 agent は model:'opus'。⚠ Workflow 並列は SUB 控えめ・1 workflow ずつ (rate-limit 回避)。
- 出荷後ゲート: tsc / vitest (baseline 減なし) / smoke baseline 不変 / gate5 / lint。非MVPは playwright 不可→gate5 vitest 代替。CI で回帰確認。
- ⚠ commit は Bash heredoc。1 タスク=1 commit。smoke レポート・.gitignore(.superpowers/) は明示 add から除外。
- pre-commit docs:check が未再生成でブロック → npm run docs で同期 (--no-verify 禁止)。
- Read hook がファイルを line1 で切る → Bash cat / Edit 前に Read 1 回で登録。

## 状態 doc
- defer: .claude/specs/DEFERRED-INDEX.md (cluster15 keyword-grant 群 = ✅出荷済。残 B04004 / B09016)
- certify 正本: .tmp/certify/ (durable) + .tmp/taskA/certify-brief.md
- cluster15 spec: .claude/specs/engine-cluster15-contact-removal-observer-design.md
- 詳細: memory.md セッション㉑
```

セッション㉑は cluster15 follow-up 8枚を出荷 (ALL_CARDS 1350、CI green)。**次は上記候補から1つ着手。** `/clear` 推奨。
