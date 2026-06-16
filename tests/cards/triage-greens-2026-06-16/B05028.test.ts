// gate5 RUNTIME behavior — B05028 服部平蔵 (character, 緑)
//
// 公式テキスト:
//   a1【パートナー緑】【宣言】【ターン1】自分か相手の現場にいるキャラに裏向きでセットされている
//      カードを1枚リムーブしてもよい。そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。
//   a2【宣言】【スリープ】：自分の現場にいる〚特徴［警察］〛のキャラを1枚までと、相手の現場にいる
//      キャラを1枚まで選び、持ち主のデッキのカードを上から1枚裏向きで選んだキャラにセットする。
//
// rules:
//   15-abilities-effects.md (「〜まで」=0枚可 / 効果解決順 / 「〜してもよい」),
//   16-card-set.md (セットされたカード 1枚リムーブ = 現場から離れる / fromDeckTop set),
//   17-icons.md (【パートナー緑】=条件アイコン 未達=持たない扱い / 【ターン1】=回数制限),
//   21-declared-ability-cost.md (【宣言】【スリープ】= cost sleepSelf 支払いで effect 解決),
//   25-qa-effects-resolution.md (chain「そうした場合」gate / sequence 各 step 独立).
//
// 検証の核 (BUG-117/118 教訓: DSL に filter/condition を書いても engine が評価する保証はない — 実機で踏む):
//   ※ 今回 commit a682b20b (BUG-111 #2) の誤診断訂正の証明を含む:
//      a1 は chain[charRemoveSetCard, sceneRemove]。chain-origin の 0枚 decline は remainder を
//      **drop** する (= 「そうした場合」gate 不成立)。これが正しい挙動 (sequence-origin の mandatory-tail
//      実行とは別契約)。本ファイルは production dispatch 経路 (dispatchEngineAction) で踏む。
//
// decoy / negative (各 filter を 1 つだけ破る decoy を置き、対象範囲が文言通りかを実機で確認):
//   a1-step1 (hasSetCards): set-card 非保持 char は charRemoveSetCard の候補外。
//   a1-step1 (side:either):  自陣・相手陣 両方の set-card 保持 char が候補に列挙される。
//   a1-step2 (apMax:8000):   AP9000 char は sceneRemove の候補外 / AP8000・7000 char は候補。side:either。
//   a1-cond  (partnerColor): パートナーが非緑だと canDeclaredAbility=false (【パートナー緑】未達=持たない扱い)。
//   a1-limit (ターン1):      1回使用後 canDeclaredAbility=false。
//   a2-cost  (sleepSelf):    source が sleep/stun だと canPay=false (rules/21【スリープ】コスト)。
//   a2-filter(trait:警察):   step1 候補は自陣の警察 trait char のみ (非警察 decoy 対象外)。step2 は相手の任意 char。
//   a2-set   (fromDeckTop):  選んだ char に 持ち主のデッキ上1枚を 裏向きでセット。
//   a2-decline(「1枚まで」=0枚可): step1 を 0枚 decline → sequence の step2 (相手キャラへのセット) は **発火する**。

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { pay } from '@/engine/cost/pay';
import { canPay } from '@/engine/cost/evaluate';
import { canDeclaredAbility, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../../helpers/fixtures';
import { B05028 } from '@/cards/ct-p05/B05028';
import type { AbilityDef, CardDef, GameState, EffectCtx } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- synthetic defs (prefix DEC_B05028_ / abilities:[] で再帰トリガー回避) ----
function charDef(id: string, ap: number, traits: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 4, ap, lp: 1, traits, keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  };
}
function partnerDef(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'partner', names: [id], colors,
    level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'P', imageUrl: '',
    abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

const SRC = 'B05028';                       // 発動元 (服部平蔵)。set-card は保持しなくてよい。
const SET_SELF = 'DEC_B05028_SETSELF';      // 自陣: set-card 保持 → a1 step1 候補
const SET_OPP = 'DEC_B05028_SETOPP';        // 相手陣: set-card 保持 → a1 step1 候補 (side:either)
const NOSET = 'DEC_B05028_NOSET';           // set-card 非保持 → a1 step1 候補外
const AP7000 = 'DEC_B05028_AP7000';         // AP7000 ≤ 8000 → a1 step2 候補 (相手陣に置く)
const AP8000 = 'DEC_B05028_AP8000';         // AP8000 ≤ 8000 (境界) → a1 step2 候補
const AP9000 = 'DEC_B05028_AP9000';         // AP9000 > 8000 → a1 step2 候補外 (decoy)
const POLICE = 'DEC_B05028_POLICE';         // 自陣: 警察 trait → a2 step1 候補
const NONPOLICE = 'DEC_B05028_NONPOLICE';   // 自陣: 非警察 → a2 step1 候補外 (decoy)
const OPPCHAR = 'DEC_B05028_OPPCHAR';       // 相手陣: 任意 char → a2 step2 候補
const PARTNER_GREEN = 'DEC_B05028_PG';      // 緑パートナー
const PARTNER_RED = 'DEC_B05028_PR';        // 非緑パートナー (赤)

function registerDecoys(): void {
  registerCardDef(charDef(SET_SELF, 5000, []));
  registerCardDef(charDef(SET_OPP, 5000, []));
  registerCardDef(charDef(NOSET, 5000, []));
  registerCardDef(charDef(AP7000, 7000, []));
  registerCardDef(charDef(AP8000, 8000, []));
  registerCardDef(charDef(AP9000, 9000, []));
  registerCardDef(charDef(POLICE, 4000, ['警察']));
  registerCardDef(charDef(NONPOLICE, 4000, ['探偵']));
  registerCardDef(charDef(OPPCHAR, 4000, []));
  registerCardDef(partnerDef(PARTNER_GREEN, ['緑']));
  registerCardDef(partnerDef(PARTNER_RED, ['赤']));
}

const a1cost = () => B05028.abilities[0].cost; // a1 は cost 無し (undefined)
const a2cost = () => B05028.abilities[1].cost!; // sleepSelf

/**
 * a1 base 盤面 (緑パートナー):
 *   self.scene = [SRC(active), SET_SELF(set-card 保持), AP8000(AP8000)]
 *   opp.scene  = [SET_OPP(set-card 保持), AP7000(AP7000), AP9000(AP9000 decoy)]
 * a1 step1 候補 = SET_SELF / SET_OPP (hasSetCards)。step2 候補 = AP8000 / AP7000 (apMax:8000)。
 */
function a1Base(opts: { partner?: string } = {}): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.partner = { cardId: opts.partner ?? PARTNER_GREEN, state: 'active', location: 'partner-area' };
  s.players.self.scene = [
    sceneChar(SRC, 'src#0', { state: 'active' }),
    sceneChar(SET_SELF, 'setself#0', { state: 'active', setCards: [{ cardId: 'X1', faceUp: false }] }),
    sceneChar(AP8000, 'ap8#0', { state: 'sleep' }),
  ];
  s.players.opp.scene = [
    sceneChar(SET_OPP, 'setopp#0', { state: 'active', setCards: [{ cardId: 'X2', faceUp: false }] }),
    sceneChar(AP7000, 'ap7#0', { state: 'sleep' }),
    sceneChar(AP9000, 'ap9#0', { state: 'sleep' }),
  ];
  return s;
}

/** a1 を full production dispatch 経路で発動 → step1 pick が surface する。 */
function fireA1ViaDispatch(s: GameState): void {
  setHuman('self');
  useGameStateStore.getState().setGameState(s);
  const r = dispatchEngineAction({ type: 'declaredAbility', uid: 'src#0', abilId: 'a1' });
  expect(r.ok, 'a1 declared dispatch ok').toBe(true);
}

describe('B05028 服部平蔵 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    useGameStateStore.getState().setGameState(null);
    useGameStateStore.getState().setPendingEffectPick(null);
    setHuman(null);
  });
  afterAll(() => setHuman(null));

  // ===== a1 step1 候補: hasSetCards + side:either =====
  it('a1 step1: charRemoveSetCard 候補は set-card 保持 char のみ (NOSET decoy 除外) / side:either で自陣・相手陣 両方列挙', () => {
    const s = a1Base();
    // NOSET decoy を両陣に追加 (set-card 非保持 → 候補外であるべき)
    const s2 = produce(s, (d) => {
      d.players.self.scene.push(sceneChar(NOSET, 'noset#0', { state: 'active' }));
      d.players.opp.scene.push(sceneChar(NOSET, 'noset#1', { state: 'active' }));
    });
    fireA1ViaDispatch(s2);

    const pending = useGameStateStore.getState().pendingEffectPick!;
    expect(pending.atomVerb, 'step1 = charRemoveSetCard').toBe('charRemoveSetCard');
    expect(pending.nMin, '「リムーブしてもよい」=0枚可 (decline channel)').toBe(0);
    expect(pending.nMax, '1枚リムーブ').toBe(1);
    const uids = pending.candidates.map((c) => c.uid).sort();
    expect(uids, 'SET_SELF (自陣 set-card) は候補').toContain('setself#0');
    expect(uids, 'SET_OPP (相手陣 set-card) は候補 — side:either honor').toContain('setopp#0');
    expect(uids, 'NOSET (自陣 非保持) は候補外 — hasSetCards honor').not.toContain('noset#0');
    expect(uids, 'NOSET (相手陣 非保持) は候補外').not.toContain('noset#1');
    expect(pending.candidates.length, '有効候補は set-card 保持 2 件のみ').toBe(2);
  });

  // ===== a1 CORE: chain-gate human-decline (commit a682b20b 誤診断訂正の証明) =====
  it('a1 chain human-decline: step1 を 0枚 decline すると step2 sceneRemove は発火しない (「そうした場合」gate / chain break)', () => {
    fireA1ViaDispatch(a1Base());
    expect(useGameStateStore.getState().pendingEffectPick?.atomVerb).toBe('charRemoveSetCard');

    // 0枚 decline (production dispatch 経路 = chain-origin continuation drop)
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });

    const after = useGameStateStore.getState();
    // 期待: step2 sceneRemove 不発火 = AP≤8000 char (AP8000/AP7000) が現場に残る + 新 pick が surface しない
    const selfUids = after.gameState!.players.self.scene.map((c) => c.uid);
    const oppUids = after.gameState!.players.opp.scene.map((c) => c.uid);
    expect(selfUids, 'AP8000 char 残存 (step2 不発火)').toContain('ap8#0');
    expect(oppUids, 'AP7000 char 残存 (step2 不発火)').toContain('ap7#0');
    const total = after.gameState!.players.self.scene.length + after.gameState!.players.opp.scene.length;
    expect(total, '6 char 全員残存 (step2 sceneRemove 不発火)').toBe(6);
    expect(after.pendingEffectPick, 'step2 sceneRemove の pick が surface しない').toBeNull();
    expect(pickQueue().length, 'pick queue 空').toBe(0);
    // step1 自身も 0枚なので set-card は外れない
    const setSelf = after.gameState!.players.self.scene.find((c) => c.uid === 'setself#0')!;
    expect(setSelf.setCards.length, 'decline: set-card も外れない').toBe(1);
  });

  // ===== a1 human-resolve: step1 で set-card を実除去 → step2 sceneRemove が surface =====
  it('a1 chain human-resolve: step1 で set-card を pick (実除去) → step2 sceneRemove が surface (apMax:8000 候補) → resolve で AP≤8000 char 除去', () => {
    fireA1ViaDispatch(a1Base());
    const pending = useGameStateStore.getState().pendingEffectPick!;
    // step1: SET_SELF を pick (set-card を実除去)
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: 'setself#0' });

    const mid = useGameStateStore.getState();
    // step1 の効果: SET_SELF の set-card が 1枚リムーブ (host は現場に残る — charRemoveSetCard セマンティクス)
    const setSelf = mid.gameState!.players.self.scene.find((c) => c.uid === 'setself#0')!;
    expect(setSelf, 'host SET_SELF は現場に残る (set-card だけ外れる)').toBeTruthy();
    expect(setSelf.setCards.length, 'set-card 1→0 (AP判定でなく set-card が外れる)').toBe(0);
    expect(mid.gameState!.players.self.remove, 'set-card がリムーブエリアへ').toContain('X1');

    // 「そうした場合」成立 → step2 sceneRemove が surface
    const pending2 = mid.pendingEffectPick!;
    expect(pending2?.atomVerb, 'step2 = sceneRemove が surface (chain gate 成立)').toBe('sceneRemove');
    const apUids = pending2.candidates.map((c) => c.uid).sort();
    expect(apUids, 'AP8000 (境界) は step2 候補').toContain('ap8#0');
    expect(apUids, 'AP7000 は step2 候補').toContain('ap7#0');
    expect(apUids, 'AP9000 (>8000) は step2 候補外 — apMax:8000 honor').not.toContain('ap9#0');
    // step2 候補 = AP≤8000 の全 char (side:either)。step1 で setself#0 の set-card は外れたが host は残存。
    //   self: src(7000)/setself(5000)/ap8(8000) + opp: setopp(5000)/ap7(7000) = 5。AP9000 のみ除外。
    expect(apUids, 'SRC (服部平蔵 AP7000) も AP≤8000 候補').toContain('src#0');
    expect(apUids, 'SET_SELF (AP5000) も候補').toContain('setself#0');
    expect(apUids, 'SET_OPP (AP5000) も候補').toContain('setopp#0');
    expect(pending2.candidates.length, 'apMax:8000 で AP9000 のみ除外 → 5 件').toBe(5);

    // step2: AP7000 (相手陣) を選択 → リムーブ
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: 'ap7#0' });
    const after = useGameStateStore.getState();
    const oppUids = after.gameState!.players.opp.scene.map((c) => c.uid);
    expect(oppUids, 'AP7000 が現場から除去 (sceneRemove)').not.toContain('ap7#0');
    expect(after.gameState!.players.opp.remove, 'AP7000 cardId がリムーブエリアへ').toContain(AP7000);
    void pending; // step1 pending 参照保持 (lint)
  });

  // ===== a1 step2 境界: AP8000 は候補 / AP9000 は候補外 (apMax boundary) — pick せず候補集合のみ厳密確認 =====
  it('a1 step2 apMax 境界: AP8000=候補内 / AP9000=候補外 (apMax は ≤ 比較)', () => {
    fireA1ViaDispatch(a1Base());
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: 'setopp#0' }); // step1 resolve (相手 set-card)
    const pending2 = useGameStateStore.getState().pendingEffectPick!;
    expect(pending2.atomVerb).toBe('sceneRemove');
    const apUids = pending2.candidates.map((c) => c.uid);
    expect(apUids.includes('ap8#0'), 'AP=8000 は apMax:8000 を満たす (境界 inclusive)').toBe(true);
    expect(apUids.includes('ap9#0'), 'AP=9000 は apMax:8000 を超える → 候補外').toBe(false);
  });

  // ===== a1 NEGATIVE (partnerColor): パートナー非緑なら canDeclaredAbility=false =====
  it('a1 condition NEGATIVE: パートナーが緑なら使用可 / 非緑なら canDeclaredAbility=false (【パートナー緑】未達=持たない扱い rules/17)', () => {
    const sGreen = a1Base({ partner: PARTNER_GREEN });
    expect(canDeclaredAbility(sGreen, 'src#0', 'a1'), '緑パートナー: a1 使用可').toBe(true);
    const sRed = a1Base({ partner: PARTNER_RED });
    expect(canDeclaredAbility(sRed, 'src#0', 'a1'), '赤パートナー: a1 使用不可 (条件未達)').toBe(false);
  });

  // ===== a1 NEGATIVE (ターン1): 1回使用後は canDeclaredAbility=false =====
  it('a1 NEGATIVE (ターン1): 1回 使用宣言後は canDeclaredAbility=false (再使用不可)', () => {
    const s = a1Base();
    expect(canDeclaredAbility(s, 'src#0', 'a1'), '使用前: 可').toBe(true);
    const s2 = produce(s, (d) => {
      const ctx: EffectCtx = {
        source: { cardId: SRC, uid: 'src#0', abilityId: 'a1', player: 'self', area: 'scene' },
        bindings: {},
      };
      useDeclaredAbility(d, 'src#0', 'a1', ctx); // declaredUseCount++ (【ターン1】)
      runAllUntilEmpty(d);
    });
    expect(canDeclaredAbility(s2, 'src#0', 'a1'), '1回使用後: 【ターン1】で再使用不可').toBe(false);
  });

  // ===== a2 cost (sleepSelf): active なら canPay / sleep・stun なら canPay=false =====
  it('a2 cost (sleepSelf): source が active なら canPay / sleep・stun では canPay=false (rules/21【スリープ】コスト)', () => {
    const base = a1Base();
    const ctx = (uid: string): EffectCtx => ({
      source: { cardId: SRC, uid, abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {},
    });
    // active
    expect(canPay(base, a2cost(), ctx('src#0')), 'active source: sleepSelf 支払可').toBe(true);
    // sleep
    const sSleep = produce(base, (d) => { d.players.self.scene[0]!.state = 'sleep'; });
    expect(canPay(sSleep, a2cost(), ctx('src#0')), 'sleep source: 支払不可').toBe(false);
    // stun
    const sStun = produce(base, (d) => { d.players.self.scene[0]!.state = 'stun'; });
    expect(canPay(sStun, a2cost(), ctx('src#0')), 'stun source: 支払不可').toBe(false);
  });

  // ===== a2 step1 候補: trait:警察 (自陣) — 非警察 decoy 除外 =====
  it('a2 step1: charSetCard 候補は 自陣の 警察 trait char のみ (非警察 decoy 除外) / 「1枚まで」=0枚可', () => {
    setHuman('self');
    _resetUidCounter();
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [
      sceneChar(SRC, 'src#0', { state: 'active' }),
      sceneChar(POLICE, 'pol#0', { state: 'active' }),
      sceneChar(NONPOLICE, 'np#0', { state: 'active' }),
    ];
    s.players.opp.scene = [sceneChar(OPPCHAR, 'opp#0', { state: 'active' })];
    s.players.self.deck = ['sd1', 'sd2'];
    s.players.opp.deck = ['od1', 'od2'];

    s = produce(s, (d) => {
      const ctx: EffectCtx = {
        source: { cardId: SRC, uid: 'src#0', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {},
      };
      pay(d, a2cost(), ctx);
      useDeclaredAbility(d, 'src#0', 'a2', ctx);
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(s);
    surfacePendingSideChannels(); // queue front を store.pendingEffectPick へ転送 (queue は shift される)

    const pending = useGameStateStore.getState().pendingEffectPick!;
    expect(pending.atomVerb, 'step1 = charSetCard').toBe('charSetCard');
    expect(pending.nMin, '「1枚まで」=0枚可').toBe(0);
    const uids = pending.candidates.map((c) => c.uid);
    expect(uids, 'POLICE (警察) は候補').toContain('pol#0');
    expect(uids, 'NONPOLICE (探偵) は候補外 — trait:警察 honor').not.toContain('np#0');
    expect(uids, 'SRC 自身 (服部平蔵=警察 trait) も警察 trait なので候補').toContain('src#0');
    expect(uids, '相手 OPPCHAR は step1 (side:self) 候補外').not.toContain('opp#0');
    // cost: source が sleep 化
    expect(s.players.self.scene[0]!.state, 'cost sleepSelf: source が sleep').toBe('sleep');
    setHuman(null);
  });

  // ===== a2 full sequence (human): step1=POLICE に self-deck top set / step2=OPPCHAR に opp-deck top set =====
  it('a2 sequence (human): step1 で POLICE 選択 → 自分デッキ上を裏向きセット / step2 で OPPCHAR 選択 → 相手デッキ上を裏向きセット (持ち主のデッキ)', () => {
    setHuman('self');
    _resetUidCounter();
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [
      sceneChar(SRC, 'src#0', { state: 'active' }),
      sceneChar(POLICE, 'pol#0', { state: 'active' }),
    ];
    s.players.opp.scene = [sceneChar(OPPCHAR, 'opp#0', { state: 'active' })];
    s.players.self.deck = ['SDTOP', 'sd2'];
    s.players.opp.deck = ['ODTOP', 'od2'];
    useGameStateStore.getState().setGameState(s);

    // dispatch 経路で発動 (cost auto-pay)
    const r = dispatchEngineAction({ type: 'declaredAbility', uid: 'src#0', abilId: 'a2' });
    expect(r.ok).toBe(true);

    // step1: POLICE を選択
    const p1 = useGameStateStore.getState().pendingEffectPick!;
    expect(p1.atomVerb, 'step1 charSetCard').toBe('charSetCard');
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: 'pol#0' });

    const mid = useGameStateStore.getState();
    const pol = mid.gameState!.players.self.scene.find((c) => c.uid === 'pol#0')!;
    expect(pol.setCards.length, 'POLICE に 1枚セット').toBe(1);
    expect(pol.setCards[0]!.cardId, '自分デッキ上 (SDTOP) を 持ち主=自分 のデッキからセット').toBe('SDTOP');
    expect(pol.setCards[0]!.faceUp, '裏向きセット').toBe(false);
    expect(mid.gameState!.players.self.deck, '自分デッキ上 1枚消費').toEqual(['sd2']);

    // step2: OPPCHAR を選択 (相手陣の任意 char)
    const p2 = mid.pendingEffectPick!;
    expect(p2?.atomVerb, 'step2 charSetCard が surface (sequence step は独立)').toBe('charSetCard');
    const p2uids = p2.candidates.map((c) => c.uid);
    expect(p2uids, '相手陣 OPPCHAR が step2 候補 (side:opp)').toContain('opp#0');
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: 'opp#0' });

    const after = useGameStateStore.getState();
    const oc = after.gameState!.players.opp.scene.find((c) => c.uid === 'opp#0')!;
    expect(oc.setCards.length, 'OPPCHAR に 1枚セット').toBe(1);
    expect(oc.setCards[0]!.cardId, '相手デッキ上 (ODTOP) を 持ち主=相手 のデッキからセット').toBe('ODTOP');
    expect(oc.setCards[0]!.faceUp, '裏向きセット').toBe(false);
    expect(after.gameState!.players.opp.deck, '相手デッキ上 1枚消費').toEqual(['od2']);
    setHuman(null);
  });

  // ===== a2 decline (sequence-origin 0-pick): step1 を 0枚 decline → step2 (相手キャラへのセット) は発火する =====
  it('a2 decline (sequence): step1 を 0枚 decline → 自陣には何もセットされない が step2 (相手キャラへのセット) は発火する (sequence 各 step 独立 rules/15)', () => {
    setHuman('self');
    _resetUidCounter();
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [
      sceneChar(SRC, 'src#0', { state: 'active' }),
      sceneChar(POLICE, 'pol#0', { state: 'active' }),
    ];
    s.players.opp.scene = [sceneChar(OPPCHAR, 'opp#0', { state: 'active' })];
    s.players.self.deck = ['SDTOP', 'sd2'];
    s.players.opp.deck = ['ODTOP', 'od2'];
    useGameStateStore.getState().setGameState(s);

    dispatchEngineAction({ type: 'declaredAbility', uid: 'src#0', abilId: 'a2' });
    const p1 = useGameStateStore.getState().pendingEffectPick!;
    expect(p1.atomVerb).toBe('charSetCard');
    expect((p1 as { continuation?: { kind?: string } }).continuation?.kind, 'step1 continuation は sequence-origin').toBe('sequence');

    // step1 を 0枚 decline (sequence-origin → step2 は発火するべき = mandatory-tail)
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });

    const mid = useGameStateStore.getState();
    const pol = mid.gameState!.players.self.scene.find((c) => c.uid === 'pol#0')!;
    expect(pol.setCards.length, 'decline: 自陣 POLICE には何もセットされない').toBe(0);
    expect(mid.gameState!.players.self.deck, 'decline: 自分デッキは未消費').toEqual(['SDTOP', 'sd2']);
    // step2 が発火 = OPPCHAR への charSetCard pick が surface する (sequence は chain-gate を持たない)
    expect(mid.pendingEffectPick?.atomVerb, 'sequence: step1 decline でも step2 (相手セット) が surface').toBe('charSetCard');
    const p2uids = mid.pendingEffectPick!.candidates.map((c) => c.uid);
    expect(p2uids, 'step2 候補は相手陣 OPPCHAR').toContain('opp#0');

    // step2 も decline 可 (「1枚まで」)
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });
    const after = useGameStateStore.getState();
    const oc = after.gameState!.players.opp.scene.find((c) => c.uid === 'opp#0')!;
    expect(oc.setCards.length, 'step2 も 0枚 decline → 相手にもセットされない').toBe(0);
    expect(after.pendingEffectPick, '全 step 解決済 → pending null').toBeNull();
    setHuman(null);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=declared partnerColor緑/turn1 chain[charRemoveSetCard{hasSetCards,either}, sceneRemove{apMax:8000,either}] / a2=declared sleepSelf sequence[charSetCard{警察,self,deckTop}, charSetCard{opp,deckTop}]', () => {
    const [a1, a2] = B05028.abilities as [AbilityDef, AbilityDef];
    // a1
    expect(a1.type, 'a1 declared').toBe('declared');
    expect(a1.condition, 'a1 condition partnerColor 緑').toMatchObject({ kind: 'partnerColor', color: '緑' });
    expect(a1.limit, 'a1 【ターン1】').toMatchObject({ kind: 'turn', n: 1 });
    expect(a1cost(), 'a1 cost 無し').toBeUndefined();
    const e1 = a1.effect as { kind: string; steps: Array<Record<string, unknown>> };
    expect(e1.kind, 'a1 effect chain (「そうした場合」gate)').toBe('chain');
    expect(e1.steps[0], 'a1 step1 charRemoveSetCard hasSetCards/either/max:1').toMatchObject({
      kind: 'atom', verb: 'charRemoveSetCard',
      args: { player: 'self', max: 1, side: 'either', filter: { hasSetCards: true } },
    });
    expect(e1.steps[1], 'a1 step2 sceneRemove apMax:8000/either/cause:effect/max:1').toMatchObject({
      kind: 'atom', verb: 'sceneRemove',
      args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } },
    });
    // a2
    expect(a2.type, 'a2 declared').toBe('declared');
    expect(a2.cost, 'a2 cost sleepSelf').toMatchObject({ kind: 'sleepSelf' });
    const e2 = a2.effect as { kind: string; steps: Array<Record<string, unknown>> };
    expect(e2.kind, 'a2 effect sequence (各 step 独立)').toBe('sequence');
    expect(e2.steps[0], 'a2 step1 charSetCard 警察/self/deckTop/faceDown/max:1').toMatchObject({
      kind: 'atom', verb: 'charSetCard',
      args: { player: 'self', max: 1, side: 'self', filter: { trait: '警察' }, fromDeckTop: true, faceUp: false },
    });
    expect(e2.steps[1], 'a2 step2 charSetCard opp/deckTop/faceDown/max:1').toMatchObject({
      kind: 'atom', verb: 'charSetCard',
      args: { player: 'opp', max: 1, side: 'opp', fromDeckTop: true, faceUp: false },
    });
  });
});
