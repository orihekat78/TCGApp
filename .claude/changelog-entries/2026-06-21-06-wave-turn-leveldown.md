# カード追加 — turn-scope levelDelta (誤 DEFER の engine変更0 カード解禁, 1 base)

**Round/Phase**: 2026-06-21 カード追加 wave (A 継続)。**engine 変更ゼロ**。
DEFERRED-INDEX が「continuous (temp) levelDelta が不在」を理由に DEFER していた B05102 が、実は
**既存 `charModifyLevel{scope:'turn'}` で実装可能**と判明 (誤 DEFER) → 解禁・出荷。

## engine 変更: なし (誤診断の是正)

DEFER note は「ターン終了時までレベル－1」を **condition-gated continuous levelDelta** (B08050「【解決編】
レベル+3」= 盤面状態で毎 read 再評価する `ContinuousModifier.levelDelta`、engine 不在) と同一視していた。
しかし「**ターン終了時まで**レベル－1」は条件付きでない **one-shot で turn end に失効する turn-scope delta**
= 既存 `charModifyLevel{scope:'turn'}` (B05066/B07103 で出荷済) に該当する。

- `turnEffects['lvlMod_turn']` に積み、`read/char.ts level()` が 4-scope (base + lvlMod_permanent/turn/contact/action)
  合算で honor、`mutate/char.ts` が turn end に `delete lvlMod_turn` (BUG-119)。`target/candidates.ts` の filter
  level も同 4-scope 合算。→ engine 変更不要。
- **turn-scope levelDelta** (本カード) と **condition-gated continuous levelDelta** (B08050/PR264/B08059 = 真の
  engine gap) は別物。決定論 scan (`ターン終了(時)?までレベル[＋－]\d`) で 3 候補 (B05102 / B09078 / PR096) を
  抽出 → B09078 (a1 dual-filter deck-look + reveal-to-remove) / PR096 (a2 cost-mill-result 参照 conditional)
  は別 gap で DEFER。clean は B05102 単独。

## DSL (全 atom に出荷済 exemplar)

a1 = `triggered{effect:declared, selfOnly, matcher:event-use}` + `condition:{partnerColor,黄}` +
`sequence[ charModifyLevel{side:opp,max:1,delta:-1,scope:turn}, draw{n:1}, sceneEnter{from:hand, max:1,
viaEffect, filter:{color:黄, kind:character, levelMax:{dyn:'$self.fileCount'}}} ]`。

- **【パートナー黄】= ability.condition** (rules/17 Point: 未達なら「何も効果のないイベント」= 効果全体不発)。B04064 同型。
- **sequence (chain でない) + mandatory draw**: 公式Q&A「相手キャラを1枚も選ばなくても以降を解決。**カードを1枚引くは
  必ず行う**。登場させないことは可能」。BUG-111 #2 修正 (2026-06-16) で sequence-origin の 0-pick decline /
  候補不在でも remainder (draw + sceneEnter) を実行 → Q&A と一致。B09038 a2 inner sequence が同 precedent。
- **charModifyLevel は AI 経路で first-candidate fallback** (chooseAtomTarget に case 無 → null →
  `chooseAiPick` が `cands[0]` 採用)。相手キャラ在 = level-down 適用 / 相手0 = `cands.length=0` で
  branch② (sequence-origin remainder)。両経路で draw+enter 発火。
- **levelMax:{dyn:'$self.fileCount'}** = 「FILEエリアの枚数以下のレベル」(cluster12 nested-filter-dyn、D05014 同型)。
- a2 = ヒラメキ self→hand `handAddFromRemove{fromSelf:true}` (PR085 a2、前 wave 出荷の fromSelf)。event カードも
  証拠エリアで hirameki 発火 (D08024/B02053 等 event+hirameki 出荷済)。

## 追加カード (1 base、P変種なし、ALL_CARDS 1371 → 1372)

- **B05102 小五郎の弟子** (黄 L1 event、C、cardId 0600):
  「【パートナー黄】相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。カードを1枚引き、
   手札から自分のFILEエリアの枚数以下のレベルの【黄】のキャラを1枚まで登場させる。
   【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。」

## 検証

- tsc clean。vitest full **2759 pass / 1 skip / 0 fail** (前 2747 + 新 decoy 12、減なし)。
- smoke:1000 **exceptions=0・baseline 不変** (avg=10.998 / winsA=498) = engine変更0 回帰ゼロ証跡。
- 新規 `tests/cards/turn-leveldown-b05102.test.ts` **12 件** (実 engine 駆動):
  §1 partnerColor gate (黄=true/赤=false) / §2 ★mandatory-tail★ 相手0 でも draw+enter (BUG-111#2、境界=不在) /
  §3 相手 Lv5→4 level-down + draw+enter (AI first-cand fallback) / §4 sceneEnter filter (a 黄 Lv≤file 登場 /
  b 黄 Lv>file cap 不登場 / c 非黄 色不一致 不登場、いずれも draw 発火) / §5 ヒラメキ self→hand / §6 構造突合。
- playwright 回帰 120 pass / 1 skip。spectator-speed:79 は既知 timing flake (~40% 日次、単体再走 3/3 pass で確認、本変更非交差)。

## 学び (恒久)

- **DEFER note の gate 診断は hint であって保証でない (今回は逆方向)**: handoff/DEFERRED-INDEX は B05102 を
  「continuous levelDelta 不在」で DEFER していたが、実は **turn-scope = 既存 charModifyLevel で engine変更0**。
  着手前に「実テキスト全句 + main effect の実装可否を実 engine で洗う」の徹底で誤 DEFER を発見・是正。
- **「engine変更0 完全枯渇」の handoff 主張に反例**: turn-scope vs condition-gated continuous の区別、および
  BUG-111#2 (2026-06-16) で解禁された sequence-mandatory-tail を改めて catalog に当てると、誤 DEFER 由来の
  engine変更0 カードが残存しうる。今後の yield scan は「過去の DEFER 理由が現 engine で今も成立するか」を再評価する。
- **AI null-pick の 2 分岐を把握**: `chooseAtomTarget` が case 無で null を返す verb (charModifyLevel) でも
  `chooseAiPick` は候補在なら `cands[0]` に fallback。候補不在のみ真の null → sequence-origin remainder。
  decoy は両端 (相手在 / 相手0) を必ず踏む。
