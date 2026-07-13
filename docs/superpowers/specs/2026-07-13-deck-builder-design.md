# Deck builder and launcher design

## Scope

- Update the one-click launcher to start the game and deck builder together.
- Add in-app deck creation/editing, JSON import/export, and valid-deck selection at game start.

## Launcher

- `start.bat` remains the user entry point.
- Its PowerShell helper verifies Node and dependencies, then starts the main app (5173) and deck-builder app (5174).
- It polls both URLs before opening their browser pages. A timeout gives exact manual URLs and leaves both server windows running.

## Decks

- Store named user decks in localStorage; JSON is the portable import/export format.
- Editor supplies search, filters, add/remove counts, duplicate/delete, and validation feedback.
- Valid means exactly 50 cards and at most three copies of every card ID, per rules/02.
- Invalid decks can be edited and exported, but cannot be selected to start a game.
- Import rejects malformed documents, unknown IDs, invalid counts, and invalid rule constraints without replacing saved data.

## Game integration

- Game setup lists MVP decks and valid saved decks.
- It converts selected saved entries into the existing public deck-pair builder input; no UI code mutates engine state directly.

## Boundaries and tests

- Deck persistence, JSON codecs, validation, and catalog lookup are pure services with unit tests.
- UI tests cover editor changes and setup selection. Playwright covers launcher-visible routes, import/export, validation, and starting a match.
- Edge cases: zero cards, 49/51 cards, four copies, unknown ID, corrupted JSON, duplicate deck names, deleted selected deck, and storage unavailable.
