# 作業ログ — 名探偵コナンプロジェクト

(過去セッションは `.claude/sessions/` にローテート。直近 = 2026-06-16.md = ⑫⑬。⑭ batch#4 = CHANGELOG + changelog-entries/2026-06-16-3 + DEFERRED-INDEX に記録)

## 2026-06-16 セッション⑮ — BUG-111 #2 根本修正 (human-decline 経路の sequence mandatory-tail drop)

ユーザー選択タスク = 「BUG-111 を根本修正」(batch#4 の ~50% yield 教訓を踏まえた再判断)。commit **a682b20b** (CI green)。

### 確定した根本原因 (systematic-debugging、再現で ground truth)

`tests/engine/effect/bug-111-human-decline-repro.test.ts` で実証 (推測でなく再現):
- **実バグは under-fire のみ**: `sequence[optional-0-pick, ...mandatory-tail]` の 0-pick を candidate在で human-decline すると、
  pending 破棄とともに continuation (残り step) が **一律 drop** → mandatory 末尾が消える。根本原因 = continuation が
  **sequence/chain の origin を区別しない**。AI は greedy で decline しないため human-decline 路のみ発火 (certify/smoke 透過)。
- **B05028 over-fire は誤診断**: 5 シナリオ独立検証で再現せず。chain の continuation-drop が「そうした場合」gate として正しく動作
  (charRemoveSetCard pending は skipResolvesAtom:false で applyPickSkipAndContinuation を通らない)。→ B05028 は修正不要で出荷可能。

### 修正 (engine 4 ファイル、骨格凍結例外)

- continuation に `kind:'sequence'|'chain'` 付与 (resolve-picks 型 + resolver 付与)。
- decline routing: sequence-origin → remainder 実行 / chain-origin → drop (apply-pick drainAiEffectPicks + useEngineDispatch)。
- `applyPickSkipAndContinuation(.., runDeclinedAtom=false)`: sequence-origin decline は declined head atom 非再実行 (declined 0-pick=何もしない、
  head bind は unbound で後続 conditional が not-matched skip、単数 sceneEnter の `__declined` 未対応による再 push を回避)。
- remainder wrap も origin kind で行う。**atom-handlers.ts は不変**。

### opus 敵対設計レビュー (3 lens、`.claude/specs/bug-111-human-decline-fix-design.md`)

- Lens 2 (B05028 誤診断検証) = APPROVE (5 シナリオ独立再構築で確認)。Lens 1 (回帰) = approve-with-changes。
- Lens 0 (意味論) = REJECT/BLOCKER: **B09056 の末尾は 2択 choice**。choice-in-continuation は eager-surface (BUG-145 系) で fragile
  → **B09056 は DEFER 継続** (choice surface 整備は別 engine 課題)。**B09038 のみ解禁**。

### 水平展開 / 検証

- 決定論 scan: `sequence[0-pick, tail]` = **79 ability** (MVP D11014 a2 含む)。choice/optional-tail 6 出荷カード
  (B04080/B07079/B07055/B07031) は double-run 無し (probe で実証 = 回帰なし)。
- repro 5/5 / tsc clean / **full vitest 2540 pass 0 fail** / smoke baseline byte 同一 / lint:* 8本 errors=0 / CI green。

### 解禁 2 枚 card-wave 出荷 (同セッション、commit 8286f2c3、ALL_CARDS 1297→1301)

- B05028/B05028P + B09038/B09038P = 4枚。codegen (certify DSL→.ts) → register。engine変更0 (validate-specs pass=45)。
- B09038.verify を BUG-111 修正で ok=true に更新 (refutation 解消) → build-verified-codegen-input が ADOPT。
- **gate5 実機 (opus 2並列)**: B05028 11 pass (a1 chain-gate decline=step2不発火 / resolve / filter decoy / partnerColor負 / a2) /
  B09038 9 pass (★a2 0登場 decline で **draw 発火** + **falsification 実証** [fix 一時無効化→test FAIL→復元 byte同一] / 候補0 自動0-pick / filter / a1変装時 / a3 FILE7)。concerns 0。
- 全gate: full vitest 2560 pass / smoke baseline byte同一 / playwright 119 pass / lint:* 8本 / CI green。

### 次セッション最優先 (いずれか)

- トリアージ出荷バッチ#5 (window6+, sweep-window2.cjs, done 186 除外) / 中型 engine クラスタ (cutin-subtype 69 等) /
  choice-in-continuation surface gap 修正 (B09056 等の解禁前提、BUG-145 系)。
