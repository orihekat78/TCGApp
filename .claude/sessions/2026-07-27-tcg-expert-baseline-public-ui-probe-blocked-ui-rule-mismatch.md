# 熟練判断baseline blocked-ui-rule-mismatch

時点: P1 T2。公開UIはCPU佐藤美和子をsleep、YOU江戸川コナンpartnerをactiveと表示した。07-action-flow.mdではactive partnerのactionは可能で、対象は相手sleep/stun現場キャラ又は証拠1以上の相手事件である。

公開UIでアクションを選択するとsourceは江戸川コナンのみで、これは名乗り状態の元太Lv3を除外するルールと整合した。sourceを実クリック後、UIは「アクション対象を選択してください」と表示したが、佐藤美和子に選択表示はなく、公開カードを実クリックしても状態・ログ・盤面に差分はなかった。相手事件にも候補表示はない。

規則候補とUI候補が不一致のため、これ以上の操作をしない。分類は blocked-ui-rule-mismatch。行026には入れない。再開には、このpublic UI不一致の再現・原因修正・公開UI回帰が必要。
