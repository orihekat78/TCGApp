#!/usr/bin/env node
// 棚卸: 未実装カード (universe cardNum − registered) を mechanic signature で分類し size 順に出す。
// 決定論クラスタ。engine-gate spec / DEFERRED-INDEX の語彙に合わせたタグ付け。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const root = path.join(repoRoot, '.claude/specs/cards-data');

function parseArgs(argv) {
  let pkg;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--pkg') {
      pkg = argv[++i];
      if (!pkg) throw new Error('--pkg requires a package name');
    } else if (argv[i] === '--json') {
      json = true;
    } else {
      throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  return { pkg, json };
}

const args = parseArgs(process.argv.slice(2));
if (args.json) console.log = () => {};
const dumpPath = path.join(repoRoot, '.tmp', 'compiler', 'shipped-dsl.json');

// Always regenerate from ALL_CARDS. Do not resurrect the old
// .tmp/_registered-ids.json cache: it could silently omit spread variants.
execFileSync(
  process.execPath,
  [path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(repoRoot, 'scripts', 'compiler', 'dump-shipped.ts')],
  { cwd: repoRoot, stdio: ['ignore', 'ignore', 'pipe'] },
);
const shipped = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
if (!Array.isArray(shipped.cards)) throw new Error('fresh shipped dump has no cards array');
const reg = new Set(shipped.cards.map((card) => card.id));

// --- 未実装カード収集 ---
const cards = []; // {num, kind, title, color, level, text(全効果連結)}
const packages = fs.readdirSync(root).filter((pkg) => !args.pkg || pkg === args.pkg).sort();
if (args.pkg && packages.length === 0) throw new Error(`unknown package: ${args.pkg}`);
for (const pkg of packages) {
  const pdir = path.join(root, pkg);
  if (!fs.statSync(pdir).isDirectory()) continue;
  for (const f of fs.readdirSync(pdir).sort()) {
    if (!f.endsWith('.tsv')) continue;
    const kind = f.replace('.tsv', '');
    const lines = fs.readFileSync(path.join(pdir, f), 'utf8').split(/\r?\n/).filter(l => l.trim());
    const hdr = lines[0].split('\t');
    const I = (n) => hdr.indexOf(n);
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split('\t');
      const num = (c[0] || '').trim();
      if (!num || reg.has(num)) continue;
      const eff = c[I('effect')] || '';
      const cut = c[I('cutIn')] || '';
      const hir = c[I('hirameki')] || '';
      const hen = c[I('henso')] || '';
      cards.push({
        num, kind, pkg,
        title: (c[I('title')] || '').trim(),
        color: (c[I('color')] || '').trim(),
        level: (c[I('level')] || '').trim(),
        text: [eff, cut, hir, hen].join(' ‖ '),
        eff, cut, hir, hen,
      });
    }
  }
}
cards.sort((a, b) => a.num.localeCompare(b.num));

// --- signature 定義 ---
// status: 'engine-in' = engine に既にある (出荷済 pattern) / 'gate' = engine 拡張 or DEFER 要 / 'cost' = 既存 cost 機構
// tag は複数該当可。primary は dominant gate を後で推定。
const SIG = [
  // ---- trigger hook 由来 (engine-gate spec: card-triggerable hook は 9個のみ) ----
  { tag: 'leave-trigger', status: 'gate', re: /(現場(から)?リムーブ(される|時)|リムーブされたとき)/, note: '【現場リムーブ時】/leave hook (cluster15/16 で一部解禁: removal-observer)' },
  { tag: 'state-to-sleep', status: 'gate', re: /(スリープになったとき|スリープになるたび)/, note: 'active→sleep state:change hook 不在 (B03008 DEFER)' },
  { tag: 'opp-evidence-removed', status: 'gate', re: /相手の(裏向きの)?証拠(を1つ|が).*(リムーブ|得)/, note: '相手証拠除去 observer hook 不在 (B02062)' },
  { tag: 'reasoning-react', status: 'gate', re: /(が|は)?推理(した|する)とき/, note: '推理 react hook 不在 (misread 専用のみ)' },
  { tag: 'enter-trigger', status: 'engine-in', re: /【登場時/, note: 'enter hook 有 (実装多数)' },
  { tag: 'hirameki', status: 'engine-in', re: /【?ヒラメキ/, note: 'hirameki hook 有' },
  { tag: 'cutin', status: 'engine-in', re: /【?カットイン/, note: 'cutin 有 (AP+ 等)' },
  { tag: 'henso', status: 'engine-in', re: /【?変装/, note: '変装 有' },
  { tag: 'shippu', status: 'engine-in', re: /疾風/, note: '疾風 enter-order trigger 有' },
  { tag: 'declared', status: 'engine-in', re: /【宣言】/, note: '宣言能力 有' },
  { tag: 'phase-end', status: 'engine-in', re: /(ターン終了時|メインフェイズ(開始|終了)時|エンドフェイズ)/, note: 'phase:end hook 有 (一部)' },
  { tag: 'action-trigger', status: 'engine-in', re: /(アクションしたとき|アクションする|コンタクトしたとき|ガードされた)/, note: 'action:* hook 有' },

  // ---- evidence flip 系 ----
  { tag: 'evidence-facedown(表→裏)', status: 'gate', re: /表向きの証拠を.{0,8}裏向き/, note: 'flipFaceDown verb 不在 = 次弾候補 (B05013 等)' },
  { tag: 'evidence-faceup-cost(解決編)', status: 'cost', re: /裏向きの証拠を.{0,4}つ.{0,2}表向き/, note: '既存 flipFaceUpEvidence cost で対応 (効果側は別 gate)' },
  { tag: 'evidence-flip-faceup(effect)', status: 'engine-in', re: /(裏向きの)?証拠を.{0,10}表向きにする/, note: '㊻ evidenceFlip で解禁済 (effect)' },

  // ---- verb / 効果 gate ----
  { tag: 'setAP/LP/level=N', status: 'gate', re: /元の(AP|LP|レベル)を.{0,3}(にする|0)/, note: 'charSetAP/LP throw stub (override=0 のみ可)' },
  { tag: 'aura-buff-other', status: 'partial', re: /(現場の|すべての|全ての|相手の現場).{0,20}(AP|LP)\s*[＋+]/, note: 'continuous 他者 buff = cluster13 で一部解禁 (要 certify)' },
  { tag: 'event-as-evidence', status: 'gate', re: /このカードを.{0,6}証拠として(得る|加える)/, note: 'event→evidence verb 不在' },
  { tag: 'set-event-to-char', status: 'gate', re: /キャラにセットする/, note: 'set-event + host-continuous 機構不在 (B02013 等)' },
  { tag: 'variable-count(好きな数/枚)', status: 'gate', re: /好きな(数|枚数)/, note: '可変 count atom 不在' },
  { tag: 'mr', status: 'gate', re: /(ミステリーレア|【?MR)/, note: 'MR 能力①② 未配線 (rules/18)' },
  { tag: 'mustGuard', status: 'gate', re: /必ずガード/, note: 'guard 強制 (AI/UI 同時追従要)' },
  { tag: 'cannot-guard-grant', status: 'gate', re: /ガードできない/, note: 'ブレット付与は可 (keyword)。別文脈は要確認' },

  // ---- condition gate ----
  { tag: 'hand-count-cond', status: 'gate', re: /手札が?.{0,3}枚(以下|以上)/, note: '手札枚数 condition 不在 (custom TS のみ)' },
  { tag: 'remove-area-count', status: 'gate', re: /リムーブエリア.{0,8}枚(以下|以上)/, note: 'リムーブ総数 condition 不在' },
  { tag: 'deck-mill-gated-chain', status: 'gate', re: /デッキ(の(カード)?)?(を)?上から.{0,3}枚(を)?リムーブ.{0,6}そうした場合/, note: 'mill-gated chain (実 mill 結果参照)' },
  { tag: 'deck-look-select', status: 'engine-in', re: /(デッキ(の(カード)?)?(を)?)?上から.{0,3}枚(を)?(見て|公開)/, note: 'look-top-N-select 有' },
];

// --- タグ付け ---
const tagCount = {};
const tagCards = {};
const untagged = [];
for (const card of cards) {
  const t = card.text;
  const matched = [];
  for (const s of SIG) {
    if (s.re.test(t)) matched.push(s.tag);
  }
  card.tags = matched;
  if (matched.length === 0) untagged.push(card);
  for (const tag of matched) {
    tagCount[tag] = (tagCount[tag] || 0) + 1;
    (tagCards[tag] = tagCards[tag] || []).push(card.num);
  }
}

// --- 出力 ---
const statusOf = {};
for (const s of SIG) statusOf[s.tag] = { status: s.status, note: s.note };

console.log('=== 未実装カード総数:', cards.length, '===\n');
console.log('--- mechanic signature 別 (size 順、複数該当あり) ---');
const ranked = Object.entries(tagCount).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
for (const [tag, n] of ranked) {
  const st = statusOf[tag];
  console.log(`${String(n).padStart(4)}  [${st.status.padEnd(9)}] ${tag.padEnd(28)} ${st.note}`);
}
console.log(`\n  (untagged = ${untagged.length})`);

// gate 系のみ集計
console.log('\n--- engine 拡張/DEFER 要 (status=gate) のみ size 順 ---');
for (const [tag, n] of ranked) {
  if (statusOf[tag].status === 'gate') {
    console.log(`${String(n).padStart(4)}  ${tag.padEnd(28)} ${statusOf[tag].note}`);
  }
}

// --- 真の yield: その gate が唯一の blocker のカード数 ---
// blocking = status gate|partial。non-blocking = engine-in|cost。
const isBlocking = (tag) => ['gate', 'partial'].includes(statusOf[tag]?.status);
const soleGateYield = {};
const soleGateCards = {};
const multiGate = []; // 2つ以上の blocking gate
for (const card of cards) {
  const blockers = card.tags.filter(isBlocking);
  if (blockers.length === 1) {
    const g = blockers[0];
    soleGateYield[g] = (soleGateYield[g] || 0) + 1;
    (soleGateCards[g] = soleGateCards[g] || []).push({ num: card.num, title: card.title, eff: card.eff.slice(0, 80) });
  } else if (blockers.length >= 2) {
    multiGate.push({ num: card.num, blockers });
  }
}
// untagged で blocking 0 = clean 候補 (engine-in タグのみ or タグ無し)
const cleanCards = cards.filter(c => c.tags.filter(isBlocking).length === 0);

console.log('\n=== 真の yield: 単一 gate が唯一 blocker (= clean cluster 候補) ===');
const sgRanked = Object.entries(soleGateYield).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
for (const [tag, n] of sgRanked) {
  console.log(`${String(n).padStart(4)}  ${tag.padEnd(28)} ${statusOf[tag].note}`);
}
console.log(`\n  multi-gate (2+ blocker、要個別判断): ${multiGate.length}`);
console.log(`  blocking gate 無し (全句 engine-in or untagged): ${cleanCards.length}`);

if (args.json) {
  process.stdout.write(`${JSON.stringify({
    pkg: args.pkg || null,
    registered: reg.size,
    total: cards.length,
    cards: cards.map(({ num, kind, pkg, tags }) => ({ num, kind, pkg, tags })),
    tagCount: Object.fromEntries(ranked),
    soleGateYield: Object.fromEntries(sgRanked),
    multiGate: multiGate.sort((a, b) => a.num.localeCompare(b.num)),
    cleanCards: cleanCards.map(({ num, kind, pkg, tags }) => ({ num, kind, pkg, tags })),
    untagged: untagged.map(({ num, kind, pkg }) => ({ num, kind, pkg })),
  })}\n`);
}
