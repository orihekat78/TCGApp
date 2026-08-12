// Legacy entrypoint retained for operator compatibility.
// All packages are regenerated through the crash-recoverable root transaction.
const { regenerateAllLocked } = require('./_regen_all.cjs');

const result = regenerateAllLocked();
if (result.lockCleanupPending) {
  console.error('TSV regeneration committed; cards-data write-lock cleanup is pending');
}
