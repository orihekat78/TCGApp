### feat(engine): mega-wave W6 後半 — structural step7-11 (hirameki defer / reservedEffects / startContact / leave:intercept / declared 拡張)

- **step7 (row70)**: `setEvidenceGainSuppress` verb + `gainSelfEvidence` consume-on-read gate +
  **hirameki defer 再順序化** — actionJudge が pendingHirameki を peek→gainDeferred mark、
  hiramekiResolve が fire/skip 決定後に deferred gain (fire 時は queue 済 suppress を先に解決)。
  B02088/B03126「相手はこのアクションによって証拠を得られない」— fire なら獲得も evidence:gain emit
  も不発 (依存 trigger ごと、公式Q&A)。`ActionGainCtx` 構造的部分型で _deleteContext 済 ax 非依存。
- **step8 (row75)**: `GameState.reservedEffects` queue (**GameState 形状追加**) + `reserveEffect` verb +
  listeners/reserved-effects.ts — コストで源カードが離場する「ターン終了時〜」(B08069 turn-end) /
  「このターン中、次に〜したとき」(B01058 next-match) をカード位置非依存で予約・single-fire。
  endTurn が未消費 next-match を失効。
- **step9 (row65)**: `startContact` 本実装 (旧 placeholder) — `action.startFromEffect` bootstrap
  (declare/guard/sleep/actedCharThisTurn 全スキップ、アクティブ対象可) + `generatedByEffect` で
  **action:end 非 emit** (公式Q&A「これはアクションではない」)。cutin/変装/AP 判定は既存 advance 再利用。
  B06020/B06042。
- **step10 (row9)**: `leave:intercept` pre-splice consult — `consultLeaveIntercept` (純関数) +
  removeToRemove redirect 分岐 (`prevented`/`redirectedTo`)。B01092 hand redirect (optional・**AI-only**、
  human-defender window は DEFERRED-INDEX に LOUD 記録) / B01039 kept-in-scene (on-set-host 強制、
  2枚重ね両消費)。新 cond `leaveCauseIn`/`leaveOwnerIs`、cause='effect' は byPlayer 帰属 gate。
- **step11 (row999 item3+4)**: findCardOnBoard hand sentinel + hand-declared scope 対称 gate (B06103 基盤) +
  `findDeclaredAbility` 共有 helper (faceUp set-card rider の on-set-host declared を can/use/activate/
  enumerators 4 呼出点で解決 — B07014 full 解禁) + `removeAreaToDeckTop` verb (P42)。
  canDeclaredAbility は不明 abilId/faceDown rider を fail-closed 化。
- probe: tests/cards/engine-mega-w6b.test.ts 32 tests (dispatch 経路 / AI drain / 帰属 decoy / turn 境界)。
- DEFER/nits = DEFERRED-INDEX「megaw6b」節 (human-defender window 最重要 / step8 queue-time pre-pick /
  scalar side-channel / effect-cause threading partial)。
