### engine additive — `setNextHintBan` / `nextHintBanned` turn-flag (engine-only)

engine-first フェーズ wave-1。全 561 未実装カードの distinct エンジン拡張需要を grounding 再採寸
([engine-extension-plan-2026-06-30.md](../specs/engine-extension-plan-2026-06-30.md)) → 真に未実装かつ
pure-additive な **self use-restriction turn-flag** を追加。

- **`setNextHintBan` verb + `nextHintBanned` turn-flag** — 「このターン中、自分はネクストヒントできない」
  (B06104/P・B09019/P・B09105/P)。cluster6 `setEventUseBan`/`eventUseBanned` の完全 mirror。
  `eventUseBanned` が手札使用/ネクストヒントの **event のみ** (step2) を gate するのに対し、本フラグは
  `canStartNextHint` で **ネクストヒント行動全体** (step1 FILE→手札 含む) を不可にする (rules/12「ネクストヒント
  できない」)。手札の使用 (rules/05 01.、別行動) は無影響。`resetTurnFlags` がターン境界でクリア。

配線 7点 (setEventUseBan mirror): AtomVerb union / TurnScopedFlags field / `atomSetNextHintBan` handler /
dispatch case / validate.ts ATOM_VERB_MAP / scripts/taskA-validate-specs.cjs VERBS (sync-whitelist 機械検証) /
canStartNextHint gate / resetTurnFlags clear。

既存登録カード未使用 (engine-only、card 追加は別 phase) ⇒ smoke baseline 不変
(winsA=498/timeouts0/exceptions0、決定論一致)。tsc0 / vitest 3433 (baseline+専用テスト4) /
sync-whitelist green / 8lint err0。opus 4-lens 敵対 review。
