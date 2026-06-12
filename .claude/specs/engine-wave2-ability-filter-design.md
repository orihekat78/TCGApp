# engine拡張 wave#2 cluster2 — ability-presence filter 設計 (v2、敵対レビュー3lens反映済)

branch `engine/wave2-ability-filter`。骨格凍結例外 (user 承認済 engine拡張 + 既存骨格バグ修正 2件)。
調査: Workflow 7 lens (`.tmp/wave2-ability-filter/*.md`) → 敵対レビュー 3 lens (fable×2+opus、
approve-with-fixes、fatal 0、`review-{rules,impl,completeness}.md`)。v1→v2 差分 = 全 major 9 件反映。
一次根拠: TSV qAndA 8件 — **「〜を持つ」= 印字 (静的) 判定、条件アイコンの有効性は問わない**。

## 出荷 10枚 / DEFER 8枚

**出荷**: B03131 / B03128 / B08005 / B08005P / B08016 / B08094 / B08094P / B09104 / B09073 / B09073P
(P 版は TSV 全列一致確認済。エラッタ非該当。全て未実装)
**DEFER** (DEFERRED-INDEX へ理由付き): B08078/P (他カード現リム時効果の外部発火=重)、B08082 (handReveal +
色 negation)、B03133 (handAddFromRemove 複数)、B06020 (hand aura + startContact stub、**triage 誤分類=付与**)、
B07098/P (remove keyword-count dyn)、B07102 (可変枚数 + 0枚可否一次資料なし)

## engine 変更 (X1/X1b/X6 = additive、X7/X8 = 既存骨格バグ修正)

### X1: `ICON_KEYWORD_PREDICATES` +2 — `read/keyword.ts:42-47`
- `現場リムーブ時`: trigger.hook (または **hooks[] 配列形**、card-def.ts:53) が `'leave:to-remove'` **かつ
  `selfOnly:true`** (impl-F1: B05066 計画の非 self listener を誤検出しないため。現行44件は全 selfOnly)
- `疾風`: hook `'enter'` + selfOnly + **trigger.matcherCondition** に enterOrderEquals (ab.condition ではない。
  D11014 正準形状を pin test で固定、rules-F6)
- 連動 (無変更): matchOneFilter (BUG-122 経路) → scene/hand/remove/deck pick・cost・sceneHas (remove+nMin 込)
- filter キーは既存 `keyword` → FILTER_FIELDS/型/同期テスト変更ゼロ。
  **注**: 述語は def-static = 変装後は新 def の印字で判定 (rules/23 整合、comp-M1)

### X1b: filter silent-drop の解消 (BUG-117/118 同型ドリフト、**2 サイト**)
- `targetFilterToPredicate` (atom-handlers.ts:63-93): keyword (defHasKeyword) + cardName
  (allCardNameComponentsForDef) を追加。hasSetCards/custom は deck カードに state/closure なし → 非対応を明示
- **`boundMatchesFilter` (cond/eval.ts:235-267)**: 第3の drop サイト (comp-MAJOR-1)。keyword/kind/apMin/apMax/
  lpMin/lpMax を同様に追加 (既存カードで未使用 grep 済 → baseline 不変)
- FILTER_FIELDS sync テスト新設: `Record<Exclude<keyof TargetFilter,'custom'>, true>` satisfies 方式 (impl-F6)

### X6: 新 verb `boundToRemove {player, bindKey}` (B09073 a2「残りをリムーブエリアに移す」)
- deckToBottomBound の splice 防御 (BUG-132 窓侵食ガード) を移植し、**splice 成功分を mutate.remove.add へ**
  (mill primitive 流用は不可 — removeFromTop は top-N 指定。impl-F3)
- **移送完了後に refresh guard** (B09073 qAndA「移すまで解決したところでリフレッシュ」、rules/26 reveal 中判定)
- 新 verb → union+map+cjs whitelist 3点同期 (sync テスト検知 ✓)

### X7: `mill` の refresh guard 欠落修正 (**既存骨格バグ → BUG-137 起票**)
- mill (atom-handlers.ts:346-352 → mutate/deck.ts:72-78) は deck 枯渇時 refresh を呼ばない。
  B09104 qAndA「可能な限りリムーブ→その後リフレッシュ」違反 + **出荷済 mill 13枚が同 gap**
- fix: fileAdd 同型の refresh guard を mill 解決後に追加。smoke デッキに mill 使用 0 (grep 実証) → baseline 不変

### X8: `drainAiEffectPicks` の pick 所有権 filter (**既存骨格バグ → BUG-138 起票**、impl-F4)
- 現状 apply-pick.ts:298-317 に pending.player filter がなく、CPU ターン中の playTurn drain が
  **human 所有の optional pick を heuristic で横取り確定**する経路が現存 (dispatch 経由は正規 routing 済)
- fix: drain を「drain 実行 player 所有の pending のみ」に限定 + human 所有分は UI driver へ surface
  (CPU vs CPU は両者 AI で従来通り消化 — 同一 heuristic のため baseline 影響は smoke で実証確認)
- 本クラスタの 相手ターン中 trigger 3枚 (B08016/B09104/B09073 a2) の出荷前提。既存出荷カードへの影響は
  実装時に grep し BUG-138 に水平展開記録

## カード別 DSL 要点 (全句突合: clause-a/b.md + rules-F1/F9 補正)

- B03131: a1 scene pick `{keyword:'カットイン',color:'黒'}`→突撃 turn 付与。**+ hirameki: draw1** (rules-F1 脱落補正)
- B03128: 登場時 deck-look2 upTo `{keyword:'カットイン',color:'黒'}` (カード=kind 制限なし、イベント含む)→hand、残り deck 下→X1b
- B08005/P: a1 (【事件青&黒】【パートナー青】登場時 AP8000以下 remove)。hirameki: remove pick
  `{keyword:'現場リムーブ時',color:'黒',kind:'character'}`→hand
- B08016: a1 = B08020 同型 + **gate 【事件青&黒】【事件編】+ kind:'character'** (rules-F9)。a2 相手ターン中現リム時:
  hand `{keyword:'現場リムーブ時',kind:'character'}` discard optional→draw2
- B08094/P (case): t1 解決編→hand discard (case:to-resolved hook、D06019.ts:17-19 前例)。a2 宣言 【解決編】【ターン1】
  cost flipFaceUpEvidence×2 + 宣言可 cond sceneHas{side:'self', cardName シェリー/灰原哀 (分割名 components)} +
  deck-look3 upTo `{keyword:'現場リムーブ時',kind:'character'}`→hand、残り deck 下
- B09104: a1 登場時 **side:'either'** (公式に自現場限定なし、rules-F4/impl-F7) excludeSelf
  `{keyword:'現場リムーブ時',kind:'character'}`→突撃 turn 付与。a2 相手ターン中現リム時: mill{player:'opp',n:4} optional (X7)
- B09073/P: a1 宣言 cost スリープ + 宣言可 cond sceneHas{**side:'self'**, filter:{keyword:'疾風'}} + **AP8000以下
  1枚まで選びリムーブ** (rules-F9 本体効果)。a2 相手ターン中現リム時: deck-look3 upTo `{keyword:'疾風',kind:'character'}`
  →**handAddFromDeck→boundToRemove (X6)→boundMatchesFilter levelMin:8→discard1** の句順 pin (impl-F8)

## ルール整合 / エッジケース / 検証

- rules/17 へ裁定追記 (**適用範囲限定の文面**: presence filter 判定は静的印字、能力自身の発動/使用は従来 Point 通り。
  rules-F7)。rules/22 は現リム時のアクション内解決タイミング既裁定 = 既存 infra 対応済 (F8)。
  疾風×名乗り例外の rules/03・06 vs 13 不整合は**隣接事項として別起票** (impl-F9、本クラスタ外)
- 既知ギャップ DEFER: ①付与能力 presence (B07100 qAndA は「乗る」、def-static と乖離 — 出荷分に grant 源なし)
  ②能力無効化中 presence (rules/19 文理 vs 既存4アイコン static、Q&A なし → 要公式照会)
- エッジ: (1) 一致0=skip/decline 続行 (2) deck<N 窓 + remainder 先 remove/bottom 各 refresh 判定 (rules/26)
  (3) 相手ターン中 trigger の owner pick routing (X8 必須、e2e+MCP decoy) (4) case 宣言 (B08094 実機)
  (5) 変装後 presence = 新 def 印字 (6) 同時 leave:to-remove 複数 trigger の pick 直列化
- decoy (MCP §7 文言一致): 条件アイコン付き現リム時持ち=**含む** / B04096 黒カットインイベント=「カード」filter で
  **含む**・「キャラ」で除外 / 突撃持ち≠疾風=除外 / 相手現場候補 (B09104 either) / B09075 解決編疾風 gate decoy /
  テキスト言及≠所持 (B02044) / B08094 t1 手札0
- TDD 先行 pin: X1 述語 (正準形状+selfOnly+hooks[]) / X1b 2サイト / X6 splice+refresh / X7 mill refresh /
  X8 所有権 drain。baseline: 新述語・deck窓 keyword/cardName・bound keyword 使用既存カード 0 (grep 実証済) +
  X7 smoke mill 0 + X8 CPUvsCPU 同一 policy → **smoke baseline 完全一致を回帰証跡とする**
- 水平展開: capability-map.txt:577 stale 訂正 / B06020 誤分類を DEFERRED-INDEX に注記 / BUG-137・138 起票
