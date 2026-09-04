# QA Wave81: certify disguise observers and duration

- Certify B02043, B02045, B02047, and B03050 without merging Wave80's distinct
  question hash.
- Fix BUG-345 by scoping B02047 contact immunity to one action; prove a second
  same-turn contact removes it normally.
- Fix BUG-346 by freezing the replaced character's effective AP/LP/level before
  disguise, preserving continuous and aura values without new-card pollution.
