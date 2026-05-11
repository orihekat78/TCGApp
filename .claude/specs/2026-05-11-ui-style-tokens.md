# 視覚スタイル・トークン (2026-05-11)

公式プレイシート忠実 (Q10a)。アニメーションは [ui-animation-specs.md](2026-05-11-ui-animation-specs.md)。

## カラートークン

```css
/* Base palette - ダークネイビー基調 */
--bg-deep:        #0a1a28;  /* 背景・盤面外 */
--bg-zone:        #1b3a5c;  /* 各ゾーンセル */
--bg-self:        linear-gradient(180deg, #0d2640, #1b3a5c);  /* 自陣マット */
--bg-opp:         linear-gradient(0deg,   #0d2640, #2a1b3c);  /* 相手陣マット */
--bg-cell:        rgba(0,0,0,0.3);  /* ゾーン内コンテナ */
--border-zone:    #3a6ea5;
--border-self:    #44dd99;
--border-opp:     #aa66dd;

/* Accent */
--accent-gold:    #ffd700;
--accent-blue:    #3a6ea5;
--keep-out:       repeating-linear-gradient(90deg, #ffd700 0 18px, #000 18px 36px);

/* State */
--state-sleep:    rgba(40,80,200,0.95);
--state-stun:     rgba(220,50,50,0.95);
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

- **背景**: レンガ壁テクスチャ (公式プレイシート由来) を `--bg-deep` に乗算合成
- **KEEP OUT 仕切り**: 中央に黄黒ストライプ + 「KEEP OUT」テキスト
- **カード裏面**: ダークグラデーション + 中央に金色 "DC" モノグラム
- **事件編/解決編スタンプ**: 右上にやや傾いた赤/青ラベル (検事印イメージ)

## タイポグラフィ

```css
--font-primary: -apple-system, "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif;
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

- マット高: 370px → 250px (約68%)
- カード: 60×84 → 50×70 (約83%)
- フォント: 14px → 12px ベース
- 領域比率は維持

## アクセシビリティ

- 高コントラスト色比 (背景 #0a1a28 vs テキスト #e0ecf8 → ratio 13:1, AAA)
- キーボードフォーカス: 黄色のアウトライン
- スクリーンリーダー対応 (aria-label 各カードに正式名 + 状態)

## 関連

- [ui-animation-specs.md](2026-05-11-ui-animation-specs.md)
- [ui-overall.md](2026-05-11-ui-overall.md)
