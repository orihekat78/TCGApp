# 次セッション再開プロンプト — Track A2: engine 拡張 additive lane (2026-07-02 新設)

> 2 レーン並行体制の **additive 専任** lane。体制定義 = [specs/engine-parallel-2lane-2026-07-02.md](specs/engine-parallel-2lane-2026-07-02.md) (必読)。
> A1 (structural lane) = [NEXT-SESSION-PROMPT.md](NEXT-SESSION-PROMPT.md) / Track B (compiler 監査) = 併走可。
> モデル方針: 本体・難判断とも **opus 最初から** (fable agent 不可)。⚠ 応答は日本語。Caveman mode 有効。

---

```text
名探偵コナンTCG MVP — Track A2 (engine 拡張 additive lane 専任)。まず CLAUDE.md → CHANGELOG → memory.md →
specs/engine-parallel-2lane-2026-07-02.md を読む。

## ミッション
plan TSV ([specs/engine-extension-plan-2026-06-30.tsv]) の additive [A] 行を wave 形式で丸呑みする
(1 wave = 3-8 個 + 各 exemplar カード同梱、1 commit)。「まとめて engine 拡張」実績プロセス
(wave 0629/0630 系、TDD RED→GREEN、evaluator 追加 template) をそのまま使う。

## ⚠ lane 排他 (最重要)
- 触ってよい: cond/eval.ts (Condition 追加) / dyn 評価器 / TargetFilter 軸 / atom-handlers (verb 純追加) /
  turn-flag 系 / card-def.ts union 追記 / exemplar カード / tests。
- **禁止: listeners (hook 新設) / flow / resolver 構造 / GameState 形状 / UI / cost union** → 必要になったら
  その primitive を DEFERRED-INDEX に記録して A1 へ送り、次の候補に進む。迷ったら structural 扱い = A1 送り。

## ⚠ wave-13 所見 (2026-07-02、A2 additive-primitive well ほぼ枯渇 — 次 session 必読)
wave-13 (commit 2a1e0678) で **P54 removeNameCount dyn** 出荷 (犯人 PR158/PR164)。全 batch semantic grep 実施の結果:
- **batch-1/4/5 の additive [A] は事実上枯渇**: P30/P31/P34/G18/G19(=sceneColorNot)/G11-G13/P33/P35/P46(aura=apDeltaAuraOpp)/
  P55/G15/$self.level は **wave 0630/2/4/6/0629b で出荷済** (TSV「未実装」は 06-30 snapshot で stale)。P32 は
  cardNameNot+not+sceneHas で被覆済 (真 gate=G37 aura partner-area scope=structural→A1)。
- **verb 群 (P38/39/41/42) は clean unlock 不可**: exemplar が全て他の structural 前提を要する —
  P38/P39=降谷零/松田陣平 (MR-select + evidence→deck-bottom + 捜査) / P41=B05045 (MR partner-area) /
  P42=B07014 (set-card-granted **declared** ability)。verb 単独では出荷不可 (YAGNI + exemplar-backed 原則)。
- **restriction-flags 残 (P05/P08/P09) は structural→A1 送り**: P05/P09=flow/main/hand-use-card.ts・next-hint.ts /
  P08=mutate/deck.ts refresh() 分岐。P06/G09 は出荷済 (nextHintBanned/hiramekiSuppress)。
- **P12 rename=state-shape (turnEffects.nameOverride)→A1、P48 janken=resolver+rng 配線→A1**。
- 既存 primitive で **card-authoring のみ** で解禁できるカードは残る (例 B03033 遠山和葉 = apDeltaAuraOpp -1000 +
  auraFilterOpp{hasSetCards} + ヒラメキdraw、全 primitive 出荷済) → これは **card-wave lane** の仕事 (engine 変更 0)。

### ⇒ 次 A2 session の推奨: lane を **card-authoring へ pivot** するか、A1/card-wave に統合。
残る engine-additive の候補: G16 **対現場最大LP は wave-14 出荷済** ($self.sceneMaxLp dyn + exemplar B08043、main f687d978)。
残 = G16 対公開カード (B04074 souza-bind「公開集合内に同Lv」= structurally complex、A1/DEFER 寄り) と
G17 $revealed N>1 色読み (D06013/PR132、boundMatchesFilter が bound[0] のみ → boundAnyMatchesFilter は wave-5 出荷済、要再 grep)。

## queue (旧、参考。各行は着手前に origin/main semantic grep で stale 検証必須 — 上記所見で大半 stale)
1. ~~condition-dyn-absent-group~~ **枯渇** (P54 で最後の additive 出荷、他全て stale/structural)
2. ~~verbs-effects~~ **clean unlock 不可** (exemplar が structural 前提、上記所見)
3. ~~restriction-flags~~ 残 (P05/P08/P09) は **structural→A1 送り**
4. **relative-filter 残 = G16 対公開カード / G17 のみ** (M effort):
   ~~G16 対現場最大LP (B08043)~~ 出荷済 (wave-14、$self.sceneMaxLp) / G16 対公開カード (B04074、souza-bind 複雑=A1寄り) /
   G17 $revealed N>1 色読み (D06013/PR132) ※boundAnyMatchesFilter/boundDistinctColorCount は wave-5/10 出荷済 → 要再 grep
5. ~~setcard-stack~~ P27/P28/P43 = cost/set-card structural → A1。

## プロセス
- **wave 着手時に /engine-wave skill を起動** (model opus/sonnet/fable + effort の判断表に従う)。
- 開始時 `git ls-remote origin main` → worktree `git worktree add -b engine/a2-<n> /c/tmp/<dir> origin/main` +
  node_modules junction (npm install 禁止)。撤去は junction hazard 手順。
- TDD: RED probe → GREEN 最小配線 → 実カード使用形 drain/produce 検証。template =
  tests/cards/engine-additive-wave-0630.test.ts (評価器) / cluster6 (turn-flag) / wave5 (gate)。
- tier: T1 (pure-additive) = 機械ゲート + probe のみ。新 verb で emit 多点なら T2 (2 lens)。
  重い workflow review は A1 と同時起動しない (spec 参照、SUB≤5)。
- 6 ゲート: tsc0 / vitest baseline / smoke:1000 winsA=498 不変 / 8lint。後発 push は rebase 後**全ゲート再走**。
- commit 後: CHANGELOG entry + 本ファイル queue 更新 + memory.md。1 wave = 1 commit = 1 session 推奨。
- 出荷後 Track B `npm run cards:sync` が G1 監査 (自動)。exemplar 同梱を忘れない (辞書化の種)。
```
