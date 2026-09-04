## QA Wave 32 — Shuffle Romance and contact-host direction

- Certified eleven official QA records across B01023/P, D10024, B03041/P, and B06012/P through twenty-five public-dispatch regression cases.
- Proved private deck looks, zero selection, short-deck and refresh boundaries, mandatory/no-host set branches, face-up attachment, host-leave cleanup, and replay redaction.
- Fixed set-host contact triggers to match the exact host as either participant, so opponent-caused contacts resolve before cut-in without creating observer-wide matches.
- Applied the same directional correction to the horizontally equivalent B03041/P and B06012/P printings.
- Deferred contact action-order confirmation in a GameState phase until every `contact:start` effect drains, including human decision pauses, so post-effect AP determines order.
- Ended contact immediately without setting action order when a start effect removes either participant, matching the existing B04046/P removal family.
- Grounded all seven affected printings against pinned official TSV rows without adding a card DSL primitive.
- Advanced exact official-QA coverage from 1,183 to 1,194 matched records; test-missing falls from 1,781 to 1,770.
