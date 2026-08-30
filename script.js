// Meta: 31 de diciembre de 2026, medianoche, hora de Madrid (CET, UTC+1 en diciembre).
// Para reutilizar esto en la próxima cuenta regresiva, solo cambia esta línea
// (y avisa si la nueva fecha cae en horario de verano en Madrid — de
// finales de marzo a finales de octubre es +02:00, no +01:00).
const TARGET = new Date("2026-12-31T00:00:00+01:00").getTime();

// Mensaje según cuánto falta. Edita el texto de cada tramo aquí — es el
// único lugar donde vive.
const MESSAGES = [
  { minDays: 90, text: "Hipotéticamente, estoy emocionado de verte." },
  { minDays: 30, text: "Ya se puede contar en semanas, no solo en números grandes." },
  { minDays: 7, text: "Esto ya empieza a sentirse cerca." },
  { minDays: 2, text: "Esta semana sí toca hacer maletas." },
  { minDays: 1, text: "Mañana." },
  { minDays: 0, text: "Hoy." },
];

const DONE_MESSAGE = "Llegó el día.";

const els = {
  d: document.getElementById("d"),
  h: document.getElementById("h"),
  m: document.getElementById("m"),
  s: document.getElementById("s"),
  clock: document.getElementById("clock"),
  message: document.getElementById("message"),
  doneMessage: document.getElementById("doneMessage"),
  kicker: document.getElementById("kicker"),
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function messageForDays(daysLeft) {
  for (const tier of MESSAGES) {
    if (daysLeft >= tier.minDays) return tier.text;
  }
  return MESSAGES[MESSAGES.length - 1].text;
}

// Se comparte con live.js (los mensajes de Andrés y Anne más abajo en la
// página usan el mismo formato de "hace X").
function relativeTime(date) {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "justo ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}
window.relativeTime = relativeTime;

function tick() {
  const now = Date.now();
  const diff = TARGET - now;

  if (diff <= 0) {
    els.kicker.hidden = true;
    els.clock.hidden = true;
    document.querySelector(".target").hidden = true;
    els.message.hidden = true;
    els.doneMessage.hidden = false;
    els.doneMessage.textContent = DONE_MESSAGE;
    clearInterval(timer);
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  els.d.textContent = days;
  els.h.textContent = pad(hours);
  els.m.textContent = pad(minutes);
  els.s.textContent = pad(seconds);

  els.message.textContent = messageForDays(days);
}

let timer;
tick();
timer = setInterval(tick, 1000);

// --- fondo que sigue el sol real en Madrid ------------------------------
// Calcula la salida y puesta de sol reales del día (fórmula solar estándar,
// la misma familia que usan los calendarios de amanecer/atardecer) y va
// desplazando el color del fondo entre noche → amanecer → día → atardecer
// → noche según la hora exacta. Se recalcula cada minuto y cada cambio se
// funde con una transición de varios segundos (ver CSS), así que en
// pantalla se siente como un cielo que se va aclarando u oscureciendo
// solo, no como un salto entre cuatro fondos fijos.
(function livingSky() {
  const LAT = 40.4168; // Madrid
  const LON = -3.7038;

  // --- 1. Horas de sol reales para "hoy" en Madrid ---
  function dayOfYearUTC(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return Math.floor((today - start) / 86400000) + 1;
  }

  // Minutos desde medianoche UTC en que el sol cruza el ángulo cenital dado.
  // zenith 90.833° = salida/puesta visible (con refracción); 96° = crepúsculo civil.
  function sunEventMinutesUTC(date, zenithDeg, morning) {
    const rad = Math.PI / 180;
    const N = dayOfYearUTC(date);
    const gamma = ((2 * Math.PI) / 365) * (N - 1);

    const eqTime =
      229.18 *
      (0.000075 +
        0.001868 * Math.cos(gamma) -
        0.032077 * Math.sin(gamma) -
        0.014615 * Math.cos(2 * gamma) -
        0.040849 * Math.sin(2 * gamma));

    const decl =
      0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) +
      0.00148 * Math.sin(3 * gamma);

    const zenith = zenithDeg * rad;
    const latRad = LAT * rad;
    const cosH =
      (Math.cos(zenith) - Math.sin(latRad) * Math.sin(decl)) / (Math.cos(latRad) * Math.cos(decl));
    if (cosH > 1 || cosH < -1) return null; // sol de medianoche / noche polar, no aplica en Madrid

    const ha = Math.acos(cosH) / rad; // grados
    const solarNoonUTC = 720 - 4 * LON - eqTime; // minutos desde medianoche UTC
    return morning ? solarNoonUTC - 4 * ha : solarNoonUTC + 4 * ha;
  }

  // Timestamp UTC (ms) del evento solar dado, para la fecha calendario de `base`.
  function sunEventMs(base, zenithDeg, morning) {
    const mins = sunEventMinutesUTC(base, zenithDeg, morning);
    if (mins === null) return null;
    const midnightUTC = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
    return midnightUTC + mins * 60000;
  }

  // --- 2. Paleta por franja (todas match con las variables CSS) ---
  const PALETTE = {
    night: { top: "#16223a", mid: "#0f1726", bottom: "#0b111c", ink: "#f3efe7", inkDim: "rgba(243,239,231,0.62)", gold: "#d8af6c", goldSoft: "#e9c996", star: 0.55 },
    dawn: { top: "#3a3244", mid: "#241f30", bottom: "#14121c", ink: "#f3efe7", inkDim: "rgba(243,239,231,0.62)", gold: "#e2b876", goldSoft: "#eccaa0", star: 0.28 },
    day: { top: "#f2e9da", mid: "#d9dfe2", bottom: "#b7c2c9", ink: "#16223a", inkDim: "rgba(22,34,58,0.6)", gold: "#a9772f", goldSoft: "#8c6023", star: 0 },
    dusk: { top: "#3f2a28", mid: "#241a22", bottom: "#120e18", ink: "#f3efe7", inkDim: "rgba(243,239,231,0.62)", gold: "#e0a15c", goldSoft: "#eabb87", star: 0.4 },
  };

  // Mezclamos en HSL, no en RGB directo: promediar RGB entre, por ejemplo,
  // un azul noche y un crema día da un gris sucio a mitad de camino. En HSL
  // podemos girar por el camino corto de matiz (el mismo truco de cualquier
  // degradado de amanecer/atardecer bien hecho) y el resultado son rosas y
  // ámbares de verdad, no barro.
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function parseColor(str) {
    let r, g, b, a = 1;
    if (str.startsWith("#")) {
      [r, g, b] = hexToRgb(str);
    } else {
      const m = str.match(/[\d.]+/g).map(Number);
      [r, g, b] = m;
      if (m[3] !== undefined) a = m[3];
    }
    return { ...rgbToHsl(r, g, b), a };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h *= 60;
    }
    return { h, s, l };
  }

  function hslToRgbString(h, s, l, a) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r1, g1, b1;
    if (h < 60) [r1, g1, b1] = [c, x, 0];
    else if (h < 120) [r1, g1, b1] = [x, c, 0];
    else if (h < 180) [r1, g1, b1] = [0, c, x];
    else if (h < 240) [r1, g1, b1] = [0, x, c];
    else if (h < 300) [r1, g1, b1] = [x, 0, c];
    else [r1, g1, b1] = [c, 0, x];
    const r = Math.round((r1 + m) * 255);
    const g = Math.round((g1 + m) * 255);
    const b = Math.round((b1 + m) * 255);
    return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(t) {
    t = Math.min(1, Math.max(0, t));
    return t * t * (3 - 2 * t);
  }

  function mixColor(colorA, colorB, t) {
    const a = parseColor(colorA);
    const b = parseColor(colorB);
    let dh = b.h - a.h;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    const h = a.h + dh * t;
    const s = lerp(a.s, b.s, t);
    const l = lerp(a.l, b.l, t);
    const al = lerp(a.a, b.a, t);
    return hslToRgbString(h, s, l, al);
  }

  function mixPalette(pA, pB, t) {
    const e = smoothstep(t);
    // El texto se queda en su color de partida más tiempo del que dura la
    // transición del fondo, y solo cambia en el último tramo — así nunca
    // coincide un fondo a medio camino (el momento de menos contraste) con
    // un texto también a medio camino.
    const inkE = smoothstep((t - 0.4) / 0.6);
    return {
      top: mixColor(pA.top, pB.top, e),
      mid: mixColor(pA.mid, pB.mid, e),
      bottom: mixColor(pA.bottom, pB.bottom, e),
      ink: mixColor(pA.ink, pB.ink, inkE),
      inkDim: mixColor(pA.inkDim, pB.inkDim, inkE),
      gold: mixColor(pA.gold, pB.gold, e),
      goldSoft: mixColor(pA.goldSoft, pB.goldSoft, e),
      star: lerp(pA.star, pB.star, e),
    };
  }

  // Ventanas de transición alrededor de la salida/puesta de sol real.
  const MORNING_GLOW_MIN = 45; // minutos que tarda el amanecer en volverse "día"
  const EVENING_GLOW_MIN = 45;

  function currentPalette(now) {
    const sunrise = sunEventMs(now, 90.833, true);
    const sunset = sunEventMs(now, 90.833, false);
    const dawnStart = sunEventMs(now, 96, true);
    const duskEnd = sunEventMs(now, 96, false);

    // Si por lo que sea no hay datos (no debería pasar en Madrid), noche fija.
    if (sunrise === null || sunset === null || dawnStart === null || duskEnd === null) {
      return PALETTE.night;
    }

    const dayBrightStart = sunrise + MORNING_GLOW_MIN * 60000;
    const dayBrightEnd = sunset - EVENING_GLOW_MIN * 60000;
    const t = now.getTime();

    if (t < dawnStart || t >= duskEnd) return PALETTE.night;
    if (t < sunrise) return mixPalette(PALETTE.night, PALETTE.dawn, (t - dawnStart) / (sunrise - dawnStart));
    if (t < dayBrightStart) return mixPalette(PALETTE.dawn, PALETTE.day, (t - sunrise) / (dayBrightStart - sunrise));
    if (t < dayBrightEnd) return PALETTE.day;
    if (t < sunset) return mixPalette(PALETTE.day, PALETTE.dusk, (t - dayBrightEnd) / (sunset - dayBrightEnd));
    return mixPalette(PALETTE.dusk, PALETTE.night, (t - sunset) / (duskEnd - sunset));
  }

  function apply() {
    // Las fórmulas de arriba trabajan en tiempo UTC real, que es el mismo
    // instante en todo el mundo — no hace falta convertir el reloj del
    // dispositivo a la hora de Madrid, solo calcular sobre el momento actual.
    const p = currentPalette(new Date());

    const root = document.documentElement.style;
    root.setProperty("--bg-top", p.top);
    root.setProperty("--bg-mid", p.mid);
    root.setProperty("--bg-bottom", p.bottom);
    root.setProperty("--ink", p.ink);
    root.setProperty("--ink-dim", p.inkDim);
    root.setProperty("--gold", p.gold);
    root.setProperty("--gold-soft", p.goldSoft);
    root.setProperty("--star-opacity", p.star);
  }

  apply();
  setInterval(apply, 60 * 1000);
})();

// --- fondo: campo de estrellas sutil, quieto salvo un parpadeo leve ---
(function stars() {
  const canvas = document.getElementById("sky");
  const ctx = canvas.getContext("2d");
  let stars = [];
  let w, h;

  function resize() {
    w = canvas.width = window.innerWidth * window.devicePixelRatio;
    h = canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    const count = Math.floor((window.innerWidth * window.innerHeight) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: (Math.random() * 1.1 + 0.3) * window.devicePixelRatio,
      base: Math.random() * 0.5 + 0.25,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.0015 + 0.0005,
    }));
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const star of stars) {
      const twinkle = Math.sin(t * star.speed + star.phase) * 0.25;
      const alpha = Math.min(1, Math.max(0, star.base + twinkle));
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(233, 201, 150, ${alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(draw);
})();
