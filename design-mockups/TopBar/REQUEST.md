# Task 7.12 TopBar — Claude Design 依頼書

画面最上部の chrome (チャプタータグ + 痕跡 + 効果スタック件数 + ナレーター avatar + ©)。

## 使い方

1. claude.ai の Claude Design → New prototype → High fidelity
2. 下の「プロンプト」を貼り付け
3. その下の「添付コンテキスト」を additional context として貼り付け
4. Create
5. 納品物 (TSX / CSS / demo HTML) を `design-mockups/TopBar/` に保存

---

## プロンプト

```
名探偵コナンTCG Web ゲームの React コンポーネント「TopBar」を高忠実プロトタイプとして作成してください。

## 仕様
- 機能: 画面最上部 1920×44px の chrome バー。3 カラム grid (1fr auto 1fr):
  - 左: チャプタータグ ("先攻 3 ターン目" など) — neon-blue 左ボーダー + 神経刺激的ドット
  - 中央: 痕跡 (自/相 × 発見済/未発見) + 効果スタック件数バッジ
  - 右: ナレーター avatar (30×30 円形) + ナレーター名 + © (著作権表示)
- フェイズ表示は TopBar の中ではなく別の `.phase-bar` (画面右、別 task) に分離するので、
  TopBar には phase 関連 UI を入れない
- 各要素は静的データを受け取って描画するだけ

## 制約
- TypeScript + React (関数コンポーネント)
- props: {
    turn: { number: number; player: 'self' | 'opp' }
    scratchTrace: { self: '未発見' | '発見済'; opp: '未発見' | '発見済' }
    effectStackCount: number
    narratorName?: string  // デフォルト "ナレーター"
    copyright?: string     // 自由化、デフォルトは "© 青山剛昌／小学館 © TOMY"
  }
- スタイルは CSS variables を使用 (--neon-blue, --accent-gold, --text-*, --bg-deep など)、
  色のハードコード禁止
- クラス名は添付 HTML mock の class 構造を流用 (.topbar, .topbar-left/center/right,
  .chapter-tag, .chapter-tag .ico, .scratch, .scratch.found, .scratch .dot,
  .effect-stack, .narrator, .narrator-avatar, .narrator-name, .copyright)
- 公式ルールには触れない (静的表示のみ、操作系は Phase 8)
- 版権配慮:
  - ナレーターアバターは「特定の原作キャラ」を模写せず、グラデーション + シルエット程度
  - デフォルト copyright 文字列「© 青山剛昌／小学館 © TOMY」はそのまま表示可
    (これは権利者表記であり版権侵害ではない)

## 出力
1. TopBar.tsx — 関数コンポーネント本体
2. TopBar.css — クラス構造をそのまま流用 (色は CSS 変数で外出し)
3. TopBar-demo.html — 4 ケース表示:
   - 先攻 3 ターン目 / 自=発見済 / 相=未発見 / effectStackCount=0
   - 後攻 4 ターン目 / 自=未発見 / 相=発見済 / effectStackCount=3
   - 先攻 1 ターン目 / 自=未発見 / 相=未発見 / effectStackCount=0
   - 後攻 7 ターン目 / 自=発見済 / 相=発見済 / effectStackCount=5
```

---

## 添付コンテキスト

### ① HTML mock 抜粋

```html
<!-- design-mockups/01-board-mockup.html 1212-1235 行 -->
<div class="topbar">
  <div class="topbar-left">
    <span class="chapter-tag"><span class="ico"></span>後攻 4ターン目</span>
  </div>
  <div class="topbar-center">
    <div class="scratch found" title="痕跡: 自">
      <span class="dot"></span><span>痕跡 自 <strong style="color:#ffd700">発見済</strong></span>
    </div>
    <div class="effect-stack">効果スタック: 0</div>
    <div class="scratch" title="痕跡: 相">
      <span class="dot"></span><span>痕跡 相 <span style="color:#7090b5">未発見</span></span>
    </div>
  </div>
  <div class="topbar-right">
    <div class="narrator">
      <div class="narrator-avatar"></div>
      <span class="narrator-name">ナレーター</span>
    </div>
    <span class="copyright">© 青山剛昌／小学館 © TOMY</span>
  </div>
</div>
```

### ② CSS mock 抜粋 (TopBar 一式)

```css
.topbar {
  position: absolute; left: 0; right: 0; top: 0; height: 44px;
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  padding: 0 24px;
  background: linear-gradient(180deg, rgba(0,0,0,0.85), rgba(0,0,0,0.4));
  border-bottom: 1px solid rgba(78, 195, 255, 0.18);
  z-index: 20;
}
.chapter-tag {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 6px 16px;
  background: linear-gradient(90deg, rgba(78,195,255,0.18), rgba(78,195,255,0.02));
  border-left: 3px solid var(--neon-blue);
  font-size: 14px; font-weight: 700; letter-spacing: 0.08em;
  color: #d8eeff;
}
.chapter-tag .ico {
  width: 14px; height: 14px;
  border: 1.5px solid var(--neon-blue); border-radius: 50%;
  position: relative;
}
.chapter-tag .ico::after {
  content: ""; position: absolute; inset: 3px;
  background: var(--neon-blue); border-radius: 50%;
}
.topbar-center {
  display: flex; gap: 18px; align-items: center;
}
.scratch {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; color: var(--text-secondary); letter-spacing: 0.04em;
}
.scratch .dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #444;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12);
}
.scratch.found .dot {
  background: var(--accent-gold);
  box-shadow: 0 0 8px var(--accent-gold);
}
.effect-stack {
  font-size: 11px; color: var(--text-muted); letter-spacing: 0.08em;
  padding: 4px 10px;
  border: 1px solid rgba(255,255,255,0.08); border-radius: 3px;
}
.topbar-right {
  justify-self: end;
  display: flex; align-items: center; gap: 14px;
}
.copyright {
  font-size: 10px; color: var(--text-disabled); letter-spacing: 0.06em;
}
.narrator {
  display: flex; align-items: center; gap: 10px;
}
.narrator-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #b88, #6a3a3a 70%);
  border: 2px solid var(--neon-blue);
  box-shadow: 0 0 8px rgba(78,195,255,0.4);
  position: relative;
  overflow: hidden;
}
.narrator-avatar::after {
  content: ""; position: absolute; bottom: 0; left: 0; right: 0; height: 50%;
  background: linear-gradient(180deg, transparent, rgba(40,20,30,0.6));
}
.narrator-name {
  font-size: 11px; color: var(--text-secondary);
}
```

### ③ CSS 変数 (`src/ui/styles/tokens.css` 由来)

```css
--neon-blue:      #4ec3ff;
--accent-gold:    #ffd700;
--bg-deep:        #0a1a28;
--text-primary:   #e0ecf8;
--text-secondary: #b8d4f0;
--text-muted:     #7090b5;
--text-disabled:  #4a5a70;
--font-jp:        "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif;
--font-mono:      "Cascadia Code", "Consolas", monospace;
```

### ④ ゲームルール参考 (out of scope)

- 「先攻」=「自分が先手」のとき、自分の chapter-tag は「先攻 N ターン目」
- 痕跡 = 相手がリフレッシュしたとき自分が「発見済」になる (rules/13)
  - 痕跡 自/相 = 自分から見た自軍の痕跡 / 相手の痕跡
- 効果スタック (pendingEffects) は GameState.pendingEffects.length で件数

---

## 注意事項

- ⚠️ ナレーターアバターは特定キャラの模写禁止 (グラデ + シルエット程度)
- ✅ 「© 青山剛昌／小学館 © TOMY」は公式の権利者表記なのでそのまま使って良い
- ✅ scratch.found の色は accent-gold (#ffd700)、未発見は text-muted (#7090b5)
- ✅ effect-stack バッジは数値が 0 でも表示 ("効果スタック: 0")。Phase 7.14 で
  作った EffectStackPanel と機能が一部重複するが、TopBar 側は単純な inline 表記
- ✅ Phase 7 は静的表示のみ、onClick ハンドラ不要

## 納品物の置き場

`C:\Users\arumi\OneDrive\デスクトップ\conan\design-mockups\TopBar\`
- `TopBar.tsx`
- `TopBar.css`
- `TopBar-demo.html`

納品が完了したら教えてください。私が engine 型に接続して `src/ui/components/TopBar.tsx` + `.css` + `src/ui/hooks/useTopBar.ts` + `tests/ui/components/TopBar.test.tsx` に統合・commit します。
