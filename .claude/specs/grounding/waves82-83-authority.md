# Waves82-83 authority

Fetched 2026-08-24 with the current official API parser into an isolated OS
temporary root. The first worktree `.tmp` attempt failed during an atomic
directory rename under OneDrive; it left only empty ignored roots. The same
parser completed outside OneDrive without touching live cards-data.

## Corpus

- 2257 cards / 22 packages.
- 2964 normalized Q&A items / 0 conflicts.
- Normalized corpus SHA-256:
  `9a36b5d40860f10a6688bb34d6e52c143b7a996d5f3f561486c6384907b723ec`.
- CT-P02 raw SHA-256:
  `1de541b54ac60762bf9dc5e9c1ef4133d1c2c6b5af6f4c332fc51b7439808ce7`.
- CT-P03 raw SHA-256:
  `0a1b2128d01ba478be2a0d5582babcc7b940b8d43629204c4e6fe1d41c452cf6`.
- CT-P02 character TSV SHA-256:
  `5773e343d972092e612b4d0ac299b663e3153b2b40fbd01a130ebccfaca653ab`.
- CT-P03 character TSV SHA-256:
  `67b6c7e245786a7fbc9030e4bfe43a5d594b522f9f71bd756b34f068c230f609`.

## Wave82 exact group

- Question `ec58a8a7c7211d94959b85a007ced3e8c692c54c4a106fb92abebfe5c9660435`.
- Answer `aac3f501aac8a6f258c10970c01ed9a7ef08ae569ea2598c91183828a718d96a`.
- Section `a7490cde656fdea72d6939329d372f44f8631dd88e1a4cbad59dbda0fd53bcb5`.
- Members: B02038/P, B02041/P, B02043, B02044/P, B02045, B02047.
- Five records were test-missing; B02045 was a false-green matched control.
- Ruling: a multicolor case satisfies 【事件（白）】 whenever white is one of
  its colors. D06019 is the official green+white witness.

## Wave83 exact group

- Question `a6d4bbd6170b3457e1cfb10f2f4f93681bd4e4d4645589023a949de6e7b8e1a2`.
- Answer `28c958b7b5f6584c1568157c061c38488d94b7fdb96d0d40b41138a65bd245b3`.
- Section `0029d75498ecdbd0f5ec8a773acb521b538c42cfb00ee15631b9b02d68462f09`.
- Members: B03050, B03051, B03052/P, B03129/P.
- Three records were test-missing; B03129 was a false-green matched control.
- Ruling: disguise exchanges the hand card with the contacting scene slot,
  moves the old physical face to deck bottom, and retains state, modifiers,
  gained effects, set cards, and stacked cards.

## Adjacent false-green

- B03050 Q&A `card:B03050:19fb99eecd85e2306c2887c5c7eb1210d8e663ec05473fb8f45d59e9f1475925`
  was matched only to a direct manual probe. Public first-actor resolution
  exposed BUG-348: self-removal incorrectly advanced to the opponent action.
