// Track B compiler — canonical 正規化。
// shipped DSL と compile 出力を構造比較可能な同一形へ写す (oracle diff の土台)。
// 方針: key 昇順 / undefined 除去 / 関数は '<closure>' marker (custom カードは match 不可能として顕在化)。
// 等価形の吸収 (sequence[1つ]=atom 等) は B1 の文法設計と同時に導入する — B0 では構造完全一致のみ。

function canonicalize(v) {
  if (typeof v === 'function') return '<closure>';
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(canonicalize);
  const o = {};
  for (const k of Object.keys(v).sort()) {
    if (v[k] === undefined) continue;
    o[k] = canonicalize(v[k]);
  }
  return o;
}

// oracle の比較対象 = テキスト翻訳の産物のみ (abilities + keywords)。
// stat 系 (color/level/ap/lp/names/traits) は TSV → codegen が機械転記するため compiler の守備範囲外。
// keywords は順序無意味 (印字順 ≠ 意味) → sort で吸収。abilities は a1/a2 順序が意味を持つ → 保持。
function canonicalCard(def) {
  return canonicalize({
    id: def.id,
    keywords: [...(def.keywords || [])].sort(),
    abilities: def.abilities || [],
  });
}

function stableStringify(v) {
  return JSON.stringify(canonicalize(v));
}

function hasClosure(v) {
  return stableStringify(v).includes('"<closure>"');
}

// ---- 意味射影 (B1) ----
// oracle 比較は「意味を持つ field」のみ。以下は非意味 metadata として落とす:
//   id          — カード内通し名 (a1/a2)。shipped で同一テキストでも a1/a2 が揺れる実測 (B01008=a2 / B01029=a1)
//   name        — 表示名のみ
//   description — 公式テキスト転記。shipped で注釈除去・文末「。」付加の揺れがある
//   ruleRefs    — ドキュメント参照
// それ以外 (type/scope/trigger/condition/cost/limit/effect/continuousModifier) は全て比較対象。
// abilities の配列順は意味を持ちうる (rules/15 同時発動の既定解決順・UI 表示順) — 保持して比較する。
const NON_SEMANTIC_ABILITY_KEYS = ['id', 'name', 'description', 'ruleRefs'];

// ---- 意味等価 encoding の正規化 (B3-1, 2026-07-02) ----
// shipped 実測で「結果同値」と engine 直読で証明した encoding 揺れのみ、射影段階で単一形へ吸収する。
// ⚠ 規則追加の条件 = engine 証明脚注必須。card/engine の挙動には一切影響しない (compiler 比較射影のみ)。
// 証明されていない位置 (sequence 途中・conditional 枝等) では正規化しない — 差が real な文脈を
// 潰すと oracle が挙動差を match と誤認するため (BUG-145/158 系)。
//
// N1 singleton-choice unwrap: {kind:'choice', options:[X]} ≡ X (任意深度)。
//    根拠: effect/resolve-picks.ts choice 分岐は options.length>1 のみ human surface
//    (「options.length===1 (構造的単一 choice…) は従来通り (無傷)」コメント)、effect/resolver.ts run は
//    choiceIndex 未指定時 idx=0 で唯一 option を実行。chooser は modal 不発時どこからも参照されない。
//    singleton はどの深度でも modal を出さない → 任意位置で pass-through。
// N2 trigger.matcherCondition → condition lift (kind==='removedCharMatches' 限定):
//    triggered ability で ability.condition 不在のときのみ移す。
//    根拠: listeners/triggered.ts の全 3 経路 (handleHook / evidence:remove-by-action /
//    leave:to-remove-self) で両者は同一 baseCtx (triggerPayload 付)・同一地点 (queue 前) で連続評価され、
//    解決時の再評価は無い。kind 限定の理由: read/keyword.ts abilityIsShippu が matcherCondition
//    (enterOrderEquals) の存在自体を疾風分類に使う — lift すると挙動が変わる kind があるため whitelist。
// N3 charSetCard args.faceUp:false は省略と同値 → drop。
//    根拠: atom-handlers/char.ts が a.faceUp を素通しし下流読取は falsy 判定 (2026-07-02 BUG-162 session
//    C3 裁定: B07048 は意図的省略 + 挙動同一テスト有)。false と undefined は全読取で同値。
// N4 sceneSetState PA 短縮形 → 明示 pick 形へ展開 (effect-root 限定):
//    engine gate (atom-handlers/scene.ts: uid 不在 + player/state 文字列 + n|max) と同一判定で、
//    atom-pick-spec.ts buildShortFormPick と同一規則 (area 'scene' / sideDefault 'either' /
//    chooser=player / n→{min:n,max:n}, max→{min:0,max}) の展開。展開結果は paShortFormAwait が実行時に
//    組む pick と同一パラメータ = 明示形と同一挙動。effect-root 限定の理由: 短縮形 (dispatch 時 surface)
//    と明示形 (walk 時 pre-surface) は sequence 途中 (前段 mutation 後の候補差) や conditional 非成立枝
//    (BUG-145 eager-surface / BUG-158 rider) で挙動が分かれる — 差が出ない ability.effect 直下
//    (+ N1 unwrap 経由) のみ同値。

const SCENE_SET_STATE_SHORT_KEYS = new Set(['n', 'max', 'player', 'side', 'state', 'filter']);

function normalizeSceneSetStateShortForm(a) {
  // engine gate の mirror (atom-handlers/scene.ts atomSceneSetState 短縮形分岐)
  if (a.uid !== undefined) return a;
  // player は 'self' のみ (T2 semantic lens 裁定): substituteAtomPick は target.chooser を読まず、
  // pick 実行者 = opts.byPlayer — 短縮形は resolvePlayer(a.player)、明示形の queue 時は card.player (owner)。
  // 両者が一致するのは 'self' のみで、'opp' は挙動相違 (明示 chooser:'opp' は dead で owner-pick に化ける)。
  if (a.player !== 'self') return a;
  if (typeof a.state !== 'string') return a;
  const hasN = typeof a.n === 'number';
  const hasMax = typeof a.max === 'number';
  if (!hasN && !hasMax) return a;
  // 未知 arg / 関数値があれば正規化しない (mirror できない形は conflict として顕在化させる)
  for (const k of Object.keys(a)) {
    if (!SCENE_SET_STATE_SHORT_KEYS.has(k)) return a;
    if (typeof a[k] === 'function') return a;
  }
  const query = { area: 'scene', side: a.side ?? 'either' };
  if (a.filter && typeof a.filter === 'object') query.filter = a.filter;
  return {
    state: a.state,
    uid: '$pick',
    target: {
      kind: 'pick',
      chooser: a.player,
      n: hasN ? { min: a.n, max: a.n } : { min: 0, max: a.max },
      query,
    },
  };
}

function normalizeEffectNode(eff, atRoot) {
  if (!eff || typeof eff !== 'object' || Array.isArray(eff)) return eff;
  // N1: singleton choice は pass-through — root 性も透過する
  if (eff.kind === 'choice' && Array.isArray(eff.options) && eff.options.length === 1) {
    return normalizeEffectNode(eff.options[0], atRoot);
  }
  const out = { ...eff };
  if (out.kind === 'choice' && Array.isArray(out.options)) {
    out.options = out.options.map((o) => normalizeEffectNode(o, false));
  } else if ((out.kind === 'sequence' || out.kind === 'parallel' || out.kind === 'chain') && Array.isArray(out.steps)) {
    // chain も steps 再帰対象 (T2 edge-test lens 指摘: B09038 は chain 内に charSetCard faceUp:false を実在させる)
    out.steps = out.steps.map((s) => normalizeEffectNode(s, false));
  } else if (out.kind === 'replace' && out.with !== undefined) {
    out.with = normalizeEffectNode(out.with, false);
  } else if (out.kind === 'conditional') {
    if (out.then !== undefined) out.then = normalizeEffectNode(out.then, false);
    if (out.else !== undefined) out.else = normalizeEffectNode(out.else, false);
  } else if (out.kind === 'optional' && out.effect !== undefined) {
    out.effect = normalizeEffectNode(out.effect, false);
  } else if (out.kind === 'forEach' && out.do !== undefined) {
    out.do = normalizeEffectNode(out.do, false);
  } else if (out.kind === 'atom' && out.args && typeof out.args === 'object' && !Array.isArray(out.args)) {
    if (out.verb === 'charSetCard' && out.args.faceUp === false) {
      const rest = { ...out.args }; // N3
      delete rest.faceUp;
      out.args = rest;
    }
    if (atRoot && out.verb === 'sceneSetState') {
      out.args = normalizeSceneSetStateShortForm(out.args); // N4
    }
  }
  return out;
}

function semanticAbility(a) {
  const o = { ...a };
  for (const k of NON_SEMANTIC_ABILITY_KEYS) delete o[k];
  // N2 (whitelist: removedCharMatches のみ — 根拠は上部脚注)
  if (
    o.type === 'triggered' && o.trigger && typeof o.trigger === 'object'
    && o.trigger.matcherCondition && o.trigger.matcherCondition.kind === 'removedCharMatches'
    && o.condition === undefined
  ) {
    const trig = { ...o.trigger };
    o.condition = trig.matcherCondition;
    delete trig.matcherCondition;
    o.trigger = trig;
  }
  if (o.effect !== undefined) o.effect = normalizeEffectNode(o.effect, true);
  return canonicalize(o);
}

// N5 icon-disguise の配列位置は非意味 → 末尾へ stable-move (B3-1, 2026-07-02)。
//    根拠: engine の icon-disguise 消費は presence-scan の 2 箇所のみ — read/keyword.ts (変装 map:
//    ab.type==='icon-disguise') / flow/contact.ts (find(a=>a.type==='icon-disguise'))。triggered listener 等は
//    type!=='triggered' を skip するため、disguise と他 type の相対位置は挙動に関与しない。shipped の
//    authoring 位置は実測で揺れる (multi-ability 19 枚中 先頭 6 / 非先頭 13)。disguise 同士の相対順は
//    保持する (contact.ts find の first-of-type 意味を保存)。非 disguise 同士の相対順は従来通り意味を持つ。
function semanticCard(card) {
  const abilities = (Array.isArray(card.abilities) ? card.abilities : []).map(semanticAbility);
  const nonDisguise = abilities.filter((a) => a && a.type !== 'icon-disguise');
  const disguise = abilities.filter((a) => a && a.type === 'icon-disguise');
  return canonicalize({
    keywords: [...(card.keywords || [])].sort(),
    abilities: [...nonDisguise, ...disguise],
  });
}

module.exports = { canonicalize, canonicalCard, stableStringify, hasClosure, semanticAbility, semanticCard };
