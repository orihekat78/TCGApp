import type { Effect } from '../types/index.js';
import type { ContinuationFrame } from './pending-state.js';

type Player = 'self' | 'opp';

const SCENE_ENTER_SWITCH_PICK = '__sceneEnterSwitchPick';
const SCENE_ENTER_SWITCH_ORIGINAL_ARGS = '__sceneEnterSwitchOriginalArgs';
const DEFER_SCENE_SWITCH_CHOICE = 'deferSceneSwitchChoice';
const SCENE_ENTER_SOURCE_AREAS = new Set([
  'remove', 'hand', 'deck', 'evidence', 'file', 'partner', 'partner-area',
]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every(key => allowedSet.has(key));
}

export function isSceneEnterSwitchPickArgs(args: unknown): boolean {
  return args !== null
    && typeof args === 'object'
    && !Array.isArray(args)
    && (args as Record<string, unknown>)[SCENE_ENTER_SWITCH_PICK] === true;
}

/** Turn a fixed scene entry into a second, scene-owner-controlled switch decision. */
export function sceneEnterSwitchPickEffect(
  args: Record<string, unknown>,
  enterPlayer: Player,
  ownerPlayer: Player,
): Extract<Effect, { kind: 'atom' }> {
  return {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      uid: '$pick',
      target: {
        kind: 'pick',
        chooser: enterPlayer,
        n: { min: 1, max: 1 },
        query: {
          area: 'scene',
          side: enterPlayer === ownerPlayer ? 'self' : 'opp',
        },
      },
      [SCENE_ENTER_SWITCH_PICK]: true,
      [SCENE_ENTER_SWITCH_ORIGINAL_ARGS]: args,
    },
  };
}

/** Restore the original scene-entry atom with one already-authorized switch victim. */
export function resolveSceneEnterSwitchPickArgs(
  args: Record<string, unknown>,
  switchRemoveUid: string,
): Record<string, unknown> | null {
  if (!isSceneEnterSwitchPickArgs(args)) return null;
  const original = args[SCENE_ENTER_SWITCH_ORIGINAL_ARGS];
  if (original === null || typeof original !== 'object' || Array.isArray(original)) return null;
  return { ...(original as Record<string, unknown>), switchRemoveUid };
}

function relativePlayer(value: unknown, owner: Player): Player | null {
  if (value === 'self') return owner;
  if (value === 'opp') return owner === 'self' ? 'opp' : 'self';
  return null;
}

type SwitchScan = { players: Set<Player>; deferred: boolean };

export function sceneEnterOwnsNextPick(args: Record<string, unknown>): boolean {
  const target = args.target !== null && typeof args.target === 'object';
  return (args.cardId === undefined
      && typeof args.from === 'string'
      && (args.n !== undefined || args.max !== undefined))
    || (args.cardId === '$pick.cardId' && target)
    || (args.cardIds === '$pick.cardIds' && target);
}

/** Validate the complete state-owned authority for the synthetic switch choice. */
export function isValidSceneEnterSwitchPickAuthority(
  args: unknown,
  player: Player,
  ownerPlayer: Player | undefined,
  contextOwnerPlayer: Player | undefined,
): boolean {
  const value = record(args);
  if (!value || !isSceneEnterSwitchPickArgs(value)
    || (ownerPlayer !== 'self' && ownerPlayer !== 'opp')
    || contextOwnerPlayer !== ownerPlayer
    || !hasOnlyKeys(value, [
      'uid', 'target', SCENE_ENTER_SWITCH_PICK, SCENE_ENTER_SWITCH_ORIGINAL_ARGS,
    ])
    || value.uid !== '$pick') {
    return false;
  }
  const target = record(value.target);
  const range = record(target?.n);
  const query = record(target?.query);
  const expectedSide = player === ownerPlayer ? 'self' : 'opp';
  if (!target || !range || !query
    || !hasOnlyKeys(target, ['kind', 'chooser', 'n', 'query'])
    || !hasOnlyKeys(range, ['min', 'max'])
    || !hasOnlyKeys(query, ['area', 'side'])
    || target.kind !== 'pick'
    || target.chooser !== player
    || range.min !== 1
    || range.max !== 1
    || query.area !== 'scene'
    || query.side !== expectedSide) {
    return false;
  }
  const original = record(value[SCENE_ENTER_SWITCH_ORIGINAL_ARGS]);
  const sourceTarget = record(original?.target);
  const sourceQuery = record(sourceTarget?.query);
  if (!original
    || isSceneEnterSwitchPickArgs(original)
    || sceneEnterOwnsNextPick(original)
    || typeof original.cardId !== 'string'
    || original[DEFER_SCENE_SWITCH_CHOICE] !== true
    || original.sourceRequired !== true
    || !sourceTarget
    || !sourceQuery
    || !SCENE_ENTER_SOURCE_AREAS.has(String(sourceQuery.area))
    || relativePlayer(sourceQuery.side, ownerPlayer) !== player
    || original.switchRemoveUid !== undefined
    || original.switchRemoveUids !== undefined) {
    return false;
  }
  const originalPlayer = relativePlayer(original.player ?? 'self', ownerPlayer);
  return originalPlayer === player;
}

function scanEffectSceneSwitch(effect: Effect, owner: Player): SwitchScan {
  if (effect.kind === 'atom') {
    if (effect.verb !== 'sceneEnter') return { players: new Set(), deferred: false };
    const args = effect.args as Record<string, unknown>;
    if (sceneEnterOwnsNextPick(args)) return { players: new Set(), deferred: true };
    const player = relativePlayer(args.player, owner);
    return { players: new Set(player ? [player] : []), deferred: false };
  }
  if (effect.kind === 'sequence' || effect.kind === 'parallel') {
    const players = new Set<Player>();
    for (const step of effect.steps) {
      const result = scanEffectSceneSwitch(step, owner);
      result.players.forEach((player) => players.add(player));
      if (result.deferred) return { players, deferred: true };
    }
    return { players, deferred: false };
  }
  if (effect.kind === 'conditional') {
    const thenResult = scanEffectSceneSwitch(effect.then, owner);
    const elseResult = effect.else
      ? scanEffectSceneSwitch(effect.else, owner)
      : { players: new Set<Player>(), deferred: false };
    return {
      players: new Set([...thenResult.players, ...elseResult.players]),
      deferred: thenResult.deferred || elseResult.deferred,
    };
  }
  if (effect.kind === 'optional') return scanEffectSceneSwitch(effect.effect, owner);
  return { players: new Set(), deferred: false };
}

/** Whether a paused pick can resume into an effect-based scene entry for this side. */
export function continuationMayEnterSceneForPlayer(
  continuation: ContinuationFrame | undefined,
  player: Player,
): boolean {
  for (let frame = continuation; frame; frame = frame.outer) {
    const owner = frame.ctx.source.player as Player;
    for (const effect of frame.remainder) {
      const result = scanEffectSceneSwitch(effect, owner);
      if (result.players.has(player)) return true;
      if (result.deferred) return false;
    }
  }
  return false;
}

type AttachResult = { effect: Effect; attached: boolean };

function attachFirstSceneEnterSwitchChoice(effect: Effect, switchRemoveUid: string): AttachResult {
  if (effect.kind === 'atom') {
    return effect.verb === 'sceneEnter'
      ? { effect: { ...effect, args: { ...(effect.args as Record<string, unknown>), switchRemoveUid } }, attached: true }
      : { effect, attached: false };
  }
  if (effect.kind === 'sequence' || effect.kind === 'parallel') {
    let attached = false;
    const steps = effect.steps.map((step) => {
      if (attached) return step;
      const result = attachFirstSceneEnterSwitchChoice(step, switchRemoveUid);
      attached = result.attached;
      return result.effect;
    });
    return { effect: { ...effect, steps }, attached };
  }
  if (effect.kind === 'conditional') {
    // Both branches are alternatives. Authorize the first scene entry in each
    // so the choice remains valid whichever branch the saved bindings select.
    const thenResult = attachFirstSceneEnterSwitchChoice(effect.then, switchRemoveUid);
    const elseResult = effect.else
      ? attachFirstSceneEnterSwitchChoice(effect.else, switchRemoveUid)
      : undefined;
    return {
      effect: {
        ...effect,
        then: thenResult.effect,
        ...(elseResult ? { else: elseResult.effect } : {}),
      },
      attached: thenResult.attached || (elseResult?.attached ?? false),
    };
  }
  if (effect.kind === 'optional') {
    const result = attachFirstSceneEnterSwitchChoice(effect.effect, switchRemoveUid);
    return { effect: { ...effect, effect: result.effect }, attached: result.attached };
  }
  return { effect, attached: false };
}

function attachFirstInRemainder(
  remainder: Effect[],
  switchRemoveUid: string,
): { remainder: Effect[]; attached: boolean } {
  let attached = false;
  const next = remainder.map((effect) => {
    if (attached) return effect;
    const result = attachFirstSceneEnterSwitchChoice(effect, switchRemoveUid);
    attached = result.attached;
    return result.effect;
  });
  return { remainder: next, attached };
}

/** Attach one switch victim to the first future scene-entry continuation. */
export function withContinuationSceneEnterSwitchChoice(
  continuation: ContinuationFrame,
  switchRemoveUid: string | undefined,
): ContinuationFrame {
  if (!switchRemoveUid) return continuation;
  const head = attachFirstInRemainder(continuation.remainder, switchRemoveUid);
  if (head.attached) return { ...continuation, remainder: head.remainder };
  return continuation.outer
    ? { ...continuation, outer: withContinuationSceneEnterSwitchChoice(continuation.outer, switchRemoveUid) }
    : continuation;
}

/** Attach one already-authorized scene-switch victim to every sceneEnter branch. */
export function withSceneEnterSwitchChoice(
  effect: Effect,
  switchRemoveUid: string | undefined,
): Effect {
  if (!switchRemoveUid) return effect;
  if (effect.kind === 'atom') {
    return effect.verb === 'sceneEnter'
      ? { ...effect, args: { ...(effect.args as Record<string, unknown>), switchRemoveUid } }
      : effect;
  }
  if (effect.kind === 'sequence' || effect.kind === 'parallel') {
    return {
      ...effect,
      steps: effect.steps.map(step => withSceneEnterSwitchChoice(step, switchRemoveUid)),
    };
  }
  if (effect.kind === 'conditional') {
    return {
      ...effect,
      then: withSceneEnterSwitchChoice(effect.then, switchRemoveUid),
      ...(effect.else
        ? { else: withSceneEnterSwitchChoice(effect.else, switchRemoveUid) }
        : {}),
    };
  }
  if (effect.kind === 'optional') {
    return { ...effect, effect: withSceneEnterSwitchChoice(effect.effect, switchRemoveUid) };
  }
  return effect;
}
