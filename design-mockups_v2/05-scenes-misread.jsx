// 05-scenes-misread.jsx
// Misread scenes — the moment a reasoning is revealed as misdirection.

function PlaymatBgMisread() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `
        radial-gradient(ellipse at 50% 45%, #0e1828 0%, #050810 75%),
        linear-gradient(180deg, #060a12, #020306)
      `,
    }}>
      <svg style={{ position: 'absolute', inset: 0, opacity: 0.05 }} viewBox="0 0 1280 720">
        <defs>
          <pattern id="hex-bg-mis" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
            <path d="M30 0 L60 15 L60 37 L30 52 L0 37 L0 15 Z" fill="none" stroke="#4ec3ff" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="1280" height="720" fill="url(#hex-bg-mis)" />
      </svg>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Misread A — Looks correct, then shatters into red.
// Beats:
//   0.0-1.0s: green "正解" feel — partner card glows green, "+1 証拠" text
//   1.0-1.3s: pause / freeze frame
//   1.3-1.6s: chromatic glitch + screen crack
//   1.6-2.4s: red splash + "ミスリード!" stamp
//   2.4-4.0s: settle, red haze
function MisreadSceneA() {
  return (
    <Stage width={1280} height={720} duration={4.0} background="#050810" persistKey="misread-a">
      <PlaymatBgMisread />

      {/* Partner card center */}
      <PartnerCardMisreadA />

      {/* Phase 1: success-looking effects (0-1.3) */}
      <Sprite start={0.2} end={1.4}>
        <GoldHalo x={640} y={360} r={260} color="#44dd99" strength={0.7} />
      </Sprite>
      <Sprite start={0.4} end={1.4}>
        {({ progress }) => {
          let opacity = 1, scale = 1, ty = 0;
          if (progress < 0.2) { const k = Easing.easeOutBack(progress / 0.2); opacity = k; scale = 0.5 + 0.5 * k; ty = (1 - k) * 30; }
          else if (progress > 0.9) { opacity = 1 - (progress - 0.9) / 0.1; }
          return (
            <div style={{
              position: 'absolute', top: 130, left: 0, right: 0, textAlign: 'center',
              opacity, transform: `translateY(${ty}px) scale(${scale})`,
            }}>
              <div style={{
                display: 'inline-block', padding: '8px 24px',
                background: 'rgba(68,221,153,0.15)',
                border: '2px solid #44dd99',
                fontFamily: "'Hiragino Kaku Gothic ProN', sans-serif",
                fontSize: 38, fontWeight: 800,
                color: '#44dd99',
                letterSpacing: '0.15em',
                textShadow: '0 0 14px rgba(68,221,153,0.7)',
              }}>
                + 1 証拠 獲得
              </div>
            </div>
          );
        }}
      </Sprite>
      <Sprite start={0.4} end={1.3}>
        <Particles x={640} y={420} count={18} color="#44dd99" spread={300} rise={250} />
      </Sprite>

      {/* Phase 2: Freeze + Glitch (1.0-1.6) */}
      <Sprite start={1.0} end={1.7}>
        {({ progress }) => {
          // Time-stop overlay with chromatic shift
          const opacity = progress < 0.3 ? progress / 0.3 : (progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1);
          const shake = Math.sin(progress * Math.PI * 40) * 6;
          return (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.4)',
              opacity, pointerEvents: 'none',
              transform: `translate(${shake}px, 0)`,
              mixBlendMode: 'multiply',
            }} />
          );
        }}
      </Sprite>
      <Sprite start={1.3} end={1.7}>
        <CrackLinesMisread cx={640} cy={360} />
      </Sprite>
      <Sprite start={1.3} end={1.65}>
        <WhiteFlash peak={0.4} duration={0.4} color="#fff" />
      </Sprite>

      {/* Phase 3: Red splash + "ミスリード!" (1.5-3.0) */}
      <Sprite start={1.55} end={3.5}>
        <RedSplash intensity={0.85} />
      </Sprite>
      <Sprite start={1.65} end={3.5}>
        {({ progress }) => {
          // Big shake-in
          let opacity, scale, rotate;
          if (progress < 0.12) {
            const k = Easing.easeOutBack(progress / 0.12);
            opacity = k; scale = 2.5 - k * 1.0; rotate = -15;
          } else if (progress < 0.22) {
            const k = (progress - 0.12) / 0.1;
            opacity = 1; scale = 1.5 - k * 0.3 + Math.sin(k * Math.PI * 4) * 0.04;
            rotate = -10 + Math.sin(k * Math.PI * 6) * 3;
          } else if (progress > 0.85) {
            const k = (progress - 0.85) / 0.15;
            opacity = 1 - k; scale = 1.2 - k * 0.1; rotate = -8 - k * 5;
          } else {
            opacity = 1; scale = 1.2; rotate = -8;
          }
          return (
            <div style={{
              position: 'absolute', left: 640, top: 360,
              transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
              opacity, pointerEvents: 'none',
            }}>
              <div style={{
                fontFamily: "'Hiragino Mincho ProN', serif",
                fontWeight: 900, fontSize: 130,
                color: '#fff',
                background: '#c41818',
                padding: '12px 50px',
                border: '5px solid #fff',
                letterSpacing: '0.15em',
                boxShadow: '0 0 60px rgba(196,24,24,0.95), 0 16px 32px rgba(0,0,0,0.7)',
                WebkitTextStroke: '2px #1a0a0a',
                textShadow: '4px 4px 0 rgba(0,0,0,0.4)',
              }}>
                ミスリード
              </div>
              <div style={{
                marginTop: 8, textAlign: 'center',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 14,
                color: '#fff',
                letterSpacing: '0.5em',
                textShadow: '0 0 10px #c41818',
              }}>
                M I S R E A D
              </div>
            </div>
          );
        }}
      </Sprite>

      {/* "−1 証拠" displaced text */}
      <Sprite start={2.0} end={3.8}>
        {({ progress }) => {
          let opacity = 1, ty = 0;
          if (progress < 0.2) { const k = progress / 0.2; opacity = k; ty = -(1 - k) * 20; }
          else if (progress > 0.85) { opacity = 1 - (progress - 0.85) / 0.15; }
          return (
            <div style={{
              position: 'absolute', top: 565, left: 0, right: 0, textAlign: 'center',
              opacity, transform: `translateY(${ty}px)`,
            }}>
              <div style={{
                display: 'inline-block', padding: '6px 18px',
                fontFamily: "'Hiragino Kaku Gothic ProN', sans-serif",
                fontSize: 22, fontWeight: 700,
                color: '#fff',
                background: 'rgba(196,24,24,0.85)',
                letterSpacing: '0.15em',
                textDecoration: 'line-through',
                textDecorationThickness: '2px',
              }}>
                証拠は獲得できなかった
              </div>
            </div>
          );
        }}
      </Sprite>

      <div style={{
        position: 'absolute', left: 24, top: 18,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        color: 'rgba(196,24,24,0.6)', letterSpacing: '0.15em',
      }}>
        MISREAD · FALSE-POSITIVE FLIP
      </div>
    </Stage>
  );
}

function PartnerCardMisreadA() {
  const time = useTime();
  // 0-1.0: gentle bob + green
  // 1.0-1.3: freeze (no motion)
  // 1.3-1.6: shake
  // 1.6+: red highlight, dimmed
  let rotate = 0, glow = 0, dx = 0, dy = 0, highlight = null;

  if (time < 1.0) {
    rotate = Math.sin(time * 3) * 0.8;
    glow = 1;
    highlight = '#44dd99';
  } else if (time < 1.3) {
    rotate = 0;
    glow = 1;
    highlight = '#44dd99';
  } else if (time < 1.7) {
    dx = Math.sin(time * 70) * 6;
    dy = Math.sin(time * 90) * 3;
    glow = 0.4;
    highlight = '#c41818';
  } else if (time < 3.0) {
    glow = 0.5;
    highlight = '#c41818';
    rotate = -2;
  } else {
    glow = 0.3;
    highlight = '#c41818';
    rotate = -2;
  }

  return (
    <div style={{
      position: 'absolute', left: 540 + dx, top: 250 + dy,
      width: 200, height: 280,
      transform: `rotate(${rotate}deg)`,
      filter: glow > 0
        ? `drop-shadow(0 0 ${10 + glow * 24}px ${highlight}) drop-shadow(0 0 5px ${highlight})`
        : 'drop-shadow(0 8px 16px rgba(0,0,0,0.6))',
    }}>
      <DummyCard
        w={200} h={280}
        color="partner"
        name="探偵 / 工藤"
        ap={5} cost={3}
        art="silhouette"
        highlight={highlight}
      />
    </div>
  );
}

function CrackLinesMisread({ cx, cy }) {
  const { progress } = useSprite();
  // diagonal-ish cracks across the whole screen
  const k = Easing.easeOutCubic(Math.min(1, progress / 0.5));
  const seeds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const lines = [];
  seeds.forEach((i) => {
    const angle = (i / seeds.length) * Math.PI * 2 + Math.sin(i * 1.7) * 0.3;
    const len = (400 + (i * 53) % 300) * k;
    const segs = 5;
    let path = `M ${cx} ${cy}`;
    for (let s = 1; s <= segs; s++) {
      const r = (len / segs) * s;
      const wob = (Math.sin(i * 1.7 + s * 2.1)) * 14;
      const x = cx + Math.cos(angle + wob * 0.01) * r + wob * 0.5;
      const y = cy + Math.sin(angle + wob * 0.01) * r + wob;
      path += ` L ${x} ${y}`;
    }
    lines.push(path);
  });
  const opacity = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
  return (
    <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} viewBox="0 0 1280 720">
      {lines.map((d, i) => (
        <path key={`b${i}`} d={d} stroke="#000" strokeWidth="4" fill="none" opacity={opacity * 0.7} />
      ))}
      {lines.map((d, i) => (
        <path key={`w${i}`} d={d} stroke="#fff" strokeWidth="1.5" fill="none" opacity={opacity} />
      ))}
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Misread B — Mirror flip: "真相" reverses to "ミスリード"
// Beats:
//   0-0.5s: "真相" text rises, gold
//   0.5-1.6s: hold, gentle shimmer
//   1.6-2.0s: text begins to spin Y-axis
//   2.0-2.3s: at 90°, brief darkness flash
//   2.3-2.6s: text reverses out, now red and reads ミスリード
//   2.6-4.0s: hold ミスリード with red haze
function MisreadSceneB() {
  return (
    <Stage width={1280} height={720} duration={4.0} background="#050810" persistKey="misread-b">
      <PlaymatBgMisread />

      {/* "真相" rises (0-1.6) */}
      <Sprite start={0} end={2.0}>
        {({ progress }) => {
          let opacity, scale, ty;
          // entry 0-0.2
          if (progress < 0.2) {
            const k = Easing.easeOutBack(progress / 0.2);
            opacity = k; scale = 0.5 + 0.5 * k; ty = (1 - k) * 60;
          } else if (progress > 0.7) {
            // start spinning out (handled in next sprite); fade
            opacity = 1 - (progress - 0.7) / 0.3 * 0.5;
            scale = 1;
            ty = 0;
          } else {
            opacity = 1;
            scale = 1 + Math.sin(progress * Math.PI * 4) * 0.015;
            ty = 0;
          }
          return (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: 280, textAlign: 'center',
              opacity, transform: `translateY(${ty}px) scale(${scale})`,
            }}>
              <div style={{
                display: 'inline-block',
                fontFamily: "'Hiragino Mincho ProN', serif",
                fontSize: 160, fontWeight: 900,
                color: '#ffd75e',
                letterSpacing: '0.2em',
                textShadow: '0 0 40px rgba(255,215,94,0.9), 6px 6px 0 rgba(140,90,0,0.6)',
                WebkitTextStroke: '2px rgba(140,90,0,0.5)',
              }}>
                真相
              </div>
              <div style={{
                marginTop: 8,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 16,
                color: 'rgba(255,215,94,0.85)',
                letterSpacing: '0.5em',
              }}>
                T  R  U  T  H
              </div>
            </div>
          );
        }}
      </Sprite>

      {/* Gold halo behind */}
      <Sprite start={0.3} end={1.7}>
        <GoldHalo x={640} y={380} r={300} color="#ffd75e" strength={0.7} />
      </Sprite>
      <Sprite start={0.3} end={1.7}>
        <Particles x={640} y={420} count={20} color="#ffd75e" spread={350} rise={200} />
      </Sprite>

      {/* Y-axis spin transition (1.6-2.4) */}
      <Sprite start={1.5} end={2.6}>
        {({ progress }) => {
          // The spinning element
          const rotY = progress * 180;
          // The face shown depends on the side; we hard-fade colors at midpoint
          const isFlipped = rotY > 90;
          const color = isFlipped ? '#c41818' : '#ffd75e';
          const text = isFlipped ? 'ミスリード' : '真相';
          const fontSize = isFlipped ? 100 : 160;
          // Brightness halved near midpoint for dramatic
          const mid = Math.abs(rotY - 90) / 90;
          const brightness = 0.3 + mid * 0.7;
          return (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: 280, textAlign: 'center',
              perspective: 1000,
            }}>
              <div style={{
                display: 'inline-block',
                transform: `rotateY(${rotY}deg) scale(${isFlipped ? -1 : 1}, 1)`,
                transformStyle: 'preserve-3d',
                filter: `brightness(${brightness})`,
              }}>
                <div style={{
                  fontFamily: "'Hiragino Mincho ProN', serif",
                  fontSize, fontWeight: 900,
                  color,
                  letterSpacing: '0.15em',
                  textShadow: `0 0 40px ${color}, 6px 6px 0 rgba(40,0,0,0.6)`,
                  WebkitTextStroke: '2px rgba(40,0,0,0.5)',
                  whiteSpace: 'nowrap',
                }}>
                  {text}
                </div>
              </div>
            </div>
          );
        }}
      </Sprite>

      {/* Brief darkness flash at midpoint */}
      <Sprite start={1.95} end={2.15}>
        <div style={{ position: 'absolute', inset: 0, background: '#000', pointerEvents: 'none' }} />
      </Sprite>

      {/* "ミスリード" stable display 2.5-4.0 */}
      <Sprite start={2.4} end={4.0}>
        <RedSplash intensity={0.7} />
      </Sprite>
      <Sprite start={2.4} end={4.0}>
        {({ progress }) => {
          let opacity = 1, scale = 1, shake = 0;
          if (progress < 0.1) {
            const k = Easing.easeOutBack(progress / 0.1);
            opacity = k; scale = 1.3 - 0.3 * k;
            shake = (1 - k) * 8;
          } else if (progress > 0.9) {
            opacity = 1 - (progress - 0.9) / 0.1;
          } else {
            const k = (progress - 0.1) / 0.8;
            scale = 1 + Math.sin(k * Math.PI * 6) * 0.02;
            shake = Math.sin(k * 80) * 1;
          }
          return (
            <React.Fragment>
              <div style={{
                position: 'absolute', left: 0, right: 0, top: 300, textAlign: 'center',
                opacity, transform: `translateX(${shake}px) scale(${scale})`,
              }}>
                <div style={{
                  display: 'inline-block',
                  fontFamily: "'Hiragino Mincho ProN', serif",
                  fontSize: 120, fontWeight: 900,
                  color: '#fff',
                  background: '#c41818',
                  padding: '8px 36px',
                  border: '5px solid #fff',
                  letterSpacing: '0.15em',
                  textShadow: '4px 4px 0 rgba(0,0,0,0.5)',
                  boxShadow: '0 0 50px rgba(196,24,24,0.95)',
                  WebkitTextStroke: '2px #1a0a0a',
                  transform: 'rotate(-3deg)',
                }}>
                  ミスリード
                </div>
                <div style={{
                  marginTop: 16,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 16,
                  color: '#ff5d5d',
                  letterSpacing: '0.5em',
                }}>
                  M I S R E A D
                </div>
              </div>
            </React.Fragment>
          );
        }}
      </Sprite>

      {/* Mini partner shown in corner for context */}
      <div style={{
        position: 'absolute', right: 80, bottom: 60,
        width: 110, height: 154,
        filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.6))',
        opacity: 0.6,
      }}>
        <DummyCard w={110} h={154} color="partner" name="工藤" ap={5} cost={3} art="silhouette" />
      </div>

      <div style={{
        position: 'absolute', left: 24, top: 18,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        color: 'rgba(255,215,94,0.5)', letterSpacing: '0.15em',
      }}>
        MISREAD · MIRROR FLIP
      </div>
    </Stage>
  );
}

Object.assign(window, { MisreadSceneA, MisreadSceneB });
