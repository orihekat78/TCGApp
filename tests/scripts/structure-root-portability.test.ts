import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { renderStructureRootSummary } from '../../scripts/gen-docs/gen-structure';

describe('structure root summary portability', () => {
  it('renders the same project-relative label for different clone roots', () => {
    const rootA = resolve('C:/tmp/conan-clone-a');
    const rootB = resolve('D:/workspace/conan-clone-b');
    const summaryA = renderStructureRootSummary(rootA);
    const summaryB = renderStructureRootSummary(rootB);

    expect(summaryA).toBe('- **対象ルート**: `.`');
    expect(summaryB).toBe(summaryA);
    expect(summaryA).not.toContain(rootA.replaceAll('\\', '/'));
    expect(summaryB).not.toContain(rootB.replaceAll('\\', '/'));
  });
});
