# BUG-311 forced reveal / whole-deck shuffle grounding

- Authority packet: release `191a8c7bfae2f027995030322f081837c44d8fcc`, source digest
  `8409a76a2b33dcd65f339b97741ae2e0eaba2fd7175ecd789dc5b9e5e72137c9`.
- Exact printed tail for every member: `残りの公開したカードをデッキの下に移し、デッキをシャッフルする。`
- No member grants a bottom-order choice. The matching card is mandatory; the remainder moves to bottom,
  then the whole deck is shuffled. `deckToBottomBound(order:'preserve')` expresses that contract.
- Members: `D10003,D10004,D11019,B01018,B02050,B03028,B03031,B03031P,B03062,B03062P,
  B04051,B04051P,B05017,B05042,B05077,B05114,B06010,B06011,B06011P,B06053,B06053P,
  B07038,B07043,B07052,B07086,B08060,B08060P,B09109,B09109P,PR117,PR118,PR195`.
- TSV SHA-256: `ct-d10/character` `4a48d77e82e5ef0cea882de9f304b5a699bb9782c97abde1930296f2df7f5b51`;
  `ct-d11/event` `bea855db013482de6484c7d2a1c29a50ab3e22786447b20057b20f63dcc8b0b2`;
  `ct-p01/character` `73711731eb711aee9d5f102e50e5bd1692745ebf6f576db0b699e204784fe68d`;
  `ct-p02/character` `5773e343d972092e612b4d0ac299b663e3153b2b40fbd01a130ebccfaca653ab`;
  `ct-p03/character` `67b6c7e245786a7fbc9030e4bfe43a5d594b522f9f71bd756b34f068c230f609`;
  `ct-p03/event` `a1c04fd314135f1af6f71a4fdcc3778ba771810269c4f09fb9fc0429546eb8c7`;
  `ct-p04/character` `266d9cdaf765879d3f009c630818354f0e66545fd0d51fb63473da0439dbbd94`;
  `ct-p05/character` `f9fd90bcd2b0ea41fc7274cde0114f6e4109c92c82f7972ebef7f216e4018074`;
  `ct-p05/event` `f1cbadb6f6b5177be03ab8235200c3da73b92c837afd11d2ba321f824ab3d13d`;
  `ct-p06/character` `15eab04615778f7ce4c436924e5a8966b91d2f19499cfad9c07de35191ba7bd7`;
  `ct-p07/character` `d53cafbfcc4415940f6e8879c1cc51633b1644924b0492fdb25484d11c7e3019`;
  `ct-p08/event` `0355d32c695295dd967cb9f89155db0f0ef1c5cb3e1894ab77511758f3f17dbc`;
  `ct-p09/character` `34f2babbaaf07cef0f19ff7a765ca7052262d7c43637230b606b14306ff20c04`;
  `pr-01/character` `3d4feccc677b7d4df75498f9e872c743cc94236d0e1938d9ec01928d7e5651cf`;
  `pr-01/event` `ed4f08505f60c4ac4ac90de58b970bd4ad67c5901c9e16a4abd1e7ec51e3bb6a`.
- Raw-to-TSV text matched 32/32 after newline normalization. Generated dossiers are under
  `.tmp/ground-wave9-20260816/`.
- Exclusions: `B03018` uses a different “shuffle the remainder, then move it to bottom” instruction;
  `PR135/PR141` remain blocked by an independent missing-ability defect.
