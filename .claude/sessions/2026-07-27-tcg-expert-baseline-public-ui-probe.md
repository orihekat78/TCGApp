# 熟練判断baseline: 公開UIプローブ

目的: 行026のworklist外で、公開UIのみを使い、結果を見る前に判断を固定する。
行026とrows 001--025の結果・worklistは変更しない。

## 固定条件

- 開始: `#setup`、P1=少年探偵団・標準、CPU=警察・標準、P1先攻。
- 情報: `shared-public`、自手札のみ`player-visible`、相手の裏向き札は`hidden-range`。
- 許可操作: visible click/key/read/scroll/screenshot と public navigation のみ。
- 記録対象: clock 4、Next Hint/resource 2、独立選択 2、unknown-ui 1以上。
- 各行は操作前に source・候補3つ・反証条件を追記し、操作後に公開差分だけを追記する。

## 判断ログ

| # | 操作前の公開局面・mode | 候補3つ・根拠 | 選択・反証 | 操作後の公開差分 |
|---|---|---|---|---|
| 1 | Mulligan。`player-visible`: 光彦No.0496/0493、イベント3枚。`shared-public`: P1先攻、双方0証拠。 | A keep: 既知5枚を維持。B No.0496のみ戻す: 同名でない札を1枚交換。C 全戻し: 既知の組合せを捨てて5枚交換。根拠`04-game-setup.md`。 | B。No.0493を残し、役割不明なNo.0496だけを1枚交換する。反証: 交換後が直近turnに使えない札だけならAが優位。 | public UI: No.0496を戻し、6枚目は歩美Lv2。 |
| 2 | P1 T1 main。`shared-public`: YOU 0/7、CPU 0/6、FILE1、双方partner active。`player-visible`: hand全6枚はFILE不足で通常使用不可。 | A partner推理:+1証拠、partner sleep。B Next Hint: FILE1を失い、手札1枚の任意使用を得る。C end: active partnerを残す。根拠`CONAN-REASONING`,`CONAN-NEXT-HINT`,`CONAN-TURNS`。 | A。確定+1が唯一の証拠進行で、Next HintはFILE0化し使用可能札も未確定。反証: UIが推理後0証拠、又はNext Hintで即使用可能かつより大きい即時差分を表示。 | public UI: YOU 1/7、partner sleep、FILE1、手札6枚。予測どおり。次優先度: FILEを増やすかturnを渡す。 |
| 3 | P1 T1 main（推理後）。`shared-public`: YOU 1/7、CPU 0/6、FILE1、partner sleep。`player-visible`: 6枚すべて通常使用不可。 | A Next Hint: FILE1を0にし、手札1枚を任意使用。B end: FILE1を維持し、CPUへ渡す。C 手札使用: UIが全件使用不可のため合法でない。根拠`CONAN-NEXT-HINT`,`CONAN-TURNS`。 | A。通常使用不能の手札から任意の1枚を公開UIで選べる資源転換を検査する。反証: UIが任意使用を提示しない、又はFILE以外の不整合を表示。 | public UI: FILE0、手札7枚選択画面。新規の灰原哀Lv7を含め全7枚がレベル/色制限で使用不可。資源転換は表示されたが即時使用札なし。次優先度: 使用しないか、選択肢表示とルールの不一致を確認。 |
| 4 | Next Hintの任意使用画面。`player-visible`: 7枚は全件使用不可、UIには「使用しない」「キャンセル」。 | A 使用しない: Next Hintを完結し、turnへ戻る。B キャンセル: Next Hint開始前へ戻る可能性。C 不可カードを選ぶ: UI上合法候補でない。根拠`CONAN-NEXT-HINT`、画面の明示状態。 | A。選べる合法カードが0枚のため、公開UIのskipを選ぶ。反証: skip後も操作不能、又はhand/FILEが公開UIと矛盾。 | public UI: hand7枚のまま、FILE0、Next Hint使用済、ターン終了が再度有効。整合。次優先度: CPUへ渡す。 |
| 5 | P1 T1終了前。`shared-public`: YOU 1/7、CPU 0/6、YOU FILE0、partner sleep。`player-visible`: Next Hint使用済、手札使用不可。 | A end: CPUへ渡す。B 画面上の残る手札を再試行: 明示的に使用不可。C 推理: partner sleepで不可。根拠`CONAN-TURNS`、公開UIの操作状態。 | A。自分の合法な証拠進行は残らない。反証: end後にターン/active復帰または証拠表示が不整合。 | public UI: P1 T2へ遷移。YOU FILE2・hand8・partner active、CPUは証拠1/6・FILE2・佐藤美和子1体・partner sleep。公開差分はturn進行と整合。次優先度: Lv2の使用または推理。 |
| 6 | P1 T2 main。`shared-public`: YOU 1/7、CPU 1/6（佐藤美和子1000/AP1/LP2）、YOU FILE2。`player-visible`: 吉田歩美Lv2/1000/AP1/LP2が使用可能、他7枚はFILE不足。 | A 歩美を使用: 1000の現場キャラを得る。B partner推理: +1証拠、partner sleep。C Next Hint: FILE2を1にし、任意使用を試す。根拠`CONAN-HAND-USE`,`CONAN-REASONING`,`CONAN-NEXT-HINT`、公開UIのレベル制限。 | A。今後のアクション候補を増やし、相手の現場1体への圧力を作る。反証: 使用後のUIが記載のAP/LPと矛盾、又は不明な必須選択で止まる。 | public UI: 歩美が現場へ登場（1000/AP1/LP2）、hand8→7、使用済。予測どおり。次優先度: 相手sleepキャラへのアクションか推理。 |
| 7 | P1 T2 main（歩美登場後）。`shared-public`: YOU 1/7、CPU 1/6、双方に現場キャラ1体。自歩美はactiveだが公開表示「名」、相手佐藤美和子sleep。 | A アクション: 合法sourceから相手佐藤美和子を対象に選ぶ。B 推理: +1証拠、partner sleep。C end: 現場を保持してCPUへ渡す。根拠`CONAN-ACTION`,`CONAN-TURNS`、公開UIのactive/sleep表示。 | A。source候補を公開UIとルールで照合する。反証: 名乗り状態の歩美が候補化、又はactive partnerが候補化されない。 | public UIはpartnerのみを候補表示。後続の`07-action-flow.md`照合で、名乗り状態キャラは迅速/突撃例外なしにアクション不可と確認。歩美の非候補は整合し、`blocked-ui-rule-mismatch`を撤回。プローブはtab終了のため、次matchで継続。 |
| 8 | 継続match P1 mulligan。`player-visible`: 阿笠博士0497、元太0492/0495、光彦0493、灰原0490。`shared-public`: P1先攻。 | A keep: 5枚を維持。B 0497のみ戻す: 同名でない札1枚を交換。C 全戻し: 既知5枚をすべて交換。根拠`04-game-setup.md`。 | B。0493を残し、直近使用可否が不明な0497だけを交換して選択肢を増やす。反証: 交換札が即時に使えず、0497がFILE到達後に明確な進行を持つ。 | public UI: 蘭の一撃Lv5を得た。FILE1では6枚すべて使用不可。次優先度: partner推理。 |
| 9 | 継続match P1 T1 main。`shared-public`: YOU 0/7、CPU 0/6、双方FILE1、partner active。`player-visible`: hand6枚は全て通常使用不可。 | A partner推理: LP1で+1証拠、partner sleep。B Next Hint: FILE1→0、手札1枚の任意使用を試す。C end: partner activeを維持。根拠`CONAN-REASONING`,`CONAN-NEXT-HINT`,`CONAN-TURNS`。 | A。確定の証拠進行を取り、直後のCPUの証拠レースを観察する。反証: UIが推理後にYOU 1/7を表示しない。 | public UI: YOU 1/7、partner sleep、FILE1。予測どおり。次優先度: turnを渡す。 |
| 10 | 継続match P1 T1終了前。`shared-public`: YOU 1/7、CPU 0/6、FILE1、partner sleep。`player-visible`: hand6枚は使用不可。 | A end: CPUへ渡す。B Next Hint: FILE1→0で任意使用を試す。C 手札使用: 全件不可能。根拠`CONAN-TURNS`,`CONAN-NEXT-HINT`。 | A。FILEを維持して次turnの使用可能札を増やす。反証: CPU応答後にFILE/turn表示が整合しない。 | public UI: P1 T2。YOU FILE3/hand7/partner active、CPU 証拠1/6・FILE2・佐藤美和子1体/sleep。差分はturn進行と整合。 |
| 11 | P1 T2 main。`shared-public`: YOU 1/7、CPU 1/6、CPU佐藤美和子sleep。`player-visible`: 元太Lv3と光彦Lv2が使用可能、他5枚はFILE不足。 | A 元太Lv3を使用: 追加の現場戦力。B 光彦Lv2を使用: より低costの現場戦力。C partner推理: +1証拠、partner sleep。根拠`CONAN-HAND-USE`,`CONAN-REASONING`、公開UIのレベル制限。 | A。公開AP/LPは使用前に確定不能だが、Lv3で次turnのアクション圧力を増やす。反証: 登場後に未知の必須選択、又は表示AP/LPが使用画面の情報と矛盾。 | pending |
