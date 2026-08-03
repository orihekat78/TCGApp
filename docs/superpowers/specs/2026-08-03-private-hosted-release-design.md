# Private Hosted Release Design

Date: 2026-08-03
Status: Design approved with release-blocking gates; no production release authorized

## Goal and boundary

- Let a fixed family/small-friend group play on smartphones through a hosted URL.
- No public registration, discovery, monetization, advertising, donation, analytics, or telemetry.
- Hosted product name is `Private TCG Simulator`; show a persistent unofficial/non-affiliation notice.
- Non-commercial use, a small audience, repository privacy, and Access do not replace permission.
- `L-rights-final` PASS requires affirmative written Japanese-IP-counsel advice authorizing distribution of the exact `candidate_core_id` and canonical config plan with every condition satisfied, or relevant rightsholder permission covering both. Adverse, inconclusive, limited, expired, unmet-condition, or open-question review is FAIL.

## Distributed product

- Target gameplay is the 47 CT-D08/CT-D11 cards and two fixed decks, subject to `B-rules` approval of every card.
- Ship no franchise/product/card/character/set names, numbers, logos, images, image URLs, official or near-verbatim text.
- Use hosted IDs `H-P01..H-P47`, `H-D01/02`, and opaque group/name/trait/keyword IDs.
- Implement a separate, versioned, JSON-serializable, function-free DSL and exhaustive interpreter.
- Never transform, execute, stringify, evaluate, or bundle current CardDef modules; production excludes `src/cards/**`.
- DSL uses typed operators for filters, targets, costs, bindings, pending choices, triggers, structured dynamic lookup, modifiers, and keyword grant/revoke. Unknown properties/operators fail closed; free-form control strings are forbidden.
- UI labels come only from a fixed generic operator grammar; every reachable choice is nonempty, unique, and distinguishable.
- Compare all generated labels with the private official-text corpus after normalization and reject near matches.
- No deck builder, full catalog, tutorial, replay/history, gameplay/deck import/export, CardArt, service worker/PWA, or remote error report; the strictly local label import below is the only import.
- Label input is exactly `{version:1,labels:{H-P01:"..."}}` with a subset of known H-IDs: NFKC text, 1-40 Unicode scalars, total JSON <=8 KiB; copy into a null-prototype map.
- Reject unknown keys, controls, bidi/zero-width characters, line breaks, URL schemes, and `< > { }`; render text nodes only and never pass label values to network, logs, or exception reporting.
- Use only `private-tcg.v1.*`; do not migrate old storage. `Clear local data` removes labels and current match state.

## Build and authority isolation

- Build in a disposable VM or separate non-privileged OS account with no Cloudflare/key access; deny egress after setup.
- Build twice from the same fetched `origin/main` SHA in clean worktrees; artifact digests must match.
- Move regular files one way to a separate Authority OS account; reject links, devices, ADS, traversal, extras, >20,000 files, or any file >25 MiB. Authority never checks out the repo or runs Node, package scripts, HTML, or JavaScript.
- Repo-external fixed binaries perform detection, signing, release, and containment. Pin their hashes and key fingerprints in Authority storage and encrypted offline media; define rotation/revocation. Never expose secrets in env/CLI/log/temp.
- Gate `Z` proves a malicious build fixture cannot reach Authority credentials and that boundary violations are rejected.
- Pin the Authority detector executable/version, normalization, corpus digest, canary digest, and file/magic registry.

## Manifests and identity

- `evidence-core-manifest`: immutable unsigned pre-candidate rule citations, parity mapping/report, detector report, and legal source inputs. It never contains candidate-specific L-rights-final, S-preflight, R-upload, device-test, membership-activation, or S-post reports.
- `pages-payload-manifest`: only distributable regular files; exact staging set must match it.
- `attestation-manifest`: ordered signatures over gate reports; never upload evidence or attestations.
- Stage payload files into a new empty directory, rescan filenames/paths/content/compression/source maps/magic/gzip, prove evidence/legal/corpus canaries absent, make it read-only, pin file handles, rehash, then upload only that directory.
- `candidate_core_id` is a domain-separated hash of source SHA; lock/dependencies/build config; hosted DSL, UI, label grammar, and engine-allowlist hashes; canonical Cloudflare config-plan fingerprint; payload digest; and only immutable unsigned pre-candidate evidence/report digests.
- Freeze pre-candidate evidence/reports and build/config/payload digests, then compute `candidate_core_id`. Post-candidate reports are not candidate inputs; each gate signs `candidate_core_id + gate + report digest + identity + timestamp`.
- All hash formulas use domain-separated, length-prefixed SHA-256. `release_record_id = hash(candidate_core_id + ordered attestation digests + operator approval)`.
- A pre-candidate input/report, hashed config plan, or Cloudflare state outside that plan creates a new candidate, except a monotonic `active_members` removal performed and recorded under the approved offboarding transition. A post-candidate report change invalidates its attestation, dependents, and `release_record_id`, but not `candidate_core_id`; official rule/Q&A changes create a new candidate.

## Correctness gates

- `B-rules`: a read-only rules adjudicator covers 47/47 against manual Ver.2.4, current Q&A, and card rulings.
- Each ruling records URL, retrieval date, version, preserved digest, ruling/test ID, and status; unresolved item/approximation/inference = 0.
- The known fixed-AP approximation in `D11005` is a release blocker until corrected, sourced, tested, and re-reviewed.
- `B-parity`: map original and hosted states, then compare legal actions, targets, costs, pending choices, modifiers, player views, public log semantics, and final GameState across both seats and complete games.
- Fix seed, deck order, UID, timestamp, and log normalization; cover both trigger/condition branches, every choice, pause/resume, re-entry, simultaneous resolution, optional effects, declared-name, case/group/dynamic lookup, and modifier apply/revoke. Preserve shrunk failing seeds. Structural hashes alone prove nothing.
- Production metafile allowlist, negative import canaries, and detector scan must reject original card/UI corpus leakage.

## Cloudflare and release states

- Use a dedicated Cloudflare account with one Pages project and exactly root/wildcard Access applications.
- `X` uses harmless Direct Upload sentinel A/B to prove production-branch upload, rollback to fixed A, non-active B deletion, API absence, and authenticated B URL content absence using the production utilities and real Access routes.
- Normal policy is one `Allow` with one exact-email group, empty Require/Exclude, OTP-only IdP, no overlap, Bypass, Service Auth, Everyone, nested group, domain/IP/country selector, WARP override, Worker, Function, or cache override.
- Test config permits one operator for <=30 minutes. Release config permits the approved group for <=12 hours.
- Canonical config plan includes both states, both apps, account/IdP/session settings, headers, fixed sentinel ID, `approved_members` maximum, and the allowed monotonic-removal transition for `active_members`.
- Sequence: `Z -> X -> B-rules -> B-parity -> reproducible build -> content -> freeze pre-candidate reports -> compute candidate_core_id -> attest pre-candidate reports -> O -> L-rights-final -> S-preflight`; then `R-upload -> deployed/unaccepted -> attended Android+iPhone tests -> activate the pre-approved release-state active_members exactly as hashed in the canonical config plan -> S-post -> compute release_record_id -> sign config_instance_0 -> released`.
- Test allowed/denied email, anonymous root/wildcard, assets/fallback, and real Android plus iPhone within 30 minutes.
- On failure/interruption, remain operator-only and unaccepted; the next operator action must run containment.
- Containment applies root/wildcard `Block Everyone`, removes Allow, revokes both app tokens/sessions, verifies denial, rolls back to fixed sentinel, deletes the failed deployment, proves API/URL absence, and never auto-unblocks.
- Access token has account-level `Access: Apps and Policies Write` plus `Access: Apps and Policies Revoke`; fixed utility limits IDs/endpoints. Pages token is separate.
- Last resort project deletion is an operator-confirmed Pages-utility command showing account/project/sentinel/candidate IDs; keep Access blocked if deletion fails. Token leakage blast radius is the dedicated account, not only two app IDs.

## Headers, operations, and cost

- Every authenticated HTML/JS/CSS/JSON/SVG/fallback/sentinel response requires private no-store, noindex, no-referrer, nosniff, restrictive CSP (`connect-src 'none'`), and `CF-Cache-Status` not `HIT`.
- Separate runbooks cover rights takedown, security containment, functional rollback, key rotation, and offboarding <=2 min.
- `approved_members` is the L-rights-final maximum; `active_members` must remain a subset. The planned operator-only activation does not invalidate qualification. Addition, re-add, or non-removal config change requires a new candidate and all gates.
- Genesis is `config_instance_id_0 = hash("config-instance-v1" + candidate_core_id + release_record_id + config-plan fingerprint + canonical-sorted UTF-8 initial_active_members + identity + timestamp)`.
- Removal creates `config_instance_id_n = hash("config-instance-v1" + candidate_core_id + release_record_id + config_instance_id_(n-1) + canonical-sorted UTF-8 new_active_members + removal-evidence digest + identity + timestamp)`. Sign every record; audit verifies `release_record_id -> instance_0 -> ... -> instance_n`.
- Offboarding removes the exact email, revokes that identity's active sessions/tokens for root and wildcard, waits for propagation, and proves both deny access within two minutes before signing the config-instance record. Live-token revoke is an approved transition, not session-setting drift; any failure triggers full-site containment.
- Daily secretless probe checks root/wildcard redirect chains for Access markers and rejects candidate HTML marker, asset digest, long canary, decoded body, redirect body, or Range match; weekly operator account audit checks drift.
- Keep deployments below 100; store redacted encrypted evidence locally for 30 days; Free Access logs retain about 24 hours.
- Expected platform cost is conditionally $0: Cloudflare Zero Trust Free (<50 users) and Pages Free; GitHub Free private Actions uses included quota only, a $0 stop-usage budget, 30-minute jobs, no release artifacts, 80% cutoff, and <=4 release attempts/month. Before the first Actions run, `O`, and every release, record current Free eligibility, included usage, billing method, budget, and stop-usage settings from provider control panels; uncertainty or mismatch blocks release.
- External legal review, new hardware, or a future custom domain can add cost; obtain a quote/approval before commitment.

## Residual risks and acceptance

- Accept: no private-Free main protection; up to 24-hour drift detection; operator-only unaccepted bytes after device loss; dedicated-account Access blast radius; already downloaded bytes cannot be recalled; X cannot freeze future provider behavior.
- Do not accept: unresolved rights/rules, public/near-official content, missing root/wildcard Access, unverifiable deletion, weak detector, mixed build/Authority trust, unapproved member addition, or any failed/missing gate.
- This document authorizes detailed implementation planning only. Production release remains blocked until every gate passes.

## Current sources

- [Takara Tomy site policy](https://www.takaratomy.co.jp/utility/sitepolicy/)
- [Cloudflare Pages known issues](https://developers.cloudflare.com/pages/platform/known-issues/)
- [Cloudflare Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)
- [Cloudflare Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/)
- [GitHub private-repository ruleset availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage)
