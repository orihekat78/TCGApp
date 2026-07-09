### CARD PHASE hybrid-batch6 — 3-4行 unit 最終掃き 6 printings = hybrid pipeline 完了 (engine変更0)

- **6 printings 出荷**: PR290+PR296 (twin) / B05023 「小五郎のおごり」型 / B07005 毛利小五郎 (妃英理 bond trio) /
  PR067 探偵の目 (case、partnerColorsOverride+sceneCapOverride) / B07054。yield 5 EQ + twin / 11 unit。
- **★hybrid pipeline 完了宣言**: refuse-1/2/3/4行 全層掃き終わり (batch1-6 累計)。残 pool = DEFER cluster のみ
  → 次は engine mini-wave (優先 cluster 8 種 = DEFERRED-INDEX batch6 節末尾)。
- **tooling**: codegen が `grantKeywords: string[]` を closure へ自動変換 (JSON pipeline で条件付き keyword
  grant family 解禁、B07005 初例) / whitelist += selfActionBan・selfCutinBanInContact (W2 出荷 boolean、
  stale 4-5例目) / prepare が 3行+ unit を選定対象に (moreLine 拡張) / BUG-130 lint を orphan-$pick
  参照検出に精緻化 ($picked 誤爆 + 複数 standalone 誤 rider を解消)。
- B09067 は verify lens が **BUG-161 pre-walk hazard** (bound-conditional 両枝の Pattern-A pick 過剰
  queue) を検出して正しく棄却 — DEFER 送り。
- probe 19 test green (gen 2 + manual 17、B07054 then 枝の pick LIFO 順を実測 pin)。
- gates: tsc 0 / vitest 4506→**4525** pass +1 skip / smoke winsA=472 不変 exc0 / 8 lint err0。
