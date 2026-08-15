import type { Effect } from '../types/index.js';

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
