## QA Wave 39 — assisting partners in FILE-gated enter effects

- Certified five official QA records for B04023, D09014, D09015, PR137, and PR143.
- Ran public `assist` followed by public `handUseCard` at FILE6 and FILE7.
- B04023 surfaces its optional only at FILE7; D09014/D09015 surface their sleep picker only at FILE7.
- PR137/PR143 keep choice 0 selectable below threshold as an official no-op and expose its optional only at FILE7.
- Resolved every choice, optional, and picker through bound public decision actions.
- Kept B04023's independent next-hint reduction ruling test-missing.
- Added pinned grounding decisions for all five cards; no production change found.
- Advanced coverage from 1,244 to 1,249 matched records; test-missing falls from 1,720 to 1,715.
