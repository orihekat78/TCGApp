// 05-scenes-victory.jsx
// Victory and Defeat scenes.

function PlaymatBgVictory() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `
        radial-gradient(ellipse at 50% 50%, #1a1208 0%, #0a0608 50%, #02010a 100%)
      `,
    }} />
  );
}

function PlaymatBgDefeat() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `
        radial-gradient(ellipse at 50% 50%, #0a1820 0%, #050810 70%, #02020a 100%)
      `,
    }} />
  );
}

// Reusable mini evidence card
function EvidenceMini({ w, h, color = 'yellow', name = '証拠', art = 'magnifier' }) {
  return (
    <DummyCard
      w={w}
      h={h}
      color={color}
      name={name}
      ap={null}
      cost={null}
      art={art}
      edition="解決"
    />
  );
}

// ──────────────────────────────────────────────────────────────────────
// Victory A — 真実はいつも一つ
// Beats:
//   0-0.7s: Establishing (partner + case cards visible)
//   0.7-1.3s: Screen darkens, beam of light from center
//   1.3-2.2s: 5 evidence cards burst out in radial pattern (one already in center)
//   2.2-3.6s: "真実は" → "いつも" → "一つ!" text appears in sequence
//   3.6-5.0s: Final hold — partner glow, particles, sparkles
function VictorySceneA() {
  return (
    <Stage width={1280} height={720} duration={5.0} background="#050810" persistKey="victory-a">
      <PlaymatBgVictory />

      {/* Background fingerprint as motif */}
      <Sprite start={0.5} end={5.0}>
        {({ progress }) => {
          const opacity = progress < 0.2 ? (progress / 0.2) * 0.18 : 0.18;
          return (
            <div style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none' }}>
              <Fingerprint x={640} y={400} size={680} color="#ffd75e" opacity={1} t={progress * 0.3} />
            </div>
          );
        }}
      </Sprite>

      {/* Vignette pulsing */}
      <Sprite start={0.7} end={5.0}>
        <Vignette strength={0.7} color="#1a0a0a" t={0.5} />
      </Sprite>

      {/* Beam of light from above */}
      <Sprite start={0.9} end={4.5}>
        {({ progress }) => {
          let opacity = 0;
          if (progress < 0.15) opacity = (progress / 0.15) * 0.85;
          else if (progress > 0.85) opacity = (1 - (progress - 0.85) / 0.15) * 0.6;
          else opacity = 0.85;
          return (
            <div style={{
              position: 'absolute', left: 480, top: 0,
              width: 320, height: 600,
              background: 'linear-gradient(180deg, rgba(255,215,94,0.7), rgba(255,215,94,0))',
              opacity, filter: 'blur(20px)',
              pointerEvents: 'none',
            }} />
          );
        }}
      </Sprite>

      {/* Evidence cards burst out radially (1.2-3.0s) */}
      <Sprite start={1.1} end={4.8}>
        <EvidenceRadialBurst />
      </Sprite>

      {/* Partner card center */}
      <Sprite start={0} end={5.0} keepMounted>
        <VictoryPartnerCard />
      </Sprite>

      {/* Sequential text reveal */}
      <Sprite start={2.0} end={5.0}>
        <TruthTextReveal />
      </Sprite>

      {/* Sparkles */}
      <Sprite start={2.5} end={5.0}>
        <Particles x={640} y={420} count={32} color="#ffd75e" spread={520} rise={350} />
      </Sprite>

      {/* Pulse rings */}
      <Sprite start={2.4} end={5.0}>
        <PulseGlow x={640} y={400} color="#ffd75e" max={650} count={3} />
      </Sprite>

      {/* Sparkle flash at the "一つ!" moment */}
      <Sprite start={3.0} end={3.5}>
        <SparkleFlash x={640} y={380} size={400} color="#fff" />
      </Sprite>

      <div style={{
        position: 'absolute', left: 24, top: 18,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        color: 'rgba(255,215,94,0.55)', letterSpacing: '0.15em',
      }}>
        VICTORY · ONE TRUTH
      </div>
    </Stage>
  );
}

function VictoryPartnerCard() {
  const time = useTime();
  // entry 0-0.7: subtle bob
  // 0.7-1.3: rises and scales as the screen darkens
  // 1.3+: hold scaled up with strong glow
  let y, scale, glow, rotY;
  if (time < 0.7) {
    y = 250;
    scale = 1;
    glow = 0;
    rotY = 0;
  } else if (time < 1.4) {
    const k = Easing.easeOutBack((time - 0.7) / 0.7);
    y = 250 - k * 40;
    scale = 1 + k * 0.15;
    glow = k;
    rotY = k * 5;
  } else {
    const bob = Math.sin((time - 1.4) * 1.5) * 4;
    y = 210 + bob;
    scale = 1.15;
    glow = 1 + Math.sin((time - 1.4) * 2) * 0.05;
    rotY = 5 + Math.sin((time - 1.4) * 1.2) * 1;
  }
  return (
    <div style={{
      position: 'absolute', left: 540, top: y,
      width: 200, height: 280,
      transform: `scale(${scale}) rotateY(${rotY}deg)`,
      filter: glow > 0
        ? `drop-shadow(0 0 ${15 + glow * 30}px rgba(255,215,94,0.95)) drop-shadow(0 0 8px #fff)`
        : 'drop-shadow(0 12px 24px rgba(0,0,0,0.7))',
    }}>
      <DummyCard
        w={200} h={280}
        color="partner"
        name="探偵 / 工藤"
        ap={5} cost={3}
        art="silhouette"
        highlight={glow > 0.3 ? '#ffd75e' : null}
      />
    </div>
  );
}

function EvidenceRadialBurst() {
  const { progress } = useSprite();
  // 5 evidence cards on radial axes
  const cards = [
    { angle: -90, color: 'yellow', art: 'magnifier', name: '足跡' },
    { angle: -90 + 72, color: 'yellow', art: 'fingerprint', name: '指紋' },
    { angle: -90 + 144, color: 'yellow', art: 'silhouette', name: '証言' },
    { angle: -90 + 216, color: 'yellow', art: 'footprint', name: '足跡' },
    { angle: -90 + 288, color: 'yellow', art: 'bowtie', name: '凶器' },
  ];
  const cx = 640, cy = 400;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {cards.map((c, i) => {
        // Each card has its own staggered timing
        const stagger = i * 0.06;
        const local = Math.max(0, Math.min(1, (progress - stagger) / (1 - stagger)));
        let r, scale, opacity, rotate;
        if (local < 0.25) {
          const k = Easing.easeOutBack(local / 0.25);
          r = k * 230;
          scale = 0.3 + k * 0.7;
          opacity = k;
          rotate = (1 - k) * 360;
        } else if (local > 0.85) {
          const k = (local - 0.85) / 0.15;
          r = 230 + k * 30;
          scale = 1 - k * 0.1;
          opacity = 1 - k;
          rotate = 0;
        } else {
          r = 230 + Math.sin((local - 0.25) * Math.PI * 2) * 8;
          scale = 1 + Math.sin((local - 0.25) * Math.PI * 4) * 0.03;
          opacity = 1;
          rotate = Math.sin((local - 0.25) * Math.PI * 3) * 2;
        }
        const ax = cx + Math.cos((c.angle * Math.PI) / 180) * r;
        const ay = cy + Math.sin((c.angle * Math.PI) / 180) * r;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: ax - 50,
              top: ay - 70,
              width: 100, height: 140,
              opacity,
              transform: `scale(${scale}) rotate(${rotate + c.angle + 90}deg)`,
              transformOrigin: 'center',
              filter: 'drop-shadow(0 0 14px rgba(255,215,94,0.65)) drop-shadow(0 8px 16px rgba(0,0,0,0.6))',
            }}
          >
            <EvidenceMini w={100} h={140} color={c.color} name={c.name} art={c.art} />
          </div>
        );
      })}
    </div>
  );
}

function TruthTextReveal() {
  const { progress } = useSprite();
  // Three words appear in sequence
  // 0..0.18 -- "真実は"
  // 0.2..0.4 -- "いつも"
  // 0.42..0.7 -- "一つ!"
  const parts = [
    { text: '真実は', start: 0.0, end: 0.95, x: -340, big: false },
    { text: 'いつも', start: 0.12, end: 0.95, x: 0, big: false },
    { text: '一つ!', start: 0.24, end: 0.95, x: 340, big: true },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 540,
      textAlign: 'center', pointerEvents: 'none',
    }}>
      {parts.map((p, i) => {
        const local = Math.max(0, Math.min(1, (progress - p.start) / (p.end - p.start)));
        let opacity, scale, ty;
        if (local < 0.1) {
          const k = Easing.easeOutBack(local / 0.1);
          opacity = k;
          scale = 0.4 + 0.6 * k;
          ty = (1 - k) * 40;
        } else if (local > 0.95) {
          const k = (local - 0.95) / 0.05;
          opacity = 1 - k;
          scale = 1 - 0.05 * k;
          ty = 0;
        } else {
          opacity = 1;
          scale = 1 + Math.sin((local - 0.1) * Math.PI * 5) * 0.02;
          ty = 0;
        }
        return (
          <div
            key={i}
            style={{
              display: 'inline-block',
              margin: '0 16px',
              opacity,
              transform: `translateY(${ty}px) scale(${scale})`,
              fontFamily: "'Hiragino Mincho ProN', serif",
              fontSize: p.big ? 110 : 70,
              fontWeight: 900,
              color: '#ffd75e',
              letterSpacing: '0.15em',
              textShadow: `0 0 ${p.big ? 30 : 20}px rgba(255,215,94,0.9), 6px 6px 0 rgba(140,0,0,0.55)`,
              WebkitTextStroke: '2px rgba(140,90,0,0.45)',
            }}
          >
            {p.text}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Defeat — 事件は迷宮入り
// Beats:
//   0-0.8s: Establish (board state, gradually desaturating)
//   0.8-2.5s: Evidence cards slowly tumble down off-screen (gravity)
//   2.5-3.5s: "事件は迷宮入り" text fades in, dim
//   3.5-5.0s: Cold blue settles, partner sad
function VictorySceneB() {
  return (
    <Stage width={1280} height={720} duration={5.0} background="#050810" persistKey="defeat-a">
      <PlaymatBgDefeat />

      {/* Initial board state with evidence still hanging */}
      <Sprite start={0} end={5.0} keepMounted>
        <DefeatPartnerCard />
      </Sprite>

      {/* Evidence row that falls */}
      <Sprite start={0.5} end={3.5}>
        <EvidenceFalling />
      </Sprite>

      {/* Cold blue overlay growing */}
      <Sprite start={0.3} end={5.0}>
        {({ progress }) => {
          const opacity = Math.min(1, progress / 0.5) * 0.55;
          return (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse at 50% 50%, rgba(20,60,100,0.1) 0%, rgba(10,20,40,0.85) 90%)',
              opacity,
              mixBlendMode: 'multiply',
            }} />
          );
        }}
      </Sprite>

      {/* Desaturation grow */}
      <Sprite start={0.3} end={5.0}>
        {({ progress }) => {
          const sat = Math.min(1, progress / 1.5);
          return (
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              backdropFilter: `grayscale(${sat * 0.5})`,
            }} />
          );
        }}
      </Sprite>

      {/* Rain (subtle thin streaks) */}
      <Sprite start={1.2} end={5.0}>
        <RainStreaks />
      </Sprite>

      {/* Text appears 2.5+ */}
      <Sprite start={2.3} end={5.0}>
        {({ progress }) => {
          let opacity = 1, ty = 0, scale = 1;
          if (progress < 0.15) {
            const k = Easing.easeOutCubic(progress / 0.15);
            opacity = k;
            ty = (1 - k) * 30;
            scale = 0.95 + 0.05 * k;
          } else if (progress > 0.92) {
            opacity = 1 - (progress - 0.92) / 0.08;
          } else {
            const bob = Math.sin((progress - 0.15) * Math.PI * 1.5) * 0.005;
            scale = 1 + bob;
          }
          return (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: 250, textAlign: 'center',
              opacity, transform: `translateY(${ty}px) scale(${scale})`,
            }}>
              <div style={{
                display: 'inline-block',
                fontFamily: "'Hiragino Mincho ProN', serif",
                fontSize: 90, fontWeight: 900,
                color: 'rgba(140,160,200,0.95)',
                letterSpacing: '0.2em',
                textShadow: '0 4px 14px rgba(0,0,0,0.95)',
              }}>
                迷 宮 入 り
              </div>
              <div style={{
                marginTop: 4,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 14,
                color: 'rgba(120,160,200,0.6)',
                letterSpacing: '0.5em',
              }}>
                UNSOLVED CASE
              </div>
              <div style={{
                marginTop: 24,
                fontFamily: "'Hiragino Mincho ProN', serif",
                fontSize: 24, fontWeight: 700,
                color: 'rgba(120,140,180,0.7)',
                letterSpacing: '0.3em',
              }}>
                事件は解決されなかった……
              </div>
            </div>
          );
        }}
      </Sprite>

      <div style={{
        position: 'absolute', left: 24, top: 18,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        color: 'rgba(140,160,200,0.6)', letterSpacing: '0.15em',
      }}>
        DEFEAT · CASE UNSOLVED
      </div>
    </Stage>
  );
}

function DefeatPartnerCard() {
  const time = useTime();
  // gradual dim + lower position over the scene
  const k = Math.min(1, time / 4);
  const y = 250 + k * 30;
  const rotate = k * -3;
  return (
    <div style={{
      position: 'absolute', left: 540, top: y,
      width: 200, height: 280,
      transform: `rotate(${rotate}deg)`,
      filter: `grayscale(${k * 0.7}) brightness(${1 - k * 0.4}) drop-shadow(0 8px 16px rgba(0,0,0,0.6))`,
      opacity: 1 - k * 0.3,
    }}>
      <DummyCard
        w={200} h={280}
        color="partner"
        name="探偵 / 工藤"
        ap={5} cost={3}
        art="silhouette"
      />
    </div>
  );
}

function EvidenceFalling() {
  const { progress } = useSprite();
  // 5 mini evidence cards positioned in a row, falling one by one
  const cards = [
    { x: 200, color: 'yellow', art: 'magnifier' },
    { x: 350, color: 'yellow', art: 'fingerprint' },
    { x: 870, color: 'yellow', art: 'silhouette' },
    { x: 1020, color: 'yellow', art: 'footprint' },
    { x: 1170, color: 'yellow', art: 'bowtie' },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {cards.map((c, i) => {
        const stagger = i * 0.12;
        const local = Math.max(0, Math.min(1, (progress - stagger) / (1 - stagger)));
        // gravity fall
        const dy = local * local * 700;
        const rotate = local * 60 * (i % 2 === 0 ? 1 : -1);
        const opacity = local > 0.85 ? 1 - (local - 0.85) / 0.15 : 1;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: c.x - 50,
              top: 260 + dy,
              width: 100, height: 140,
              transform: `rotate(${rotate}deg)`,
              opacity: opacity * 0.85,
              filter: `grayscale(${local * 0.8}) brightness(${1 - local * 0.4}) drop-shadow(0 4px 8px rgba(0,0,0,0.5))`,
            }}
          >
            <EvidenceMini w={100} h={140} color={c.color} art={c.art} name="証拠" />
          </div>
        );
      })}
    </div>
  );
}

function RainStreaks() {
  const { progress } = useSprite();
  const seeds = React.useMemo(
    () => Array.from({ length: 50 }, (_, i) => ({
      x: (i * 137) % 1280,
      delay: (i * 0.07) % 1,
      speed: 1 + ((i * 13) % 100) * 0.02,
      length: 30 + ((i * 23) % 50),
    })),
    []
  );
  return (
    <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} viewBox="0 0 1280 720">
      {seeds.map((s, i) => {
        const t = ((progress + s.delay) * s.speed) % 1;
        const y = -50 + t * 800;
        const opacity = 0.25;
        return (
          <line
            key={i}
            x1={s.x + 10} y1={y}
            x2={s.x} y2={y + s.length}
            stroke="#aaccff"
            strokeWidth="1"
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
}

Object.assign(window, { VictorySceneA, VictorySceneB });
