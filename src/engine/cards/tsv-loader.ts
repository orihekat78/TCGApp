// engine.cards.tsv-loader — TSV ローダ (pure parseTsv のみ)
// rules: 02-deck-construction.md, 06-card-types.md, 19-special-rules.md, 20-color-and-switch.md
// spec: .claude/specs/cards-data/INDEX.md
//
// 設計メモ:
//   - .claude/specs/cards-data/<set-lowercase>/<kind>.tsv を読み TSV→CardDef[] に変換
//   - エスケープ規則: \\n → \n / \\t → \t / \\\\ → \\
//   - abilities は空配列で出力。Phase 5 Group B-E で共通クラス側から merge する
//   - color は単一値 (rules/20 に 2色MR の記述はあるが MVP データセットは単色)
//   - traits は '|' 区切り
//
//   - 旧 `loadSet(setCode)` は node:fs 依存があるため `./tsv-loader-fs.ts` に分離。
//     ブラウザバンドルから fs を切り離すため、ここでは parseTsv のみを export。

import type { CardDef } from '../types/index.js';

// ---------- エスケープ解除 ----------
// 注: 順序重要。\\\\ を先に処理しないと \\n / \\t の中の \ を誤変換する。
// state machine 方式で1パス処理する。
function unescapeCell(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === 'n') {
        out += '\n';
        i++;
      } else if (next === 't') {
        out += '\t';
        i++;
      } else if (next === '\\') {
        out += '\\';
        i++;
      } else {
        out += c; // 不明エスケープはそのまま
      }
    } else {
      out += c;
    }
  }
  return out;
}

// ---------- 行→カラム ----------

/* eslint-disable no-irregular-whitespace -- The BOM character is parsed literally from TSV input. */
type Row = Record<string, string>;

function parseRows(text: string): Row[] {
  // BOM 除去
  const cleaned = text.replace(/^﻿/, '');
  // 行分割 (TSV 内の改行はエスケープ済 \\n なので素朴に \n で分割可)
  const lines = cleaned.split('\n').filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split('\t');
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split('\t');
    const row: Row = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = unescapeCell(cells[j] ?? '');
    }
    rows.push(row);
  }
  return rows;
}

// ---------- title から names を抽出 ----------
// rules/19: '&' / '『 』' / '( )' の3パターンで分割名を持つカード。
// MVP では '&' のみ対応。'『 』' '( )' は将来のため TODO とする。
function extractNames(title: string): string[] {
  const names = [title];
  if (title.includes('&')) {
    for (const part of title.split(/[&＆]/).map(s => s.trim())) { // BUG-178: 全角＆対応
      if (part && !names.includes(part)) names.push(part);
    }
  }
  // TODO Phase 5: '『 』' / '( )' の分割対応
  return names;
}

// ---------- 数値パース (空欄を許容) ----------
function parseIntOrUndef(s: string | undefined): number | undefined {
  if (s === undefined || s === '') return undefined;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? undefined : n;
}

// ---------- traits / color パース ----------
function parseTraits(s: string): string[] {
  if (!s) return [];
  return s.split('|').map(t => t.trim()).filter(Boolean);
}

function parseColors(s: string): string[] {
  if (!s) return [];
  // 区切り想定: 半角 ',' / 全角 '・' / 全角 '、'
  // 元データは単色なので基本そのまま 1 要素。
  return s.split(/[,・、]/).map(c => c.trim()).filter(Boolean);
}

// ---------- 1 行 → CardDef ----------

function rowToCardDef(row: Row, kind: CardDef['kind']): CardDef {
  const cardNum = row['cardNum'];
  const cardId = row['cardId'];
  const title = row['title'] ?? '';
  const base: CardDef = {
    id: cardNum,
    no: `${cardId}/${cardNum}`,
    kind,
    names: extractNames(title),
    colors: parseColors(row['color'] ?? ''),
    traits: parseTraits(row['features'] ?? ''),
    rarity: row['rarity'] ?? '',
    flavor: row['flavor'] || undefined,
    imageUrl: row['imagePath'] ?? '',
    abilities: [],
    ruleRefs: [],
  };

  switch (kind) {
    case 'partner': {
      const lp = parseIntOrUndef(row['lp']);
      if (lp !== undefined) base.lp = lp;
      return base;
    }
    case 'character': {
      const lv = parseIntOrUndef(row['level']);
      const ap = parseIntOrUndef(row['ap']);
      const lp = parseIntOrUndef(row['lp']);
      if (lv !== undefined) base.level = lv;
      if (ap !== undefined) base.ap = ap;
      if (lp !== undefined) base.lp = lp;
      base.keywords = [];
      return base;
    }
    case 'event': {
      const lv = parseIntOrUndef(row['level']);
      if (lv !== undefined) base.level = lv;
      return base;
    }
    case 'case': {
      const lv = parseIntOrUndef(row['difficultyFirst']);
      // rules/01: 必要証拠数 = 先攻7 / 後攻6。difficultyFirst が先攻側の値。
      // caseLevel は「事件レベル」(rules/06). 先攻基準の数値を保持。
      if (lv !== undefined) base.caseLevel = lv;
      // TODO Phase 5: caseTraits は title 等から推定 (古城/婚活 等)
      base.caseTraits = [];
      return base;
    }
    default:
      return base;
  }
}

// ---------- public API ----------

/**
 * TSV テキスト本文をパースして CardDef[] を返す純粋関数。
 * テスト容易性のため `loadSet` から分離。
 */
export function parseTsv(text: string, kind: CardDef['kind']): CardDef[] {
  return parseRows(text).map(r => rowToCardDef(r, kind));
}

// 旧 loadSet は ./tsv-loader-fs.ts に移動。
