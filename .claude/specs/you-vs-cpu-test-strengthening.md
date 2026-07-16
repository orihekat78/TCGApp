# YOU vs CPU テスト強化方針

## 背景

2026-07-15のMeta UI実操作で、既存Vitest・AI vs AI smoke・限定E2Eを通過したBUG-205〜219が露出した。主因はテスト数ではなく、製品経路との差だった。

既存テストはEngine単体、合成GameState注入、AI vs AI、人間側のEND中心だった。実障害は5174のMeta UI、実デッキ選択、マリガン、YOU操作、CPU効果中の所有権、複数試合継続、mobile hit-testを横断した。

## 判明した盲点

| 盲点 | 見逃したもの | 強化契約 |
|---|---|---|
| 完走だけを成功扱い | 誤sideのpick/discard | source・owner・chooser・変更sideをassert |
| 初期候補だけ | runtime Pattern-BのAI方針消失 | 候補0→後段生成→非先頭選択 |
| 1試合だけ | stale pending・旧Promise commit | 離脱→別対戦まで連続実行 |
| 合成state注入 | setup/mulligan/route競合 | setup UIから実開始、注入禁止 |
| jsdom/desktop中心 | HUDのpointer遮蔽 | 393pxで実クリック |
| D08/D11中心 | 全カードresolver欠落 | CARD_POOL全ID一致 |
| モーダル表示まで | 解決後の操作不能 | pending 0＋次の合法行動成功 |
| dispatch結果を未確認 | 拒否された操作を効果不発と誤診 | 全操作で最初に`ok: true` |
| `undefined`を許すassert | pending未生成でも成功するfalse-green | `null`へ正規化し種類まで確認 |
| CPUと直接dispatchを併用 | CPUが先に動く競合・再現揺れ | fixture注入テストはCPU停止 |
| AIの配列順へ依存 | 方針改善で別対象を選びfalse-red | 対象を一意化、または選択UIDを検査 |
| 拡張stateを完全一致 | `instanceId`追加を誤って退行判定 | 挙動項目と一意性を分離して検査 |
| 判断単体だけ | misreadと後続効果の同時表示 | 人間判断は常に同時1件を契約化 |

BUG-207/209/218は目視だけで候補化した誤認だった。今後は公式ルール、candidate集合、クリック後ActionContextまで確認してからBUG確定する。

## 今回わかった要因

- E2E helperが`DispatchResult`を捨て、`not.toBeNull()`が`undefined`を通した。
- 既存YOU vs CPU通しE2EはYOUがほぼターン終了だけで、人間pendingも画面でなくJavaScriptから先頭候補/辞退をdispatchした。完走は証明したが実カード使用と判断UIは未証明だった。
- `smoke:1000`はAI vs AIのD08/D11 3組だけで、CPU由来の人間判断、逆順D11→D08、custom/test deck、能力・decisionの発火率を観測しなかった。
- 5173 Rootと5174 MetaのPlaywrightが分離し、engineのpending生成とMeta host表示が別テストだった。実カード発火→Meta判断→解決の接続は未証明だった。
- PlaywrightはCI外、Metaはdesktopだけだった。`toBeVisible()`はviewport外やpointer遮蔽を検出せず、mobile実clickで初めて露出した。
- 直接`reasoning:end`をemitする単体テストは、実際のミスリード判断を迂回した。
- side-channelやpendingを直接注入するテストは、効果発火からUI接続まで証明しなかった。
- CPUのroutine待機を短縮し、従来潜伏していた自動driverとの競合が顕在化した。
- 人間所有の任意対象をAIが自動選択する旧期待と、AIの先頭候補依存が残っていた。
- D01013同型は取得までしか検査せず、並べ替え未解決でも成功していた。
- 全試合完走は組み合わせを広げるが、特定能力が引かれ、使われ、全分岐を通る保証はない。
- `toBeVisible()`はviewport外の要素も通す。実クリックで初めてmobile操作不能を検出した。
- `BUG-130/158`は手組みfixtureが出荷カードの`uid:'$pick'+target+bind`形と違い、AI同期経路だけ正常だった。`BUG-140`はallowlistが能力欠落を合法化した。
- `BUG-166/167/176/180`はhappy path中心で、provenance、pick-first no-op chain、exact exhaustion、terminal後停止が無かった。pause/resume、同一効果の残りとobserverの順序、cleanup後まで必要だった。
- exact exhaustion修正後の13失敗中12件は、旧テストが公式違反の`deck=0/remove保持`を正解化したstale oracle。効果結果だけでrefreshCount・証拠・全zoneを見なかった。

## 常時ゲート（P0）

1. Decision所有権表: owner self/opp × human self/opp/なし × chooser owner/opponent × Pattern A/B × 初期/runtime候補 × cost/effect。
2. 実カード回帰: B05007、D11014、D08026、B03059、B07069、PR096。
3. Meta session E2E: setup→mulligan待機→離脱→別デッキ開始。
4. 完全UI判断: 選択→確定→解決→pending 0→次の合法行動。
5. CARD_POOL全ID: `???` 0、色・種別・Lv・AP・LP一致。
6. Meta mobile: 393×851・360×640・851×393で全操作の矩形を検査後、強制なしで実クリック。
7. 各test後: pending queue、resume、ActionContext、human sideが空。
8. 判断直列性: pending/modalは同時1件。解決後だけ次の判断をsurface。
9. 実操作結果: click/dispatch成功、対象UID、最終stateを同じテストで確認。
10. provenance: source card、ability ID、owner、chooserをpendingとログで確認。
11. 製品接続: 5174 setup→実deck→mulligan→実カードtrigger→判断UI→解決を注入なしで通す。
12. allowlist期限: 未実装を許容する票は修正済にできず、能力実装後のstale allowlistもfailする。

## 強化するテスト群

1. 実UI YOU vs CPU: setup→マリガン→行動→CPU効果→判断→次の合法行動。
2. 判断チェーン: 発動/辞退を直積し、各段階で表示中pendingが1件だけか確認。
3. B05080代表回帰: human self/opp/none × char/partner推理 × ミスリード発動/辞退。
4. D01013同型6件: 公開→取得/辞退→任意順デッキ下→後続行動まで完走。
5. ヒラメキ: human明示選択とAI自動選択を分離し、stable UIDで結果確認。
6. set card: 効果結果と`instanceId`一意性を別assertにする。
7. 特殊hook: 重複queue、不正/重複pick拒否、既存LP修正、終了時復元、再推理。
8. UI再入: picker再表示の選択初期化、pending 0、次の合法行動、逆side、mobile。
9. セッション/総当たり: 離脱→別対戦＋10デッキ順序付き100組。seed・能力・停止理由。
10. 外部画像: ID/URL mappingの決定的テストとCDN到達監査を別ジョブに分離。
11. 境界表: exact/不足/超過、候補0/1/複数、効果あり/no-op、通常イベント/ヒラメキ/カットイン/無関係カード、self/oppを直積する。
12. 能力coverage: 各試合で使用card、ability、decision、owner/chooser、停止理由を記録し、未発動能力を総当たり成功から切り離す。

## 実行レイヤー

- PR: focused ownership/session/resolver Vitest＋Meta desktop/mobile代表E2E。
- main統合: 全Vitest、smoke 1000、Root/Meta PlaywrightをCIでproject/shard分割し、console error 0、pointer interception 0、modal同時1件、試合境界clean invariantを確認する。
- nightly: 10デッキ順序付き100組（ミラー含む）をseed固定で自動実行。
- release前: 自動100組＋汚染6組＋能力カテゴリ代表の人間実操作。
100組総当たりは組み合わせ探索であり、能力coverageの代替にしない。人手は全100組でなく、再現6組と高リスク能力チェーンへ集中する。

## 成功条件

- 試合完走だけでは成功にしない。
- 各処理で発生源、能力ID、owner、chooser、対象、変更sideを確認する。
- UI決定後、関連pendingが全消滅し、別の合法アクションが成功する。
- route/turn/match境界後に旧状態が残らない。
- desktop/mobileともconsole error 0、pointer interception 0。

## 今回追加した回帰

- 実マリガンを含むsession cancellationとA/B逆順完了。
- runtime Pattern-Bの人間/AI所有権、非先頭AI選択、serialization境界。
- B03059/B07069/PR096、B08003/B07093の実カード所有権回帰。
- B04026/contact/stacked cost/HUDのdesktop/mobile Playwright。
- Meta実store decision host、全2074印刷カードresolver exhaustive closure、Result MVP。
- マリガンとReplayのportrait/short-landscape viewport内操作回帰。
