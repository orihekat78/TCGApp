---
title: Official rule manual Ver.2.5 alignment
status: implementation
source: takaratomy rule_manual.pdf
checked: 2026-07-26
---

# Rule Manual Ver.2.5

## Scope

Official PDF filename is `0723_rule_manual_ver2.5`, 27 pages. Compared with
the local Ver.2.4 baseline. Source content is not retained here.

## Delta map

| Manual pages | Project handling |
|---|---|
| 8 | Area notes updated; no state-model change |
| 21 | Text validity split from icon presence; invalid optional Hirameki remains selectable and no-ops |
| 22 | Existing queue keeps already-fired effects resolving after ordinary invalidation |
| 24 | Existing condition readers gate continuous, triggered, declared, disguise; cutin/event semantics remain no-op use |
| 25 | Shared hand/deck/bound target filters evaluate an explicitly marked printed conditional keyword; ordinary grants stay off-scene only |
| 27 | Original-ability suppression preserves external grants and prior effects; printed PA-MR abilities remain suppressed |

## State and UI

- `PendingHirameki.effectValid?` is optional for saved-state compatibility.
- `false` keeps the same card detail and fire/skip UI, but fire queues no text.
- Non-scene keyword evaluation is read-only; an explicit provenance marker prevents external or text grants from carrying over.

## Edge cases

1. Invalid optional Hirameki: prompt, fire, no effect.
2. Valid Hirameki that becomes invalid after firing: queued effect still resolves.
3. Invalid event/cutin: legal use with no text effect.
4. Printed conditional keyword in hand/deck/bound: condition true matches, false does not.
5. External keyword grant: only works while the state-bearing card remains in play.
6. Original-ability disable: icon reference remains possible; printed text does not.

## Horizontal investigation

- `triggered.ts` is the shared triggered/optional-icon boundary.
- `candidates.ts`, deck predicate, and bound matching share the effective-keyword reader.
- `read/char.ts` remains the single effective-keyword reader for scene cards.
