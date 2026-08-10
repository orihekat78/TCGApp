// spec: .claude/specs/meta-ui/02-design-system.md + 05-engine-stub.md
// カード基本型 — design-mockups_v2/06-card-data.jsx の CARD_POOL 構造に対応

export type CardColor = 'blue' | 'yellow' | 'red' | 'green' | 'purple' | 'black' | 'white';
export type CardKind = 'character' | 'event' | 'partner' | 'case';

export interface CardDef {
  /** 印刷番号 (cardNum, 例 D08003)。絵柄違い (パラレル) ごとに異なる。 */
  num: string;
  /** 正規カードID (cardId, 例 0489)。パラレルは同一 id を共有 = ゲーム上「同じカード」。
   *  rules/02-deck-construction.md「絵柄が違っても ID が同じであれば同じカード」。 */
  id: string;
  /** この印刷カードが属する公式商品・収録弾 (例 CT-P10 / CT-D08 / PR)。 */
  setCode?: string;
  name: string;
  /** 表示用の代表色 (= colors[0])。色フィルタ/集計は colors を使う。 */
  color: CardColor;
  /** 全色 (混色カードは複数色)。色フィルタ・BY COLOR 集計はこちらを参照。 */
  colors?: CardColor[];
  type: CardKind;
  cost?: number;
  ap?: number;
  lp?: number;
  level?: number;
  /** 事件カードの先攻時の必要証拠枚数。公式カードリスト由来。 */
  difficultyFirst?: number;
  /** 事件カードの後攻時の必要証拠枚数。公式カードリスト由来。 */
  difficultySecond?: number;
  rarity?: string;
  features?: string[];
  keywords?: string[];
  effectShort?: string;
  /** 固有のデッキ投入上限。未指定は 3 枚。 */
  deckLimit?: number | 'unlimited';
}

export interface DeckRecord {
  id: string;
  name: string;
  /** パートナーカード (cardNum)。1 デッキ 1 枚必須 (rules/02)。 */
  partner: string;
  /** 事件カード (cardNum)。1 デッキ 1 枚必須。パートナー1+事件1+キャラ/イベント40 で 1 セット (rules/02)。 */
  case: string;
  cards: { num: string; count: number }[];
  modified: number;
}

export interface MatchDeckCardEntry {
  num: string;
  count: number;
}

/**
 * The public deck list captured before a match starts.
 * It intentionally excludes card order, draw state, and every in-match hidden zone.
 */
export interface MatchDeckSnapshotV1 {
  schemaVersion: 1;
  deckId?: string;
  name: string;
  partner: string;
  case: string;
  cards: MatchDeckCardEntry[];
}

/** Opaque pointer to the exact replay artifact stored outside the history projection. */
export interface HistoryReplayRefV1 {
  storageSchemaVersion: 1;
  replaySchemaVersion: 3;
  artifactId: string;
  digest: `sha256-${string}`;
  byteLength: number;
}

export interface MatchRecord {
  id: string;
  /** Stable identity issued when the match session begins. */
  sessionId?: string;
  recorded: number;
  won: boolean;
  deckName: string;
  oppDeckName?: string;
  /** Exact public deck list used for this match. Missing on legacy history rows. */
  selfDeckSnapshot?: MatchDeckSnapshotV1;
  /** Exact public opponent deck list used for this match. Missing on legacy history rows. */
  oppDeckSnapshot?: MatchDeckSnapshotV1;
  /** No private card or frame data is permitted in this history row. */
  replayRef?: HistoryReplayRefV1;
  mode?: 'solo' | 'observe';
  turns: number;
  duration: number;
  mvp?: string;
  evidGot: number;
  evidLost: number;
  contacts: number;
  hirameki: number;
  misread: number;
  p1Target: 7 | 6;
  p2Target: 7 | 6;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}
