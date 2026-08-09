---
date: 2026-08-09
category: fixes
---

## Private-hosted release gates use bounded deployment checks

- Replaced the blocking advanced runtime-boundary gate with explicit production build, dependency audit, embedded-secret, and external-destination checks.
- Kept the advanced runtime-boundary audit available as an optional command for later hardening.
- Added exact qualification evidence for empty secret and destination findings.
