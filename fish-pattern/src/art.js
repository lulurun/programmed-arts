const GEOMETRY_BOX = { width: 860, height: 620 };
const ART_BOX = { width: 1120, height: 760 };
const MODULE_WIDTH = 420;
const PATTERN_STROKE_WIDTH = 3.4;
const ART_NAME = "fish-pattern";
const LOCAL_STATE_KEY = "fish-tessellation-lab-state-v1";
const STATE_VERSION = 2;
const TWO_PI = Math.PI * 2;
const RAINBOW_COLORS = [
  "#e53935",
  "#fb8c00",
  "#fdd835",
  "#43a047",
  "#1e88e5",
  "#3949ab",
  "#8e24aa"
];

const palettes = {
  primaries: ["#f3d342", "#e54835", "#1666b1", "#ffffff", "#191919", "#2ba66f"],
  watercolor: ["#f5c6a5", "#86b8c9", "#d8a7b1", "#f2e8c9", "#97b681", "#516d83"],
  pastel: ["#ffd7df", "#bae2d8", "#f7e59d", "#c7c7ee", "#f5b88f", "#f9f5ed"],
  dark: ["#161b22", "#305f72", "#f0b84b", "#d95f4f", "#75a47f", "#e7e1d1"]
};

const styleLabels = {
  chequer: "Chequer",
  stripes: "Stripes",
  gradient: "Gradient",
  overlap: "Overlap"
};

const state = {
  page: "pattern",
  activePart: "eye",
  palette: "primaries",
  style: "chequer",
  showGuides: true,
  showFullEllipses: true,
  module: {
    eyeX: -146,
    eyeRadius: 8
  },
  layout: {
    maxFish: 5,
    offsetX: 0,
    scale: 1,
    scaleY: 1,
    colorEnabled: true
  },
  ellipses: [
    { label: "C1 Head / outer", leftX: -264, width: 472, height: 224, visible: 58 },
    { label: "C2 Gill", leftX: -166, width: 144, height: 256, visible: 100 },
    { label: "C3 Body", leftX: -166, width: 284, height: 136, visible: 100 },
    { label: "C4 Tail root", leftX: -102, width: 472, height: 224, visible: 36 }
  ]
};

const controls = {
  patternPage: document.querySelector("#patternPage"),
  artPage: document.querySelector("#artPage"),
  patternPanel: document.querySelector("#patternPanel"),
  artPanel: document.querySelector("#artPanel"),
  patternPageButton: document.querySelector("#patternPageButton"),
  artPageButton: document.querySelector("#artPageButton"),
  geometryCanvas: document.querySelector("#geometryCanvas"),
  artCanvas: document.querySelector("#artCanvas"),
  layoutControls: document.querySelector("#layoutControls"),
  ellipseTabs: document.querySelector("#ellipseTabs"),
  ellipseControls: document.querySelector("#ellipseControls"),
  paletteControls: document.querySelector("#paletteControls"),
  styleControls: document.querySelector("#styleControls"),
  colorEnabled: document.querySelector("#colorEnabled"),
  showGuides: document.querySelector("#showGuides"),
  showFullEllipses: document.querySelector("#showFullEllipses"),
  patternName: document.querySelector("#patternName"),
  savePatternButton: document.querySelector("#savePatternButton"),
  patternSaveStatus: document.querySelector("#patternSaveStatus"),
  readout: document.querySelector("#readout"),
  readoutTitle: document.querySelector("#readoutTitle"),
  geometryMetric: document.querySelector("#geometryMetric"),
  artMetric: document.querySelector("#artMetric"),
  resetPatternButton: document.querySelector("#resetPatternButton"),
  resetLayoutButton: document.querySelector("#resetLayoutButton"),
  exportSvgButton: document.querySelector("#exportSvgButton"),
  exportPngButton: document.querySelector("#exportPngButton")
};

const geometryCtx = controls.geometryCanvas.getContext("2d");
const artCtx = controls.artCanvas.getContext("2d");
let dragTarget = null;
let lastIntersections = [];

function cloneDefaults() {
  return JSON.parse(JSON.stringify({
    module: state.module,
    layout: state.layout,
    ellipses: state.ellipses
  }));
}

const defaults = cloneDefaults();

function apiPath(path) {
  return new URL(`../api/files/${encodeURIComponent(ART_NAME)}${path}`, window.location.href).pathname;
}

function cloneCurrentParams() {
  return JSON.parse(JSON.stringify({
    version: STATE_VERSION,
    module: state.module,
    layout: state.layout,
    ellipses: state.ellipses,
    palette: state.palette,
    style: state.style,
    showGuides: state.showGuides,
    showFullEllipses: state.showFullEllipses
  }));
}

function saveLocalState() {
  try {
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(cloneCurrentParams()));
  } catch (error) {
    console.warn("Could not save fish tessellation state locally.", error);
  }
}

function applyStoredState() {
  try {
    const raw = localStorage.getItem(LOCAL_STATE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === "object") {
      if (saved.module && typeof saved.module === "object") {
        state.module = { ...state.module, ...saved.module };
      }
      if (saved.layout && typeof saved.layout === "object") {
        state.layout = { ...state.layout, ...saved.layout };
        if (saved.version !== STATE_VERSION) state.layout.colorEnabled = true;
        state.layout = {
          maxFish: state.layout.maxFish,
          offsetX: state.layout.offsetX,
          scale: state.layout.scale,
          scaleY: typeof state.layout.scaleY === "number" ? state.layout.scaleY : 1,
          colorEnabled: state.layout.colorEnabled
        };
      }
      if (Array.isArray(saved.ellipses) && saved.ellipses.length === state.ellipses.length) {
        state.ellipses = state.ellipses.map((ellipse, index) => ({ ...ellipse, ...saved.ellipses[index] }));
      }
      if (palettes[saved.palette]) state.palette = saved.palette;
      if (styleLabels[saved.style]) state.style = saved.style;
      if (typeof saved.showGuides === "boolean") state.showGuides = saved.showGuides;
      if (typeof saved.showFullEllipses === "boolean") state.showFullEllipses = saved.showFullEllipses;
      normalizeEllipseConstraints();
    }
  } catch (error) {
    console.warn("Could not load fish tessellation state from local storage.", error);
  }
}

function radians(degrees) {
  return degrees * Math.PI / 180;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function roundTo(value, places = 2) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function ellipseGeometry(ellipse) {
  const width = Number.isFinite(ellipse.width) ? ellipse.width : ellipse.a * 2;
  const height = Number.isFinite(ellipse.height) ? ellipse.height : ellipse.b * 2;
  const leftX = Number.isFinite(ellipse.leftX) ? ellipse.leftX : ellipse.cx - width / 2;
  return {
    label: ellipse.label,
    leftX,
    width,
    height,
    visible: Number.isFinite(ellipse.visible) ? ellipse.visible : 60,
    cx: leftX + width / 2,
    cy: 0,
    a: width / 2,
    b: height / 2
  };
}

function arcEndpoint(ellipse) {
  const normalized = ellipseGeometry(ellipse);
  const halfAngle = Math.PI * normalized.visible / 200;
  return {
    x: normalized.leftX + normalized.a * (1 - Math.cos(halfAngle)),
    y: normalized.b * Math.sin(halfAngle)
  };
}

function fitArcToEndpoint(ellipse, endpoint) {
  const normalized = ellipseGeometry(ellipse);
  const targetY = Math.abs(endpoint.y);
  ellipse.width = normalized.width;
  ellipse.height = Math.max(normalized.height, targetY * 2 + 2);

  const fitted = ellipseGeometry(ellipse);
  const ratio = clamp(targetY / fitted.b, 0, 0.9999);
  const halfAngle = Math.asin(ratio);
  const visible = 200 * halfAngle / Math.PI;
  ellipse.visible = clamp(roundTo(visible, 4), 1, 100);
  ellipse.leftX = roundTo(endpoint.x - fitted.a * (1 - Math.cos(halfAngle)), 4);
}

function normalizeEllipseConstraints(sourceIndex = -1) {
  const e1 = state.ellipses[0];
  const e2 = state.ellipses[1];
  const e3 = state.ellipses[2];
  const e4 = state.ellipses[3];

  state.ellipses.forEach((ellipse) => {
    const normalized = ellipseGeometry(ellipse);
    ellipse.leftX = roundTo(normalized.leftX);
    ellipse.width = roundTo(clamp(normalized.width, 48, 620));
    ellipse.height = roundTo(clamp(normalized.height, 36, 360));
    ellipse.visible = roundTo(clamp(normalized.visible, 1, 100));
  });

  if (sourceIndex === 3) {
    e1.width = e4.width;
    e1.height = e4.height;
  } else {
    e4.width = e1.width;
    e4.height = e1.height;
  }

  fitArcToEndpoint(e2, arcEndpoint(e1));
  e3.leftX = e2.leftX;

  const e3Endpoint = arcEndpoint(e3);
  if (e3Endpoint.y > e4.height / 2) {
    e1.height = Math.min(360, roundTo(e3Endpoint.y * 2 + 2));
    e4.height = e1.height;
    fitArcToEndpoint(e2, arcEndpoint(e1));
    e3.leftX = e2.leftX;
  }
  fitArcToEndpoint(e4, arcEndpoint(e3));
  e1.width = e4.width;
  e1.height = e4.height;
}

function ellipsePoint(ellipse, angle) {
  const normalized = ellipseGeometry(ellipse);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: normalized.cx + normalized.a * c,
    y: normalized.cy + normalized.b * s
  };
}

function ellipseValue(ellipse, point) {
  const normalized = ellipseGeometry(ellipse);
  const x = point.x - normalized.cx;
  const y = point.y - normalized.cy;
  return (x * x) / (normalized.a * normalized.a) + (y * y) / (normalized.b * normalized.b) - 1;
}

function sampleArc(ellipse, steps = 96, mirrorY = false) {
  const halfAngle = Math.PI * ellipse.visible / 200;
  const start = Math.PI - halfAngle;
  const end = Math.PI + halfAngle;
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const point = ellipsePoint(ellipse, start + (end - start) * i / steps);
    points.push(mirrorY ? { x: point.x, y: -point.y } : point);
  }
  return points;
}

function sampleEllipse(ellipse, steps = 192) {
  return Array.from({ length: steps }, (_, index) => ellipsePoint(ellipse, TWO_PI * index / steps));
}

function roundedPointKey(point) {
  return `${Math.round(point.x * 10) / 10},${Math.round(point.y * 10) / 10}`;
}

function findEllipseIntersections() {
  const found = new Map();
  for (let a = 0; a < state.ellipses.length; a += 1) {
    for (let b = a + 1; b < state.ellipses.length; b += 1) {
      const first = state.ellipses[a];
      const second = state.ellipses[b];
      let previousT = 0;
      let previousPoint = ellipsePoint(first, 0);
      let previousValue = ellipseValue(second, previousPoint);
      for (let step = 1; step <= 720; step += 1) {
        const t = TWO_PI * step / 720;
        const point = ellipsePoint(first, t);
        const value = ellipseValue(second, point);
        if (Math.abs(value) < 0.002 || value * previousValue < 0) {
          const refined = refineIntersection(first, second, previousT, t);
          const key = roundedPointKey(refined);
          found.set(key, { ...refined, pair: `E${a + 1}/E${b + 1}` });
        }
        previousT = t;
        previousValue = value;
      }
    }
  }
  return [...found.values()];
}

function refineIntersection(first, second, low, high) {
  let a = low;
  let b = high;
  let fa = ellipseValue(second, ellipsePoint(first, a));
  for (let i = 0; i < 28; i += 1) {
    const mid = (a + b) / 2;
    const fm = ellipseValue(second, ellipsePoint(first, mid));
    if (fa * fm <= 0) {
      b = mid;
    } else {
      a = mid;
      fa = fm;
    }
  }
  return ellipsePoint(first, (a + b) / 2);
}

function transformForCanvas(canvas, box) {
  const padding = 52;
  const scale = Math.min((canvas.width - padding * 2) / box.width, (canvas.height - padding * 2) / box.height);
  return {
    scale,
    ox: canvas.width / 2,
    oy: canvas.height / 2,
    toScreen(point) {
      return { x: this.ox + point.x * scale, y: this.oy + point.y * scale };
    },
    toWorld(point) {
      return { x: (point.x - this.ox) / scale, y: (point.y - this.oy) / scale };
    }
  };
}

function syncCanvasDisplaySize(canvas, box) {
  const view = canvas.parentElement;
  if (!view || !Number.isFinite(view.clientWidth) || view.clientWidth <= 0) return;

  const bar = view.querySelector(".view-bar");
  const rect = view.getBoundingClientRect();
  const availableWidth = Math.max(0, Math.min(view.clientWidth, rect.width || view.clientWidth) - 2);
  const availableHeight = Math.max(0, (rect.height || view.clientHeight) - (bar ? bar.offsetHeight : 0) - 2);
  const ratio = box.width / box.height;
  const width = availableHeight > 0 ? Math.min(availableWidth, availableHeight * ratio) : availableWidth;
  const height = width / ratio;

  canvas.style.setProperty("width", `${Math.floor(width)}px`, "important");
  canvas.style.setProperty("height", `${Math.floor(height)}px`, "important");
}

function syncCanvasDisplaySizes() {
  syncCanvasDisplaySize(controls.geometryCanvas, GEOMETRY_BOX);
  syncCanvasDisplaySize(controls.artCanvas, ART_BOX);
}

function clear(ctx, color = "#f7f3ea") {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawPolyline(ctx, transform, points, close = false) {
  if (points.length === 0) return;
  const first = transform.toScreen(points[0]);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  points.slice(1).forEach((point) => {
    const screen = transform.toScreen(point);
    ctx.lineTo(screen.x, screen.y);
  });
  if (close) ctx.closePath();
}

function drawEllipseWire(ctx, transform, ellipse, index) {
  const normalized = ellipseGeometry(ellipse);
  if (state.showFullEllipses) {
    drawPolyline(ctx, transform, sampleEllipse(ellipse), true);
    ctx.strokeStyle = `hsla(${index * 64 + 16}, 62%, 37%, 0.34)`;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 7]);
    ctx.stroke();
  }

  drawPolyline(ctx, transform, sampleArc(ellipse, 72), false);
  ctx.strokeStyle = `hsla(${index * 64 + 16}, 70%, 31%, 0.95)`;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  ctx.stroke();

  drawPolyline(ctx, transform, sampleArc(ellipse, 72, true), false);
  ctx.strokeStyle = `hsla(${index * 64 + 16}, 70%, 31%, 0.55)`;
  ctx.lineWidth = 2;
  ctx.stroke();

  const left = transform.toScreen({ x: normalized.leftX, y: 0 });
  ctx.save();
  ctx.strokeStyle = "rgba(23, 32, 29, 0.34)";
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(left.x, left.y - 8);
  ctx.lineTo(left.x, left.y + 8);
  ctx.stroke();
  ctx.restore();
}

function closedPairPoints(firstIndex, secondIndex) {
  const firstTop = sampleArc(state.ellipses[firstIndex], 72);
  const secondTop = sampleArc(state.ellipses[secondIndex], 72).reverse();
  const firstBottom = sampleArc(state.ellipses[firstIndex], 72, true).reverse();
  const secondBottom = sampleArc(state.ellipses[secondIndex], 72, true);
  return [...firstTop, ...secondTop, ...firstBottom, ...secondBottom];
}

function fillClosedPair(ctx, transform, firstIndex, secondIndex, color) {
  ctx.save();
  drawPolyline(ctx, transform, closedPairPoints(firstIndex, secondIndex), true);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawPoint(ctx, transform, point, radius, color) {
  const screen = transform.toScreen(point);
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radius, 0, TWO_PI);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawHandleRing(ctx, transform, point, radius, color) {
  const screen = transform.toScreen(point);
  ctx.save();
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radius, 0, TWO_PI);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.restore();
}

function drawGeometry() {
  clear(geometryCtx);
  const transform = transformForCanvas(controls.geometryCanvas, GEOMETRY_BOX);

  if (state.showGuides) {
    geometryCtx.save();
    geometryCtx.strokeStyle = "rgba(23, 32, 29, 0.14)";
    geometryCtx.lineWidth = 1;
    for (let x = -360; x <= 360; x += 60) {
      const a = transform.toScreen({ x, y: -250 });
      const b = transform.toScreen({ x, y: 250 });
      geometryCtx.beginPath();
      geometryCtx.moveTo(a.x, a.y);
      geometryCtx.lineTo(b.x, b.y);
      geometryCtx.stroke();
    }
    for (let y = -240; y <= 240; y += 60) {
      const a = transform.toScreen({ x: -370, y });
      const b = transform.toScreen({ x: 370, y });
      geometryCtx.beginPath();
      geometryCtx.moveTo(a.x, a.y);
      geometryCtx.lineTo(b.x, b.y);
      geometryCtx.stroke();
    }
    const axisStart = transform.toScreen({ x: -380, y: 0 });
    const axisEnd = transform.toScreen({ x: 380, y: 0 });
    geometryCtx.strokeStyle = "rgba(201, 79, 47, 0.72)";
    geometryCtx.lineWidth = 1.5;
    geometryCtx.setLineDash([11, 8]);
    geometryCtx.beginPath();
    geometryCtx.moveTo(axisStart.x, axisStart.y);
    geometryCtx.lineTo(axisEnd.x, axisEnd.y);
    geometryCtx.stroke();
    geometryCtx.restore();
  }

  fillClosedPair(geometryCtx, transform, 0, 1, "rgba(243, 211, 66, 0.34)");
  fillClosedPair(geometryCtx, transform, 2, 3, "rgba(20, 127, 131, 0.28)");

  state.ellipses.forEach((ellipse, index) => drawEllipseWire(geometryCtx, transform, ellipse, index));

  lastIntersections = findEllipseIntersections();
  lastIntersections.forEach((point) => drawPoint(geometryCtx, transform, point, 5, "#147f83"));

  state.ellipses.forEach((ellipse, index) => {
    const normalized = ellipseGeometry(ellipse);
    drawPoint(geometryCtx, transform, normalized, 5, "#c94f2f");
    if (index === state.activePart) {
      drawHandleRing(geometryCtx, transform, normalized, 9, "#17201d");
    }
  });
  const eyePoint = { x: state.module.eyeX, y: 0 };
  drawPoint(
    geometryCtx,
    transform,
    eyePoint,
    state.module.eyeRadius,
    "#17201d"
  );

  controls.geometryMetric.textContent = `${lastIntersections.length} intersections`;
}

function transformPatternPoint(point, offset, direction = 1) {
  const x = direction === -1 ? state.module.eyeX - (point.x - state.module.eyeX) : point.x;
  return {
    x: x * state.layout.scale + offset.x,
    y: point.y * state.layout.scaleY + offset.y
  };
}

function rainbowColorForFish(variant) {
  const fishNumber = variant >= 101 ? variant - 100 : variant;
  return RAINBOW_COLORS[(Math.max(1, fishNumber) - 1) % RAINBOW_COLORS.length];
}

function transformedClosedPairPoints(firstIndex, secondIndex, offset, direction) {
  return closedPairPoints(firstIndex, secondIndex).map((point) => transformPatternPoint(point, offset, direction));
}

function fillFishClosedPairs(ctx, transform, offset, variant, direction) {
  ctx.save();
  ctx.fillStyle = rainbowColorForFish(variant);
  ctx.globalAlpha = 0.56;
  drawPolyline(ctx, transform, transformedClosedPairPoints(0, 1, offset, direction), true);
  ctx.fill();
  drawPolyline(ctx, transform, transformedClosedPairPoints(2, 3, offset, direction), true);
  ctx.fill();
  ctx.restore();
}

function drawFishUnit(ctx, transform, offset, variant, direction = 1) {
  if (state.layout.colorEnabled) {
    fillFishClosedPairs(ctx, transform, offset, variant, direction);
  }

  ctx.save();
  ctx.strokeStyle = "#17201d";
  ctx.lineWidth = PATTERN_STROKE_WIDTH;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  state.ellipses.forEach((ellipse) => {
    const top = sampleArc(ellipse, 60).map((point) => transformPatternPoint(point, offset, direction));
    const bottom = sampleArc(ellipse, 60, true).map((point) => transformPatternPoint(point, offset, direction));
    drawPolyline(ctx, transform, top);
    ctx.stroke();
    drawPolyline(ctx, transform, bottom);
    ctx.stroke();
  });
  const eye = transform.toScreen(transformPatternPoint({ x: state.module.eyeX, y: 0 }, offset, direction));
  ctx.beginPath();
  ctx.arc(eye.x, eye.y, state.module.eyeRadius * transform.scale * state.layout.scale, 0, TWO_PI);
  ctx.fillStyle = "#17201d";
  ctx.fill();
  ctx.restore();
}

function drawArtwork(ctx = artCtx) {
  clear(ctx, state.layout.colorEnabled ? "#ede8dc" : "#f7f3ea");
  const transform = transformForCanvas(ctx.canvas, ART_BOX);
  const maxFish = Math.max(1, Math.round(state.layout.maxFish));
  const e1 = state.ellipses[0];
  const e4 = state.ellipses[3];
  const step = Math.max(20, (e4.leftX - e1.leftX) * state.layout.scale);
  const startX = state.layout.offsetX - step * (maxFish - 1) / 2;
  let modules = 0;

  for (let index = 0; index < maxFish; index += 1) {
    const offset = {
      x: startX + index * step,
      y: 0
    };
    drawFishUnit(ctx, transform, offset, index + 1, 1);
    drawFishUnit(ctx, transform, offset, index + 101, -1);
    modules += 2;
  }

  if (ctx === artCtx) controls.artMetric.textContent = `${modules} fish / max ${maxFish}`;
}

function renderPatternReadout() {
  if (state.activePart === "eye") {
    controls.readoutTitle.textContent = "Calculated Geometry";
    controls.readout.innerHTML = [
      "<strong>Eye</strong>",
      `center (${state.module.eyeX}, 0)`,
      `radius ${state.module.eyeRadius}`,
      `${lastIntersections.length} ellipse intersections in the current module`
    ].join("<br>");
    return;
  }

  const active = state.ellipses[state.activePart];
  const pointSummary = lastIntersections.slice(0, 6).map((point) => {
    return `${point.pair} (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`;
  });
  controls.readoutTitle.textContent = "Calculated Geometry";
  controls.readout.innerHTML = [
    `<strong>${active.label}</strong>`,
    `left x ${active.leftX}, size ${active.width} x ${active.height}`,
    `${active.visible}% visible from the left; mirrored across y=0`,
    `eye (${state.module.eyeX}, 0)`,
    pointSummary.length ? pointSummary.join("<br>") : "No ellipse intersections in the current configuration."
  ].join("<br>");
}

function renderArtReadout() {
  const maxFish = Math.max(1, Math.round(state.layout.maxFish));
  const step = Math.max(20, (state.ellipses[3].leftX - state.ellipses[0].leftX) * state.layout.scale);
  controls.readoutTitle.textContent = "Artwork Settings";
  controls.readout.innerHTML = [
    "<strong>One-row final layout</strong>",
    `fish 1-${maxFish} plus opposite fish 101-${100 + maxFish}`,
    `E4(i) aligns with E1(i+1); repeat step ${roundTo(step)}`,
    `opposite fish share eye x with matching fish`,
    `scale x ${state.layout.scale}, scale y ${state.layout.scaleY}, offset x ${state.layout.offsetX}`,
    state.layout.colorEnabled ? "rainbow fill: red, orange, yellow, green, blue, indigo, purple" : "color off"
  ].join("<br>");
}

function render() {
  syncCanvasDisplaySizes();
  drawGeometry();
  drawArtwork();
  if (state.page === "pattern") {
    renderPatternReadout();
  } else {
    renderArtReadout();
  }
  saveLocalState();
}

function createRange(parent, config, getter, setter) {
  const label = document.createElement("label");
  const title = document.createElement("span");
  const output = document.createElement("output");
  const range = document.createElement("input");
  const number = document.createElement("input");

  range.type = "range";
  range.min = config.min;
  range.max = config.max;
  range.step = config.step || 1;
  range.disabled = Boolean(config.disabled);
  number.type = "number";
  number.min = config.min;
  number.max = config.max;
  number.step = config.step || 1;
  number.disabled = Boolean(config.disabled);

  function sync(value) {
    output.value = String(value);
    range.value = String(value);
    number.value = String(value);
  }

  function apply(value) {
    const next = clamp(Number(value), Number(config.min), Number(config.max));
    setter(next);
    sync(next);
    render();
  }

  title.append(config.label, output);
  label.append(title, range, number);
  parent.append(label);
  sync(getter());

  range.addEventListener("input", () => apply(range.value));
  number.addEventListener("change", () => apply(number.value));
  number.addEventListener("keydown", (event) => {
    if (event.key === "Enter") number.blur();
  });
}

function buildControls() {
  controls.showGuides.checked = state.showGuides;
  controls.showFullEllipses.checked = state.showFullEllipses;
  controls.colorEnabled.checked = state.layout.colorEnabled;

  const layoutFields = [
    ["maxFish", "Max fish", 1, 20],
    ["scale", "Horizontal scale", 0.55, 1.45, 0.01],
    ["scaleY", "Vertical scale", 0.35, 1.8, 0.01],
    ["offsetX", "Offset x", -220, 220]
  ];
  layoutFields.forEach(([key, label, min, max, step]) => {
    createRange(
      controls.layoutControls,
      { label, min, max, step },
      () => state.layout[key],
      (value) => {
        state.layout[key] = key === "maxFish" ? Math.round(value) : value;
      }
    );
  });

  ["Eye", "E1", "E2", "E3", "E4"].forEach((label, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      state.activePart = index === 0 ? "eye" : index - 1;
      rebuildEllipseControls();
      render();
    });
    controls.ellipseTabs.append(button);
  });

  Object.keys(palettes).forEach((key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = key[0].toUpperCase() + key.slice(1);
    button.addEventListener("click", () => {
      state.palette = key;
      syncButtonStates();
      render();
    });
    controls.paletteControls.append(button);
  });

  Object.entries(styleLabels).forEach(([key, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      state.style = key;
      syncButtonStates();
      render();
    });
    controls.styleControls.append(button);
  });

  controls.showGuides.onchange = () => {
    state.showGuides = controls.showGuides.checked;
    render();
  };
  controls.showFullEllipses.onchange = () => {
    state.showFullEllipses = controls.showFullEllipses.checked;
    render();
  };
  controls.colorEnabled.onchange = () => {
    state.layout.colorEnabled = controls.colorEnabled.checked;
    render();
  };
  controls.patternPageButton.onclick = () => setPage("pattern");
  controls.artPageButton.onclick = () => setPage("art");
  controls.resetPatternButton.onclick = resetPattern;
  controls.resetLayoutButton.onclick = resetLayout;
  controls.savePatternButton.onclick = savePatternToServer;
  controls.exportSvgButton.onclick = exportSvg;
  controls.exportPngButton.onclick = exportPng;
  rebuildEllipseControls();
  syncButtonStates();
}

function rebuildEllipseControls() {
  controls.ellipseControls.innerHTML = "";
  const form = document.createElement("div");
  form.className = "ellipse-form";

  if (state.activePart === "eye") {
    [
      ["eyeX", "Eye x", -230, 40],
      ["eyeRadius", "Eye radius", 3, 24]
    ].forEach(([key, label, min, max, step]) => {
      createRange(
        form,
        { label, min, max, step },
        () => state.module[key],
        (value) => {
          state.module[key] = value;
        }
      );
    });
    controls.ellipseControls.append(form);
    syncButtonStates();
    return;
  }

  const ellipse = state.ellipses[state.activePart];
  const fittedPair = state.activePart === 1 || state.activePart === 3;
  const fittedSharedX = state.activePart === 1 || state.activePart === 2;
  const fields = [
    ["leftX", fittedSharedX ? "Fitted shared left x" : "Left x", -330, 180, fittedSharedX],
    ["width", state.activePart === 0 || state.activePart === 3 ? "Shared width" : "Width", 48, 620],
    ["height", state.activePart === 0 || state.activePart === 3 ? "Shared height" : "Height", 36, 360],
    ["visible", fittedPair ? "Fitted visible" : "Visible from left", 1, 100, fittedPair]
  ];
  fields.forEach(([key, label, min, max, disabled]) => {
    createRange(
      form,
      { label, min, max, disabled },
      () => ellipse[key],
      (value) => {
        ellipse[key] = value;
        normalizeEllipseConstraints(state.activePart);
        rebuildEllipseControls();
      }
    );
  });
  controls.ellipseControls.append(form);
  syncButtonStates();
}

function syncButtonStates() {
  controls.patternPageButton.classList.toggle("is-active", state.page === "pattern");
  controls.artPageButton.classList.toggle("is-active", state.page === "art");
  [...controls.ellipseTabs.children].forEach((button, index) => {
    const part = index === 0 ? "eye" : index - 1;
    button.classList.toggle("is-active", part === state.activePart);
  });
  [...controls.paletteControls.children].forEach((button) => {
    button.classList.toggle("is-active", button.textContent.toLowerCase() === state.palette);
  });
  [...controls.styleControls.children].forEach((button) => {
    const key = Object.entries(styleLabels).find((entry) => entry[1] === button.textContent)?.[0];
    button.classList.toggle("is-active", key === state.style);
  });
}

function setPage(page) {
  state.page = page;
  const isPattern = page === "pattern";
  controls.patternPage.hidden = !isPattern;
  controls.artPage.hidden = isPattern;
  controls.patternPanel.hidden = !isPattern;
  controls.artPanel.hidden = isPattern;
  controls.resetPatternButton.hidden = !isPattern;
  controls.resetLayoutButton.hidden = isPattern;
  controls.exportSvgButton.hidden = isPattern;
  controls.exportPngButton.hidden = isPattern;
  syncButtonStates();
  render();
}

function clearGeneratedControls() {
  controls.layoutControls.innerHTML = "";
  controls.ellipseTabs.innerHTML = "";
  controls.paletteControls.innerHTML = "";
  controls.styleControls.innerHTML = "";
}

function resetPattern() {
  state.module = JSON.parse(JSON.stringify(defaults.module));
  state.ellipses = JSON.parse(JSON.stringify(defaults.ellipses));
  state.activePart = "eye";
  normalizeEllipseConstraints();
  state.showGuides = defaults.showGuides ?? true;
  state.showFullEllipses = defaults.showFullEllipses ?? true;
  controls.showGuides.checked = state.showGuides;
  controls.showFullEllipses.checked = state.showFullEllipses;
  clearGeneratedControls();
  buildControls();
  render();
}

function resetLayout() {
  state.layout = JSON.parse(JSON.stringify(defaults.layout));
  state.palette = "primaries";
  state.style = "chequer";
  clearGeneratedControls();
  buildControls();
  render();
}

function pointerPosition(event) {
  const rect = controls.geometryCanvas.getBoundingClientRect();
  const scaleX = controls.geometryCanvas.width / rect.width;
  const scaleY = controls.geometryCanvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function nearestHandle(world) {
  const candidates = [
    ...state.ellipses.map((ellipse, index) => {
      const normalized = ellipseGeometry(ellipse);
      return { type: "ellipse", index, x: normalized.cx, y: 0 };
    }),
    { type: "eye", index: -1, x: state.module.eyeX, y: 0 }
  ];
  return candidates.reduce((best, item) => {
    const distance = Math.abs(world.x - item.x);
    return distance < best.distance ? { ...item, distance } : best;
  }, { distance: Infinity });
}

controls.geometryCanvas.addEventListener("pointerdown", (event) => {
  const transform = transformForCanvas(controls.geometryCanvas, GEOMETRY_BOX);
  const world = transform.toWorld(pointerPosition(event));
  const nearest = nearestHandle(world);
  if (nearest.distance > 22 || Math.abs(world.y) > 190) return;
  dragTarget = nearest;
  state.activePart = nearest.type === "ellipse" ? nearest.index : "eye";
  rebuildEllipseControls();
  controls.geometryCanvas.setPointerCapture(event.pointerId);
});

controls.geometryCanvas.addEventListener("pointermove", (event) => {
  if (!dragTarget) return;
  const transform = transformForCanvas(controls.geometryCanvas, GEOMETRY_BOX);
  const world = transform.toWorld(pointerPosition(event));
  if (dragTarget.type === "eye") {
    state.module.eyeX = Math.round(clamp(world.x, -230, 40));
  } else {
    const ellipse = state.ellipses[dragTarget.index];
    ellipse.leftX = Math.round(clamp(world.x - ellipse.width / 2, -330, 180));
    normalizeEllipseConstraints(dragTarget.index);
  }
  clearGeneratedControls();
  buildControls();
  render();
});

controls.geometryCanvas.addEventListener("pointerup", () => {
  dragTarget = null;
});

if (typeof window.addEventListener === "function") {
  window.addEventListener("resize", render);
}

async function savePatternToServer() {
  const name = controls.patternName.value.trim() || "Pattern 1";
  const pattern = {
    id: `pattern-${Date.now().toString(36)}`,
    name,
    savedAt: new Date().toISOString(),
    module: JSON.parse(JSON.stringify(state.module)),
    ellipses: JSON.parse(JSON.stringify(state.ellipses))
  };

  controls.patternSaveStatus.textContent = "Saving...";
  controls.savePatternButton.disabled = true;
  try {
    const response = await fetch(apiPath(`/patterns/${encodeURIComponent(name)}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pattern)
    });
    if (!response.ok) {
      throw new Error(`Save failed with ${response.status}`);
    }
    controls.patternSaveStatus.textContent = `Saved ${name}`;
  } catch (error) {
    console.error("Pattern save failed.", error);
    controls.patternSaveStatus.textContent = "Save failed";
  } finally {
    controls.savePatternButton.disabled = false;
  }
}

function exportPng() {
  const output = document.createElement("canvas");
  output.width = ART_BOX.width * 2;
  output.height = ART_BOX.height * 2;
  const target = output.getContext("2d");
  drawArtwork(target);
  download("fish-tessellation.png", output.toDataURL("image/png"));
}

function svgPolyline(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function svgPatternPoint(point, direction = 1) {
  const x = direction === -1 ? state.module.eyeX - (point.x - state.module.eyeX) : point.x;
  return { x, y: point.y };
}

function svgClosedPairPath(firstIndex, secondIndex, direction) {
  return `${svgPolyline(closedPairPoints(firstIndex, secondIndex).map((point) => svgPatternPoint(point, direction)))} Z`;
}

function createUnitSvg(offset, direction, variant) {
  const ink = "#17201d";
  const transform = `translate(${offset.x} ${offset.y}) scale(${state.layout.scale} ${state.layout.scaleY})`;
  const fill = rainbowColorForFish(variant);
  const eye = transformPatternPoint({ x: state.module.eyeX, y: 0 }, offset, direction);
  const eyeRadius = state.module.eyeRadius * state.layout.scale;
  const paths = state.ellipses.flatMap((ellipse) => {
    return [
      `<path d="${svgPolyline(sampleArc(ellipse, 48).map((point) => svgPatternPoint(point, direction)))}" />`,
      `<path d="${svgPolyline(sampleArc(ellipse, 48, true).map((point) => svgPatternPoint(point, direction)))}" />`
    ];
  }).join("\n      ");
  return `<g transform="${transform}">
    ${state.layout.colorEnabled ? `<path d="${svgClosedPairPath(0, 1, direction)}" fill="${fill}" opacity="0.56" />
    <path d="${svgClosedPairPath(2, 3, direction)}" fill="${fill}" opacity="0.56" />` : ""}
    <g fill="none" stroke="${ink}" stroke-width="${PATTERN_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">
      ${paths}
    </g>
  </g>
  <circle cx="${eye.x}" cy="${eye.y}" r="${eyeRadius}" fill="${ink}" />`;
}

function exportSvg() {
  const maxFish = Math.max(1, Math.round(state.layout.maxFish));
  const step = Math.max(20, (state.ellipses[3].leftX - state.ellipses[0].leftX) * state.layout.scale);
  const startX = state.layout.offsetX - step * (maxFish - 1) / 2;
  const units = [];
  for (let index = 0; index < maxFish; index += 1) {
    const offset = {
      x: ART_BOX.width / 2 + startX + index * step,
      y: ART_BOX.height / 2
    };
    units.push(createUnitSvg(offset, 1, index + 1));
    units.push(createUnitSvg(offset, -1, index + 101));
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${ART_BOX.width}" height="${ART_BOX.height}" viewBox="0 0 ${ART_BOX.width} ${ART_BOX.height}">
  <rect width="100%" height="100%" fill="#f7f3ea" />
  ${units.join("\n  ")}
</svg>
`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  download("fish-tessellation.svg", url);
  URL.revokeObjectURL(url);
}

function download(filename, href) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = href;
  link.click();
}

applyStoredState();
normalizeEllipseConstraints();
buildControls();
setPage("pattern");
