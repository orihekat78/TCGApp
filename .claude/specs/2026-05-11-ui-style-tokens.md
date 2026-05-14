# 視覚スタイル・トークン (2026-05-11)

公式プレイシート忠実 (Q10a)。アニメーションは [ui-animation-specs.md](2026-05-11-ui-animation-specs.md)。

## カラートークン

```css
/* Base palette - ダークネイビー基調 */
--bg-deep:        #0a1a28;  /* 背景・盤面外 */
--bg-zone:        #1b3a5c;  /* 各ゾーンセル */
--bg-self:        linear-gradient(180deg, #0d2640, #1b3a5c);  /* 自陣マット (compound) */
--bg-opp:         linear-gradient(0deg,   #0d2640, #2a1b3c);  /* 相手陣マット (compound) */
--bg-self-1:      #0d2640;  /* 自陣 gradient endpoint (mock) */
--bg-self-2:      #1b3a5c;
--bg-opp-1:       #0d2640;  /* 相手陣 gradient endpoint (mock) */
--bg-opp-2:       #2a1b3c;
--bg-cell:        rgba(0,0,0,0.32);  /* ゾーン内コンテナ (mock) */
--border-zone:    #3a6ea5;
--border-self:    #44dd99;
--border-opp:     #aa66dd;

/* Accent */
--accent-gold:    #ffd700;
--accent-blue:    #3a6ea5;
--neon-blue:      #4ec3ff;  /* TopBar アクセント・focus ring (mock) */
--keep-out:       repeating-linear-gradient(90deg, #ffd700 0 22px, #0a0a0a 22px 44px);
/* Card color palette (color-stripe; mock) */
--color-blue:     #2b6cb5;
--color-yellow:   #d4a425;
--color-red:      #c84040;
--color-green:    #3aa67a;
--color-purple:   #8a4cc0;

/* State (opacity = mock 仕様) */
--state-sleep:    rgba(40,80,200,0.6);
--state-stun:     rgba(220,50,50,0.65);
--state-named:    rgba(240,200,40,0.95);

/* Target */
--target-valid:   #44dd99;
--target-invalid: rgba(238,80,80,0.5);

/* Case status */
--case-editing:   #3366ff;
--case-resolved:  #ee2255;

/* Text */
--text-primary:   #e0ecf8;
--text-secondary: #b8d4f0;
--text-muted:     #7090b5;
--text-disabled:  #4a5a70;
```

## テクスチャ・装飾

- **背景 (detective-noir, 5 層)**: `01-board-mockup.html` 23-41 行 `.bg` が SoT (① 上部スポットライト radial → ② diagonal shadow 115° → ③ 右下 SVG magnifier watermark gold → ④ 左上 magnifier neon-blue mirrored → ⑤ blueprint grid 48px → ⑥ ベース radial `#15263e→#0a1424→#050a14`)。終端 `.vignette` (42 行)。
- **KEEP OUT 仕切り**: 中央に黄黒ストライプ + 「KEEP OUT」テキスト (`--keep-out`)。**※ mock では `.keep-out { display:none !important }` で抑止されているが本 spec が正、UI 実装では復活させる**
- **カード裏面**: ダークグラデーション + 中央に金色 "DC" モノグラム
- **事件編/解決編スタンプ**: 右上にやや傾いた赤/青ラベル (検事印イメージ)

## タイポグラフィ

```css
--font-primary: -apple-system, "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif;
--font-jp: var(--font-primary);  /* mock 互換エイリアス */
--font-mono: "Cascadia Code", "Consolas", monospace;

--text-card-name:    14px bold;
--text-status-stamp: 11px 800;
--text-chapter:      12px bold;
--text-zone-label:   9px uppercase 0.5px letter-spacing;
--text-badge:        9px-10px 700;
```

## カードサイズ階層

| 用途 | サイズ |
|------|-------|
| 現場・パートナーエリア | 60×84px |
| 手札 (フラット並び) | 64×90px |
| 手札ホバー時拡大 | 130×180px (上方向ポップ) |
| 詳細モーダル | 250×350px |
| FILE 横向き | 70×50px |
| 証拠スタック | 50×70px |
| 事件カード (横向き対応) | max 120×86px、object-fit: contain |
| VS 演出時 | 200×280px |

## レスポンシブ (1280×720 時)

マット高 370→250px (約68%) / カード 60×84→50×70 (約83%) / フォント 14→12px / 領域比率は維持。

## アクセシビリティ

色比 #0a1a28 vs #e0ecf8 = 13:1 (AAA) / focus = 黄色アウトライン / aria-label に正式名+状態。

## 関連

- [ui-animation-specs.md](2026-05-11-ui-animation-specs.md)
- [ui-overall.md](2026-05-11-ui-overall.md)
- **視覚 SoT:** `design-mockups/01-board-mockup.html :root` (6-44行)。挙動衝突時は本 spec、視覚衝突時は mock を採用。
