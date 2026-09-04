# Waves84-85 authority

Fetched 2026-08-24 with the current official API parser into isolated OS temp
root `conan-cards-data-wave84-85-20260824-a`. Live cards-data stayed unchanged.

## Corpus

- 2257 cards / 22 packages.
- 2964 normalized Q&A items / 0 conflicts.
- Normalized corpus SHA-256:
  `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`.

## Wave84 exact group

- Question `5594be19e41fbe1cb70124f3ccc6258a69b9f9801326e96045000df8c95df77c`.
- Answer `b79af84d1269cf62ae85ac95d41ce067c3c3dd661890d73e47e4fb451572fe70`.
- Section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- QA suffix `f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398`.
- Members: B05062; B07090/P; B08029/P; D08024; D09025; PR291; PR297.
- Five records were test-missing. B05062 and B08029 were matched controls
  whose prior tests used a scene with room.
- Ruling: an effect may enter a character at a five-character scene by first
  removing one own scene character as a switch.
- BUG-350 supplies the same mandatory switch authority for autonomous direct
  `sceneEnter` picks; B08029 fixes choice, entry, rider, and enter-hook order.

Source TSV SHA-256:

- CT-P05 event: `f1cbadb6f6b5177be03ab8235200c3da73b92c837afd11d2ba321f824ab3d13d`.
- CT-P07 event: `c2d8fdae4b16dbd3963a7e6a1100f17e7ed0625ba424d4fbf871abab9e3dd4a9`.
- CT-P08 event: `0355d32c695295dd967cb9f89155db0f0ef1c5cb3e1894ab77511758f3f17dbc`.
- CT-D08 event: `2b952dd6f78ed61c5204566fb4051f0886dba12f3204ccbd56c18093d5fd902d`.
- CT-D09 event: `fa0aecef6de193ebc11d4d0f4e90e3c8106f50a36d121b18d07aaa8786a52f5f`.
- PR-01 event: `ed4f08505f60c4ac4ac90de58b970bd4ad67c5901c9e16a4abd1e7ec51e3bb6a`.

## Wave85 exact group

- Question `3e07603cb3f289f43354d143cf804703fb8ac01bb708bcf74c8ab310405eead2`.
- Answer `1b2c898e067f3d339db0b91e7d5aaa953bcb98174c1eb0361d7bb21519cd549a`.
- Section `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
- QA suffix `b294bc57d842a4b1a4aae0d72a5235a9ace1fc0a3c60e43df68c9e6c939153ce`.
- Members: B01011, B01050, B01052, B03120, PR180, and PR186.
- Five records were test-missing. B01011 was a false-green matched control.
- Ruling: printed sleep entry applies to ability/effect entry and must be the
  character's state before the `enter` event, not a later state-change effect.
- BUG-349 migrated B01011/B01050/B01052/B03120 and horizontal reprint D06016
  to `CardDef.entersSleep`; PR180/PR186 were correct controls.

Source TSV SHA-256:

- CT-P01 character: `73711731eb711aee9d5f102e50e5bd1692745ebf6f576db0b699e204784fe68d`.
- CT-P03 character: `67b6c7e245786a7fbc9030e4bfe43a5d594b522f9f71bd756b34f068c230f609`.
- CT-D06 character: `396a699f9e5c92d6b5a1288c9a6dd9c599325e58f481147c8d11d3614f82eca7`.
- PR-01 character: `36bd59f8e4fcbcd49a200ec1d7c235e55aebe950a5c01165a7ebad97c8e1317f`.
