---
status: active
date: 2026-07-22
scope: deckRevealUntil visibility audit
---

# deckRevealUntil visibility classification

## Policy

- `public/all`: printed text says every player sees cards: 「公開する」「1枚ずつ公開」「N枚公開」.
- `private/self`: printed text says the ability owner 「見る／見て」. A later selected-card reveal does not expose the whole look window.
- No inference from deck owner, chooser, movement destination, or the atom name.
- Runtime default stays fail-closed private. Confirmed public callers declare `visibility:'public', viewer:'all'`.

## Confirmed public — 59

- CT-D06: D06013.a1, D06016.a2. CT-D10: D10003.a2, D10004.a2. CT-D11: D11019.a1.
- CT-P01: B01018.a1, B01050.a2, B01052.a2, B01093.a2.
- CT-P02: B02050.a1, B02058.a2, B02058P.a2.
- CT-P03: B03016/P.a1, B03019.a1, B03023.a1, B03028.a1, B03031/P.a1, B03049.a1, B03062/P.a1, B03096.a1.
- CT-P04: B04023.a2, B04051/P.a1, B04055.a1.
- CT-P05: B05017.a1, B05021.a1, B05035.a1, B05042.a1, B05077.a1, B05093/P.a1, B05094.a1, B05114.a1.
- CT-P06: B06010.a1, B06011/P.a1, B06053/P.a1.
- CT-P07: B07038.a1, B07043.a1, B07051.a1, B07052.a2, B07086.a2, B07089.a1.
- CT-P08: B08060/P.a1, B08074.a1.
- CT-P09: B09033/P.a1, B09109/P.a1, B09110/P.a1.
- PR: PR117.a1, PR118.a1, PR195.a1.

## Confirmed private look — 130

- CT-D01: D01012/13/14.a1. CT-D02: D02011/14.a1. CT-D03: D03009/14.a1. CT-D04: D04011/14.a1.
- CT-D05: D05007/12/14.a1. CT-D07: D07019/23.a1. CT-D10: D10024.a1.
- CT-P01: B01013/P, B01016/P, B01017, B01022/23, B01034/P, B01048/P, B01053, B01055/P, B01072/P, B01090/P — all a1.
- CT-P02: B02019/P.a1, B02044/P.a1+a2.
- CT-P03: B03002/07/18/25.a1, B03036/P.a1, B03042.a1, B03056/P.a1, B03073.a1, B03079/P.a1, B03086/P.a1, B03115/P.a1, B03128.a1, B03132/P.a1.
- CT-P04: B04012/13/24/26/40/61/83.a1, B04048.a2, B04063.a1, B04079.a2.
- CT-P05: B05016/P.a1, B05020/P.a1, B05047.a1+a2, B05057/60.a1, B05078/P.a1, B05082/P.a1.
- CT-P06: B06013/P.a2, B06043.a2, B06048/P.a1, B06088.a1, B06098.a2.
- CT-P07: B07004/P.a1, B07010.a1, B07015.a2, B07035/P.a1, B07066/P.a2, B07073/P.a2.
- CT-P08: B08016/20.a1, B08024.a2, B08026.a1, B08050.a2, B08071.a1, B08075/P.a1, B08094/P.a2.
- CT-P09: B09062.a1, B09073/P.a2, B09074/P/P2.a2, B09078/79.a1, B09112.a2.
- PR: PR026/030/061/065/084/090/098/104.a1, PR170/180/186.a2, PR194/265/271.a1.

## Unresolved — 1

- B03020.a1: printed text only says remove the top three; official Q&A reviewed here does not say reveal or look.

## Verification

- Inventory: 190 executable calls across 187 card files, plus four non-executable references/comments.
- Explicit public payloads: 59/59. Explicit private payload: B04012; remaining confirmed private calls use the fail-closed default.
- Required spot checks: B01093, B03096, B09110, B09110P are public; B04012 is private and redacted for CPU.
