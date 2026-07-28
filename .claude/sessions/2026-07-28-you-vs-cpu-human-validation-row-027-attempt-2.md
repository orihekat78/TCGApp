# Row 027 attempt 2 -- public UI in progress

- Pair: YOU `deck-1784115364915` (green aggro) vs CPU
  `deck-1785077473170` (soccer), desktop P1. Started from visible `#setup`;
  no direct match recovery, dispatch, injection, pending/state read, or
  face-down identity inspection.
- Mulligan: returned public No.0427 event, Heiji No.0974, and Kazuha No.0860;
  retained the two lower-card-number early bodies. Reason: seek a legal
  T1--T2 development. Resulting public hand has no legal character at FILE 1;
  only `御守り` Lv1 is usable.

## Restart point

- Status: `in-progress`. Current public UI is YOUR T2 MAIN: FILE 3, evidence
  0/7 vs CPU 1/6, YOU scene empty, CPU scene has 上村直樹 AP1000/LP1, hand
  seven, action candidates 0, no modal. Next: end turn and re-check every CPU
  transition. Existing row-027 attempt-1 is preserved.

## T1--T2 log

- T1: FILE1で手札キャラは全てレベルまたは色制限により不可。即時に御守りも無かったため通常終了。代替は無効カードの試行であり採用せず。
- CPU T1: 公開盤面で証拠1/6、FILE2、上村直樹（AP1000/LP1）をsceneへ登場。相棒の江戸川コナンはsleep。
- T2: FILE3でも登場可能キャラなし。御守りを使用し、公開された服部平次 No.0861（B08021P）とNo.0106二枚からNo.0106を選択。早期展開を狙った判断だが、手札表示はLv7/AP6000/LP1で、登場候補は全てレベル・色制限により不可となった。
- T2解決: 残りはB08021Pを上、D02003を下へ置き、UI強制選択の`登場しない`を選択。代替B08021Pは公開詳細が画像コードのみでレベル・能力値の可読テキストなし。効果は正常解決、場は空、手札7、use済み。
- UI所見: 御守りの選択モーダルでは公開カード詳細にコード画像のみが出て、レベル・能力値・効果本文をアクセシブルに確認できない。

## T3--T5 and result

- T3: FILE5でLv5/AP4000平次を登場。CPUは証拠3/6、上村直樹1000と灰原哀4000。公開操作パネルは行動候補`待機中`で、場の平次選択にも状態変化なし。代替の無根拠な追加使用はせず終了。
- CPU T3--T4: CPUは公開盤面で証拠5/6、上村直樹・灰原哀・比護隆佑AP6000を展開し、解決編へ。CPUカード効果の公開強制処理で手札1枚リムーブを要求されたため、既使用かつ低影響の御守りを選択。
- T4: FILE7でLv7/AP6000突撃平次を追加。こちらの盤面選択後も行動候補は`待機中`のまま。相手の公開証拠は7/6へ到達。
- T5: FILE9でLv8/AP7000和葉を追加。和葉の公開4枚から唯一の条件対象「平次の洞察力」を選択。公開デッキからの選択後に強制リムーブとなり、`使用不可`表示の「後ろの女に一言遺したろ思てなァ…」を選択。残るヘビ男2枚と平次は既定順でデッキ下へ送った。
- Outcome: `DEFEAT`、理由`必要証拠数達成`。YOU P1敗北、証拠0/7。CPU P2勝利、証拠7/6。ターン数10。CPU MVPは比護隆佑B10013、貢献AP6000。
- 使用カード・能力: 御守り、Lv5平次AP4000、Lv7突撃平次（和葉登場後AP8000表示）、Lv8和葉AP7000、和葉の公開4枚選択、平次の洞察力。確認可能な公開能力は突撃。CPU側は公開された小さくなった名探偵、どこでもボール射出ベルト、比護隆佑を確認。
- UI所見: CPU証拠が必要数を超えても、結果は即時でなく次の通常終了後に表示された。行動候補は盤面に3体いても一貫して`待機中`で、場カード選択による攻撃開始の公開フィードバックは無かった。規則不一致とは断定しない。

## Completion

- Status: `clean-public-seed-unverifiable`。公開UIのみで正常完走。seedは公開UIから再現・検証不能。次はrow 028を可視`#setup`から開始する。
- Verification: 結果画面後のbrowser console errorは0件、`git diff --check`通過。`npm run tcg:packet:build`はdirty worktree保護でexit 1（既存・進行中の行記録を保持するため未解消）。
