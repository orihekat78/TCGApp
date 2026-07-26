# Codex Quality and Product Design

## Goal

Add measurable accuracy and product-design capability without removing existing
token controls or turning the UI into a themed fan-site design.

## Decisions

- Keep Terra/medium as the normal economical default.
- Spend extra reasoning only for T2/T3 work and independent final judgment.
- Treat token reduction as invalid when critical correctness regresses.
- Add specialist agents, not always-loaded instructions.
- Keep accuracy and design skills explicit/on-demand.
- Base UI quality on neutral modern product design.
- Use Conan content as subject matter, not as decorative visual language.

## Components

1. `conan-accuracy`: runs and interprets the golden-task evaluation.
2. `conan-design`: directs UI critique, implementation guidance, and visual QA.
3. Accuracy agents: rules adjudicator, engine reviewer, regression hunter.
4. Design agents: product design director, UX reviewer, visual QA.
5. Golden manifest: representative tasks, critical requirements, forbidden
   behavior, evidence, and gates.
6. Quality checker: validates the corpus, thresholds, agents, and routing.

## Quality profiles

| Profile | Use | Model/effort | Review |
|---|---|---|---|
| economy | T0/T1 | Terra medium | deterministic/focused |
| quality | T2 | Terra high | specialist reviewer |
| adjudication | T3 | Sol high/xhigh | independent final judgment |

## Design principles

- Prioritize hierarchy, typography, spacing, density, affordance, and consistency.
- Let cards and game state carry identity; keep chrome restrained.
- Avoid detective clichés, ornamental motifs, and forced franchise colors.
- Validate desktop and `851x393`; preserve accessibility and input clarity.
- Compare before/after captures for visible changes.

## Evaluation

- Minimum 12 golden tasks across question, card, engine, UI, refactor, and review.
- Critical pass rate: 100%.
- Overall pass rate: at least 95%.
- Unsupported rule claims and scope violations: zero.
- Route/model/gate selection must match each task.
- Report accuracy and token proxies separately; never trade one silently.

## Non-goals

- No model fine-tuning or claim of guaranteed correctness.
- No autonomous public deployment.
- No global plugin deletion.
- No Figma reconstruction of already implemented screens.
