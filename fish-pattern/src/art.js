const FISH_BOX = { width: 760, height: 560 };
const A0_MM = { width: 1189, height: 841 };
const LAYOUT_BOX = { width: 1400, height: Math.round(1400 * A0_MM.height / A0_MM.width) };
const LAYOUT_X_MIN = -FISH_BOX.width;
const LAYOUT_X_MAX = LAYOUT_BOX.width + FISH_BOX.width;
const AXIS_Y = FISH_BOX.height / 2;
const LAYOUT_AXIS_Y = LAYOUT_BOX.height / 2;
const VIEW_PADDING = 56;
const ART_NAME = "fish-pattern";
const API_ART_URL = `/api/files/${encodeURIComponent(ART_NAME)}`;
const PATTERN_STORAGE_KEY = "fish-pattern-library-v1";
const LAYOUT_STORAGE_KEY = "fish-layout-library-v1";

const canvas = document.querySelector("#fish");
const ctx = canvas.getContext("2d");

const defaults = {
  eyeX: 88,
  eyeRadius: 13,
  e1X: 420,
  e1Width: 700,
  e1Height: 390,
  e1Visible: 100,
  e2X: 420,
  e2Width: 240,
  e2Height: 380,
  e2Visible: 100,
  e3X: 445,
  e3Width: 224,
  e3Height: 164,
  e4X: 500,
  e4Visible: 38,
  strokeWidth: 7,
  guides: true,
  fullEllipses: false
};

const patternParamNames = Object.keys(defaults);
const savedParamNames = patternParamNames.filter((name) => !["guides", "fullEllipses"].includes(name));
const controls = {
  readout: document.querySelector("#readout"),
  patternViewButton: document.querySelector("#patternViewButton"),
  layoutViewButton: document.querySelector("#layoutViewButton"),
  patternControls: document.querySelector("#patternControls"),
  layoutControls: document.querySelector("#layoutControls"),
  patternActionSheet: document.querySelector("#patternActionSheet"),
  layoutActionSheet: document.querySelector("#layoutActionSheet"),
  layoutZoom: document.querySelector("#layoutZoom"),
  layoutZoomValue: document.querySelector("#layoutZoomValue"),
  patternName: document.querySelector("#patternName"),
  patternLoadSelect: document.querySelector("#patternLoadSelect"),
  loadPattern: document.querySelector("#loadPattern"),
  savePattern: document.querySelector("#savePattern"),
  resetPattern: document.querySelector("#resetPattern"),
  exportPatternSvg: document.querySelector("#exportPatternSvg"),
  exportPatternPng: document.querySelector("#exportPatternPng"),
  layoutName: document.querySelector("#layoutName"),
  layoutLoadSelect: document.querySelector("#layoutLoadSelect"),
  loadLayout: document.querySelector("#loadLayout"),
  saveLayout: document.querySelector("#saveLayout"),
  resetLayout: document.querySelector("#resetLayout"),
  exportLayoutSvg: document.querySelector("#exportLayoutSvg"),
  exportLayoutPng: document.querySelector("#exportLayoutPng"),
  savedPatterns: document.querySelector("#savedPatterns"),
  layoutItems: document.querySelector("#layoutItems")
};
const outputs = {};

patternParamNames.forEach((name) => {
  controls[name] = document.querySelector(`#${name}`);
  outputs[name] = document.querySelector(`#${name}Value`);
});

let currentView = "pattern";
let savedPatterns = [];
let savedLayouts = [];
let layoutItems = [];

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function ellipseFromOptions(options, number, label) {
  const width = number === 4 ? options.e1Width : options[`e${number}Width`];
  const height = number === 4 ? options.e1Height : options[`e${number}Height`];
  const visible = number === 3 ? 100 : options[`e${number}Visible`];

  return {
    label,
    x: options[`e${number}X`],
    y: AXIS_Y,
    rx: width / 2,
    ry: height / 2,
    visible
  };
}

function fishEllipses(options) {
  return [
    ellipseFromOptions(options, 1, "ellipse 1"),
    ellipseFromOptions(options, 2, "ellipse 2"),
    ellipseFromOptions(options, 3, "ellipse 3"),
    ellipseFromOptions(options, 4, "ellipse 4")
  ];
}

function visibleArcAngles(ellipse) {
  const halfAngle = (180 * ellipse.visible) / 100 / 2;
  return {
    start: degreesToRadians(180 - halfAngle),
    end: degreesToRadians(180 + halfAngle)
  };
}

function drawEllipseArc(target, ellipse, fullEllipse) {
  const angles = visibleArcAngles(ellipse);
  const start = fullEllipse ? 0 : angles.start;
  const end = fullEllipse ? Math.PI * 2 : angles.end;
  target.beginPath();
  target.ellipse(ellipse.x, ellipse.y, ellipse.rx, ellipse.ry, 0, start, end);
  target.stroke();
}

function drawPoint(target, point, radius) {
  target.beginPath();
  target.arc(point.x, point.y, radius, 0, Math.PI * 2);
  target.fill();
}

function drawGuides(target, options, ellipses, width = FISH_BOX.width) {
  target.save();
  target.strokeStyle = "rgba(223, 91, 53, 0.72)";
  target.lineWidth = 1.5;
  target.setLineDash([12, 9]);
  target.beginPath();
  target.moveTo(20, AXIS_Y);
  target.lineTo(width - 20, AXIS_Y);
  target.stroke();

  target.strokeStyle = "rgba(47, 121, 145, 0.35)";
  target.setLineDash([5, 8]);
  ellipses.forEach((ellipse) => {
    target.beginPath();
    target.ellipse(ellipse.x, ellipse.y, ellipse.rx, ellipse.ry, 0, 0, Math.PI * 2);
    target.stroke();
  });
  target.restore();

  target.fillStyle = "#df5b35";
  ellipses.forEach((ellipse) => drawPoint(target, { x: ellipse.x, y: ellipse.y }, 4.5));
  drawPoint(target, { x: options.eyeX, y: AXIS_Y }, 4.5);
}

function drawPatternShape(target, options, settings = {}) {
  const ellipses = fishEllipses(options);
  const showGuides = Boolean(settings.guides);
  const fullEllipses = Boolean(settings.fullEllipses);

  if (showGuides) drawGuides(target, options, ellipses);

  target.strokeStyle = "#18221f";
  target.lineWidth = options.strokeWidth;
  target.lineCap = "round";
  target.lineJoin = "round";
  ellipses.forEach((ellipse) => drawEllipseArc(target, ellipse, fullEllipses));

  target.fillStyle = "#18221f";
  drawPoint(target, { x: options.eyeX, y: AXIS_Y }, options.eyeRadius);
}

function withViewTransform(target, box, draw) {
  const scale = Math.min(
    (target.canvas.width - VIEW_PADDING * 2) / box.width,
    (target.canvas.height - VIEW_PADDING * 2) / box.height
  );
  const offsetX = (target.canvas.width - box.width * scale) / 2;
  const offsetY = (target.canvas.height - box.height * scale) / 2;

  target.save();
  target.translate(offsetX, offsetY);
  target.scale(scale, scale);
  draw();
  target.restore();
}

function clearCanvas(target) {
  target.clearRect(0, 0, target.canvas.width, target.canvas.height);
  target.fillStyle = "#f7f4ed";
  target.fillRect(0, 0, target.canvas.width, target.canvas.height);
}

function drawPatternView(target, options) {
  clearCanvas(target);
  withViewTransform(target, FISH_BOX, () => {
    drawPatternShape(target, options, {
      guides: options.guides,
      fullEllipses: options.fullEllipses
    });
  });
}

function drawLayoutFish(target, item, pattern) {
  const zoom = getLayoutZoom();
  target.save();
  target.translate(item.x, LAYOUT_AXIS_Y);
  target.scale(zoom, zoom);
  target.translate(-FISH_BOX.width / 2, -AXIS_Y);
  if (item.flipped) {
    target.translate(FISH_BOX.width, 0);
    target.scale(-1, 1);
  }
  drawPatternShape(target, pattern.params, { guides: false, fullEllipses: false });
  target.restore();
}

function drawLayoutView(target) {
  clearCanvas(target);
  withViewTransform(target, LAYOUT_BOX, () => {
    drawA0Frame(target);

    target.save();
    target.strokeStyle = "rgba(223, 91, 53, 0.72)";
    target.lineWidth = 1.5;
    target.setLineDash([12, 9]);
    target.beginPath();
    target.moveTo(20, LAYOUT_AXIS_Y);
    target.lineTo(LAYOUT_BOX.width - 20, LAYOUT_AXIS_Y);
    target.stroke();
    target.restore();

    layoutItems.forEach((item) => {
      const pattern = savedPatterns.find((saved) => saved.id === item.patternId);
      if (pattern) drawLayoutFish(target, item, pattern);
    });
  });
}

function drawA0Frame(target) {
  target.save();
  target.fillStyle = "rgba(255, 255, 255, 0.34)";
  target.strokeStyle = "rgba(24, 34, 31, 0.42)";
  target.lineWidth = 2;
  target.setLineDash([]);
  target.fillRect(0, 0, LAYOUT_BOX.width, LAYOUT_BOX.height);
  target.strokeRect(0, 0, LAYOUT_BOX.width, LAYOUT_BOX.height);

  target.fillStyle = "rgba(24, 34, 31, 0.62)";
  target.font = "16px ui-monospace, SFMono-Regular, Menlo, monospace";
  target.fillText("A0 landscape 1189 x 841 mm", 14, 24);
  target.restore();
}

function getPatternOptions() {
  const options = {};
  patternParamNames.forEach((name) => {
    const control = controls[name];
    if (control instanceof HTMLInputElement && control.type === "checkbox") {
      options[name] = control.checked;
    } else {
      options[name] = Number(control.value);
    }
  });
  return options;
}

function getSavedParamsFromControls() {
  const options = getPatternOptions();
  return Object.fromEntries(savedParamNames.map((name) => [name, options[name]]));
}

function applyPatternParams(params) {
  savedParamNames.forEach((name) => {
    if (params[name] === undefined || !controls[name]) return;
    controls[name].value = String(params[name]);
  });
  render();
}

function updatePatternReadout(options) {
  const ellipses = fishEllipses(options);
  controls.readout.innerHTML = [
    "<strong>Single pattern view</strong>",
    `Shared center line: y=${AXIS_Y}`,
    `Eye center: (${options.eyeX}, ${AXIS_Y})`,
    `Ellipse centers: ${ellipses.map((ellipse) => `(${ellipse.x}, ${ellipse.y})`).join(", ")}`,
    `Ellipse 1 and 4 share size: ${options.e1Width} x ${options.e1Height}`
  ].join("<br>");

  Object.entries(outputs).forEach(([name, output]) => {
    if (output) output.value = controls[name].value;
  });
}

function updateLayoutReadout() {
  controls.readout.innerHTML = [
    "<strong>Layout view</strong>",
    `Saved patterns: ${savedPatterns.length}`,
    `Fishes in layout: ${layoutItems.length}`,
    `Layout zoom: ${Math.round(getLayoutZoom() * 100)}%`,
    `All layout fish centers stay on A0 midline y=${LAYOUT_AXIS_Y}; only X is editable.`
  ].join("<br>");
}

function getLayoutZoom() {
  return Number(controls.layoutZoom.value) / 100;
}

function loadLegacyLocalStorageItems(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLegacyLocalStorageLibrary() {
  return {
    patterns: loadLegacyLocalStorageItems(PATTERN_STORAGE_KEY),
    layouts: loadLegacyLocalStorageItems(LAYOUT_STORAGE_KEY)
  };
}

async function loadSavedLibraryFromApi() {
  try {
    const response = await fetch(API_ART_URL);
    if (!response.ok) return;
    const library = await response.json();
    savedPatterns = Array.isArray(library.patterns) ? library.patterns : [];
    savedLayouts = Array.isArray(library.layouts) ? library.layouts : [];
    renderSavedPatterns();
    renderLayoutItems();
    updateLayoutLoadSelect();
    render();
  } catch (error) {
    console.warn("Could not load saved art from backend API.", error);
  }
}

async function exportLocalStorageToServer() {
  const legacy = readLegacyLocalStorageLibrary();
  const patternResults = await Promise.allSettled(
    legacy.patterns.map((pattern) => persistArtifactToApi("pattern", pattern))
  );
  const layoutResults = await Promise.allSettled(
    legacy.layouts.map((layout) => persistArtifactToApi("layout", layout))
  );
  const failed = [...patternResults, ...layoutResults].filter((result) => result.status === "rejected");

  await loadSavedLibraryFromApi();
  const summary = {
    patterns: legacy.patterns.length,
    layouts: legacy.layouts.length,
    failed: failed.length
  };
  console.info("Exported localStorage art library to server files.", summary);
  return summary;
}

async function persistArtifactToApi(kind, artifact) {
  const collection = kind === "pattern" ? "patterns" : "layouts";
  const name = encodeURIComponent(artifact.name || artifact.id || "untitled");
  const response = await fetch(`${API_ART_URL}/${collection}/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(artifact)
  });
  if (!response.ok) {
    throw new Error(`Save failed with ${response.status}`);
  }
}

async function saveCurrentPattern() {
  const name = controls.patternName.value.trim() || `Pattern ${savedPatterns.length + 1}`;
  const pattern = {
    id: `pattern-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    params: getSavedParamsFromControls()
  };
  try {
    await persistArtifactToApi("pattern", pattern);
  } catch (error) {
    console.error("Pattern save failed.", error);
    return;
  }
  savedPatterns = [...savedPatterns.filter((saved) => saved.name !== pattern.name), pattern];
  controls.patternName.value = `Pattern ${savedPatterns.length + 1}`;
  updatePatternLoadSelect(pattern.id);
  renderSavedPatterns();
  render();
}

function loadSelectedPattern() {
  const pattern = savedPatterns.find((saved) => saved.id === controls.patternLoadSelect.value);
  if (!pattern) return;
  applyPatternParams(pattern.params);
  controls.patternName.value = pattern.name;
}

function deletePattern(id) {
  savedPatterns = savedPatterns.filter((pattern) => pattern.id !== id);
  layoutItems = layoutItems.filter((item) => item.patternId !== id);
  renderSavedPatterns();
  renderLayoutItems();
  render();
}

function addLayoutFish(patternId, flipped = false) {
  layoutItems = [
    ...layoutItems,
    {
      id: `fish-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      patternId,
      flipped,
      x: Math.round(LAYOUT_BOX.width / 2)
    }
  ];
  renderLayoutItems();
  render();
}

function updateLayoutFishX(id, value) {
  layoutItems = layoutItems.map((item) => (item.id === id ? { ...item, x: value } : item));
  render();
}

function removeLayoutFish(id) {
  layoutItems = layoutItems.filter((item) => item.id !== id);
  renderLayoutItems();
  render();
}

async function saveCurrentLayout() {
  const name = controls.layoutName.value.trim() || `Layout ${savedLayouts.length + 1}`;
  const layout = {
    id: `layout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    zoom: Number(controls.layoutZoom.value),
    items: layoutItems.map((item) => ({ ...item }))
  };
  try {
    await persistArtifactToApi("layout", layout);
  } catch (error) {
    console.error("Layout save failed.", error);
    return;
  }
  savedLayouts = [...savedLayouts.filter((saved) => saved.name !== layout.name), layout];
  controls.layoutName.value = `Layout ${savedLayouts.length + 1}`;
  updateLayoutLoadSelect(layout.id);
  render();
}

function loadSelectedLayout() {
  const layout = savedLayouts.find((saved) => saved.id === controls.layoutLoadSelect.value);
  if (!layout) return;
  layoutItems = layout.items.map((item) => ({ ...item }));
  controls.layoutZoom.value = String(layout.zoom || 100);
  controls.layoutName.value = layout.name;
  renderLayoutItems();
  render();
}

function renderSavedPatterns() {
  updatePatternLoadSelect(controls.patternLoadSelect.value);
  controls.savedPatterns.innerHTML = "";
  if (savedPatterns.length === 0) {
    controls.savedPatterns.innerHTML = '<p class="empty">No saved patterns yet.</p>';
    return;
  }

  savedPatterns.forEach((pattern) => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `<strong>${pattern.name}</strong>`;

    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "Add";
    add.addEventListener("click", () => addLayoutFish(pattern.id, false));

    const addFlipped = document.createElement("button");
    addFlipped.type = "button";
    addFlipped.textContent = "Add flipped";
    addFlipped.addEventListener("click", () => addLayoutFish(pattern.id, true));

    row.append(add, addFlipped);
    controls.savedPatterns.append(row);
  });
}

function updatePatternLoadSelect(selectedId = "") {
  controls.patternLoadSelect.innerHTML = "";
  if (savedPatterns.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved patterns";
    controls.patternLoadSelect.append(option);
    controls.patternLoadSelect.disabled = true;
    controls.loadPattern.disabled = true;
    return;
  }

  controls.patternLoadSelect.disabled = false;
  controls.loadPattern.disabled = false;
  savedPatterns.forEach((pattern) => {
    const option = document.createElement("option");
    option.value = pattern.id;
    option.textContent = pattern.name;
    controls.patternLoadSelect.append(option);
  });

  const fallback = savedPatterns[0].id;
  controls.patternLoadSelect.value = savedPatterns.some((pattern) => pattern.id === selectedId) ? selectedId : fallback;
}

function updateLayoutLoadSelect(selectedId = "") {
  controls.layoutLoadSelect.innerHTML = "";
  if (savedLayouts.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved layouts";
    controls.layoutLoadSelect.append(option);
    controls.layoutLoadSelect.disabled = true;
    controls.loadLayout.disabled = true;
  return;
  }

  controls.layoutLoadSelect.disabled = false;
  controls.loadLayout.disabled = false;
  savedLayouts.forEach((layout) => {
    const option = document.createElement("option");
    option.value = layout.id;
    option.textContent = layout.name;
    controls.layoutLoadSelect.append(option);
  });

  const fallback = savedLayouts[0].id;
  controls.layoutLoadSelect.value = savedLayouts.some((layout) => layout.id === selectedId) ? selectedId : fallback;
}

function renderLayoutItems() {
  controls.layoutItems.innerHTML = "";
  if (layoutItems.length === 0) {
    controls.layoutItems.innerHTML = '<p class="empty">No fish in the layout yet.</p>';
    return;
  }

  layoutItems.forEach((item, index) => {
    const pattern = savedPatterns.find((saved) => saved.id === item.patternId);
    const row = document.createElement("div");
    row.className = "list-row";

    const title = document.createElement("strong");
    title.textContent = `${index + 1}. ${pattern ? pattern.name : "Missing pattern"}${item.flipped ? " flipped" : ""}`;

    const label = document.createElement("label");
    label.className = "compact-label";
    label.innerHTML = "<span>X</span>";

    const range = document.createElement("input");
    range.type = "range";
    range.min = String(LAYOUT_X_MIN);
    range.max = String(LAYOUT_X_MAX);
    range.value = String(item.x);

    const number = document.createElement("input");
    number.type = "number";
    number.className = "number-input";
    number.min = range.min;
    number.max = range.max;
    number.value = range.value;

    range.addEventListener("input", () => {
      number.value = range.value;
      updateLayoutFishX(item.id, Number(range.value));
    });

    number.addEventListener("blur", () => {
      const next = clamp(Number(number.value), Number(number.min), Number(number.max));
      number.value = String(next);
      range.value = String(next);
      updateLayoutFishX(item.id, next);
    });

    number.addEventListener("keydown", (event) => {
      if (event.key === "Enter") number.blur();
    });

    label.append(range, number);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeLayoutFish(item.id));

    row.append(title, label, remove);
    controls.layoutItems.append(row);
  });
}

function setView(view) {
  currentView = view;
  const isPattern = view === "pattern";
  controls.patternControls.hidden = !isPattern;
  controls.layoutControls.hidden = isPattern;
  controls.patternActionSheet.hidden = !isPattern;
  controls.layoutActionSheet.hidden = isPattern;
  controls.patternViewButton.classList.toggle("is-active", isPattern);
  controls.layoutViewButton.classList.toggle("is-active", !isPattern);
  render();
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function addNumberInputs() {
  controls.patternControls.querySelectorAll('input[type="range"]').forEach((range) => {
    const number = document.createElement("input");
    number.className = "number-input";
    number.type = "number";
    number.min = range.min;
    number.max = range.max;
    number.step = range.step || "1";
    number.value = range.value;
    number.setAttribute("aria-label", `${range.id} numeric value`);

    range.insertAdjacentElement("afterend", number);

    range.addEventListener("input", () => {
      number.value = range.value;
    });

    function applyNumberValue() {
      if (number.value === "") return;
      const next = clamp(Number(number.value), Number(range.min), Number(range.max));
      range.value = String(next);
      number.value = String(next);
      render();
    }

    number.addEventListener("blur", applyNumberValue);
    number.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        applyNumberValue();
        number.blur();
      }
    });
  });
}

function syncNumberInputs() {
  controls.patternControls.querySelectorAll('input[type="range"]').forEach((range) => {
    const number = range.nextElementSibling;
    if (number instanceof HTMLInputElement && number.type === "number") {
      number.value = range.value;
    }
  });
}

function render() {
  if (currentView === "pattern") {
    const options = getPatternOptions();
    drawPatternView(ctx, options);
    updatePatternReadout(options);
    syncNumberInputs();
  } else {
    drawLayoutView(ctx);
    updateLayoutReadout();
    controls.layoutZoomValue.value = `${controls.layoutZoom.value}%`;
  }
}

function arcPath(ellipse, fullEllipse) {
  if (fullEllipse) {
    return [
      `M ${ellipse.x - ellipse.rx} ${ellipse.y}`,
      `A ${ellipse.rx} ${ellipse.ry} 0 1 0 ${ellipse.x + ellipse.rx} ${ellipse.y}`,
      `A ${ellipse.rx} ${ellipse.ry} 0 1 0 ${ellipse.x - ellipse.rx} ${ellipse.y}`
    ].join(" ");
  }

  const { start, end } = visibleArcAngles(ellipse);
  const startPoint = {
    x: ellipse.x + Math.cos(start) * ellipse.rx,
    y: ellipse.y + Math.sin(start) * ellipse.ry
  };
  const endPoint = {
    x: ellipse.x + Math.cos(end) * ellipse.rx,
    y: ellipse.y + Math.sin(end) * ellipse.ry
  };
  const largeArc = Math.abs(end - start) > Math.PI ? 1 : 0;

  return `M ${startPoint.x} ${startPoint.y} A ${ellipse.rx} ${ellipse.ry} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y}`;
}

function patternSvgContent(options, fullEllipses = false) {
  const ellipses = fishEllipses(options);
  const paths = ellipses.map((ellipse) => `<path d="${arcPath(ellipse, fullEllipses)}" />`).join("\n    ");
  return `  <g fill="none" stroke="#18221f" stroke-width="${options.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
    ${paths}
  </g>
  <circle cx="${options.eyeX}" cy="${AXIS_Y}" r="${options.eyeRadius}" fill="#18221f" />`;
}

function createPatternSvg(options) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${FISH_BOX.width}" height="${FISH_BOX.height}" viewBox="0 0 ${FISH_BOX.width} ${FISH_BOX.height}">
  <rect width="100%" height="100%" fill="#f7f4ed" />
${patternSvgContent(options, options.fullEllipses)}
</svg>
`;
}

function createLayoutSvg() {
  const instances = layoutItems
    .map((item) => {
      const pattern = savedPatterns.find((saved) => saved.id === item.patternId);
      if (!pattern) return "";
      const zoom = getLayoutZoom();
      const transform = item.flipped
        ? `translate(${item.x} ${LAYOUT_AXIS_Y}) scale(${zoom} ${zoom}) translate(${-FISH_BOX.width / 2} ${-AXIS_Y}) translate(${FISH_BOX.width} 0) scale(-1 1)`
        : `translate(${item.x} ${LAYOUT_AXIS_Y}) scale(${zoom} ${zoom}) translate(${-FISH_BOX.width / 2} ${-AXIS_Y})`;
      return `<g transform="${transform}">\n${patternSvgContent(pattern.params, false)}\n  </g>`;
    })
    .filter(Boolean)
    .join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${A0_MM.width}mm" height="${A0_MM.height}mm" viewBox="0 0 ${LAYOUT_BOX.width} ${LAYOUT_BOX.height}">
  <rect width="100%" height="100%" fill="#f7f4ed" />
  ${instances}
</svg>
`;
}

function download(filename, href) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = href;
  link.click();
}

function exportSvg() {
  const svg = currentView === "pattern" ? createPatternSvg(getPatternOptions()) : createLayoutSvg();
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  download(currentView === "pattern" ? "single-fish.svg" : "fish-layout.svg", url);
  URL.revokeObjectURL(url);
}

function exportPng() {
  const output = document.createElement("canvas");
  if (currentView === "pattern") {
    output.width = FISH_BOX.width * 2;
    output.height = FISH_BOX.height * 2;
    drawPatternView(output.getContext("2d"), { ...getPatternOptions(), guides: false });
    download("single-fish.png", output.toDataURL("image/png"));
  } else {
    output.width = LAYOUT_BOX.width * 2;
    output.height = LAYOUT_BOX.height * 2;
    drawLayoutView(output.getContext("2d"));
    download("fish-layout.png", output.toDataURL("image/png"));
  }
}

function resetPatternControls() {
  Object.entries(defaults).forEach(([key, value]) => {
    const control = controls[key];
    if (!control) return;
    if (control instanceof HTMLInputElement && control.type === "checkbox") {
      control.checked = Boolean(value);
    } else {
      control.value = String(value);
    }
  });
  render();
}

function resetLayoutControls() {
  layoutItems = [];
  renderLayoutItems();
  render();
}

patternParamNames.forEach((name) => {
  const control = controls[name];
  if (control instanceof HTMLInputElement) {
    control.addEventListener("input", render);
    control.addEventListener("change", render);
  }
});

controls.patternViewButton.addEventListener("click", () => setView("pattern"));
controls.layoutViewButton.addEventListener("click", () => setView("layout"));
controls.layoutZoom.addEventListener("input", render);
controls.layoutZoom.addEventListener("change", render);
controls.loadPattern.addEventListener("click", loadSelectedPattern);
controls.savePattern.addEventListener("click", saveCurrentPattern);
controls.loadLayout.addEventListener("click", loadSelectedLayout);
controls.saveLayout.addEventListener("click", saveCurrentLayout);
controls.resetPattern.addEventListener("click", resetPatternControls);
controls.resetLayout.addEventListener("click", resetLayoutControls);
controls.exportPatternSvg.addEventListener("click", exportSvg);
controls.exportPatternPng.addEventListener("click", exportPng);
controls.exportLayoutSvg.addEventListener("click", exportSvg);
controls.exportLayoutPng.addEventListener("click", exportPng);

addNumberInputs();
renderSavedPatterns();
renderLayoutItems();
updateLayoutLoadSelect();
setView("pattern");
loadSavedLibraryFromApi();
window.exportLocalStorageToServer = exportLocalStorageToServer;
