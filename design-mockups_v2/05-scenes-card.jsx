// 05-scenes-card.jsx
// Master Duel-style card effect activation. Two variants × three intensity levels.

// ──────────────────────────────────────────────────────────────────────
// Shared: a row of hand cards. The "active" card is the one being activated.
// In Lv3, other cards fade out. In Lv1/2, they stay but dim.
function HandRow({ activeIdx = 2, dim = 0.6, hide = 0 }) {
  const cards = [
    { color: 'blue', name: '少年探偵団', ap: 2, cost: 1, art: 'footprint' },
    { color: 'yellow', name: '蘭', ap: 3, cost: 2, art: 'silhouette' },
    { color: 'red', name: '怪盗キッド', ap: 4, cost: 3, art: 'magnifier' }, // active
    { color: 'blue', name: '阿笠博士', ap: 1, cost: 2, art: 'fingerprint' },
    { color: 'yellow', name: '園子', ap: 2, cost: 1, art: 'silhouette' },
  ];
  const cardW = 150;
  const cardH = 210;
  const gap = 22;
  const totalW = cards.length * cardW + (cards.length - 1) * gap;
  const startX = (1280 - totalW) / 2;
  const handY = 720 - cardH - 30;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {cards.map((card, i) => {
        if (i === activeIdx) return null; // rendered separately by the activation overlay
        const x = startX + i * (cardW + gap);
        // Slight arc — outer cards tilt
        const tilt = (i - 2) * 4;
        const y = handY + Math.abs(i - 2) * 6;
        const opacity = (1 - hide) * dim;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x, top: y,
              width: cardW, height: cardH,
              transform: `rotate(${tilt}deg)`,
              transformOrigin: 'center 110%',
              filter: 'grayscale(0.6) brightness(0.55)',
              opacity,
              transition: 'none',
            }}
          >
            <DummyCard
              w={cardW} h={cardH}
              color={card.color}
              name={card.name}
              ap={card.ap}
              cost={card.cost}
              art={card.art}
            />
          </div>
        );
      })}
    </div>
  );
}

// The card-effect banner that slides in. Master Duel style: black with gold trim.
function EffectBanner({ progress, name = '怪盗キッド', text = '相手は手札 1 枚をリムーブする。', level = 2 }) {
  // entry 0..0.15, hold ..0.85, exit ..1
  let x = 1400, opacity = 0;
  if (progress < 0.12) {
    const k = Easing.easeOutCubic(progress / 0.12);
    x = 1400 - k * 1200;
    opacity = k;
  } else if (progress > 0.82) {
    const k = (progress - 0.82) / 0.18;
    x = 200 + Easing.easeInCubic(k) * 1400;
    opacity = 1 - k;
  } else {
    x = 200;
    opacity = 1;
  }
  return (
    <div style={{
      position: 'absolute',
      left: x, top: 600,
      width: 880,
      opacity,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'relative',
        background: 'linear-gradient(90deg, rgba(20,16,8,0.96), rgba(30,22,10,0.96))',
        border: '2px solid #ffd75e',
        borderRadius: '0 24px 0 24px',
        padding: '14px 26px 14px 80px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.7), inset 0 0 30px rgba(255,215,94,0.15)',
      }}>
        {/* Left accent: diamond */}
        <div style={{
          position: 'absolute',
          left: 20, top: '50%',
          width: 36, height: 36,
          marginTop: -18,
          background: '#ffd75e',
          transform: 'rotate(45deg)',
          boxShadow: '0 0 18px #ffd75e',
        }} />
        <div style={{
          position: 'absolute',
          left: 30, top: '50%',
          width: 16, height: 16,
          marginTop: -8,
          background: '#1a1208',
          transform: 'rotate(45deg)',
        }} />
        {/* Name */}
        <div style={{
          fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', serif",
          fontSize: 24,
          fontWeight: 800,
          color: '#ffd75e',
          letterSpacing: '0.1em',
          textShadow: '0 0 8px rgba(255,215,94,0.5)',
          marginBottom: 2,
        }}>
          {name}
        </div>
        {/* Effect text */}
        <div style={{
          fontFamily: "'Hiragino Kaku Gothic ProN', sans-serif",
          fontSize: 14,
          color: '#f0e0b8',
          letterSpacing: '0.05em',
        }}>
          {text}
        </div>
        {/* Level indicator */}
        <div style={{
          position: 'absolute',
          right: 16, top: 8,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: 'rgba(255,215,94,0.55)',
          letterSpacing: '0.15em',
        }}>
          LV{level}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Card Activation A — Master Duel classic: golden halo + lift + banner
function CardActivationSceneA({ level = 2 }) {
  // Tuning per level
  const params = {
    1: { lift: 35, scale: 1.06, halo: 0.6, particles: 12, dim: 0.55, screenDim: 0, banner: false, activeWindow: [0.5, 1.5], holdEnd: 1.3 },
    2: { lift: 90, scale: 1.18, halo: 1.0, particles: 28, dim: 0.4, screenDim: 0.3, banner: true, activeWindow: [0.5, 3.5], holdEnd: 3.0 },
    3: { lift: 0, scale: 2.0, halo: 1.3, particles: 50, dim: 0, screenDim: 0.75, banner: true, activeWindow: [0.5, 4.2], holdEnd: 4.0, cinematic: true },
  }[level] || {};

  return (
    <Stage width={1280} height={720} duration={5.0} background="#050810" persistKey={`card-a-lv${level}`}>
      <PlaymatBg2 />

      {/* Establish: full hand (0.0-0.5s) */}
      <Sprite start={0} end={5.0} keepMounted>
        <HandRow activeIdx={2} dim={params.dim} hide={params.cinematic ? 0 : 0} />
      </Sprite>

      {/* Screen darken (Lv3) */}
      <Sprite start={0.5} end={params.holdEnd + 0.5}>
        {({ progress }) => {
          let opacity = 0;
          if (progress < 0.15) opacity = (progress / 0.15) * params.screenDim;
          else if (progress > 0.85) opacity = (1 - (progress - 0.85) / 0.15) * params.screenDim;
          else opacity = params.screenDim;
          return (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.95) 70%)',
              opacity,
              pointerEvents: 'none',
            }} />
          );
        }}
      </Sprite>

      {/* The active card during activation window */}
      <Sprite start={params.activeWindow[0]} end={params.activeWindow[1]}>
        <ActiveCardA level={level} params={params} />
      </Sprite>

      {/* Banner — only Lv2+ */}
      {params.banner && (
        <Sprite start={0.7} end={params.holdEnd + 0.3}>
          <BannerWrap text="相手は手札 1 枚をリムーブする。" name="怪盗キッド" level={level} />
        </Sprite>
      )}

      {/* Particles burst out of card during activation */}
      <Sprite start={0.7} end={params.holdEnd}>
        <Particles
          x={640}
          y={params.cinematic ? 360 : 470}
          count={params.particles}
          color="#ffd75e"
          spread={params.cinematic ? 350 : 200}
          rise={params.cinematic ? 320 : 250}
        />
      </Sprite>

      {/* Pulse rings */}
      {level >= 2 && (
        <Sprite start={0.7} end={params.holdEnd}>
          <PulseGlow
            x={640}
            y={params.cinematic ? 360 : 470}
            color="#ffd75e"
            max={params.cinematic ? 500 : 260}
            count={params.cinematic ? 4 : 2}
          />
        </Sprite>
      )}

      {/* Lv3: cinematic "EFFECT ACTIVATE" overhead title */}
      {params.cinematic && (
        <Sprite start={0.55} end={3.5}>
          {({ progress }) => {
            let opacity = 1, ty = 0;
            if (progress < 0.1) { ty = -40 * (1 - progress / 0.1); opacity = progress / 0.1; }
            else if (progress > 0.9) { opacity = 1 - (progress - 0.9) / 0.1; }
            return (
              <div style={{
                position: 'absolute',
                top: 60, left: 0, right: 0,
                textAlign: 'center',
                opacity,
                transform: `translateY(${ty}px)`,
              }}>
                <div style={{
                  display: 'inline-block',
                  fontFamily: 'Trajan Pro, Cinzel, serif',
                  fontSize: 36,
                  fontWeight: 900,
                  color: '#ffd75e',
                  letterSpacing: '0.5em',
                  textShadow: '0 0 20px rgba(255,215,94,0.7)',
                }}>
                  EFFECT
                </div>
                <div style={{
                  fontFamily: "'Hiragino Mincho ProN', serif",
                  fontSize: 14,
                  color: 'rgba(255,215,94,0.7)',
                  letterSpacing: '0.4em',
                  marginTop: 4,
                }}>
                  カード効果発動
                </div>
              </div>
            );
          }}
        </Sprite>
      )}

      {/* Backboard label */}
      <div style={{
        position: 'absolute',
        left: 24, top: 18,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        color: 'rgba(255,215,94,0.5)',
        letterSpacing: '0.15em',
      }}>
        HAND · CARD ACTIVATION · LV{level}
      </div>
    </Stage>
  );
}

function ActiveCardA({ level, params }) {
  const { progress, localTime, duration } = useSprite();
  const cinematic = params.cinematic;

  // Card position
  const handX = (1280 - (5 * 150 + 4 * 22)) / 2 + 2 * (150 + 22); // index 2
  const handY = 720 - 210 - 30 + 12; // active card slight offset
  const centerX = 640 - (cinematic ? 150 : 75);
  const centerY = cinematic ? 360 - 230 : handY - params.lift;

  // Sub-beats:
  // 0..0.12 lift in (anticipation)
  // 0.12..0.85 hold (with breathing)
  // 0.85..1.0 return
  let x, y, scale, rotateY, glow;

  if (progress < 0.12) {
    const k = Easing.easeOutBack(progress / 0.12);
    if (cinematic) {
      x = handX + (centerX - handX) * k;
      y = handY + (centerY - handY) * k;
      scale = 1 + (params.scale - 1) * k;
    } else {
      x = handX;
      y = handY - params.lift * k;
      scale = 1 + (params.scale - 1) * k;
    }
    rotateY = k * (cinematic ? -8 : -6);
    glow = k * params.halo;
  } else if (progress > 0.85) {
    const k = Easing.easeInCubic((progress - 0.85) / 0.15);
    if (cinematic) {
      x = handX + (centerX - handX) * (1 - k);
      y = handY + (centerY - handY) * (1 - k);
      scale = 1 + (params.scale - 1) * (1 - k);
    } else {
      x = handX;
      y = handY - params.lift * (1 - k);
      scale = 1 + (params.scale - 1) * (1 - k);
    }
    rotateY = (1 - k) * (cinematic ? -8 : -6);
    glow = (1 - k) * params.halo;
  } else {
    if (cinematic) {
      x = centerX;
      y = centerY;
      scale = params.scale;
    } else {
      x = handX;
      y = handY - params.lift;
      scale = params.scale;
    }
    // breathing
    const bob = Math.sin((progress - 0.12) * Math.PI * 4);
    rotateY = cinematic ? -8 + bob * 1.5 : -6 + bob * 1.2;
    y += bob * 3;
    glow = params.halo + Math.sin((progress - 0.12) * Math.PI * 6) * 0.05;
  }

  return (
    <React.Fragment>
      {/* Halo behind the card */}
      <div style={{
        position: 'absolute',
        left: x + 75 - 200,
        top: y + 105 - 200,
        width: 400, height: 400,
        borderRadius: '50%',
        background: cinematic
          ? `radial-gradient(circle, rgba(255,215,94,${0.7 * glow}) 0%, rgba(255,215,94,${0.4 * glow}) 25%, rgba(255,215,94,0) 65%)`
          : `radial-gradient(circle, rgba(255,215,94,${0.5 * glow}) 0%, rgba(255,215,94,${0.25 * glow}) 30%, rgba(255,215,94,0) 65%)`,
        mixBlendMode: 'screen',
        pointerEvents: 'none',
      }} />
      {/* Card */}
      <div style={{
        position: 'absolute',
        left: x, top: y,
        width: cinematic ? 300 : 150,
        height: cinematic ? 420 : 210,
        transform: `scale(${scale}) rotateY(${rotateY}deg)`,
        transformOrigin: 'center center',
        filter: glow > 0
          ? `drop-shadow(0 0 ${12 + glow * 30}px rgba(255,215,94,0.9)) drop-shadow(0 0 5px #fff)`
          : 'drop-shadow(0 12px 24px rgba(0,0,0,0.8))',
      }}>
        <DummyCard
          w={cinematic ? 300 : 150}
          h={cinematic ? 420 : 210}
          color="red"
          name="怪盗キッド"
          ap={4} cost={3}
          art="magnifier"
          highlight="#ffd75e"
        />
      </div>
    </React.Fragment>
  );
}

function BannerWrap({ text, name, level }) {
  const { progress } = useSprite();
  return <EffectBanner progress={progress} text={text} name={name} level={level} />;
}

// Local playmat background for card scenes (slightly different feel)
function PlaymatBg2() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `
        radial-gradient(ellipse at 50% 40%, #142030 0%, #050810 70%),
        linear-gradient(180deg, #060a12, #020306)
      `,
    }}>
      {/* card row separator line */}
      <div style={{
        position: 'absolute',
        bottom: 250, left: 0, right: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,215,94,0.2), transparent)',
      }} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Card Activation B — Conan flavor: magnifying glass + fingerprint
function CardActivationSceneB({ level = 2 }) {
  const params = {
    1: { lift: 30, scale: 1.06, fp: 0.4, mag: false, dim: 0.55, screenDim: 0, banner: false, activeWindow: [0.5, 1.5], holdEnd: 1.3 },
    2: { lift: 80, scale: 1.18, fp: 0.7, mag: true, dim: 0.4, screenDim: 0.3, banner: true, activeWindow: [0.4, 3.5], holdEnd: 3.0 },
    3: { lift: 0, scale: 2.0, fp: 1.0, mag: true, dim: 0, screenDim: 0.75, banner: true, activeWindow: [0.4, 4.2], holdEnd: 4.0, cinematic: true },
  }[level] || {};

  return (
    <Stage width={1280} height={720} duration={5.0} background="#050810" persistKey={`card-b-lv${level}`}>
      <PlaymatBg2 />

      {/* Fingerprint background fades in */}
      <Sprite start={0.35} end={params.holdEnd + 0.4}>
        {({ progress }) => {
          let opacity = 0;
          if (progress < 0.2) opacity = (progress / 0.2) * params.fp * 0.4;
          else if (progress > 0.8) opacity = (1 - (progress - 0.8) / 0.2) * params.fp * 0.4;
          else opacity = params.fp * 0.4;
          return (
            <div style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none' }}>
              <Fingerprint x={640} y={400} size={620} color="#c41818" opacity={1} t={progress} />
            </div>
          );
        }}
      </Sprite>

      {/* Hand */}
      <HandRow activeIdx={2} dim={params.dim} />

      {/* Screen darken */}
      <Sprite start={0.4} end={params.holdEnd + 0.4}>
        {({ progress }) => {
          let opacity = 0;
          if (progress < 0.15) opacity = (progress / 0.15) * params.screenDim;
          else if (progress > 0.85) opacity = (1 - (progress - 0.85) / 0.15) * params.screenDim;
          else opacity = params.screenDim;
          return (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.95) 70%)',
              opacity,
              pointerEvents: 'none',
            }} />
          );
        }}
      </Sprite>

      {/* Magnifier swoops in from off-screen, comes to rest near the card */}
      {params.mag && (
        <Sprite start={0.35} end={params.holdEnd}>
          <MagnifierSwoop level={level} cinematic={params.cinematic} />
        </Sprite>
      )}

      {/* Active card */}
      <Sprite start={params.activeWindow[0]} end={params.activeWindow[1]}>
        <ActiveCardB level={level} params={params} />
      </Sprite>

      {/* "!?" balloon (Lv2+) */}
      {level >= 2 && (
        <Sprite start={0.5} end={1.0}>
          {({ progress }) => {
            const scale = progress < 0.3 ? Easing.easeOutBack(progress / 0.3) : (progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1);
            const opacity = progress < 0.2 ? progress / 0.2 : (progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1);
            return (
              <div style={{
                position: 'absolute',
                left: 780, top: 380,
                opacity,
                transform: `scale(${scale}) rotate(-12deg)`,
                pointerEvents: 'none',
              }}>
                <div style={{
                  fontFamily: "'Hiragino Mincho ProN', serif",
                  fontWeight: 900,
                  fontSize: 110,
                  color: '#c41818',
                  textShadow: '4px 4px 0 #ffd75e, -2px -2px 0 #fff',
                  WebkitTextStroke: '2px #1a0a0a',
                }}>
                  !?
                </div>
              </div>
            );
          }}
        </Sprite>
      )}

      {/* Banner */}
      {params.banner && (
        <Sprite start={0.6} end={params.holdEnd + 0.3}>
          <BannerWrap text="相手は手札 1 枚をリムーブする。" name="怪盗キッド" level={level} />
        </Sprite>
      )}

      {/* Cinematic title */}
      {params.cinematic && (
        <Sprite start={0.5} end={3.5}>
          {({ progress }) => {
            let opacity = 1, ty = 0;
            if (progress < 0.1) { ty = -40 * (1 - progress / 0.1); opacity = progress / 0.1; }
            else if (progress > 0.9) { opacity = 1 - (progress - 0.9) / 0.1; }
            return (
              <div style={{
                position: 'absolute',
                top: 60, left: 0, right: 0,
                textAlign: 'center',
                opacity,
                transform: `translateY(${ty}px)`,
              }}>
                <div style={{
                  fontFamily: "'Hiragino Mincho ProN', serif",
                  fontSize: 40,
                  fontWeight: 900,
                  color: '#c41818',
                  letterSpacing: '0.4em',
                  textShadow: '0 0 16px #c41818, 4px 4px 0 #1a0a0a',
                }}>
                  カ ー ド 発 動
                </div>
              </div>
            );
          }}
        </Sprite>
      )}

      {/* Backboard label */}
      <div style={{
        position: 'absolute',
        left: 24, top: 18,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
        color: 'rgba(196,24,24,0.6)',
        letterSpacing: '0.15em',
      }}>
        HAND · CONAN-STYLE · LV{level}
      </div>
    </Stage>
  );
}

function MagnifierSwoop({ level, cinematic }) {
  const { progress } = useSprite();
  // swoop from top-right to hover near the card
  const startX = 1200, startY = 100;
  const endX = cinematic ? 750 : 750;
  const endY = cinematic ? 350 : 450;

  let x, y, opacity, r, angle;
  if (progress < 0.2) {
    const k = Easing.easeOutQuad(progress / 0.2);
    x = startX + (endX - startX) * k;
    y = startY + (endY - startY) * k;
    opacity = k;
    r = 120;
    angle = -45 + k * 5;
  } else if (progress > 0.85) {
    const k = (progress - 0.85) / 0.15;
    opacity = 1 - k;
    x = endX + k * 200;
    y = endY - k * 100;
    r = 120;
    angle = -40;
  } else {
    const k = (progress - 0.2) / 0.65;
    x = endX + Math.sin(k * Math.PI * 3) * 8;
    y = endY + Math.cos(k * Math.PI * 2) * 6;
    opacity = 1;
    r = 110 + Math.sin(k * Math.PI * 5) * 4;
    angle = -40 + Math.sin(k * Math.PI * 2) * 4;
  }
  return <MagnifierLens x={x} y={y} r={r} angle={angle} opacity={opacity} t={progress} />;
}

function ActiveCardB({ level, params }) {
  const { progress } = useSprite();
  const cinematic = params.cinematic;
  const handX = (1280 - (5 * 150 + 4 * 22)) / 2 + 2 * (150 + 22);
  const handY = 720 - 210 - 30 + 12;
  const centerX = 640 - (cinematic ? 150 : 75);
  const centerY = cinematic ? 360 - 210 : handY - params.lift;

  let x, y, scale, rotateY, glow, rotateZ;

  if (progress < 0.15) {
    const k = Easing.easeOutBack(progress / 0.15);
    if (cinematic) {
      x = handX + (centerX - handX) * k;
      y = handY + (centerY - handY) * k;
      scale = 1 + (params.scale - 1) * k;
    } else {
      x = handX;
      y = handY - params.lift * k;
      scale = 1 + (params.scale - 1) * k;
    }
    rotateY = k * (cinematic ? -8 : -6);
    rotateZ = k * 2;
    glow = k * 0.9;
  } else if (progress > 0.85) {
    const k = Easing.easeInCubic((progress - 0.85) / 0.15);
    if (cinematic) {
      x = handX + (centerX - handX) * (1 - k);
      y = handY + (centerY - handY) * (1 - k);
      scale = 1 + (params.scale - 1) * (1 - k);
    } else {
      x = handX;
      y = handY - params.lift * (1 - k);
      scale = 1 + (params.scale - 1) * (1 - k);
    }
    rotateY = (1 - k) * (cinematic ? -8 : -6);
    rotateZ = (1 - k) * 2;
    glow = (1 - k) * 0.9;
  } else {
    if (cinematic) {
      x = centerX;
      y = centerY;
      scale = params.scale;
    } else {
      x = handX;
      y = handY - params.lift;
      scale = params.scale;
    }
    const bob = Math.sin((progress - 0.15) * Math.PI * 5);
    rotateY = (cinematic ? -8 : -6) + bob * 1.5;
    rotateZ = 2 + bob * 0.8;
    y += bob * 3;
    glow = 0.9;
  }

  return (
    <React.Fragment>
      {/* Red highlight ring */}
      <div style={{
        position: 'absolute',
        left: x + (cinematic ? 150 : 75) - 200,
        top: y + (cinematic ? 210 : 105) - 200,
        width: 400, height: 400,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(196,24,24,${0.55 * glow}) 0%, rgba(196,24,24,${0.25 * glow}) 30%, rgba(196,24,24,0) 65%)`,
        mixBlendMode: 'screen',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        left: x, top: y,
        width: cinematic ? 300 : 150,
        height: cinematic ? 420 : 210,
        transform: `scale(${scale}) rotateY(${rotateY}deg) rotate(${rotateZ}deg)`,
        transformOrigin: 'center center',
        filter: glow > 0
          ? `drop-shadow(0 0 ${10 + glow * 24}px rgba(196,24,24,0.9)) drop-shadow(0 0 5px #ffd75e)`
          : 'drop-shadow(0 12px 24px rgba(0,0,0,0.8))',
      }}>
        <DummyCard
          w={cinematic ? 300 : 150}
          h={cinematic ? 420 : 210}
          color="red"
          name="怪盗キッド"
          ap={4} cost={3}
          art="magnifier"
          highlight="#ff7a7a"
        />
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { CardActivationSceneA, CardActivationSceneB });
