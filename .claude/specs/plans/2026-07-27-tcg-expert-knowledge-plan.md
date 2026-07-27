# 汎用TCG熟練判断: 実装計画

## 目的

合法手の選択器ではなく、公開情報から勝敗時計、資源、盤面、情報、次ターン危険を
比較し、根拠と反証を残せる人間/AI共通の判断法を作る。

## 成果物

1. 一次資料と参考を分けるsource register。
2. 汎用decision kernel、短時間チェックリスト、理由ログ形式。
3. AI用の公開情報ポリシー。対局中の自己学習と非公開アクセスを禁止する。
4. Obsidian/Claudianの同期契約。repoが正本、Vaultは派生物。
5. Conan用アダプタ、公開UI対応表、過去公開ログへの適用例。

## 調査・実装順

1. 公式ルールで勝利条件、優先権/反応、資源、隠匿情報を確認する。
2. Magic/Pokemon/Flesh and Bloodの一次資料を比較し、共通原則とゲーム固有規則を分離する。
3. PTCG-Bench等のAI評価研究は評価器設計の参考に限定する。
4. 各主張に source ID、情報モード、反証条件を付ける。
5. Conanでは `.claude/rules/INDEX.md` から原典へ進み、カード本文に照合する。

## 安全境界

- 研究記事はルール根拠・勝率証明にしない。
- UI候補はルール根拠の代替ではない。矛盾は `blocked-ui-rule-mismatch`。
- 見えていないカード、内部state、dispatch、pending、裏向きカード識別を使わない。
- 既存55組の範囲・並び・評価目的は変更しない。

## 完了基準

- 汎用フレームがsource ID、情報mode、反証条件付きで複数代替を説明できる。
- Conanアダプタが勝敗時計、証拠、名乗り、相棒、手札、Next Hint、対象、任意、cut-inを扱う。
- `validation-protocol.md`を満たし、ルール誤り、hidden使用、事後合理化が0。
- 実行packetはcommitted registryと実sourceを照合し、行範囲/本文/hashを固定する。
- dirty tree、版不一致、未解決要件、未登録sourceでは生成を拒む。

現状はbaseline。source coverageと局面検証が未完了のため、熟練者相当は **UNPROVEN**。
