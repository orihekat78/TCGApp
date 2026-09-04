# Waves68-69 authority manifest

Official API snapshot date: 2026-08-12T18:02:20.270Z.

## Retained immutable inputs

| Package | Raw artifact | SHA-256 |
|---|---|---|
| CT-P05 | .claude/specs/cards-data/_raw/ct-p05-api.json | 3dc74e6a7ebc8f5dbf0fd8be6b5474aa664fcc1a09abec84c99e899e2c33c9d3 |
| CT-P06 | .claude/specs/cards-data/_raw/ct-p06-api.json | 92fade84ea534b4780654df04c4875d96ad84e31caa777fdd38c6c09eb9edf00 |
| CT-P10 | .claude/specs/cards-data/_raw/ct-p10-api.json | 213c7113f2894c55670e0ca81f400499241dc3271504e4310b82ae46d032bae3 |
| CT-D09 | .claude/specs/cards-data/_raw/ct-d09-api.json | 68773c76ac0be0a044ba5ac17c558a653861913db98c6236fd22e2cf1043413b |

## Current-parser derived TSVs

| TSV | SHA-256 |
|---|---|
| CT-P05 case | 75709f47b88c8269d3d6b4206002e9ac51a6f5b3022e99935b42a2971c71ae63 |
| CT-P06 case | d8323f3f1948ca6ada5049cb7274c019c805242fcc5058b173ba9e85fcd112e6 |
| CT-P06 character | 15eab04615778f7ce4c436924e5a8966b91d2f19499cfad9c07de35191ba7bd7 |
| CT-P06 event | 08747356ffc134a948df3ce60e3ce16c115a3b4478332a30afc7ec85f2367095 |
| CT-P10 case | 1b7529bacd539db35cf92ce5fb4345ad0d549d2694eb188f9288abe2da507de3 |
| CT-D09 case | a6264608549f9e19d34adc563a9074affe9e188dae9b003e44d3d16f44ef978b |

Only the four retained API files were copied into a new empty temporary root.
These are isolated current-parser outputs. Fresh dossiers are under
.tmp/_ground/wave68 and .tmp/_ground/wave69.

Case/event TSVs omit category fields. Official raw category1 is therefore the
trait authority for B06035 and B06036/P/B06065/P YAIBA backfills (BUG-343).
