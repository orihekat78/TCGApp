# AUDIT 2026-06-04 — ルール準拠監査 (本セッション全変更 × rules/01〜30)

対象変更: switch-on-effect-enter (Task1) / effective-value filter (Task2) / review hardening #1〜6 /
BUG-106〜110 (AI reanimate・$entered bind・choiceIndex・AI drain 疾風/buff・AP/LP 表示)。
手法: rules/01〜30 を 1 件ずつ開き、該当変更の反映/整合を確認 (CLAUDE.md ルール網羅性チェック)。

## 該当ルール × 検証結果

| rules | 観点 | 判定 |
|---|---|---|
| 03 場/状態 (現場5枚) | switch 登場で現場は 5 枚維持 (switchEnter=除去+登場) | ✓ 実機/test 確認 |
| 06 名乗り | 効果登場 (reanimate/switch) は名乗り状態 (named ?? true) | ✓ |
| 07-08 アクション/コンタクト | コンタクト AP 判定は apSnapshot (rules/22) で、matchOneFilter とは独立 → effective-value 変更の影響なし | ✓ 独立確認 |
| 11 推理 LP≤0 | 推理の LP は read.char.lp (有効値、元から) 参照。filter 変更と無関係 | ✓ 不変 |
| 13 キーワード 疾風 | 疾風 AP-1000 (D11014 a1) が AI でも発火 (BUG-109 drain) | ✓ |
| 15 効果解決/「〜まで」=0OK | reanimate「1枚まで」= switch 辞退 (0枚) 合法 / choice 択一 / 数値条件は有効値判定 | ✓ |
| 16 セット/重ねる | switchEnter の removeToRemove は setCards→remove / stackedCards→back-card を処理 | ✓ scene.ts 確認 |
| 17 アイコン 【疾風N】 | enterOrderEquals で N番目登場判定。【ターン①】off-board は BUG-112 (deferred) | ✓ / ⚠ defer |
| 18 MR | MVP デッキ (CT-D08/D11) に MR カード **0 枚** → 本変更の MR 相互作用なし | n/a (out of scope) |
| 19 AP/LP 下限なし・有効値 | 数値フィルタを有効値判定に修正 (Task2)。AP/LP 表示も有効値 (BUG-110) | ✓ |
| 20 色/スイッチ | 現場満杯時のみ switch / 退場キャラに条件なし (全 char 選択可) / 効果登場は色制限なし | ✓ rules §スイッチ準拠 |
| 21 宣言能力コスト | D11012 selfToDeckBottom コスト先払い→効果 (BUG-108 救済) | ✓ |
| 22 AP 参照タイミング | コンタクトは発生時点 snapshot / 効果の数値条件は解決時点の有効値 (Task2) | ✓ |
| 25 効果解決順 | pick→continuation の bind 共有 ($entered, BUG-107)。FIFO desync は BUG-111 (latent, deferred) | ✓ / ⚠ defer |

## out of scope (本変更が触れないルール)

01 勝利条件 / 02 デッキ構築 / 04 準備 / 05 ターン進行 / 09 カットイン変装 / 10 アクション[事件] /
12 ネクストヒント / 14 リフレッシュ / 23 Q&A変装 / 24 Q&A名乗りスタン / 26 Q&Aリフレッシュ /
27 制限 / 28 エラッタ / 29-30 フロアルール — いずれも本セッション変更と無関係 (out of scope)。

## 結論

本セッションの全変更は rules/01〜30 と矛盾なし。switch-on-effect-enter と effective-value filter は
それぞれ rules/20・rules/15,19,22 を正しく反映。**未解決の latent 項目**は別 BUG として管理:
BUG-111 (pick↔cont desync) / BUG-112 (off-board declared limit) / BUG-113 (filter の continuousDelta 残差) —
いずれも現 MVP プレイに影響なし (再現条件が成立しない / 該当カード稀)。
