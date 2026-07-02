# Track B — demand-signal 正式化 + B3-2 gap-suspect 27 certify (BUG-163 修正 / BUG-164 起票)

**Round/Phase**: 2026-07-02 Track B (compiler 監査運用の初回実走)。2 フェーズ:
① demand-signal ツール化 + origin/main 再採寸 (commit 29999a8a)、② B3-2 shipped-gap-suspect certify (本 commit)。

## ① demand-signal 正式化 + 再採寸 (29999a8a)

- `scripts/compiler/demand-signal.cjs` 出荷 (決定論): rule 未被覆行を {lines, subclauses} 2 粒度で抽象
  (K/LvN/【色】/⟨カード名⟩/⟨特徴⟩/「⟨能力⟩」、quote-aware 「。」split)、**影響カード ids 付き**。
- origin/main 直 grep (honor-site まで) で初版需要ランクを再採寸 → **真の Track A gap は 4 family のみ**:
  P10 事件解決 rewrite+証拠隠滅 (**同一 8 枚**、初版 8+8 は二重計上) / G39 PA card slot 4+3 /
  「アクション中のキャラ」TargetFilter 軸 4 / G34 multi-select 4。
- **降格 (既出荷 → card-phase)**: MR PA 宣言19+発動5 (mr-partner-area core bef3adad — auto-mem「未実装」stale) /
  set-event family ~15 (fromSelf WRITE + on-set-host READ) / keyword turn-grant ~13 (charGrantKeyword scope) /
  【事件緑＆白】4 (caseColor combine:'and')。engine-extension-plan 末尾 + demand-signal spec (a) に反映。

## ② B3-2 gap-suspect certify (opus workflow 22 agent、敵対 verify 付き)

gap-suspect 27 枚 (base 20) を印字全列 ⇔ DSL で per-card 裁定:

- **FULL 7** (B03006/B06007/B09092/D08021/PR022/PR192/PR197) = mine alignment 副作用、実装完全。
- **DEFERRED_DOCUMENTED 11** = 意図的 defer。副産物: B03032/B04018 の**台帳漏れ**を DEFERRED-INDEX に追記、
  **B05058 の defer 理由 stale** (grantTraits は wave-6 出荷済 → card-phase 解禁候補) を注記。
- **真の未記録欠落 2** (敵対 verify とも refute 失敗):
  - **[[BUG-163]] B08079/B08079P ピンガ**: henso 列【変装】【事件黒】【FILE7】が丸ごと未収載 (col13 grounding 漏れ、
    BUG-117 の col12 と同型)。**同 commit で修正** — a4 (icon-disguise + and[caseColor黒, fileAtLeast7]、
    B02038 同型・engine 変更 0) + probe test (canDisguise gate 4 分岐)。stale pin test も a4 込みに更新。
  - **[[BUG-164]] B09100 犯人**: 「デッキに何枚でも」例外が validateDeck 未実装 (CardDef に copy-limit field 不在)。
    latent (MVP 非影響)・engine 変更要 → 起票 + DEFERRED-INDEX 登録で **Track A 送り** (骨格凍結遵守)。

## 検証

tsc 0 / vitest full 3614 pass + 1 skip (減なし) / smoke:1000 winsA=498 不変 (baseline OK) / lint errors=0 /
mine 再採掘: gap-suspect **27→25** (B08079 解消)、rules 630、**G1 mismatch=0 維持**、match 1167。
compiler の監査 pivot が初回実走で実バグ 1 + engine gap 1 + 台帳 stale 3 を回収 — 回帰ゲート + 監査運用の実証。
