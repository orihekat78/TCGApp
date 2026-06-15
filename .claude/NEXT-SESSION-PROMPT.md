# 次セッション再開プロンプト (2026-06-15 赤魔術 family残 完了時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。

> モデル方針 (2026-06-14): `claude-fable-5` が agent で利用不可のため、本体も難判断も **当面 opus を最初から**。
> 難判断 agent (certify / 意味等価突合 / 敵対設計レビュー) は `model:'opus'` 明示。詳細は CLAUDE.md。

> ✅ **push 済**: family残 は branch→main ff-merge→push 済 (`a65b0cf4`)、CI green 確認済。次セッション開始時は
> `git log origin/main..main` が空であることを確認。

---

```text
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md → .claude/memory.md を読んで状況把握。

## 現在地 (2026-06-15)

- engine拡張 wave#2 cluster1〜8 ✅ + BUG-145 ✅ + 赤魔術 trait family ✅ + 赤魔術 family残 ✅。ALL_CARDS = 1174。origin 同期済 (`a65b0cf4`, CI green)。
- 本セッション④ = 赤魔術 family残【事件赤魔術】族 5枚を opus adversarial certify → 3枚解禁・2枚 DEFER:
  - **解禁3枚**: B07031 小泉紅子(SR, 登場時 charSetCard$self + 宣言[caseTrait赤魔術, pay[sleepSelf,removeFromHand]]
    → sceneRemove + optional{chain[charRemoveSetCard n:2, reanimate remove白L3]}) / B07038 紅子の執事(登場時
    reveal-until closure-OR[名前小泉紅子 OR 赤魔術event] → handAdd → デッキ下shuffle → 加えたら discard1 + cutin AP+1000) /
    B07047 中森銀三(caseTrait突撃 + 登場時 charSetCard$self + hirameki sleep=D01012 byte等価)。
  - **DEFER2枚**: B07034/PR231 (text同一) — a1「セットカードが現場を離れるたび1ドロー」= `setcard:leave`
    per-occurrence hook が engine 不存在 (certify 5点確認)。partial 不可でカード全体を engine拡張クラスタへ。
  - **certify ROI**: build-break (B07038 import path: lookupCardDef は barrel 非export→card-def-registry.js 直import) +
    「このキャラ($self) vs pick(PA短縮形)」語義差を code 前に検出。
  - **triage 副産物**: TSV category-drop の **実測 blast-radius を決定論 audit** で確定 → dropped-trait は
    case 0/event 1 (B06035 既DEFER) = **live 影響ほぼ0**。systemic fix を低 urgency に格下げ (DEFERRED-INDEX 記録)。
- 全 gate green: tsc 0 / full vitest **2172**(+12) / smoke winsA=498 baseline不変 (engine変更0・非MVP) /
  playwright 119 / eslint 0 / lint:icon-abilities OK (shipped=1174 deferred=2)。

## 次にやること (候補、未確定 — ユーザーと相談 or triage から選定)

- **`setcard:leave` hook engine拡張クラスタ** (本セッション発見): 全 set-card クリア点 (char.ts removeAllSetAndStacked/
  removeOneSetCard, scene.ts toDeck/toHand) で per-occurrence emit + ターン2 limit を実装。**B07034/PR231 a1 +
  B02020(大岡紅葉) a1 の計3能力を unblock**。engine 変更を伴うので骨格凍結原則の例外手続き (bug/rule 根拠) + 広域回帰要。
- **B07005 action-restriction**「アクションできない」(self 行動禁止 + コンタクト中カットイン禁止、2 gate、新 engine 機構)。
- **observer contact-removal attribution** (D02008 a2 / B05066、byUid 帰属トリガ)。
- **B08078 外部 hook 発火** (最難、cluster2 DEFER)。
- (低 urgency) TSV category-drop systemic fix — 実測で live 影響ほぼ0、future-proof のみ。

## プロセス必須
- /card-wave skill。green候補は未certify なら信用しない。**certify green でも意味等価は自前で1対1突合** (PR138/B01011 教訓)。
- **certify は build-break/語義差を code 前に潰す ROI が高い** (本セッション: B07038 import / $self vs pick)。
- 非MVPカードは playwright 不可達 = behavioral vitest が実機検証の正 (runEffect + _drainAllEffectPicksForTest)。
  hirameki の `uid:'$pick'+target` carrier は hiramekiResolve 経路で解決される設計 → 直接 runEffect+drain では不解決、
  verbatim 再利用は byte等価 structural test が正。
- 状態 gate は ability.condition。heavy gates / engine拡張はフェーズ終端 (別クラスタ)。

## 状態 doc
- bug: .claude/bugs/index.base / defer: .claude/specs/DEFERRED-INDEX.md (B07034/PR231 DEFER + 赤魔術 known-gap 更新)
- 詳細: changelog-entries/2026-06-15-05 / session④: .claude/sessions/2026-06-15.md / memory.md
```

本セッション④ は 赤魔術 family残 3枚解禁 + 2枚 DEFER 完了 (push 済 `a65b0cf4`、CI green)。
次セッションは origin 同期確認 → `setcard:leave` hook engine拡張 or 次クラスタ選定から。`/clear` で新セッション推奨。
