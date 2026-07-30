const GEOMETRY_BOX = { width: 860, height: 620 };
const ART_BOX = { width: 1120, height: 760 };
const MODULE_WIDTH = 420;
const PATTERN_STROKE_WIDTH = 3.4;
const ART_NAME = "fish-pattern";
const LOCAL_STATE_KEY = "fish-tessellation-lab-state-v1";
const TWO_PI = Math.PI * 2;

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
    pitchY: 178,
    columns: 5,
    rows: 7,
    columnSpacing: 0.78,
    offsetX: 0,
    offsetY: 0,
    cellSize: 30,
    backgroundCell: 42,
    scale: 1
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

function ellipseGeometry(ellipse) {
  return {
    label: ellipse.label,
    leftX: ellipse.leftX,
    width: ellipse.width,
    height: ellipse.height,
    visible: ellipse.visible,
    cx: ellipse.leftX + ellipse.width / 2,
    cy: 0,
    a: ellipse.width / 2,
    b: ellipse.height / 2
  };
}

function normalizeEllipseConstraints(sourceIndex = -1) {
  const e1 = state.ellipses[0];
  const e2 = state.ellipses[1];
  const e3 = state.ellipses[2];
  const e4 = state.ellipses[3];

  if (sourceIndex === 3) {
    e1.width = e4.width;
    e1.height = e4.height;
  } else {
    e4.width = e1.width;
    e4.height = e1.height;
  }

  if (sourceIndex === 2) {
    e2.leftX = e3.leftX;
  } else {
    e3.leftX = e2.leftX;
  }

  state.ellipses.forEach((ellipse) => {
    ellipse.leftX = Math.round(ellipse.leftX);
    ellipse.width = Math.round(ellipse.width);
    ellipse.height = Math.round(ellipse.height);
    ellipse.visible = Math.round(clamp(ellipse.visible, 1, 100));
  });
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

function fishOutlinePoints() {
  const top = state.ellipses.flatMap((ellipse) => sampleArc(ellipse, 42));
  const bottom = [...top].reverse().map((point) => ({ x: point.x, y: -point.y }));
  return [...top, ...bottom];
}

function drawFishUnit(ctx, transform, offset, variant) {
  const palette = palettes[state.palette];
  const outline = fishOutlinePoints().map((point) => ({
    x: point.x * state.layout.scale + offset.x,
    y: point.y * state.layout.scale + offset.y
  }));

  ctx.save();
  drawPolyline(ctx, transform, outline, true);
  ctx.clip();
  paintCells(ctx, transform, offset, variant, palette);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = palette[4] || "#191919";
  ctx.lineWidth = PATTERN_STROKE_WIDTH;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  state.ellipses.forEach((ellipse) => {
    const top = sampleArc(ellipse, 60).map((point) => scaleOffset(point, offset));
    const bottom = sampleArc(ellipse, 60, true).map((point) => scaleOffset(point, offset));
    drawPolyline(ctx, transform, top);
    ctx.stroke();
    drawPolyline(ctx, transform, bottom);
    ctx.stroke();
  });
  const eye = transform.toScreen(scaleOffset({ x: state.module.eyeX, y: 0 }, offset));
  ctx.beginPath();
  ctx.arc(eye.x, eye.y, state.module.eyeRadius * transform.scale * state.layout.scale, 0, TWO_PI);
  ctx.fillStyle = palette[4] || "#191919";
  ctx.fill();
  ctx.restore();
}

function scaleOffset(point, offset) {
  return {
    x: point.x * state.layout.scale + offset.x,
    y: point.y * state.layout.scale + offset.y
  };
}

function paintCells(ctx, transform, offset, variant, palette) {
  const cell = state.layout.cellSize * state.layout.scale;
  const width = MODULE_WIDTH * state.layout.scale;
  const height = state.layout.pitchY * 0.94 * state.layout.scale;
  for (let y = -height / 2; y <= height / 2; y += cell) {
    for (let x = -width / 2; x <= width / 2; x += cell) {
      const overlap = ellipseOverlapAt({ x: x / state.layout.scale, y: y / state.layout.scale });
      const colorIndex = colorIndexForCell(x, y, variant, overlap, palette.length);
      const a = transform.toScreen({ x: offset.x + x, y: offset.y + y });
      const b = transform.toScreen({ x: offset.x + x + cell + 1, y: offset.y + y + cell + 1 });
      ctx.fillStyle = palette[colorIndex];
      ctx.globalAlpha = state.style === "overlap" ? 0.58 + overlap * 0.08 : 0.9;
      if (state.style === "stripes") {
        ctx.fillRect(a.x, a.y, b.x - a.x, Math.max(1, (b.y - a.y) * 0.48));
      } else {
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      }
    }
  }
  ctx.globalAlpha = 1;

  if (state.style === "gradient") {
    const left = transform.toScreen({ x: offset.x - width / 2, y: offset.y });
    const right = transform.toScreen({ x: offset.x + width / 2, y: offset.y });
    const gradient = ctx.createLinearGradient(left.x, 0, right.x, 0);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(0.5, palette[2]);
    gradient.addColorStop(1, palette[3]);
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.48;
    const top = transform.toScreen({ x: offset.x - width / 2, y: offset.y - height / 2 });
    const bottom = transform.toScreen({ x: offset.x + width / 2, y: offset.y + height / 2 });
    ctx.fillRect(top.x, top.y, bottom.x - top.x, bottom.y - top.y);
    ctx.globalAlpha = 1;
  }
}

function ellipseOverlapAt(point) {
  return state.ellipses.reduce((total, ellipse) => total + (ellipseValue(ellipse, point) <= 0 ? 1 : 0), 0);
}

function colorIndexForCell(x, y, variant, overlap, paletteLength) {
  if (state.style === "overlap") return clamp(overlap, 0, paletteLength - 1);
  if (state.style === "stripes") return Math.abs(Math.floor((y + variant * 17) / state.layout.cellSize)) % paletteLength;
  if (state.style === "gradient") return Math.abs(Math.floor((x + y) / 62 + variant)) % paletteLength;
  return Math.abs(Math.floor(x / state.layout.cellSize) + Math.floor(y / state.layout.cellSize) + variant) % paletteLength;
}

function drawArtwork(ctx = artCtx) {
  clear(ctx, "#ede8dc");
  const transform = transformForCanvas(ctx.canvas, ART_BOX);
  const pitch = state.layout.pitchY * state.layout.scale;
  const columnPitch = MODULE_WIDTH * state.layout.columnSpacing * state.layout.scale;
  const rowStart = -Math.floor((state.layout.rows - 1) / 2);
  const rowEnd = rowStart + state.layout.rows;
  const colStart = -Math.floor((state.layout.columns - 1) / 2);
  const colEnd = colStart + state.layout.columns;
  let modules = 0;

  drawBackgroundPattern(ctx);
  for (let row = rowStart; row < rowEnd; row += 1) {
    for (let col = colStart; col < colEnd; col += 1) {
      const flip = (row + col) % 2 !== 0;
      const offset = {
        x: state.layout.offsetX + col * columnPitch,
        y: state.layout.offsetY + row * pitch
      };
      ctx.save();
      if (flip) {
        const origin = transform.toScreen(offset);
        ctx.translate(origin.x, origin.y);
        ctx.scale(-1, 1);
        ctx.translate(-origin.x, -origin.y);
      }
      drawFishUnit(ctx, transform, offset, row * 7 + col);
      ctx.restore();
      modules += 1;
    }
  }

  if (ctx === artCtx) controls.artMetric.textContent = `${modules} modules / Sy ${state.layout.pitchY}`;
}

function drawBackgroundPattern(ctx) {
  const palette = palettes[state.palette];
  const size = state.layout.backgroundCell;
  for (let y = 0; y < ctx.canvas.height; y += size) {
    for (let x = 0; x < ctx.canvas.width; x += size) {
      const index = Math.floor(x / size) + Math.floor(y / size);
      ctx.fillStyle = palette[index % palette.length];
      ctx.globalAlpha = state.style === "chequer" ? 0.15 : 0.08;
      ctx.fillRect(x, y, size, size);
    }
  }
  ctx.globalAlpha = 1;
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
  controls.readoutTitle.textContent = "Artwork Settings";
  controls.readout.innerHTML = [
    "<strong>Final art layout</strong>",
    `${state.layout.columns} columns x ${state.layout.rows} rows = ${state.layout.columns * state.layout.rows} modules`,
    `pitch ${state.layout.pitchY}, spacing ${state.layout.columnSpacing}, scale ${state.layout.scale}`,
    `offset (${state.layout.offsetX}, ${state.layout.offsetY}), cell ${state.layout.cellSize}`,
    `palette ${state.palette}, style ${styleLabels[state.style]}`
  ].join("<br>");
}

function render() {
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
  number.type = "number";
  number.min = config.min;
  number.max = config.max;
  number.step = config.step || 1;

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

  const layoutFields = [
    ["columns", "Columns", 1, 11],
    ["rows", "Rows", 1, 13],
    ["pitchY", "Vertical pitch Sy", 80, 330],
    ["columnSpacing", "Column spacing", 0.45, 1.25, 0.01],
    ["scale", "Pattern scale", 0.55, 1.45, 0.01],
    ["offsetX", "Offset x", -220, 220],
    ["offsetY", "Offset y", -180, 180],
    ["cellSize", "Color cell", 12, 58],
    ["backgroundCell", "Background grid", 18, 86]
  ];
  layoutFields.forEach(([key, label, min, max, step]) => {
    createRange(
      controls.layoutControls,
      { label, min, max, step },
      () => state.layout[key],
      (value) => {
        state.layout[key] = ["columns", "rows", "cellSize", "backgroundCell"].includes(key) ? Math.round(value) : value;
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
  const fields = [
    ["leftX", state.activePart === 1 || state.activePart === 2 ? "Shared left x" : "Left x", -330, 180],
    ["width", state.activePart === 0 || state.activePart === 3 ? "Shared width" : "Width", 48, 620],
    ["height", state.activePart === 0 || state.activePart === 3 ? "Shared height" : "Height", 36, 360],
    ["visible", "Visible from left", 1, 100]
  ];
  fields.forEach(([key, label, min, max]) => {
    createRange(
      form,
      { label, min, max },
      () => ellipse[key],
      (value) => {
        ellipse[key] = value;
        normalizeEllipseConstraints(state.activePart);
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
    const distance = Math.hypot(world.x - item.x, world.y - item.y);
    return distance < best.distance ? { ...item, distance } : best;
  }, { distance: Infinity });
}

controls.geometryCanvas.addEventListener("pointerdown", (event) => {
  const transform = transformForCanvas(controls.geometryCanvas, GEOMETRY_BOX);
  const world = transform.toWorld(pointerPosition(event));
  const nearest = nearestHandle(world);
  if (nearest.distance > 18) return;
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

function createUnitSvg(offset, flip, variant) {
  const palette = palettes[state.palette];
  const sx = flip ? -state.layout.scale : state.layout.scale;
  const transform = `translate(${offset.x} ${offset.y}) scale(${sx} ${state.layout.scale})`;
  const fill = palette[Math.abs(variant) % palette.length];
  const paths = state.ellipses.flatMap((ellipse) => {
    return [
      `<path d="${svgPolyline(sampleArc(ellipse, 48))}" />`,
      `<path d="${svgPolyline(sampleArc(ellipse, 48, true))}" />`
    ];
  }).join("\n      ");
  return `<g transform="${transform}">
    <path d="${svgPolyline(fishOutlinePoints())} Z" fill="${fill}" opacity="0.82" />
    <g fill="none" stroke="${palette[4] || "#191919"}" stroke-width="${PATTERN_STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">
      ${paths}
    </g>
    <circle cx="${state.module.eyeX}" cy="0" r="${state.module.eyeRadius}" fill="${palette[4] || "#191919"}" />
  </g>`;
}

function exportSvg() {
  const pitch = state.layout.pitchY * state.layout.scale;
  const columnPitch = MODULE_WIDTH * state.layout.columnSpacing * state.layout.scale;
  const rowStart = -Math.floor((state.layout.rows - 1) / 2);
  const rowEnd = rowStart + state.layout.rows;
  const colStart = -Math.floor((state.layout.columns - 1) / 2);
  const colEnd = colStart + state.layout.columns;
  const units = [];
  for (let row = rowStart; row < rowEnd; row += 1) {
    for (let col = colStart; col < colEnd; col += 1) {
      const flip = (row + col) % 2 !== 0;
      units.push(createUnitSvg({
        x: ART_BOX.width / 2 + state.layout.offsetX + col * columnPitch,
        y: ART_BOX.height / 2 + state.layout.offsetY + row * pitch
      }, flip, row * 7 + col));
    }
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${ART_BOX.width}" height="${ART_BOX.height}" viewBox="0 0 ${ART_BOX.width} ${ART_BOX.height}">
  <rect width="100%" height="100%" fill="#ede8dc" />
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
buildControls();
setPage("pattern");
