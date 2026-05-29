// 05-scenes-hirameki.jsx
// Hirameki (insight) scenes — the moment a detective "gets it".

// ──────────────────────────────────────────────────────────────────────
// Helper: a stylized board background that mimics the conan TCG playmat
// (subtle, just enough to ground the scene in "a game is happening")
function PlaymatBg({ children }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse at 50% 40%, #0e1828 0%, #050810 75%),
          linear-gradient(180deg, #060a12, #020306)
        `,
        overflow: 'hidden',
      }}
    >
      {/* subtle hex/grid pattern */}
      <svg style={{ position: 'absolute', inset: 0, opacity: 0.06 }} viewBox="0 0 1280 720">
        <defs>
          <pattern id="hex-bg-h" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
            <path d="M30 0 L60 15 L60 37 L30 52 L0 37 L0 15 Z" fill="none" stroke="#4ec3ff" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="1280" height="720" fill="url(#hex-bg-h)" />
      </svg>
      {children}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Hirameki A — Classic detective insight
// Beats: 0.0-0.5s establish, 0.5-1.2s card lifts, 1.2-1.5s sparkle pop,
//        1.5-2.3s halo + particles + "ヒラメキ!" text, 2.3-3.5s settle.
function HiramekiSceneA() {
  return (
    <Stage width={1280} height={720} duration={3.5} background="#050810" persistKey="hirameki-a">
      <PlaymatBg>
        {/* Backboard label so we know which is the partner zone */}
        <div style={{
          position: 'absolute',
          left: 80, top: 60,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          color: 'rgba(255,215,94,0.6)',
          letterSpacing: '0.15em',
        }}>
          PARTNER ZONE
        </div>

        {/* The partner card — rises during 0.2-1.0s, hovers 1.0-2.8s, settles 2.8-3.5s */}
        <PartnerCardLifted />

        {/* Sparkle flash on the card at 1.3s */}
        <Sprite start={1.2} end={1.9}>
          <SparkleFlash x={640} y={290} size={260} color="#fff" />
        </Sprite>

        {/* Gold halo on partner during the insight */}
        <Sprite start={1.4} end={2.8}>
          <GoldHalo x={640} y={360} r={260} color="#ffd75e" strength={0.9} />
        </Sprite>

        {/* Pulse rings out from card */}
        <Sprite start={1.4} end={2.6}>
          <PulseGlow x={640} y={360} color="#ffd75e" max={420} count={2} />
        </Sprite>

        {/* Gold particles rising */}
        <Sprite start={1.5} end={3.2}>
          <Particles x={640} y={420} count={20} color="#ffd75e" spread={300} rise={300} />
        </Sprite>

        {/* "ヒラメキ!" text — slides up from below the card */}
        <Sprite start={1.6} end={3.2}>
          {({ progress }) => {
            // entry: slide up + fade in (0..0.15)
            // hold: 0.15..0.85
            // exit: 0.85..1
            let y = 540, opacity = 0, scale = 0.7;
            if (progress < 0.15) {
              const k = Easing.easeOutBack(progress / 0.15);
              y = 540 + (1 - k) * 60;
              opacity = k;
              scale = 0.7 + 0.3 * k;
            } else if (progress > 0.85) {
              const k = (progress - 0.85) / 0.15;
              opacity = 1 - k;
              y = 540 - k * 10;
              scale = 1;
            } else {
              opacity = 1;
              scale = 1 + Math.sin((progress - 0.15) * Math.PI * 6) * 0.015;
            }
            return (
              <div style={{
                position: 'absolute',
                left: 0, right: 0,
                top: y,
                textAlign: 'center',
                opacity,
                transform: `scale(${scale})`,
                transformOrigin: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{
                  display: 'inline-block',
                  fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', serif",
                  fontSize: 72,
                  fontWeight: 900,
                  color: '#ffd75e',
                  letterSpacing: '0.15em',
                  textShadow: '0 0 24px rgba(255,215,94,0.85), 0 0 8px rgba(255,255,255,0.8), 0 6px 0 rgba(140,90,0,0.4)',
                  WebkitTextStroke: '1.5px rgba(140,90,0,0.4)',
                }}>
                  ヒラメキ!
                </div>
                <div style={{
                  marginTop: 6,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  color: 'rgba(255,215,94,0.8)',
                  letterSpacing: '0.4em',
                }}>
                  HIRAMEKI · INSIGHT
                </div>
              </div>
            );
          }}
        </Sprite>

        {/* Light beam from above */}
        <Sprite start={1.3} end={2.6}>
          {({ progress }) => {
            const opacity = progress < 0.2 ? progress / 0.2 : (progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1);
            return (
              <div style={{
                position: 'absolute',
                left: 540, top: 0,
                width: 200, height: 460,
                background: 'linear-gradient(180deg, rgba(255,215,94,0.5), rgba(255,215,94,0))',
                opacity: opacity * 0.6,
                filter: 'blur(20px)',
                pointerEvents: 'none',
              }} />
            );
          }}
        </Sprite>
      </PlaymatBg>
    </Stage>
  );
}

// Partner card that lifts + bobs during the scene
function PartnerCardLifted() {
  const time = useTime();
  // beats:
  // 0.0-0.2s: idle
  // 0.2-1.0s: rise from y=380 to y=300 (anticipation easeOutBack)
  // 1.0-2.8s: hover with subtle bob
  // 2.8-3.5s: settle back to y=380
  let y = 380;
  let scale = 1;
  let glow = 0;
  let rotateY = 0;
  if (time < 0.2) {
    y = 380;
  } else if (time < 1.0) {
    const k = Easing.easeOutBack((time - 0.2) / 0.8);
    y = 380 - k * 80;
    scale = 1 + k * 0.05;
    rotateY = k * 6;
  } else if (time < 2.8) {
    y = 300 + Math.sin((time - 1.0) * 2.5) * 4;
    scale = 1.05;
    glow = (time > 1.2 && time < 2.6) ? 0.9 : 0;
    rotateY = 6 + Math.sin((time - 1.0) * 1.5) * 1.5;
  } else {
    const k = Easing.easeInOutCubic((time - 2.8) / 0.7);
    y = 300 + k * 80;
    scale = 1.05 - k * 0.05;
    rotateY = 6 - k * 6;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 540, top: y,
        width: 200, height: 280,
        transform: `scale(${scale}) rotateY(${rotateY}deg)`,
        transformOrigin: 'center bottom',
        transition: 'none',
        filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.7))',
      }}
    >
      <DummyCard
        w={200} h={280}
        color="partner"
        name="探偵 / 工藤"
        ap={5} cost={3}
        art="silhouette"
        glow={glow}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Hirameki B — Electric lightning insight
// Beats: 0-0.5s establish dim, 0.5-0.7s screen flash + lightning,
//        0.7-1.8s silhouette + "INSIGHT" text, 1.8-3.5s settle.
function HiramekiSceneB() {
  return (
    <Stage width={1280} height={720} duration={3.5} background="#050810" persistKey="hirameki-b">
      <PlaymatBg>
        {/* Partner card always visible */}
        <PartnerCardElectric />

        {/* Lightning flash at 0.6s */}
        <Sprite start={0.55} end={0.95}>
          <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 1, pointerEvents: 'none' }}>
            {/* fade via WhiteFlash */}
          </div>
          <WhiteFlash peak={0.15} duration={0.5} color="#dde8ff" />
        </Sprite>

        {/* Lightning bolt streak */}
        <Sprite start={0.5} end={1.2}>
          <LightningStreak from={[1280, 0]} to={[640, 360]} color="#dde8ff" jitter={28} />
        </Sprite>
        <Sprite start={0.65} end={1.3}>
          <LightningStreak from={[0, 0]} to={[640, 360]} color="#aaccff" jitter={22} />
        </Sprite>

        {/* Dim everything else after the flash */}
        <Sprite start={0.8} end={3.0}>
          {({ progress }) => {
            const opacity = progress < 0.15 ? progress / 0.15 : (progress > 0.85 ? 1 - (progress - 0.85) / 0.15 : 1);
            return (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(8,16,30,0.75)',
                opacity,
                pointerEvents: 'none',
              }} />
            );
          }}
        </Sprite>

        {/* Electric blue halo pulsing */}
        <Sprite start={0.8} end={3.0}>
          <GoldHalo x={640} y={400} r={320} color="#4ec3ff" strength={0.85} />
        </Sprite>

        {/* INSIGHT text */}
        <Sprite start={0.9} end={3.0}>
          {({ progress }) => {
            // entry slide + flicker; hold; exit
            let opacity, blur, ty;
            if (progress < 0.1) {
              const k = progress / 0.1;
              opacity = k * (Math.sin(k * 30) * 0.4 + 0.6); // flicker
              blur = (1 - k) * 8;
              ty = (1 - k) * 30;
            } else if (progress > 0.88) {
              const k = (progress - 0.88) / 0.12;
              opacity = 1 - k;
              blur = k * 8;
              ty = -k * 20;
            } else {
              opacity = 1;
              blur = 0;
              ty = 0;
            }
            return (
              <div style={{
                position: 'absolute',
                left: 0, right: 0,
                top: 560,
                textAlign: 'center',
                opacity,
                filter: `blur(${blur}px)`,
                transform: `translateY(${ty}px)`,
                pointerEvents: 'none',
              }}>
                <div style={{
                  display: 'inline-block',
                  fontFamily: 'Trajan Pro, Cinzel, serif',
                  fontSize: 88,
                  fontWeight: 900,
                  color: '#dde8ff',
                  letterSpacing: '0.4em',
                  textShadow: '0 0 30px #4ec3ff, 0 0 10px #fff, 0 0 60px #4ec3ff',
                }}>
                  INSIGHT
                </div>
                <div style={{
                  marginTop: 4,
                  fontFamily: "'Hiragino Mincho ProN', serif",
                  fontSize: 18,
                  color: '#aaccff',
                  letterSpacing: '0.5em',
                }}>
                  閃 — ひらめき
                </div>
              </div>
            );
          }}
        </Sprite>

        {/* Backboard label */}
        <div style={{
          position: 'absolute',
          left: 80, top: 60,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          color: 'rgba(78,195,255,0.5)',
          letterSpacing: '0.15em',
        }}>
          PARTNER ZONE · electric variant
        </div>
      </PlaymatBg>
    </Stage>
  );
}

function PartnerCardElectric() {
  const time = useTime();
  // Card stays in place but rotates/glitches slightly during flash
  let glow = 0;
  let glitch = 0;
  let rotate = 0;
  if (time < 0.5) {
    glow = 0;
  } else if (time < 0.9) {
    glow = (time - 0.5) / 0.4;
    glitch = Math.sin(time * 80) * 2;
  } else if (time < 2.6) {
    glow = 1;
    glitch = Math.sin(time * 12) * 1;
    rotate = Math.sin(time * 4) * 1;
  } else {
    glow = Math.max(0, 1 - (time - 2.6) / 0.9);
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 540 + glitch, top: 240,
        width: 200, height: 280,
        transform: `rotate(${rotate}deg)`,
        filter: glow > 0
          ? `drop-shadow(0 0 ${15 + glow * 30}px rgba(78,195,255,0.9)) drop-shadow(0 0 8px #fff)`
          : 'drop-shadow(0 8px 16px rgba(0,0,0,0.6))',
      }}
    >
      <DummyCard
        w={200} h={280}
        color="partner"
        name="探偵 / 工藤"
        ap={5} cost={3}
        art="silhouette"
        highlight={glow > 0.3 ? '#4ec3ff' : null}
      />
    </div>
  );
}

Object.assign(window, { HiramekiSceneA, HiramekiSceneB });
