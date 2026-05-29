# 01 — meta-app プロジェクト構成

## ディレクトリ構成

```
meta-app/
├── index.html
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.meta.ts        ← port 5174, root '.', outDir ../dist-meta
├── playwright.config.ts       ← e2e 設定 (10-J)
├── src/
│   ├── main.tsx               ← createRoot + StrictMode
│   ├── App.tsx                ← MetaShell + ScreenSwitch
│   ├── MetaShell.tsx          ← ルート判定 + シーン背景 + フェード
│   ├── shared/                ← TS 化共通プリミティブ (10-B)
│   ├── screens/               ← 9 画面 + Placeholder + MatchPlaceholder
│   ├── data/                  ← cardPool / sampleDeck / types
│   ├── stubs/                 ← engineStub
│   ├── state/                 ← zustand 3 store
│   ├── router/                ← useHashRoute / useGlobalShortcuts / routes
│   └── styles/meta.css        ← グローバルリセット + meta-* CSS
└── tests/e2e/                 ← Playwright spec
```

## vite.config.meta.ts (核要素)

```ts
export default defineConfig({
  root: resolve(__dirname, '.'),
  plugins: [react()],
  server: { port: 5174, strictPort: true, host: 'localhost' },
  build: { outDir: resolve(__dirname, '../dist-meta'), emptyOutDir: true },
  resolve: { alias: { '@meta': resolve(__dirname, 'src') } },
});
```

`strictPort: true` で 5174 占有時に fallback せずエラー (誤起動防止)。
`outDir` をリポジトリルート `dist-meta/` に分離 (既存 `dist/` と非衝突)。
`@meta` alias は既存 `@/` (src/) と非衝突。

## tsconfig.json (核要素)

ルートの `tsconfig.json` 継承せず独立:
- `target: ES2022` / `lib: [ES2022, DOM, DOM.Iterable]`
- `strict: true` + `noUncheckedIndexedAccess: true` + `noUnusedLocals/Parameters`
- `jsx: react-jsx` (React 19 自動 runtime)
- `paths: { "@meta/*": ["./src/*"] }`
- `include: ["src", "tests"]` (vite.config.meta.ts は除外、`__dirname` 衝突回避)

## package.json (ルート) 追加 script

既存 scripts は完全不変、下記のみ追加:

```jsonc
{
  "dev:meta":      "vite --config meta-app/vite.config.meta.ts",
  "build:meta":    "vite build --config meta-app/vite.config.meta.ts",
  "preview:meta":  "vite preview --config meta-app/vite.config.meta.ts",
  "test:meta:e2e": "playwright test --config meta-app/playwright.config.ts"
}
```

## 依存パッケージ

既存 `package.json` を共有 (追加なし):

- `react@19`, `react-dom@19`, `zustand@5`, `vite@8`, `@vitejs/plugin-react@6`
- `typescript@6`, `@playwright/test@1.60`

`zustand/middleware` の `persist` は zustand 同梱、追加不要。

## .gitignore

`dist-meta/` を追加 (既存 `dist/` と並列)。

## 起動手順

```
npm run dev          # 5173 既存ゲーム (現状通り、不変)
npm run dev:meta     # 5174 メタ UI
```

両方同時起動可能 (独立した Vite dev server)。

## index.html (核要素)

```html
<title>名探偵コナンTCG — Meta UI (Design Prototype)</title>
<div id="meta-root"></div>
<script type="module" src="/src/main.tsx"></script>
```

mount point は `#meta-root` (既存 `#root` との誤参照回避)。

## 関連

- 前: [00-overview.md](00-overview.md)
- 次: [02-design-system.md](02-design-system.md)
- 実装: `meta-app/` ディレクトリ全体
