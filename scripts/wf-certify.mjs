export const meta = {
  name: 'taskA-certify',
  description: 'Certify Task A green候補 cards (grounded verdict + AbilityDef JSON) then adversarially verify greens',
  phases: [
    { title: 'Certify', detail: 'one agent per card: ground every clause vs frozen engine, emit verdict + spec JSON' },
    { title: 'Verify', detail: 'one skeptic per green: refute the clause mapping before codegen' },
  ],
};

const SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['rep', 'verdict', 'confidence', 'tier', 'keywords', 'abilities', 'clauseMap'],
  properties: {
    rep: { type: 'string' },
    verdict: { enum: ['green', 'yellow'] },
    confidence: { enum: ['high', 'med', 'low'] },
    tier: { enum: [1, 2] },
    keywords: { type: 'array', items: { type: 'string' } },
    isMR: { type: 'boolean' },
    needsManual: { type: 'boolean' },
    manualReason: { type: 'string' },
    abilities: { type: 'array' },
    clauseMap: {
      type: 'array',
      items: {
        type: 'object',
        required: ['clause', 'mapsTo', 'grounding'],
        properties: { clause: { type: 'string' }, mapsTo: { type: 'string' }, grounding: { type: 'string' } },
      },
    },
    blocker: { type: 'string' },
    ruleRefs: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
};

const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['rep', 'ok', 'problems'],
  properties: {
    rep: { type: 'string' },
    ok: { type: 'boolean' },
    problems: {
      type: 'array',
      items: {
        type: 'object',
        required: ['issue', 'severity'],
        properties: { clause: { type: 'string' }, issue: { type: 'string' }, severity: { enum: ['fatal', 'minor'] } },
      },
    },
    summary: { type: 'string' },
  },
};

function cardText(r) {
  return [
    r.effect && `effect: ${r.effect}`,
    r.cutIn && `cutIn(カットイン): ${r.cutIn}`,
    r.hirameki && `hirameki(ヒラメキ): ${r.hirameki}`,
    r.henso && `henso(変装): ${r.henso}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// args item は record オブジェクト or rep id 文字列。id の場合は agent が rec ファイルを読む。
function repId(item) {
  return typeof item === 'string' ? item : item.rep;
}
function cardSection(item) {
  if (typeof item === 'string') {
    return `CARD TO CERTIFY: rep id = ${item}
FIRST read .tmp/taskA/recs/${item}.json — it has this card's {rep,kind,title,color,level,ap,lp,features,effect,cutIn,hirameki,henso}.
Use that record's OFFICIAL TEXT (effect/cutIn/hirameki/henso) and stats as the card to certify.`;
  }
  const r = item;
  return `CARD TO CERTIFY:
- id: ${r.rep}
- kind: ${r.kind}
- title: ${r.title}
- color: ${r.color} | level: ${r.level} | ap: ${r.ap} | lp: ${r.lp} | features(traits): ${r.features || '(none)'}
- OFFICIAL TEXT:
${cardText(r)}`;
}

function certifyPrompt(item) {
  const rep = repId(item);
  return `You are certifying ONE Detective Conan TCG card for ZERO-ENGINE-CHANGE implementation.

FIRST read these two files completely:
1. .tmp/taskA/certify-brief.md  (method, DSL patterns incl. optional/declared-cost/__eventUse/__shared, ⛔ gates, tier rules)
2. .claude/specs/catalog-survey-2026-06-06/capability-map.txt  (frozen engine: exact verb args, conditions, filters, hooks, cost/dyn, gates)

Then ground EVERY clause: for each verb/hook/condition/filter/cost you plan to use, open a real exemplar
card under src/cards/** (grep for the verb) and copy its EXACT arg shape, and/or confirm in
src/engine/** that the arg/condition is honored. Cite what you read in clauseMap.grounding.

${cardSection(item)}

RULES (from the brief — obey strictly):
- Use ONLY verbs/hooks/conditions/filters/costs in capability-map.txt + the brief's conventions
  ("__eventUse" trigger flag for event self-use; "__shared" entries for the listed shared classes;
  optional wrapper for 「してもよい」; declared+cost for 【宣言】). No other closures/functions anywhere.
- If ANY clause needs something on the ⛔ gate list, or you cannot ground it in real code, the whole
  card is verdict:'yellow' with a precise blocker. DEFAULT TO YELLOW ON ANY DOUBT — a false green is
  far worse than a false yellow.
- If the mapping is green but the FILE cannot be auto-generated as pure JSON (e.g. needs a condition
  closure like contactTargetMatches), set verdict:'green' + needsManual:true + manualReason.
- abilities[] must be valid JSON modeled on the exemplar you read. description = the official Japanese
  clause text. Vanilla card → abilities:[].
- "tier": 1 = no player selection/choice/optional surfaces at resolution; 2 = needs pick/choice/optional/modal.
- "keywords" = INNATE printed keywords only (迅速/突撃/疾風/ブレット as printed icons), NOT granted ones. Usually [].

OUTPUT: Return the StructuredOutput object (schema enforced). ALSO Write the SAME object as JSON to
.tmp/certify/${rep}.json (Write tool). Be exhaustive and skeptical.`;
}

function verifyPrompt(item, spec) {
  const rep = repId(item);
  const cardInfo = typeof item === 'string'
    ? `CARD: rep id = ${item}. Read .tmp/taskA/recs/${item}.json for kind/title/OFFICIAL TEXT (effect/cutIn/hirameki/henso).`
    : `CARD:\n- id: ${item.rep} | kind: ${item.kind} | title: ${item.title}\n- OFFICIAL TEXT:\n${cardText(item)}`;
  return `You are an ADVERSARIAL VERIFIER. Another agent claims the Detective Conan TCG card below is
implementable with zero engine change and produced a spec. Your job is to REFUTE it. Find any way the
spec deviates from the official text or the frozen engine. Default to reporting problems if uncertain.

${cardInfo}

THE CLAIMED SPEC (also at .tmp/certify/${rep}.json):
${JSON.stringify(spec)}

CHECK, clause by clause, against BOTH:
1. .claude/specs/catalog-survey-2026-06-06/capability-map.txt (verb arg shapes, hooks, conditions,
   filter fields honored per path — e.g. deckRevealUntil predicate honors only cardId/color/trait/ap/lp/level/kind;
   boundMatchesFilter ignores dynamic fields; selfOnly semantics per hook; AI skips optional)
2. .tmp/taskA/certify-brief.md (conventions: __eventUse, __shared arg shapes, tier definition)
And where decisive, the real engine code under src/engine/** (Read it).

Hunt specifically for:
- wrong/missing filter values (trait/color/level/AP/LP/kind) vs the text; OR conditions flattened into AND
- wrong hook (e.g. 【現場リムーブ時】 on enter; 疾風 vs 登場時), missing 【ターンN】 limit, missing condition icons
  (【相手ターン中】/【パートナー色】/【事件編】/【FILE(X)】), wrong side (self vs opp), wrong chooser
- 「〜する」 vs 「〜してもよい」 (mandatory vs optional) mismatches; chain vs sequence (「そうした場合」)
- missed clauses (every sentence of the text must appear in clauseMap), invented effects not in the text
- arg keys that don't exist for that verb (would be silently ignored by the engine)
- verdict:'green' that should be yellow per the ⛔ gate list; wrong tier; keywords[] wrong

"minor" = cosmetic (description wording, ruleRefs); "fatal" = anything that changes game behavior or legality.
ok=true ONLY if there are zero fatal problems.

OUTPUT: StructuredOutput {rep:'${rep}', ok, problems:[{clause,issue,severity}], summary}. ALSO Write it to
.tmp/certify/${rep}.verify.json.`;
}

let recs = args;
if (typeof recs === 'string') recs = JSON.parse(recs);
if (!Array.isArray(recs)) throw new Error('args is not an array: ' + typeof recs);

// 各 item: certify → green なら adversarial verify。
async function certifyThenVerify(item) {
  const rep = repId(item);
  const spec = await agent(certifyPrompt(item), { label: `certify:${rep}`, phase: 'Certify', schema: SCHEMA });
  if (!spec) return null;
  if (spec.verdict !== 'green') return { spec, verify: null };
  const verify = await agent(verifyPrompt(item, spec), { label: `verify:${rep}`, phase: 'Verify', schema: VERIFY_SCHEMA });
  return { spec, verify };
}

// サーバ側 request-rate throttle (40件×16並列で発生) を避けるため、SUB 件ずつ直列のサブバッチで実行。
// 各サブバッチ内は並列、バッチ間は barrier。実効並列度を SUB に抑える。
const SUB = 8;
const results = [];
for (let i = 0; i < recs.length; i += SUB) {
  const batch = recs.slice(i, i + SUB);
  const res = await parallel(batch.map((r) => () => certifyThenVerify(r)));
  results.push(...res);
  log(`sub-batch ${i / SUB + 1}: ${Math.min(i + SUB, recs.length)}/${recs.length} done`);
}

const done = results.filter(Boolean);
const greens = done.filter((x) => x.spec.verdict === 'green');
const verified = greens.filter((x) => x.verify && x.verify.ok);
const refuted = greens.filter((x) => x.verify && !x.verify.ok);
log(`certified ${done.length}/${recs.length}: green=${greens.length} (verified-ok=${verified.length}, refuted=${refuted.length}) yellow=${done.length - greens.length}`);
return {
  total: recs.length,
  returned: done.length,
  green: greens.length,
  verifiedOk: verified.length,
  refuted: refuted.length,
  yellow: done.length - greens.length,
  rows: done.map((x) => ({
    rep: x.spec.rep,
    verdict: x.spec.verdict,
    confidence: x.spec.confidence,
    tier: x.spec.tier,
    needsManual: x.spec.needsManual || false,
    blocker: x.spec.blocker || null,
    verifyOk: x.verify ? x.verify.ok : null,
    fatals: x.verify ? x.verify.problems.filter((p) => p.severity === 'fatal').length : 0,
  })),
};
