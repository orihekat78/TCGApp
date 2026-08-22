## QA Wave 33 — stacked-card semantics and physical identity

- Certified twelve official QA records across sixteen printings through fourteen public-dispatch regression cases.
- Proved stacked cards remain outside the scene-character population and expose only their count to rules evaluation.
- Proved stacked names, traits, colors, abilities, enter hooks, and leave hooks do not participate in gameplay.
- Covered partner-area declaration, hand-use entry, declared costs, normal action completion, and end-phase removal routes.
- Preserved exact selected card IDs through JSON round-trip and host departure while keeping legacy count-only stacks compatible.
- Fixed `handStackUnder` so a revealed hand card no longer becomes `back-card` in authoritative GameState.
- Kept B08002's distinct answer hash as an independent manual-semantic adjudication despite sharing the question family.
- Deferred authorization-clone identity hardening, multi-candidate stack-cost selection, and public stacked-card UI/replay visibility to separate follow-up work.
- Advanced exact official-QA coverage from 1,194 to 1,206 matched records; test-missing falls from 1,770 to 1,758.
