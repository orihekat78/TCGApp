# cards-data package IDs

Stable local package IDs follow the official set family:

| Family | IDs |
|---|---|
| Case-StartDeck | `CT-D01`–`CT-D05` |
| Case-ThemeDeck | `CT-D06`–`CT-D11` |
| Case-Booster | `CT-P01`–`CT-P10` |
| Promotion | `PR-01` |

The official API currently labels the promotion category `PRカード`; the fetcher
maps that label to stable local ID `PR-01`.

Counts are deliberately absent here. Read [status.json](status.json) for the
generated package printing map, kind map, card-number hashes, duplicate check,
source URL, and snapshot time. This prevents stale hand-maintained totals.

MVP production data remains CT-D08 and CT-D11 only. The local cache covers all
official packages for compiler/grounding support and remains ignored.
