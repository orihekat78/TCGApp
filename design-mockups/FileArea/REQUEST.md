# Task 7.8 FileArea — Claude Design 依頼書

FILE エリア (横向き card-back スタック + 枚数 + 7枚進捗バー + アシスト中パートナー混在)。

## 使い方

1. claude.ai の Claude Design → New prototype → High fidelity
2. 下の「プロンプト」を貼り付け
3. その下の「添付コンテキスト」を additional context として貼り付け
4. Create
5. 納品物 (TSX / CSS / demo HTML) を `design-mockups/FileArea/` に保存

---

## プロンプト

```
名探偵コナンTCG Web ゲームの React コンポーネント「FileArea」を高忠実プロトタイプとして作成してください。

## 仕様
- 機能: プレイヤーの FILE エリア (デッキから自動的に置かれる横向きカード) を表示。
  事件解決の条件 (FILE が 7 枚以上) に向けた進捗を視覚化する。
- レイアウト: 縦並び、上から zone-label / stack-display.file / progress-track の 3 段
- スタック表示:
  - 中央に金色エンブレム付き card-back (探偵書類アイコン: SVG ファイル + 虫眼鏡)
  - 背後に 3 層の stack-shadow (1°/3°/-1° に傾き、2-6px ずつズラして奥行き)
  - 中央前面に count-overlay (大きな枚数バッジ、accent-gold で囲み)
- 進捗バー:
  - 7 マスの progress-7 (上端)、FILE 枚数分が filled (accent-gold + glow)
  - 下端は連続ストライプの progress-track (FILE 枚数 / 7 を百分率で描画)
- アシスト中パートナーカード:
  - FILE 内に交じる「アシスト中パートナー」アイテム
  - 通常 card-back と区別できるよう、サイドにスリープ表示 (rotate(-90deg))
  - 配列の末尾近くに混じる想定 (file 配列に { type:'card-back' } と
    { type:'assisted-partner', cardId } が混在)
- ホバー時: ボーダーが accent-gold に強調、背景が少し光る (modal 開きの予告、Phase 8)

## 制約
- TypeScript + React (関数コンポーネント)
- props: { cards: FileCard[]; side: 'self' | 'opp'; resolveCard?: (id) => ResolvedCardMeta }
  - FileCard 型は別途記載 (下記)
  - resolveCard はアシスト中パートナーの名前解決用 (任意)
- スタイルは CSS variables を使用 (--accent-gold, --color-blue, --color-yellow,
  --text-*, --bg-cell, --font-jp, --font-mono など)、色のハードコード禁止
- クラス名は添付 HTML mock の class 構造を流用 (.zone.file-strip, .stack-display.file,
  .stack-shadow.s1/.s2/.s3, .card-back, .count-overlay, .progress-track, .progress-fill,
  .file-strip-header, .progress-7 など)
- 「進捗 7 段マス」(file-strip-header の .progress-7) を上部に追加 (mock の演出を踏襲)
- 公式ルールには触れない (静的表示のみ、クリック展開モーダルは Phase 8)
- 版権配慮: 「江戸川コナン」等の原作キャラ名は使わない

## 出力
1. FileArea.tsx — 関数コンポーネント本体 (FileArea + 内部の FileCardItem)
2. FileArea.css — クラス構造をそのまま流用 (色は CSS 変数で外出し)
3. FileArea-demo.html — 4 ケース表示:
   - 0 枚 (空、進捗 0/7)
   - 4 枚 (進捗 4/7)
   - 7 枚 (進捗 7/7、解決編移行可能)
   - 5 枚 + アシスト中パートナー 1 枚 (計 6 枚、進捗 6/7)
```

---

## 添付コンテキスト

### ① HTML mock 抜粋

```html
<!-- design-mockups/01-board-mockup.html 1394-1405 行 -->
<div class="zone file-strip">
  <div class="zone-label"><span>FILE</span><span class="count">2</span></div>
  <div class="stack-display file">
    <div class="stack-shadow s3"></div>
    <div class="stack-shadow s2"></div>
    <div class="stack-shadow s1"></div>
    <div class="card-back"><div class="monogram">DC</div><div class="magnifier"></div></div>
    <div class="count-overlay">2</div>
  </div>
  <div class="progress-track"><div class="progress-fill" style="width:29%"></div></div>
</div>
```

### ② CSS mock 抜粋 (file-strip 一式)

```css
.file-strip {
  background: rgba(0,0,0,0.32);
  border: 1px solid rgba(255,215,0,0.32);
  border-radius: 4px;
  padding: 8px;
  display: flex; flex-direction: column; gap: 0;
  position: relative;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.file-strip:hover {
  border-color: rgba(255,215,0,0.65);
  background: rgba(40,30,10,0.4);
}
.file-strip .stack-display.file .count-overlay {
  box-shadow: 0 0 12px rgba(255,215,0,0.3);
  color: var(--accent-gold);
}
.file-strip .progress-track .progress-fill {
  background: linear-gradient(90deg, var(--accent-gold), #ffd75e);
}
.file-strip-header {
  color: rgba(255,215,0,0.85);
  display: flex; justify-content: space-between; align-items: center;
  font-size: 9px; letter-spacing: 0.18em; font-weight: 700; text-transform: uppercase;
}
.file-strip-header .progress-7 {
  display: flex; gap: 2px;
}
.file-strip-header .progress-7 span {
  width: 12px; height: 4px; background: rgba(255,255,255,0.08); border-radius: 1px;
}
.file-strip-header .progress-7 span.filled {
  background: var(--accent-gold);
  box-shadow: 0 0 4px rgba(255,215,0,0.5);
}
```

### ③ CSS mock 抜粋 (.stack-display + .card-back の SVG アイコン)

```css
.stack-display {
  flex: 1; position: relative;
  display: flex; align-items: center; justify-content: center;
}
.stack-display .card-back {
  width: 64px; height: 90px;
  transform: rotate(-2deg);
  background:
    radial-gradient(circle at 6px 6px, rgba(255,215,0,0.5) 0 1.5px, transparent 2px),
    radial-gradient(circle at calc(100% - 6px) 6px, rgba(255,215,0,0.5) 0 1.5px, transparent 2px),
    radial-gradient(circle at 6px calc(100% - 6px), rgba(255,215,0,0.5) 0 1.5px, transparent 2px),
    radial-gradient(circle at calc(100% - 6px) calc(100% - 6px), rgba(255,215,0,0.5) 0 1.5px, transparent 2px),
    linear-gradient(160deg, #1f2438 0%, #0a0e1c 100%);
  border: 1px solid rgba(255,215,0,0.28);
  position: relative;
}
/* FILE stack: ファイルフォルダ + 虫眼鏡 SVG が card-back 中央に乗る */
.stack-display.file .card-back::before {
  content: "";
  position: absolute; inset: 0;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 90'><g><path d='M12 24 L26 24 L30 28 L52 28 L52 64 L12 64 Z' fill='none' stroke='%23ffd75e' stroke-width='1.5' opacity='0.85'/><path d='M14 32 L50 32' stroke='%23ffd75e' stroke-width='0.7' opacity='0.45'/><path d='M14 38 L46 38' stroke='%23ffd75e' stroke-width='0.7' opacity='0.45'/><path d='M14 44 L48 44' stroke='%23ffd75e' stroke-width='0.7' opacity='0.45'/><path d='M14 50 L42 50' stroke='%23ffd75e' stroke-width='0.7' opacity='0.45'/></g><g transform='translate(34 52)'><circle cx='6' cy='6' r='6' fill='none' stroke='%234ec3ff' stroke-width='1.4'/><line x1='10' y1='10' x2='16' y2='16' stroke='%234ec3ff' stroke-width='2' stroke-linecap='round'/></g></svg>") no-repeat center / 80% auto;
}
.stack-display .stack-shadow {
  position: absolute;
  width: 64px; height: 90px;
  border-radius: 4px;
  background: linear-gradient(160deg, #1a1f30, #0a0e1c);
  border: 1.5px solid #2a3552;
}
.stack-shadow.s1 { transform: translate(2px, 2px) rotate(1deg); }
.stack-shadow.s2 { transform: translate(4px, 4px) rotate(3deg); }
.stack-shadow.s3 { transform: translate(6px, 6px) rotate(-1deg); }
.stack-display .count-overlay {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.85);
  color: var(--accent-gold);
  font-family: var(--font-mono); font-size: 22px; font-weight: 800;
  padding: 4px 12px;
  border: 1.5px solid var(--accent-gold);
  border-radius: 3px;
  text-shadow: 0 0 6px rgba(255,215,0,0.5);
}
.progress-track {
  height: 4px; margin-top: 4px;
  background: rgba(0,0,0,0.5);
  border-radius: 2px; overflow: hidden;
  position: relative;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ffd75e, #ff9b3e);
  border-radius: 2px;
  box-shadow: 0 0 6px rgba(255,215,0,0.5);
}
```

### ④ CSS 変数 (`src/ui/styles/tokens.css` 由来)

```css
--accent-gold:    #ffd700;
--neon-blue:      #4ec3ff;
--color-blue:     #2b6cb5;
--color-yellow:   #d4a425;
--bg-cell:        rgba(0,0,0,0.32);
--text-primary:   #e0ecf8;
--text-secondary: #b8d4f0;
--text-muted:     #7090b5;
--font-jp:        "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif;
--font-mono:      "Cascadia Code", "Consolas", monospace;
```

### ⑤ TypeScript 型定義

```typescript
type CardId = string;

type FileCard =
  | { type: 'card-back' }                              // 通常の裏向き FILE カード
  | { type: 'assisted-partner'; cardId: string };      // アシスト中のパートナー (表向きに識別)

type ResolvedCardMeta = {
  name: string;
  color: 'blue' | 'yellow' | 'red' | 'green' | 'purple';
  ap: number;
  lp: number;
  lv: number;
};
```

### ⑥ ゲームルール参考 (out of scope だが動機を伝えるため)

- FILE エリアは毎ターン自動的に 2 枚追加される (オートフェイズ)
- FILE が 7 枚以上で「事件編 → 解決編」に移行できる (条件: アシスト宣言時)
- アシストするとパートナーが FILE エリアに移動 (= assisted-partner エントリ)
- 「ネクストヒント」で 1 枚消費する操作もあり

---

## 注意事項

- ⚠️ 原作キャラ名 (江戸川コナン等) は使用禁止
- ✅ progress-7 (7 マス進捗) は mock の `.progress-7` 演出に従う
- ✅ アシスト中パートナーは「スリープ向きの card-back」or 「斜めにスリープ + パートナー色 stripe」など、ぱっと見で通常 card-back と判別できる視覚処理
- ✅ Phase 7 は静的表示のみ、クリック・hover ハンドラ不要 (Phase 8 でモーダル展開)
- ✅ count-overlay は枚数に関係なく中央に表示 (0 枚時は "0" or 「FILE 空」)

## 納品物の置き場

`C:\Users\arumi\OneDrive\デスクトップ\conan\design-mockups\FileArea\`
- `FileArea.tsx`
- `FileArea.css`
- `FileArea-demo.html`

納品が完了したら教えてください。私が engine 型に接続して `src/ui/components/FileArea.tsx` + `.css` + `src/ui/hooks/useFile.ts` + `tests/ui/components/FileArea.test.tsx` に統合・commit します。
