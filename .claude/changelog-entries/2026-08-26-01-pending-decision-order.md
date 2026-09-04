---
date: 2026-08-26
title: parent effectのdecisionをchild triggerより先に解決
type: fix
scope: engine
---

## BUG-370

triggerBatchを持たないparent continuationのmandatory pick中でもstack drainが
child triggerを進め、child optionalを先行解決できた。

pending pickをhard boundaryにし、同一authorityのdeferred entryと
`resumesCurrentEffect` carrierだけを通す。
parent完了後は既存のturn-player/owner-orderでchild effectsを解決する。
