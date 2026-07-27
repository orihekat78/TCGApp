# Conan熟練メソッド: row 026再開計画

## 目的

row 026の前に、公開UIだけで説明可能な判断baselineを検証可能な手順にする。
プロ同等は未証明。再開はしない。

## 凍結パケット

packetには次を固定する。

- 実Git HEAD、生成時刻、row、rule baseline、許可操作。
- committed registryのsource ID、分類、版、相対path、行範囲、本文、SHA-256。
- validated rule/cardとreviewed policy。自己申告classificationは受け付けない。
- 情報mode=`public-ui-only`。dirty worktree、版不一致、未解決事項で生成拒否。

## row 026開始前Gate

全て必須。

1. 55組worklistが依然55の上三角組で、026が次のqueued行。
2. `validation-protocol.md`の8局面をex ante形式で満たし、誤り0。
3. 対象デッキと公開カード本文を再確認済み。未知は `unknown` と明記。
4. BUG-272--274のfocused検証・typecheck成功記録を再確認。
5. BUG-274 Escape取消を制御可能な実ブラウザで確認済み。代替証拠では置換不可。
6. Conan rule baselineの版不一致が解消済み。
7. packetがclean committed treeから生成され、registry照合、未解決0、hash再現可能。
8. `conan-verify` がこのdocs/script変更を確認済み。
9. ユーザーがrow 026再開を明示承認。

Gate未達なら、対局を始めず未達項目だけを記録する。新規ブラウザは接続停止が連続2回の時だけ。
再開時は必ず `#setup`。直接復旧、dispatch/state/pending、非公開情報を使わない。
