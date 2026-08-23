## QA Wave 46 — End-phase activation stays outside main actions

- Certified twelve official end-phase reactivation records across CT-P07–P10.
- Real public `endTurn` paths cover direct, picked, optional, zero, PA, and PA-MR sources.
- Active characters cannot reason or act again before their next self main phase.
- Stun-to-active replacement produces sleep on direct-self and picked-target routes.
- BUG-330 adds one shared main-action admission boundary for turn owner and phase.
- Reasoning, action, hand use, next hint, declared, and partner ability share the gate.
- Opponent-turn and unresolved end-phase decisions reject every covered action unchanged.
- Advanced coverage from 1,290 to 1,302 matched; test-missing falls to 1,662.
