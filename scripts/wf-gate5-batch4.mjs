export const meta = {
  name: 'gate5-batch4',
  description: 'Author per-rep gate5 runtime tests for triage batch#4 verified-greens (decoy-driven, real-engine flow)',
  phases: [{ title: 'AuthorTests', detail: 'one opus agent per distinct rep: ground in exemplars, write decoy-based gate5 test' }],
};

const SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['rep', 'file', 'summary', 'concern'],
  properties: {
    rep: { type: 'string' },
    file: { type: 'string' },
    summary: { type: 'string' },
    testCount: { type: 'number' },
    drivers: { type: 'array', items: { type: 'string' } },
    // concern = non-null ONLY if grounding revealed the SHIPPED card's runtime deviates from official text
    // (a real engine/spec bug). In that case describe it precisely so the card can be DEFERRED.
    concern: { type: ['string', 'null'] },
  },
};

// hook -> exemplar test the agent should read for the correct real-engine driver.
const HOOK_EXEMPLARS = `
DRIVER EXEMPLARS (read the ones matching YOUR card's hooks; copy the driver verbatim, do NOT call verbs directly):
- enter (キャラ登場時, character played from hand): tests/cards/triage-greens-2026-06-16/B01052.test.ts
    → handUseCard(d,'self',repId) inside produce(), then runAllUntilEmpty(d). (sets up case color + FILE for 手札の使用)
- deckRevealUntil (forced reveal, 出るまで公開): tests/cards/triage-greens-2026-06-16/B01052.test.ts (a2)
- leave:to-remove (【現場リムーブ時】, selfOnly) + evidence:remove-by-action (【ヒラメキ】):
    tests/cards/triage-greens-2026-06-16/B03079.test.ts AND tests/cards/triage-greens-2026-06-16/B02025.test.ts
    → mutate.scene.removeToRemove(d, uid, 'effect'); runAllUntilEmpty; drainAiEffectPicks(d,new HeuristicPolicy())
    → hirameki fire/skip: emit 'evidence:remove-by-action' then _drainPendingHirameki + dispatchEngineAction({type:'hiramekiResolve',choice}) (see B02025 emitHirameki helper)
- disguise:into (【変装時】): tests/cards/disguise-hook-batch.test.ts (grep it for the sceneDisguise / 変装 driver)
- case:to-resolved (事件が解決編になったとき): grep tests/ for 'case:to-resolved' OR src/cards/_shared/caseResolvedHandRemove.ts twin tests; emit via mutate.case.toResolved or event.emit('case:to-resolved',{player:'self'},{uid:caseUid})
- declared (【宣言】 ability): tests/cards/triage-greens-2026-06-15/B01062.test.ts , B02003.test.ts , B02005.test.ts (grep for how a declared ability + cost is invoked)
- effect:declared / __eventUse (イベントの使用): tests/cards/triage-greens-2026-06-15/*.test.ts and tests/cards/ct-d08/D08007.test.ts ; grep tests/ for '__eventUse' or the event-use driver
- contact:start (このキャラがコンタクトしたとき): tests/cards/akamajutsu-trait-family.test.ts and tests/ai/policy.action-guard.test.ts (grep for contact driving / startContact / action state machine)
`;

function prompt(item) {
  const { rep, pkg } = item;
  return `You are authoring a gate5 RUNTIME-behavior test for ONE just-shipped Detective Conan TCG card.

CONTEXT (read these FIRST, completely):
1. .tmp/taskA/recs/${rep}.json  — official card text {effect,cutIn,hirameki,henso} + stats.
2. .tmp/certify/${rep}.json      — the certified spec (abilities[] that was codegen'd into src/cards/${pkg}/${rep}.ts).
3. src/cards/${pkg}/${rep}.ts    — the ACTUAL shipped CardDef (import it in your test: import { ${rep} } from '@/cards/${pkg}/${rep}';).
4. .claude/CLAUDE.md self-review §gate5 + the GOLD template tests/cards/triage-greens-2026-06-16/B03079.test.ts (structure, beforeEach resets, decoy defs, descriptor sanity).

${HOOK_EXEMPLARS}

GOAL: prove the SHIPPED engine actually evaluates this card's filters/conditions/quantities per the OFFICIAL TEXT
(BUG-117/118 lesson: a filter written in the DSL is NOT guaranteed to be honored — you must drive the real engine
flow and observe board state). Your test MUST:
- Drive the real engine flow via the correct DRIVER for each hook (NEVER call atom verbs directly). Use produce() + runAllUntilEmpty.
- For EACH filter on a pick/target (color/level/AP/LP/trait/cardName/kind/keyword/state/side), place a DECOY on the
  board/zone that violates exactly that one filter, and assert the decoy is NOT chosen while the valid candidate IS.
  (Register synthetic decoy CardDefs with id prefix DEC_${rep}_ , abilities:[] to avoid recursive triggers.)
- For every condition icon (【相手ターン中】/【パートナー色】/【事件編】/【解決編】/【FILE(X)】/turn): include a NEGATIVE case
  where the condition is unmet → the ability does NOT fire.
- For '〜まで'(0-OK) picks: include a 0-pick / decline path and assert the mandatory parts still behave per text.
  ⚠ If your card has an optional/0-pick FOLLOWED by a trailing step, verify the human-DECLINE path on the real engine
  (this is the BUG-111 trap that refuted other cards): if the trailing step is chain-gated ('そうした場合') it MUST
  drop on decline; if it is mandatory ('〜する' unconditional) it MUST still fire. Assert whichever the TEXT requires.
- For UI-dispatch hirameki effects (evidence:remove-by-action whose effect is sceneSetState/handAddFromRemove resolved
  via hiramekiResolve), follow B03079 a2 / B02025: assert the trigger FIRES (pending {cardId,abilityId}) + (if the
  effect form is a byte-identical reuse of a shipped exemplar) a toEqual shape-match vs that exemplar; else drive fire/skip.
- Include a descriptor-sanity test (toMatchObject on ${rep}.abilities) like B03079's last test.
- Add a concise header comment block (official text + rules refs + what each assertion proves) like the GOLD template.

CRITICAL HONESTY RULE: write assertions for the behavior the OFFICIAL TEXT mandates. If, while grounding in the real
engine, you discover the shipped card's runtime BEHAVIOR deviates from the text (a real bug — e.g. a filter ignored,
a continuation dropped when it must fire, wrong side/chooser), DO NOT soften the test to make it pass. Write the test
to assert the CORRECT behavior (it will fail) AND set concern="<precise description of the deviation + which clause>".
A failing test that exposes a real bug is the desired outcome — the card will be deferred. Only set concern=null if
every assertion reflects real, correct, grounded behavior.

OUTPUT: Write the test file to tests/cards/triage-greens-2026-06-16/${rep}.test.ts (use @/ path aliases, vitest, TypeScript;
match the import style + beforeEach resets of the GOLD template exactly so it compiles). Return the StructuredOutput
{rep:'${rep}', file, summary, testCount, drivers:[hooks driven], concern}. Be exhaustive and skeptical.`;
}

let items = args;
if (typeof items === 'string') items = JSON.parse(items);
if (!Array.isArray(items)) throw new Error('args is not an array: ' + typeof items);
// SUB=5 sub-batches (memory feedback-workflow-concurrency-throttle: opus workflows SUB<=5 to avoid server rate-limit).
const SUB = 5;
const results = [];
for (let i = 0; i < items.length; i += SUB) {
  const batch = items.slice(i, i + SUB);
  const res = await parallel(batch.map((it) => () =>
    agent(prompt(it), { label: `gate5:${it.rep}`, phase: 'AuthorTests', schema: SCHEMA, model: 'opus' })));
  results.push(...res);
  log(`sub-batch ${i / SUB + 1}: ${Math.min(i + SUB, items.length)}/${items.length} authored`);
}

const done = results.filter(Boolean);
const concerns = done.filter((r) => r.concern);
log(`gate5 authored ${done.length}/${items.length}; concerns(real-bug suspected)=${concerns.length}`);
return {
  authored: done.length,
  total: items.length,
  concerns: concerns.map((c) => ({ rep: c.rep, concern: c.concern })),
  rows: done.map((r) => ({ rep: r.rep, file: r.file, testCount: r.testCount || null, drivers: r.drivers || [], concern: r.concern || null, summary: r.summary })),
};
