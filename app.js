'use strict';

const STRUCTURES = [
  { id: '1', name: 'Desert Temple', short: 'DT', key: 'desert temple', color: '#d9b96f', group: 'rare' },
  { id: '2', name: 'Jungle Temple', short: 'JT', key: 'jungle temple', color: '#7fbe77', group: 'rare' },
  { id: '3', name: 'Witch Hut', short: 'WH', key: 'witch hut', color: '#c0a6eb', group: 'rare' },
  { id: '4', name: 'Igloo', short: 'IG', key: 'igloo', color: '#a8d5de', group: 'rare' },
  { id: '5', name: 'Village', short: 'V', key: 'village', color: '#d8c779', group: 'village' },
  { id: '6', name: 'Ocean Ruins', short: 'OR', key: 'ocean ruins', color: '#86c7d8', group: 'ocean' },
  { id: '7', name: 'Shipwreck', short: 'SW', key: 'shipwreck', color: '#86c7d8', group: 'ocean' },
  { id: '8', name: 'Ocean Monument', short: 'OM', key: 'monument', color: '#72b7cc', group: 'ocean' },
  { id: '9', name: 'Woodland Mansion', short: 'WM', key: 'mansion', color: '#b5a2e8', group: 'rare' },
  { id: '10', name: 'Pillager Outpost', short: 'PO', key: 'outpost', color: '#e49a79', group: 'rare' },
  { id: '11', name: 'Ruined Portal', short: 'RP', key: 'ruined portal', color: '#d69b76', group: 'rare' },
  { id: '12', name: 'Nether Ruined Portal', short: 'NP', key: 'nether portal', color: '#d69b76', group: 'rare' },
  { id: '13', name: 'Ancient City', short: 'AC', key: 'ancient city', color: '#b6a1e5', group: 'rare' },
  { id: '14', name: 'Buried Treasure', short: 'BT', key: 'treasure', color: '#e3c56f', group: 'rare' },
  { id: '15', name: 'Mineshaft', short: 'MS', key: 'mineshaft', color: '#b1bba1', group: 'rare' },
  { id: '23', name: 'Trail Ruins', short: 'TR', key: 'trail ruins', color: '#d2a77b', group: 'rare' },
  { id: '24', name: 'Trial Chamber', short: 'TC', key: 'trial chamber', color: '#b7a2eb', group: 'rare' }
];

const els = {
  form: document.getElementById('scan-form'),
  seed: document.getElementById('seed'),
  x: document.getElementById('coord-x'),
  z: document.getElementById('coord-z'),
  radius: document.getElementById('radius'),
  max: document.getElementById('max-results'),
  options: document.getElementById('structure-options'),
  toggleStructures: document.getElementById('toggle-structures'),
  randomSeed: document.getElementById('random-seed'),
  scanButton: document.getElementById('scan-button'),
  scanButtonLabel: document.getElementById('scan-button-label'),
  canvas: document.getElementById('world-map'),
  stage: document.getElementById('map-stage'),
  subtitle: document.getElementById('map-subtitle'),
  zoomValue: document.getElementById('zoom-value'),
  zoomIn: document.getElementById('zoom-in'),
  zoomOut: document.getElementById('zoom-out'),
  resetView: document.getElementById('reset-view'),
  centerMap: document.getElementById('center-map'),
  cursorCoords: document.getElementById('cursor-coords'),
  mapEmpty: document.getElementById('map-empty'),
  mapLoading: document.getElementById('map-loading'),
  clickedCoordinate: document.getElementById('clicked-coordinate'),
  clickedCoordsText: document.getElementById('clicked-coords-text'),
  useClickedCoords: document.getElementById('use-clicked-coords'),
  resultCount: document.getElementById('result-count'),
  resultsStatus: document.getElementById('results-status'),
  resultsList: document.getElementById('results-list'),
  resultsEmpty: document.getElementById('results-empty'),
  shareLink: document.getElementById('share-link'),
  toast: document.getElementById('toast')
};

const state = {
  results: [],
  scanned: false,
  loading: false,
  scanCenter: { x: 0, z: 0 },
  viewCenter: { x: 0, z: 0 },
  radius: 100,
  zoom: 1,
  selectedResult: null,
  clickedPoint: null,
  pointer: null,
  movedPointer: false,
  lastRequestAt: 0,
  toastTimer: null
};

let ctx = null;
let mapWidth = 0;
let mapHeight = 0;
let dpr = 1;

function selectedStructureIds() {
  return Array.from(els.options.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
}

function buildStructureOptions() {
  const fragment = document.createDocumentFragment();
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('types') ? params.get('types').split(',') : ['1', '5', '7', '8', '10', '13', '24'];
  for (const structure of STRUCTURES) {
    const label = document.createElement('label');
    label.className = 'structure-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = structure.id;
    checkbox.checked = requested.includes(structure.id);
    checkbox.setAttribute('aria-label', structure.name);
    const name = document.createElement('span');
    name.textContent = structure.name;
    label.append(checkbox, name);
    fragment.appendChild(label);
  }
  els.options.replaceChildren(fragment);
  updateToggleLabel();
}

function updateToggleLabel() {
  const count = selectedStructureIds().length;
  els.toggleStructures.textContent = count === STRUCTURES.length ? 'Clear all' : 'Select all';
}

function parseNumberField(input, label, min, max) {
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < min || value > max) {
    input.focus();
    throw new Error(`${label} must be between ${min.toLocaleString()} and ${max.toLocaleString()}.`);
  }
  return Math.trunc(value);
}

function readSettings() {
  const seed = els.seed.value.trim();
  if (!/^-?\d{1,20}$/.test(seed)) {
    els.seed.focus();
    throw new Error('Enter a numeric Minecraft seed (up to 20 digits).');
  }
  const x = Number(els.x.value);
  const z = Number(els.z.value);
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 30000000 || Math.abs(z) > 30000000) {
    throw new Error('X and Z must be valid coordinates between -30,000,000 and 30,000,000.');
  }
  const radius = parseNumberField(els.radius, 'Radius', 1, 1000);
  const max = parseNumberField(els.max, 'Max results', 1, 200);
  const types = selectedStructureIds();
  if (!types.length) throw new Error('Select at least one structure type.');
  return { seed, x: Math.trunc(x), z: Math.trunc(z), radius, max, types };
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => els.toast.classList.remove('visible'), 2200);
}

async function copyText(value, successMessage = 'Copied to clipboard.') {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const succeeded = document.execCommand('copy');
      area.remove();
      if (!succeeded) throw new Error('Clipboard unavailable');
    }
    showToast(successMessage);
  } catch {
    showToast('Copy failed. You can select the coordinates manually.');
  }
}

function buildShareUrl(settings) {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('seed', settings.seed);
  url.searchParams.set('x', String(settings.x));
  url.searchParams.set('z', String(settings.z));
  url.searchParams.set('radius', String(settings.radius));
  url.searchParams.set('max', String(settings.max));
  url.searchParams.set('types', settings.types.join(','));
  return url.toString();
}

function syncUrl(settings) {
  const url = new URL(buildShareUrl(settings));
  window.history.replaceState({}, '', url.pathname + url.search);
}

function prettyName(name) {
  const clean = String(name || 'Structure').replaceAll('_', ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const match = STRUCTURES.find(item => clean === item.key || clean === item.name.toLowerCase() || clean.includes(item.key));
  return match ? match.name : clean.replace(/\b\w/g, letter => letter.toUpperCase());
}

function structureForResult(result) {
  const clean = String(result?.name || '').replaceAll('_', ' ').toLowerCase();
  return STRUCTURES.find(item => clean === item.key || clean === item.name.toLowerCase() || clean.includes(item.key)) || {
    id: 'other', name: prettyName(result?.name), short: '•', color: '#a6b99d', group: 'rare'
  };
}

function blockDistance(result, center = state.scanCenter) {
  return Math.hypot(Number(result.x) - center.x, Number(result.z) - center.z);
}

function setLoading(isLoading) {
  state.loading = isLoading;
  els.scanButton.disabled = isLoading;
  els.scanButtonLabel.textContent = isLoading ? 'Scanning…' : 'Scan this seed';
  els.mapLoading.hidden = !isLoading;
  els.scanButton.querySelector('.button-arrow').textContent = isLoading ? '…' : '→';
}

function setResultsStatus(text, isError = false) {
  els.resultsStatus.textContent = text;
  els.resultsStatus.classList.toggle('error', isError);
}

async function scanSeed(event) {
  if (event) event.preventDefault();
  if (state.loading) return;
  const now = Date.now();
  if (now - state.lastRequestAt < 1400) {
    showToast('Please wait a moment before scanning again.');
    return;
  }

  let settings;
  try {
    settings = readSettings();
  } catch (error) {
    setResultsStatus(error.message, true);
    showToast(error.message);
    return;
  }

  state.lastRequestAt = now;
  state.radius = settings.radius;
  state.scanCenter = { x: settings.x, z: settings.z };
  state.viewCenter = { x: settings.x, z: settings.z };
  state.zoom = 1;
  state.clickedPoint = null;
  state.selectedResult = null;
  els.clickedCoordinate.hidden = true;
  els.mapEmpty.hidden = true;
  els.subtitle.textContent = `Center: X ${formatInteger(settings.x)} · Z ${formatInteger(settings.z)}`;
  syncUrl(settings);
  setLoading(true);
  setResultsStatus('Querying the Bedrock structure service…');
  drawMap();

  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(settings),
      cache: 'no-store'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload.error || payload.message || `Request failed (HTTP ${response.status}).`;
      throw new Error(detail);
    }
    if (!Array.isArray(payload.results)) throw new Error('The structure service returned an unexpected response.');
    state.results = payload.results.filter(item => Number.isFinite(Number(item.x)) && Number.isFinite(Number(item.z)));
    state.scanned = true;
    renderResults();
    drawMap();
    if (state.results.length) {
      setResultsStatus(`Found ${state.results.length} structure${state.results.length === 1 ? '' : 's'} for this search. Select a result to focus the map.`);
    } else {
      setResultsStatus('No supported structures were returned for this seed, center, and selected types. Try increasing the radius.');
    }
    showToast(state.results.length ? `Scan complete · ${state.results.length} results` : 'Scan complete · no structures found');
  } catch (error) {
    state.results = [];
    state.scanned = false;
    renderResults();
    drawMap();
    let message = error instanceof Error ? error.message : 'Unknown request error.';
    if (message === 'Failed to fetch' || message.includes('NetworkError')) {
      message = 'Could not reach the structure service. Check your connection and try again.';
    }
    setResultsStatus(message, true);
    showToast('Scan failed. See the results panel.');
  } finally {
    setLoading(false);
    els.mapEmpty.hidden = state.scanned;
    updateZoomLabel();
    drawMap();
  }
}

function formatInteger(number) {
  return Math.round(Number(number)).toLocaleString('en-US');
}

function renderResults() {
  els.resultCount.textContent = String(state.results.length);
  els.resultsList.replaceChildren();
  els.resultsEmpty.hidden = state.results.length > 0;
  const fragment = document.createDocumentFragment();
  state.results.forEach((result, index) => {
    const structure = structureForResult(result);
    const card = document.createElement('article');
    card.className = 'structure-result' + (state.selectedResult === result ? ' selected' : '');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${structure.name} at X ${result.x}, Z ${result.z}`);
    card.addEventListener('click', () => focusResult(result));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focusResult(result); }
    });

    const top = document.createElement('div'); top.className = 'result-topline';
    const icon = document.createElement('span'); icon.className = 'result-icon'; icon.textContent = structure.short; icon.style.color = structure.color;
    const nameGroup = document.createElement('div'); nameGroup.className = 'result-name-group';
    const name = document.createElement('div'); name.className = 'result-name'; name.textContent = structure.name;
    const distance = document.createElement('div'); distance.className = 'result-distance';
    const distanceChunks = Number.isFinite(Number(result.distance)) ? Number(result.distance) : blockDistance(result) / 16;
    distance.textContent = `${distanceChunks.toFixed(1)} chunks away`;
    nameGroup.append(name, distance); top.append(icon, nameGroup);

    const coordRow = document.createElement('div'); coordRow.className = 'result-coords';
    const code = document.createElement('code'); code.textContent = `X ${formatInteger(result.x)} · Z ${formatInteger(result.z)}`;
    const actions = document.createElement('div'); actions.className = 'result-actions';
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy'; copy.setAttribute('aria-label', `Copy coordinates for ${structure.name}`);
    copy.addEventListener('click', event => { event.stopPropagation(); copyText(`${Math.round(Number(result.x))} ${Math.round(Number(result.z))}`, 'X Z coordinates copied.'); });
    const tp = document.createElement('button'); tp.type = 'button'; tp.textContent = '/tp'; tp.setAttribute('aria-label', `Copy teleport command for ${structure.name}`);
    tp.addEventListener('click', event => { event.stopPropagation(); copyText(`/tp @s ${Math.round(Number(result.x))} ~ ${Math.round(Number(result.z))}`, 'Teleport command copied.'); });
    actions.append(copy, tp); coordRow.append(code, actions); card.append(top, coordRow); fragment.append(card);
  });
  els.resultsList.append(fragment);
}

function focusResult(result) {
  state.selectedResult = result;
  state.viewCenter = { x: Number(result.x), z: Number(result.z) };
  state.zoom = Math.max(state.zoom, 1.4);
  renderResults();
  drawMap();
  updateZoomLabel();
  els.cursorCoords.textContent = `X ${formatInteger(result.x)} · Z ${formatInteger(result.z)}`;
}

function updateZoomLabel() {
  els.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
}

function niceGridStep(targetPixels, scale) {
  const targetWorld = targetPixels / Math.max(scale, 0.000001);
  const power = Math.pow(10, Math.floor(Math.log10(Math.max(targetWorld, 1))));
  const candidates = [1, 2, 5, 10].map(multiplier => multiplier * power);
  return candidates.reduce((best, candidate) => Math.abs(candidate - targetWorld) < Math.abs(best - targetWorld) ? candidate : best, candidates[0]);
}

function currentScale() {
  const viewRadiusBlocks = Math.max(state.radius * 16, 256);
  return Math.min(mapWidth, mapHeight) / (viewRadiusBlocks * 2.12) * state.zoom;
}

function worldToScreen(x, z, scale = currentScale()) {
  return { x: mapWidth / 2 + (x - state.viewCenter.x) * scale, y: mapHeight / 2 + (z - state.viewCenter.z) * scale };
}

function screenToWorld(x, y, scale = currentScale()) {
  return { x: state.viewCenter.x + (x - mapWidth / 2) / scale, z: state.viewCenter.z + (y - mapHeight / 2) / scale };
}

function drawMap() {
  if (!ctx || !mapWidth || !mapHeight) return;
  const g = ctx;
  g.clearRect(0, 0, mapWidth, mapHeight);
  g.fillStyle = '#111a13'; g.fillRect(0, 0, mapWidth, mapHeight);
  const scale = currentScale();
  const minX = state.viewCenter.x - mapWidth / (2 * scale);
  const maxX = state.viewCenter.x + mapWidth / (2 * scale);
  const minZ = state.viewCenter.z - mapHeight / (2 * scale);
  const maxZ = state.viewCenter.z + mapHeight / (2 * scale);
  const step = niceGridStep(64, scale);

  // A coordinate grid, not generated terrain: each line represents world X/Z blocks.
  g.lineWidth = 1;
  g.strokeStyle = 'rgba(135, 164, 121, .105)';
  g.beginPath();
  for (let x = Math.floor(minX / step) * step; x <= maxX; x += step) {
    const px = worldToScreen(x, 0, scale).x;
    g.moveTo(Math.round(px) + .5, 0); g.lineTo(Math.round(px) + .5, mapHeight);
  }
  for (let z = Math.floor(minZ / step) * step; z <= maxZ; z += step) {
    const py = worldToScreen(0, z, scale).y;
    g.moveTo(0, Math.round(py) + .5); g.lineTo(mapWidth, Math.round(py) + .5);
  }
  g.stroke();

  // Every second line receives small coordinate labels.
  const labelStep = step * (scale * step < 72 ? 2 : 1);
  g.font = '10px "DM Mono", ui-monospace, monospace';
  g.fillStyle = 'rgba(163, 184, 151, .58)';
  g.textBaseline = 'top';
  for (let x = Math.ceil(minX / labelStep) * labelStep; x <= maxX; x += labelStep) {
    const px = worldToScreen(x, 0, scale).x;
    if (px > 30 && px < mapWidth - 20) g.fillText(shortCoordinate(x), px + 4, 7);
  }
  for (let z = Math.ceil(minZ / labelStep) * labelStep; z <= maxZ; z += labelStep) {
    const py = worldToScreen(0, z, scale).y;
    if (py > 25 && py < mapHeight - 22) g.fillText(shortCoordinate(z), 7, py + 4);
  }

  // World origin axes.
  const origin = worldToScreen(0, 0, scale);
  g.save();
  g.strokeStyle = 'rgba(179, 206, 158, .28)'; g.lineWidth = 1; g.setLineDash([4, 6]);
  if (origin.x >= 0 && origin.x <= mapWidth) { g.beginPath(); g.moveTo(origin.x, 0); g.lineTo(origin.x, mapHeight); g.stroke(); }
  if (origin.y >= 0 && origin.y <= mapHeight) { g.beginPath(); g.moveTo(0, origin.y); g.lineTo(mapWidth, origin.y); g.stroke(); }
  g.restore();

  // Mark scan center.
  drawCenterMarker(worldToScreen(state.scanCenter.x, state.scanCenter.z, scale));

  for (const result of state.results) {
    const p = worldToScreen(Number(result.x), Number(result.z), scale);
    if (p.x < -30 || p.x > mapWidth + 30 || p.y < -30 || p.y > mapHeight + 30) continue;
    drawStructureMarker(p.x, p.y, structureForResult(result), state.selectedResult === result);
  }

  if (state.clickedPoint) {
    const p = worldToScreen(state.clickedPoint.x, state.clickedPoint.z, scale);
    if (p.x >= 0 && p.x <= mapWidth && p.y >= 0 && p.y <= mapHeight) {
      g.save(); g.strokeStyle = '#e1e9d5'; g.lineWidth = 1; g.setLineDash([3, 3]);
      g.beginPath(); g.arc(p.x, p.y, 10, 0, Math.PI * 2); g.stroke(); g.restore();
    }
  }

  // A small scale bar in the bottom-right corner.
  const niceDistance = niceGridStep(84, scale);
  const barPx = niceDistance * scale;
  if (barPx < mapWidth - 35) {
    const x = mapWidth - barPx - 17; const y = mapHeight - 22;
    g.strokeStyle = '#a1b996'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + barPx, y); g.stroke();
    g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x, y + 4); g.moveTo(x + barPx, y - 4); g.lineTo(x + barPx, y + 4); g.stroke();
    g.fillStyle = '#95a98b'; g.font = '9px "DM Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillText(`${shortCoordinate(niceDistance)} blocks`, x + barPx / 2, y - 5); g.textAlign = 'start';
  }
}

function shortCoordinate(value) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(abs % 1000000 === 0 ? 0 : 1)}m`;
  if (abs >= 10000) return `${sign}${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(value));
}

function drawCenterMarker(point) {
  if (point.x < -20 || point.x > mapWidth + 20 || point.y < -20 || point.y > mapHeight + 20) return;
  ctx.save();
  ctx.strokeStyle = '#a9d78a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(point.x, point.y, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(point.x - 12, point.y); ctx.lineTo(point.x + 12, point.y); ctx.moveTo(point.x, point.y - 12); ctx.lineTo(point.x, point.y + 12); ctx.stroke();
  ctx.fillStyle = '#bce6a0'; ctx.beginPath(); ctx.arc(point.x, point.y, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawStructureMarker(x, y, structure, selected) {
  ctx.save();
  ctx.shadowColor = structure.color; ctx.shadowBlur = selected ? 12 : 5;
  ctx.fillStyle = structure.color; ctx.globalAlpha = .19; ctx.beginPath(); ctx.arc(x, y, selected ? 12 : 9, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.fillStyle = '#132016'; ctx.strokeStyle = selected ? '#f1f6eb' : structure.color; ctx.lineWidth = selected ? 2 : 1.5;
  ctx.beginPath(); ctx.arc(x, y, selected ? 8 : 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = structure.color; ctx.font = 'bold 7px "DM Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(structure.short.length > 2 ? structure.short.slice(0, 2) : structure.short, x, y + .25);
  if (selected || state.zoom >= 1.5) {
    const label = structure.name;
    ctx.font = '10px "DM Sans", system-ui, sans-serif';
    const width = Math.min(ctx.measureText(label).width + 12, 155);
    const labelX = Math.max(4, Math.min(mapWidth - width - 4, x + 10));
    const labelY = Math.max(4, Math.min(mapHeight - 23, y - 21));
    ctx.fillStyle = 'rgba(15, 23, 15, .92)'; ctx.strokeStyle = 'rgba(107, 133, 89, .65)'; ctx.lineWidth = 1;
    roundRect(ctx, labelX, labelY, width, 20, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#dce8d4'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, labelX + 6, labelY + 10, width - 10);
  }
  ctx.restore();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function resizeCanvas() {
  if (!els.canvas) return;
  const rect = els.canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  mapWidth = rect.width; mapHeight = rect.height;
  els.canvas.width = Math.round(mapWidth * dpr);
  els.canvas.height = Math.round(mapHeight * dpr);
  ctx = els.canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawMap();
}

function setZoom(nextZoom, anchorX = mapWidth / 2, anchorY = mapHeight / 2) {
  const oldScale = currentScale();
  const anchored = screenToWorld(anchorX, anchorY, oldScale);
  state.zoom = Math.max(.45, Math.min(6, nextZoom));
  const newScale = currentScale();
  state.viewCenter.x = anchored.x - (anchorX - mapWidth / 2) / newScale;
  state.viewCenter.z = anchored.z - (anchorY - mapHeight / 2) / newScale;
  updateZoomLabel(); drawMap();
}

function canvasPosition(event) {
  const rect = els.canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function pickStructureAt(x, y) {
  let nearest = null; let nearestDistance = Infinity;
  for (const result of state.results) {
    const p = worldToScreen(Number(result.x), Number(result.z));
    const distance = Math.hypot(x - p.x, y - p.y);
    if (distance < 16 && distance < nearestDistance) { nearest = result; nearestDistance = distance; }
  }
  return nearest;
}

function handleCanvasPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  const p = canvasPosition(event);
  state.pointer = { id: event.pointerId, startX: p.x, startY: p.y, lastX: p.x, lastY: p.y };
  state.movedPointer = false;
  els.canvas.setPointerCapture?.(event.pointerId);
}

function handleCanvasPointerMove(event) {
  const p = canvasPosition(event);
  if (!state.pointer || state.pointer.id !== event.pointerId) {
    const world = screenToWorld(p.x, p.y);
    els.cursorCoords.textContent = `X ${formatInteger(world.x)} · Z ${formatInteger(world.z)}`;
    return;
  }
  const dx = p.x - state.pointer.lastX;
  const dy = p.y - state.pointer.lastY;
  if (Math.hypot(p.x - state.pointer.startX, p.y - state.pointer.startY) > 4) state.movedPointer = true;
  if (state.movedPointer) {
    const scale = currentScale();
    state.viewCenter.x -= dx / scale;
    state.viewCenter.z -= dy / scale;
    els.canvas.classList.add('is-dragging');
    drawMap();
  }
  state.pointer.lastX = p.x; state.pointer.lastY = p.y;
  const world = screenToWorld(p.x, p.y);
  els.cursorCoords.textContent = `X ${formatInteger(world.x)} · Z ${formatInteger(world.z)}`;
}

function handleCanvasPointerUp(event) {
  if (!state.pointer || state.pointer.id !== event.pointerId) return;
  const p = canvasPosition(event);
  if (!state.movedPointer) {
    const result = pickStructureAt(p.x, p.y);
    if (result) {
      focusResult(result);
    } else {
      const world = screenToWorld(p.x, p.y);
      state.clickedPoint = { x: Math.round(world.x), z: Math.round(world.z) };
      els.clickedCoordsText.textContent = `X ${formatInteger(world.x)} · Z ${formatInteger(world.z)}`;
      els.clickedCoordinate.hidden = false;
      drawMap();
    }
  }
  state.pointer = null;
  els.canvas.classList.remove('is-dragging');
}

function handleWheel(event) {
  event.preventDefault();
  const p = canvasPosition(event);
  setZoom(state.zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15), p.x, p.y);
}

function initializeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get('seed'); if (seed && /^-?\d{1,20}$/.test(seed)) els.seed.value = seed;
  const x = params.get('x'); if (x && Number.isFinite(Number(x))) els.x.value = String(Math.trunc(Number(x)));
  const z = params.get('z'); if (z && Number.isFinite(Number(z))) els.z.value = String(Math.trunc(Number(z)));
  const radius = params.get('radius'); if (radius && Number(radius) >= 1 && Number(radius) <= 1000) els.radius.value = String(Math.trunc(Number(radius)));
  const max = params.get('max'); if (max && Number(max) >= 1 && Number(max) <= 200) els.max.value = String(Math.trunc(Number(max)));
  state.scanCenter = { x: Number(els.x.value) || 0, z: Number(els.z.value) || 0 };
  state.viewCenter = { ...state.scanCenter };
  state.radius = Number(els.radius.value) || 100;
  els.subtitle.textContent = `Center: X ${formatInteger(state.scanCenter.x)} · Z ${formatInteger(state.scanCenter.z)}`;
}

function bindEvents() {
  els.form.addEventListener('submit', scanSeed);
  els.options.addEventListener('change', updateToggleLabel);
  els.toggleStructures.addEventListener('click', () => {
    const checkboxes = Array.from(els.options.querySelectorAll('input[type="checkbox"]'));
    const selectAll = checkboxes.some(input => !input.checked);
    checkboxes.forEach(input => { input.checked = selectAll; });
    updateToggleLabel();
  });
  els.randomSeed.addEventListener('click', () => {
    const words = new Uint32Array(2);
    if (window.crypto?.getRandomValues) crypto.getRandomValues(words);
    else { words[0] = Math.floor(Math.random() * 0xffffffff); words[1] = Math.floor(Math.random() * 0xffffffff); }
    const seed = (BigInt(words[0]) << 32n) | BigInt(words[1]);
    els.seed.value = seed.toString();
    els.seed.focus();
  });
  els.zoomIn.addEventListener('click', () => setZoom(state.zoom * 1.25));
  els.zoomOut.addEventListener('click', () => setZoom(state.zoom / 1.25));
  els.resetView.addEventListener('click', () => {
    state.viewCenter = { ...state.scanCenter }; state.zoom = 1; updateZoomLabel(); drawMap();
  });
  els.centerMap.addEventListener('click', () => {
    state.viewCenter = { ...state.scanCenter }; state.zoom = 1; updateZoomLabel(); drawMap();
  });
  els.useClickedCoords.addEventListener('click', () => {
    if (!state.clickedPoint) return;
    els.x.value = String(state.clickedPoint.x); els.z.value = String(state.clickedPoint.z);
    state.scanCenter = { ...state.clickedPoint }; state.viewCenter = { ...state.clickedPoint };
    els.subtitle.textContent = `Center: X ${formatInteger(state.scanCenter.x)} · Z ${formatInteger(state.scanCenter.z)}`;
    els.clickedCoordinate.hidden = true; drawMap(); showToast('Search center updated. Scan again to find nearby structures.');
  });
  els.shareLink.addEventListener('click', async () => {
    try { await copyText(buildShareUrl(readSettings()), 'Share link copied.'); }
    catch (error) { showToast(error.message); }
  });
  els.canvas.addEventListener('pointerdown', handleCanvasPointerDown);
  els.canvas.addEventListener('pointermove', handleCanvasPointerMove);
  els.canvas.addEventListener('pointerup', handleCanvasPointerUp);
  els.canvas.addEventListener('pointercancel', handleCanvasPointerUp);
  els.canvas.addEventListener('wheel', handleWheel, { passive: false });
  window.addEventListener('resize', resizeCanvas);
  if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(els.stage);
}

buildStructureOptions();
initializeFromUrl();
bindEvents();
resizeCanvas();
updateZoomLabel();
renderResults();
