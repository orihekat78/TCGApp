# QA Wave85: fix and certify inherent sleep entry

- Certify B01050, B01052, B03120, PR180, and PR186; reauthenticate B01011's
  false-green control with effect-entry timing evidence.
- Fix BUG-349 by migrating B01011/B01050/B01052/B03120 and horizontal D06016
  from delayed sleep effects to `CardDef.entersSleep`.
- Prove sleep before `enter`, zero false `state:change`, genuine enter riders,
  public effect entry, full-scene switch, owner orientation, and save hydration.
