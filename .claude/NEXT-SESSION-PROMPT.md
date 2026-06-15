# 次セッション再開プロンプト (2026-06-15 赤魔術 trait family 完了時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (certify / 意味等価突合 / 敵対設計レビュー) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ✅ **push 済**: 本セッション③ は branch→main ff-merge→push 済 (`ef29f608`)。次セッション開始時は
> `git log origin/main..main` が空であることを確認。CI green 前提。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-15)

- engine拡張 wave#2 cluster1〜8 ✅ + BUG-145 self-state ✅ + 赤魔術 trait family ✅。ALL_CARDS = 1171。origin 同期済 (`ef29f608`)。
- 本セッション③ = needsManual 5件 closure 調査 → 赤魔術 trait データ補完 + family 5枚実装:
  - **needsManual 5件は実態 stale**: B06101/B08020/B09008/D10011 は既出荷 (公式テキスト⇔DSL 1対1突合で意味等価確認)。
    5枚目 B07052 は「赤魔術 がデータに無い」という誤認で data-gate defer されていた。
  - **真因**: cards-data TSV 抽出が event/case の `category1/2/3`(=特徴) を全件 drop (一次 API `_raw` の category が正本)。
  - per-card 補完: B07062/P caseTraits:[まじっく快斗,赤魔術] / B07055/P・B07058/P traits:[赤魔術]。
  - 解禁5枚: B07052 (caseTrait突撃+reveal-until赤魔術+shuffle) / B07055/P (forced-2 set除去+bonus) / B07058/P (reanimate chain)。
  - **engine 契約発見**: PA短縮形 pick の強制ちょうどN枚=`n:N`(number)。`n:{min,max}`(object)は無音0枚 (test実証)。
- 全 gate green: validate-specs 73-0 (engine変更0) / full vitest **2160** (+12) / smoke winsA=498 baseline不変 / playwright 119。

## 次にやること (候補、未確定 — ユーザーと相談 or triage から選定)

- **TSV category-drop の systemic fix** (新規・本セッション発見): event/case の category→traits/caseTraits を TSV gen 側で
  carry する。赤魔術 以外の【事件(特徴)】条件・event-trait filter も同 field-drop で latent no-op の可能性 (要広域確認、
  全 event/case def に影響 → smoke/挙動の回帰確認が要る)。詳細: DEFERRED-INDEX「赤魔術 family known-gap」。
- **赤魔術 family 残** (【事件赤魔術】族): 小泉紅子 B07031/B07034・中森銀三 B07047・紅子の執事 B07038・PR231。
  caseTrait gate は実装済なので解禁余地あり (セットカード reanimate 等の engine-gate は要 certify)。
- B07005 action-restriction「アクションできない」(self 行動禁止 + コンタクト中カットイン禁止、2 gate、新 engine 機構)。
- observer contact-removal attribution (D02008 a2 / B05066、byUid 帰属トリガ)。
- B08078 外部 hook 発火 (最難、cluster2 DEFER)。

## プロセス必須
- /card-wave skill。green候補は未certify なら信用しない。**certify green でも意味等価は自前で1対1突合** (PR138/B01011 教訓)。
- **stale な「データに無い」結論は一次ソース (API category) で再検証** (本セッションの赤魔術 教訓)。
- **新 verb 契約は型が通っても挙動保証なし → 専用 test で実証** (n:N vs n:{min,max} の forced-N が好例)。
- 非MVPカードは playwright 不可達 = behavioral vitest が実機検証の正 (runEffect + _drainAllEffectPicksForTest)。
- 状態 gate は ability.condition。heavy gates はフェーズ終端。

## 状態 doc
- bug: .claude/bugs/index.base / defer: .claude/specs/DEFERRED-INDEX.md (B07052 ✅解決 + 赤魔術 known-gap 追記)
- 詳細: changelog-entries/2026-06-15-04 / session③: .claude/sessions/2026-06-15.md / memory.md
```

本セッション③ は 赤魔術 trait データ補完 + family 5枚 (B07052/B07055P/B07058P) 完了 (push 済)。
次セッションは origin 同期確認 → TSV category-drop systemic fix or 赤魔術 family残 or 次クラスタ選定から。
