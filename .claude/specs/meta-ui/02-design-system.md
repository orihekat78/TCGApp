# 02 — デザインシステム (tokens + 共通プリミティブ)

## 方針

`design-mockups_v2/06-shared.jsx` の `T` オブジェクト + 共通コンポーネント群を **TypeScript モジュールに分解** して `meta-app/src/shared/` に配置する。

既存 `src/ui/styles/tokens.css` (CSS Custom Property 定義) は **参照のみ**。コピーや共有はしない (依存ゼロ原則)。代わりに `meta-app/src/shared/tokens.ts` で値を **独立した TS オブジェクト** として再定義する。

## tokens.ts 構造 (実装は 10-B)

```ts
export const T = {
  // Base palette
  bgDeep:   '#0a1a28',
  bgZone:   '#1b3a5c',
  bgCell:   'rgba(0,0,0,0.32)',
  // Accent
  accentGold: '#ffd700',
  goldSoft:   '#ffd75e',
  neonBlue:   '#4ec3ff',
  // Border
  borderZone: '#3a6ea5',
  borderSelf: '#44dd99',
  borderOpp:  '#aa66dd',
  // Card colors
  card: {
    blue: '#2b6cb5', yellow: '#d4a425', red: '#c84040',
    green: '#3aa67a', purple: '#8a4cc0',
  },
  // Stat colors
  ap: '#ff9b6e', lp: '#ffd75e', lv: '#6ed1ff',
  // State
  stateSleep: 'rgba(40,80,200,0.6)',
  stateStun:  'rgba(220,50,50,0.65)',
  stateNamed: 'rgba(240,200,40,0.95)',
  // Text
  textPrimary:   '#e0ecf8',
  textSecondary: '#b8d4f0',
  textMuted:     '#7090b5',
  textDisabled:  '#4a5a70',
  // Typography
  fontJp:    '"Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", -apple-system, sans-serif',
  fontMono:  '"Cascadia Code", "Consolas", monospace',
  fontSerif: '"Hiragino Mincho ProN", "Yu Mincho", serif',
  // Card sizes (matches src/ui/styles/tokens.css naming)
  card: {
    scene:    { w: 60,  h: 84 },
    hand:     { w: 64,  h: 90 },
    handHover:{ w: 130, h: 180 },
    detail:   { w: 250, h: 350 },
  },
} as const;

export type TokenSet = typeof T;
```

`design-mockups_v2/06-shared.jsx` 内の `T` オブジェクトを 1:1 で TS 化。値変更は禁止 (デザイン整合性維持)。

## 共通プリミティブ一覧 (10-B 実装対象)

| ファイル | 公開 export | 説明 |
|---|---|---|
| `tokens.ts` | `T` / `TokenSet` | 上記参照 |
| `MetaBg.tsx` | `MetaBg` | `theme: 'noir' \| 'crimson'` / `scene: 9 種` の背景オーバーレイ |
| `AppTopBar.tsx` | `AppTopBar` | 64px ロゴ + ナビタブ + 勝率 + プロフィール |
| `MetaCard.tsx` | `MetaCard` | カードサムネ + CardSilhouette 内包 |
| `CardSilhouette.tsx` | `CardSilhouette` | 漢字頭文字 + 役職アイコン + ID シードパターン SVG |
| `Button.tsx` | `SmallButton`, `SetupButton`, `SetupReadyButton`, `PrimaryButton`, `GhostButton` | 5 種ボタン |
| `FilterGroup.tsx` | `FilterGroup`, `Chip` | 色/種別/コスト/特徴/キーワードチップ群 |
| `EmptyState.tsx` | `EmptyState` | 6 種アイコン + タイトル + CTA |
| `WarningBanner.tsx` | `WarningBanner` | 警告/エラー/情報の 3 トーン |
| `LoadingDots.tsx` | `LoadingDots` | 3 点パルススピナー |
| `NetworkStatus.tsx` | `NetworkStatus` | online/syncing/offline/error ピル |
| `NavHUD.tsx` | `NavHUD` | 開発用フローティング HUD (本番非表示可) |

## CSS 戦略

- グローバル: `meta-app/src/styles/meta.css` に `meta-*` クラス + `:focus-visible` outline + body リセット
- インタラクション: `06-shared.jsx` の CSS injection コードをそのまま `meta.css` に移管
- カラー/サイズ: 全て `T` オブジェクト経由 (`style={{ color: T.textPrimary }}` パターン)
- CSS-in-JS ライブラリは導入しない (既存 `src/` と一貫した style props)

## 設計トークンの一貫性ルール

- カラー値は **必ず `T` 経由**、ハードコード禁止
- カードサイズ ([T.card.scene.w](T.card.scene.w) 等) は固定 (`design-mockups_v2/E13` と整合)
- フォント変数は 3 種 (JP / Mono / Serif) のみ、追加禁止
- アニメ duration は `110-280ms` 範囲、`cubic-bezier(.2,.7,.3,1)` 統一

## アクセシビリティ

- `:focus-visible` で金色 2px outline (06-shared.jsx 由来)
- SVG ボタンに `aria-label` 必須
- コントラスト比 `#e0ecf8` on `#0a1a28` は WCAG AAA クリア
- `Esc` キーで全モーダル/オーバーレイ閉じる

## 関連
- 前: [01-project-setup.md](01-project-setup.md)
- 次: [03-routing.md](03-routing.md)
- 原典: `design-mockups_v2/06-shared.jsx` + `E13-design-system.md`
