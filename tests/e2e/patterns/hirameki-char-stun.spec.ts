import { test, expect, type Page } from '@playwright/test';
import { setupGamePage, buildGameState, dispatchAction, expectNoConsoleErrors } from '../helpers';
import type { GameStateLike } from '../helpers';

// Round 4k: hiramekiCharStun パターン (アクション[事件] 経由のヒラメキ → キャラを1枚 sleep) を
// 2 カード集約検証。共通パターン spec 5/5 → 6/5 拡張。
//
// 共通契約:
//   - ability.type === 'icon-flash' / scope === 'on-evidence'
//   - effect = { kind:'choice', options:[{ kind:'atom', verb:'sceneSetState',
//       args:{ uid:'$pick', state:'sleep', target:{kind:'pick', query:{area:'scene', side},
//       n:{min:0,max:1}, chooser:'self'}}}]}
//   - listener: src/engine/listeners/hirameki.ts が `evidence:remove-by-action` hook で
//     side-channel populate (Round 4j-fix で globalThis 経由化)
//
// 対象カード:
//   - D08019 a2 (character / 阿笠博士 / 青 Lv5): hiramekiCharStun({ side:'either', abilityId:'a2' })
//   - D11009 a3 (character / 萩原研二 / 黄 Lv7): hiramekiCharStun({ side:'either', abilityId:'a3' })
//
// 検証層 (Round 4k scope B):
//   1. shape: choice → atom sceneSetState 構造 (hiramekiDraw との差分点を明示)
//   2. fire path (no-op fallback): listener fire → pendingHirameki populate →
//      hiramekiResolve('fire') → effect queue + runAllUntilEmpty → state 不変 (BUG-035 既知挙動)
//   3. skip path: 同 dispatch → pendingHirameki populate → hiramekiResolve('skip') → state 不変
//   + negative: D08015 (icon-flash 非持ち) → pendingHirameki null
//
// ⚠️ BUG-035 (本 round で登録): `$pick` auto-resolution 未実装 (Phase 7 deferred)。
//   `entryToCtx` が `dyn` 未供給 + `sceneSetState` atom が `'$pick'` リテラルそのまま渡し →
//   fire path は no-op fallback、scene state 変化は engine fix 後に検証可能。
//
// 設計: Round 4j-fix で確立した test-isolation (opp が attacker、self が hirameki owner) を流用。

type FileCardLike = { type: 'card-back'; cardId: string };

async function probeCharStunAbility(
  page: Page,
  cardId: string,
  abilityId: string,
): Promise<{
  abilityExists: boolean;
  typeIsIconFlash: boolean;
  scopeIsOnEvidence: boolean;
  outerKind: string | null;
  optionsLen: number | null;
  innerKind: string | null;
  innerVerb: string | null;
  innerStateArg: string | null;
  innerUidArg: string | null;
  pickArea: string | null;
  pickSide: string | null;
  pickNMax: number | null;
}> {
  return (await page.evaluate(
    ({ cId, aId }) => {
      const w = (window as unknown as {
        __game: { read: { def: { card: (id: string) => unknown } } };
      }).__game;
      const def = w.read.def.card(cId) as
        | undefined
        | {
            abilities: {
              id: string;
              type?: string;
              scope?: string;
              effect?: {
                kind?: string;
                options?: {
                  kind?: string;
                  verb?: string;
                  args?: {
                    uid?: string;
                    state?: string;
                    target?: { kind?: string; query?: { area?: string; side?: string }; n?: { max?: number } };
                  };
                }[];
              };
            }[];
          };
      const nullResult = {
        abilityExists: false,
        typeIsIconFlash: false,
        scopeIsOnEvidence: false,
        outerKind: null,
        optionsLen: null,
        innerKind: null,
        innerVerb: null,
        innerStateArg: null,
        innerUidArg: null,
        pickArea: null,
        pickSide: null,
        pickNMax: null,
      };
      if (!def) return nullResult;
      const ability = def.abilities.find((a) => a.id === aId);
      if (!ability) return nullResult;
      const effect = ability.effect;
      const option = effect?.options?.[0];
      const args = option?.args;
      const target = args?.target;
      return {
        abilityExists: true,
        typeIsIconFlash: ability.type === 'triggered' && ability.trigger?.hook === 'evidence:remove-by-action' && ability.trigger?.optional === true, // 2026-05-27 Option C: icon-flash → triggered + optional
        scopeIsOnEvidence: ability.scope === 'on-evidence',
        outerKind: effect?.kind ?? null,
        optionsLen: effect?.options?.length ?? null,
        innerKind: option?.kind ?? null,
        innerVerb: option?.verb ?? null,
        innerStateArg: args?.state ?? null,
        innerUidArg: args?.uid ?? null,
        pickArea: target?.query?.area ?? null,
        pickSide: target?.query?.side ?? null,
        pickNMax: target?.n?.max ?? null,
      };
    },
    { cId: cardId, aId: abilityId },
  )) as Awaited<ReturnType<typeof probeCharStunAbility>>;
}

async function hasIconFlashAbility(page: Page, cardId: string): Promise<boolean> {
  return (await page.evaluate((cId) => {
    const w = (window as unknown as { __game: { read: { def: { card: (id: string) => unknown } } } }).__game;
    const def = w.read.def.card(cId) as undefined | { abilities: { type?: string }[] };
    if (!def) return false;
    return def.abilities.some((a) => a.type === 'triggered' && a.trigger?.hook === 'evidence:remove-by-action' && a.trigger?.optional === true);
  }, cardId)) as boolean;
}

async function getPendingHirameki(
  page: Page,
): Promise<{ player: string; cardId: string; abilityId: string } | null> {
  return (await page.evaluate(() => {
    const w = (window as unknown as { __game: { getState: () => { pendingHirameki: unknown } } }).__game;
    return w.getState().pendingHirameki ?? null;
  })) as Awaited<ReturnType<typeof getPendingHirameki>>;
}

async function getPendingEffectPick(
  page: Page,
): Promise<{ player: string; atomVerb: string; candidates: { uid: string; player: 'self' | 'opp' }[] } | null> {
  return page.evaluate(() => {
    const w = window as unknown as { __game: { getState: () => { pendingEffectPick: unknown } } };
    return (w.__game.getState().pendingEffectPick ?? null) as never;
  });
}

async function getSceneState(page: Page, side: 'self' | 'opp', index: number): Promise<string | null> {
  return (await page.evaluate(
    ({ sd, idx }) => {
      const w = (window as unknown as {
        __game: { getState: () => { gameState: { players: { self: { scene: { state: string }[] }; opp: { scene: { state: string }[] } } } } };
      }).__game;
      const scene = w.getState().gameState.players[sd as 'self' | 'opp'].scene;
      return scene[idx]?.state ?? null;
    },
    { sd: side, idx: index },
  )) as string | null;
}

type FixtureArg = { evidenceCardId: string };

function applyFixture(gs: GameStateLike, arg: FixtureArg): void {
  // Round 4j-fix 反転 pattern: opp が attacker、self が hirameki owner
  // → useHiramekiFlowDriver は pending.player='self' で early return → test が pending 観測可能
  const self = gs.players.self as unknown as {
    partner: { cardId: string; state: string; location: string };
    hand: string[];
    deck: string[];
    evidence: { cardId: string; faceUp: boolean; origin: { turn: number; via: string } }[];
    case: { cardId: string; status: string; requiredEvidence: number; colors: string[] };
    scene: unknown[];
  };
  const opp = gs.players.opp as unknown as {
    partner: { cardId: string; state: string; location: string };
  };

  opp.partner.cardId = 'D11001';
  opp.partner.state = 'active';
  opp.partner.location = 'partner-area';

  self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'] };
  self.evidence = [{ cardId: arg.evidenceCardId, faceUp: false, origin: { turn: 1, via: 'reasoning' } }];
  self.deck = Array.from({ length: 25 }, (_, i) => `self-deck-${i}`);
  self.hand = [];
  // self.scene は default 3 件 (sampleGameState) を維持、scene[0] を active 固定
  // (BUG-035 検証: fire 後も active 不変)
  // default は self-1: D11004 active isNamed=true、これを isNamed=false に正規化
  const ch0 = self.scene[0] as { state: string; isNamed?: boolean } | undefined;
  if (ch0) {
    ch0.state = 'active';
    ch0.isNamed = false;
  }

  void ({} as FileCardLike);
  (gs as unknown as { pendingEffects: unknown[] }).pendingEffects = [];
}

async function dispatchActionCase(page: Page): Promise<void> {
  await dispatchAction(page, { type: 'actionAgainstCase', byUid: 'partner:opp', targetPlayer: 'self' });
}

const CARDS = [
  { cardId: 'D08019', abilityId: 'a2', kind: 'character (阿笠博士)' },
  { cardId: 'D11009', abilityId: 'a3', kind: 'character (萩原研二)' },
] as const;

test.describe('hiramekiCharStun — shape + fire/skip path (2 カード集約, BUG-035 既知挙動)', () => {
  for (const { cardId, abilityId, kind } of CARDS) {
    test(`${cardId} ${abilityId} (${kind}): shape (icon-flash / on-evidence / choice → atom sceneSetState sleep)`, async ({ page }) => {
      const { errors } = await setupGamePage(page);
      await buildGameState<FixtureArg>(page, applyFixture, { evidenceCardId: cardId });

      const probe = await probeCharStunAbility(page, cardId, abilityId);

      expect(probe.abilityExists, 'ability is defined').toBe(true);
      expect(probe.typeIsIconFlash, "type === 'icon-flash'").toBe(true);
      expect(probe.scopeIsOnEvidence, "scope === 'on-evidence'").toBe(true);
      expect(probe.outerKind, "effect.kind === 'choice' (hiramekiDraw との差分)").toBe('choice');
      expect(probe.optionsLen, 'effect.options.length === 1').toBe(1);
      expect(probe.innerKind, "option.kind === 'atom'").toBe('atom');
      expect(probe.innerVerb, "option.verb === 'sceneSetState'").toBe('sceneSetState');
      expect(probe.innerStateArg, "args.state === 'sleep'").toBe('sleep');
      expect(probe.innerUidArg, "args.uid === '$pick'").toBe('$pick');
      expect(probe.pickArea, "target.query.area === 'scene'").toBe('scene');
      expect(probe.pickSide, "target.query.side === 'either'").toBe('either');
      expect(probe.pickNMax, 'target.n.max === 1').toBe(1);

      expectNoConsoleErrors(errors);
    });

    test(`${cardId} ${abilityId} (${kind}): fire path → 敵 scene state sleep (Phase 7-3 chooseAtomTarget)`, async ({ page }) => {
      const { errors } = await setupGamePage(page);
      await buildGameState<FixtureArg>(page, applyFixture, { evidenceCardId: cardId });

      await dispatchActionCase(page);

      const pending = await getPendingHirameki(page);
      expect(pending, 'pendingHirameki populated').not.toBeNull();
      expect(pending?.player, 'pending.player === self').toBe('self');
      expect(pending?.cardId, `pending.cardId === ${cardId}`).toBe(cardId);
      expect(pending?.abilityId, `pending.abilityId === ${abilityId}`).toBe(abilityId);

      const selfStateBefore = await getSceneState(page, 'self', 0);
      const oppStateBefore = await getSceneState(page, 'opp', 0);
      expect(selfStateBefore, 'pre-fire self.scene[0] is active').toBe('active');
      expect(oppStateBefore, 'pre-fire opp.scene[0] is active (sampleGameState 既定)').toBe('active');
      await dispatchAction(page, { type: 'hiramekiResolve', choice: 'fire' });

      // 「1枚まで選ぶ」は人間所有なら自動選択しない。相手候補を明示して解決する。
      await expect.poll(async () => (await getPendingEffectPick(page))?.atomVerb ?? null).toBe('sceneSetState');
      const effectPick = await getPendingEffectPick(page);
      expect(effectPick?.player).toBe('self');
      const opponent = effectPick?.candidates.find((candidate) => candidate.player === 'opp');
      expect(opponent, '相手キャラがヒラメキ対象候補').toBeTruthy();
      await dispatchAction(page, { type: 'effectPickResolve', pickedUid: opponent!.uid });

      const selfStateAfter = await getSceneState(page, 'self', 0);
      const oppStateAfter = await getSceneState(page, 'opp', 0);

      // Phase 7-3 (chooseAtomTarget): hiramekiResolve handler が $pick を verb 別ヒューリスティックで
      // 置換するため、sceneSetState sleep は「敵 active 最高 AP」を選ぶ → opp.scene[0] が sleep 化される。
      // 自陣 self.scene[0] は対象外で active 不変。
      // (Phase 7-1 は first candidate = self.scene[0] を選んでいたが、意味的に「敵に sleep を与える」
      //  カードなので Phase 7-3 の方が正しい挙動)
      expect(oppStateAfter, 'opp.scene[0].state === sleep (Phase 7-3 heuristic picks enemy active)').toBe('sleep');
      expect(selfStateAfter, 'self.scene[0].state 不変 (active)').toBe('active');
      expect(await getPendingHirameki(page), 'pendingHirameki cleared after resolve').toBeNull();

      expectNoConsoleErrors(errors);
    });

    test(`${cardId} ${abilityId} (${kind}): skip path → scene state 不変`, async ({ page }) => {
      const { errors } = await setupGamePage(page);
      await buildGameState<FixtureArg>(page, applyFixture, { evidenceCardId: cardId });

      await dispatchActionCase(page);

      const pending = await getPendingHirameki(page);
      expect(pending, 'pendingHirameki populated (skip 前)').not.toBeNull();

      const stateBefore = await getSceneState(page, 'self', 0);
      await dispatchAction(page, { type: 'hiramekiResolve', choice: 'skip' });
      const stateAfter = await getSceneState(page, 'self', 0);

      expect(stateAfter, 'scene state 不変 after skip').toBe(stateBefore);
      expect(await getPendingHirameki(page), 'pendingHirameki cleared after skip').toBeNull();

      expectNoConsoleErrors(errors);
    });
  }

  // negative: D08015 (icon-flash 非持ち) → pendingHirameki null
  test('non-hirameki card (D08015): abilities に icon-flash 非含有 + dispatch しても pendingHirameki null', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildGameState<FixtureArg>(page, applyFixture, { evidenceCardId: 'D08015' });

    expect(await hasIconFlashAbility(page, 'D08015'), 'D08015 は icon-flash 非持ち').toBe(false);
    expect(await hasIconFlashAbility(page, 'D08019'), 'D08019 (control) は icon-flash 持ち').toBe(true);

    await dispatchActionCase(page);
    expect(await getPendingHirameki(page), 'D08015 evidence では listener fire しない').toBeNull();

    expectNoConsoleErrors(errors);
  });
});
