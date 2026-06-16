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

### 次セッション最優先

- **解禁 2 枚 (B05028 修正不要 + B09038 修正で解禁) を card-wave 出荷** (certify DSL = `.tmp/certify/{B05028,B09038}.json`)。
  gate5 で **B09038 a2 を human-decline (sceneEnter 0登場) して draw 発火**を必ず踏む (今回の修正点)。
- 後続: 三角出荷バッチ#5 (window6+) / 中型 engine クラスタ / choice-in-continuation surface gap (B09056 前提)。
