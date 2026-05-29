// 05-app.jsx
// Main app shell for 05-effect-animations.html.
// Renders a grid of scenes. Each scene = (component, title, variant label, duration).
// Scene components are expected to be defined globally (loaded from sibling JSX files).

const SCENE_GROUPS = [
  {
    id: 'hirameki',
    num: '01',
    title: 'ヒラメキ',
    desc: 'パートナーが推理に閃いた瞬間。データ上は「効果適用」だが視覚的に「気づき」を演出する。',
    variants: [
      { id: 'A', label: '王道 / メガネのキラーン', desc: '金色光輪 + 斜めスパーク', duration: 3.5, component: 'HiramekiSceneA' },
      { id: 'B', label: '電撃 / インサイト稲妻', desc: '画面を稲妻が走り、シルエットだけ残す', duration: 3.5, component: 'HiramekiSceneB' },
    ],
  },
  {
    id: 'contact',
    num: '02',
    title: 'コンタクト VS',
    desc: 'アタッカー × ディフェンダー の AP 比較。緊張感のある対決演出。',
    variants: [
      { id: 'A', label: '正対 / スピード線で衝突', desc: '左右からスライドイン → 中央衝突', duration: 4.0, component: 'ContactSceneA' },
      { id: 'B', label: '映画的 / 斜め分割画面', desc: 'split screen → 双方ズーム → 結果', duration: 4.5, component: 'ContactSceneB' },
    ],
  },
  {
    id: 'solution',
    num: '03',
    title: '解決編突入',
    desc: '事件編から解決編への章替わり。BGM 切替に合うトランジション。',
    variants: [
      { id: 'A', label: 'ページめくり', desc: '上下に画面分割 → 解決編タグへ', duration: 4.0, component: 'SolutionSceneA' },
      { id: 'B', label: '砕け落ちる / スタンプ', desc: '事件編タグがガラス砕け、解決編スタンプ', duration: 4.5, component: 'SolutionSceneB' },
    ],
  },
  {
    id: 'misread',
    num: '04',
    title: 'ミスリード',
    desc: '正解と思った推理が実は誤誘導。心臓のドクン!を視覚化。',
    variants: [
      { id: 'A', label: '反転 / ガラスが割れる', desc: '緑 → 赤反転 + ヒビ割れエフェクト', duration: 4.0, component: 'MisreadSceneA' },
      { id: 'B', label: '鏡像 / 真相が裏返る', desc: '「真相」テキストが反転 → 「ミスリード」', duration: 4.0, component: 'MisreadSceneB' },
    ],
  },
  {
    id: 'card',
    num: '05',
    title: 'カード効果発動 (Master Duel 風)',
    desc: 'カードがふわっと浮上 → 発光 → 効果テキストバナー。Lv1/2/3 で派手さを切替。',
    variants: [
      { id: 'A', label: '王道 / 金色発光 + バナー', desc: 'マスターデュエル踏襲', duration: 5.0, component: 'CardActivationSceneA', hasLevel: true },
      { id: 'B', label: 'コナン風 / 虫眼鏡で覗く', desc: '指紋背景 + 虫眼鏡フォーカス', duration: 5.0, component: 'CardActivationSceneB', hasLevel: true },
    ],
  },
  {
    id: 'victory',
    num: '06',
    title: '勝利 / 敗北',
    desc: 'ゲーム終了の演出。勝利は「真実」、敗北は「迷宮入り」。',
    variants: [
      { id: 'A', label: '勝利 / 真実はいつも一つ', desc: '証拠カード放射 + ゴールド輝き', duration: 5.0, component: 'VictorySceneA' },
      { id: 'B', label: '敗北 / 事件は迷宮入り', desc: 'グレースケール + 静かに証拠が落ちる', duration: 5.0, component: 'VictorySceneB' },
    ],
  },
];

function SceneCard({ group, variant }) {
  const Component = window[variant.component];
  const [level, setLevel] = React.useState(2); // for card activation
  return (
    <div className="scene-card">
      <div className="scene-head">
        <span className="num">{group.num}{variant.id}</span>
        <div className="scene-titles">
          <h2>{group.title}</h2>
          <div className="variant">{variant.label}</div>
        </div>
        <span className="dur">{variant.duration.toFixed(1)}s</span>
      </div>
      <div className="scene-viewport">
        {Component ? (
          <Component level={level} setLevel={setLevel} />
        ) : (
          <div className="scene-placeholder">
            <div className="ph-icon">✎</div>
            <div className="ph-text">未実装</div>
            <div className="ph-comp">&lt;{variant.component} /&gt;</div>
          </div>
        )}
      </div>
      <div className="scene-foot">
        <div className="scene-note">{variant.desc}</div>
        {variant.hasLevel && (
          <div className="level-picker">
            {[1, 2, 3].map((lv) => (
              <button
                key={lv}
                className={`lv-btn ${level === lv ? 'active' : ''}`}
                onClick={() => setLevel(lv)}
              >
                Lv{lv}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SceneGroup({ group }) {
  return (
    <section className="scene-group">
      <header className="group-head">
        <span className="group-num">{group.num}</span>
        <div className="group-titles">
          <h1>{group.title}</h1>
          <p>{group.desc}</p>
        </div>
      </header>
      <div className="group-grid">
        {group.variants.map((v) => (
          <SceneCard key={v.id} group={group} variant={v} />
        ))}
      </div>
    </section>
  );
}

function App() {
  return (
    <div className="page">
      <header className="page-header">
        <h1>
          <strong>05</strong>
          {'  '}Effect Animations — 演出アニメーション集
        </h1>
        <div className="meta">conan TCG · 6 effects × 2 variants · 16:9 · 1280×720</div>
        <div className="legend">
          <span>SPACE: 再生/停止</span>
          <span>← →: 0.1s シーク</span>
          <span>0: 先頭</span>
        </div>
      </header>

      <div className="page-intro">
        <p>
          ゲームの主要イベント(ヒラメキ・コンタクト・解決編突入・ミスリード・カード発動・勝敗)について、
          視覚演出案を 2 案ずつ提示する検証ボード。各シーンは独立タイムラインで再生でき、
          スクラバーでフレーム単位の確認が可能。
        </p>
      </div>

      {SCENE_GROUPS.map((g) => (
        <SceneGroup key={g.id} group={g} />
      ))}

      <footer className="page-footer">
        <p>
          すべての演出は <code>animations.jsx</code> (Stage / Sprite / Easing) を基盤に React で実装。
          カードアートは公式画像を使用できないため、抽象的な探偵風 SVG ダミーで代替している。
        </p>
      </footer>
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<App />);
