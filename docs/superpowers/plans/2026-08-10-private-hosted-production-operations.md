# Private Hosted Production Operations

Date: 2026-08-10

## Current production

- Stable URL: `https://conan-private-7302df07.pages.dev/`
- Project/account/team: `conan-private-7302df07` / `8b2b1b63c5cf8d5c49dcc608b730dd10` / `steep-mouse-bb22`
- Accepted deployment: `945de0aa-1af1-4836-86f1-b8048dc6d32e`
- Accepted commit: `9f608fd5bff7249ee1aa59ba1b101cfb884d5ea3`
- Authentication: Cloudflare One-time PIN, exact approved emails, 12h maximum.
- Root and wildcard Access applications must remain protected together.

## Normal release

1. Start from one clean release commit. Do not deploy an uncommitted tree.
2. Create one short-lived token scoped only to the fixed account. Grant `Pages
   Write`, `Access: Apps and Policies Read`, and `Access: Organizations, Identity
   Providers, and Groups Read`; do not grant either Access write permission. Put
   it only in `CLOUDFLARE_API_TOKEN`, then run `node
   scripts/private-hosted/deploy-qualified.mjs` with no arguments. Do not invoke
   it through npm, tsx, Wrangler, or an externally supplied run directory.
3. The launcher runs final qualification exactly once. Confirm all 18 commands
   passed, including the generated Meta card-identity check, and
   secret/destination findings are empty.
   Confirm the HOME initial closure is at most 512 KiB and all approved lazy chunks
   appear in the exact response manifest with no unknown or orphan JavaScript.
4. The launcher revalidates the report, exact command arguments, logs,
   manifests, staged `_worker.js`, clean commit, fixed account/project, remote
   bindings, and root/wildcard Access before uploading its in-memory snapshot
   through the Cloudflare Pages API. Never run `wrangler pages deploy`, rebuild,
   upload `dist`, or reuse a qualification directory manually.
5. Record commit, deployment ID/URL, report path, upload/response manifest
   hashes, and the staged `_worker.js` SHA-256.
6. Probe stable and deployment URLs anonymously. Both must redirect to
   `steep-mouse-bb22.cloudflareaccess.com`; no app HTML may be anonymous.
7. Open the stable URL through OTP on PC, then smartphone. Verify `HOME -> DECK`
   opens without a reload or crash, starts with at most 48 catalog tiles, and stays
   at or below 96 while scrolling. Then verify the public `HOME -> SETUP -> MATCH`
   path: `/#home`, `.home-screen`,
   `button[data-route='setup']`, `#setup-title`, `button.setup-start`,
   `#match`, `button.mulligan-skip`, then `#scaler`. At `851x393`, confirm
   `#scaler[data-playmat-layout='desktop'][data-playmat-fit='contained-landscape']`.
8. Delete the short-lived token from the environment and revoke it. Browser OAuth
   may remain for Pages administration.

Never put tokens, OTPs, credentials, or unredacted signed URLs in chat, Git, command
arguments, configuration, screenshots, or evidence.

## Add a person

1. Obtain operator approval; keep total approved emails at 12 or fewer.
2. Add the exact lowercase email to the external operator config.
3. Add the same exact email to the one Allow policy on both Access applications.
4. Keep One-time PIN as the sole IdP, Require/Exclude empty, and session at most 12h.
5. Run active Access audit and anonymous probes, then test OTP with that person.

## Remove a person

1. Remove the exact email from both Access policies and the external config.
2. In Zero Trust, open Team & Resources > Users and revoke that user's sessions.
3. Run active Access audit and confirm the removed email cannot receive access.

## Emergency containment

1. On both root and wildcard applications, replace Allow policies with one
   Block Everyone policy. Leave Include as Everyone; Require and Exclude empty.
2. Revoke existing application tokens for both applications.
3. Probe stable and deployment URLs anonymously and from a previously logged-in device.
4. Keep containment active during investigation. Never auto-unblock.
5. For a rights complaint, contain first and preserve redacted evidence before rollback
   or deletion.

## Rollback

1. Contain first if the current payload may be unsafe or rights-sensitive.
2. In Pages > Deployments, open the three-dot menu on a previous successful production
   deployment and choose **Rollback to this deployment**. Preview deploys cannot roll back.
3. Recheck root/wildcard Access, anonymous redirects, OTP login, and smartphone smoke.
4. Record the selected deployment ID and reason. Re-enable Allow only by operator decision.

## Cloudflare references

- [One-time PIN behavior](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
- [Revoke Access sessions](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/)
- [Pages rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/)
