// Modal Catalog — 15 modal designs for コナンカードゲーム
// Each artboard renders a single modal in its hero state.

const ART_W = 880;
const ART_H = 560;

// ─────────────────────────── Mini card components ───────────────────────────
function MiniCard({ color = 'blue', name = '江戸川コナン', lp = 1, ap, w = 88, h = 124 }) {
  return (
    <div className={`mc col-${color[0]}`} style={{ width: w, height: h }}>
      <div className="stripe"></div>
      <div className="art"><div className="sil"></div></div>
      <div className="cn">{name}</div>
      <div className="lp">LP {lp}</div>
      {ap !== undefined && <div className="lp ap" style={{ left: 'auto', right: 3 }}>AP {ap}</div>}
    </div>
  );
}

function MiniBack({ w = 88, h = 124 }) {
  return (
    <div className="mc-back" style={{ width: w, height: h }}>
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="6" stroke="#ffd75e" strokeWidth="1.5" />
        <line x1="15" y1="15" x2="20" y2="20" stroke="#ffd75e" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ───────────────────────────── 1) ConfirmModal ──────────────────────────────
function ModalConfirm() {
  return (
    <div className="stage stage-confirm">
      <div className="m-panel">
        <div className="m-title">▼ 推理宣言 / REASONING</div>
        <div className="m-h">パートナー <strong>萩原 千速</strong> で推理を行いますか？</div>
        <div className="m-row"><span className="lbl">対象事件</span><span className="val">千速と重悟の婚活パーティー</span></div>
        <div className="m-row"><span className="lbl">現在の証拠</span><span className="val"><strong>4</strong> / 6</span></div>
        <div className="m-row"><span className="lbl">推理成功時</span><span className="val"><strong>+1</strong> 証拠</span></div>
        <div className="m-row"><span className="lbl">パートナーコスト</span><span className="val">LP <strong>1</strong> → スリープ</span></div>
        <div className="m-note">⚠ 相手の手札に「ミスリード」がある場合、宣言は失敗し相手がそのカードを公開します。</div>
        <div className="m-actions">
          <button className="m-btn m-btn-ghost">キャンセル</button>
          <button className="m-btn m-btn-primary">推理を宣言する</button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── 2) Contact VS ────────────────────────────────
function ModalContactVS() {
  return (
    <div className="stage stage-vs">
      <div className="vs-stage">
        <div className="vs-vs-line"></div>
        <div className="vs-card">
          <div className="ap">3</div>
          <div className="stripe"></div>
          <div className="art"><div className="sil"></div></div>
          <div className="cn">服部 平次</div>
        </div>
        <div className="vs-banner">VS</div>
        <div className="vs-card right">
          <div className="ap">2</div>
          <div className="stripe"></div>
          <div className="art"><div className="sil"></div></div>
          <div className="cn">怪盗キッド</div>
        </div>
        <div className="vs-meta">
          コンタクト判定 / 攻撃側 AP <strong>3</strong> ▶ 防御側 AP <strong>2</strong>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── 3) Misread Reveal ─────────────────────────────
function ModalMisread() {
  return (
    <div className="stage stage-misread">
      <div className="misread-stage">
        <div className="banner">MISREAD!</div>
        <div className="sub">相手の手札からミスリードが公開されました</div>
        <div className="reveal-row">
          <div className="reveal-card">
            <span className="badge">MISREAD</span>
            <div className="stripe"></div>
            <div className="art"><div className="sil"></div></div>
            <div className="cn">早とちりの推理</div>
          </div>
        </div>
        <div className="penalty">推理は <strong>失敗</strong>。証拠は加算されず、パートナーはスリープ状態になります。</div>
      </div>
    </div>
  );
}

// ─────────────────────────── 4) Hirameki (Insp) ────────────────────────────
function ModalHirameki() {
  return (
    <div className="stage stage-hirameki">
      <div className="m-panel" style={{ width: 540, paddingTop: 38, overflow: 'visible' }}>
        <div className="hirameki-bulb">💡</div>
        <div className="m-title" style={{ textAlign: 'center', marginTop: 14 }}>▼ ヒラメキ / INSPIRATION</div>
        <div className="m-h" style={{ textAlign: 'center' }}>デッキ上から <strong>3 枚</strong> 公開 — <strong>1 枚</strong> を手札に</div>
        <div className="pick-row">
          <div className="pick-card"><MiniCard color="blue" name="毛利 蘭" lp={2} /></div>
          <div className="pick-card selected"><MiniCard color="yellow" name="ヒラメキの一閃" lp={1} /></div>
          <div className="pick-card"><MiniCard color="red" name="灰原 哀" lp={1} /></div>
        </div>
        <div className="m-note" style={{ textAlign: 'center' }}>残りはデッキ底に裏向きで戻す</div>
        <div className="m-actions" style={{ justifyContent: 'center' }}>
          <button className="m-btn m-btn-primary">手札に加える</button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── 5) 解決編 stamp ───────────────────────────────
function ModalResolve() {
  return (
    <div className="stage stage-resolve">
      <div className="resolve-stage">
        <div className="resolve-stamp">解 決 編</div>
        <div className="resolve-sub">CASE CLOSED — 事件の真相に到達</div>
        <div className="resolve-case">
          <div className="case-name">千速と重悟の婚活パーティー</div>
          <div className="case-meta">SOLVED · T6 · 証拠 6 / 6 · LV.2</div>
        </div>
        <div style={{ marginTop: 20 }}>
          <button className="m-btn m-btn-primary">解決を確定する</button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────── 6) 捜査結果 (Top-N) ─────────────────────────────
function ModalInvestigate() {
  return (
    <div className="stage">
      <div className="m-panel investigate-panel">
        <div className="m-title">▼ 捜査結果 / INVESTIGATION (TOP 4)</div>
        <div className="m-h">デッキ上 <strong>4 枚</strong> から行き先を指定</div>
        <div className="top-row">
          <div className="top-card selected">
            <MiniCard color="blue" name="灰原 哀" lp={2} />
            <span className="pick-tag">手札へ</span>
          </div>
          <div className="top-card">
            <MiniCard color="yellow" name="阿笠博士" lp={1} />
            <span className="pick-tag" style={{ background: '#888' }}>底へ</span>
          </div>
          <div className="top-card">
            <MiniCard color="red" name="赤井秀一" lp={3} ap={3} />
            <span className="pick-tag" style={{ background: '#888' }}>底へ</span>
          </div>
          <div className="top-card selected">
            <MiniCard color="blue" name="目暮警部" lp={2} />
            <span className="pick-tag">手札へ</span>
          </div>
        </div>
        <div className="destination-toggle" style={{ marginTop: 14 }}>
          <button className="dest-btn active">▲ 手札</button>
          <button className="dest-btn">▼ デッキ底</button>
          <button className="dest-btn">⊘ 除外</button>
        </div>
        <div className="m-actions">
          <button className="m-btn m-btn-ghost">リセット</button>
          <button className="m-btn m-btn-primary">確定（2 / 2 選択済）</button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── 7) FILE 詳細 ──────────────────────────────────
function ModalFile() {
  const slots = [
    { f: true, t: 'T1', name: '小五郎' },
    { f: true, t: 'T2', name: 'コナン' },
    { f: true, t: 'T4', name: '蘭' },
    { f: false },
    { f: false },
    { f: false },
    { f: false },
  ];
  return (
    <div className="stage stage-file">
      <div className="file-panel">
        <div className="hd">CASE FILE · 自陣</div>
        <h2>事件ファイル ／ <span style={{ color: '#c89a30', fontFamily: 'var(--font-mono)' }}>3 / 7</span></h2>
        <div className="file-grid">
          {slots.map((s, i) => (
            <div key={i} className={'file-slot' + (s.f ? ' filled' : '')}>
              {s.f && <>
                <span className="turn-tag">{s.t}</span>
                <div className="magnifier"></div>
              </>}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12, letterSpacing: '0.08em' }}>
          ▸ ホバーで詳細表示 ／ 残り <span style={{ color: '#c89a30' }}>4 枠</span>
        </div>
      </div>
    </div>
  );
}

// ───────────────────── 8) Refresh notice ───────────────────────────────────
function ModalRefresh() {
  return (
    <div className="stage stage-refresh">
      <div className="m-panel">
        <div className="refresh-icon"></div>
        <div className="m-title" style={{ textAlign: 'center' }}>▼ デッキ補充 / REFRESH</div>
        <div className="m-h" style={{ textAlign: 'center' }}>除外カードをデッキに戻し、シャッフル</div>
        <div className="refresh-counter">+ 12 枚</div>
        <div className="m-note" style={{ textAlign: 'center' }}>
          自分の番のドロー前、デッキが <strong>3 枚以下</strong> のとき自動発動
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── 9) 変装 (Disguise) ────────────────────────────
function ModalDisguise() {
  return (
    <div className="stage stage-disguise">
      <div className="disguise-stage">
        <div className="banner">DISGUISE!</div>
        <div className="sub" style={{ fontSize: 12, color: '#d8c8ff', letterSpacing: '0.14em', marginBottom: 14 }}>変装が解け、正体が明らかになる</div>
        <div className="disguise-flip">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <MiniCard color="blue" name="灰原 哀" lp={2} w={110} h={155} />
            <div style={{ fontSize: 10, color: '#9a8ac8', letterSpacing: '0.1em' }}>表向き</div>
          </div>
          <div className="disguise-arrow">▶</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div className="mc col-r flipped" style={{ width: 110, height: 155 }}>
              <div className="stripe"></div>
              <div className="art"><div className="sil"></div></div>
              <div className="cn">怪盗キッド（変装解除）</div>
              <div className="lp">LP 3</div>
              <div className="lp ap" style={{ left: 'auto', right: 3 }}>AP 3</div>
            </div>
            <div style={{ fontSize: 10, color: '#b48cff', letterSpacing: '0.1em', fontWeight: 700 }}>真の姿</div>
          </div>
        </div>
        <div className="disguise-note">
          条件「コンタクトされた時」を満たし、変装カードが解除されました。AP / LP / 色がすべて再計算されます。
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── 10) ブレット ──────────────────────────────────
function ModalBullet() {
  return (
    <div className="stage stage-bullet">
      <div className="bullet-stage">
        <div className="banner">BULLET!</div>
        <div className="sub">射撃判定 — 対象に直接ダメージ</div>
        <div className="bullet-flash">
          <div className="bullet"></div>
        </div>
        <div className="target-row">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <MiniCard color="red" name="赤井 秀一" lp={3} ap={3} />
            <div style={{ fontSize: 9, color: '#ffaa70', letterSpacing: '0.12em' }}>射撃手</div>
          </div>
          <div style={{ fontSize: 32, color: '#ff8030' }}>▶</div>
          <div className="dmg-tag">DMG 2</div>
          <div style={{ fontSize: 32, color: '#ff8030' }}>▶</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <MiniCard color="blue" name="ジン" lp={2} />
            <div style={{ fontSize: 9, color: '#ffaa70', letterSpacing: '0.12em' }}>対象 (LP 2→0)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── 11) カットイン ────────────────────────────────
function ModalCutIn() {
  return (
    <div className="stage stage-cutin">
      <div className="cutin-stage">
        <div className="cutin-portrait"><div className="sil"></div></div>
        <div className="cutin-body">
          <div className="tag">▶ CUT-IN INTERRUPT</div>
          <h3>「真実はいつも──ひとつ！」</h3>
          <div className="quote">江戸川コナンは、相手の効果解決前に手札のヒラメキカードを開示できる。</div>
          <div className="effect">▸ 効果スタック割り込み発生 ・ 解決順 [相手効果] ← [カットイン] ＝ カットインから処理</div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────── 12) ダメージ / KO ───────────────────────────
function ModalDamage() {
  return (
    <div className="stage stage-damage">
      <div className="damage-stage">
        <div className="damage-banner">DAMAGE</div>
        <div className="damage-card">
          <MiniCard color="blue" name="毛利 蘭" lp={1} w={70} h={98} />
          <div className="lp-line">
            <span className="old">LP 2</span>
            <span className="arr">▶</span>
            <span className="new">0</span>
          </div>
          <div className="ko-tag">K.O.</div>
        </div>
        <div style={{ marginTop: 14, fontSize: 11, color: '#ffc8c8', letterSpacing: '0.1em' }}>
          ▸ K.O.カードは <strong style={{ color: '#fff' }}>リムーブエリア</strong> へ送られる
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── 13) ターン終了確認 ───────────────────────────────
function ModalEndTurn() {
  return (
    <div className="stage">
      <div className="m-panel end-turn-panel">
        <div className="m-title">▼ ターン終了 / END TURN</div>
        <div className="m-h">後攻 <strong>T4</strong> を終了しますか？</div>
        <div className="end-turn-summary">
          <div className="cell"><div className="lbl">使用アクション</div><div className="val">5 / 6</div></div>
          <div className="cell"><div className="lbl">獲得証拠</div><div className="val">+2</div></div>
          <div className="cell"><div className="lbl">手札</div><div className="val">5 枚</div></div>
          <div className="cell"><div className="lbl">FILE 進捗</div><div className="val">3 / 7</div></div>
        </div>
        <div className="end-turn-warn">⚠ ⑥ 行動 を未使用です。本当に終了しますか？</div>
        <div className="m-actions" style={{ justifyContent: 'space-between' }}>
          <button className="m-btn m-btn-ghost">戻る</button>
          <button className="m-btn m-btn-blue">ターン終了</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────── 14) マリガン ───────────────────────────────
function ModalMulligan() {
  return (
    <div className="stage stage-mulligan">
      <div className="m-panel">
        <div className="m-title">▼ マリガン / MULLIGAN</div>
        <div className="m-h">交換するカードを選択（最大 5 枚）</div>
        <div className="mulligan-row">
          <div className="pick-card"><MiniCard color="blue" name="工藤 新一" lp={2} ap={2} /></div>
          <div className="pick-card selected"><MiniCard color="yellow" name="阿笠博士" lp={1} /></div>
          <div className="pick-card"><MiniCard color="blue" name="毛利 蘭" lp={2} /></div>
          <div className="pick-card selected"><MiniCard color="red" name="ジン" lp={3} ap={3} /></div>
          <div className="pick-card"><MiniCard color="blue" name="灰原 哀" lp={2} /></div>
        </div>
        <div className="mulligan-summary">
          選択中 <strong>2</strong> 枚 ／ デッキ底へ戻し、同枚数を引き直し
        </div>
        <div className="m-actions">
          <button className="m-btn m-btn-ghost">交換しない</button>
          <button className="m-btn m-btn-primary">2 枚を引き直す</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── 15) Game Over / Victory ──────────────────────────
function ModalGameOver() {
  return (
    <div className="stage stage-gameover">
      <div className="victory-stage">
        <div className="victory-banner">VICTORY</div>
        <div className="victory-tag">CASE SOLVED — 7 / 7 FILES CLOSED</div>
        <div className="victory-stats">
          <div className="vs-cell"><div className="lbl">SOLVED</div><div className="val">7 / 7</div></div>
          <div className="vs-cell"><div className="lbl">TURNS</div><div className="val">T8</div></div>
          <div className="vs-cell"><div className="lbl">EVIDENCE</div><div className="val">42</div></div>
        </div>
        <div className="m-actions" style={{ justifyContent: 'center', gap: 12 }}>
          <button className="m-btn m-btn-ghost">対戦ログを見る</button>
          <button className="m-btn m-btn-primary">ロビーへ戻る</button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── Canvas layout ──────────────────────────────
const { DesignCanvas, DCSection, DCArtboard } = window;

function App() {
  return (
    <DesignCanvas>
      <DCSection id="confirm" title="Confirm / Decision" subtitle="情報提示と意思決定を促すモーダル">
        <DCArtboard id="confirm" label="01 · 推理宣言（ConfirmModal）" width={ART_W} height={ART_H}>
          <ModalConfirm />
        </DCArtboard>
        <DCArtboard id="investigate" label="02 · 捜査結果（Top-N 振り分け）" width={ART_W} height={ART_H}>
          <ModalInvestigate />
        </DCArtboard>
        <DCArtboard id="mulligan" label="03 · マリガン（初期手札交換）" width={ART_W} height={ART_H}>
          <ModalMulligan />
        </DCArtboard>
        <DCArtboard id="end-turn" label="04 · ターン終了確認" width={ART_W} height={ART_H}>
          <ModalEndTurn />
        </DCArtboard>
      </DCSection>

      <DCSection id="reveal" title="Reveal / Cinematic" subtitle="演出を伴う情報公開">
        <DCArtboard id="vs" label="05 · コンタクト VS（攻防判定）" width={ART_W} height={ART_H}>
          <ModalContactVS />
        </DCArtboard>
        <DCArtboard id="hirameki" label="06 · ヒラメキ（公開→選択）" width={ART_W} height={ART_H}>
          <ModalHirameki />
        </DCArtboard>
        <DCArtboard id="resolve" label="07 · 解決編スタンプ" width={ART_W} height={ART_H}>
          <ModalResolve />
        </DCArtboard>
        <DCArtboard id="file" label="08 · FILE 詳細（自陣ファイル）" width={ART_W} height={ART_H}>
          <ModalFile />
        </DCArtboard>
        <DCArtboard id="refresh" label="09 · リフレッシュ通知" width={ART_W} height={ART_H}>
          <ModalRefresh />
        </DCArtboard>
      </DCSection>

      <DCSection id="conflict" title="Conflict / Negative" subtitle="失敗・ペナルティ・敗北">
        <DCArtboard id="misread" label="10 · ミスリード公開（推理失敗）" width={ART_W} height={ART_H}>
          <ModalMisread />
        </DCArtboard>
        <DCArtboard id="bullet" label="11 · ブレット（射撃ダメージ）" width={ART_W} height={ART_H}>
          <ModalBullet />
        </DCArtboard>
        <DCArtboard id="damage" label="12 · ダメージ／KO" width={ART_W} height={ART_H}>
          <ModalDamage />
        </DCArtboard>
      </DCSection>

      <DCSection id="special" title="Special / Interrupt" subtitle="割り込み・特殊状態・終局">
        <DCArtboard id="disguise" label="13 · 変装解除（Disguise Flip）" width={ART_W} height={ART_H}>
          <ModalDisguise />
        </DCArtboard>
        <DCArtboard id="cutin" label="14 · カットイン割り込み" width={ART_W} height={ART_H}>
          <ModalCutIn />
        </DCArtboard>
        <DCArtboard id="gameover" label="15 · 勝利／Game Over" width={ART_W} height={ART_H}>
          <ModalGameOver />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
