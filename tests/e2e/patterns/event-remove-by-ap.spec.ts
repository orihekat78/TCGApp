import { test, expect, type Page } from '@playwright/test';
import {
  setupGamePage,
  buildGameState,
  dispatchAction,
  getGameState,
  expectNoConsoleErrors,
} from '../helpers';
import type { GameStateLike } from '../helpers';

// Round 4i: eventRemoveByAP パターン (event card による AP X 以下リムーブ) を 2 カード集約検証。
//
// 共通契約:
//   - trigger.hook === 'effect:declared'
//   - matcher: payload.kind === 'event-use' を受理
//   - handUseCard dispatch → emit('effect:declared', { kind:'event-use', cardId }) → listener queue
//
// 対象カード:
//   - D08025 (蘭の一撃 / 青 / Lv5): shared factory `eventRemoveByAP({ apMax:8000, additionalCondition:{ kind:'partnerColor', color:'青' } })`
//   - D11020 (18の想起 / 黄 / Lv8 / MVP 外): 個別 sequence (step1: choice/sceneRemove filter.levelMax:7 state:sleep / step2: conditional(removeTraitAtLeast 神奈川県警 3) → choice/sceneRemove apMax:8000)
//
// 検証層:
//   1. cardDef.abilities[0] が存在、trigger.hook='effect:declared'、scope='on-hand'
//   2. matcher({kind:'event-use', cardId}) === true / matcher({kind:'character-use', cardId}) === false
//   3. effect 構造 (D08025: choice、D11020: sequence 2 段 + conditional)
//   4. dispatchAction(handUseCard) → pendingEffects に該当 cardId の entry が 1 個以上 queue される
//
// engine gap 探査 (Round 4i では BUG-XXX 登録のみ、fix は次 round):
//   - gap-1 (BUG-032 候補): eventRemoveByAP factory に trigger.selfOnly 未設定。
//     dispatch 後 pendingEffects.source.player に 'opp' が混入するか確認 (混入時 BUG 登録)。
//   - gap-2 (BUG-033 候補): ability.condition (partnerColor) が triggered.ts handleHook で未評価。
//     condition shape のみ verify、resolver 段は scope 外 (spec doc § engine gap §gap-3)。

type FileCardLike = { type: 'card-back'; cardId: string };

async function probeAbility(
  page: Page,
  cardId: string,
  abilityId: string,
): Promise<{
  abilityExists: boolean;
  hookIsEffectDeclared: boolean;
  scopeIsOnHand: boolean;
  matcherEventUse: boolean;
  matcherCharacterUse: boolean;
  effectKind: string | null;
  conditionShape: string | null;
  d08025ChoiceApMax: number | null;
  d11020Step0LevelMax: number | null;
  d11020Step0HasSleepState: boolean;
  d11020Step1ConditionalKind: string | null;
  d11020Step1ConditionalTrait: string | null;
  d11020Step1ConditionalN: number | null;
}> {
  return (await page.evaluate(
    ({ cId, aId }) => {
      const w = (window as unknown as {
        __game: {
          getState: () => { gameState: unknown };
          read: { def: { card: (id: string) => unknown } };
        };
      }).__game;
      const gs = w.getState().gameState;
      const def = w.read.def.card(cId) as
        | undefined
        | {
            abilities: {
              id: string;
              type?: string;
              scope?: string;
              trigger?: { hook?: string; matcher?: (p: unknown, s: unknown) => boolean };
              condition?: { kind?: string; color?: string };
              effect?: { kind?: string; options?: { kind?: string; args?: { target?: { query?: { filter?: { apMax?: number } } } } }[]; steps?: unknown[] };
            }[];
          };
      const nullResult = {
        abilityExists: false,
        hookIsEffectDeclared: false,
        scopeIsOnHand: false,
        matcherEventUse: false,
        matcherCharacterUse: false,
        effectKind: null,
        conditionShape: null,
        d08025ChoiceApMax: null,
        d11020Step0LevelMax: null,
        d11020Step0HasSleepState: false,
        d11020Step1ConditionalKind: null,
        d11020Step1ConditionalTrait: null,
        d11020Step1ConditionalN: null,
      };
      if (!def) return nullResult;
      const ability = def.abilities.find((a) => a.id === aId);
      if (!ability || !ability.trigger) return nullResult;

      const matcher = ability.trigger.matcher;
      const matcherEventUse = matcher ? matcher({ kind: 'event-use', cardId: cId }, gs) : false;
      const matcherCharacterUse = matcher ? matcher({ kind: 'character-use', cardId: cId }, gs) : true;

      let conditionShape: string | null = null;
      if (ability.condition) {
        const c = ability.condition;
        conditionShape = c.kind === 'partnerColor' && c.color === '青' ? 'partnerColor-青' : (c.kind ?? 'other');
      }

      const effect = ability.effect;
      const effectKind = effect?.kind ?? null;

      // D08025: choice 1 段。options[0].args.target.query.filter.apMax を読む
      let d08025ChoiceApMax: number | null = null;
      if (effectKind === 'choice' && Array.isArray(effect?.options) && effect.options[0]?.args) {
        const filter = (effect.options[0].args as { target?: { query?: { filter?: { apMax?: number } } } }).target?.query?.filter;
        d08025ChoiceApMax = filter?.apMax ?? null;
      }

      // D11020: sequence 2 段
      let d11020Step0LevelMax: number | null = null;
      let d11020Step0HasSleepState = false;
      let d11020Step1ConditionalKind: string | null = null;
      let d11020Step1ConditionalTrait: string | null = null;
      let d11020Step1ConditionalN: number | null = null;
      if (effectKind === 'sequence' && Array.isArray(effect?.steps)) {
        const s0 = effect.steps[0] as { kind?: string; options?: { args?: { target?: { query?: { filter?: { levelMax?: number }; state?: string[] } } } }[] } | undefined;
        if (s0?.kind === 'choice' && s0.options?.[0]?.args) {
          const q = (s0.options[0].args as { target?: { query?: { filter?: { levelMax?: number }; state?: string[] } } }).target?.query;
          d11020Step0LevelMax = q?.filter?.levelMax ?? null;
          d11020Step0HasSleepState = Array.isArray(q?.state) && q.state.includes('sleep');
        }
        const s1 = effect.steps[1] as { kind?: string; if?: { kind?: string; trait?: string; n?: number } } | undefined;
        if (s1?.kind === 'conditional' && s1.if) {
          d11020Step1ConditionalKind = s1.if.kind ?? null;
          d11020Step1ConditionalTrait = s1.if.trait ?? null;
          d11020Step1ConditionalN = s1.if.n ?? null;
        }
      }

      return {
        abilityExists: true,
        hookIsEffectDeclared: ability.trigger.hook === 'effect:declared',
        scopeIsOnHand: ability.scope === 'on-hand',
        matcherEventUse,
        matcherCharacterUse,
        effectKind,
        conditionShape,
        d08025ChoiceApMax,
        d11020Step0LevelMax,
        d11020Step0HasSleepState,
        d11020Step1ConditionalKind,
        d11020Step1ConditionalTrait,
        d11020Step1ConditionalN,
      };
    },
    { cId: cardId, aId: abilityId },
  )) as Awaited<ReturnType<typeof probeAbility>>;
}

type PendingScanResult = {
  selfCount: number;
  oppCount: number;
  total: number;
};

async function scanPendingEffectsFor(page: Page, cardId: string): Promise<PendingScanResult> {
  return (await page.evaluate((cId) => {
    const w = (window as unknown as {
      __game: { getState: () => { gameState: { pendingEffects: { source?: { player?: string; cardId?: string } }[] } } };
    }).__game;
    const list = w.getState().gameState.pendingEffects ?? [];
    let selfCount = 0;
    let oppCount = 0;
    for (const e of list) {
      if (e?.source?.cardId !== cId) continue;
      if (e.source.player === 'self') selfCount++;
      else if (e.source.player === 'opp') oppCount++;
    }
    return { selfCount, oppCount, total: selfCount + oppCount };
  }, cardId)) as PendingScanResult;
}

type FixtureArg = { cardId: string };

function applyFixture(gs: GameStateLike, arg: FixtureArg): void {
  const self = gs.players.self as unknown as {
    partner: { cardId: string; state: string; location: string };
    case: { cardId: string; status: string; requiredEvidence: number; colors: string[] };
    hand: string[];
    remove: string[];
    file: FileCardLike[];
  };
  const opp = gs.players.opp as unknown as { hand: string[] };

  // partner = 青 (D08001 江戸川コナン)、active (location:partner-area)
  self.partner.cardId = 'D08001';
  self.partner.state = 'active';
  self.partner.location = 'partner-area';

  // case = D08026 (青) 事件編、色 = ['青','黄'] (D08025 青 / D11020 黄 両対応)
  self.case.cardId = 'D08026';
  self.case.status = '事件編';
  self.case.requiredEvidence = 7;
  self.case.colors = ['青', '黄'];

  // file 8 枚 (D11020 lv8 / D08025 lv5 通過)
  const fileBack: FileCardLike = { type: 'card-back', cardId: 'D08003' };
  self.file = [fileBack, fileBack, fileBack, fileBack, fileBack, fileBack, fileBack, fileBack];

  // hand: 対象 cardId を先頭に
  self.hand = [arg.cardId];

  // remove に 神奈川県警 trait 持ち 3 枚 (D11020 step2 conditional 通過)
  self.remove = ['D11003', 'D11005', 'D11011'];

  // turnState reset (sample default は false だが明示)
  const ts = (gs as unknown as { turnState: { self: { handUseUsed: boolean; nextHintUsed: boolean } } }).turnState;
  ts.self.handUseUsed = false;
  ts.self.nextHintUsed = false;

  // pendingEffects 空
  (gs as unknown as { pendingEffects: unknown[] }).pendingEffects = [];

  // gap-1 検出経路: opp.hand にも同 cardId
  opp.hand = [arg.cardId];
}

const CARDS = [
  { cardId: 'D08025', abilityId: 'a1', kind: 'factory pure (apMax:8000, partnerColor:青)' },
  { cardId: 'D11020', abilityId: 'a1', kind: 'individual sequence (lv7 sleep / 神奈川県警≥3 → ap8000)' },
] as const;

test.describe('eventRemoveByAP — イベント手札使用で AP X 以下リムーブ (2 カード集約)', () => {
  for (const { cardId, abilityId, kind } of CARDS) {
    test(`${cardId} ${abilityId} (${kind}): shape + handUseCard dispatch → pendingEffects に queue`, async ({ page }) => {
      const { errors } = await setupGamePage(page);
      await buildGameState<FixtureArg>(page, applyFixture, { cardId });

      const probe = await probeAbility(page, cardId, abilityId);

      expect(probe.abilityExists, 'ability is defined').toBe(true);
      expect(probe.hookIsEffectDeclared, "trigger.hook === 'effect:declared'").toBe(true);
      expect(probe.scopeIsOnHand, "scope === 'on-hand'").toBe(true);
      expect(probe.matcherEventUse, "matcher accepts { kind:'event-use' }").toBe(true);
      expect(probe.matcherCharacterUse, "matcher rejects { kind:'character-use' }").toBe(false);

      if (cardId === 'D08025') {
        expect(probe.effectKind, 'effect.kind').toBe('choice');
        expect(probe.d08025ChoiceApMax, 'choice option apMax').toBe(8000);
        expect(probe.conditionShape, 'condition === partnerColor 青').toBe('partnerColor-青');
      } else if (cardId === 'D11020') {
        expect(probe.effectKind, 'effect.kind').toBe('sequence');
        expect(probe.d11020Step0LevelMax, 'step[0] choice filter.levelMax').toBe(7);
        expect(probe.d11020Step0HasSleepState, "step[0] state ⊇ ['sleep']").toBe(true);
        // probe は s1.kind === 'conditional' 確認後に s1.if.* を assign する。
        // 値が 'removeTraitAtLeast' を返せば step[1].kind === 'conditional' と s1.if.kind === 'removeTraitAtLeast' を同時に保証。
        expect(probe.d11020Step1ConditionalKind, 'step[1] is conditional with if.kind=removeTraitAtLeast').toBe('removeTraitAtLeast');
        expect(probe.d11020Step1ConditionalTrait, 'step[1].if.trait').toBe('神奈川県警');
        expect(probe.d11020Step1ConditionalN, 'step[1].if.n').toBe(3);
      }

      // dispatch handUseCard (Option B per plan)
      await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId });

      const scan = await scanPendingEffectsFor(page, cardId);

      // listener が self.hand 上の event card 自身の effect を queue したことを assert
      expect(scan.selfCount, `pendingEffects に self.source=${cardId} の entry が 1 個以上 queue`).toBeGreaterThanOrEqual(1);

      // Round 4i-fix (BUG-032): selfOnly:true + selfOnlyMatches の player 比較追加で
      // opp.hand の同 cardId は誤発動しない。fixture で opp.hand にも仕込んでいるので、
      // 修正がないとここで oppCount > 0 になる。
      expect(scan.oppCount, 'opp.hand の同 cardId は selfOnly により発動しない (BUG-032 fixed)').toBe(0);

      expectNoConsoleErrors(errors);
    });

    test(`${cardId} ${abilityId} (${kind}): negative-matcher (character-use payload 拒否)`, async ({ page }) => {
      const { errors } = await setupGamePage(page);
      await buildGameState<FixtureArg>(page, applyFixture, { cardId });

      const probe = await probeAbility(page, cardId, abilityId);

      // matcher が character-use を確実に reject することのみを集中検証
      expect(probe.abilityExists, 'ability is defined').toBe(true);
      expect(probe.matcherEventUse, "matcher accepts { kind:'event-use' }").toBe(true);
      expect(probe.matcherCharacterUse, "matcher rejects { kind:'character-use' }").toBe(false);

      expectNoConsoleErrors(errors);
    });
  }

  // Round 4i-fix (BUG-033): D08025 の partnerColor:青 condition が listener 段で評価される
  // ことを E2E で verify。partner=黄 (D11001) → condition false → pendingEffects に queue されない。
  test('D08025: partner=黄 (条件未達) → listener が condition gate で reject (BUG-033 fixed)', async ({ page }) => {
    const { errors } = await setupGamePage(page);
    await buildGameState<FixtureArg>(
      page,
      (gs, arg) => {
        const self = gs.players.self as unknown as {
          partner: { cardId: string; state: string; location: string };
          case: { cardId: string; status: string; requiredEvidence: number; colors: string[] };
          hand: string[];
          file: FileCardLike[];
        };
        // partner = D11001 (黄) → partnerColor:'青' 条件未達
        self.partner.cardId = 'D11001';
        self.partner.state = 'active';
        self.partner.location = 'partner-area';
        // case は黄 (D11020 は黄 / D08025 は青だが、テスト対象は D08025 のため case 黄黄でも色 gate は色 OR 制限で青を含む必要あり)
        // 色 gate は handUseCard 内 colorAllowed で「カード色 ⊆ 事件色」を要求。D08025=青、事件は青+黄 にする
        self.case.cardId = 'D08026';
        self.case.status = '事件編';
        self.case.requiredEvidence = 7;
        self.case.colors = ['青', '黄'];
        const fileBack: FileCardLike = { type: 'card-back', cardId: 'D08003' };
        self.file = [fileBack, fileBack, fileBack, fileBack, fileBack, fileBack, fileBack, fileBack];
        self.hand = [arg.cardId];
        const ts = (gs as unknown as { turnState: { self: { handUseUsed: boolean; nextHintUsed: boolean } } }).turnState;
        ts.self.handUseUsed = false;
        ts.self.nextHintUsed = false;
        (gs as unknown as { pendingEffects: unknown[] }).pendingEffects = [];
      },
      { cardId: 'D08025' },
    );

    await dispatchAction(page, { type: 'handUseCard', player: 'self', cardId: 'D08025' });
    const scan = await scanPendingEffectsFor(page, 'D08025');

    // partnerColor:'青' 条件が listener 段で評価され、partner 黄なら queue されない
    expect(scan.selfCount, 'partner 黄 (青ではない) で D08025 を使用 → condition false → queue されない').toBe(0);
    expect(scan.oppCount, 'opp 側も発動しない').toBe(0);

    expectNoConsoleErrors(errors);
  });
});
