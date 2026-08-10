import { afterEach, describe, expect, it } from 'vitest';
import { matchMetaSessionId, normalizeSettings, SPECTATOR_AI_SPEED_MS, useMetaStore } from '../../meta-app/src/state/metaStore';

const SETTINGS_KEY = 'conan.meta.v1.settings';

afterEach(() => {
  localStorage.removeItem(SETTINGS_KEY);
  useMetaStore.setState({ settings: normalizeSettings(null) });
});

describe('meta settings v2 persistence', () => {
  it('migrates valid v1 settings while dropping visual legacy fields', () => {
    expect(normalizeSettings({
      theme: 'crimson',
      speed: 1.5,
      density: 'compact',
      spectatorAi: 1200,
      favorites: ['D08001'],
      cardBack: 'jade',
      bgmVolume: 20,
      seEnabled: false,
      tutorialClearedStepIds: ['ch1-1', 'L0-1', 'L0-1', 'unknown'],
      unknown: 'discard me',
    })).toEqual({
      density: 'compact',
      presentationSpeed: 'fast',
      spectatorAi: 'slow',
      favorites: ['D08001'],
      cardBack: 'jade',
      bgmVolume: 20,
      seEnabled: false,
      tutorialClearedStepIds: ['L0-1', 'L1-1', 'L1-2'],
    });
  });

  it.each([null, [], 'invalid', 1, { density: 'wide', spectatorAi: 'turbo' }])(
    'defaults malformed persisted settings: %j',
    (value) => {
      expect(normalizeSettings(value)).toMatchObject({
        density: 'comfortable',
        presentationSpeed: 'standard',
        spectatorAi: 'standard',
      });
    },
  );

  it('exposes the spectator presets used by the existing match runtime', () => {
    expect(SPECTATOR_AI_SPEED_MS).toEqual({ slow: 800, standard: 400, fast: 200 });
  });

  it.each([
    [200, 'fast'],
    [300, 'fast'],
    [400, 'standard'],
    [600, 'standard'],
    [800, 'slow'],
    [1200, 'slow'],
  ] as const)('migrates the legacy spectator delay %ims to the nearest v2 preset', (legacyMs, preset) => {
    expect(normalizeSettings({ spectatorAi: legacyMs }).spectatorAi).toBe(preset);
  });

  it('rehydrates v1 then persists only the v2 settings shape', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      version: 1,
      state: {
        settings: {
          theme: 'noir', speed: 0.5, density: 'compact', spectatorAi: 1200,
          favorites: ['D08001'], cardBack: 'jade', bgmVolume: 20, seEnabled: false,
          tutorialClearedStepIds: ['ch1-1', 'L0-1'], unknown: 'discard me',
        },
      },
    }));

    await useMetaStore.persist.rehydrate();
    useMetaStore.getState().setSettings({ density: 'compact' });

    expect(useMetaStore.getState().settings).toEqual({
      density: 'compact', presentationSpeed: 'slow', spectatorAi: 'slow',
      favorites: ['D08001'], cardBack: 'jade', bgmVolume: 20, seEnabled: false,
      tutorialClearedStepIds: ['L0-1', 'L1-1', 'L1-2'],
    });
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')).toEqual({
      version: 2,
      state: { settings: useMetaStore.getState().settings },
    });
  });

  it('migrates only semantically equivalent legacy tutorial progress', () => {
    expect(normalizeSettings({
      tutorialClearedStepIds: ['ch4-1', 'ch5-5', 'ch7-6', 'ch8-1', 'ch8-5', 'unknown'],
    }).tutorialClearedStepIds).toEqual([
      'L4-1', 'L4-2', 'L5-4', 'L12-3', 'L13-1',
    ]);
  });

  it('keeps match metadata available until the route owner clears it', () => {
    const meta = { sessionId: 'session-42', mode: 'solo' as const, selfDeckName: 'D08', oppDeckName: 'D11' };
    useMetaStore.getState().setMatchMeta(meta);

    expect(useMetaStore.getState().getMatchMeta()).toEqual(meta);
    expect(useMetaStore.getState().getMatchMeta()).toEqual(meta);
    useMetaStore.getState().clearMatchMeta();
    expect(useMetaStore.getState().getMatchMeta()).toBeNull();
  });

  it('namespaces match metadata IDs while keeping each token stable', () => {
    expect(matchMetaSessionId(7)).toBe(matchMetaSessionId(7));
    expect(matchMetaSessionId(7)).not.toBe(matchMetaSessionId(8));
    expect(matchMetaSessionId(7)).toMatch(/^match-[0-9a-f-]+-7$/i);
  });
});
