# Rule Manual Ver.2.5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the game engine and rule references with the official Ver.2.5 manual.

**Architecture:** Preserve the existing effect DSL. Add a validity marker only at the optional Hirameki boundary. An explicit card-definition marker distinguishes printed icon-conditioned keywords from ordinary grants across scene, deck, and bound filters.

**Tech Stack:** TypeScript, Vitest, React/Zustand, official manual Ver.2.5.

## Global Constraints

- Official text is source-only: record section/page references and paraphrases, never copied body text.
- External APIs remain compatible; new state is optional.
- Keep portrait assumptions out of verification; use 851x393 landscape if UI is touched.

---

### Task 1: Capture Ver.2.5 rule deltas

**Files:**
- Modify: `.claude/rules/03-field-areas.md`, `15-abilities-effects.md`, `17-icons.md`, `13-keywords.md`, `19-special-rules.md`
- Create: `.claude/specs/rule-manual-ver2.5.md`

- [x] **Step 1: Write the rule mapping**

```markdown
| Manual | Engine contract |
| --- | --- |
| p.21 | invalid optional Hirameki remains activatable and resolves no effect |
| p.25 | printed conditional keyword is recognised outside scene |
```

- [ ] **Step 2: Verify the mapping has no copied official body text**

Run: `rg -n "Ver.2.5|有効|ヒラメキ" .claude/rules .claude/specs/rule-manual-ver2.5.md`
Expected: section references and project paraphrases only.

### Task 2: Preserve optional Hirameki activation when its effect is invalid

**Files:**
- Modify: `src/engine/listeners/hirameki.ts`, `src/engine/listeners/triggered.ts`, `src/ui/state/store.ts`, `src/ui/hooks/useEngineDispatch.ts`
- Test: `tests/engine/rule-manual-ver2.5.test.ts`

- [ ] **Step 1: Write failing real-flow test**

```typescript
expect(pending).toMatchObject({ effectValid: false });
expect(dispatchEngineAction({ type: 'hiramekiResolve', choice: 'fire' }).ok).toBe(true);
expect(after.players.self.deck).toEqual(before.players.self.deck);
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npx.cmd vitest run tests/engine/rule-manual-ver2.5.test.ts`
Expected: FAIL because invalid optional Hirameki is not surfaced.

- [x] **Step 3: Add the optional validity marker and no-effect resolution gate**

```typescript
type PendingHirameki = { effectValid?: boolean };
if (pending.effectValid !== false) queueEffect();
```

- [x] **Step 4: Run focused test to verify GREEN**

Run: `npx.cmd vitest run tests/engine/rule-manual-ver2.5.test.ts`
Expected: PASS.

### Task 3: Recognise printed conditional keywords outside the scene

**Files:**
- Modify: `src/engine/read/char.ts`, `src/engine/target/candidates.ts`
- Test: `tests/engine/rule-manual-ver2.5.test.ts`

- [ ] **Step 1: Write failing hand/remove target-filter test**

```typescript
expect(resolveTarget(state, { area: 'hand', side: 'self', filter: { keyword: '突撃' } }, ctx))
  .toContainEqual(expect.objectContaining({ cardId: 'D11007' }));
```

- [ ] **Step 2: Run focused test to verify RED**

Run: `npx.cmd vitest run tests/engine/rule-manual-ver2.5.test.ts`
Expected: FAIL because off-scene conditional keywords fall back to static definitions.

- [x] **Step 3: Extend the existing effective-keyword late binding and provenance marker**

```typescript
effectiveKeywordSafe(state, uid, keyword, { cardId, player, area });
```

- [x] **Step 4: Run focused test to verify GREEN**

Run: `npx.cmd vitest run tests/engine/rule-manual-ver2.5.test.ts`
Expected: PASS for valid and invalid condition cases.

### Task 4: Validate and document

- [ ] Run focused Vitest, typecheck, lint, docs check, smoke, and full Vitest.
- [ ] Ask Sol for semantic/adversarial verdict; inspect structurally similar optional icon and keyword-filter paths.
- [ ] Update memory and a single BUG record only for confirmed pre-Ver.2.5 behavioral gaps.
