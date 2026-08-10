# Wave 3 Causal Presentation Contract

## Scope

- Add a public, versioned causal event graph and a presentation-only queue.
- Preserve rules, GameState outcomes, legacy replay decoding, and every AI control.
- Do not integrate animation into MATCH until Wave 4.

## Persistence and identity

- `GameState.log` accepts `LegacyLogEntry | CausalLogEntryV1`.
- A caller installs a fresh public `sessionId` before causal events are appended.
- `GameState` owns the monotonic sequence. `eventId` is `${sessionId}:${sequence}`.
- `ReplayLogV3` state frames are the sole playback authority. They persist a read-only projection of accepted board, log, and causal state; live resolver continuations are excluded, so artifacts are not resumable saves. Validated contiguous patches, digests, and causal deltas restore playback without engine or AI dispatch. V1/V2 retain explicit legacy move decoders.
- New match, replay load, seek, unload, or route leave starts a new presentation epoch and invalidates stale timers.

## Public event schema

- Required: `schemaVersion: 1`, `eventId`, `sessionId`, `sequence`, `actor`, `kind`, `targets`, and typed `outcome`.
- Optional typed edges: `parentEventId` and `correlationEventId`.
- Public references require `visibility: 'public'`; no hidden card ID, private target, or traceable secret may enter a causal event.
- `appendCausal()` allocates identity and derives compatibility text. Producers cannot provide an arbitrary ID, sequence, action, or result.
- Legacy normalization never publishes `target` or `result` unless a future explicit public projection certifies them.

## Graph validity

- Sequence is positive, unique, contiguous, and strictly increasing within a session.
- Parent and correlation edges must exist, share the session, and precede the child.
- Unsupported versions, duplicate IDs, gaps, forward edges, missing edges, cross-session edges, and cycles fail validation.
- Presenters consume one validated traversal ordered by sequence. They never parse free-form text.

## Event kinds

- `use`, `declare`, `select`, `draw`, `discard`, `zone-move`, `sleep`, `stun`, `value-change`.
- `evidence`, `case-resolve`, `negate`, `fizzle`, `cancel`, `game-result`, and `summary`.
- Outcome data is a closed discriminated union; unknown outcome variants fail normalization.

## Presentation Queue

- One queue per `sessionId`; total outstanding work, including the active item, is capped at 64.
- Only repeated result events with the same cause, kind, and public outcome may aggregate.
- Sources, decisions, cancellations, negations, fizzles, case resolution, and terminal results never drop.
- If 65 non-aggregatable critical entries are offered, enqueue applies temporary backpressure. The canonical log cursor retries exactly once after capacity is released.
- Every aggregate and summary retains its exact canonical causal-log sequence range. Compact `eventIds` are a trace sample, never the authority.
- In a hidden tab, sequential motion is suppressed. Restore emits one redacted summary from the validated graph.
- Replay seek discards the queue and rebuilds from the current normalized event position.
- At a terminal result, draining lasts at most 3 seconds; the remainder becomes one final summary. Skip consumes queued and committed-but-not-yet-admitted work immediately.

## Control isolation

- Persistent `presentationSpeed` remains in `metaStore`.
- Transient `presentationPaused`, `presentationStepToken`, and `presentationSkipToken` live in a presentation store.
- Presentation actions do not dispatch an engine action, resolve a choice, advance AI, or mutate `aiSpeedMs`, `isAiPaused`, or `aiStepCounter`.
- Only a later independent CPU action may await queue completion. The currently resolving effect never waits.

## Acceptance

- JSON round trip, legacy fallback, public-data rejection, malformed graph rejection, and stable traversal pass.
- Queue cap, aggregation, hidden-tab summary, epoch reset, seek rebuild, terminal deadline, and immediate skip pass.
- Normal, speed, pause, step, skip, and reduced-motion preserve normalized action order, graph causality, and final GameState.
