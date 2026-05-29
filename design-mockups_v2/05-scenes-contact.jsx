// 05-scenes-contact.jsx
// Contact VS scenes — attacker vs defender AP comparison.

function PlaymatBgContact() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `
        linear-gradient(180deg, #2a0810 0%, #050810 35%, #050810 65%, #08182a 100%)
      `,
    }}>
      <svg style={{ position: 'absolute', inset: 0, opacity: 0.08 }} viewBox="0 0 1280 720">
        <line x1="0" y1="360" x2="1280" y2="360" stroke="#ffd75e" strokeWidth="1" strokeDasharray="8 6" />
      </svg>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Contact A — speed-line confrontation
// Beats:
//   0.0-0.4s: establish — attacker (left), defender (right)
//   0.4-1.1s: cards slide toward center
//   1.1-1.4s: collision — speed lines, impact burst, AP numbers pop
//   1.4-2.8s: hold — winner glow, loser dim
//   2.8-4.0s: result text + settle
function ContactSceneA() {
  return (
    <Stage width={1280} height={720} duration={4.0} background="#050810" persistKey="contact-a">
      <PlaymatBgContact />

      {/* Zone labels */}
      <div style={{
        position: 'absolute', left: 80, top: 60,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        color: 'rgba(255,93,93,0.8)', letterSpacing: '0.15em',
      }}>
        ATTACKER
      </div>
      <div style={{
        position: 'absolute', right: 80, top: 60,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        color: 'rgba(78,195,255,0.8)', letterSpacing: '0.15em',
      }}>
        DEFENDER
      </div>

      {/* Cards entering from sides */}
      <ContactCardA side="L" startX={140} endX={520} cardW={180}
        color="red" name="安室透" ap={5} cost={3} art="silhouette" winner={true} />
      <ContactCardA side="R" startX={960} endX={580} cardW={180}
        color="blue" name="灰原哀" ap={3} cost={2} art="silhouette" winner={false} />

      {/* Center clash effects (1.1-1.6s) */}
      <Sprite start={1.05} end={1.6}>
        <SpeedLines cx={640} cy={360} t={null} count={32} length={420} color="#fff" />
      </Sprite>
      <Sprite start={1.1} end={1.7}>
        <ImpactBurst x={640} y={360} r={220} color="#ffd75e" strokeColor="#1a0a0a" />
      </Sprite>
      <Sprite start={1.1} end={1.5}>
        <WhiteFlash peak={0.3} duration={0.6} color="#fff" />
      </Sprite>

      {/* AP numbers pop out at center */}
      <Sprite start={1.3} end={3.2}>
        <ContactAPDisplay attackerAP={5} defenderAP={3} />
      </Sprite>

      {/* Result text at top */}
      <Sprite start={1.7} end={3.6}>
        {({ progress }) => {
          let opacity = 1, ty = 0;
          if (progress < 0.1) { ty = -30 * (1 - progress / 0.1); opacity = progress / 0.1; }
          else if (progress > 0.9) { opacity = 1 - (progress - 0.9) / 0.1; }
          return (
            <div style={{
              position: 'absolute', top: 110, left: 0, right: 0, textAlign: 'center',
              opacity, transform: `translateY(${ty}px)`,
            }}>
              <div style={{
                display: 'inline-block',
                fontFamily: "'Hiragino Mincho ProN', serif",
                fontSize: 56, fontWeight: 900,
                color: '#ffd75e',
                textShadow: '0 0 18px rgba(255,215,94,0.8), 4px 4px 0 rgba(40,0,0,0.6)',
                letterSpacing: '0.15em',
              }}>
                アタッカー勝利
              </div>
              <div style={{
                marginTop: 4,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 13,
                color: 'rgba(255,215,94,0.8)',
                letterSpacing: '0.4em',
              }}>
                AP 5 ⌐ AP 3
              </div>
            </div>
          );
        }}
      </Sprite>

      {/* Backboard meta */}
      <div style={{
        position: 'absolute', left: 24, bottom: 22,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        color: 'rgba(255,215,94,0.45)', letterSpacing: '0.15em',
      }}>
        CONTACT · AP COMPARE
      </div>
    </Stage>
  );
}

function ContactCardA({ side, startX, endX, cardW, color, name, ap, cost, art, winner }) {
  const time = useTime();
  // beats:
  // 0-0.4: hold start
  // 0.4-1.1: slide in
  // 1.1-1.4: impact (slight rebound)
  // 1.4-2.8: hold (winner glow / loser dim)
  // 2.8-4.0: settle
  let x, rotate, scale, dim, glow;
  const cardH = 252;
  const y = 360 - cardH / 2;

  if (time < 0.4) {
    x = startX;
    rotate = side === 'L' ? -3 : 3;
    scale = 0.95;
    dim = 0;
    glow = 0;
  } else if (time < 1.1) {
    const k = Easing.easeInQuad((time - 0.4) / 0.7);
    x = startX + (endX - startX) * k;
    rotate = (side === 'L' ? -3 : 3) * (1 - k);
    scale = 0.95 + 0.05 * k;
    dim = 0;
    glow = 0;
  } else if (time < 1.4) {
    // impact rebound
    const k = (time - 1.1) / 0.3;
    const overshoot = Easing.easeOutBack(k);
    x = endX + (side === 'L' ? -15 : 15) * (1 - overshoot);
    rotate = 0;
    scale = 1.05 - 0.02 * k;
    dim = 0;
    glow = 0;
  } else if (time < 2.8) {
    x = endX;
    rotate = 0;
    scale = 1;
    if (winner) {
      glow = 1;
      dim = 0;
    } else {
      glow = 0;
      const k = Math.min(1, (time - 1.4) / 0.5);
      dim = k * 0.7;
    }
  } else {
    const k = Easing.easeInOutCubic((time - 2.8) / 1.2);
    x = endX + (winner ? -20 : 20) * k;
    rotate = 0;
    scale = 1 - 0.05 * k;
    dim = winner ? 0 : 0.7 + k * 0.2;
    glow = winner ? 1 - k * 0.5 : 0;
  }

  return (
    <div style={{
      position: 'absolute',
      left: x - cardW / 2, top: y,
      width: cardW, height: cardH,
      transform: `scale(${scale}) rotate(${rotate}deg)`,
      transformOrigin: 'center',
      filter: glow > 0
        ? `drop-shadow(0 0 ${15 + glow * 30}px rgba(255,215,94,0.9)) drop-shadow(0 0 8px #fff)`
        : 'drop-shadow(0 14px 28px rgba(0,0,0,0.8))',
      opacity: 1 - dim,
    }}>
      <DummyCard
        w={cardW} h={cardH}
        color={color}
        name={name}
        ap={ap}
        cost={cost}
        art={art}
        highlight={glow > 0.3 ? '#ffd75e' : null}
      />
    </div>
  );
}

function ContactAPDisplay({ attackerAP, defenderAP }) {
  const { progress } = useSprite();
  // pop in
  let opacity = 1, scale = 1;
  if (progress < 0.1) {
    const k = Easing.easeOutBack(progress / 0.1);
    opacity = k;
    scale = 0.3 + k * 0.7;
  } else if (progress > 0.9) {
    opacity = 1 - (progress - 0.9) / 0.1;
  }
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', opacity,
    }}>
      <div style={{ transform: `scale(${scale})` }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 28,
          fontFamily: 'Trajan Pro, Cinzel, serif',
        }}>
          <APNumber value={attackerAP} color="#ff7a7a" label="AP" />
          <div style={{
            fontSize: 80, fontWeight: 900, color: '#ffd75e',
            textShadow: '0 0 16px #ffd75e', letterSpacing: '-0.05em',
          }}>
            vs
          </div>
          <APNumber value={defenderAP} color="#4ec3ff" label="AP" />
        </div>
      </div>
    </div>
  );
}

function APNumber({ value, color, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 18,
        fontFamily: 'JetBrains Mono, monospace',
        color, letterSpacing: '0.3em',
        marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 160, fontWeight: 900,
        color,
        textShadow: `0 0 28px ${color}, 0 0 8px ${color}, 6px 6px 0 rgba(0,0,0,0.5)`,
        lineHeight: 1,
        WebkitTextStroke: '2px rgba(0,0,0,0.4)',
      }}>
        {value}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Contact B — Cinematic diagonal split-screen
// Beats:
//   0-0.4s: black screen, diagonal split appears as a slash
//   0.4-1.4s: attacker card in top-left, defender in bottom-right; ATTACK! / GUARD! stamps
//   1.4-2.0s: cards rush toward each other diagonally
//   2.0-2.5s: collision, impact burst, AP numbers
//   2.5-4.5s: result, winner highlight
function ContactSceneB() {
  return (
    <Stage width={1280} height={720} duration={4.5} background="#000" persistKey="contact-b">
      {/* Black bg */}
      <div style={{ position: 'absolute', inset: 0, background: '#04020a' }} />

      {/* Diagonal slash that establishes the split */}
      <Sprite start={0} end={0.5}>
        {({ progress }) => {
          const w = Math.min(1, progress / 0.25) * 2000;
          const opacity = progress < 0.1 ? progress / 0.1 : 1;
          return (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 1280 720">
              <line x1={640 - w / 2} y1={360 + w / 4} x2={640 + w / 2} y2={360 - w / 4} stroke="#ffd75e" strokeWidth="6" opacity={opacity} />
            </svg>
          );
        }}
      </Sprite>

      {/* Split halves */}
      <Sprite start={0.3} end={2.0}>
        <SplitHalf side="top" />
      </Sprite>
      <Sprite start={0.3} end={2.0}>
        <SplitHalf side="bot" />
      </Sprite>

      {/* ATTACK! and GUARD! stamps */}
      <Sprite start={0.6} end={1.8}>
        <TextStamp text="ATTACK!" x={950} y={140} size={70} color="#ff5d5d" rotate={-10} />
      </Sprite>
      <Sprite start={0.8} end={1.9}>
        <TextStamp text="GUARD!" x={330} y={580} size={62} color="#4ec3ff" rotate={8} />
      </Sprite>

      {/* Rush together (1.4-2.0s) */}
      <Sprite start={1.4} end={2.4}>
        <RushCards />
      </Sprite>

      {/* Collision (2.0-2.5s) */}
      <Sprite start={1.95} end={2.6}>
        <WhiteFlash peak={0.25} duration={0.5} color="#fff" />
      </Sprite>
      <Sprite start={1.95} end={2.6}>
        <ImpactBurst x={640} y={360} r={260} color="#ffd75e" strokeColor="#1a0a0a" />
      </Sprite>
      <Sprite start={1.95} end={2.6}>
        <SpeedLines cx={640} cy={360} count={48} length={500} color="#fff" />
      </Sprite>

      {/* AP comparison after collision */}
      <Sprite start={2.4} end={4.2}>
        <ContactAPDisplay attackerAP={5} defenderAP={3} />
      </Sprite>

      {/* Result text */}
      <Sprite start={2.8} end={4.4}>
        {({ progress }) => {
          let opacity = 1, scale = 1;
          if (progress < 0.15) {
            const k = Easing.easeOutBack(progress / 0.15);
            opacity = k;
            scale = 0.4 + k * 0.6;
          } else if (progress > 0.9) {
            opacity = 1 - (progress - 0.9) / 0.1;
          }
          return (
            <div style={{
              position: 'absolute', bottom: 80, left: 0, right: 0, textAlign: 'center',
              opacity, transform: `scale(${scale})`,
            }}>
              <div style={{
                display: 'inline-block', padding: '8px 28px',
                background: 'rgba(196,24,24,0.85)',
                border: '2px solid #ffd75e',
                fontFamily: "'Hiragino Mincho ProN', serif",
                fontSize: 32, fontWeight: 900,
                color: '#fff',
                letterSpacing: '0.2em',
                textShadow: '2px 2px 0 rgba(0,0,0,0.4)',
                transform: 'rotate(-2deg)',
              }}>
                K.O. — ガード突破
              </div>
            </div>
          );
        }}
      </Sprite>

      {/* Backboard meta */}
      <div style={{
        position: 'absolute', left: 24, top: 18,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        color: 'rgba(255,215,94,0.45)', letterSpacing: '0.15em',
      }}>
        CONTACT · CINEMATIC SPLIT
      </div>
    </Stage>
  );
}

function SplitHalf({ side }) {
  const { progress } = useSprite();
  // slide in from off-screen along diagonal
  let opacity = 1, dx = 0, dy = 0;
  if (progress < 0.15) {
    const k = Easing.easeOutCubic(progress / 0.15);
    opacity = k;
    dx = (1 - k) * (side === 'top' ? 200 : -200);
    dy = (1 - k) * (side === 'top' ? -100 : 100);
  } else if (progress > 0.7) {
    const k = (progress - 0.7) / 0.3;
    opacity = 1 - k;
    dx = k * (side === 'top' ? -100 : 100);
    dy = k * (side === 'top' ? 50 : -50);
  }

  // Each half is the triangle of the screen with a card in it
  const isTop = side === 'top';
  const clipPath = isTop
    ? 'polygon(0 0, 100% 0, 100% 50%, 0 100%)'
    : 'polygon(0 100%, 100% 100%, 100% 50%, 0 0)';
  // mostly the bottom-right or top-left half
  const realClip = isTop
    ? 'polygon(0 0, 100% 0, 50% 100%)'
    : 'polygon(100% 100%, 50% 0, 0 100%)';

  return (
    <div style={{
      position: 'absolute', inset: 0,
      opacity, transform: `translate(${dx}px, ${dy}px)`,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: isTop
          ? 'radial-gradient(ellipse 80% 70% at 75% 20%, #5a1a1a 0%, #1a0608 80%)'
          : 'radial-gradient(ellipse 80% 70% at 25% 80%, #0a3050 0%, #04101a 80%)',
        clipPath: realClip,
      }} />
      {/* Card */}
      <div style={{
        position: 'absolute',
        left: isTop ? 830 : 130,
        top: isTop ? 80 : 360,
        transform: `rotate(${isTop ? -8 : 8}deg)`,
        filter: 'drop-shadow(0 16px 32px rgba(0,0,0,0.8))',
      }}>
        <DummyCard
          w={240} h={336}
          color={isTop ? 'red' : 'blue'}
          name={isTop ? '安室透' : '灰原哀'}
          ap={isTop ? 5 : 3}
          cost={isTop ? 3 : 2}
          art="silhouette"
        />
      </div>
    </div>
  );
}

function RushCards() {
  const { progress } = useSprite();
  // attacker rushes from top-right diagonal to center
  // defender rushes from bottom-left diagonal to center
  const aStart = [950, 220];
  const dStart = [330, 500];
  const center = [640, 360];

  let aX, aY, dX, dY, opacity;
  const k = Easing.easeInQuad(Math.min(1, progress / 0.6));
  aX = aStart[0] + (center[0] - aStart[0]) * k;
  aY = aStart[1] + (center[1] - aStart[1]) * k;
  dX = dStart[0] + (center[0] - dStart[0]) * k;
  dY = dStart[1] + (center[1] - dStart[1]) * k;
  opacity = progress < 0.65 ? 1 : Math.max(0, 1 - (progress - 0.65) / 0.15);

  return (
    <React.Fragment>
      <div style={{
        position: 'absolute', left: aX - 120, top: aY - 168,
        width: 240, height: 336,
        transform: `rotate(${-8 + k * 6}deg)`,
        filter: 'drop-shadow(0 16px 32px rgba(0,0,0,0.8))',
        opacity,
      }}>
        <DummyCard w={240} h={336} color="red" name="安室透" ap={5} cost={3} art="silhouette" />
      </div>
      <div style={{
        position: 'absolute', left: dX - 120, top: dY - 168,
        width: 240, height: 336,
        transform: `rotate(${8 - k * 6}deg)`,
        filter: 'drop-shadow(0 16px 32px rgba(0,0,0,0.8))',
        opacity,
      }}>
        <DummyCard w={240} h={336} color="blue" name="灰原哀" ap={3} cost={2} art="silhouette" />
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { ContactSceneA, ContactSceneB });
