// spec: .claude/specs/meta-ui/14-tutorial-complete.md + 15-tutorial-lesson-viewer.md
// 公式ルールマニュアル Ver 2.4 (commmune 転載) + 公式「初めての方へ」を参考に
// Phase 16: 章単位 → ステップ単位 33 図解へ分解。STEP_ILLUSTRATIONS レジストリを export

import type { ReactNode } from 'react';
import { T, shade } from '../../shared/tokens';
import { MetaCard } from '../../shared/MetaCard';
import { CARD_POOL } from '../../data/cardPool';
import type { CardDef } from '../../data/types';

// ============================================================================
// 共通プリミティブ
// ============================================================================

function Panel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      padding: '18px 20px',
      background: 'linear-gradient(180deg, rgba(13,38,64,0.85), rgba(13,38,64,0.55))',
      border: `1px solid rgba(78,195,255,0.25)`, borderRadius: 6,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children, accent = T.gold }: { children: ReactNode; accent?: string }) {
  return (
    <div style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 800, color: accent, letterSpacing: '0.28em' }}>
      {children}
    </div>
  );
}

function TermRow({ term, desc }: { term: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '4px 0', borderBottom: '1px solid rgba(78,195,255,0.08)' }}>
      <div style={{ width: 96, fontFamily: T.fontJp, fontSize: 12, fontWeight: 700, color: T.gold, flexShrink: 0 }}>{term}</div>
      <div style={{ flex: 1, fontSize: 11, color: T.textSecondary, lineHeight: 1.45 }}>{desc}</div>
    </div>
  );
}

function PointBox({ children, accent = T.neonBlue }: { children: ReactNode; accent?: string }) {
  return (
    <div style={{
      padding: '11px 13px',
      background: `linear-gradient(135deg, ${accent}22, transparent)`,
      border: `1px solid ${accent}55`, borderRadius: 4, display: 'flex', gap: 9,
    }}>
      <div style={{
        width: 26, height: 26, flexShrink: 0,
        background: accent, color: '#0a1a28', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.fontSerif, fontWeight: 900, fontSize: 15,
      }}>!</div>
      <div>
        <div style={{ fontFamily: T.fontMono, fontSize: 9, color: accent, letterSpacing: '0.2em' }}>POINT</div>
        <div style={{ fontSize: 12, color: T.textPrimary, marginTop: 2, lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );
}

function WarnBox({ children }: { children: ReactNode }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: `linear-gradient(180deg, ${T.red}22, ${T.red}08)`,
      border: `1.5px solid ${T.red}88`, borderRadius: 4, textAlign: 'center',
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.red, letterSpacing: '0.3em' }}>⚠ WARNING</div>
      <div style={{ fontFamily: T.fontSerif, fontSize: 15, fontWeight: 800, color: T.red, marginTop: 4 }}>{children}</div>
    </div>
  );
}

function Arrow({ down }: { down?: boolean }) {
  return (
    <div style={{ textAlign: 'center', color: T.gold, fontFamily: T.fontSerif, fontSize: 20, fontWeight: 900 }}>
      {down ? '↓' : '→'}
    </div>
  );
}

// ============================================================================
// ch1 — 基本ルール
// ============================================================================

function Ch1Deck() {
  return (
    <Panel>
      <SectionLabel>VISUAL · デッキの構成</SectionLabel>
      <div style={{
        padding: '16px', background: 'rgba(0,0,0,0.45)',
        border: `1px solid ${T.gold}33`, borderRadius: 4,
        display: 'flex', gap: 10, alignItems: 'stretch', justifyContent: 'center',
      }}>
        <DeckPile label="メインデッキ" count="40" accent={T.neonBlue} big />
        <span style={{ alignSelf: 'center', fontFamily: T.fontSerif, fontSize: 18, color: T.gold }}>+</span>
        <DeckPile label="パートナー" count="1" accent={T.gold} />
        <span style={{ alignSelf: 'center', fontFamily: T.fontSerif, fontSize: 18, color: T.gold }}>+</span>
        <DeckPile label="事件" count="1" accent={T.red} />
        <span style={{ alignSelf: 'center', fontFamily: T.fontSerif, fontSize: 18, color: T.gold }}>=</span>
        <DeckPile label="合計" count="42" accent={T.green} big />
      </div>
      <div>
        <SectionLabel accent={T.textMuted}>KEY TERMS</SectionLabel>
        <div style={{ marginTop: 6 }}>
          <TermRow term="メイン 40 枚" desc="キャラ + イベント。ちょうど 40 枚で構築する" />
          <TermRow term="同 ID 上限" desc="同じカードは最大 3 枚まで (絵柄違いも ID が同じなら同一)" />
          <TermRow term="パートナー / 事件" desc="デッキ 40 枚には含めない (専用エリアに配置)" />
        </div>
      </div>
      <PointBox>デッキ 40 + パートナー 1 + 事件 1 = 計 42 枚で 1 セット (rules/02)。</PointBox>
    </Panel>
  );
}

function DeckPile({ label, count, accent, big }: { label: string; count: string; accent: string; big?: boolean }) {
  return (
    <div style={{
      flex: big ? 1.4 : 1, padding: '12px 8px', textAlign: 'center',
      background: `${accent}22`, border: `1.5px solid ${accent}66`, borderRadius: 4,
    }}>
      <div style={{ fontFamily: T.fontSerif, fontSize: big ? 30 : 24, fontWeight: 900, color: accent, lineHeight: 1 }}>{count}</div>
      <div style={{ fontFamily: T.fontJp, fontSize: 10, color: T.textSecondary, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Ch1Areas() {
  return (
    <Panel>
      <SectionLabel>VISUAL · 場の 8 エリア</SectionLabel>
      <div style={{ padding: '16px 12px', background: 'rgba(0,0,0,0.45)', border: `1px solid ${T.gold}33`, borderRadius: 4 }}>
        <ZoneLabel>OPP · 相手陣</ZoneLabel>
        <ZoneRow>
          <Zone label="現場" color={T.purple} sub="≤ 5 枚" />
          <Zone label="パートナー" color={T.gold} sub="1 枚" />
          <Zone label="事件" color={T.red} sub="1 枚" />
        </ZoneRow>
        <ZoneRow>
          <Zone label="FILE" color={T.neonBlue} sub="毎ターン +2 (初手1)" />
          <Zone label="証拠" color={T.gold} sub="勝利の鍵" />
          <Zone label="デッキ" color={T.textMuted} sub="40 枚" />
          <Zone label="リムーブ" color={T.textMuted} sub="使用済" />
        </ZoneRow>
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${T.gold}, transparent)`, margin: '12px 0' }} />
        <ZoneLabel accent={T.green}>YOU · 自陣 (鏡像)</ZoneLabel>
        <ZoneRow>
          <Zone label="現場" color={T.green} sub="≤ 5 枚" />
          <Zone label="パートナー" color={T.gold} sub="1 枚" />
          <Zone label="手札" color={T.gold} sub="非公開" />
        </ZoneRow>
      </div>
      <div>
        <SectionLabel accent={T.textMuted}>KEY TERMS</SectionLabel>
        <div style={{ marginTop: 6 }}>
          <TermRow term="現場" desc="キャラを配置。最大 5 枚まで" />
          <TermRow term="FILE" desc="オートで自動的に置かれる。通常追加は 7 枚で解決編へ。カード固有のアシスト条件とは別" />
          <TermRow term="証拠" desc="勝利条件 (先攻 7 / 後攻 6)。裏向きで重ねる" />
          <TermRow term="リムーブ" desc="使用済 / 失われたカード置き場" />
        </div>
      </div>
      <PointBox>現場・手札以外のエリアに枚数上限はない (rules/03)。</PointBox>
    </Panel>
  );
}

function ZoneLabel({ children, accent = T.purple }: { children: ReactNode; accent?: string }) {
  return (
    <div style={{ fontFamily: T.fontMono, fontSize: 10, color: accent, letterSpacing: '0.22em', marginBottom: 6, fontWeight: 800 }}>
      {children}
    </div>
  );
}
function ZoneRow({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>{children}</div>;
}
function Zone({ label, color, sub }: { label: string; color: string; sub: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 78, padding: '7px 8px', textAlign: 'center',
      background: `${color}22`, border: `1.5px solid ${color}66`, borderRadius: 3,
    }}>
      <div style={{ fontFamily: T.fontJp, fontSize: 11, fontWeight: 700, color }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted, letterSpacing: '0.1em', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ============================================================================
// ch2 — カードの読み方 (CardAnnotated)
// ============================================================================

interface Callout { num: number; label: string; side: 'l' | 'r' }

function CardAnnotated({ card, badge, callouts }: { card: CardDef; badge?: 'partner' | 'case'; callouts: Callout[] }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 150px 1fr', gap: 0,
      alignItems: 'center', padding: '14px 6px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', paddingRight: 8 }}>
        {callouts.filter((c) => c.side === 'l').map((c) => <CalloutPill key={c.num} num={c.num} label={c.label} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.7))' }}>
        <MetaCard card={card} w={140} badge={badge} hoverable={false} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-start', paddingLeft: 8 }}>
        {callouts.filter((c) => c.side === 'r').map((c) => <CalloutPill key={c.num} num={c.num} label={c.label} />)}
      </div>
    </div>
  );
}

function CalloutPill({ num, label }: { num: number; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '4px 7px',
      background: 'rgba(0,0,0,0.5)', border: `1px solid ${T.gold}55`, borderRadius: 3, maxWidth: 150,
    }}>
      <div style={{
        width: 18, height: 18, flexShrink: 0,
        background: T.gold, color: '#1a1208', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.fontMono, fontWeight: 800, fontSize: 10,
      }}>{num}</div>
      <div style={{ fontFamily: T.fontJp, fontSize: 10, color: T.textPrimary, lineHeight: 1.25 }}>{label}</div>
    </div>
  );
}

function cardCh2(num: string): CardDef {
  return CARD_POOL.find((c) => c.num === num) ?? CARD_POOL[0]!;
}

function Ch2Char() {
  return (
    <Panel>
      <SectionLabel accent={T.neonBlue}>キャラカード</SectionLabel>
      <div style={{ fontSize: 11, color: T.textSecondary }}>「現場」に登場して「推理」や「アクション」を行う主役。</div>
      <CardAnnotated card={cardCh2('D08005')} callouts={[
        { num: 1, label: 'カードの種類 / Lv', side: 'l' },
        { num: 3, label: 'カード名', side: 'l' },
        { num: 6, label: '能力 (効果)', side: 'l' },
        { num: 2, label: 'カードの色 (青)', side: 'r' },
        { num: 4, label: 'AP (攻撃力)', side: 'r' },
        { num: 5, label: 'LP (推理=証拠枚数)', side: 'r' },
        { num: 7, label: 'カードNo', side: 'r' },
      ]} />
      <PointBox>AP はアクション (攻撃) で比較、LP は推理で得る証拠の枚数 (rules/06)。</PointBox>
    </Panel>
  );
}

function Ch2Event() {
  return (
    <Panel>
      <SectionLabel accent={T.purple}>イベントカード</SectionLabel>
      <div style={{ fontSize: 11, color: T.textSecondary }}>多彩な効果を発揮する使い切りのカード。使用後リムーブへ。</div>
      <CardAnnotated card={cardCh2('D11019')} callouts={[
        { num: 1, label: 'カードの種類 / Lv', side: 'l' },
        { num: 3, label: 'カード名', side: 'l' },
        { num: 2, label: 'カードの色', side: 'r' },
        { num: 4, label: '能力 (中央テキスト)', side: 'r' },
        { num: 5, label: 'カードNo', side: 'r' },
      ]} />
      <PointBox accent={T.purple}>Lv が FILE 枚数以下なら手札から使用可能 (rules/12)。</PointBox>
    </Panel>
  );
}

function Ch2Case() {
  return (
    <Panel>
      <SectionLabel accent={T.red}>事件カード</SectionLabel>
      <div style={{ fontSize: 11, color: T.textSecondary }}>あなたが解決すべき事件を表す。事件編 → 解決編 に変化。</div>
      <CardAnnotated card={cardCh2('D08026')} badge="case" callouts={[
        { num: 2, label: 'カードの色', side: 'l' },
        { num: 3, label: 'カード名 (事件名)', side: 'l' },
        { num: 1, label: 'カードの種類', side: 'r' },
        { num: 4, label: '事件レベル (=必要証拠数)', side: 'r' },
        { num: 5, label: '事件編 / 解決編 能力', side: 'r' },
      ]} />
      <PointBox accent={T.red}>事件レベル分の証拠を集めて解決を狙う。先攻 7 / 後攻 6 (rules/01)。</PointBox>
    </Panel>
  );
}

function Ch2Partner() {
  return (
    <Panel>
      <SectionLabel>パートナーカード</SectionLabel>
      <div style={{ fontSize: 11, color: T.textSecondary }}>あなたの相棒。事件解決に協力してくれるゲームの中心。</div>
      <CardAnnotated card={cardCh2('D08001')} badge="partner" callouts={[
        { num: 2, label: 'カードの色', side: 'l' },
        { num: 3, label: 'カード名', side: 'l' },
        { num: 1, label: 'カードの種類 (P)', side: 'r' },
        { num: 4, label: 'LP (推理=証拠枚数)', side: 'r' },
        { num: 5, label: '能力【アシスト】【事件解決】', side: 'r' },
        { num: 6, label: 'カードNo', side: 'r' },
      ]} />
      <PointBox>全パートナー共通で【アシスト】【事件解決】を持つ (rules/06, 13)。</PointBox>
    </Panel>
  );
}

// ============================================================================
// ch3 — ゲーム開始からターン進行
// ============================================================================

function Ch3Opening() {
  const steps: [string, string][] = [
    ['①', '事件 / パートナーを裏向きで配置'],
    ['②', 'デッキをシャッフル'],
    ['③', '先攻を決定 (じゃんけん等)'],
    ['④', '各 5 枚ドロー'],
    ['⑤', 'マリガン 1 回まで (先攻→後攻)'],
    ['⑥', '事件 / パートナーを表向き'],
    ['🎮', 'ゲームスタート'],
  ];
  return (
    <Panel>
      <SectionLabel>VISUAL · 開幕シーケンス</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 12px', background: 'rgba(0,0,0,0.4)', borderRadius: 4 }}>
        {steps.map(([n, txt]) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
            <span style={{ width: 26, fontFamily: T.fontSerif, fontSize: 15, color: T.gold, fontWeight: 800 }}>{n}</span>
            <span style={{ fontSize: 12, color: T.textPrimary }}>{txt}</span>
          </div>
        ))}
      </div>
      <div>
        <SectionLabel accent={T.textMuted}>KEY TERMS</SectionLabel>
        <div style={{ marginTop: 6 }}>
          <TermRow term="マリガン" desc="手札から好きな枚数をデッキに戻し、デッキをシャッフルして同数を引き直す (1 ゲーム 1 回、先攻が先に決定)" />
        </div>
      </div>
      <PointBox>じゃんけんに勝った方が先攻。先攻は必要証拠が 7 枚 (rules/04)。</PointBox>
    </Panel>
  );
}

function Ch3Phases() {
  return (
    <Panel>
      <SectionLabel>VISUAL · 3 フェイズ</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PhaseBox label="AUTO" jp="オートフェイズ" accent={T.green}
          desc="パートナー・現場をアクティブ (アシスト中のパートナーは戻す / スタンは代わりにスリープ) → 1 ドロー → FILE 2 枚を 1 枚ずつ最新が上に (先攻初手は 1 枚)" />
        <Arrow down />
        <PhaseBox label="MAIN" jp="メインフェイズ" accent={T.gold}
          desc="手札使用 / ネクストヒント / 推理 / アクション / ガード / 宣言能力 を好きな順で" />
        <Arrow down />
        <PhaseBox label="END" jp="エンドフェイズ" accent={T.purple}
          desc="ターン終了時能力 → 効果切れ → 相手のターンへ" />
      </div>
      <PointBox>先攻 1 ターン目はオートで FILE が 1 枚だけ (rules/05 例外)。</PointBox>
      <PointBox accent={T.gold}>メイン: 手札の使用は 1 ターン 1 回 (NH 後は不可)。推理・アクションは名乗り状態では不可 (迅速・突撃で例外)。行動中は割り込み不可 (rules/05)。</PointBox>
    </Panel>
  );
}

function PhaseBox({ label, jp, accent, desc }: { label: string; jp: string; accent: string; desc: string }) {
  return (
    <div style={{ padding: '10px 12px', background: `${accent}22`, border: `1.5px solid ${accent}`, borderRadius: 4 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: T.fontMono, fontSize: 11, color: accent, fontWeight: 800, letterSpacing: '0.2em' }}>{label}</span>
        <span style={{ fontFamily: T.fontJp, fontSize: 13, fontWeight: 700, color: T.textPrimary }}>{jp}</span>
      </div>
      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4, lineHeight: 1.4 }}>{desc}</div>
    </div>
  );
}

// ============================================================================
// ch4 — キャラ行動とリソース管理
// ============================================================================

function Ch4Reasoning() {
  return (
    <Panel>
      <SectionLabel accent={T.neonBlue}>推理</SectionLabel>
      <div style={{ padding: '12px', background: 'rgba(0,0,0,0.45)', border: `1px solid ${T.neonBlue}33`, borderRadius: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Token label="キャラ" color={T.blue} sub="アクティブ" />
          <Arrow />
          <Token label="スリープ" color={T.stateSleep} sub="横向き" />
          <Arrow />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: T.fontSerif, fontSize: 22, fontWeight: 900, color: T.gold }}>+LP</div>
            <div style={{ fontFamily: T.fontMono, fontSize: 9, color: T.textMuted }}>証拠を獲得</div>
          </div>
        </div>
      </div>
      <WarnBox>LP ≤ 0 では証拠を 1 つも得られない</WarnBox>
      <PointBox>アクティブなキャラ / パートナーをスリープし、LP 枚分の証拠を得る。名乗り状態 (登場ターン) / スリープ状態のキャラは推理できない (rules/11)。</PointBox>
    </Panel>
  );
}

function Ch4Action() {
  return (
    <Panel>
      <SectionLabel accent={T.red}>アクション + ガード</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', background: 'rgba(0,0,0,0.45)', border: `1px solid ${T.red}33`, borderRadius: 4 }}>
        {[
          ['①', 'アクション宣言 — スリープ/スタンの相手キャラ or 証拠ある事件を対象に、自キャラをスリープ'],
          ['②', 'ガード判定 — 相手はアクティブキャラ 1 枚で防御可'],
          ['③', 'コンタクト発生 (AP 比べ) or 証拠処理'],
        ].map(([n, t]) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 22, fontFamily: T.fontSerif, fontSize: 14, color: T.red, fontWeight: 800 }}>{n}</span>
            <span style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.4 }}>{t}</span>
          </div>
        ))}
      </div>
      <PointBox accent={T.red}>アクティブな相手キャラ・証拠 0 の事件は対象にできない。名乗り状態 (登場ターン) は不可、突撃 / 迅速 で例外 (rules/07-08)。</PointBox>
    </Panel>
  );
}

function Ch4Contact() {
  return (
    <Panel>
      <SectionLabel>コンタクト (AP 比べ)</SectionLabel>
      <div style={{ padding: '14px', background: 'rgba(0,0,0,0.45)', border: `1px solid ${T.gold}33`, borderRadius: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <MiniChar color={T.red} name="安室透" ap={7} />
          <div style={{ fontFamily: T.fontSerif, fontSize: 20, color: T.gold, fontWeight: 900 }}>vs</div>
          <MiniChar color={T.blue} name="灰原哀" ap={6} />
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: T.textSecondary, textAlign: 'center', lineHeight: 1.5 }}>
          7 ≥ 6 → 灰原哀 を <strong style={{ color: T.red }}>リムーブ</strong><br />
          <span style={{ fontSize: 10, color: T.textMuted }}>AP が同値以上なら対象をリムーブ (同値でもリムーブ)</span>
        </div>
      </div>
      <PointBox>AP の低い側が 1 番目、高い側が 2 番目に行動 (カットイン/変装)。AP 同値なら非ターンプレイヤー (アクション対象側) が 1 番目 (rules/08)。</PointBox>
    </Panel>
  );
}

function Ch4NextHint() {
  return (
    <Panel>
      <SectionLabel>ネクストヒント</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px', background: 'rgba(0,0,0,0.45)', border: `1px solid ${T.gold}33`, borderRadius: 4 }}>
        <FlowStep n="1" text="FILE 最上部の 1 枚を手札に加える" />
        <Arrow down />
        <FlowStep n="2" text="FILE 枚数以下のレベルの手札カードを 1 枚 即使用" />
      </div>
      <PointBox>1 ターンに何度でも使用可 (FILE が尽きるまで)。1 で加えたカードは判定 FILE 枚数に数えず使える。NH で登場したキャラは同ターン登場扱い (名乗り状態で推理不可、迅速/突撃はアクション可) (rules/12)。</PointBox>
    </Panel>
  );
}

function Ch4Refresh() {
  return (
    <Panel>
      <SectionLabel>リフレッシュ</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px', background: 'rgba(0,0,0,0.45)', border: `1px solid ${T.gold}33`, borderRadius: 4 }}>
        <FlowStep n="1" text="自分のデッキが 0 枚になった瞬間" />
        <Arrow down />
        <FlowStep n="2" text="リムーブエリアをシャッフルしてデッキへ" />
        <Arrow down />
        <FlowStep n="3" text="相手は証拠を 1 つ獲得" />
      </div>
      <WarnBox>リムーブが 0 枚でリフレッシュ → 即敗北</WarnBox>
      <PointBox accent={T.red}>デッキ切れ管理は重要なリソース戦略 (rules/14)。</PointBox>
    </Panel>
  );
}

function FlowStep({ n, text }: { n: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 20, height: 20, flexShrink: 0,
        background: `${T.gold}22`, border: `1px solid ${T.gold}`, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.fontMono, fontSize: 10, fontWeight: 800, color: T.gold,
      }}>{n}</span>
      <span style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.4 }}>{text}</span>
    </div>
  );
}

function Token({ label, color, sub }: { label: string; color: string; sub: string }) {
  return (
    <div style={{
      padding: '8px 10px', textAlign: 'center', borderRadius: 4,
      background: `linear-gradient(180deg, ${color}, ${shade(color, -0.4)})`,
      border: `1.5px solid ${shade(color, -0.5)}`,
    }}>
      <div style={{ fontFamily: T.fontJp, fontSize: 11, fontWeight: 800, color: '#fff' }}>{label}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 8, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function MiniChar({ color, name, ap }: { color: string; name: string; ap: number }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 4, textAlign: 'center',
      background: `linear-gradient(180deg, ${color}, ${shade(color, -0.4)})`,
      border: `1.5px solid ${shade(color, -0.5)}`,
      filter: `drop-shadow(0 0 10px ${color}66)`,
    }}>
      <div style={{ fontFamily: T.fontSerif, fontSize: 11, fontWeight: 800, color: '#fff' }}>{name}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 18, fontWeight: 900, color: T.gold }}>{ap}</div>
      <div style={{ fontFamily: T.fontMono, fontSize: 8, color: 'rgba(255,255,255,0.7)' }}>AP</div>
    </div>
  );
}

// ============================================================================
// ch5 — 解決編 + アシスト勝利不可
// ============================================================================

function Ch5CaseShift() {
  return (
    <Panel>
      <SectionLabel>VISUAL · 事件編 → 解決編</SectionLabel>
      <div style={{ padding: '14px', background: 'rgba(0,0,0,0.45)', border: `1px solid ${T.gold}33`, borderRadius: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <CaseStateBox label="事件編" accent={T.blue} state="EDITING" />
          <Arrow />
          <CaseStateBox label="解決編" accent={T.red} state="RESOLVED" />
        </div>
        <div style={{ textAlign: 'center', marginTop: 10, fontFamily: T.fontMono, fontSize: 9, color: T.gold, letterSpacing: '0.2em' }}>
          パートナーの FILE 条件 + アシスト で移行
        </div>
      </div>
      <PointBox>解決編から事件編に戻ることはない (一方通行) (rules/01)。</PointBox>
    </Panel>
  );
}

function Ch5Target() {
  return (
    <Panel>
      <SectionLabel>VISUAL · 必要証拠数</SectionLabel>
      <div style={{ display: 'flex', gap: 14, padding: '16px', background: 'rgba(0,0,0,0.45)', border: `1px solid ${T.gold}55`, borderRadius: 4 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: T.fontSerif, fontSize: 40, fontWeight: 900, color: T.gold }}>7</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.1em' }}>先攻 プレイヤー</div>
        </div>
        <div style={{ width: 1, background: 'rgba(78,195,255,0.2)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: T.fontSerif, fontSize: 40, fontWeight: 900, color: T.gold }}>6</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.textMuted, letterSpacing: '0.1em' }}>後攻 プレイヤー</div>
        </div>
      </div>
      <PointBox>後攻は 1 枚少ない 6 枚でよい (先攻の有利を緩和) (rules/01)。</PointBox>
    </Panel>
  );
}

function Ch5Resolve() {
  return (
    <Panel>
      <SectionLabel>VISUAL · 事件解決で勝利</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px', background: 'rgba(0,0,0,0.45)', border: `1px solid ${T.gold}33`, borderRadius: 4 }}>
        <FlowStep n="1" text="解決編 + 必要証拠数を達成している" />
        <Arrow down />
        <FlowStep n="2" text="アクティブなパートナーで【事件解決】" />
        <Arrow down />
        <FlowStep n="3" text="パートナーをスリープ → ゲーム勝利 🏆" />
      </div>
      <PointBox>パートナーがアクティブであることが前提条件 (rules/01)。</PointBox>
    </Panel>
  );
}

function Ch5AssistWarn() {
  return (
    <Panel>
      <SectionLabel>VISUAL · ハマりやすい裁定</SectionLabel>
      <div style={{ padding: '14px', background: 'rgba(0,0,0,0.45)', border: `1px solid ${T.gold}33`, borderRadius: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <Token label="パートナー" color={T.blue} sub="アクティブ" />
          <Arrow />
          <Token label="アシスト" color={T.red} sub="FILE 移動 (スリープ)" />
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, fontFamily: T.fontMono, fontSize: 9, color: T.red, letterSpacing: '0.18em' }}>
          スリープ済 → 事件解決の前提を満たさない
        </div>
      </div>
      <WarnBox>アシストしたターンは事件解決できない</WarnBox>
      <PointBox accent={T.red}>パートナーの FILE 条件を揃える → 翌ターンに事件解決、が定石 (rules/01)。</PointBox>
    </Panel>
  );
}

function Ch5Practice() {
  return (
    <Panel>
      <SectionLabel>PRACTICE · 練習試合</SectionLabel>
      <div style={{
        padding: '20px 16px', textAlign: 'center',
        background: `linear-gradient(135deg, ${T.gold}22, transparent)`,
        border: `1.5px solid ${T.gold}66`, borderRadius: 4,
      }}>
        <div style={{ fontSize: 36 }}>🎮</div>
        <div style={{ fontFamily: T.fontSerif, fontSize: 18, fontWeight: 800, color: T.gold, marginTop: 8 }}>
          AI と練習対戦
        </div>
        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
          上部「練習試合 PRACTICE」ボタン、または lesson viewer の最終ステップから<br />
          サンプルデッキで実戦。勝利するとこの章がクリアになります。
        </div>
      </div>
      <PointBox>パートナーの FILE 条件 → 解決編 → 翌ターン勝利 を実戦で体験しよう。</PointBox>
    </Panel>
  );
}

function CaseStateBox({ label, accent, state }: { label: string; accent: string; state: string }) {
  return (
    <div style={{
      width: 92, padding: '12px 6px', textAlign: 'center', borderRadius: 4,
      background: `linear-gradient(180deg, ${accent}, ${shade(accent, -0.4)})`,
      border: `1.5px solid ${shade(accent, -0.5)}`,
      filter: `drop-shadow(0 0 12px ${accent}66)`,
    }}>
      <div style={{ fontFamily: T.fontMono, fontSize: 8, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.15em' }}>{state}</div>
      <div style={{ fontFamily: T.fontSerif, fontSize: 15, fontWeight: 800, color: '#fff', marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ============================================================================
// ch6 — 効果と能力
// ============================================================================

function Ch6Icons() {
  const list = [
    { name: 'カットイン', color: T.gold, desc: 'コンタクト中、手札 1 枚で支援 (1 コンタクト 1 枚)' },
    { name: '変装', color: T.purple, desc: '手札キャラと入替。「登場」ではない' },
    { name: 'ヒラメキ', color: T.neonBlue, desc: 'アクション[事件]で証拠がリムーブされる時のみ発動 (カード効果でのリムーブでは不発動)' },
    { name: 'ミスリード', color: T.red, desc: '相手の推理時にスリープして LP-X' },
  ];
  return (
    <Panel>
      <SectionLabel>VISUAL · アイコン能力</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {list.map((a) => (
          <div key={a.name} style={{ padding: '10px 12px', background: `${a.color}22`, border: `1.5px solid ${a.color}66`, borderRadius: 4 }}>
            <div style={{ fontFamily: T.fontJp, fontSize: 13, fontWeight: 700, color: a.color }}>{a.name}</div>
            <div style={{ fontSize: 10, color: T.textSecondary, marginTop: 4, lineHeight: 1.4 }}>{a.desc}</div>
          </div>
        ))}
      </div>
      <PointBox>カットイン / ヒラメキ / 効果による登場は色制限を受けない (rules/09, 10, 13, 20)。</PointBox>
    </Panel>
  );
}

function Ch6Declared() {
  return (
    <Panel>
      <SectionLabel>VISUAL · 宣言能力 + コスト</SectionLabel>
      <div style={{ padding: '14px', background: 'rgba(0,0,0,0.45)', border: `1px solid ${T.gold}33`, borderRadius: 4 }}>
        <div style={{ fontFamily: T.fontMono, fontSize: 13, color: T.gold, textAlign: 'center', letterSpacing: '0.05em' }}>
          【宣言】[スリープ] <span style={{ color: T.neonYellow }}>:</span> 効果テキスト
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: 10, color: T.textSecondary }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '6px', background: `${T.gold}15`, borderRadius: 3 }}>
            ← <strong style={{ color: T.gold }}>コスト</strong><br />「:」の左
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '6px', background: `${T.neonBlue}15`, borderRadius: 3 }}>
            <strong style={{ color: T.neonBlue }}>効果</strong> →<br />「:」の右
          </div>
        </div>
      </div>
      <PointBox>コストを全部行えば発動。一部でも行えなければ使用不可 (rules/21)。</PointBox>
    </Panel>
  );
}

function Ch6Timing() {
  return (
    <Panel>
      <SectionLabel>VISUAL · タイミングアイコン</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <TimingChip label="【登場時】" desc="現場に登場で発動 (効果による登場も)" />
        <TimingChip label="【現場リムーブ時】" desc="現場からリムーブで発動 (方法問わず)" />
        <TimingChip label="【変装時】" desc="変装で現れた時に発動" />
        <TimingChip label="【疾風 N】" desc="このターン N 番目に登場で発動" />
      </div>
      <PointBox>条件を満たさないアイコンは「その能力を持っていない」扱い (rules/17)。</PointBox>
    </Panel>
  );
}

function Ch6Resolve() {
  return (
    <Panel>
      <SectionLabel>VISUAL · 効果の解決順</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px', background: 'rgba(0,0,0,0.45)', border: `1px solid ${T.gold}33`, borderRadius: 4 }}>
        <FlowStep n="1" text="同タイミング複数発動 → ターンプレイヤー優先" />
        <FlowStep n="2" text="同じ所有者の複数効果 → 好きな順で 1 つずつ解決" />
        <FlowStep n="3" text="行動中の発動は「未解決」で待機 → 完了後に解決" />
      </div>
      <PointBox>「〜の代わりに」「〜を無効にする」は発動時点で即時解決 (rules/15, 25)。</PointBox>
    </Panel>
  );
}

function TimingChip({ label, desc }: { label: string; desc: string }) {
  return (
    <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.4)', border: `1px solid rgba(78,195,255,0.3)`, borderRadius: 3 }}>
      <div style={{ fontFamily: T.fontJp, fontSize: 11, fontWeight: 700, color: T.gold }}>{label}</div>
      <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2, lineHeight: 1.3 }}>{desc}</div>
    </div>
  );
}

// ============================================================================
// ch7 — キーワード能力
// ============================================================================

function KeywordCard({ name, icon, color, desc, example }: { name: string; icon: string; color: string; desc: string; example: string }) {
  return (
    <Panel>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{
          width: 64, height: 64, flexShrink: 0,
          background: `${color}33`, border: `2px solid ${color}`, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
          filter: `drop-shadow(0 0 12px ${color}66)`,
        }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.fontSerif, fontSize: 22, fontWeight: 800, color }}>{name}</div>
          <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
        </div>
      </div>
      <div style={{
        padding: '10px 12px', background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${color}44`, borderRadius: 4,
        fontFamily: T.fontMono, fontSize: 11, color: T.textMuted, letterSpacing: '0.04em', lineHeight: 1.5,
      }}>
        例: {example}
      </div>
    </Panel>
  );
}

// ============================================================================
// ch8 — 上級者向け
// ============================================================================

function AdvancedSection({ title, accent, icon, children }: { title: string; accent: string; icon: string; children: ReactNode }) {
  return (
    <Panel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 48, height: 48, flexShrink: 0,
          background: `${accent}33`, border: `2px solid ${accent}`, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>{icon}</div>
        <div style={{ fontFamily: T.fontSerif, fontSize: 20, fontWeight: 800, color: accent }}>{title}</div>
      </div>
      <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.6 }}>{children}</div>
    </Panel>
  );
}

// ============================================================================
// STEP_ILLUSTRATIONS レジストリ
// ============================================================================

export const STEP_ILLUSTRATIONS: Record<string, ReactNode> = {
  // ch1
  'ch1-1': <Ch1Deck />,
  'ch1-2': <Ch1Areas />,
  // ch2
  'ch2-1': <Ch2Char />,
  'ch2-2': <Ch2Event />,
  'ch2-3': <Ch2Case />,
  'ch2-4': <Ch2Partner />,
  // ch3
  'ch3-1': <Ch3Opening />,
  'ch3-2': <Ch3Phases />,
  // ch4
  'ch4-1': <Ch4Reasoning />,
  'ch4-2': <Ch4Action />,
  'ch4-3': <Ch4Contact />,
  'ch4-4': <Ch4NextHint />,
  'ch4-5': <Ch4Refresh />,
  // ch5
  'ch5-1': <Ch5CaseShift />,
  'ch5-2': <Ch5Target />,
  'ch5-3': <Ch5Resolve />,
  'ch5-4': <Ch5AssistWarn />,
  'ch5-5': <Ch5Practice />,
  // ch6
  'ch6-1': <Ch6Icons />,
  'ch6-2': <Ch6Declared />,
  'ch6-3': <Ch6Timing />,
  'ch6-4': <Ch6Resolve />,
  // ch7
  'ch7-1': <KeywordCard name="疾風 N" icon="💨" color={T.neonBlue}
    desc="自分の現場にこのターン N 番目に登場した時に発動する。能力・効果による登場でも条件を満たせば発動。"
    example="疾風 2 = このターン 2 枚目に登場で効果が起動" />,
  'ch7-2': <KeywordCard name="突撃" icon="⚔" color={T.red}
    desc="名乗り状態 (登場ターン) でもアクションできる。"
    example="突撃[キャラ] / 突撃[事件] で対象を限定する variant あり" />,
  'ch7-3': <KeywordCard name="迅速" icon="⚡" color={T.gold}
    desc="名乗り状態でも推理 / アクションの両方ができる。"
    example="突撃の上位互換 (推理も可能になる)" />,
  'ch7-4': <KeywordCard name="ブレット" icon="🎯" color={T.purple}
    desc="このキャラのアクションはガードできない。"
    example="相手はこのアクションにガードを宣言できない" />,
  'ch7-5': <KeywordCard name="捜査 X" icon="🔍" color={T.green}
    desc="相手はデッキ上から X 枚公開し、好きな順でデッキ下へ。"
    example="捜査 3 = 上 3 枚を公開後、相手が並べ替えてデッキ下へ" />,
  'ch7-6': <KeywordCard name="痕跡" icon="👣" color={T.gold}
    desc="相手がリフレッシュすると「発見済」へ。自分のリフレッシュは対象外。"
    example="痕跡[発見済] を条件に能力が解放される" />,
  // ch8
  'ch8-1': <AdvancedSection title="MR (ミステリーレア)" accent={T.purple} icon="✨">
    相手ターン中に現場を離れる場合、リムーブされる代わりに <strong>パートナーエリアへ移動</strong> する。
    パートナーエリアでも使える宣言能力を持つ MR も存在する (rules/18)。
  </AdvancedSection>,
  'ch8-2': <AdvancedSection title="色制限 + スイッチ" accent={T.gold} icon="🎨">
    手札使用 / ネクストヒントで出すカードは <strong>事件と同じ色のみ</strong>。
    現場が 5 枚埋まっている時は既存キャラを <strong>スイッチ (リムーブ)</strong> して新登場できる (rules/20)。
  </AdvancedSection>,
  'ch8-3': <AdvancedSection title="スタン状態の特殊挙動" accent={T.red} icon="💥">
    スタン中のキャラが「アクティブにする」効果を受けると、<strong>代わりにスリープ</strong> になる (スタンは解除されない)。
    明示的な解除効果が無い限りスタンは継続する (rules/03)。
  </AdvancedSection>,
  'ch8-4': <AdvancedSection title="数値修正" accent={T.neonBlue} icon="📊">
    「元の AP/LP を 0 にする」効果は元の値を 0 にするが、他の +/- 修正は残る。
    AP/LP/レベルに <strong>下限はない</strong> (マイナス可)。AP が 0 でもリムーブされない (rules/19)。
  </AdvancedSection>,
  'ch8-5': <AdvancedSection title="セット vs 下に重ねる" accent={T.green} icon="📚">
    <strong>セット</strong> = カード情報 (能力・色) を参照可。<strong>下に重ねる</strong> = 枚数のみ。
    いずれもキャラが現場を離れると一緒にリムーブされる (rules/16)。
  </AdvancedSection>,
};
