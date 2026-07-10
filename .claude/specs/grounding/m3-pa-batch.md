# M3 前処理: PA(パートナーエリア) 宣言19+発動5 batch dossier

出典系譜: MEMORY `project-mr-partner-area-design-2026-06-23.md`
(「PA宣言19+発動5 authoring」) → `compiler-demand-signal-2026-07-02.md` L29 (件数のみ、ID 無)
→ `.claude/specs/engine-mr-partner-area-cohort.md` (2026-06-23、唯一の ID enumerate 済 yield 表)。
**「19+5」の逐語 ID リストはどのファイルにも存在しない** — 最も近い一次データは cohort 表の
MR 25 unique (SOLE15+MULTI10) + 別クラスタの非MR PA宣言カード群。M3 着手時に
`npm run ground` で対象 25+α を再確定すること (件数不一致は許容し実測優先、CLAUDE.md 方針通り)。

## 1. 対象 unit 全列挙 (現状把握できる候補プール)

### A. MR PA cohort (engine-mr-partner-area-cohort.md、25 unique)
- **SOLE-blocked 15** (PA-slot + read/char PA-MR 走査のみで到達):
  B05027, B05086, B05106, B06003, B06037, B06066, B06084, B06098, B07001,
  B07015, B07065, B08002, B08019(cohort内重複掲載—非MR注記あり要確認), B08046, B08062
  ※ B05027/PR263 は **XL 別枠** (partner-area card slot + MR enumeration 拡張、40枚デッキ MR 常駐 —
  本 UI batch のスコープ外、別 engine 投資)。
- **MULTI-gate 10** (PA-slot に加え別 gate 要): B05005, B05045, B06074, B07030, B08093,
  B09002, B09070(=batch1 出荷 MR 相当、UI gap 別), B09108(★shipped, UI DEFER), B09109, B09110
- **既出荷5 (scope補正待ち)**: B07079/P, B08032/P, B09054/P, B07093, B05066
  — engine MR①②は有効化済だが card 個別「PAでも宣言」句が `scope:'on-scene'` のまま (B07079.ts:44 実測、
  未補正)。DEFERRED-INDEX L167「card固有 scope 補正は Phase 4 wave」= 本 batch の一部。

### B. 非MR PA宣言クラスタ (DEFERRED-INDEX 各所)
B08019(scope配列非対応・非MR)、B06037(VERIFY_NG scope gap)、B07039(cost kind出荷済/pick UI未配線)、
B07049(remove∪PA union pick)、B07030(remove→PA pick型verb不在、MULTI兼掲)、B09039(PA∪remove union)、
B09055(PA source不在+union)、B07061(逆方向pick verb不在)

**内訳の暫定分類**: 「宣言」= declared ability 側 gap (A既出荷5 scope補正 + B09108 UI + B08019/B06037/B07030/B07049/B09039/B09055/B07061 の pick/scope gap) ≈ 12〜19 の幅、「発動」= 常時/triggered 側 (MULTI-gate 10 の一部 aura/trigger 系、例 B08062 aura PA走査拡張、B09070 flag) ≈ 5 前後で件数レンジは概ね符合するが **1 対 1 の確定リストではない**。

## 2. DEFER 理由行 (引用) + engine 裏取り

- **B09108.ts:37-40** (shipped exemplar, comment 引用): 「a2『パートナーエリアでも宣言できる』
  scope:'on-partner-area'。engine側 canDeclaredAbility/findCardOnBoard は partnerMR uid 対応済。
  ⚠ human の PA 発 宣言 UI (source 列挙/表示) は PA宣言19 batch へ DEFER」
- **DEFERRED-INDEX L1112-1116**: UI gap 3点 (PartnerArea 非描画 / enumDeclaredAbilitySources 未対応 /
  flows source cardId 解決未対応)
- **engine-mr-partner-area-cohort.md L36-40 (BUG-154)**: read/mutate 非対称 — `read.scene.byUid` は
  PA-MR 解決するが `mutate/char`・`mutate/scene` の findChar は scene-only。B06066 のような
  self-mutate cost (宣言コストで自身sleep) は PA 発動時に no-op の恐れ (MULTI 側の追加 gate)。

### engine 実装状況 (src/engine Grep/Read で裏取り済)
| 項目 | 状況 | 根拠 |
|---|---|---|
| `enumDeclaredAbilitySources` | scene/case/hand のみ列挙。`partnerMR:` source **無し** | enumerators.ts:65-135 実読、grep 該当0件 |
| `triggered.ts` collectCardsInPlay | `partnerMR:${p}` sentinel を area:'partner-area' で登録済 (triggered/on-partner-area 両対応) | triggered.ts:180-184 |
| `triggered.ts` scope 解決 | `on-partner-area` → `area==='partner-area'||'scene'` で解決 (declared/triggered 共通ヘルパ) | triggered.ts:199-200 |
| `PartnerArea.tsx` | `partner` (通常パートナー) と `paCards` (wave-12 一般PA枠) のみ描画。**`partnerAreaMR` 用 prop/描画が存在しない** | PartnerArea.tsx 全読、grep該当0件 |
| `flows.ts` resolveDeclaredSourceCardId | `hand:`/`partnerMR:` uid 未対応とコメントで自認 (BUG-172 由来) | flows.ts:257-260 |
| card 側 scope | B07079 (既出荷5代表) は declared a1/a2 とも `scope:'on-scene'` — 「PAでも宣言」句が未反映 | B07079.ts:43-44,66-67 実読。他4枚 (B08032/B09054/B07093/B05066) は同型 comment パターン想定、**M3 で個別 ground 必須 (未確認)** |

## 3. UI 工事 3分類

**(A) 新規 modal — 0件**: DeclareCardNameModal 等の既存 modal で足りる。新規 modal 不要。

**(B) 既存流用 (改修) — 3件**:
1. `PartnerArea.tsx` — `partnerAreaMR?: PartnerOnBoard|null` prop 追加 + MR tile 描画
   (既存 `paCards` ブロックと同パターン流用、`onClick`/`isCandidate` は partner tile 実装を複製)
2. `enumerators.ts` `enumDeclaredAbilitySources` — 4番目のソースとして `partnerAreaMR` を
   scene と同型ループで追加 (uid=`partnerMR:${player}`)
3. `flows.ts` `resolveDeclaredSourceCardId` — `partnerMR:` prefix 分岐追加 (state.players[p].partnerAreaMR.cardId)

**(C) 配線のみ (engine/card 側) — 19件目安**:
- 既出荷5枚の scope 補正 (`on-scene` → `on-partner-area` or 該当ability分離)
- 非MR PA宣言クラスタ (B08019 scope配列 or 到達経路確定、B06037 scope是正) — こちらは **(B) 完了後でも
  非MR には partnerAreaMR slot が無いため別途「非MR PA常駐カード枠」検討要 (B07030/B08093 が使う
  一般 `paCards` 枠と統合できるか要設計判断、M3 冒頭で裁定)**
- B07039 宣言 cost pick UI (costParams 敷設済、fallback=auto-pick → 専用 pick UI へ)

## 4. engine gap 有無

**(B)以外は engine gap 無し** (declared/triggered dispatch・scope resolution は shipped)。
残る engine 相当作業:
- BUG-154 (mutate 層 PA-MR 非解決) — B06066 型「PA発動+self-mutate cost」のみに影響、事前に
  対象カードで再現確認要
- B05027/PR263 の XL (partner-area card slot for 40枚デッキ MR 常駐 + candidates 拡張) は
  **別スコープ、本 batch に含めない**
- 非MR PA常駐カード枠の要否裁定 (§3-C) — 設計判断であり厳密には engine 変更ではなく既存
  `paCards` 拡張で足りる可能性が高い (B07030/B08093 は既に「remove→PA」verb 不在が主 gap)

## 5. 実装順 + tier

1. **UI 基盤 (T2)**: PartnerArea partnerAreaMR描画 → enumDeclaredAbilitySources → flows resolveDeclaredSourceCardId
   の3点セット (§3-B)。新 UI 部品「型」相当 (tile pick 経路が1本増える) — **T3 判定、Playwright 必須**
   (B09108 で「現場からの宣言」は実機済、PA 発は未踏のため CLAUDE.md 「Playwright 1試合通し」対象)
2. **宣言19 (T1〜T2)**: 既出荷5枚の scope 補正 (機械的、clone的) は T1。非MR クラスタ (B08019/B06037/
   B07049/B09039/B07061) は pick/union 設計を伴うため T2、代表1枚(B08019 or B06037)を family exemplar
   として Playwright 「画面処理=テキスト文言」検証 (T3 相当)。
3. **発動5 (T2)**: MULTI-gate 側の trigger/aura 系 (B08062 aura PA走査拡張、B09070 flag 等) — 各カード
   個別 gate 解消後に card-phase。BUG-154 該当カード (B06066 系) は self-mutate cost の PA 発動時
   挙動を先に engine probe で実測してから着手。

## 未検証・要確認 (M3 冒頭で優先)

- 「19+5」の正確な ID 24〜25枚の再確定 (本 dossier は 25 unique MR + 非MR 周辺8件 ≈ 33候補プールを提示。
  重複排除・確定は `npm run ground` 一括実行で)
- B08032/B09054/B07093/B05066 の scope 実測 (B07079 のみ実読、他4枚は同型と推定)
- 非MR PA常駐カード枠を `paCards` 統合にするか新設にするかの設計裁定
