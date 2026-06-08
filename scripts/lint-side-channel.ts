// Phase 8-3: side-channel pattern 4 点配線 AST check
// 教訓 1 の能動化 (side-channel-pattern.md checklist)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_DIR = join(process.cwd(), 'src');
const STORE_PATH = join(SRC_DIR, 'ui', 'state', 'store.ts');
const DISPATCH_PATH = join(SRC_DIR, 'ui', 'hooks', 'useEngineDispatch.ts');
const APP_PATH = join(SRC_DIR, 'App.tsx');

// 2026-06-05: engine 内部 queue (UI modal 不要) を allowlist 化。
// 以下は __pending<Name> 形式だが UI 表示は行わない engine-internal な保管庫:
//   - EffectPickQueue: pending pick event の FIFO (apply-pick.ts) - dispatch が consume
//   - ChainContinuation: 中断中 sequence/chain の継続情報 (apply-pick.ts) - dispatch が consume
//   - ActionExpansion: action target expansion の bind (atom-handlers.ts) - candidates() が consume
//   - EffectChoiceResume: BUG-121 choice 再開 effect の holder (resolve-picks.ts) -
//     applyChoiceAndContinuation が consume (store/UI へは出ない。UI 露出は別チャネル EffectChoice 側)
// これらは「engine→dispatch 内部プラミング」であり、ユーザ向け modal mount を期待しない。
const ENGINE_INTERNAL_CHANNELS = new Set<string>([
  'EffectPickQueue',
  'ChainContinuation',
  'ActionExpansion',
  'EffectChoiceResume',
  // 2026-06-06 タスクC: optional 再開 effect の holder (resolve-picks.ts) -
  // applyOptionalAndContinuation が consume (store/UI へは出ない。UI 露出は別チャネル EffectOptional 側)
  'EffectOptionalResume',
  // 2026-06-07 BUG-114: cutin choice surface 時の ctx.bindings ($contact.*) 保持 (resolve-picks.ts) -
  // applyChoiceAndContinuation が resume ctx/queue へ復元 (EffectChoiceResume と対の engine-internal holder。UI へは出ない)
  'EffectChoiceBindings',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

function main(): void {
  const allFiles = walk(SRC_DIR);
  // __pending<Name>Side patterns 検出
  const channels = new Set<string>();
  for (const f of allFiles) {
    const s = readFileSync(f, 'utf-8');
    // Side suffix あり / 無し 両対応 (Hirameki / Misread は suffix 無し)
    for (const m of s.matchAll(/__pending([A-Z]\w+?)(?:Side)?(?=\W)/g)) {
      channels.add(m[1]);
    }
  }

  if (channels.size === 0) {
    console.log('[lint-side-channel] no __pendingXxxSide patterns found');
    return;
  }

  const store = readFileSync(STORE_PATH, 'utf-8');
  const dispatch = readFileSync(DISPATCH_PATH, 'utf-8');
  // App.tsx + Playmat.tsx 等 wrapper を含めて 1 つの文字列に結合 (mount は
  // 複数 component file に分散している可能性あり)
  const uiSearchSpace = [APP_PATH, join(SRC_DIR, 'ui', 'components', 'Playmat.tsx')]
    .filter((p) => { try { statSync(p); return true; } catch { return false; } })
    .map((p) => readFileSync(p, 'utf-8'))
    .join('\n');

  let errors = 0;
  let warns = 0;

  for (const name of channels) {
    console.log(`\n[side-channel: ${name}]`);
    // 2026-06-05: engine 内部 queue は UI 配線不要 → 4 点配線 check 全 skip
    if (ENGINE_INTERNAL_CHANNELS.has(name)) {
      console.log(`  [SKIP]  ${name} は engine-internal queue (UI 不要、allowlist 済)`);
      continue;
    }
    // 1. _drainPending<N> or _drainPending<N>Side export 存在 (suffix 両対応)
    const drainPattern = new RegExp(`_drainPending${name}(?:Side)?\\s*\\(`);
    const hasDrain = allFiles.some((f) => drainPattern.test(readFileSync(f, 'utf-8')));
    if (hasDrain) console.log(`  [OK]    _drainPending${name}(Side)? defined`);
    else { console.error(`  [ERROR] _drainPending${name}(Side)? が未定義`); errors++; }

    // 2. store に pending<N> field
    const lcName = name.charAt(0).toLowerCase() + name.slice(1);
    const storePattern = new RegExp(`pending${name}|pending${lcName}`, 'i');
    if (storePattern.test(store)) console.log(`  [OK]    store に pending${name} field`);
    else { console.error(`  [ERROR] store.ts に pending${name} field 無し`); errors++; }

    // 3. dispatch で drain + setPending 呼出 (Side suffix 両対応)
    const dispatchDrainOK = new RegExp(`_drainPending${name}(?:Side)?`).test(dispatch);
    const dispatchSetOK = new RegExp(`setPending${name}|setPending${lcName}`, 'i').test(dispatch);
    if (dispatchDrainOK && dispatchSetOK) console.log(`  [OK]    dispatch で drain + setPending 配線`);
    else { console.error(`  [ERROR] dispatch で drain or setPending 未配線`); errors++; }

    // 4. App.tsx + Playmat.tsx で対応 component 名 grep (柔軟、warn level)
    const appPattern = new RegExp(`${name}(?:er)?(?:Modal|Overlay|Picker)`, 'i');
    const appOK = appPattern.test(uiSearchSpace);
    if (appOK) console.log(`  [OK]    UI (App/Playmat) に ${name}* component 配線`);
    else { console.warn(`  [WARN]  UI (App/Playmat) に ${name}*Modal|Overlay|Picker mount 無し`); warns++; }
  }

  console.log(`\n[lint-side-channel] ${channels.size} channels / errors=${errors} / warns=${warns}`);
  if (errors > 0) process.exit(1);
}
main();
