import React from 'react';
import { Svg, G, Ellipse, Circle, Path, Rect, Line } from 'react-native-svg';

/* ── colour palette ── */

const PALETTE_MAP = {
  orange: '#DE8C57',
  green: '#5E7C61',
  pink: '#D2929A',
};

const fur = '#C9A074';
const furD = '#B98A5E';
const snout = '#F0E2CB';
const ear = '#B98A5E';
const cheek = '#E2A6A0';
const dark = '#4A3F33';
const eggShell = '#F4E9D4';

/* ── stage geometry (viewBox 0 0 200 200) ── */

const PET_GEO = {
  2: {
    hx: 100, hy: 98, hrx: 62, hry: 56,
    ear: 24, eyeK: 0.13,
    neck: 148,
    body: { cy: 160, rx: 48, ry: 30 },
    arms: false, feet: false,
  },
  3: {
    hx: 100, hy: 86, hrx: 54, hry: 50,
    ear: 22, eyeK: 0.13,
    neck: 132,
    body: { cy: 150, rx: 48, ry: 46 },
    arms: true, feet: true,
  },
  4: {
    hx: 100, hy: 72, hrx: 48, hry: 45,
    ear: 20, eyeK: 0.12,
    neck: 114,
    body: { cy: 140, rx: 42, ry: 55 },
    arms: true, feet: true, slim: true,
  },
  5: {
    hx: 100, hy: 64, hrx: 46, hry: 43,
    ear: 19, eyeK: 0.12,
    neck: 104,
    body: { cy: 132, rx: 48, ry: 60 },
    arms: 'open', feet: true,
  },
};

/* ── helper: egg stage (stage <= 0) ── */

function renderEgg(accentColor) {
  return (
    <G>
      {/* shadow */}
      <Ellipse cx={100} cy={178} rx={38} ry={8} fill={dark} opacity={0.10} />

      {/* egg body */}
      <Ellipse cx={100} cy={110} rx={42} ry={56} fill={eggShell} />

      {/* decorative dots */}
      <Circle cx={80} cy={96} r={4} fill={accentColor} opacity={0.35} />
      <Circle cx={108} cy={82} r={3} fill={accentColor} opacity={0.30} />
      <Circle cx={92} cy={120} r={3.5} fill={accentColor} opacity={0.25} />
      <Circle cx={116} cy={104} r={2.5} fill={accentColor} opacity={0.20} />
      <Circle cx={86} cy={140} r={3} fill={accentColor} opacity={0.20} />

      {/* crack highlight */}
      <Path
        d={`M 88 78 Q 92 86 86 92 Q 94 88 98 96 Q 96 84 88 78`}
        fill="#FFFFFF"
        opacity={0.45}
      />
    </G>
  );
}

/* ── helper: hatched baby (stage === 1) ── */

function renderHatched(accentColor) {
  return (
    <G>
      {/* shadow */}
      <Ellipse cx={100} cy={180} rx={44} ry={8} fill={dark} opacity={0.10} />

      {/* broken shell bottom */}
      <Path
        d={`M 62 140 Q 68 120 74 140 Q 80 126 88 142
            Q 96 128 104 140 Q 112 124 120 140
            Q 128 126 134 138 L 138 170 Q 138 184 100 184
            Q 62 184 62 170 Z`}
        fill={eggShell}
      />
      <Path
        d={`M 62 140 Q 68 120 74 140 Q 80 126 88 142
            Q 96 128 104 140 Q 112 124 120 140
            Q 128 126 134 138`}
        fill="none"
        stroke={furD}
        strokeWidth={1.2}
        opacity={0.3}
      />

      {/* tiny cub head poking out */}
      <Ellipse cx={100} cy={118} rx={30} ry={26} fill={fur} />

      {/* tiny ears */}
      <Circle cx={76} cy={98} r={12} fill={ear} />
      <Circle cx={76} cy={98} r={7} fill={cheek} opacity={0.5} />
      <Circle cx={124} cy={98} r={12} fill={ear} />
      <Circle cx={124} cy={98} r={7} fill={cheek} opacity={0.5} />

      {/* snout */}
      <Ellipse cx={100} cy={126} rx={12} ry={8} fill={snout} />

      {/* eyes */}
      <Ellipse cx={90} cy={114} rx={3} ry={3.5} fill={dark} />
      <Circle cx={88.5} cy={112.5} r={1.2} fill="#FFFFFF" />
      <Ellipse cx={110} cy={114} rx={3} ry={3.5} fill={dark} />
      <Circle cx={108.5} cy={112.5} r={1.2} fill="#FFFFFF" />

      {/* cheeks */}
      <Circle cx={82} cy={122} r={5} fill={cheek} opacity={0.45} />
      <Circle cx={118} cy={122} r={5} fill={cheek} opacity={0.45} />

      {/* nose */}
      <Ellipse cx={100} cy={123} rx={3.5} ry={2.5} fill={dark} />

      {/* mouth */}
      <Path
        d="M 97 126 Q 100 130 103 126"
        fill="none"
        stroke={dark}
        strokeWidth={1.2}
        strokeLinecap="round"
      />

      {/* blush accent */}
      <Circle cx={85} cy={100} r={2} fill={accentColor} opacity={0.3} />
      <Circle cx={115} cy={100} r={2} fill={accentColor} opacity={0.3} />
    </G>
  );
}

/* ── helper: star background ── */

function renderStarScene() {
  const stars = [
    { cx: 20, cy: 20, r: 2 },
    { cx: 45, cy: 12, r: 1.5 },
    { cx: 70, cy: 28, r: 2.5 },
    { cx: 155, cy: 18, r: 2 },
    { cx: 175, cy: 35, r: 1.8 },
    { cx: 130, cy: 10, r: 1.5 },
    { cx: 30, cy: 45, r: 1.2 },
    { cx: 168, cy: 55, r: 1.6 },
    { cx: 55, cy: 42, r: 1.3 },
    { cx: 145, cy: 40, r: 2.2 },
    { cx: 100, cy: 8, r: 1.8 },
    { cx: 185, cy: 15, r: 1.4 },
  ];
  return (
    <G>
      {stars.map((s, i) => (
        <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#F5E6B8" opacity={0.7} />
      ))}
    </G>
  );
}

/* ── helper: feet ── */

function renderFeet(g) {
  const footY = g.body.cy + g.body.ry - 6;
  const footSpread = g.body.rx * 0.55;
  const footRx = g.slim ? 13 : 16;
  const footRy = g.slim ? 7 : 9;
  const padR = g.slim ? 2.2 : 2.8;

  return (
    <G>
      {/* left foot */}
      <Ellipse cx={g.hx - footSpread} cy={footY} rx={footRx} ry={footRy} fill={fur} />
      <Circle cx={g.hx - footSpread - 4} cy={footY - 2} r={padR} fill={snout} opacity={0.6} />
      <Circle cx={g.hx - footSpread} cy={footY - 2} r={padR} fill={snout} opacity={0.6} />
      <Circle cx={g.hx - footSpread + 4} cy={footY - 2} r={padR} fill={snout} opacity={0.6} />

      {/* right foot */}
      <Ellipse cx={g.hx + footSpread} cy={footY} rx={footRx} ry={footRy} fill={fur} />
      <Circle cx={g.hx + footSpread - 4} cy={footY - 2} r={padR} fill={snout} opacity={0.6} />
      <Circle cx={g.hx + footSpread} cy={footY - 2} r={padR} fill={snout} opacity={0.6} />
      <Circle cx={g.hx + footSpread + 4} cy={footY - 2} r={padR} fill={snout} opacity={0.6} />
    </G>
  );
}

/* ── helper: arms ── */

function renderArms(g) {
  const armY = g.neck + 6;
  const armRx = g.slim ? 12 : 14;
  const armRy = g.slim ? 22 : 26;
  const armSpread = g.body.rx + armRx * 0.5;
  const isOpen = g.arms === 'open';
  const rotation = isOpen ? 30 : 12;

  return (
    <G>
      {/* left arm */}
      <Ellipse
        cx={g.hx - armSpread}
        cy={armY}
        rx={armRx}
        ry={armRy}
        fill={fur}
        rotation={-rotation}
        origin={`${g.hx - armSpread}, ${armY}`}
      />
      {/* right arm */}
      <Ellipse
        cx={g.hx + armSpread}
        cy={armY}
        rx={armRx}
        ry={armRy}
        fill={fur}
        rotation={rotation}
        origin={`${g.hx + armSpread}, ${armY}`}
      />
    </G>
  );
}

/* ── helper: torso ── */

function renderTorso(g) {
  const bellyRx = g.body.rx * 0.6;
  const bellyRy = g.body.ry * 0.55;

  return (
    <G>
      {/* main body ellipse */}
      <Ellipse cx={g.hx} cy={g.body.cy} rx={g.body.rx} ry={g.body.ry} fill={fur} />
      {/* belly */}
      <Ellipse cx={g.hx} cy={g.body.cy + 4} rx={bellyRx} ry={bellyRy} fill={snout} opacity={0.55} />
    </G>
  );
}

/* ── helper: scarf accessory ── */

function renderScarf(g, accentColor) {
  const neckY = g.neck;
  const halfW = g.body.rx * 0.75;
  return (
    <G>
      <Path
        d={`M ${g.hx - halfW} ${neckY - 4}
            Q ${g.hx} ${neckY + 10} ${g.hx + halfW} ${neckY - 4}
            L ${g.hx + halfW} ${neckY + 6}
            Q ${g.hx} ${neckY + 20} ${g.hx - halfW} ${neckY + 6}
            Z`}
        fill={accentColor}
        opacity={0.85}
      />
      {/* scarf tail */}
      <Path
        d={`M ${g.hx + halfW - 6} ${neckY + 2}
            L ${g.hx + halfW + 4} ${neckY + 20}
            L ${g.hx + halfW - 2} ${neckY + 22}
            L ${g.hx + halfW - 10} ${neckY + 6}
            Z`}
        fill={accentColor}
        opacity={0.75}
      />
    </G>
  );
}

/* ── helper: ears ── */

function renderEars(g) {
  const earOffsetX = g.hrx * 0.72;
  const earOffsetY = g.hry * 0.72;
  const innerR = g.ear * 0.5;

  return (
    <G>
      {/* left ear */}
      <Circle cx={g.hx - earOffsetX} cy={g.hy - earOffsetY} r={g.ear} fill={ear} />
      <Circle cx={g.hx - earOffsetX} cy={g.hy - earOffsetY} r={innerR} fill={cheek} opacity={0.5} />

      {/* right ear */}
      <Circle cx={g.hx + earOffsetX} cy={g.hy - earOffsetY} r={g.ear} fill={ear} />
      <Circle cx={g.hx + earOffsetX} cy={g.hy - earOffsetY} r={innerR} fill={cheek} opacity={0.5} />
    </G>
  );
}

/* ── helper: head ── */

function renderHead(g) {
  return (
    <G>
      {/* main head */}
      <Ellipse cx={g.hx} cy={g.hy} rx={g.hrx} ry={g.hry} fill={fur} />
      {/* subtle shading on the lower part of the head */}
      <Ellipse
        cx={g.hx}
        cy={g.hy + g.hry * 0.15}
        rx={g.hrx * 0.92}
        ry={g.hry * 0.6}
        fill={furD}
        opacity={0.12}
      />
    </G>
  );
}

/* ── helper: hat accessory ── */

function renderHat(g, accentColor) {
  const hatBaseY = g.hy - g.hry + 4;
  const hatTipY = hatBaseY - 36;
  const halfBrim = g.hrx * 0.55;

  return (
    <G>
      {/* triangle */}
      <Path
        d={`M ${g.hx} ${hatTipY}
            L ${g.hx - halfBrim} ${hatBaseY}
            L ${g.hx + halfBrim} ${hatBaseY}
            Z`}
        fill={accentColor}
        opacity={0.9}
      />
      {/* band */}
      <Rect
        x={g.hx - halfBrim}
        y={hatBaseY - 5}
        width={halfBrim * 2}
        height={6}
        fill={dark}
        opacity={0.3}
        rx={2}
      />
      {/* pompom */}
      <Circle cx={g.hx} cy={hatTipY} r={5} fill="#FFFFFF" opacity={0.85} />
    </G>
  );
}

/* ── helper: snout ── */

function renderSnout(g) {
  const snoutY = g.hy + g.hry * 0.28;
  const snoutRx = g.hrx * 0.38;
  const snoutRy = g.hry * 0.28;

  return (
    <Ellipse cx={g.hx} cy={snoutY} rx={snoutRx} ry={snoutRy} fill={snout} />
  );
}

/* ── helper: cheeks ── */

function renderCheeks(g) {
  const cheekY = g.hy + g.hry * 0.2;
  const cheekOffsetX = g.hrx * 0.62;
  const cheekR = g.hrx * 0.14;

  return (
    <G>
      <Circle cx={g.hx - cheekOffsetX} cy={cheekY} r={cheekR} fill={cheek} opacity={0.45} />
      <Circle cx={g.hx + cheekOffsetX} cy={cheekY} r={cheekR} fill={cheek} opacity={0.45} />
    </G>
  );
}

/* ── helper: eyes ── */

function renderEyes(g, mood) {
  const eyeY = g.hy - g.hry * 0.05;
  const eyeSpacing = g.hrx * 0.35;
  const eyeRx = g.hrx * g.eyeK;
  const eyeRy = eyeRx * 1.2;

  if (mood === 'sleepy') {
    // curved-down lines (droopy/sleepy)
    const w = eyeRx * 1.8;
    return (
      <G>
        <Path
          d={`M ${g.hx - eyeSpacing - w} ${eyeY} Q ${g.hx - eyeSpacing} ${eyeY + eyeRy * 1.6} ${g.hx - eyeSpacing + w} ${eyeY}`}
          fill="none"
          stroke={dark}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d={`M ${g.hx + eyeSpacing - w} ${eyeY} Q ${g.hx + eyeSpacing} ${eyeY + eyeRy * 1.6} ${g.hx + eyeSpacing + w} ${eyeY}`}
          fill="none"
          stroke={dark}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </G>
    );
  }

  if (mood === 'celebrate') {
    // curved-up lines (happy squints)
    const w = eyeRx * 1.8;
    return (
      <G>
        <Path
          d={`M ${g.hx - eyeSpacing - w} ${eyeY} Q ${g.hx - eyeSpacing} ${eyeY - eyeRy * 1.6} ${g.hx - eyeSpacing + w} ${eyeY}`}
          fill="none"
          stroke={dark}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d={`M ${g.hx + eyeSpacing - w} ${eyeY} Q ${g.hx + eyeSpacing} ${eyeY - eyeRy * 1.6} ${g.hx + eyeSpacing + w} ${eyeY}`}
          fill="none"
          stroke={dark}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </G>
    );
  }

  // default: 'happy' - filled ellipses with white highlights
  const highlightR = eyeRx * 0.4;
  return (
    <G>
      {/* left eye */}
      <Ellipse cx={g.hx - eyeSpacing} cy={eyeY} rx={eyeRx} ry={eyeRy} fill={dark} />
      <Circle
        cx={g.hx - eyeSpacing - eyeRx * 0.25}
        cy={eyeY - eyeRy * 0.25}
        r={highlightR}
        fill="#FFFFFF"
      />

      {/* right eye */}
      <Ellipse cx={g.hx + eyeSpacing} cy={eyeY} rx={eyeRx} ry={eyeRy} fill={dark} />
      <Circle
        cx={g.hx + eyeSpacing - eyeRx * 0.25}
        cy={eyeY - eyeRy * 0.25}
        r={highlightR}
        fill="#FFFFFF"
      />
    </G>
  );
}

/* ── helper: nose + mouth ── */

function renderNoseMouth(g) {
  const snoutY = g.hy + g.hry * 0.28;
  const noseY = snoutY - g.hry * 0.04;
  const noseRx = g.hrx * 0.07;
  const noseRy = noseRx * 0.7;
  const mouthY = noseY + noseRy + 2;
  const mouthW = g.hrx * 0.1;

  return (
    <G>
      {/* nose */}
      <Ellipse cx={g.hx} cy={noseY} rx={noseRx} ry={noseRy} fill={dark} />

      {/* mouth - two small curves forming a "w" shape */}
      <Path
        d={`M ${g.hx - mouthW} ${mouthY} Q ${g.hx} ${mouthY + mouthW * 0.8} ${g.hx + mouthW} ${mouthY}`}
        fill="none"
        stroke={dark}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </G>
  );
}

/* ── helper: kite accessory ── */

function renderKite(g, accentColor) {
  // kite floats from the right arm area
  const armSpread = g.body.rx + 7;
  const armY = g.neck + 6;
  const kiteX = g.hx + armSpread + 20;
  const kiteY = armY - 40;
  const kiteSize = 14;

  return (
    <G>
      {/* string from arm to kite */}
      <Path
        d={`M ${g.hx + armSpread} ${armY}
            Q ${kiteX - 10} ${kiteY + 20} ${kiteX} ${kiteY}`}
        fill="none"
        stroke={dark}
        strokeWidth={0.8}
        opacity={0.5}
      />
      {/* kite diamond */}
      <Path
        d={`M ${kiteX} ${kiteY - kiteSize}
            L ${kiteX + kiteSize * 0.7} ${kiteY}
            L ${kiteX} ${kiteY + kiteSize * 0.6}
            L ${kiteX - kiteSize * 0.7} ${kiteY}
            Z`}
        fill={accentColor}
        opacity={0.85}
      />
      {/* kite cross */}
      <Line
        x1={kiteX} y1={kiteY - kiteSize}
        x2={kiteX} y2={kiteY + kiteSize * 0.6}
        stroke={dark} strokeWidth={0.6} opacity={0.3}
      />
      <Line
        x1={kiteX - kiteSize * 0.7} y1={kiteY}
        x2={kiteX + kiteSize * 0.7} y2={kiteY}
        stroke={dark} strokeWidth={0.6} opacity={0.3}
      />
      {/* tail bows */}
      <Path
        d={`M ${kiteX} ${kiteY + kiteSize * 0.6}
            Q ${kiteX + 6} ${kiteY + kiteSize + 4} ${kiteX + 2} ${kiteY + kiteSize + 12}
            Q ${kiteX - 4} ${kiteY + kiteSize + 18} ${kiteX + 3} ${kiteY + kiteSize + 26}`}
        fill="none"
        stroke={accentColor}
        strokeWidth={1}
        opacity={0.6}
      />
    </G>
  );
}

/* ── helper: boat accessory ── */

function renderBoat(g, accentColor) {
  const boatY = g.body.cy + g.body.ry + 4;
  const boatW = g.body.rx * 0.9;

  return (
    <G>
      {/* water line */}
      <Path
        d={`M ${g.hx - boatW - 10} ${boatY + 6}
            Q ${g.hx - boatW * 0.5} ${boatY + 2} ${g.hx} ${boatY + 6}
            Q ${g.hx + boatW * 0.5} ${boatY + 10} ${g.hx + boatW + 10} ${boatY + 6}`}
        fill="none"
        stroke="#7EB8C9"
        strokeWidth={1.5}
        opacity={0.4}
      />
      {/* hull */}
      <Path
        d={`M ${g.hx - boatW} ${boatY}
            L ${g.hx - boatW + 6} ${boatY + 10}
            L ${g.hx + boatW - 6} ${boatY + 10}
            L ${g.hx + boatW} ${boatY}
            Z`}
        fill={accentColor}
        opacity={0.7}
      />
      {/* mast */}
      <Line
        x1={g.hx} y1={boatY - 16}
        x2={g.hx} y2={boatY + 4}
        stroke={dark} strokeWidth={1.2} opacity={0.5}
      />
      {/* sail */}
      <Path
        d={`M ${g.hx} ${boatY - 16}
            L ${g.hx + boatW * 0.5} ${boatY}
            L ${g.hx} ${boatY}
            Z`}
        fill="#FFFFFF"
        opacity={0.7}
      />
    </G>
  );
}

/* ── main: full-bodied bear (stages 2-5) ── */

function renderFullBear(g, accessories, mood, accentColor) {
  const hasScarf = accessories.includes('scarf');
  const hasHat = accessories.includes('hat');
  const hasStar = accessories.includes('star');
  const hasKite = accessories.includes('kite');
  const hasBoat = accessories.includes('boat');

  return (
    <G>
      {/* 1. Star scene background */}
      {hasStar && renderStarScene()}

      {/* 2. Shadow */}
      <Ellipse
        cx={g.hx}
        cy={g.body.cy + g.body.ry + 8}
        rx={g.body.rx + 8}
        ry={8}
        fill={dark}
        opacity={0.10}
      />

      {/* 3. Feet */}
      {g.feet && renderFeet(g)}

      {/* 4. Arms */}
      {g.arms && renderArms(g)}

      {/* 5. Torso */}
      {renderTorso(g)}

      {/* 6. Scarf */}
      {hasScarf && renderScarf(g, accentColor)}

      {/* 7. Ears */}
      {renderEars(g)}

      {/* 8. Head */}
      {renderHead(g)}

      {/* 9. Hat */}
      {hasHat && renderHat(g, accentColor)}

      {/* 10. Snout */}
      {renderSnout(g)}

      {/* 11. Cheeks */}
      {renderCheeks(g)}

      {/* 12. Eyes */}
      {renderEyes(g, mood)}

      {/* 13. Nose + mouth */}
      {renderNoseMouth(g)}

      {/* 14. Kite */}
      {hasKite && g.arms && renderKite(g, accentColor)}

      {/* 15. Boat */}
      {hasBoat && g.feet && renderBoat(g, accentColor)}
    </G>
  );
}

/* ── Bear component ── */

export function Bear({
  size = 120,
  accessories = [],
  mood = 'happy',
  tone = 'orange',
  stage = 3,
}) {
  const accentColor = PALETTE_MAP[tone] || PALETTE_MAP.orange;

  let content;

  if (stage <= 0) {
    content = renderEgg(accentColor);
  } else if (stage === 1) {
    content = renderHatched(accentColor);
  } else {
    const geoKey = Math.min(Math.max(stage, 2), 5);
    const g = PET_GEO[geoKey];
    content = renderFullBear(g, accessories, mood, accentColor);
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {content}
    </Svg>
  );
}

export default Bear;
