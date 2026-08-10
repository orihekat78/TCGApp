# Causal Presentation Migration Table

Current-code migration map for the [Wave 3 causal presentation contract](2026-08-04-wave3-causal-presentation-contract.md). It describes implemented paths only.

## Boundary

`state.log` feeds `normalizedGameLogForUi`; causal entries stay causal, while legacy entries become safe nodes with no copied target or result. `state.gameResult` remains the authoritative terminal result.

| Surface | Producer / legacy kind | Causal kind and outcome | Public visibility / redaction | Consumer and fallback | Test owner |
| --- | --- | --- | --- | --- | --- |
| Toast | Any `mutate.log.append`; legacy action/result | Direct causal entry, or `appendLegacyAsCausal` mapping | Causal refs are public only; legacy targets/results are omitted | `RecentActionToast` reads latest normalized node with its own timer; currently unmounted, no queue fallback | `tests/ui/components/RecentActionToast.test.tsx` |
| Contact | `contact-judge`, `HIT` / `MISS` | `declare`, `contact` tag, `state: success` / `failed` | No legacy target/result copied; causal refs public only | `ContactFlash` reads latest normalized contact node; currently unmounted, no queue fallback | `tests/ui/components/ContactFlash.test.tsx` |
| Refresh | `refresh`, reshuffle count result | `zone-move`, `refresh` tag, no outcome | Count/result is not promoted to a public causal outcome | `RefreshOverlay` reads latest normalized refresh node; currently unmounted, no queue fallback | `tests/ui/components/RefreshOverlay.test.tsx` |
| Log panel | Any `gameState.log` entry | Preserves validated causal kind, tags, public refs, and safe outcome | Exact `gameState.log` path uses normalized nodes. Other `entries` use `redactLogEntryForViewer` legacy rendering | `LogPanel`; generic non-identical entries are the legacy fallback | `tests/ui/components/LogPanel.test.tsx` |
| Result | `gameResult` mutation; legacy terminal state may have no log event | `game-result`, `state: success` when causal fallback is appended | Result source/target are public refs; terminal authority is `gameResult`, not a fabricated event | `VictoryOverlay` and meta `ResultScreen`; direct `gameResult` is fallback when no causal terminal event exists | `tests/ui/components/VictoryOverlay.test.tsx`; `tests/meta/ResultScreen.mvp.test.tsx` |
| Replay | V3 causal replay frames; V1/V2 legacy replay logs | Causal nodes preserved; legacy nodes normalized by the same mapping | Replay log/state is projected for its viewer before UI use | `useReplayDriver`, `ReplayPanel`, and meta `ReplayScreen`; V1/V2 decode is the compatibility fallback | `tests/ui/hooks/useReplayDriver.test.tsx`; `tests/ui/services/replayViewerProjection.test.ts` |

## Queue ownership and no-double-queue rule

- `state/store.ts` admits each committed causal sequence once through the session-scoped singleton `PresentationQueue`. Legacy nodes normalize for read-only consumers and never enter that queue.
- `PresentationCoordinatorHost` is the sole queued animation consumer. It selects contact and refresh variants from the same causal stream; `App` and meta `RealMatchView` suppress it during replay.
- `RecentActionToast`, `ContactFlash`, and `RefreshOverlay` have independent timers but no queue and are not mounted by current application routes. Do not mount any beside the host unless one surface is explicitly suppressed or removed.
- `LogPanel`, result surfaces, and replay summaries may read normalized data or `gameResult`; they never enqueue. Replay rebuilds the current queue position for validation, while the host remains suppressed.

## Source ownership

- Normalization and legacy safety: `src/engine/log/causal.ts` and `src/ui/presentation/normalizedLog.ts`.
- Admission and rendering: `src/ui/state/store.ts`, `src/ui/presentation/coordinator.ts`, and `src/ui/presentation/PresentationCoordinatorHost.tsx`.
- Replay privacy and position rebuild: `src/ui/hooks/useReplayDriver.ts` and `src/ui/services/replayViewerProjection.ts`.
