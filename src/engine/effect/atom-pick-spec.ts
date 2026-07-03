// engine.effect.ATOM_PICK_SPEC — pick系 atom 短縮形の唯一の権威ソース。
// spec: .claude/specs/engine-api-atom-verbs.md / .claude/specs/card-authoring-convention.md (規則3)
//
// カード DSL の短縮形 `args:{ player, n|max, side?, filter?|filterAny?, state? }` を
// pick query (`target:{kind:'pick',...}`) に展開する際の既定値を集約する。
// - 既存 (PB: discard/evidenceToHand/handAddFromRemove, PA: sceneRemove/charModifyAP) を統合
// - 新規 (sceneSetState/charModifyLP/sceneEnter) もここに行追加するだけで対応
//
// 注: byPlayer / guard (a.player 要否, delta/state 要否) は verb 毎に差があるため
//     atom-handlers.ts 側の各 case に残す。本モジュールは「既定 area テーブル」と
//     「pick query 構築 (buildShortFormPick)」のみを担い、動作不変を保証する。

type Player = 'self' | 'opp';

export type AtomPickMode = 'PA' | 'PB';

export interface AtomPickSpec {
  /** 既定 pick area。'from' は実行時 args.from を参照 (sceneEnter)。 */
  defaultArea: 'scene' | 'hand' | 'evidence' | 'remove' | 'from' | 'partner-area';
  /** PA: uid='$pick' 置換型 (sceneRemove 等) / PB: target=cardId 配列型 (discard 等)。 */
  mode: AtomPickMode;
  /** 短縮形成立に必須の追加 arg。'delta'=number|{dyn} / 'state'=文字列。 */
  needs?: 'delta' | 'state';
  /** remove/evidence 等の source area から実体を抜く必要がある verb。 */
  sourceSplice?: boolean;
}

export const ATOM_PICK_SPEC: Record<string, AtomPickSpec> = {
  // 既存 (移行)
  discard:           { defaultArea: 'hand',     mode: 'PB' },
  evidenceToHand:    { defaultArea: 'evidence', mode: 'PB' },
  handAddFromRemove: { defaultArea: 'remove',   mode: 'PB', sourceSplice: true },
  // engine拡張 wave (2026-06-21): handToEvidence — 手札から1枚 pick → 裏向きで証拠へ (evidenceToHand の逆)。
  handToEvidence:    { defaultArea: 'hand',     mode: 'PB' },
  // engine additive wave (2026-06-28): handReveal — 手札から1枚 pick → 公開 (zone 変化なし)。discard と同型 PB pick。
  handReveal:        { defaultArea: 'hand',     mode: 'PB' },
  // engine mega-wave W1 (2026-07-03, P41): handToFileBottom — 手札から1枚 pick → FILE 1番下に表向き (B05045)。
  handToFileBottom:  { defaultArea: 'hand',     mode: 'PB' },
  // engine mega-wave W1 (2026-07-03): evidenceToDeckBottom — 証拠 pick → 持ち主デッキ下 (B03084 a1 前段)。
  evidenceToDeckBottom: { defaultArea: 'evidence', mode: 'PB' },
  // engine拡張 wave (2026-06-23): evidenceFlip pick-form — 「(相手の)裏向きの証拠を1つまで選び、表向きにする」。
  // PB pick (evidenceToHand と同型)。chooser=controller / side=証拠 owner / faceDown 限定は handler 側で構築。
  evidenceFlip:      { defaultArea: 'evidence', mode: 'PB' },
  // engine拡張 wave (2026-06-23): evidenceFlipDown pick-form — 「自分の表向きの証拠を N つまで選び、裏向きにする」
  // (evidenceFlip の逆)。PB pick。chooser=controller / side=証拠 owner / faceUp 限定。multi (max>1) は cardIds 契約。
  evidenceFlipDown:  { defaultArea: 'evidence', mode: 'PB' },
  sceneRemove:       { defaultArea: 'scene',    mode: 'PA' },
  // engine wave A1 (2026-07-02 G39 継続): PA 一般カード枠から N 枚選びリムーブ (B07037/PR263)。
  // PB pick (discard/handReveal 同型、target=cardId 配列)。sourceSplice=partnerAreaCards から実体除去。
  partnerAreaRemove: { defaultArea: 'partner-area', mode: 'PB', sourceSplice: true },
  charModifyAP:      { defaultArea: 'scene',    mode: 'PA', needs: 'delta' },
  // 新規
  sceneSetState:     { defaultArea: 'scene',    mode: 'PA', needs: 'state' },
  charModifyLP:      { defaultArea: 'scene',    mode: 'PA', needs: 'delta' },
  // engine-extension #2 (2026-06-05): レベル±N 短縮形
  charModifyLevel:   { defaultArea: 'scene',    mode: 'PA', needs: 'delta' },
  // engine-extension #4 (2026-06-05): char→hand bounce 短縮形
  sceneToHand:       { defaultArea: 'scene',    mode: 'PA' },
  // Task D E2 (2026-06-12): scene→deck 短縮形 (pos:'bottom'|'top' は handler 側で解決)
  sceneToDeck:       { defaultArea: 'scene',    mode: 'PA' },
  // Task D E4 (2026-06-12): triggered ability 付与短縮形 (ability descriptor は handler 側で解決)
  charGrantAbility:  { defaultArea: 'scene',    mode: 'PA' },
  // Task D E0 addendum (2026-06-12): keyword 付与短縮形 (pick carrier 用。B09032 解禁)
  charGrantKeyword:  { defaultArea: 'scene',    mode: 'PA' },
  // engine-extension #5b (2026-06-05): set-card 短縮形 (fromDeckTop と組合せ)
  charSetCard:       { defaultArea: 'scene',    mode: 'PA' },
  // 2026-06-06 タスクC: セット card を 1 枚外す短縮形 (hasSetCards filter で対象キャラを pick)
  charRemoveSetCard: { defaultArea: 'scene',    mode: 'PA' },
  sceneEnter:        { defaultArea: 'from',     mode: 'PA', sourceSplice: true },
};

export type ShortFormPickTarget = {
  kind: 'pick';
  query: Record<string, unknown>;
  n: { min: number; max: number };
  chooser: Player;
};

/**
 * 短縮形 args から pick query を構築する。`n`=固定数 / `max`=0〜max (skip 可)。
 * `side` 未指定なら sideDefault。`filter`/`filterAny`/`state`(配列=状態フィルタ)/`distinctNames`
 * は存在時のみ query に pass-through する (PB 経路は filter のみ持つので従来と byte 等価)。
 *
 * 呼び出し側は事前に「n か max のいずれかが number」であることを保証すること。
 */
export function buildShortFormPick(
  area: string,
  a: Record<string, unknown>,
  chooser: Player,
  sideDefault: 'self' | 'opp' | 'either',
): ShortFormPickTarget {
  const hasN = typeof a.n === 'number';
  const nMin = hasN ? (a.n as number) : 0;
  const nMax = hasN ? (a.n as number) : (a.max as number);
  const side = (a.side as 'self' | 'opp' | 'either' | undefined) ?? sideDefault;
  const query: Record<string, unknown> = { area, side };
  if (a.filter && typeof a.filter === 'object') query.filter = a.filter;
  if (Array.isArray(a.filterAny)) query.filterAny = a.filterAny;
  if (Array.isArray(a.state)) query.state = a.state;
  if (a.distinctNames === true) query.distinctNames = true;
  // engine拡張 wave (2026-06-23): evidenceFlip 用 — 裏向き(未公開)の証拠のみ候補化。
  if (a.faceDown === true) query.faceDown = true;
  // engine拡張 wave (2026-06-23): evidenceFlipDown 用 — 表向き(公開済)の証拠のみ候補化。
  if (a.faceUp === true) query.faceUp = true;
  // engine additive wave-18 (2026-07-03): inContact 用 — pick を現コンタクト参加者に限定 (B04075/PR029)。
  if (a.inContact === true) query.inContact = true;
  return { kind: 'pick', query, n: { min: nMin, max: nMax }, chooser };
}

/** delta が number か {dyn:string} か (dyn-delta 短縮形対応; D08026/D11021)。 */
export function isShortFormDelta(v: unknown): boolean {
  return typeof v === 'number'
    || (typeof v === 'object' && v !== null && typeof (v as { dyn?: unknown }).dyn === 'string');
}
