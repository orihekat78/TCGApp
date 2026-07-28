import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// spec: .claude/specs/meta-ui/01-project-setup.md
export default defineConfig({
  root: resolve(__dirname, '.'),
  publicDir: resolve(__dirname, '../public'),
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    host: '127.0.0.1',
  },
  build: {
    outDir: resolve(__dirname, '../dist-meta'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      // 5174 専用エイリアス
      '@meta': resolve(__dirname, 'src'),
      // Phase 11: src/ 配下を import 経由で再利用するため、既存 5173 と同じ '@' エイリアスを定義
      '@': resolve(__dirname, '../src'),
    },
  },
});
