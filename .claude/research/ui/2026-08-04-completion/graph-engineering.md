# Applied property/event graph

## Purpose and boundary

The applied graph is an in-memory, append-only public event graph for a match.
It explains *why* a visible change happened; it is not a Neo4j deployment and
does not replace `GameState`. This follows the useful graph-model split between
labels/types/properties and instances described by [Neo4j data modeling](https://neo4j.com/docs/getting-started/data-modeling/tutorial-data-modeling/).
Its directed event edges are RDF-like subject/predicate/object statements, but
the runtime is TypeScript rather than an RDF store; see [RDF 1.2 Concepts](https://www.w3.org/TR/rdf12-concepts/).

## Canonical event shape

`CausalLogEntryV1` is the persisted event/property record:

```text
Event(sessionId:sequence, actor, turn, kind, tags, outcome)
  -[:PARENT_OF]-> Event
  -[:CORRELATES]-> Event
  -[:SOURCE]-> PublicCausalRef
  -[:TARGET]-> PublicCausalRef*
```

`src/engine/log/causal.ts` allocates IDs, projects only public locators, and
normalizes both `CausalLogEntryV1` and legacy log rows into `NormalizedLogGraph`.
Legacy `target`/`result` text is intentionally not copied into causal records.
This is the local equivalent of choosing stable identities and mandatory shape
rules; Neo4j documents uniqueness, existence, type, and key constraints at
[Constraints](https://neo4j.com/docs/cypher-manual/current/schema/constraints/).

The persisted v1 vocabulary is closed and fail-closed:

```text
kind = use | declare | select | draw | discard | zone-move | enter | sleep |
       stun | activate | face-change | value-change | evidence |
       case-status-change | case-resolve | negate | fizzle | cancel |
       game-result | summary
outcome = none | count(card|evidence|lp|ap|level) | move | state |
          case-status | face-change | summary
state = success | failed | cancelled | negated | fizzled | sleep | stun | active
```

Unknown fields, kinds, outcomes, state literals, schemas, or mismatched
`face-change`/`activate` outcomes reject before presentation or replay use.

## Producers → canonical normalization

| Producer | Contribution | Canonical path |
| --- | --- | --- |
| `causal.ts` | session allocator, typed event, public projection | `appendCausal` → validated log |
| `effect-causal.ts` | root/use or declare, selection, operation, completion | parent-linked causal trace |
| `flow/action-case.ts` | evidence gain or suppressed action | `evidence` or `fizzle` event |
| `mutate/gameResult.ts` | first terminal result | `game-result`; structured resolver owns its terminal append |
| legacy engine log | compatibility input | `appendLegacyAsCausal` / `normalizeGameLog` |

## Consumers

`PresentationQueue`/coordinator consumes ordered public events; `PresentationCoordinatorHost`
renders cause→target→result→settle and anchors to visible board areas. It has
contact and refresh variants. `RecentActionToast` is a short-form consumer;
`ContactFlash` and `RefreshOverlay` consume their respective visible moments.
`LogPanel` consumes normalized log history. `VictoryOverlay`/Result consume the
terminal `gameResult`. Replay state frames carry causal deltas; replay projection
is read-only and does not hydrate pending resolver runtime.

## Invariants, fallback, and tests

- One active session; event IDs are unique, sequences contiguous, and all edges
  point backward within the same session. Allocator `nextSequence` must equal
  the next physical append position; cycles, missing edges, reordered rows, and
  unknown schemas reject.
- Public projection rejects stale locators and hidden set/evidence/file identity.
  Consumers receive labels/refs, never hidden raw targets. A face-up assisted
  partner remains public and keeps its identity through replay projection.
- First terminal result wins. A structured effect trace emits its own terminal
  event once; later terminal writes are no-ops.
- If no causal session exists, legacy rows normalize to ordered nodes without
  invented edges. Missing board anchors degrade to the presentation strip.
- Coverage: `tests/engine/causal-log.test.ts`, causal effect tests,
  `tests/ai/replay/state-frame.test.ts`, `tests/ui/presentation/`, and
  `tests/ui/services/replayViewerProjection.test.ts`.
