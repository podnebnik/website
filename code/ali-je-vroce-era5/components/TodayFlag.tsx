// Slovenian flag with per-category weather overlay — direct port from static/js/app.js

function snowFlakePath(r: number): string {
  const f = (n: number) => n.toFixed(2);
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3, ax = Math.cos(a), ay = Math.sin(a);
    d += `M0,0L${f(r * ax)},${f(r * ay)}`;
    const bx1 = 0.4*r*ax, by1 = 0.4*r*ay, b1 = 0.3*r;
    d += `M${f(bx1)},${f(by1)}L${f(bx1+b1*Math.cos(a+Math.PI/3))},${f(by1+b1*Math.sin(a+Math.PI/3))}`;
    d += `M${f(bx1)},${f(by1)}L${f(bx1+b1*Math.cos(a-Math.PI/3))},${f(by1+b1*Math.sin(a-Math.PI/3))}`;
    const bx2=0.7*r*ax, by2=0.7*r*ay, b2=0.2*r;
    d += `M${f(bx2)},${f(by2)}L${f(bx2+b2*Math.cos(a+Math.PI/3))},${f(by2+b2*Math.sin(a+Math.PI/3))}`;
    d += `M${f(bx2)},${f(by2)}L${f(bx2+b2*Math.cos(a-Math.PI/3))},${f(by2+b2*Math.sin(a-Math.PI/3))}`;
  }
  return d;
}

const SNOW_POS: [number, number, number, number, number][] = [
  [-118,52,8,1.9,0.00],[-60,24,6,2.3,0.45],[-20,60,9,1.6,0.90],[28,-52,7,2.1,0.25],
  [82,44,8,1.8,1.10],[118,-32,7,2.4,0.60],[132,56,6,1.7,1.50],[-82,-50,9,2.2,0.35],
  [-6,-62,7,2.0,0.95],[62,-60,8,1.5,0.50],[-132,-22,7,1.9,1.20],[102,65,9,2.1,0.05],
  [-38,-28,6,1.7,1.40],[52,66,7,2.3,0.75],[-2,40,6,1.6,1.65],[138,-58,7,2.0,0.30],
];

const CLOUD_DEF: Record<string, string> = {
  s: '<ellipse cx="6" cy="0" rx="8" ry="6"/><ellipse cx="16" cy="-4" rx="10" ry="8"/><ellipse cx="27" cy="0" rx="8" ry="6"/><rect x="-2" y="3" width="38" height="7" rx="2"/>',
  m: '<ellipse cx="8" cy="1" rx="9" ry="7"/><ellipse cx="20" cy="-5" rx="13" ry="10"/><ellipse cx="34" cy="-3" rx="11" ry="9"/><ellipse cx="46" cy="1" rx="9" ry="7"/><rect x="-1" y="4" width="57" height="8" rx="2"/>',
  l: '<ellipse cx="9" cy="2" rx="10" ry="8"/><ellipse cx="22" cy="-5" rx="14" ry="11"/><ellipse cx="38" cy="-7" rx="16" ry="12"/><ellipse cx="54" cy="-3" rx="13" ry="10"/><ellipse cx="68" cy="2" rx="10" ry="8"/><rect x="-1" y="4" width="80" height="9" rx="2"/>',
};

const COLD_CLOUDS: [number, number, number, number, number, string][] = [
  [-48,1.0,0.72,38,0,'m'],[-22,0.65,0.52,52,8,'s'],[8,1.25,0.62,30,18,'l'],
  [38,0.80,0.48,44,4,'m'],[-60,0.55,0.38,58,26,'s'],[58,1.0,0.55,34,13,'l'],
];

// Official Slovenian coat-of-arms paths (scaled from Wikimedia Commons SVG)
const _STAR = 'm0-84.5 1.125 2.551443L3.897114-82.25 2.25-80l1.647114 2.25L1.125-78.051443 0-75.5l-1.125-2.551443-2.772114.301443L-2.25-80l-1.647114-2.25 2.772114.301443';
const _WAVE = 'M-29.615239-37.252789A10 10 0 0 0-15-31.339746a10 10 0 0 1 10 0 10 10 0 0 0 10 0 10 10 0 0 1 10 0 10 10 0 0 0 14.615239-5.913043L30-37.113249v7.320508a10 10 0 0 0-5 1.339746 10 10 0 0 1-10 0 10 10 0 0 0-10 0 10 10 0 0 1-10 0 10 10 0 0 0-10 0 10 10 0 0 1-10 0 10 10 0 0 0-5-1.339746v-7.320508';

const FLAG_BASE = [
  '<rect x="-140" y="-70" width="280" height="47" fill="#FFFFFF"/>',
  '<rect x="-140" y="-23" width="280" height="47" fill="#003DA5"/>',
  '<rect x="-140" y="24"  width="280" height="46" fill="#D62828"/>',
  '<g transform="matrix(0.4566 0 0 0.4566 -70 0)">',
  '<path d="M-37.175342-94.368205a92.195445 92.195445 0 0 1 74.350684 0Q43-12 0-1q-43-11-37.175342-93.368205Z" fill="#003DA5"/>',
  `<path d="${_STAR}" fill="#FFD700"/>`,
  `<path d="${_STAR}" transform="translate(-10.5,-14)" fill="#FFD700"/>`,
  `<path d="${_STAR}" transform="translate(10.5,-14)" fill="#FFD700"/>`,
  '<path d="m0-70 9 18 6-8 15 20a10 10 0 0 1-.384761 2.747211A46.400549 46.400549 0 0 1 0-6.090878a46.400549 46.400549 0 0 1-29.615239-31.161911A10 10 0 0 1-30-40l15-20 6 8z" fill="#FFFFFF"/>',
  `<path d="${_WAVE}" fill="#003DA5"/>`,
  `<path d="${_WAVE}" transform="translate(0,5.7735028)" fill="#003DA5"/>`,
  '<path d="M-40-93.066239a92.195445 92.195445 0 0 1 2.824658-1.301966l2.97064 47.448778A49.301041 49.301041 0 0 0 0-3.036262a49.301041 49.301041 0 0 0 34.204702-43.883164l2.97064-47.448778A92.195445 92.195445 0 0 1 40-93.066239L37.099526-46.73819A52.201533 52.201533 0 0 1 0 0a52.201533 52.201533 0 0 1-37.099526-46.738189Z" fill="#D62828"/>',
  '</g>',
].join('');

const FLAG_CONFIGS: Record<string, { bg: string; defs: string; body: string }> = {
  freezing: {
    bg: '#FFFFFF',
    defs: '<radialGradient id="tf-frost-vgn" cx="50%" cy="50%" r="58%"><stop offset="0%" stop-color="#c8e6ff" stop-opacity="0"/><stop offset="100%" stop-color="#c8e6ff" stop-opacity="0.35"/></radialGradient>',
    body: `${FLAG_BASE}<rect x="-140" y="-70" width="280" height="140" fill="rgba(180,215,255,0.25)"/><rect x="-140" y="-70" width="280" height="140" fill="url(#tf-frost-vgn)"/>`,
  },
  cold: {
    bg: '#FFFFFF',
    defs: '',
    body: `${FLAG_BASE}<rect x="-140" y="-70" width="280" height="140" fill="rgba(160,190,220,0.18)"/>`,
  },
  nope: {
    bg: '#FFFFFF',
    defs: '',
    body: `${FLAG_BASE}<g transform="translate(100,-50)"><circle r="16" fill="#FFD700" opacity="0.9"/><g stroke="#FFD700" stroke-width="1.5" stroke-linecap="round"><line x1="0" y1="-22" x2="0" y2="-19"/><line x1="15.6" y1="-11" x2="13.4" y2="-9.4"/><line x1="15.6" y1="11" x2="13.4" y2="9.4"/><line x1="0" y1="22" x2="0" y2="19"/><line x1="-15.6" y1="11" x2="-13.4" y2="9.4"/><line x1="-15.6" y1="-11" x2="-13.4" y2="-9.4"/></g></g>`,
  },
  hot: {
    bg: '#FFFFFF',
    defs: '<filter id="tf-hot-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur in="SourceGraphic" stdDeviation="8"/></filter>',
    body: `${FLAG_BASE}<rect x="-140" y="-70" width="280" height="140" fill="rgba(255,140,0,0.22)"/><g transform="translate(100,-50)"><circle r="28" fill="#FF8C00" opacity="0.5" filter="url(#tf-hot-glow)"/><circle r="24" fill="#FF8C00"/></g>`,
  },
  hell: {
    bg: '#FFFFFF',
    defs: '<filter id="tf-flame-f" x="-30%" y="-100%" width="160%" height="250%"><feTurbulence type="turbulence" baseFrequency="0.02 0.05" numOctaves="3" result="t"><animate attributeName="seed" from="0" to="100" dur="1.5s" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" in2="t" scale="8" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="tf-hell-sun-glow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur in="SourceGraphic" stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
    body: `${FLAG_BASE}<rect x="-140" y="-70" width="280" height="140" fill="rgba(180,30,0,0.35)"/><g filter="url(#tf-flame-f)"><path d="M-140,70 L-140,20 Q-100,0 -60,25 Q-20,50 20,20 Q60,-5 100,25 Q120,40 140,20 L140,70 Z" fill="rgba(255,80,0,0.7)"/></g><g transform="translate(100,-50)" filter="url(#tf-hell-sun-glow)"><circle r="28" fill="#FF4C00"/><circle r="22" fill="#FFB030"/><circle r="10" fill="#FFFFFF" opacity="0.9"><animate attributeName="r" values="8;14;8" dur="1.1s" repeatCount="indefinite"/><animate attributeName="opacity" values=".7;1;.7" dur="1.1s" repeatCount="indefinite"/></circle></g>`,
  },
};

const _flagCache = new Map<string, string>();

function buildFlagSVG(catKey: string): string {
  if (_flagCache.has(catKey)) return _flagCache.get(catKey)!;

  const snow = catKey === "freezing"
    ? SNOW_POS.map(([x, y, r, dur, del]) =>
        `<g transform="translate(${x},${y})"><path class="tf-snowflake" d="${snowFlakePath(r)}" fill="none" stroke="rgba(210,235,255,0.95)" stroke-width="0.9" stroke-linecap="round" style="--dur:${dur}s;--delay:${del}s"/></g>`
      ).join("")
    : "";

  const clouds = catKey === "cold"
    ? COLD_CLOUDS.map(([y, sc, op, dur, del, sh]) =>
        `<g opacity="${op}" fill="rgba(255,248,248,0.82)"><g transform="scale(${sc})">${CLOUD_DEF[sh]}</g><animateTransform attributeName="transform" type="translate" from="-220 ${y}" to="220 ${y}" dur="${dur}s" begin="${del}s" repeatCount="indefinite"/></g>`
      ).join("")
    : "";

  const cfg = FLAG_CONFIGS[catKey] ?? FLAG_CONFIGS.nope;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-140 -70 280 140"><defs>${cfg.defs}</defs><rect x="-140" y="-70" width="280" height="140" fill="${cfg.bg}"/>${cfg.body}${clouds}${snow}</svg>`;
  _flagCache.set(catKey, svg);
  return svg;
}

export function TodayFlag(props: { catKey: string }) {
  return (
    <div
      class="w-16 h-8 rounded-[3px] overflow-hidden flex-shrink-0"
      style={{ "box-shadow": "0 2px 6px rgba(14,14,12,0.15)" }}
      innerHTML={buildFlagSVG(props.catKey)}
    />
  );
}
