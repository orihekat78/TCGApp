// spec: .claude/specs/meta-ui/ (Phase 18: Master Duel 風 共有フィルタレール)
// CardsScreen / DeckEditor が共通で使う facet フィルタ UI。
// 色/種別/コスト/レアリティ/特徴/キーワード。特徴・キーワードは OR/AND 切替可。

import { useMemo } from 'react';
import { T } from './tokens';
import { FilterGroup } from './FilterGroup';
import { CARD_POOL } from '../data/cardPool';
import {
  ALL_CARD_SETS, ALL_FEATURES, ALL_KEYWORDS, ALL_RARITIES, COLOR_META, TYPE_META, COST_BUCKETS,
  activeFilterCount, costBucket, rarityHex, toggleIn, matchesFilter,
  type CardFilterState, type MatchMode,
} from '../data/cardFilter';
import type { CardColor, CardDef, CardKind } from '../data/types';
import { cardSetCode } from '../data/cardPool';

interface Props {
  filter: CardFilterState;
  onChange: (patch: Partial<CardFilterState>) => void;
  onReset: () => void;
  /** カウント表示の母集団 (既定 = 全カード)。 */
  pool?: readonly CardDef[];
  /** 表示する種別 (既定 = 4 種すべて)。DeckEditor のプールは キャラ/イベント のみ。 */
  typeOptions?: CardKind[];
  /** false の場合も件数は disabled 判定へ使うが、画面には表示しない。 */
  showCounts?: boolean;
  /** false の場合、特徴・キーワードの一致方法は内部値のまま UI に出さない。 */
  showMatchModes?: boolean;
  /** 0件で選べない項目を隠す。選択中の項目は0件でも残す。 */
  hideUnavailable?: boolean;
}

export function FilterRail({
  filter,
  onChange,
  onReset,
  pool = CARD_POOL,
  typeOptions,
  showCounts = true,
  showMatchModes = true,
  hideUnavailable = false,
}: Props) {
  const counts = useMemo(() => computeCounts(pool, filter), [pool, filter]);
  const types = typeOptions ?? TYPE_META.map((t) => t.t);
  const active = activeFilterCount(filter);

  return (
    <div className="filter-rail-scroll" style={{
      padding: '14px 14px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 4,
      display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, fontWeight: 800, color: T.gold, letterSpacing: '0.28em' }}>
          FILTERS
        </span>
        {active > 0 && (
          <span style={{
            marginLeft: 8, padding: '1px 7px',
            background: `${T.gold}22`, border: `1px solid ${T.gold}66`, borderRadius: 8,
            fontFamily: T.fontMono, fontSize: 9, fontWeight: 800, color: T.gold,
          }}>{active}</span>
        )}
      </div>

      {types.length > 1 && (
        <FilterGroup label="種別" items={TYPE_META.filter((x) => types.includes(x.t)).map((x) => ({
          c: x.hex, label: x.label, active: filter.types.includes(x.t),
          n: counts.types.get(x.t) ?? 0,
          disabled: !filter.types.includes(x.t) && (counts.types.get(x.t) ?? 0) === 0,
          onClick: () => onChange({ types: toggleIn(filter.types, x.t) }),
        }))} showCounts={showCounts} hideDisabled={hideUnavailable} />
      )}

      <FilterGroup label="収録弾" items={ALL_CARD_SETS.map((setCode) => ({
        c: T.neonBlue, label: setCode, active: (filter.sets ?? []).includes(setCode),
        n: counts.sets.get(setCode) ?? 0,
        disabled: !(filter.sets ?? []).includes(setCode) && (counts.sets.get(setCode) ?? 0) === 0,
        onClick: () => onChange({ sets: toggleIn(filter.sets ?? [], setCode) }),
      }))} showCounts={showCounts} hideDisabled={hideUnavailable} />

      <FilterGroup label="色" items={COLOR_META.map((x) => ({
        c: x.hex, label: x.label, active: filter.colors.includes(x.c),
        n: counts.colors.get(x.c) ?? 0,
        disabled: !filter.colors.includes(x.c) && (counts.colors.get(x.c) ?? 0) === 0,
        onClick: () => onChange({ colors: toggleIn(filter.colors, x.c) }),
      }))} showCounts={showCounts} hideDisabled={hideUnavailable} />

      <FilterGroup label="コスト" items={COST_BUCKETS.map((n) => ({
        c: T.neonBlue, label: n === 8 ? '8+' : String(n), active: filter.costs.includes(n),
        n: counts.costs.get(n) ?? 0,
        disabled: !filter.costs.includes(n) && (counts.costs.get(n) ?? 0) === 0,
        onClick: () => onChange({ costs: toggleIn(filter.costs, n) }),
      }))} showCounts={showCounts} hideDisabled={hideUnavailable} />

      {ALL_RARITIES.length > 1 && (
        <FilterGroup label="レアリティ" items={ALL_RARITIES.map((r) => ({
          c: rarityHex(r), label: r, active: filter.rarities.includes(r),
          n: counts.rarities.get(r) ?? 0,
          disabled: !filter.rarities.includes(r) && (counts.rarities.get(r) ?? 0) === 0,
          onClick: () => onChange({ rarities: toggleIn(filter.rarities, r) }),
        }))} showCounts={showCounts} hideDisabled={hideUnavailable} />
      )}

      {ALL_FEATURES.length > 0 && (
        <FacetWithMode
          label="特徴" mode={filter.featureMode}
          onMode={(m) => onChange({ featureMode: m })}
          showCounts={showCounts}
          showMatchMode={showMatchModes}
          hideUnavailable={hideUnavailable}
          items={ALL_FEATURES.map((f) => ({
            c: T.green, label: f, active: filter.features.includes(f),
            n: counts.features.get(f) ?? 0,
            disabled: !filter.features.includes(f) && (counts.features.get(f) ?? 0) === 0,
            onClick: () => onChange({ features: toggleIn(filter.features, f) }),
          }))}
        />
      )}

      {ALL_KEYWORDS.length > 0 && (
        <FacetWithMode
          label="キーワード" mode={filter.keywordMode}
          onMode={(m) => onChange({ keywordMode: m })}
          showCounts={showCounts}
          showMatchMode={showMatchModes}
          hideUnavailable={hideUnavailable}
          items={ALL_KEYWORDS.map((k) => ({
            c: T.gold, label: k, active: filter.keywords.includes(k),
            n: counts.keywords.get(k) ?? 0,
            disabled: !filter.keywords.includes(k) && (counts.keywords.get(k) ?? 0) === 0,
            onClick: () => onChange({ keywords: toggleIn(filter.keywords, k) }),
          }))}
        />
      )}

      <button onClick={onReset} disabled={active === 0} style={{
        padding: '6px', textAlign: 'center', cursor: active === 0 ? 'default' : 'pointer',
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${T.textMuted}55`, borderRadius: 2,
        fontFamily: T.fontMono, fontSize: 10,
        color: active === 0 ? T.textDisabled : T.textMuted, letterSpacing: '0.18em',
      }}>
        すべてクリア
      </button>
    </div>
  );
}

// 特徴/キーワードのような複数値 facet に OR/AND トグルを付けたグループ。
function FacetWithMode({ label, mode, onMode, items, showCounts, showMatchMode, hideUnavailable }: {
  label: string; mode: MatchMode; onMode: (m: MatchMode) => void;
  items: { c: string; label: string; active: boolean; n: number; disabled?: boolean; onClick: () => void }[];
  showCounts: boolean;
  showMatchMode: boolean;
  hideUnavailable: boolean;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.2em' }}>{label}</span>
        {showMatchMode && (
          <div className="filter-match-mode" role="group" aria-label={`${label}の一致方法`} style={{ marginLeft: 'auto', display: 'flex', border: `1px solid rgba(78,195,255,0.3)`, borderRadius: 2, overflow: 'hidden' }}>
            {(['or', 'and'] as const).map((m) => (
              <button key={m} onClick={() => onMode(m)} aria-pressed={mode === m}
                aria-label={`${label}を${m === 'or' ? 'いずれか' : 'すべて'}一致`} style={{
                padding: '1px 7px',
                background: mode === m ? T.gold : 'rgba(0,0,0,0.3)',
                color: mode === m ? '#1a1208' : T.textMuted,
                fontFamily: T.fontMono, fontSize: 8, fontWeight: 800, cursor: 'pointer',
                letterSpacing: '0.1em',
              }}>{m.toUpperCase()}</button>
            ))}
          </div>
        )}
      </div>
      <FilterGroup label="" items={items} small showCounts={showCounts} hideDisabled={hideUnavailable} />
    </div>
  );
}

interface Counts {
  sets: Map<string, number>;
  colors: Map<CardColor, number>;
  types: Map<CardKind, number>;
  costs: Map<number, number>;
  rarities: Map<string, number>;
  features: Map<string, number>;
  keywords: Map<string, number>;
}

function computeCounts(pool: readonly CardDef[], filter: CardFilterState): Counts {
  const sets = new Map<string, number>();
  const colors = new Map<CardColor, number>();
  const types = new Map<CardKind, number>();
  const costs = new Map<number, number>();
  const rarities = new Map<string, number>();
  const features = new Map<string, number>();
  const keywords = new Map<string, number>();
  const inc = <K,>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);
  // 各 facet は「自分の group を除いた他フィルタで絞った母集団」で件数を数える (cross-filter)。
  // → 他フィルタ適用後に 0 件になる option を FilterRail 側で disabled にできる
  //   (例: 種別=パートナー 選択時、コストはどの値も 0 件 → 全 disabled)。混色は各色に計上。
  for (const c of pool) {
    if (matchesFilter(c, filter, 'sets')) inc(sets, c.setCode ?? cardSetCode(c.num));
    if (matchesFilter(c, filter, 'colors')) for (const col of c.colors ?? [c.color]) inc(colors, col);
    if (matchesFilter(c, filter, 'types')) inc(types, c.type);
    if (matchesFilter(c, filter, 'costs')) inc(costs, costBucket(c));
    if (matchesFilter(c, filter, 'rarities') && c.rarity) inc(rarities, c.rarity);
    if (matchesFilter(c, filter, 'features')) for (const f of c.features ?? []) inc(features, f);
    if (matchesFilter(c, filter, 'keywords')) for (const k of c.keywords ?? []) inc(keywords, k);
  }
  return { sets, colors, types, costs, rarities, features, keywords };
}
