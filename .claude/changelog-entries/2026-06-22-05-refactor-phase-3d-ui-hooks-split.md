## refactor(ui): Phase 3d — UI hooks 分割 (useActionsPanelFlow / useEngineDispatch)

肥大した UI hook 2 ファイルを barrel + サブファイルへ分割 (挙動完全不変・100% byte-identity)。

- **useActionsPanelFlow.ts** (909 行) → barrel + `useActionsPanelFlow/{cost,enumerators,flows}.ts`。
  cost-builder/label helpers・候補列挙(enum*/can*)・run*Flow の 3 関心事に分離。関数 body 無改変移送。
- **useEngineDispatch.ts** (677 行) → barrel + `useEngineDispatch/{types,can-check}.ts`。
  EngineAction/ContactChoice/DispatchResult/Player 型と isAllowed (前段ガード) を抽出。
  runEngineAction + `_justDeclaredAxId` + dispatchEngineAction は barrel に同居 (cross-module
  shared-mutable 化を避け byte-identity 維持)。
- 旧 file path を barrel として残し全 importer (Playmat + driver + modal host + 約30 test) を **無改変**。
- 着手前フルパネル設計レビュー (opus 4 lens + critic、690k tok、BLOCKER 0) で scope を補正:
  EngineAction の family「型化」+ runEngineAction 分離 (`_justDeclaredAxId` accessor 化) は
  switch exhaustiveness ガードとセットで設計すべきため **新 Phase 3e へ繰り延べ**。
- 決定論 codemod + 独立 HEAD verifier (移送 body の md5 突合) で byte-identity を機械保証。
- 検証 GREEN: tsc0 / vitest 2783 / smoke winsA=498 / e2e 26 / eslint delta0 (125) / 規約 lint 8 本 errors=0 /
  slot 11 不変 / side-channel 12ch 不変。
