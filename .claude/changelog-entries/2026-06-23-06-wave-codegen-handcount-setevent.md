# カード追加 wave — codegen-handcount-setevent (engine変更0、手書き5枚)

**Round/Phase**: 2026-06-23 カード追加 wave#6 (A 継続、engine変更0)。ユーザーが「A-codegen 軽量wave」(engine0/最低リスク) を選択。
棚卸ラベル「codegen 即出荷 hand-count-cond + set-event-to-char (7+P)」を member 毎 full-text TSV grounding した結果、
**ラベルは誤り**と判明 (process の「green/clean ラベル不可信」を実証): 7枚は MR・複数名・opp-hand reveal・entered-char binding・
setCount dyn・任意 rename 等の engine gap を二次節に含み、codegen でなく手書き。grounding で真 yield を確定し、**engine変更0** で
出荷可能な 4 ファイルを出荷、4枚 whole-DEFER + 2能力 partial-DEFER。
うち B05035 は当初出荷候補だったが、敵対 review が **charSetCard host-absent 共有 engine 順序バグ (BUG-153)** =
公式Q&A 違反を検出したため engine変更0 範囲で DEFER (BUG-153 修正後 再出荷可)。

## engine 拡張: なし (engine変更0)

`git diff src/engine` = 空。既存 settled path の再録のみ:

- `charSetCard{uid:'$self', fromDeckTop:true, faceUp:false}` — デッキ上端を裏向きで自身にセット (B03061 a1 / B07034 a2 同型)。
- `sceneEnter{from:'remove', filter:{color,levelMax,kind:'character'}}` — リムーブから条件付き登場 (B01076 a1 / D11014 a2 同型)。
- `charGrantKeyword{kw:'突撃[キャラ]', scope:'turn'}` — EOT keyword 付与 (D09027 / B01094 同型)。
- declared `condition:{handAtMost}` 宣言ゲート (B07067 a2 同型) / `cost: pay[sleepSelf, removeFromHand, fileFrom]` (B05037 / B07034 同型、fileFrom はアシストパートナー除外 mutate/file.ts:42)。

## 追加カード (4、ALL_CARDS 1405 → 1409、touched=各1)

- **B07069 / B07069P 本堂瑛海** (赤8/CIA): a1【パートナー赤】【宣言】【ターン1】レベル8以下のキャラ1枚までリムーブ
  (condition and[partnerColor赤, handAtMost2] = 能力保持+宣言ゲート / sceneRemove levelMax8 side:either) +
  a2【FILE8】【宣言】【ターン1】【スリープ】〚手札1枚 + FILE上1枚リムーブ〛→ リムーブから lv≤7赤キャラ1枚まで登場
  (condition fileAtLeast8 / cost pay[sleepSelf, removeFromHand, fileFrom] / sceneEnter from:remove)。
- **PR099 工藤有希子** (白7/女優、**partial-ship**): a1【登場時】デッキ上端を裏向きセット + ターン終了時まで突撃[キャラ] 付与
  (sequence[charSetCard, charGrantKeyword])。a2 DEFER (任意 card名 rewrite verb なし)。
- **B05030 遠山銀司郎** (緑6/警察・大阪府警、**partial-ship**): 印字 突撃[キャラ] + a1【登場時】デッキ上端を裏向きセット
  (charSetCard)。a2 DEFER (per-set-count AP = $self.setCardCount dyn token なし)。

## DEFER (DEFERRED-INDEX §codegen-handcount-setevent)

- **B07065 世良真純＆メアリー** (全体): MR (rules/18 未配線) + 複数名 (rules/19)。hard gap。
- **B07068 羽田秀吉** (全体): 「登場させたキャラをアクティブにする」= sceneEnter の entered-char binding token 不在。
- **B07100 コルン** (全体): 相手手札 reveal + カットイン持ち選択 + 相手 remove = opp-hand reveal/removal verb 不在。
- **B05035 遠山和葉** (全体): DSL は B01050/B02019 同型で表現可だが、敵対 review が else-set 経路の
  **charSetCard host-absent 共有 engine 順序バグ (BUG-153)** = 公式Q&A『離場時はデッキ上に戻す』違反を検出。
  B05035 のみ Q&A が host-absent を明示するため faithfulness 違反が documented → engine変更0 では DSL 修正不可ゆえ DEFER。
  BUG-153 修正 (host 存在チェック→shift 順) 後に再出荷可。
- **PR099 a2 / B05030 a2**: 上記 (任意 rename / setCount dyn)。partial-ship (先例 B04059)。

## 検証 (全 green)

- **decoy 検証 test** (tests/cards/wave-codegen-handcount-setevent-2026-06-23.test.ts、7件): B07069 a2 revive の
  color/level/kind decoy 1対1 除外 + a1 sceneRemove level decoy / PR099・B05030 の set-facedown host 検証 + 突撃[キャラ] 付与/印字 /
  全 descriptor 構造 pin。
- **敵対 faithfulness review** (opus workflow、4カード lens + engine-0 lens): B07069/P・PR099・B05030・engine-0 は SHIP-OK、
  **B05035 のみ BLOCKER** (else-set の charSetCard host-absent = Q&A 違反、BUG-153) を検出 → B05035 を DEFER に移行。
- typecheck 0 (両config) / vitest 2881→2888 (+7、baseline 不変) / smoke winsA=498 exc0 baselineOK /
  e2e 123pass+1skip / 規約 lint 8本 errors=0 / engine diff 0 = engine変更0 確証。
