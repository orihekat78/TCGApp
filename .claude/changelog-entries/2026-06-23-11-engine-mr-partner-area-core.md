# engine — MR partner-area core (rules/18 MR能力①② 配線、Phase 1 engine core)

**Round/Phase**: 2026-06-23 engine 投資 wave (ユーザー選択 A)。残最大の単一メカニクス = MR partner-area。
設計 spec ([engine-mr-partner-area-design.md](../specs/engine-mr-partner-area-design.md) +
[cohort](../specs/engine-mr-partner-area-cohort.md)) を TDD で additive 実装。**骨格凍結原則の例外 = 公式ルール
(rules/18) の配線**。Phase 1 = engine core のみ (Phase2=UI / 3=AI / 4=card wave SOLE 15)。

## 実装 (additive engine 拡張、touched src/engine 10 file)

新 optional slot `PlayerState.partnerAreaMR?: SceneCharacter|null` で real partner singleton を非破壊。

- **MR能力①** (相手ターン離脱→PA): 全 scene-leave primitive (removeToRemove/toDeck/toHand/toDeckBottom) に
  `shouldRedirectMrToPA` (turn.player≠owner ∧ def.isMR) → `placeMrInPA`。leave hook を redirect の **前** に emit
  (rules/18:22「リムーブによって発動する能力は発動」) し、destination から cardId を除去 (refresh 二重計上防止)。
  set/重ねは rules/16 で remove へ (PA 同伴せず)。uid を sentinel `partnerMR:<owner>` へ書換。
- **MR能力②** (MR 登場→既存 MR リムーブ): `applyMrEntryRemoval` を enter/switchEnter 冒頭で。現場 MR は
  cause='effect'+noMrRedirect (能力によるリムーブ=remove へ)、PA 常駐 MR は slot→remove。switchEnter は
  現場 MR 除去で空きが出たら victim 除去を skip (`freedSceneSlot`、rules/20 over-removal 防止、非 MR は旧挙動完全保持)。
- **PA-MR reader spine**: read.scene.byUid に sentinel 解決 (read.char.ap/lp/level/state/keywords 等が uniform に効く) /
  collectCardsInPlay に `partnerMR:` 登録 (triggered/declared) / read.char auraDelta・keywords・restrictsOpponent・
  continuousDelta に PA-MR bearer + **scope gate** (on-partner-area/always のみ) / flag.incrDeclaredUseCount +
  resetTurnFlags に slot 分岐 (【ターン①】) / auto-phase に PA-MR 活性 (stun→sleep) / declared-ability findCardOnBoard に
  sentinel 解決 + **canDeclaredAbility に PA scope gate** (on-scene 宣言は PA 不可、rules/18:38)。
- **isMR** = `def.isMR(cardId)` = `rarity.startsWith('MR')` (MR/MRP/MRCP)。dead stub `partner.toRemovedByMR`/
  `toPartnerAreaFromScene` (real partner 破壊上書き、caller 0) は削除。

## 回帰アイソレーション (非MR byte-identical)

全変更点は `def.isMR()` または `partnerAreaMR != null` でゲート → 非MR・slot=null 経路は完全 no-op。
**⚠ 訂正 (敵対review MAJOR-1)**: 「MR 0枚出荷→byte-identical」は誤り。**非MRカードのみ byte-identical**。
既登録 MR 5 num (B05066/B07079/B07093/B08032/B09054 +P=10 printing、`_reuse` 経由 registerAll) は
def.isMR=true で **MR①② が有効化** (rules/18 準拠の意図的変化)。smoke (MVP デッキ=MR0枚) winsA=498 不変は
非MR additivity の証跡。MR デッキ smoke は Phase 4 で検討。

## 検証 (全 green)

- **TDD decoy test 31件** (tests/engine/mr-partner-area/、RED→GREEN): MR① 全 leave verb / 相手ターン gate /
  refresh 単一計上 / set-stack rules16 / 【現場リムーブ時】hook∧PA移動 両立 / isNamed クリア。MR② scene+PA slot /
  同名 / cause:effect / noMrRedirect cross-turn / switchEnter self-correct 両分岐。PA-MR byUid / continuous aura±scope gate /
  keyword±scope gate / declared【ターン①】+reset / PA scope gate decoy / auto活性 stun特殊 / collectCardsInPlay triggered±scope。
- **4-lens 敵対 faithfulness review** (opus workflow): verdict=**REVISE** (BLOCK 無、挙動バグ/ルール逸脱 無)。
  rules 忠実性 lens=SHIP。fold-in: MAJOR-1 (claim 訂正 全 doc/card-comment)、MAJOR-2 (hook∧PA test 追加)、
  MINOR×4 (switch PA-slot 分岐 test / set-stack per-verb test + toDeckBottom set 欠落修正 + コメント訂正 /
  triggered scope decoy / canDeclaredAbility PA scope gate 追加)。残 NIT (pop 脆弱性 / 'mr-removed' dead union) は
  [BUG-154](../bugs/BUG-154.md) へ。
- typecheck 0 (両config) / vitest 2969→2999 (+30、1 skip) / smoke winsA=498 exc0 baselineOK /
  e2e 123pass+1skip / eslint 0 errors。

## 暫定保守解 5件 (要公式Q&A、[BUG-154](../bugs/BUG-154.md))

①MR① 中間状態順序 ②MR② による PA 常駐 MR 除去分類 ③PA-MR targetability (candidates.ts 未変更=DEFER) ④MR②×switch 順序
⑤PA-MR auto-phase 活性 (rules/05① 明示外)。read/mutate 非対称 (B06066 self-mutate cost) は cohort wave 時 SOLE/MULTI 再判定。

## 教訓

設計 spec は実装で簡素化しうる (3-caller 変更→switchEnter self-correct / piecemeal reader→byUid 拡張)。
「byte-identical」claim は **登録カードの rarity を実 grep** で裏取りすべき (cohort の vacuous 前提が stale だった)。
