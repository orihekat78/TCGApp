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

## queue (batch 順、各行は着手前に origin/main semantic grep で stale 検証必須 — TSV は 06-30 snapshot)
1. **condition-dyn-absent-group 残** ([A] 12 中、消化済み多数に注意):
   ~~P30 sceneLpSum~~ ~~P31 evidenceDiff~~ ~~P34 sceneCountCompare~~ ~~G18 stackedCount~~ (出荷済) /
   G11 (hand-count は既存説 — 要 grep) / P32 all-scene-homogeneous (B08062) / P33 enterCountAtMost (B09089) /
   P35 oppSceneCount dyn (B08086) / P54 removeNameCount (PR158/164) / G12 removeCountAtLeast (B03104) /
   G13 removeColorAtLeast.kind (B08004) / G19 $self.sceneColor (B02002)
2. **verbs-effects [A] 6**: P44 draw-up-to-hand-size (B08047) / P38 scene-char→owner 証拠化 (B03084) /
   P39 scene-char→opp 表向き証拠化 (B06085) / P41 FILE↔手札 表向き (B05045) / P12 rename verb (PR105) /
   P48 じゃんけん RNG (B07011)
3. **restriction-flags [A] 6**: P05 手札使用禁止 flag (B05120) / P06 ネクストヒント禁止 (B06104、
   wave-1 setNextHintBan と重複疑い — 要 grep) / P08 リフレッシュ証拠抑止 (B05097) / P09 色制限 bypass (B03126) /
   G09 ヒラメキ抑止 continuous (B05079) / ~~カットイン・変装禁止 flag~~ (wave-10 出荷済)
4. **relative-filter [A] 4**: ~~P55/G15 relative-AP~~ (stale=既存、B09096 出荷済) / G16 relative-LP/level 残
   (B04074/B08043 — $self.level dyn は wave-4 出荷済、残は対公開カード/対現場最大LP) /
   G17 $revealed N>1 色読み残 (D06013/PR132) / P03-family 変装入替キャラ参照 (B02047)
5. **setcard-stack [A] 残**: ~~P01 on-set-host~~ (出荷済) / P27 持ち主デッキセット (PR136/142) /
   host=opp source=opp deck (B05031) / P28 setcard-source=remove-area (B08036) / P43 合算セット除去+枚数分岐 (B07031P)
   ※P25/P26 の cost 形は cost union = A1 送り。

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
