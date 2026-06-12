# Task D カードバッチ wave#1 — 解禁 35 枚 (敵対検証 workflow 通過、ALL_CARDS 1057)

**Round/Phase**: 2026-06-12 session — Task D engine 拡張 (entry 2026-06-12-01) の対応カード。

### 実装カード (35 枚 = 21 種 + P 版 14)

| gate | カード |
|------|--------|
| E1 hand-count | B09092/P (キール)・B07081 (安室透)・B04064 (「消えろ!!」) |
| E2 scene→deck | B07080/P (風見裕也)・B04011 (毛利小五郎)・B08058/P (宮野志保) |
| E3 FILE-zone | B09021/P (服部平次)・B04068/P (安室透)・B05050 (大上祝善)・PR100/PR106 (宮野厚司) |
| E4 grant | B08037/P (鈴木園子)・B09028 (大滝悟郎)・PR181/PR187 (目暮十三)・B09054/P (赤井秀一&世良真純)・B09041/P (京極真)・B07090/P (「えええええ!?」)・B08029/P (小も大を兼ねる)・B08032/P (鈴木園子&京極真)・B09032 (溝端理子)・B07079/P (佐藤美和子＆宮本由美)・B02014 (少年探偵団の活躍) |

### authoring プロセス (6 クラスタ並列 workflow + 敵対検証)

- author: 公式 api json (feature/q_a/スタッツ) から全句マッピング → 検証: 全句 1 対 1・実 engine args・
  CardDef 整合・公式 Q&A 裁定との突合 (12 agents)。検証側は **vitest を実走して反証** し、
  fix 9 枚 / block 4 枚を検出 → 修正版 fileContent で出荷
- **検証が発見した必須パターン**: 明示 Pattern A (uid:'$pick'+target) を pick carrier にすると
  human 経路 (初期 walk push) で後続 step の bind が喪失し恒久 no-op → **短縮形 carrier (runtime push →
  continuation ctx 共有) が必須**。B07090/B09032/B07079/B02014/B08029 を是正。
  card-authoring-convention の新規約として各カードヘッダに明記

### バッチ中に追加した engine micro-fix (additive)

- **guard 自己ガード除外**: アクション対象キャラ自身はガード不可 (B09028/B09054 公式 Q&A)。
  sleepGuard 導入で「対象=sleep」と「ガード候補=sleep+flag」の集合が重なり顕在化 →
  guard.candidates/canGuard に excludeUid 追加、呼出 4 箇所 (state-machine/AI/UI×2) に配線
- **charGrantKeyword PA 短縮形** (B09032 解禁条件): ATOM_PICK_SPEC + handler push 分岐
- B05066 の stale コメント修正 (「MR能力 engine 対応済」は誤り — isMR 配線は全体未実装)

### DEFER (DEFERRED-INDEX.md に記録)

mustGuard (B09040) / auraGrant (B09024) / partner-area 構造 (B07045/B09047/MR能力) /
name-designation (B09003/B09108/B09111/B09052) / multi-card sceneEnter (B09010) /
nested filter dyn (B08060/B05102) / until-N discard・reveal verb (B07076/B07100 等)。
「パートナーエリアでも宣言できる」句は vacuous 出荷 (B07093 前例、今回 B07079/B08032/B09054 が追随)

### 検証 (全 green)

- full vitest **1961 pass / 1 skip / 0 fail** / typecheck clean / eslint errors 0
- smoke:1000 exceptions=0 timeouts=0、baseline 一致 (avg 10.86)
- e2e: 既存回帰 22 pass + 新規 `task-d-extensions-2026-06-12.spec.ts` 4 pass
  (decoy 込み text-faithfulness: cost 対象 filter / FILE 表向き化の非降下 / fileTopMatches 分岐 / 分割名 pick filter)
- ALL_CARDS: 1022 → **1057**
