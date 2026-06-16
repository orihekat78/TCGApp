## BUG-111 #2 解禁出荷 — B05028 (誤診断) + B09038 (修正で解禁) + clones = 4枚 (ALL_CARDS 1297→1301)

BUG-111 #2 根本修正 (commit a682b20b) で解禁された 2 rep を card-wave 出荷。engine 変更 0 (修正は前 commit で完了済)。

- **B05028 服部平蔵** (誤診断で誤って DEFER されていた): a1 chain[charRemoveSetCard, sceneRemove]「そうした場合」 +
  a2 sequence[charSetCard(警察), charSetCard(opp)] (【スリープ】cost)。chain の human-decline は continuation-drop で正しく gate される
  (over-fire は再現せず誤診断、5 シナリオ独立検証)。修正不要で出荷可能だった。
- **B09038 工藤優作系** (BUG-111 #2 修正で解禁): a1【変装時】handAddFromRemove(工藤優作) + a2【登場時】optional[chain[自sleep,
  sequence[sceneEnter(工藤優作 levelMax6), conditional charSetCard, **draw**]]] + a3【変装】【FILE7】。
  末尾の無条件 draw が human-decline (0登場) でも発火するようになった (修正前は continuation-drop)。
- clone: B05028P / B09038P (byte 同一、verify-clone-identity で確認、divergent 0)。

### パイプライン
certify spec (`.tmp/certify/`、B09038.verify を BUG-111 修正で ok=true に更新) → `verify-clone-identity.cjs B05028 B09038`
(identicalClones 2/divergent 0) → `build-verified-codegen-input.cjs` (ADOPT 2 + clone 2) → `taskA-codegen.cjs --write` (4 files) →
`taskA-register.cjs`。生成 DSL は certify spec と完全一致を確認。

### gate5 実機検証 (`tests/cards/triage-greens-2026-06-16/{B05028,B09038}.test.ts`、opus author)
- **B05028 a1 chain-gate**: set-card holder + AP≤8000 decoy 盤面で a1 発動 → step1 を 0枚 human-decline → step2 sceneRemove
  **不発火** (decoy 残存)。resolve 時は step2 発火。partnerColor緑 条件 / hasSetCards・apMax filter を decoy で 1対1 検証。
- **B09038 a2 (修正の主目的)**: 登場 → optional opt-in → 自sleep → sceneEnter pick を 0体 human-decline → **draw 発火** (hand+1)
  かつ charSetCard 非発火 ($entered 空 → conditional skip)。resolve 時は enter+charSetCard+draw。levelMax6/cardName/kind filter を decoy 検証。

### 検証
- validate-specs pass=45 fail=0 (engine変更0) / tsc clean / full vitest green / smoke baseline byte 同一 / playwright 回帰 / pre-commit lint:* 8本。
- DEFERRED-INDEX: B05028/B09038 を解禁済に更新。B09056 は choice-in-continuation gap で DEFER 継続。
