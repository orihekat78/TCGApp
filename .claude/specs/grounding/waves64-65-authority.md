# Waves64-65 authority manifest

Official API snapshot date: `2026-08-12T18:02:20.270Z`.

## Retained immutable inputs

| Package | Raw artifact | SHA-256 |
|---|---|---|
| CT-P06 | `.claude/specs/cards-data/_raw/ct-p06-api.json` | `92fade84ea534b4780654df04c4875d96ad84e31caa777fdd38c6c09eb9edf00` |
| CT-P07 | `.claude/specs/cards-data/_raw/ct-p07-api.json` | `366fcbf35ec8b6c00920e03fe4fba6b3d4ccd1fa2df17c0b8c253234820b917b` |
| CT-P08 | `.claude/specs/cards-data/_raw/ct-p08-api.json` | `d1270f7c720b5bc4f0e38316d5a8e1d8d741f1ffaa9cf1415f50639cefac3b5f` |
| CT-P09 | `.claude/specs/cards-data/_raw/ct-p09-api.json` | `25f9d60c2d7f6851be406db9ff63c84d143743b7f22995b034ef6255cae1796c` |
| CT-P10 | `.claude/specs/cards-data/_raw/ct-p10-api.json` | `213c7113f2894c55670e0ca81f400499241dc3271504e4310b82ae46d032bae3` |
| PR-01 | `.claude/specs/cards-data/_raw/pr-01-api.json` | `3b9ecca39cb90b9555fceb28b80c7495fd926c48c79df6a017e94393f7a30f5c` |

## Current-parser derived TSVs

Only `*-api.json` files were copied to an external empty temporary root. The
exported `regenerateAll` in `_regen_all.cjs` produced these bytes:

| TSV | SHA-256 |
|---|---|
| CT-P06 case | `d8323f3f1948ca6ada5049cb7274c019c805242fcc5058b173ba9e85fcd112e6` |
| CT-P06 character | `15eab04615778f7ce4c436924e5a8966b91d2f19499cfad9c07de35191ba7bd7` |
| CT-P07 character | `d53cafbfcc4415940f6e8879c1cc51633b1644924b0492fdb25484d11c7e3019` |
| CT-P08 case | `f152683d703862e846ccd1f5ff58fb1d5f004e8dc2fbdfb703f2c802cf90a778` |
| CT-P08 character | `ae38933ccbeb6c852265fd4d7b2f93d25a13adf97f26f3ea2aa38c803c144a38` |
| CT-P08 event | `0355d32c695295dd967cb9f89155db0f0ef1c5cb3e1894ab77511758f3f17dbc` |
| CT-P09 character | `34f2babbaaf07cef0f19ff7a765ca7052262d7c43637230b606b14306ff20c04` |
| CT-P10 case | `1b7529bacd539db35cf92ce5fb4345ad0d549d2694eb188f9288abe2da507de3` |
| CT-P10 character | `c8592b91ab6281829f40ff2018d32c0493f62ca424483f60edaf5ced886a6d8d` |
| CT-P10 event | `b498a7b50b6bd3705710adaad4c635a30572d35802da3dae78c3ca9e1d1f59e5` |
| PR-01 character | `3d4feccc677b7d4df75498f9e872c743cc94236d0e1938d9ec01928d7e5651cf` |

These are current-parser outputs, not hashes of any older live TSV directory.
Fresh dossiers are under `.tmp/_ground/wave64*` and `.tmp/_ground/wave65*`.
