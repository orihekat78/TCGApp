// gate5 RUNTIME behavior — B05006 毛利小五郎 (character, 青/探偵|毛利探偵事務所, Lv8 AP8000 LP0)
//   公式テキスト:
//     【パートナー青】【宣言】【ターン1】このキャラがアクティブ状態の場合、ターン終了時までこのキャラは
//       〚突撃〛（登場したターンからすぐにアクションできる）を持つ。スリープ状態かスタン状態の場合、
//       AP8000以下のキャラを1枚まで選び、リムーブし、カードを1枚引く。この能力は自分の現場に
//       〚カード名［妃英理］〛かこのキャラ以外の〚特徴［毛利探偵事務所］〛のキャラがいる場合に宣言できる。
//
//   rules: 13-keywords.md (突撃=名乗り中アクション可) / 15-abilities-effects.md (「〜まで」=0枚可 /
//          「〜する」必須 / sequence は全 step 実行) / 17-icons.md (【パートナー青】【ターン1】条件アイコン
//          = 充足しないと能力を持たない扱い) / 19-special-rules.md (cardName split-name) /
//          21-declared-ability-cost.md (宣言能力: コスト無=本文に':'無し / active 不要 / 宣言条件) /
//          24-qa-naming-stun.md (発動済み扱い=候補0でもカウント / スタン状態)
//
// 検証の核 (BUG-117/118 教訓: DSL に条件/filter を書いても engine が実評価する保証はない):
//   - conditional[0].if = charStateIs{ref:self, state:'active'} → active のときだけ 突撃 を $self に grant。
//     sleep/stun のときは grant されない (engine が self の state を実評価しているか)。
//   - conditional[1].if = or{charStateIs sleep, charStateIs stun} → sleep/stun のときだけ
//     sceneRemove(AP≤8000)+draw を実行。active のときは実行されない。
//   - sceneRemove 短縮形 {max:1, side:'either', filter:{apMax:8000}} の apMax filter を engine が
//     実評価しているか (AP>8000 のキャラは候補外)。side:'either' で自他両 side が候補。
//   - 宣言条件 ability.condition = and{partnerColor青, or{sceneHas 妃英理(self), sceneHas 毛利探偵事務所(self,excludeSelf)}}
//     を canDeclaredAbility (BUG-099) が gate しているか。
//
// decoy/negative:
//   D1 (apMax): sleep 分岐で AP9000 の decoy を盤面に置く → 候補外 (filter 実評価)。AP8000(境界)は候補。
//   D2 (side:either): 相手現場の AP≤8000 キャラも候補に含まれる (side:'either')。
//   D3 (excludeSelf): 自現場に B05006 だけ (他の毛利探偵事務所/妃英理なし) → 宣言条件 false
//      (毛利小五郎 自身が 毛利探偵事務所 を持つが excludeSelf で除外される)。
//   D4 (partnerColor): パートナー赤 → canDeclaredAbility=false。
//   N1 (active→branch分離): active のとき sleep/stun 分岐 (remove+draw) は走らない。
//   N2 (sleep→branch分離): sleep のとき active 分岐 (突撃 grant) は走らない。
//   N3 (0-pick): sleep 分岐 human decline (0-pick) → リムーブ無し、ただし「カードを1枚引く」は
//      sequence なので必須実行 (rules/15)。【ターン1】は発動済み扱いでカウント (rules/24)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDeclaredAbility, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import {
  drainAiEffectPicks,
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
} from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectPickQueue,
  _peekPendingEffectPickQueueLength,
} from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { char as readChar } from '@/engine/read/char';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B05006 } from '@/cards/ct-p05/B05006';
import type { GameState, CardDef, EffectCtx, AbilityDef } from '@/engine/types';

const setHuman = (s: 'self' | 'opp' | null) => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
};
const queue = (): PendingEffectPickSide[] =>
  (globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] }).__pendingEffectPickQueue ?? [];

// ---- synthetic defs (prefix DEC_B05006_ で id 衝突回避) ----
const PARTNER_BLUE = 'DEC_B05006_PARTNER_BLUE';
const PARTNER_RED = 'DEC_B05006_PARTNER_RED';
// 宣言条件 or[1] 充足用: このキャラ以外の 毛利探偵事務所 キャラ
const MORI_OFFICE = 'DEC_B05006_MORIOFFICE';
// 宣言条件 or[0] 充足用: カード名 妃英理
const EIRI = 'DEC_B05006_EIRI';
// sleep 分岐 sceneRemove 候補: AP8000 (境界 ≤8000 → 候補)
const AP8000 = 'DEC_B05006_AP8000';
// sleep 分岐 DECOY: AP9000 (>8000 → 候補外、apMax filter 実評価の証明)
const AP9000 = 'DEC_B05006_AP9000';
// side:'either' 検証: 相手現場の AP≤8000 キャラ
const AP_OPP = 'DEC_B05006_AP_OPP';

function partnerDef(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'partner', names: [id], colors,
    level: undefined as unknown as number, ap: 0, lp: 5, traits: [], keywords: [],
    rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}
function charDef(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function registerDecoys(): void {
  registerCardDef(partnerDef(PARTNER_BLUE, ['青']));
  registerCardDef(partnerDef(PARTNER_RED, ['赤']));
  registerCardDef(charDef(MORI_OFFICE, { names: ['遠山和葉'], traits: ['毛利探偵事務所'] }));
  registerCardDef(charDef(EIRI, { names: ['妃英理'], traits: ['弁護士'] }));
  registerCardDef(charDef(AP8000, { names: ['工藤新一'], ap: 8000, traits: [] }));
  registerCardDef(charDef(AP9000, { names: ['赤井秀一'], ap: 9000, traits: [] }));
  registerCardDef(charDef(AP_OPP, { names: ['服部平次'], ap: 5000, traits: [] }));
}

/** 宣言 ctx (cost なし、useDeclaredAbility の source を declaring char に固定)。 */
function declareCtx(): EffectCtx {
  return { source: { cardId: 'B05006', uid: 'kogoro#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} };
}

/**
 * base: turn self/main、青パートナー、B05006 (uid kogoro#1) を自現場に置く。
 * state で B05006 の状態 (active/sleep/stun) を指定。build() で追加配置。
 */
function base(state: 'active' | 'sleep' | 'stun', build: (s: GameState) => void): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.partner = { cardId: PARTNER_BLUE, state: 'active', location: 'partner-area' };
  s.players.self.scene = [sceneChar('B05006', 'kogoro#1', { state })];
  s.players.self.deck = ['D08017', 'D08017', 'D08017']; // draw 用 (refresh 回避)
  build(s);
  return s;
}

describe('B05006 毛利小五郎 — gate5 runtime behavior (declared: active→突撃 / sleep|stun→remove+draw)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetCardDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    setHuman(null);
  });

  // ============================================================
  // 宣言条件: and{partnerColor青, or{妃英理(self), 毛利探偵事務所(self,excludeSelf)}}
  // ============================================================
  it('条件: 青パートナー + 自現場に他の毛利探偵事務所キャラ → 宣言可', () => {
    const s = base('active', (st) => {
      st.players.self.scene.push(sceneChar(MORI_OFFICE, 'mori#1'));
    });
    expect(canDeclaredAbility(s, 'kogoro#1', 'a1'), '毛利探偵事務所 branch で宣言可').toBe(true);
  });

  it('条件: 青パートナー + 自現場に 妃英理 → 宣言可 (cardName branch)', () => {
    const s = base('active', (st) => {
      st.players.self.scene.push(sceneChar(EIRI, 'eiri#1'));
    });
    expect(canDeclaredAbility(s, 'kogoro#1', 'a1'), '妃英理 cardName branch で宣言可').toBe(true);
  });

  it('条件 D3 (excludeSelf): 自現場に B05006 のみ → 宣言不可 (毛利小五郎自身は excludeSelf で除外)', () => {
    // 毛利小五郎自身が traits に 毛利探偵事務所 を持つが、excludeSelf:true で除外されるため
    // 「このキャラ以外の 毛利探偵事務所」も「妃英理」も居ない → 宣言条件 false。
    const s = base('active', () => { /* B05006 のみ */ });
    expect(canDeclaredAbility(s, 'kogoro#1', 'a1'), 'B05006 単独 → 宣言不可').toBe(false);
  });

  it('条件 D4 (partnerColor): パートナー赤 → 宣言不可', () => {
    const s = base('active', (st) => {
      st.players.self.partner = { cardId: PARTNER_RED, state: 'active', location: 'partner-area' };
      st.players.self.scene.push(sceneChar(MORI_OFFICE, 'mori#1'));
    });
    expect(canDeclaredAbility(s, 'kogoro#1', 'a1'), 'partnerColor青 不成立 → 宣言不可').toBe(false);
  });

  it('条件 D3b: 相手現場に 毛利探偵事務所 が居ても (side:self) → 宣言不可', () => {
    const s = base('active', (st) => {
      st.players.opp.scene = [sceneChar(MORI_OFFICE, 'oppmori#1')]; // 相手側 → side:self で除外
    });
    expect(canDeclaredAbility(s, 'kogoro#1', 'a1'), '相手側の毛利探偵事務所は宣言条件に数えない').toBe(false);
  });

  // ============================================================
  // active 分岐: このキャラがアクティブ → 突撃 を $self に grant (turn scope)
  // ============================================================
  it('active分岐 + N1: active のとき B05006 自身に突撃を grant、sleep/stun分岐(remove+draw)は走らない', () => {
    let s = base('active', (st) => {
      st.players.self.scene.push(sceneChar(MORI_OFFICE, 'mori#1'));  // 宣言条件
      st.players.self.scene.push(sceneChar(AP8000, 'ap8k#1'));       // sleep 分岐なら候補になるはずの AP≤8000
    });
    expect(readChar.hasKeyword(s, 'kogoro#1', '突撃'), '付与前は突撃なし').toBe(false);
    const handBefore = s.players.self.hand.length;

    s = produce(s, (d) => {
      useDeclaredAbility(d, 'kogoro#1', 'a1', declareCtx());
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    // active 分岐: $self (B05006) に突撃。直接 grant なので pick は surface しない。
    expect(readChar.hasKeyword(s, 'kogoro#1', '突撃'), 'active: B05006 に突撃 grant').toBe(true);
    const self = s.players.self.scene.find((c) => c.uid === 'kogoro#1')!;
    expect((self.turnEffects['grantedKeywords'] as string[] | undefined), 'turn scope grantedKeywords に突撃').toContain('突撃');
    // N1: sleep/stun 分岐は走らない → 誰もリムーブされない、draw も無し
    expect(s.players.self.scene.some((c) => c.uid === 'ap8k#1'), 'active時: AP≤8000キャラはリムーブされない (sleep分岐 unmet)').toBe(true);
    expect(s.players.self.hand.length, 'active時: draw されない (sleep分岐 unmet)').toBe(handBefore);
    // mori#1 (宣言条件用) には突撃が及ばない (grant 対象は $self のみ)
    expect(readChar.hasKeyword(s, 'mori#1', '突撃'), '$self 以外には突撃が及ばない').toBe(false);
    // 【ターン1】発動済み
    expect(canDeclaredAbility(s, 'kogoro#1', 'a1'), '【ターン1】使用済 → 再宣言不可').toBe(false);
  });

  // ============================================================
  // sleep 分岐 + DECOY(apMax/side): sleep のとき AP≤8000 を1枚まで remove + draw
  // ============================================================
  it('sleep分岐 + DECOY: 候補=AP≤8000のみ(AP9000は候補外/相手側も候補) → 選択リムーブ + 必須draw / N2:突撃は付与されない', () => {
    setHuman('self'); // pending pick を覗いて候補集合を検証
    let s = base('sleep', (st) => {
      st.players.self.scene.push(sceneChar(MORI_OFFICE, 'mori#1'));  // 宣言条件
      st.players.self.scene.push(sceneChar(AP8000, 'ap8k#1'));       // 境界 AP8000 → 候補
      st.players.self.scene.push(sceneChar(AP9000, 'ap9k#1'));       // DECOY AP9000 → 候補外
      st.players.opp.scene = [sceneChar(AP_OPP, 'oppap#1')];         // side:'either' → 相手も候補
    });
    expect(canDeclaredAbility(s, 'kogoro#1', 'a1'), 'sleep でも宣言可 (rules/21 active不要)').toBe(true);
    const handBefore = s.players.self.hand.length;
    const deckBefore = s.players.self.deck.length;

    s = produce(s, (d) => {
      useDeclaredAbility(d, 'kogoro#1', 'a1', declareCtx());
      runAllUntilEmpty(d);
    });

    // ---- DECOY 主張: 候補集合は AP≤8000 の全キャラ (両 side)。AP9000 のみ除外 ----
    // テキストは「AP8000以下のキャラを1枚まで選び」= self 除外も side 限定も無し。
    // よって kogoro#1(AP8000=自身)/mori#1(AP4000)/ap8k#1(AP8000)/相手oppap#1(AP5000) は全て候補、
    // ap9k#1(AP9000) のみが apMax filter で除外される (filter 実評価の核)。
    expect(_peekPendingEffectPickQueueLength(), 'sceneRemove pick が surface').toBe(1);
    const pending = queue()[0]!;
    expect(pending.atomVerb, 'sceneRemove の pick').toBe('sceneRemove');
    expect(pending.nMin, '「〜まで」=0枚可 (nMin 0)').toBe(0);
    expect(pending.nMax, '上限1枚').toBe(1);
    const candKeys = pending.candidates.map((c) => `${c.player}:${c.uid}`).sort();
    expect(candKeys, 'AP≤8000の全キャラが候補 (両side)、AP9000のみ除外').toEqual(
      ['opp:oppap#1', 'self:ap8k#1', 'self:kogoro#1', 'self:mori#1'],
    );
    // DECOY (apMax 実評価の証明): AP9000 は候補に一切出ない。
    expect(pending.candidates.some((c) => c.uid === 'ap9k#1'), 'DECOY: AP9000 は候補に出ない (apMax実評価)').toBe(false);
    // side:'either' の証明: 相手現場の AP≤8000 キャラも候補に含まれる。
    expect(pending.candidates.some((c) => c.player === 'opp' && c.uid === 'oppap#1'), 'side:either: 相手 AP≤8000 も候補').toBe(true);

    // ---- AP8000 の自キャラ (ap8k#1) を明示 pick して continuation (draw) まで進める ----
    _clearPendingEffectPickQueue();
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, 'ap8k#1');
    });
    // 選んだ ap8k#1 はリムーブされ、AP9000 (DECOY) は残る
    expect(s.players.self.scene.some((c) => c.uid === 'ap8k#1'), '選んだ AP8000 はリムーブされた').toBe(false);
    expect(s.players.self.remove.includes(AP8000), 'ap8k#1 はリムーブエリアへ').toBe(true);
    expect(s.players.self.scene.some((c) => c.uid === 'ap9k#1'), 'DECOY: AP9000 は残る (リムーブされない)').toBe(true);
    // 「リムーブし、カードを1枚引く」: sequence なので draw は必須実行
    expect(s.players.self.hand.length, '必須 draw: 手札+1').toBe(handBefore + 1);
    expect(s.players.self.deck.length, '必須 draw: デッキ-1').toBe(deckBefore - 1);

    // N2: sleep のとき active 分岐 (突撃 grant) は走らない
    expect(readChar.hasKeyword(s, 'kogoro#1', '突撃'), 'sleep時: 突撃は付与されない (active分岐 unmet)').toBe(false);
  });

  it('sleep分岐 (AI 直接 pick): AP8000 をリムーブ + draw、AP9000 は不変', () => {
    setHuman(null);
    let s = base('sleep', (st) => {
      st.players.self.scene.push(sceneChar(EIRI, 'eiri#1'));      // 宣言条件 (cardName branch)
      st.players.self.scene.push(sceneChar(AP8000, 'ap8k#1'));    // 候補 (唯一)
      st.players.self.scene.push(sceneChar(AP9000, 'ap9k#1'));    // DECOY
    });
    const handBefore = s.players.self.hand.length;

    s = produce(s, (d) => {
      useDeclaredAbility(d, 'kogoro#1', 'a1', declareCtx());
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    // 候補は ap8k#1 / eiri#1 / mori無し… 実際は AP≤8000 のキャラ全部が候補。
    // AP9000 は候補外なので、AI が何を選んでも ap9k#1 はリムーブされない。
    expect(s.players.self.scene.some((c) => c.uid === 'ap9k#1'), 'DECOY: AP9000 は残る').toBe(true);
    expect(s.players.self.hand.length, '必須 draw: 手札+1').toBe(handBefore + 1);
    expect(readChar.hasKeyword(s, 'kogoro#1', '突撃'), 'sleep: 突撃なし').toBe(false);
  });

  // ============================================================
  // stun 分岐: スタン状態でも sleep と同じ remove+draw 分岐 (rules/24 / charStateIs 'stun')
  // ============================================================
  it('stun分岐: スタン状態でも remove(AP≤8000)+draw が走る / 突撃は付与されない', () => {
    setHuman(null);
    let s = base('stun', (st) => {
      st.players.self.scene.push(sceneChar(MORI_OFFICE, 'mori#1')); // 宣言条件
      st.players.self.scene.push(sceneChar(AP8000, 'ap8k#1'));
      st.players.self.scene.push(sceneChar(AP9000, 'ap9k#1'));      // DECOY
    });
    const handBefore = s.players.self.hand.length;

    s = produce(s, (d) => {
      useDeclaredAbility(d, 'kogoro#1', 'a1', declareCtx());
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(s.players.self.hand.length, 'stun: 必須 draw → 手札+1').toBe(handBefore + 1);
    expect(s.players.self.scene.some((c) => c.uid === 'ap9k#1'), 'DECOY: AP9000 は残る').toBe(true);
    expect(readChar.hasKeyword(s, 'kogoro#1', '突撃'), 'stun: active分岐 unmet → 突撃なし').toBe(false);
  });

  // ============================================================
  // N3: sleep 分岐 0-pick — 「〜まで」=0枚可、ただし draw は sequence なので必須実行
  // ============================================================
  it('N3: sleep分岐 human decline(0-pick) — リムーブ無し、ただし draw は必須実行、【ターン1】はカウント', () => {
    setHuman('self');
    let s = base('sleep', (st) => {
      st.players.self.scene.push(sceneChar(MORI_OFFICE, 'mori#1'));
      st.players.self.scene.push(sceneChar(AP8000, 'ap8k#1'));
    });
    const handBefore = s.players.self.hand.length;
    const deckBefore = s.players.self.deck.length;

    s = produce(s, (d) => {
      useDeclaredAbility(d, 'kogoro#1', 'a1', declareCtx());
      runAllUntilEmpty(d);
    });
    const pending = queue()[0]!;
    expect(pending.nMin, '0枚可').toBe(0);

    // decline (0枚)
    _clearPendingEffectPickQueue();
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending);
    });
    // 0-pick: 誰もリムーブされない
    expect(s.players.self.scene.some((c) => c.uid === 'ap8k#1'), '0-pick: AP8000 は残る').toBe(true);
    // 「リムーブし、カードを1枚引く」= sequence の2 step、draw は 0-pick でも必須実行 (rules/15)
    expect(s.players.self.hand.length, '0-pick でも draw は必須実行 → 手札+1').toBe(handBefore + 1);
    expect(s.players.self.deck.length, 'デッキ-1').toBe(deckBefore - 1);
    // rules/24: 発動済み扱い → declaredUseCount=1 → 再宣言不可
    expect(readChar.declaredUseCount(s, 'kogoro#1', 'a1'), '【ターン1】発動済み').toBe(1);
    expect(canDeclaredAbility(s, 'kogoro#1', 'a1'), 'decline でも再宣言不可').toBe(false);
  });

  // ============================================================
  // descriptor 構造 sanity
  // ============================================================
  it('descriptor: a1 = declared/turn1, condition=and{partnerColor青, or{妃英理,毛利探偵事務所(excludeSelf)}}, effect=seq[conditional(active→突撃), conditional(sleep|stun→remove apMax8000 + draw)]', () => {
    const a1 = B05006.abilities[0] as AbilityDef;
    expect(a1).toMatchObject({ type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 } });
    expect(a1.cost, 'コストなし宣言能力').toBeUndefined();
    // condition
    expect(a1.condition).toMatchObject({
      kind: 'and',
      cs: [
        { kind: 'partnerColor', color: '青' },
        {
          kind: 'or',
          cs: [
            { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: '妃英理' } }, nMin: 1 },
            { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '毛利探偵事務所' }, excludeSelf: true }, nMin: 1 },
          ],
        },
      ],
    });
    // effect
    const eff = a1.effect as {
      kind: string;
      steps: Array<{ kind: string; if?: unknown; then?: unknown }>;
    };
    expect(eff.kind).toBe('sequence');
    // step0: active → charGrantKeyword 突撃
    expect(eff.steps[0]).toMatchObject({
      kind: 'conditional',
      if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
      then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
    });
    // step1: sleep|stun → sequence[sceneRemove apMax8000, draw]
    expect(eff.steps[1]).toMatchObject({
      kind: 'conditional',
      if: {
        kind: 'or',
        cs: [
          { kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' },
          { kind: 'charStateIs', ref: { kind: 'self' }, state: 'stun' },
        ],
      },
      then: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } } },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        ],
      },
    });
  });
});
