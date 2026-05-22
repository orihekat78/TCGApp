# user_request に対する公式裁定 Q&A note (index)

ユーザーから提示された不具合・要望のうち、**公式ルールマニュアル / 公式 Q&A
で「現実装が正しい」と裁定されている** ものをここに記録する。

将来同じ質問が来たときは、本ファイルを参照して即答可能とする。

## 出典

- 公式マニュアル: `rule_manual.pdf` Ver 2.4 全 27p
  (https://www.takaratomy.co.jp/products/conan-cardgame/pdf/rule/rule_manual.pdf)
- 公式 Q&A: https://conan-tcg.commmune.com/view/box?boxId=talk002
- `.claude/rules/` 抜粋ファイル (上記の二次表現)

## バッチ別 archive

| user_request | 内容 | リンク |
|---|---|---|
| 20260521_01 | #5 解決編自動移行 / #6/#14 ネクストヒント仕様 | [user-request-clarifications-20260521.md](user-request-clarifications-20260521.md) |
| 20260522_01 | #10 narrator hint / #13 NH 仕様再確認 (下記参照) | (本ファイル) |

---

## #10 (20260522_01) ActionsPanel narrator hint はランダムではなく state 駆動

### ユーザー指摘

> 下の固定で表示している「⑥ アクション を選択すると、攻撃元キャラ指定…」
> の文章はランダムで切り替わったりしている？

### 回答 (実装確認)

**ランダムではない**。`src/ui/components/Playmat.tsx:271-278` の
`narratorMessage` 算出ロジックで以下 4 つの state を判定して決定的に切替:

| 条件 | 表示 |
|---|---|
| `gameState.turn.player === 'opp'` | 「相手のターン処理中…」 |
| `pickerPhase.phase === 'picking'` | 「<purpose> の対象を選択してください。」 |
| `pickerPhase.phase === 'confirming'` | 「確認モーダルで実行/キャンセルを選んでください。」 |
| (上記いずれでもない = idle) | 「⑥ アクション を選択すると、攻撃元キャラ指定 → 相手のスリープ/スタン状態キャラに対しアクション対象を選べます。」 |

idle 表示は「アクション操作チュートリアル hint」として固定文を表示。
ランダム選択や rotation は一切ない。

「ヒント文を増やしたい」「ローテーションさせたい」場合は将来検討余地あり
(本ユーザー指摘では現状理解の確認のみで完了)。

---

## #13 (20260522_01) ネクストヒント仕様の再確認

### ユーザー指摘

> ネクストヒントはFILEから1枚引いて、手札から追加で1枚使用できるという理解で
> 合っている?

### 回答 (公式裁定通り)

**ユーザー理解は公式ルール通り**。`.claude/rules/12-next-hint.md` および
公式マニュアル p.16 にて:

1. 自分の **FILE エリア最上部 1 枚を手札に加える** (アシスト中パートナーを除く)
2. その直後、**FILE 枚数以下のレベルのキャラ / イベントカードを 1 枚使用可能**
   - 手順 1 で得たカードも使用可能
   - 使用しない選択も可能
3. 使用カードは **事件の色制限を受ける**

実装も同様 (`src/engine/flow/main/next-hint.ts`): step 1 = FILE→手札、
step 2 = hand-use 経路で 1 枚使用 (任意、`nextHintUsed = true` を set)。

詳細な NH 制約 (NH したターンの通常 hand-use 不可など) は
[user-request-clarifications-20260521.md](user-request-clarifications-20260521.md)
の #6/#14 を参照。

---

## 補足: 今後の運用

- ユーザー指摘が公式ルールと矛盾する場合、`.claude/rules/` 抜粋だけで判断
  せず、必ず公式 PDF / Q&A を直接フェッチして原文引用で裁定を確認すること
- 確認結果は本ファイル or バッチ別 archive に追記
- 関連 feedback memory: `feedback_rule_rebuttal_pattern`
