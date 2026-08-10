# Route state matrix

Router: `meta-app/src/router/useHashRoute.ts`. Valid hashes are below; an
unknown hash falls back to `#home`. Browser hash/popstate and in-app `onNav`
are real entries. Route cleanup in `meta-app/src/App.tsx` owns match/result/replay
exit cleanup; there is no separate route guard.

| Route | Primary task | Key state | Entry / exit | Persistence | A11y/fallback | Test owner |
| --- | --- | --- | --- | --- | --- | --- |
| `#home` | choose deck, news, recent match | active deck, cached news/history | default/direct; header → screens | deck/meta local storage; history repository | header focus; empty deck/news state | `HomeScreen.test.tsx`, `home.spec.ts` |
| `#setup` | configure human/CPU match | provisional decks, mode, first player | header/home/result; start → match | deck store; match meta is runtime | disabled unavailable controls; cancel/escape restore focus | `SetupScreen.lifecycle.test.tsx`, `setup-refresh.spec.ts` |
| `#match` | play live match | `GameState`, match session, presentation | setup/tutorial practice; result/setup on exit | live state only; recorder writes replay/history on completion | engine public UI; route cleanup settles session | `RealMatchView*.test.tsx`, `golden-path.spec.ts` |
| `#result` | inspect winner and next action | match meta/result | match end; setup/home exit clears completed match | canonical history row | clear result fallback when absent | `ResultScreen.mvp.test.tsx`, `history-result-wave2.test.tsx` |
| `#deck` | edit saved decks | deck draft, card pool | header; save/cancel → home | deck store local storage | discard confirmation; compact controls | `DeckEditor.tsx` tests, `cards-deck-wave1.spec.ts` |
| `#cards` | search/filter/inspect cards | query, sort, filters, favorites | header; header exit | settings favorites; filter state store | drawer traps/restores focus; no-results state | `CardsScreen.test.tsx`, `cards.spec.ts` |
| `#history` | browse recorded matches | canonical rows, selected row | header/result; replay → history | history replay repository | loading/empty/error-safe state | `history*.test.tsx`, `history.spec.ts` |
| `#replay/:id` | replay one stored artifact | validated artifact ID, read-only frame | history; return → history | repository artifact; no live resolver hydrate | invalid/missing ID returns safe history state | `replayRoute.test.ts`, `ReplayScreen*.test.tsx` |
| `#tutorial` | learn lessons/start practice | cleared steps, pending practice | header; practice → match, return → tutorial | meta settings local storage | semantic lesson controls, focus return | `TutorialScreen*.test.tsx`, `tutorial*.spec.ts` |
| `#settings` | adjust presentation/preferences | density, speeds, sound, favorites | header; any header route exit | `conan.meta.v1.settings` persisted settings | labelled controls; normalization rejects invalid stored values | `metaStore.settings-v2.test.ts`, `settings-refresh.spec.ts` |

Direct `#replay` has route `replay` but no valid artifact ID; the screen must
take its existing safe return/error path instead of loading arbitrary data.
