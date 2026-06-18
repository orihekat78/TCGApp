# cluster15 follow-up — removal-observer + keyword-grant closure 群 出荷 (4 rep / 8 printings)

**Round/Phase**: 2026-06-18 cluster15 fast follow-up (`cards/wave2-cluster15-partnercolor`)。
cluster15 (contact-removal-observer 反撃一族) で「反撃句は green だが他句が keyword-grant closure (JSON 不能)」として
DEFER していた 4 rep を手 author で出荷。

## 出荷 4 rep / 8 printings (ALL_CARDS 1342→1350、engine 変更 0)

| rep | 内容 |
|---|---|
| **B06038** (鬼丸猛、緑/Lv8/AP8000/LP0) | a1 【パートナー緑】〚突撃〛 / a2 removal-observer→1ドロー / a3 アクション[事件]証拠獲得時→相手手札1リム |
| **B06039** (沖田総司、緑/Lv7/AP6000/LP0) | a1 【パートナー緑】〚突撃[キャラ]〛 / a2 【自分ターン中】AP+1000 / a3 removal-observer→1ドロー+自手札1リム / a4 【ヒラメキ】キャラ1枚までスリープ |
| **B08010** (真田貴大、青/Lv4/AP4000/LP0) | a1 **【絆比護隆佑】**〚突撃[キャラ]〛(bond gated closure、B08012 比護隆佑 の鏡像ペア) / a2 removal-observer→1ドロー |
| **B09071** (萩原千速、黄/Lv8/AP8000/LP1) | a1 【パートナー黄】〚突撃〛 / a2 【疾風】自身に actionTargetsActive 付与 / a3 【ターン1】removal-observer→キャラ1枚までスリープ |

parallels: B06038P / B06039P / B09071P / B09071P2 (テキスト同一、rarity/imageUrl のみ差)。

## 句マッピング (全て出荷済 DSL / 共通クラスの流用)

- **keyword-grant closure** (DEFER blocker): partnerColorKeyword(`{color,kw}`) __shared 共通クラス (B06038/B06039/B09071)。
  B08010 のみ 【絆】gated のため B08012 a1 と同型の inline `{kind:'bond'}` + `grantKeywords` closure。いずれも `continuousModifier.grantKeywords`
  が closure 型 (JSON 不能) → codegen 不可 = 手 author。
- **removal-observer**: bare `condition removedCharMatches{side:'opp', cause:'contact-ap', by:'self'}` + `trigger {hook:'leave:to-remove'}` (selfOnly 無)。
  cluster16 萩原千速 (PR280/B06087) で既に出荷・gate5 実証済の同条件 (萩原は `and[fileAtLeast6, …]` だったが本群は bare)。effect は draw / draw+discard(自手札) / sleep のみ = scene removal verb 非含 → 自己 cascade 懸念なし。
- その他: 【自分ターン中】AP+1000 (apDelta)、【ヒラメキ】sceneSetState ($pick 明示)、【疾風】enterOrderEquals→charSetTurnEffect(actionTargetsActive)、【ターン1】limit。

## 検証

- **専用 gate5 `tests/cards/cluster15-followup-removal-observer.test.ts` 10 pass**: removal-observer 条件を end-to-end contact (declare→passGuard→snapshotAP→judge) で発火確認 + decoy 1対1 (cause=effect/除去者=別キャラ/自分キャラ除去 → 非発火) + 各カードの effect/grant 値 (draw/discard 側・hirameki $pick・charSetTurnEffect・bond grant・partnerColorKeyword grant・【ターン1】limit) を公式文言に 1対1 で固定。
- tsc 0 / **full vitest 5232 pass (+10) 0 fail** / **smoke baseline winsA=498 不変** (MVP外=回帰0) / validate-specs engine変更0 / eslint 0 / lint:listener+bugs errors=0。
- playwright は非MVPカード (CT-D08/CT-D11 非収録) のため gate5 vitest で代替 (cluster15/16 と同方針)。
